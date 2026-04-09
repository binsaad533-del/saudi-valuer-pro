import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const results = {
      seasonal_reminders: 0,
      occasion_messages: 0,
      loyalty_offers: 0,
      dormant_alerts: 0,
      satisfaction_requests: 0,
    };

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // ── 1. Seasonal Reminders: Report Expiry & Budget Season ──
    const elevenMonthsAgo = new Date(now.getTime() - 335 * 86400000).toISOString();
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 86400000).toISOString();

    const { data: expiringReports } = await db
      .from("valuation_assignments")
      .select("id, reference_number, client_id, final_value_sar, created_at")
      .eq("status", "issued")
      .not("final_value_sar", "is", null)
      .lte("created_at", elevenMonthsAgo)
      .limit(50);

    if (expiringReports?.length) {
      for (const report of expiringReports) {
        if (!report.client_id) continue;

        // Check if already reminded in last 14 days
        const { data: existing } = await db
          .from("engagement_logs")
          .select("id")
          .eq("client_id", report.client_id)
          .eq("campaign_type", "report_expiry")
          .gte("created_at", new Date(now.getTime() - 14 * 86400000).toISOString())
          .limit(1);

        if (existing?.length) continue;

        const issueDate = new Date(report.created_at);
        const daysUntilExpiry = Math.ceil(
          (issueDate.getTime() + 365 * 86400000 - now.getTime()) / 86400000
        );

        const message = daysUntilExpiry <= 0
          ? `⚠️ تقرير التقييم ${report.reference_number} منتهي الصلاحية. القيمة المقدرة سابقاً: ${report.final_value_sar?.toLocaleString()} ر.س. نوصي بإعادة التقييم لتحديث سجلاتكم.`
          : `📋 تقرير ${report.reference_number} ينتهي خلال ${daysUntilExpiry} يوم. احجز إعادة التقييم واستفد من خصم التجديد المبكر 15%.`;

        await db.from("engagement_logs").insert({
          client_id: report.client_id,
          campaign_type: "report_expiry",
          channel: "in_app",
          message_ar: message,
          delivery_status: "sent",
        });

        // Also send as notification
        const { data: clientData } = await db
          .from("clients")
          .select("portal_user_id")
          .eq("id", report.client_id)
          .single();

        if (clientData?.portal_user_id) {
          await db.from("notifications").insert({
            user_id: clientData.portal_user_id,
            title_ar: daysUntilExpiry <= 0 ? "تقرير منتهي الصلاحية" : "تقريرك يقترب من الانتهاء",
            body_ar: message,
            category: "workflow",
            priority: daysUntilExpiry <= 0 ? "high" : "medium",
            notification_type: "report_expiry_reminder",
            channel: "in_app",
            delivery_status: "delivered",
          });
        }

        results.seasonal_reminders++;
      }
    }

    // ── 2. Occasion Messages (check active occasions) ──
    const { data: occasions } = await db
      .from("occasion_templates")
      .select("*")
      .eq("is_active", true);

    for (const occ of occasions || []) {
      let isActive = false;
      if (occ.gregorian_month === currentMonth && occ.gregorian_day === currentDay) {
        isActive = true;
      }
      if (!isActive) continue;

      // Get all active clients
      const { data: activeClients } = await db
        .from("clients")
        .select("id, portal_user_id, name_ar")
        .eq("is_active", true)
        .not("portal_user_id", "is", null)
        .limit(200);

      for (const client of activeClients || []) {
        // Check if already sent this occasion this year
        const { data: alreadySent } = await db
          .from("engagement_logs")
          .select("id")
          .eq("client_id", client.id)
          .eq("campaign_type", `occasion_${occ.occasion_key}`)
          .gte("created_at", `${now.getFullYear()}-01-01`)
          .limit(1);

        if (alreadySent?.length) continue;

        let message = occ.default_message_ar;
        if (occ.include_offer && occ.offer_discount_pct) {
          message += `\n\n🎁 بهذه المناسبة، نقدم لكم خصم ${occ.offer_discount_pct}% على طلبات التقييم. كود الخصم: ${occ.occasion_key.toUpperCase()}-${now.getFullYear()}`;
        }

        await db.from("engagement_logs").insert({
          client_id: client.id,
          client_user_id: client.portal_user_id,
          campaign_type: `occasion_${occ.occasion_key}`,
          channel: "in_app",
          message_ar: message,
          delivery_status: "sent",
        });

        if (client.portal_user_id) {
          await db.from("notifications").insert({
            user_id: client.portal_user_id,
            title_ar: occ.occasion_name_ar,
            body_ar: message,
            category: "system",
            priority: "low",
            notification_type: "occasion_greeting",
            channel: "in_app",
            delivery_status: "delivered",
          });
        }

        results.occasion_messages++;
      }
    }

    // ── 3. Dormant Client Re-engagement (>90 days inactive) ──
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

    const { data: dormantScores } = await db
      .from("client_engagement_scores")
      .select("client_id, client_user_id, activity_status, last_request_at, total_requests")
      .in("activity_status", ["dormant", "churned"])
      .limit(30);

    for (const ds of dormantScores || []) {
      if (!ds.client_user_id) continue;

      // Check if already contacted in last 30 days
      const { data: recent } = await db
        .from("engagement_logs")
        .select("id")
        .eq("client_id", ds.client_id)
        .eq("campaign_type", "dormant_reengagement")
        .gte("created_at", new Date(now.getTime() - 30 * 86400000).toISOString())
        .limit(1);

      if (recent?.length) continue;

      const message = ds.total_requests > 3
        ? `نفتقد تعاملك معنا! كعميل مميز أنجزنا معاً ${ds.total_requests} تقييمات. هل لديك أصول تحتاج تحديث؟ خصم 20% حصري لك.`
        : "نتمنى أن تكونوا بخير! يسعدنا خدمتكم في أي احتياجات تقييم. تواصلوا معنا للاستفادة من عروضنا الحصرية.";

      await db.from("engagement_logs").insert({
        client_id: ds.client_id,
        client_user_id: ds.client_user_id,
        campaign_type: "dormant_reengagement",
        channel: "in_app",
        message_ar: message,
        delivery_status: "sent",
        discount_code: ds.total_requests > 3 ? "WELCOME-BACK" : null,
      });

      await db.from("notifications").insert({
        user_id: ds.client_user_id,
        title_ar: "نفتقد تعاملك معنا!",
        body_ar: message,
        category: "system",
        priority: "medium",
        notification_type: "dormant_reengagement",
        channel: "in_app",
        delivery_status: "delivered",
      });

      results.dormant_alerts++;
    }

    // ── 4. Post-completion satisfaction survey ──
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    const { data: recentlyIssued } = await db
      .from("valuation_assignments")
      .select("id, client_id, reference_number")
      .eq("status", "issued")
      .lte("updated_at", threeDaysAgo)
      .gte("updated_at", sevenDaysAgo)
      .limit(20);

    for (const assignment of recentlyIssued || []) {
      if (!assignment.client_id) continue;

      const { data: existing } = await db
        .from("engagement_logs")
        .select("id")
        .eq("client_id", assignment.client_id)
        .eq("campaign_type", "satisfaction_survey")
        .gte("created_at", new Date(now.getTime() - 30 * 86400000).toISOString())
        .limit(1);

      if (existing?.length) continue;

      const { data: clientData } = await db
        .from("clients")
        .select("portal_user_id")
        .eq("id", assignment.client_id)
        .single();

      if (!clientData?.portal_user_id) continue;

      const message = `شكراً لثقتكم! تم إصدار تقرير ${assignment.reference_number} بنجاح. رأيكم يساعدنا على التطوير — كيف تقيمون تجربتكم؟ رد بـ: ممتاز / جيد / يحتاج تحسين`;

      await db.from("engagement_logs").insert({
        client_id: assignment.client_id,
        client_user_id: clientData.portal_user_id,
        campaign_type: "satisfaction_survey",
        channel: "in_app",
        message_ar: message,
        delivery_status: "sent",
      });

      await db.from("notifications").insert({
        user_id: clientData.portal_user_id,
        title_ar: "نقدّر رأيك!",
        body_ar: message,
        category: "system",
        priority: "low",
        notification_type: "satisfaction_survey",
        channel: "in_app",
        delivery_status: "delivered",
      });

      results.satisfaction_requests++;
    }

    // ── 5. Budget season campaign (Oct-Nov) ──
    if ((currentMonth === 10 || currentMonth === 11) && currentDay === 1) {
      const { data: allActiveClients } = await db
        .from("clients")
        .select("id, portal_user_id")
        .eq("is_active", true)
        .not("portal_user_id", "is", null)
        .limit(200);

      for (const client of allActiveClients || []) {
        const { data: alreadySent } = await db
          .from("engagement_logs")
          .select("id")
          .eq("client_id", client.id)
          .eq("campaign_type", "budget_season")
          .gte("created_at", `${now.getFullYear()}-10-01`)
          .limit(1);

        if (alreadySent?.length) continue;

        const message = "📅 موسم إعداد الميزانية السنوية! تأكد من تحديث تقييمات أصولك قبل إقفال السنة المالية. نقدم خصم 15% على حزم إعادة التقييم الشاملة. كود: BUDGET-" + now.getFullYear();

        await db.from("engagement_logs").insert({
          client_id: client.id,
          client_user_id: client.portal_user_id,
          campaign_type: "budget_season",
          channel: "in_app",
          message_ar: message,
          delivery_status: "sent",
          discount_code: `BUDGET-${now.getFullYear()}`,
        });

        if (client.portal_user_id) {
          await db.from("notifications").insert({
            user_id: client.portal_user_id,
            title_ar: "موسم الميزانية — خصم حصري!",
            body_ar: message,
            category: "financial",
            priority: "medium",
            notification_type: "budget_season_reminder",
            channel: "in_app",
            delivery_status: "delivered",
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-smart-engagement error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
