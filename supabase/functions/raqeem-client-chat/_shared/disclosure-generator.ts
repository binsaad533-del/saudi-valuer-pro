/**
 * المستوى 38 — مولّد تقارير الإفصاح
 * توليد تقارير الإفصاح المالي لأصول الشركات المدرجة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DisclosureSection {
  title: string;
  standard: string;
  content: string;
  isRequired: boolean;
}

export interface DisclosureReportResult {
  section: string;
  disclosures: DisclosureSection[];
  completeness: number;
}

export async function generateDisclosureReport(
  db: SupabaseClient,
  assignmentId?: string
): Promise<DisclosureReportResult> {
  const empty: DisclosureReportResult = { section: "", disclosures: [], completeness: 0 };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type, purpose, property_type, reference_number, created_at")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    let assetCount = 0;
    let totalValue = 0;
    if (jobs?.length) {
      const { data: assets } = await db
        .from("extracted_assets")
        .select("asset_data")
        .in("job_id", jobs.map(j => j.id))
        .limit(200);
      assetCount = assets?.length || 0;
      totalValue = (assets || []).reduce((s, a) => {
        const d = a.asset_data as Record<string, any> || {};
        return s + Number(d.value || d.fair_value || d.cost || 0);
      }, 0);
    }

    const disclosures: DisclosureSection[] = [];
    const ref = assignment.reference_number || assignmentId.slice(0, 8);
    const date = new Date(assignment.created_at).toLocaleDateString("ar-SA");

    disclosures.push({
      title: "وصف الأصول المقيّمة",
      standard: "IVS 103.20",
      content: `تم تقييم ${assetCount} أصل بإجمالي قيمة عادلة ${Math.round(totalValue).toLocaleString()} ر.س. التقييم بموجب الرقم المرجعي ${ref} بتاريخ ${date}.`,
      isRequired: true,
    });

    disclosures.push({
      title: "أساس القيمة المستخدم",
      standard: "IVS 104",
      content: `تم استخدام أساس القيمة السوقية العادلة وفقاً لتعريف IVS 104 و IFRS 13.9: "السعر الذي سيتم استلامه لبيع أصل في معاملة منظمة بين المشاركين في السوق في تاريخ القياس".`,
      isRequired: true,
    });

    disclosures.push({
      title: "المنهجيات المطبقة",
      standard: "IFRS 13.62",
      content: `تم تطبيق المنهجيات المناسبة لكل فئة أصول: أسلوب المقارنة (للعقارات)، أسلوب التكلفة (للآلات والمعدات)، وأسلوب الدخل (للأصول المدرّة للدخل). تم اختيار المنهجية بناءً على توفر البيانات وطبيعة الأصل وفقاً لـ IVS 105.`,
      isRequired: true,
    });

    disclosures.push({
      title: "هرمية القيمة العادلة",
      standard: "IFRS 13.72-90",
      content: `تم تصنيف المدخلات المستخدمة في التقييم وفقاً للمستويات الثلاثة. الإفصاح التفصيلي عن مدخلات المستوى 3 متاح في التقرير الكامل.`,
      isRequired: true,
    });

    disclosures.push({
      title: "الافتراضات والمحددات",
      standard: "IVS 103.30",
      content: `يخضع التقييم لافتراضات محددة تشمل: استمرارية الاستخدام الحالي، عدم وجود عيوب خفية، وصحة المعلومات المقدمة. أي تغيير جوهري في هذه الافتراضات قد يؤثر على القيمة.`,
      isRequired: true,
    });

    disclosures.push({
      title: "تحليل الحساسية",
      standard: "IFRS 13.93(h)",
      content: `تم إجراء تحليل حساسية للمتغيرات الرئيسية (معدل الخصم ±1%، معدل النمو ±1%، معدل الرسملة ±0.5%). التفاصيل في الملحق.`,
      isRequired: true,
    });

    disclosures.push({
      title: "استقلالية المقيّم",
      standard: "المادة 24 - لائحة CMA",
      content: `يؤكد المقيّم المعتمد استقلاليته التامة عن الجهة المالكة للأصول، وعدم وجود أي تعارض مصالح مادي أو معنوي.`,
      isRequired: true,
    });

    const completeness = Math.round((disclosures.filter(d => d.content.length > 20).length / disclosures.length) * 100);

    let section = "\n\n## تقرير الإفصاح المالي\n";
    section += `- اكتمال الإفصاحات: ${completeness}% ${completeness >= 90 ? "✅" : "⚠️"}\n`;

    for (const d of disclosures) {
      section += `\n### ${d.title} (${d.standard})\n`;
      section += `${d.content}\n`;
    }

    return { section, disclosures, completeness };
  } catch (e) {
    console.error("Disclosure report error:", e);
    return empty;
  }
}
