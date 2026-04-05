import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// Notification type definitions with role relevance and default channels
const NOTIFICATION_DEFS: Record<string, {
  category: string;
  roles: string[];
  defaultPriority: string;
  defaultChannels: { in_app: boolean; email: boolean; sms: boolean };
}> = {
  // Owner notifications
  new_request: { category: "workflow", roles: ["owner"], defaultPriority: "medium", defaultChannels: { in_app: true, email: true, sms: false } },
  request_ready_review: { category: "workflow", roles: ["owner"], defaultPriority: "high", defaultChannels: { in_app: true, email: true, sms: false } },
  critical_compliance: { category: "compliance", roles: ["owner"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  high_risk_valuation: { category: "compliance", roles: ["owner"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  report_ready_approval: { category: "report", roles: ["owner"], defaultPriority: "high", defaultChannels: { in_app: true, email: true, sms: false } },
  report_issued: { category: "report", roles: ["owner"], defaultPriority: "medium", defaultChannels: { in_app: true, email: true, sms: false } },
  client_matching_issue: { category: "system", roles: ["owner"], defaultPriority: "low", defaultChannels: { in_app: true, email: false, sms: false } },
  failed_processing: { category: "system", roles: ["owner"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  archive_import_issue: { category: "system", roles: ["owner"], defaultPriority: "low", defaultChannels: { in_app: true, email: false, sms: false } },

  // Client notifications
  request_submitted: { category: "workflow", roles: ["client"], defaultPriority: "high", defaultChannels: { in_app: true, email: true, sms: true } },
  request_processing: { category: "workflow", roles: ["client"], defaultPriority: "low", defaultChannels: { in_app: true, email: false, sms: false } },
  additional_info_requested: { category: "workflow", roles: ["client"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  inspection_scheduled: { category: "inspection", roles: ["client"], defaultPriority: "high", defaultChannels: { in_app: true, email: true, sms: true } },
  report_completed: { category: "report", roles: ["client"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  report_available: { category: "report", roles: ["client"], defaultPriority: "high", defaultChannels: { in_app: true, email: true, sms: false } },

  // Inspector notifications
  new_inspection_assigned: { category: "inspection", roles: ["inspector"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  inspection_date_update: { category: "inspection", roles: ["inspector"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  overdue_inspection: { category: "inspection", roles: ["inspector"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  inspection_submission_confirmed: { category: "inspection", roles: ["inspector"], defaultPriority: "medium", defaultChannels: { in_app: true, email: true, sms: false } },

  // Financial manager notifications
  new_payment: { category: "financial", roles: ["financial_manager"], defaultPriority: "medium", defaultChannels: { in_app: true, email: true, sms: false } },
  payment_received: { category: "financial", roles: ["financial_manager"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  overdue_payment: { category: "financial", roles: ["financial_manager"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
  payment_mismatch: { category: "financial", roles: ["financial_manager"], defaultPriority: "critical", defaultChannels: { in_app: true, email: true, sms: true } },
};

// Arabic templates
const TEMPLATES_AR: Record<string, { title: string; body: string }> = {
  new_request: { title: "طلب تقييم جديد", body: "يوجد طلب تقييم جديد يحتاج متابعة." },
  request_ready_review: { title: "طلب جاهز للمراجعة", body: "طلب التقييم جاهز للمراجعة والاعتماد." },
  critical_compliance: { title: "مشكلة حرجة في الامتثال", body: "تم رصد مشكلة حرجة في الامتثال تحتاج تدخل فوري." },
  high_risk_valuation: { title: "تقييم عالي المخاطر", body: "تم رصد تقييم عالي المخاطر يحتاج مراجعة." },
  report_ready_approval: { title: "تقرير جاهز للاعتماد", body: "التقرير جاهز للاعتماد النهائي." },
  report_issued: { title: "تم إصدار التقرير", body: "تم إصدار التقرير بنجاح." },
  client_matching_issue: { title: "مشكلة مطابقة عميل", body: "يوجد سجل عميل يحتاج مراجعة المطابقة." },
  failed_processing: { title: "فشل في المعالجة", body: "فشلت عملية معالجة، يرجى المراجعة." },
  archive_import_issue: { title: "مشكلة في استيراد الأرشيف", body: "يوجد مشكلة في استيراد تقرير أرشيفي." },
  request_submitted: { title: "تم استلام طلبك", body: "تم استلام طلب التقييم بنجاح، وجارٍ البدء في الإجراءات." },
  request_processing: { title: "طلبك قيد المعالجة", body: "طلب التقييم الخاص بك قيد المعالجة حالياً." },
  additional_info_requested: { title: "مطلوب معلومات إضافية", body: "يرجى تزويدنا بمعلومات إضافية لإكمال طلبك." },
  inspection_scheduled: { title: "تم جدولة المعاينة", body: "تم تحديد موعد المعاينة الميدانية." },
  report_completed: { title: "تم الانتهاء من التقرير", body: "تم الانتهاء من إعداد التقرير، ويمكنك الآن الاطلاع عليه." },
  report_available: { title: "التقرير متاح للتحميل", body: "تقرير التقييم متاح الآن للتحميل." },
  new_inspection_assigned: { title: "معاينة جديدة", body: "تم إسناد معاينة جديدة لك." },
  inspection_date_update: { title: "تحديث موعد المعاينة", body: "تم تحديث موعد المعاينة المطلوبة." },
  overdue_inspection: { title: "تأخير في المعاينة", body: "يوجد تأخير في تسليم المعاينة المطلوبة." },
  inspection_submission_confirmed: { title: "تم استلام المعاينة", body: "تم استلام تقرير المعاينة بنجاح." },
  new_payment: { title: "سجل دفع جديد", body: "تم تسجيل دفعة جديدة في النظام." },
  payment_received: { title: "تم استلام الدفعة", body: "تم تأكيد استلام الدفعة بنجاح." },
  overdue_payment: { title: "فاتورة متأخرة", body: "توجد فاتورة متأخرة تحتاج متابعة." },
  payment_mismatch: { title: "تفاوت في المدفوعات", body: "تم رصد تفاوت في سجلات المدفوعات يحتاج مراجعة." },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      user_id,
      notification_type,
      title_ar,
      body_ar,
      priority,
      action_url,
      related_assignment_id,
      related_request_id,
      custom_data,
    } = await req.json();

    if (!user_id || !notification_type) {
      return new Response(JSON.stringify({ error: "user_id and notification_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const def = NOTIFICATION_DEFS[notification_type];
    if (!def) {
      return new Response(JSON.stringify({ error: `Unknown notification type: ${notification_type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = TEMPLATES_AR[notification_type];
    const finalTitle = title_ar || template?.title || "إشعار";
    const finalBody = body_ar || template?.body || "";
    const finalPriority = priority || def.defaultPriority;

    // Get user preferences
    const { data: pref } = await supabase
      .from("notification_preferences")
      .select("in_app_enabled, email_enabled, sms_enabled")
      .eq("user_id", user_id)
      .eq("notification_type", notification_type)
      .maybeSingle();

    const channels = pref || def.defaultChannels;

    // Priority override rules
    const sendInApp = channels.in_app_enabled !== false;
    const sendEmail = finalPriority === "critical" ? true :
      finalPriority === "high" ? (channels.email_enabled !== false) :
      channels.email_enabled === true;
    const sendSms = finalPriority === "critical" ? (channels.sms_enabled !== false) :
      channels.sms_enabled === true;

    const results: Record<string, any> = {};

    // 1. In-app notification
    if (sendInApp) {
      const { data: notif, error: notifErr } = await supabase
        .from("notifications")
        .insert({
          user_id,
          title_ar: finalTitle,
          body_ar: finalBody,
          category: def.category,
          priority: finalPriority,
          notification_type,
          channel: "in_app",
          delivery_status: "delivered",
          action_url: action_url || null,
          related_assignment_id: related_assignment_id || null,
          related_request_id: related_request_id || null,
        })
        .select("id")
        .single();

      results.in_app = notifErr ? { error: notifErr.message } : { id: notif?.id, status: "delivered" };
    }

    // Get user profile for email/SMS
    let userEmail: string | null = null;
    let userPhone: string | null = null;

    if (sendEmail || sendSms) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone")
        .eq("user_id", user_id)
        .maybeSingle();

      userEmail = profile?.email || null;
      userPhone = profile?.phone || null;

      // Also try auth user email
      if (!userEmail) {
        const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
        userEmail = authUser?.user?.email || null;
      }
    }

    // 2. Email notification
    if (sendEmail && userEmail) {
      try {
        // Use transactional email if available, otherwise log
        const { error: emailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "platform-notification",
            recipientEmail: userEmail,
            idempotencyKey: `notif-${notification_type}-${user_id}-${Date.now()}`,
            templateData: {
              title: finalTitle,
              body: finalBody,
              actionUrl: action_url || "",
              priority: finalPriority,
            },
          },
        });

        const emailStatus = emailErr ? "failed" : "sent";
        await supabase.from("notification_delivery_log").insert({
          user_id,
          channel: "email",
          status: emailStatus,
          error_message: emailErr?.message || null,
          sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
        });
        results.email = { status: emailStatus, error: emailErr?.message };
      } catch (e: any) {
        await supabase.from("notification_delivery_log").insert({
          user_id, channel: "email", status: "failed", error_message: e.message,
        });
        results.email = { status: "failed", error: e.message };
      }
    }

    // 3. SMS notification
    if (sendSms && userPhone && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_PHONE_NUMBER) {
      try {
        const normalizedPhone = userPhone.startsWith("+") ? userPhone : `+966${userPhone.replace(/^0/, "")}`;
        const smsBody = `${finalTitle}\n${finalBody}`;

        const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: normalizedPhone,
            From: TWILIO_PHONE_NUMBER,
            Body: smsBody,
          }),
        });

        const smsData = await response.json();
        const smsStatus = response.ok ? "sent" : "failed";

        await supabase.from("notification_delivery_log").insert({
          user_id, channel: "sms", status: smsStatus,
          error_message: smsStatus === "failed" ? JSON.stringify(smsData) : null,
          sent_at: smsStatus === "sent" ? new Date().toISOString() : null,
        });
        results.sms = { status: smsStatus, sid: smsData?.sid };
      } catch (e: any) {
        await supabase.from("notification_delivery_log").insert({
          user_id, channel: "sms", status: "failed", error_message: e.message,
        });
        results.sms = { status: "failed", error: e.message };
      }
    }

    return new Response(JSON.stringify({ success: true, channels: results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
