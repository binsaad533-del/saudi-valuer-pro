/**
 * المستوى 33 — محلل التدفقات النقدية المخصومة (DCF)
 * نموذج DCF مع تحليل الحساسية ومعدلات الخصم المتعددة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DCFProjection {
  year: number;
  noi: number;
  discountedNOI: number;
  cumulativePV: number;
}

export interface SensitivityCell {
  discountRate: number;
  growthRate: number;
  value: number;
}

export interface DCFAnalysisResult {
  section: string;
  projections: DCFProjection[];
  terminalValue: number;
  totalPV: number;
  impliedCapRate: number;
  sensitivity: SensitivityCell[];
  assumptions: string[];
}

export async function analyzeDCF(
  db: SupabaseClient,
  assignmentId?: string
): Promise<DCFAnalysisResult> {
  const empty: DCFAnalysisResult = {
    section: "", projections: [], terminalValue: 0, totalPV: 0,
    impliedCapRate: 0, sensitivity: [], assumptions: [],
  };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data")
      .in("job_id", jobs.map(j => j.id))
      .limit(200);
    if (!assets?.length) return empty;

    // Aggregate NOI from all assets
    let baseNOI = 0;
    let totalValue = 0;
    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      baseNOI += Number(d.noi || d.annual_rental || d.net_income || 0);
      totalValue += Number(d.value || d.market_value || d.cost || 0);
    }

    if (baseNOI <= 0 && totalValue > 0) baseNOI = totalValue * 0.07; // assume 7% yield
    if (baseNOI <= 0) return empty;

    // DCF Parameters
    const projectionYears = 10;
    const discountRate = 0.10; // 10% WACC
    const growthRate = 0.03; // 3% annual growth
    const terminalCapRate = 0.08; // 8% exit cap rate
    const vacancyLoss = 0.05; // 5% vacancy

    const effectiveNOI = baseNOI * (1 - vacancyLoss);

    // Project cash flows
    const projections: DCFProjection[] = [];
    let cumulativePV = 0;

    for (let y = 1; y <= projectionYears; y++) {
      const noi = effectiveNOI * Math.pow(1 + growthRate, y);
      const discountFactor = Math.pow(1 + discountRate, y);
      const discountedNOI = noi / discountFactor;
      cumulativePV += discountedNOI;
      projections.push({
        year: y,
        noi: Math.round(noi),
        discountedNOI: Math.round(discountedNOI),
        cumulativePV: Math.round(cumulativePV),
      });
    }

    // Terminal value
    const terminalNOI = effectiveNOI * Math.pow(1 + growthRate, projectionYears + 1);
    const terminalValue = terminalNOI / terminalCapRate;
    const discountedTerminal = terminalValue / Math.pow(1 + discountRate, projectionYears);
    const totalPV = Math.round(cumulativePV + discountedTerminal);
    const impliedCapRate = totalPV > 0 ? Math.round((effectiveNOI / totalPV) * 10000) / 100 : 0;

    // Sensitivity analysis
    const discountRates = [0.08, 0.09, 0.10, 0.11, 0.12];
    const growthRates = [0.01, 0.02, 0.03, 0.04, 0.05];
    const sensitivity: SensitivityCell[] = [];

    for (const dr of discountRates) {
      for (const gr of growthRates) {
        let pv = 0;
        for (let y = 1; y <= projectionYears; y++) {
          pv += (effectiveNOI * Math.pow(1 + gr, y)) / Math.pow(1 + dr, y);
        }
        const tv = (effectiveNOI * Math.pow(1 + gr, projectionYears + 1)) / terminalCapRate;
        pv += tv / Math.pow(1 + dr, projectionYears);
        sensitivity.push({ discountRate: dr * 100, growthRate: gr * 100, value: Math.round(pv) });
      }
    }

    const assumptions = [
      `معدل الخصم (WACC): ${(discountRate * 100)}%`,
      `معدل النمو السنوي: ${(growthRate * 100)}%`,
      `معدل الرسملة النهائي: ${(terminalCapRate * 100)}%`,
      `خسارة الشواغر: ${(vacancyLoss * 100)}%`,
      `فترة الإسقاط: ${projectionYears} سنوات`,
    ];

    // Build section
    let section = "\n\n## تحليل التدفقات النقدية المخصومة (DCF)\n";
    section += `\n### الافتراضات:\n`;
    for (const a of assumptions) section += `• ${a}\n`;

    section += `\n### النتائج:\n`;
    section += `| المؤشر | القيمة |\n|---|---|\n`;
    section += `| صافي الدخل التشغيلي (السنة 1) | ${Math.round(effectiveNOI * (1 + growthRate)).toLocaleString()} ر.س |\n`;
    section += `| القيمة الحالية للتدفقات | ${Math.round(cumulativePV).toLocaleString()} ر.س |\n`;
    section += `| القيمة النهائية | ${Math.round(terminalValue).toLocaleString()} ر.س |\n`;
    section += `| القيمة النهائية المخصومة | ${Math.round(discountedTerminal).toLocaleString()} ر.س |\n`;
    section += `| **القيمة الإجمالية (DCF)** | **${totalPV.toLocaleString()} ر.س** |\n`;
    section += `| معدل الرسملة الضمني | ${impliedCapRate}% |\n`;

    // Sensitivity table
    section += `\n### تحليل الحساسية (القيمة بملايين ر.س):\n`;
    section += `| خصم ↓ / نمو → |`;
    for (const gr of growthRates) section += ` ${gr * 100}% |`;
    section += `\n|---|${growthRates.map(() => "---").join("|")}|\n`;

    for (const dr of discountRates) {
      section += `| ${dr * 100}% |`;
      for (const gr of growthRates) {
        const cell = sensitivity.find(s => s.discountRate === dr * 100 && s.growthRate === gr * 100);
        section += ` ${cell ? (cell.value / 1000000).toFixed(1) : "-"} |`;
      }
      section += "\n";
    }

    section += "\n⚠️ النموذج أولي ويجب مراجعته من المقيم المعتمد مع تعديل الافتراضات حسب خصائص الأصل.\n";

    return { section, projections, terminalValue: Math.round(terminalValue), totalPV, impliedCapRate, sensitivity, assumptions };
  } catch (e) {
    console.error("DCF analysis error:", e);
    return empty;
  }
}
