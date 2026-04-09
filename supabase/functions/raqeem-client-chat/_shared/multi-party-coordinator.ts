/**
 * المستوى 18 — التنسيق متعدد الأطراف
 * إدارة محادثات متوازية وتصعيد ذكي وملخصات موحدة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PartyStatus {
  role: string;
  name: string;
  lastAction: string | null;
  pendingAction: string | null;
}

export interface CoordinationResult {
  section: string;
  parties: PartyStatus[];
  escalationNeeded: boolean;
  escalationReason: string | null;
  unifiedSummary: string;
}

export async function analyzeMultiPartyStatus(
  db: SupabaseClient,
  assignmentId?: string,
  status?: string
): Promise<CoordinationResult> {
  const empty: CoordinationResult = {
    section: "",
    parties: [],
    escalationNeeded: false,
    escalationReason: null,
    unifiedSummary: "",
  };

  if (!assignmentId) return empty;

  try {
    // Load assignment with related data
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("id, status, inspector_id, assigned_valuer_id, client_id, created_at, updated_at")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment) return empty;

    const parties: PartyStatus[] = [];

    // 1. Client status
    if (assignment.client_id) {
      const { data: clientMsgs } = await db
        .from("request_messages")
        .select("created_at, sender_type, content")
        .eq("sender_type", "client")
        .order("created_at", { ascending: false })
        .limit(1);

      const lastClientAction = clientMsgs?.[0]
        ? `آخر رسالة: ${new Date(clientMsgs[0].created_at).toLocaleDateString("ar-SA")}`
        : null;

      const clientPending = getClientPendingAction(status || "");
      parties.push({
        role: "العميل",
        name: "العميل",
        lastAction: lastClientAction,
        pendingAction: clientPending,
      });
    }

    // 2. Inspector status
    if (assignment.inspector_id) {
      const { data: inspection } = await db
        .from("inspections")
        .select("status, inspection_date, completed")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: false })
        .maybeSingle();

      parties.push({
        role: "المعاين",
        name: "المعاين الميداني",
        lastAction: inspection
          ? `معاينة ${inspection.completed ? "مكتملة" : "جارية"} — ${inspection.inspection_date}`
          : null,
        pendingAction: status === "inspection_pending" ? "تنفيذ المعاينة الميدانية" : null,
      });
    }

    // 3. Valuer status
    parties.push({
      role: "المقيّم المعتمد",
      name: "المقيّم المعتمد",
      lastAction: null,
      pendingAction: getValuerPendingAction(status || ""),
    });

    // Escalation detection
    let escalationNeeded = false;
    let escalationReason: string | null = null;

    // Check for stale assignment (>5 days without progress)
    if (assignment.updated_at) {
      const daysSinceUpdate = Math.ceil(
        (Date.now() - new Date(assignment.updated_at).getTime()) / 86400000
      );
      if (daysSinceUpdate > 5 && !["issued", "archived", "cancelled"].includes(status || "")) {
        escalationNeeded = true;
        escalationReason = `الطلب متوقف منذ ${daysSinceUpdate} أيام — يحتاج تدخل المقيّم المعتمد`;
      }
    }

    // Check for professional review needed
    if (status === "analysis_complete") {
      escalationNeeded = true;
      escalationReason = "التحليل مكتمل — يحتاج مراجعة وحكم مهني من المقيّم المعتمد (IVS 105)";
    }

    // Build unified summary
    let unifiedSummary = "";
    const pendingParties = parties.filter((p) => p.pendingAction);
    if (pendingParties.length > 0) {
      unifiedSummary = `المطلوب حالياً من: ${pendingParties.map((p) => `${p.role} (${p.pendingAction})`).join(" | ")}`;
    }

    // Build section
    let section = "\n\n## التنسيق بين الأطراف\n";
    for (const p of parties) {
      section += `\n### ${p.role}:\n`;
      if (p.lastAction) section += `- آخر نشاط: ${p.lastAction}\n`;
      if (p.pendingAction) section += `- 🔔 مطلوب: ${p.pendingAction}\n`;
      else section += `- ✅ لا إجراء مطلوب حالياً\n`;
    }

    if (escalationNeeded && escalationReason) {
      section += `\n### ⚡ تصعيد مطلوب:\n${escalationReason}\n`;
    }

    if (unifiedSummary) {
      section += `\n### الملخص الموحد:\n${unifiedSummary}\n`;
    }

    section += "\nاستخدم هذا السياق لإخبار العميل بمن يعمل على طلبه حالياً ومتى يتوقع الرد.\n";

    return { section, parties, escalationNeeded, escalationReason, unifiedSummary };
  } catch (e) {
    console.error("Multi-party coordinator error:", e);
    return empty;
  }
}

function getClientPendingAction(status: string): string | null {
  const map: Record<string, string> = {
    scope_generated: "مراجعة نطاق العمل والموافقة",
    scope_approved: "سداد الدفعة الأولى (50%)",
    data_collection_open: "رفع المستندات المطلوبة",
    client_review: "مراجعة مسودة التقرير وإبداء الملاحظات",
    draft_approved: "سداد الدفعة النهائية (50%)",
  };
  return map[status] || null;
}

function getValuerPendingAction(status: string): string | null {
  const map: Record<string, string> = {
    analysis_complete: "المراجعة المهنية والحكم المهني (IVS 105)",
    professional_review: "إعداد مسودة التقرير",
    final_payment_confirmed: "إصدار التقرير النهائي",
  };
  return map[status] || null;
}
