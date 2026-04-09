/**
 * Level 51: AI Peer Review Engine
 * Raqeem reviews its own reports as an independent "second valuer"
 */

interface ReviewFinding {
  category: "contradiction" | "gap" | "methodology" | "compliance" | "data_quality";
  severity: "critical" | "warning" | "info";
  description: string;
  recommendation: string;
  ivs_reference?: string;
}

interface PeerReviewResult {
  section: string;
  findings: ReviewFinding[];
  overallScore: number;
  issuanceReady: boolean;
  reviewSummary: string;
}

export async function analyzeAIPeerReview(
  db: any,
  assignmentId: string | undefined
): Promise<PeerReviewResult> {
  const empty: PeerReviewResult = { section: "", findings: [], overallScore: 0, issuanceReady: false, reviewSummary: "" };
  if (!assignmentId) return empty;

  try {
    const [{ data: assignment }, { data: comparables }, { data: subjects }, { data: assumptions }, { data: compliance }] = await Promise.all([
      db.from("valuation_assignments").select("*").eq("id", assignmentId).single(),
      db.from("assignment_comparables").select("*, comparables(*)").eq("assignment_id", assignmentId),
      db.from("subjects").select("*").eq("assignment_id", assignmentId),
      db.from("assumptions").select("*").eq("assignment_id", assignmentId),
      db.from("compliance_checks").select("*").eq("assignment_id", assignmentId),
    ]);

    if (!assignment) return empty;

    const findings: ReviewFinding[] = [];

    // 1. Check comparable adequacy
    const compCount = comparables?.length || 0;
    if (compCount < 3) {
      findings.push({
        category: "methodology",
        severity: compCount === 0 ? "critical" : "warning",
        description: `عدد المقارنات غير كافٍ (${compCount} من 3 مطلوب كحد أدنى)`,
        recommendation: "إضافة مقارنات إضافية لتعزيز المصداقية",
        ivs_reference: "IVS 105.20",
      });
    }

    // 2. Check value consistency among comparables
    if (comparables?.length >= 2) {
      const prices = comparables
        .map((c: any) => c.comparables?.price_per_sqm)
        .filter((p: any) => p != null);
      if (prices.length >= 2) {
        const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;
        const maxDeviation = Math.max(...prices.map((p: number) => Math.abs(p - avg) / avg));
        if (maxDeviation > 0.3) {
          findings.push({
            category: "data_quality",
            severity: "warning",
            description: `تباين كبير في أسعار المقارنات (${(maxDeviation * 100).toFixed(0)}% انحراف)`,
            recommendation: "مراجعة التسويات وتبرير الفروقات",
            ivs_reference: "IVS 105.40",
          });
        }
      }
    }

    // 3. Check assumptions completeness
    if (!assumptions?.length) {
      findings.push({
        category: "gap",
        severity: "critical",
        description: "لم يتم تسجيل أي افتراضات أو افتراضات خاصة",
        recommendation: "توثيق الافتراضات إلزامي حسب IVS 104",
        ivs_reference: "IVS 104.10",
      });
    }

    // 4. Check subject data completeness
    const subject = subjects?.[0];
    if (subject) {
      const missingFields: string[] = [];
      if (!subject.land_area) missingFields.push("مساحة الأرض");
      if (!subject.building_area) missingFields.push("مساحة البناء");
      if (!subject.year_built) missingFields.push("سنة البناء");
      if (!subject.latitude || !subject.longitude) missingFields.push("الإحداثيات");
      if (missingFields.length > 0) {
        findings.push({
          category: "gap",
          severity: missingFields.length > 2 ? "critical" : "warning",
          description: `بيانات ناقصة في وصف العقار: ${missingFields.join("، ")}`,
          recommendation: "استكمال البيانات لضمان دقة التقييم",
        });
      }
    }

    // 5. Check compliance status
    const failedMandatory = (compliance || []).filter((c: any) => c.is_mandatory && !c.is_passed);
    if (failedMandatory.length > 0) {
      findings.push({
        category: "compliance",
        severity: "critical",
        description: `${failedMandatory.length} فحص امتثال إلزامي لم يتم اجتيازه`,
        recommendation: "معالجة جميع فحوصات الامتثال الإلزامية قبل الإصدار",
      });
    }

    // 6. Check for final value
    if (!assignment.final_value_sar && ["professional_review", "draft_report_ready", "client_review"].includes(assignment.status)) {
      findings.push({
        category: "gap",
        severity: "critical",
        description: "لم يتم تحديد القيمة النهائية",
        recommendation: "تحديد القيمة النهائية المعتمدة بالريال السعودي",
        ivs_reference: "IVS 105.50",
      });
    }

    // Calculate score
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const warningCount = findings.filter((f) => f.severity === "warning").length;
    const overallScore = Math.max(0, 100 - criticalCount * 25 - warningCount * 10);
    const issuanceReady = criticalCount === 0;

    const reviewSummary = criticalCount === 0 && warningCount === 0
      ? "التقرير يجتاز المراجعة بنجاح ✅"
      : criticalCount === 0
      ? `التقرير مقبول مع ${warningCount} ملاحظة تحسينية`
      : `التقرير يحتاج معالجة ${criticalCount} ملاحظة جوهرية قبل الإصدار`;

    let section = "\n\n## مراجعة الأقران الذكية (المستوى 51)\n";
    section += `- النتيجة: ${overallScore}/100 | ${reviewSummary}\n`;
    section += `- جاهزية الإصدار: ${issuanceReady ? "✅ جاهز" : "❌ غير جاهز"}\n`;
    for (const f of findings.slice(0, 5)) {
      const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
      section += `${icon} ${f.description}${f.ivs_reference ? ` (${f.ivs_reference})` : ""}\n`;
    }

    return { section, findings, overallScore, issuanceReady, reviewSummary };
  } catch (e) {
    console.error("AI Peer Review error:", e);
    return empty;
  }
}
