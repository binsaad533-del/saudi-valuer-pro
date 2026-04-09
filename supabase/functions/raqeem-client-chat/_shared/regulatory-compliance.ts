/**
 * المستوى 29 — محرك الامتثال التنظيمي للمعدات
 * فحص تلقائي لامتثال المعدات للوائح السلامة والبيئة وأثرها على القيمة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ComplianceCheck {
  regulation: string;
  regulationAr: string;
  status: "compliant" | "non_compliant" | "unknown" | "expired";
  impact: number; // value impact percentage
  action: string;
}

export interface AssetCompliance {
  assetName: string;
  checks: ComplianceCheck[];
  overallStatus: "compliant" | "partial" | "non_compliant";
  totalValueImpact: number;
}

export interface RegulatoryComplianceResult {
  section: string;
  assets: AssetCompliance[];
  complianceRate: number;
  totalValueAtRisk: number;
}

// Saudi regulatory frameworks
const REGULATIONS = [
  { id: "saso", nameAr: "معايير SASO", description: "الهيئة السعودية للمواصفات والمقاييس" },
  { id: "modon", nameAr: "اشتراطات مدن", description: "هيئة المدن الصناعية" },
  { id: "civil_defense", nameAr: "الدفاع المدني", description: "اشتراطات السلامة والإطفاء" },
  { id: "environmental", nameAr: "البيئة", description: "الامتثال البيئي وانبعاثات الكربون" },
  { id: "labor", nameAr: "السلامة المهنية", description: "اشتراطات وزارة الموارد البشرية" },
  { id: "calibration", nameAr: "المعايرة", description: "شهادات المعايرة والفحص الدوري" },
];

export async function analyzeRegulatoryCompliance(
  db: SupabaseClient,
  assignmentId?: string
): Promise<RegulatoryComplianceResult> {
  const empty: RegulatoryComplianceResult = {
    section: "", assets: [], complianceRate: 0, totalValueAtRisk: 0,
  };

  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || !["machinery_equipment", "mixed"].includes(assignment.valuation_type || "")) {
      return empty;
    }

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, category")
      .in("job_id", jobs.map(j => j.id))
      .limit(100);
    if (!assets?.length) return empty;

    const results: AssetCompliance[] = [];
    let totalCompliant = 0, totalChecks = 0, totalRisk = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const category = asset.category || "عام";
      const checks: ComplianceCheck[] = [];

      // SASO compliance
      const hasSasoCert = !!data.saso_certificate || !!data.certificate;
      checks.push({
        regulation: "SASO", regulationAr: "معايير SASO",
        status: hasSasoCert ? "compliant" : "unknown",
        impact: hasSasoCert ? 0 : -5,
        action: hasSasoCert ? "شهادة سارية" : "يجب التحقق من شهادة المطابقة",
      });

      // Safety (civil defense)
      if (["معدات ثقيلة", "أنظمة كهربائية", "أنظمة ميكانيكية"].includes(category)) {
        const hasSafetyInspection = !!data.safety_inspection || !!data.last_inspection;
        checks.push({
          regulation: "Civil Defense", regulationAr: "الدفاع المدني",
          status: hasSafetyInspection ? "compliant" : "unknown",
          impact: hasSafetyInspection ? 0 : -8,
          action: hasSafetyInspection ? "فحص السلامة ساري" : "يلزم فحص سلامة حديث",
        });
      }

      // Environmental
      if (["معدات ثقيلة", "معدات إنتاج", "أنظمة ميكانيكية"].includes(category)) {
        const hasEnvCert = !!data.environmental_certificate || !!data.emissions;
        checks.push({
          regulation: "Environmental", regulationAr: "الامتثال البيئي",
          status: hasEnvCert ? "compliant" : "unknown",
          impact: hasEnvCert ? 0 : -6,
          action: hasEnvCert ? "متوافق بيئياً" : "يجب التحقق من الامتثال البيئي",
        });
      }

      // Calibration
      if (["معدات طبية", "معدات إنتاج", "أنظمة كهربائية"].includes(category)) {
        const hasCalibration = !!data.calibration_date || !!data.calibration;
        const calExpired = data.calibration_date && new Date(data.calibration_date) < new Date();
        checks.push({
          regulation: "Calibration", regulationAr: "المعايرة الدورية",
          status: calExpired ? "expired" : hasCalibration ? "compliant" : "unknown",
          impact: calExpired ? -10 : hasCalibration ? 0 : -4,
          action: calExpired ? "شهادة المعايرة منتهية" : hasCalibration ? "معايرة سارية" : "يجب فحص شهادة المعايرة",
        });
      }

      // Labor/occupational safety
      checks.push({
        regulation: "OHS", regulationAr: "السلامة المهنية",
        status: "unknown",
        impact: -3,
        action: "يجب التحقق من توافق المعدة مع اشتراطات السلامة المهنية",
      });

      const compliantCount = checks.filter(c => c.status === "compliant").length;
      const overallStatus: AssetCompliance["overallStatus"] =
        compliantCount === checks.length ? "compliant" :
        compliantCount >= checks.length / 2 ? "partial" : "non_compliant";

      const totalImpact = checks.filter(c => c.status !== "compliant").reduce((s, c) => s + c.impact, 0);
      const valueAtRisk = Math.round(cost * Math.abs(totalImpact) / 100);

      totalCompliant += compliantCount;
      totalChecks += checks.length;
      totalRisk += valueAtRisk;

      results.push({ assetName: asset.name, checks, overallStatus, totalValueImpact: totalImpact });
    }

    if (results.length === 0) return empty;

    const complianceRate = totalChecks > 0 ? Math.round((totalCompliant / totalChecks) * 100) : 0;

    let section = "\n\n## فحص الامتثال التنظيمي للمعدات\n";
    section += `- نسبة الامتثال العامة: ${complianceRate}% ${complianceRate > 80 ? "✅" : complianceRate > 50 ? "⚠️" : "🔴"}\n`;
    section += `- القيمة المعرضة للخطر: ${totalRisk.toLocaleString()} ر.س\n`;

    const nonCompliant = results.filter(r => r.overallStatus === "non_compliant");
    const partial = results.filter(r => r.overallStatus === "partial");

    section += `\n| الحالة | العدد |\n|---|---|\n`;
    section += `| ممتثل | ${results.filter(r => r.overallStatus === "compliant").length} |\n`;
    section += `| جزئي | ${partial.length} |\n`;
    section += `| غير ممتثل | ${nonCompliant.length} |\n`;

    if (nonCompliant.length > 0) {
      section += `\n### 🔴 أصول تتطلب اهتماماً:\n`;
      for (const nc of nonCompliant.slice(0, 5)) {
        section += `• ${nc.assetName}: أثر على القيمة ${nc.totalValueImpact}%\n`;
        for (const c of nc.checks.filter(ch => ch.status !== "compliant")) {
          section += `  → ${c.regulationAr}: ${c.action}\n`;
        }
      }
    }

    section += "\n⚖️ عدم الامتثال يؤثر مباشرة على القيمة السوقية ويُضاف كخصم في التقرير النهائي.\n";

    return { section, assets: results, complianceRate, totalValueAtRisk: totalRisk };
  } catch (e) {
    console.error("Regulatory compliance error:", e);
    return empty;
  }
}
