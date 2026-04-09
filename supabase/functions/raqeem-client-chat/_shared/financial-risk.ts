/**
 * المستوى 40 — محلل المخاطر المالية
 * تحليل مخاطر السوق والائتمان والسيولة وأثرها على التقييم
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RiskCategory {
  name: string;
  nameAr: string;
  score: number; // 0-100
  level: "low" | "medium" | "high" | "critical";
  factors: string[];
  mitigation: string;
  valueImpact: number; // % adjustment
}

export interface FinancialRiskResult {
  section: string;
  risks: RiskCategory[];
  overallRiskScore: number;
  overallLevel: string;
  totalValueAdjustment: number;
}

export async function analyzeFinancialRisk(
  db: SupabaseClient,
  assignmentId?: string
): Promise<FinancialRiskResult> {
  const empty: FinancialRiskResult = { section: "", risks: [], overallRiskScore: 0, overallLevel: "medium", totalValueAdjustment: 0 };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type, property_type, purpose, valuation_mode")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    let assetCount = 0, totalValue = 0, avgAge = 0;
    if (jobs?.length) {
      const { data: assets } = await db
        .from("extracted_assets")
        .select("asset_data, condition")
        .in("job_id", jobs.map(j => j.id))
        .limit(200);

      assetCount = assets?.length || 0;
      let ageSum = 0;
      for (const a of assets || []) {
        const d = a.asset_data as Record<string, any> || {};
        totalValue += Number(d.value || d.cost || 0);
        const y = Number(d.year_built || d.year || 0);
        if (y > 1900) ageSum += new Date().getFullYear() - y;
      }
      avgAge = assetCount > 0 ? ageSum / assetCount : 5;
    }

    const risks: RiskCategory[] = [];

    // 1. Market Risk
    const marketScore = assignment.property_type === "commercial" ? 45 :
      assignment.property_type === "industrial" ? 55 : 35;
    risks.push({
      name: "market", nameAr: "مخاطر السوق",
      score: marketScore,
      level: marketScore > 60 ? "high" : marketScore > 40 ? "medium" : "low",
      factors: [
        "تقلبات الأسعار في السوق المحلي",
        "تغيرات أسعار الفائدة",
        assignment.valuation_type === "machinery_equipment" ? "تقلب أسعار المعدات المستعملة" : "تغيرات العرض والطلب العقاري",
      ],
      mitigation: "تنويع المحفظة وعقود إيجار طويلة الأجل",
      valueImpact: marketScore > 60 ? -8 : marketScore > 40 ? -4 : -1,
    });

    // 2. Credit Risk
    const creditScore = totalValue > 50000000 ? 30 : totalValue > 10000000 ? 45 : 55;
    risks.push({
      name: "credit", nameAr: "مخاطر الائتمان",
      score: creditScore,
      level: creditScore > 60 ? "high" : creditScore > 40 ? "medium" : "low",
      factors: [
        "جودة المستأجرين/العملاء",
        "تركز الإيرادات على عدد محدود من المصادر",
        "معدلات التحصيل التاريخية",
      ],
      mitigation: "تنويع قاعدة المستأجرين وضمانات بنكية",
      valueImpact: creditScore > 60 ? -6 : creditScore > 40 ? -3 : -1,
    });

    // 3. Liquidity Risk
    const liquidityScore = assignment.valuation_type === "machinery_equipment" ? 60 :
      assignment.property_type === "residential" ? 25 : 45;
    risks.push({
      name: "liquidity", nameAr: "مخاطر السيولة",
      score: liquidityScore,
      level: liquidityScore > 60 ? "high" : liquidityScore > 40 ? "medium" : "low",
      factors: [
        "مدة البيع المتوقعة في السوق الحالي",
        "عدد المشترين المحتملين",
        assignment.valuation_type === "machinery_equipment" ? "محدودية سوق المعدات المتخصصة" : "حجم الأصل وتخصصه",
      ],
      mitigation: "تسعير تنافسي وتسويق نشط في المنصات المتخصصة",
      valueImpact: liquidityScore > 60 ? -7 : liquidityScore > 40 ? -3 : -1,
    });

    // 4. Operational Risk
    const opScore = avgAge > 15 ? 65 : avgAge > 8 ? 45 : 25;
    risks.push({
      name: "operational", nameAr: "المخاطر التشغيلية",
      score: opScore,
      level: opScore > 60 ? "high" : opScore > 40 ? "medium" : "low",
      factors: [
        `متوسط عمر الأصول: ${Math.round(avgAge)} سنة`,
        "تكاليف الصيانة والتشغيل",
        "مخاطر التقادم التقني",
      ],
      mitigation: "برنامج صيانة وقائية وتحديث دوري للأصول",
      valueImpact: opScore > 60 ? -5 : opScore > 40 ? -2 : 0,
    });

    // 5. Regulatory Risk
    const regScore = 35;
    risks.push({
      name: "regulatory", nameAr: "المخاطر التنظيمية",
      score: regScore,
      level: "low",
      factors: [
        "تغيرات في الأنظمة واللوائح",
        "متطلبات التراخيص والتصاريح",
        "الالتزام البيئي",
      ],
      mitigation: "متابعة التحديثات التنظيمية والامتثال المبكر",
      valueImpact: -1,
    });

    const overallScore = Math.round(risks.reduce((s, r) => s + r.score, 0) / risks.length);
    const overallLevel = overallScore > 60 ? "مرتفع" : overallScore > 40 ? "متوسط" : "منخفض";
    const totalAdj = risks.reduce((s, r) => s + r.valueImpact, 0);

    let section = "\n\n## تحليل المخاطر المالية\n";
    section += `- مؤشر المخاطر العام: ${overallScore}/100 — ${overallLevel} ${overallScore > 60 ? "🔴" : overallScore > 40 ? "⚠️" : "✅"}\n`;
    section += `- إجمالي تعديل القيمة: ${totalAdj}%\n`;

    section += `\n| المخاطر | الدرجة | المستوى | أثر القيمة |\n|---|---|---|---|\n`;
    const levelLabels = { low: "منخفض ✅", medium: "متوسط ⚠️", high: "مرتفع 🔴", critical: "حرج 🔴" };
    for (const r of risks) {
      section += `| ${r.nameAr} | ${r.score} | ${levelLabels[r.level]} | ${r.valueImpact}% |\n`;
    }

    for (const r of risks.filter(r => r.level === "high" || r.level === "critical")) {
      section += `\n### ${r.nameAr}:\n`;
      for (const f of r.factors) section += `• ${f}\n`;
      section += `💡 التخفيف: ${r.mitigation}\n`;
    }

    return { section, risks, overallRiskScore: overallScore, overallLevel, totalValueAdjustment: totalAdj };
  } catch (e) {
    console.error("Financial risk error:", e);
    return empty;
  }
}
