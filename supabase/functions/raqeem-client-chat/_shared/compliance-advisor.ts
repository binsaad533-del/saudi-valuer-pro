import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ComplianceStatus {
  totalChecks: number;
  passedChecks: number;
  mandatoryTotal: number;
  mandatoryPassed: number;
  issuanceReady: boolean;
  failedMandatory: string[];
  section: string;
}

export async function checkComplianceStatus(
  db: SupabaseClient,
  assignmentId: string | null,
  currentStatus: string | null
): Promise<ComplianceStatus> {
  const result: ComplianceStatus = {
    totalChecks: 0,
    passedChecks: 0,
    mandatoryTotal: 0,
    mandatoryPassed: 0,
    issuanceReady: false,
    failedMandatory: [],
    section: "",
  };

  if (!assignmentId) return result;

  // Load compliance checks
  const { data: checks } = await db
    .from("compliance_checks")
    .select("check_name_ar, category, is_passed, is_mandatory")
    .eq("assignment_id", assignmentId);

  if (!checks?.length) {
    // No checks created yet — provide guidance
    result.section = "\n\n## حالة الامتثال\n";
    result.section += "- لم يتم إنشاء فحوصات الامتثال بعد (يتم إنشاؤها تلقائياً في مراحل متقدمة)\n";
    return result;
  }

  result.totalChecks = checks.length;
  result.passedChecks = checks.filter((c) => c.is_passed).length;
  const mandatory = checks.filter((c) => c.is_mandatory);
  result.mandatoryTotal = mandatory.length;
  result.mandatoryPassed = mandatory.filter((c) => c.is_passed).length;
  result.failedMandatory = mandatory.filter((c) => !c.is_passed).map((c) => c.check_name_ar);
  result.issuanceReady = result.failedMandatory.length === 0;

  result.section = "\n\n## حالة الامتثال والجاهزية\n";
  result.section += `- فحوصات الامتثال: ${result.passedChecks}/${result.totalChecks} مجتازة\n`;
  result.section += `- الإلزامية: ${result.mandatoryPassed}/${result.mandatoryTotal}\n`;

  // Issuance readiness percentage
  const readiness = result.mandatoryTotal > 0
    ? Math.round((result.mandatoryPassed / result.mandatoryTotal) * 100)
    : 0;
  result.section += `- نسبة جاهزية الإصدار: ${readiness}%\n`;

  if (result.failedMandatory.length > 0) {
    result.section += `\n### فحوصات لم تُجتاز بعد:\n`;
    for (const name of result.failedMandatory) {
      result.section += `- ❌ ${name}\n`;
    }
  }

  if (result.issuanceReady) {
    result.section += `\n✅ **جميع الفحوصات الإلزامية مجتازة** — الملف جاهز تنظيمياً.\n`;
  }

  // Status-specific regulatory guidance
  const regulatoryGuidance: Record<string, string> = {
    submitted: "وفقاً لمعايير IVS 2025، يجب تحديد نطاق العمل وأساس القيمة قبل البدء.",
    professional_review: "IVS 105 يلزم بتوثيق الحكم المهني. المقيم المعتمد يراجع مخرجات الذكاء الاصطناعي.",
    draft_report_ready: "المسودة يجب أن تتضمن: الافتراضات، المحددات، المنهجيات، وبيان القيمة.",
    issued: "التقرير ملزم قانونياً. مسجل لدى هيئة تقييم. صالح للاستخدام الرسمي.",
  };

  if (currentStatus && regulatoryGuidance[currentStatus]) {
    result.section += `\n### إرشاد تنظيمي:\n${regulatoryGuidance[currentStatus]}\n`;
  }

  // Client rights and obligations
  result.section += `\n### حقوق العميل:\n`;
  result.section += `- الحق في مراجعة المسودة وإبداء الملاحظات\n`;
  result.section += `- الحق في طلب توضيح المنهجيات المستخدمة\n`;
  result.section += `- الحق في الحصول على نسخة معتمدة من التقرير\n`;
  result.section += `- التقرير محفوظ لمدة 10 سنوات وفقاً للأنظمة\n`;

  return result;
}
