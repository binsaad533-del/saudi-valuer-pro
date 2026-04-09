/**
 * المستوى 19 — الاستقلالية الكاملة
 * اتخاذ القرارات، التعافي الذاتي، تنفيذ سير العمل آلياً
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AutonomousAction {
  type: "auto_advance" | "auto_assign" | "auto_alert" | "self_heal" | "auto_decision";
  description: string;
  executed: boolean;
  result: string | null;
}

export interface AutonomyResult {
  section: string;
  actions: AutonomousAction[];
  decisionsAvailable: string[];
  selfHealAttempts: number;
}

export async function executeAutonomousLogic(
  db: SupabaseClient,
  assignmentId?: string,
  status?: string,
  requestId?: string,
  organizationId?: string
): Promise<AutonomyResult> {
  const empty: AutonomyResult = {
    section: "",
    actions: [],
    decisionsAvailable: [],
    selfHealAttempts: 0,
  };

  if (!assignmentId || !status) return empty;

  try {
    const actions: AutonomousAction[] = [];
    const decisionsAvailable: string[] = [];
    let selfHealAttempts = 0;

    // ── 1. Auto-advance detection ──
    // Check if all requirements are met to suggest auto-advance
    if (status === "data_collection_open" && requestId) {
      const { data: docs } = await db
        .from("request_documents")
        .select("id")
        .eq("request_id", requestId);

      if (docs && docs.length >= 3) {
        decisionsAvailable.push(
          "جميع المستندات المطلوبة مرفوعة — يمكن إغلاق مرحلة جمع البيانات تلقائياً"
        );
        actions.push({
          type: "auto_advance",
          description: "إغلاق جمع البيانات والانتقال لمرحلة التحقق",
          executed: false,
          result: null,
        });
      }
    }

    // ── 2. Auto-assign inspector ──
    if (status === "data_collection_complete") {
      // Check if inspector not yet assigned
      const { data: assignment } = await db
        .from("valuation_assignments")
        .select("inspector_id, valuation_mode")
        .eq("id", assignmentId)
        .maybeSingle();

      if (assignment && !assignment.inspector_id && assignment.valuation_mode === "field") {
        // Find available inspector
        const { data: inspectors } = await db
          .from("profiles")
          .select("user_id, full_name_ar")
          .eq("role", "inspector")
          .limit(5);

        if (inspectors && inspectors.length > 0) {
          decisionsAvailable.push(
            `يمكن تعيين معاين آلياً — ${inspectors.length} معاين متاح`
          );
          actions.push({
            type: "auto_assign",
            description: `تعيين معاين ميداني من ${inspectors.length} متاحين`,
            executed: false,
            result: null,
          });
        }
      }

      // Desktop valuation — skip inspection
      if (assignment && assignment.valuation_mode !== "field") {
        decisionsAvailable.push(
          "تقييم مكتبي — يمكن تجاوز مرحلة المعاينة والانتقال مباشرة للتحقق"
        );
      }
    }

    // ── 3. Self-healing: detect and fix workflow inconsistencies ──
    if (requestId) {
      // Check for orphaned requests (no assignment linked)
      const { data: request } = await db
        .from("valuation_requests")
        .select("id, assignment_id, status")
        .eq("id", requestId)
        .maybeSingle();

      if (request && !request.assignment_id) {
        selfHealAttempts++;
        actions.push({
          type: "self_heal",
          description: "طلب بدون ملف تقييم مرتبط — يحتاج ربط يدوي",
          executed: false,
          result: "يتطلب تدخل إداري",
        });
      }
    }

    // ── 4. Auto-alert for overdue stages ──
    if (assignmentId) {
      const { data: assignment } = await db
        .from("valuation_assignments")
        .select("updated_at, status")
        .eq("id", assignmentId)
        .maybeSingle();

      if (assignment?.updated_at) {
        const daysSince = Math.ceil(
          (Date.now() - new Date(assignment.updated_at).getTime()) / 86400000
        );

        // Stage-specific thresholds
        const thresholds: Record<string, number> = {
          inspection_pending: 3,
          professional_review: 5,
          data_collection_open: 7,
          client_review: 5,
        };

        const threshold = thresholds[status] || 7;
        if (daysSince > threshold) {
          actions.push({
            type: "auto_alert",
            description: `المرحلة "${status}" متأخرة ${daysSince} يوم (الحد: ${threshold} أيام)`,
            executed: false,
            result: null,
          });
        }
      }
    }

    // ── 5. Auto-decision for simple cases ──
    if (status === "submitted" && organizationId) {
      // Check for repeat client with clean history
      const { data: clientAssignments } = await db
        .from("valuation_assignments")
        .select("id, status")
        .eq("organization_id", organizationId)
        .in("status", ["issued", "archived"])
        .limit(3);

      if (clientAssignments && clientAssignments.length >= 2) {
        decisionsAvailable.push(
          "عميل متكرر بسجل نظيف — يمكن تسريع قبول الطلب تلقائياً"
        );
        actions.push({
          type: "auto_decision",
          description: "تسريع معالجة الطلب لعميل متكرر",
          executed: false,
          result: null,
        });
      }
    }

    // Build section
    if (actions.length === 0 && decisionsAvailable.length === 0) return empty;

    let section = "\n\n## محرك الاستقلالية الذكي\n";

    if (decisionsAvailable.length > 0) {
      section += "\n### قرارات متاحة للتنفيذ التلقائي:\n";
      for (const d of decisionsAvailable) {
        section += `🤖 ${d}\n`;
      }
    }

    if (actions.length > 0) {
      section += "\n### إجراءات مقترحة:\n";
      for (const a of actions) {
        const icon =
          a.type === "auto_advance" ? "⚡" :
          a.type === "auto_assign" ? "👤" :
          a.type === "auto_alert" ? "🔔" :
          a.type === "self_heal" ? "🔧" : "🤖";
        section += `${icon} ${a.description}${a.result ? ` — ${a.result}` : ""}\n`;
      }
    }

    if (selfHealAttempts > 0) {
      section += `\n🔧 محاولات تعافي ذاتي: ${selfHealAttempts}\n`;
    }

    section += "\nيمكنك إخبار العميل بالإجراءات المتاحة أو تنفيذها آلياً عند الطلب.\n";

    return { section, actions, decisionsAvailable, selfHealAttempts };
  } catch (e) {
    console.error("Autonomous engine error:", e);
    return empty;
  }
}
