import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Raqeem AI Daily Summary — Role-based intelligent briefing
 * 
 * Generates a personalized daily summary for each user role:
 * - Owner: portfolio overview, bottlenecks, revenue insights
 * - Inspector: pending tasks, upcoming inspections
 * - Client: request status updates
 * - Financial Manager: payment health, collection status
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get auth header to identify user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userRole = "owner";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Parse body for explicit params
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    
    if (body.user_id) userId = body.user_id;
    if (body.role) userRole = body.role;

    // Determine role
    if (userId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (roleData) userRole = roleData.role;
    }

    // Get user profile
    let userName = "";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar")
        .eq("user_id", userId)
        .maybeSingle();
      userName = profile?.full_name_ar || "";
    }

    const now = new Date();
    const greeting = now.getHours() < 12 ? "صباح الخير" : "مساء الخير";
    const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    let summaryData: any = {};

    // ═══════════════════════════════════════
    // OWNER SUMMARY
    // ═══════════════════════════════════════
    if (userRole === "owner") {
      // Active assignments by status
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, status, updated_at, reference_number, created_at")
        .not("status", "in", "(issued,archived,cancelled)")
        .order("updated_at", { ascending: true });

      const items = assignments || [];
      const threeDays = 3 * 86400000;

      const statusCounts: Record<string, number> = {};
      let staleCount = 0;
      let needsActionCount = 0;
      const ownerActionStatuses = ["professional_review", "draft_report_ready", "scope_generated"];

      for (const a of items) {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        if (now.getTime() - new Date(a.updated_at).getTime() > threeDays) staleCount++;
        if (ownerActionStatuses.includes(a.status)) needsActionCount++;
      }

      // Today's new
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { count: todayNew } = await supabase
        .from("valuation_assignments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart);

      // Completed this week
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { count: weekCompleted } = await supabase
        .from("valuation_assignments")
        .select("id", { count: "exact", head: true })
        .in("status", ["issued", "archived"])
        .gte("updated_at", weekStart);

      // Pending payments
      const { data: pendingPayments } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("payment_status", "pending");

      const totalPending = (pendingPayments || []).reduce((s: number, p: any) => s + (p.total_amount || 0), 0);

      // Unread notifications
      const ownerUserIds = userId ? [userId] : [];
      let unreadNotifs = 0;
      if (userId) {
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false);
        unreadNotifs = count || 0;
      }

      summaryData = {
        role: "owner",
        greeting: `${greeting}${userName ? " " + userName : ""}`,
        date: dateStr,
        stats: {
          totalActive: items.length,
          needsAction: needsActionCount,
          stale: staleCount,
          todayNew: todayNew || 0,
          weekCompleted: weekCompleted || 0,
          pendingRevenue: totalPending,
          unreadNotifications: unreadNotifs,
        },
        statusBreakdown: statusCounts,
        insights: [] as string[],
      };

      // Generate insights
      if (needsActionCount > 0) {
        summaryData.insights.push(`🔔 ${needsActionCount} ملف بانتظار قرارك — يُنصح بمراجعتها أولاً`);
      }
      if (staleCount > 0) {
        summaryData.insights.push(`⏰ ${staleCount} ملف متوقف أكثر من 3 أيام — تحتاج متابعة`);
      }
      if (totalPending > 0) {
        summaryData.insights.push(`💰 ${totalPending.toLocaleString()} ر.س مستحقات معلقة`);
      }
      if ((todayNew || 0) > 0) {
        summaryData.insights.push(`📥 ${todayNew} طلب جديد اليوم`);
      }
      if ((weekCompleted || 0) > 0) {
        summaryData.insights.push(`✅ ${weekCompleted} تقرير مكتمل هذا الأسبوع`);
      }
      if (summaryData.insights.length === 0) {
        summaryData.insights.push("✓ لا توجد مهام عاجلة — جميع الملفات تسير بانتظام");
      }
    }

    // ═══════════════════════════════════════
    // INSPECTOR SUMMARY
    // ═══════════════════════════════════════
    else if (userRole === "inspector" && userId) {
      const { data: myInspections } = await supabase
        .from("inspections")
        .select("id, assignment_id, inspection_date, status")
        .eq("inspector_id", userId)
        .not("status", "in", "(submitted,completed,cancelled)")
        .order("inspection_date", { ascending: true });

      const pending = (myInspections || []).filter((i: any) => i.status === "pending" || i.status === "scheduled");
      const overdue = pending.filter((i: any) => new Date(i.inspection_date) < now);

      summaryData = {
        role: "inspector",
        greeting: `${greeting}${userName ? " " + userName : ""}`,
        date: dateStr,
        stats: {
          pendingInspections: pending.length,
          overdueInspections: overdue.length,
        },
        insights: [] as string[],
      };

      if (overdue.length > 0) {
        summaryData.insights.push(`⚠ ${overdue.length} معاينة متأخرة — يرجى إكمالها بأسرع وقت`);
      }
      if (pending.length > 0) {
        summaryData.insights.push(`📋 ${pending.length} معاينة قادمة بانتظارك`);
      }
      if (pending.length === 0 && overdue.length === 0) {
        summaryData.insights.push("✓ لا توجد مهام معاينة حالياً");
      }
    }

    // ═══════════════════════════════════════
    // CLIENT SUMMARY
    // ═══════════════════════════════════════
    else if (userRole === "client" && userId) {
      const { data: myRequests } = await supabase
        .from("valuation_requests")
        .select("id, status, assignment_id, created_at, updated_at")
        .eq("client_user_id", userId)
        .not("status", "in", "(cancelled)")
        .order("created_at", { ascending: false })
        .limit(10);

      const active = (myRequests || []).filter((r: any) => !["issued", "archived"].includes(r.status));

      summaryData = {
        role: "client",
        greeting: `${greeting}${userName ? " " + userName : ""}`,
        date: dateStr,
        stats: {
          activeRequests: active.length,
          totalRequests: (myRequests || []).length,
        },
        insights: [] as string[],
      };

      if (active.length > 0) {
        summaryData.insights.push(`📊 لديك ${active.length} طلب نشط قيد المعالجة`);
      } else {
        summaryData.insights.push("✓ لا توجد طلبات نشطة حالياً");
      }
    }

    // ═══════════════════════════════════════
    // FINANCIAL MANAGER SUMMARY
    // ═══════════════════════════════════════
    else if (userRole === "financial_manager") {
      const { data: pendingInvoices } = await supabase
        .from("invoices")
        .select("id, total_amount, due_date, payment_status")
        .eq("payment_status", "pending");

      const { data: paidThisWeek } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("payment_status", "paid")
        .gte("paid_at", new Date(now.getTime() - 7 * 86400000).toISOString());

      const totalPending = (pendingInvoices || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const totalCollected = (paidThisWeek || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const overdueCount = (pendingInvoices || []).filter((i: any) => i.due_date && new Date(i.due_date) < now).length;

      summaryData = {
        role: "financial_manager",
        greeting: `${greeting}${userName ? " " + userName : ""}`,
        date: dateStr,
        stats: {
          pendingInvoices: (pendingInvoices || []).length,
          totalPending,
          totalCollectedThisWeek: totalCollected,
          overdueInvoices: overdueCount,
        },
        insights: [] as string[],
      };

      if (overdueCount > 0) {
        summaryData.insights.push(`⚠ ${overdueCount} فاتورة متأخرة تحتاج متابعة`);
      }
      if (totalPending > 0) {
        summaryData.insights.push(`💰 ${totalPending.toLocaleString()} ر.س مستحقات معلقة`);
      }
      if (totalCollected > 0) {
        summaryData.insights.push(`✅ ${totalCollected.toLocaleString()} ر.س تم تحصيلها هذا الأسبوع`);
      }
    }

    // ═══════════════════════════════════════
    // AI-ENHANCED MESSAGE (optional)
    // ═══════════════════════════════════════
    let aiMessage = "";
    if (LOVABLE_API_KEY && summaryData.insights && summaryData.insights.length > 0) {
      try {
        const aiPrompt = `أنت "رقيم"، المساعد الذكي لمنصة تقييم سعودية. اكتب ملخصاً يومياً موجزاً (3-5 أسطر) بالعربية بأسلوب مهني ودي.
الدور: ${summaryData.role === "owner" ? "المالك/المقيّم المعتمد" : summaryData.role === "inspector" ? "المعاين" : summaryData.role === "client" ? "العميل" : "المدير المالي"}
البيانات: ${JSON.stringify(summaryData.stats)}
النقاط: ${summaryData.insights.join(" | ")}
التاريخ: ${dateStr}

اكتب الملخص كرسالة مباشرة بدون عنوان. ابدأ بالتحية "${summaryData.greeting}". لا تستخدم إيموجي. كن محدداً بالأرقام.`;

        const aiResponse = await fetch("https://ai.lovable.dev/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "أنت رقيم — المساعد الذكي لمنصة التقييم. أجب بالعربية فقط." },
              { role: "user", content: aiPrompt },
            ],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiMessage = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI summary generation failed:", e);
      }
    }

    // Build final response
    const finalMessage = aiMessage || summaryData.insights?.join("\n") || "لا توجد بيانات كافية";

    return new Response(JSON.stringify({
      success: true,
      summary: {
        ...summaryData,
        message: finalMessage,
        generatedAt: now.toISOString(),
        isAiGenerated: !!aiMessage,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Daily summary error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
