import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface WorkflowSuggestion {
  canAdvance: boolean;
  nextStatus: string | null;
  blockers: string[];
  section: string;
}

export async function analyzeWorkflowReadiness(
  db: SupabaseClient,
  assignmentId: string | null,
  currentStatus: string | null,
  requestId: string | null
): Promise<WorkflowSuggestion> {
  const result: WorkflowSuggestion = {
    canAdvance: false,
    nextStatus: null,
    blockers: [],
    section: "",
  };

  if (!assignmentId || !currentStatus) return result;

  // Define what each status needs to advance
  const requirements: Record<string, { next: string; checks: () => Promise<string[]> }> = {
    data_collection_open: {
      next: "data_collection_complete",
      checks: async () => {
        const blockers: string[] = [];
        if (requestId) {
          const { count } = await db
            .from("request_documents")
            .select("id", { count: "exact", head: true })
            .eq("request_id", requestId);
          if (!count || count < 2) blockers.push("عدد المستندات المرفوعة غير كافٍ (أقل من 2)");
        }
        return blockers;
      },
    },
    inspection_completed: {
      next: "data_validated",
      checks: async () => {
        const blockers: string[] = [];
        const { data: inspection } = await db
          .from("inspections")
          .select("status, checklist_data")
          .eq("assignment_id", assignmentId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!inspection?.length) blockers.push("لا توجد بيانات معاينة مسجلة");
        return blockers;
      },
    },
    analysis_complete: {
      next: "professional_review",
      checks: async () => {
        const blockers: string[] = [];
        const { data: comps } = await db
          .from("assignment_comparables")
          .select("id")
          .eq("assignment_id", assignmentId);
        if (!comps?.length) blockers.push("لم يتم اختيار مقارنات سوقية بعد");
        
        const { data: checks } = await db
          .from("compliance_checks")
          .select("is_passed")
          .eq("assignment_id", assignmentId)
          .eq("is_mandatory", true)
          .eq("is_passed", false);
        if (checks?.length) blockers.push(`${checks.length} فحص امتثال إلزامي لم يُجتاز بعد`);
        return blockers;
      },
    },
    draft_report_ready: {
      next: "client_review",
      checks: async () => {
        const blockers: string[] = [];
        const { data: reports } = await db
          .from("reports")
          .select("id, is_draft")
          .eq("assignment_id", assignmentId)
          .eq("is_draft", true);
        if (!reports?.length) blockers.push("لم يتم إنشاء مسودة التقرير بعد");
        return blockers;
      },
    },
  };

  const req = requirements[currentStatus];
  if (req) {
    const blockers = await req.checks();
    result.nextStatus = req.next;
    result.blockers = blockers;
    result.canAdvance = blockers.length === 0;

    result.section = "\n\n## تحليل جاهزية الانتقال\n";
    result.section += `- الحالة الحالية: ${currentStatus}\n`;
    result.section += `- الحالة التالية: ${req.next}\n`;
    if (blockers.length === 0) {
      result.section += `- ✅ **جاهز للانتقال** — جميع المتطلبات مستوفاة\n`;
      result.section += `\nأخبر العميل أن الطلب جاهز للمرحلة التالية.\n`;
    } else {
      result.section += `- ❌ **غير جاهز** — المعوقات:\n`;
      for (const b of blockers) {
        result.section += `  • ${b}\n`;
      }
      result.section += `\nوضّح للعميل ما ينقص بأسلوب بسيط واطلب منه المساعدة إن كان بإمكانه.\n`;
    }
  }

  // ── Quality check for draft stage ──
  if (currentStatus === "professional_review" || currentStatus === "draft_report_ready") {
    const { data: compChecks } = await db
      .from("compliance_checks")
      .select("check_name_ar, is_passed, is_mandatory")
      .eq("assignment_id", assignmentId);

    if (compChecks?.length) {
      const passed = compChecks.filter((c) => c.is_passed).length;
      const total = compChecks.length;
      const mandatory = compChecks.filter((c) => c.is_mandatory);
      const mandatoryPassed = mandatory.filter((c) => c.is_passed).length;

      result.section += `\n### مراقبة الجودة\n`;
      result.section += `- فحوصات الامتثال: ${passed}/${total} مجتازة\n`;
      result.section += `- الإلزامية: ${mandatoryPassed}/${mandatory.length}\n`;
      if (mandatoryPassed < mandatory.length) {
        const failed = mandatory.filter((c) => !c.is_passed);
        result.section += `- ❌ فحوصات إلزامية لم تُجتاز:\n`;
        for (const f of failed) {
          result.section += `  • ${f.check_name_ar}\n`;
        }
      }
    }
  }

  return result;
}

// ── Inspector assignment suggestion ──
export async function suggestInspector(
  db: SupabaseClient,
  assignmentId: string | null,
  city: string | null
): Promise<string> {
  if (!assignmentId || !city) return "";

  const { data: inspectors } = await db
    .from("profiles")
    .select("user_id, full_name_ar")
    .eq("role", "inspector")
    .eq("is_active", true)
    .limit(10);

  if (!inspectors?.length) return "";

  // Check coverage areas
  const { data: coverage } = await db
    .from("inspector_coverage")
    .select("inspector_id, city_ar")
    .eq("city_ar", city);

  if (coverage?.length) {
    const coveredInspectors = inspectors.filter((i) =>
      coverage.some((c) => c.inspector_id === i.user_id)
    );
    if (coveredInspectors.length > 0) {
      return `\n### اقتراح المعاين\nالمعاينون المتاحون في ${city}: ${coveredInspectors.map((i) => i.full_name_ar).join("، ")}\n`;
    }
  }

  return "";
}
