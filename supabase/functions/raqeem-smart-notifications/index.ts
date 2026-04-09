import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Raqeem Smart Notifications — Proactive intelligence engine
 * 
 * Scans the system for conditions that warrant proactive notifications:
 * 1. Stale assignments (no update >48h)
 * 2. Overdue inspections
 * 3. Overdue payments (>7 days)
 * 4. Assignments needing owner action
 * 5. Client requests pending response
 * 6. Compliance gaps
 * 
 * Designed to run via pg_cron every hour or on-demand.
 */

interface SmartAlert {
  user_id: string;
  notification_type: string;
  title_ar: string;
  body_ar: string;
  priority: "low" | "medium" | "high" | "critical";
  category: string;
  action_url?: string;
  related_assignment_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const alerts: SmartAlert[] = [];
    const now = new Date();
    const twoDay = new Date(now.getTime() - 48 * 3600000);
    const sevenDay = new Date(now.getTime() - 7 * 86400000);

    // Get owner user IDs
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");
    const ownerIds = (ownerRoles || []).map((r: any) => r.user_id);

    // ═══════════════════════════════════════
    // 1. STALE ASSIGNMENTS (>48h no update)
    // ═══════════════════════════════════════
    const { data: staleAssignments } = await supabase
      .from("valuation_assignments")
      .select("id, reference_number, status, updated_at, client_id")
      .not("status", "in", "(issued,archived,cancelled,draft)")
      .lt("updated_at", twoDay.toISOString())
      .order("updated_at", { ascending: true })
      .limit(20);

    if (staleAssignments && staleAssignments.length > 0) {
      const hoursStale = (id: string, updatedAt: string) => {
        const diff = now.getTime() - new Date(updatedAt).getTime();
        return Math.floor(diff / 3600000);
      };

      for (const a of staleAssignments) {
        const hours = hoursStale(a.id, a.updated_at);
        const days = Math.floor(hours / 24);

        for (const ownerId of ownerIds) {
          alerts.push({
            user_id: ownerId,
            notification_type: "smart_stale_assignment",
            title_ar: `⏰ ملف متوقف: ${a.reference_number}`,
            body_ar: `الملف ${a.reference_number} لم يتحدث منذ ${days} يوم. المرحلة الحالية تحتاج متابعة.`,
            priority: days > 5 ? "critical" : days > 3 ? "high" : "medium",
            category: "workflow",
            action_url: `/assignment/${a.id}`,
            related_assignment_id: a.id,
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // 2. ASSIGNMENTS NEEDING OWNER ACTION
    // ═══════════════════════════════════════
    const ownerActionStatuses = [
      "professional_review",
      "draft_report_ready",
    ];
    const { data: ownerActionItems } = await supabase
      .from("valuation_assignments")
      .select("id, reference_number, status, updated_at")
      .in("status", ownerActionStatuses)
      .order("updated_at", { ascending: true })
      .limit(10);

    if (ownerActionItems && ownerActionItems.length > 0) {
      for (const a of ownerActionItems) {
        for (const ownerId of ownerIds) {
          alerts.push({
            user_id: ownerId,
            notification_type: "smart_owner_action_needed",
            title_ar: `🔔 بانتظارك: ${a.reference_number}`,
            body_ar: `الملف ${a.reference_number} في مرحلة تتطلب قرارك الآن.`,
            priority: "high",
            category: "workflow",
            action_url: `/assignment/${a.id}`,
            related_assignment_id: a.id,
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // 3. OVERDUE PAYMENTS (>7 days)
    // ═══════════════════════════════════════
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, due_date, client_id, assignment_id")
      .eq("payment_status", "pending")
      .lt("due_date", now.toISOString())
      .limit(20);

    if (overdueInvoices && overdueInvoices.length > 0) {
      // Notify financial managers
      const { data: fmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "financial_manager");
      const fmIds = (fmRoles || []).map((r: any) => r.user_id);

      for (const inv of overdueInvoices) {
        const dueDays = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const targets = [...ownerIds, ...fmIds];
        const uniqueTargets = [...new Set(targets)];

        for (const uid of uniqueTargets) {
          alerts.push({
            user_id: uid,
            notification_type: "smart_overdue_payment",
            title_ar: `💰 فاتورة متأخرة: ${inv.invoice_number}`,
            body_ar: `فاتورة ${inv.invoice_number} بمبلغ ${inv.total_amount} ر.س متأخرة ${dueDays} يوم.`,
            priority: dueDays > 14 ? "critical" : "high",
            category: "financial",
            action_url: inv.assignment_id ? `/assignment/${inv.assignment_id}` : undefined,
            related_assignment_id: inv.assignment_id || undefined,
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // 4. OVERDUE INSPECTIONS
    // ═══════════════════════════════════════
    const { data: overdueInspections } = await supabase
      .from("inspections")
      .select("id, assignment_id, inspector_id, inspection_date, status")
      .in("status", ["scheduled", "pending"])
      .lt("inspection_date", now.toISOString().split("T")[0])
      .limit(20);

    if (overdueInspections && overdueInspections.length > 0) {
      for (const insp of overdueInspections) {
        // Notify inspector
        if (insp.inspector_id) {
          alerts.push({
            user_id: insp.inspector_id,
            notification_type: "smart_overdue_inspection",
            title_ar: "⚠ معاينة متأخرة",
            body_ar: `لديك معاينة متأخرة كان موعدها ${insp.inspection_date}. يرجى إكمالها في أقرب وقت.`,
            priority: "critical",
            category: "inspection",
            action_url: "/inspector",
            related_assignment_id: insp.assignment_id,
          });
        }

        // Notify owners
        for (const ownerId of ownerIds) {
          alerts.push({
            user_id: ownerId,
            notification_type: "smart_overdue_inspection",
            title_ar: "⚠ معاينة متأخرة",
            body_ar: `معاينة متأخرة منذ ${insp.inspection_date} تحتاج متابعة.`,
            priority: "high",
            category: "inspection",
            action_url: insp.assignment_id ? `/assignment/${insp.assignment_id}` : undefined,
            related_assignment_id: insp.assignment_id,
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // DEDUPLICATE: Don't send if same alert was sent in last 12h
    // ═══════════════════════════════════════
    const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000).toISOString();
    
    const filteredAlerts: SmartAlert[] = [];
    for (const alert of alerts) {
      // Check for recent duplicate
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", alert.user_id)
        .eq("notification_type", alert.notification_type)
        .eq("related_assignment_id", alert.related_assignment_id || "")
        .gte("created_at", twelveHoursAgo)
        .limit(1);

      if (!existing || existing.length === 0) {
        filteredAlerts.push(alert);
      }
    }

    // ═══════════════════════════════════════
    // INSERT NOTIFICATIONS
    // ═══════════════════════════════════════
    let insertedCount = 0;
    for (const alert of filteredAlerts) {
      const { error } = await supabase.from("notifications").insert({
        user_id: alert.user_id,
        title_ar: alert.title_ar,
        body_ar: alert.body_ar,
        category: alert.category,
        priority: alert.priority,
        notification_type: alert.notification_type,
        channel: "in_app",
        delivery_status: "delivered",
        action_url: alert.action_url || null,
        related_assignment_id: alert.related_assignment_id || null,
      });

      if (!error) insertedCount++;
    }

    console.log(`Smart notifications: scanned ${alerts.length} potential, deduped to ${filteredAlerts.length}, inserted ${insertedCount}`);

    return new Response(JSON.stringify({
      success: true,
      scanned: alerts.length,
      deduplicated: filteredAlerts.length,
      inserted: insertedCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Smart notifications error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
