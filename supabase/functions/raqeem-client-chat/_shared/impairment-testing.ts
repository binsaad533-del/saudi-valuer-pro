/**
 * المستوى 35 — محلل اختبار الانخفاض (Impairment Testing)
 * فحص انخفاض القيمة وفقاً لـ IAS 36
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ImpairmentTest {
  assetName: string;
  carryingAmount: number;
  recoverableAmount: number;
  fairValueLessCosts: number;
  valueInUse: number;
  impairmentLoss: number;
  isImpaired: boolean;
  impairmentPercent: number;
}

export interface ImpairmentResult {
  section: string;
  tests: ImpairmentTest[];
  totalCarrying: number;
  totalRecoverable: number;
  totalLoss: number;
  impairedCount: number;
}

export async function analyzeImpairment(
  db: SupabaseClient,
  assignmentId?: string
): Promise<ImpairmentResult> {
  const empty: ImpairmentResult = { section: "", tests: [], totalCarrying: 0, totalRecoverable: 0, totalLoss: 0, impairedCount: 0 };
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
      .select("name, asset_data, condition")
      .in("job_id", jobs.map(j => j.id))
      .limit(200);
    if (!assets?.length) return empty;

    const tests: ImpairmentTest[] = [];
    let totalCarrying = 0, totalRecoverable = 0, totalLoss = 0, impairedCount = 0;

    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      const cost = Number(d.original_cost || d.cost || d.carrying_amount || 0);
      if (cost <= 0) continue;

      const age = getAge(d);
      const usefulLife = Number(d.useful_life || 15);
      const depRate = Math.min(age / usefulLife, 0.9);

      // Carrying amount (book value)
      const carryingAmount = Math.round(cost * (1 - depRate));

      // Fair value less costs to sell
      const marketFactor = getMarketFactor(asset.condition || d.condition);
      const fairValueLessCosts = Math.round(cost * marketFactor * (1 - depRate * 0.7) * 0.95); // 5% selling costs

      // Value in use (DCF of remaining useful life)
      const annualCashFlow = Number(d.annual_revenue || d.noi || cost * 0.08);
      const remainingLife = Math.max(1, usefulLife - age);
      const discountRate = 0.10;
      let valueInUse = 0;
      for (let y = 1; y <= remainingLife; y++) {
        valueInUse += annualCashFlow / Math.pow(1 + discountRate, y);
      }
      valueInUse = Math.round(valueInUse);

      // Recoverable = max(fair value less costs, value in use)
      const recoverableAmount = Math.max(fairValueLessCosts, valueInUse);

      // Impairment test
      const impairmentLoss = Math.max(0, carryingAmount - recoverableAmount);
      const isImpaired = impairmentLoss > 0;
      const impairmentPercent = carryingAmount > 0 ? Math.round((impairmentLoss / carryingAmount) * 100) : 0;

      tests.push({ assetName: asset.name, carryingAmount, recoverableAmount, fairValueLessCosts, valueInUse, impairmentLoss, isImpaired, impairmentPercent });

      totalCarrying += carryingAmount;
      totalRecoverable += recoverableAmount;
      if (isImpaired) { totalLoss += impairmentLoss; impairedCount++; }
    }

    if (tests.length === 0) return empty;

    let section = "\n\n## اختبار انخفاض القيمة (IAS 36)\n";
    section += `- إجمالي القيمة الدفترية: ${totalCarrying.toLocaleString()} ر.س\n`;
    section += `- إجمالي القيمة القابلة للاسترداد: ${totalRecoverable.toLocaleString()} ر.س\n`;
    section += `- إجمالي خسائر الانخفاض: ${totalLoss.toLocaleString()} ر.س ${totalLoss > 0 ? "⚠️" : "✅"}\n`;
    section += `- أصول منخفضة القيمة: ${impairedCount} من ${tests.length}\n`;

    if (impairedCount > 0) {
      section += `\n### أصول تحتاج اعتراف بانخفاض القيمة:\n`;
      section += `| الأصل | الدفترية | القابلة للاسترداد | الخسارة | النسبة |\n|---|---|---|---|---|\n`;
      for (const t of tests.filter(t => t.isImpaired).sort((a, b) => b.impairmentLoss - a.impairmentLoss).slice(0, 10)) {
        section += `| ${t.assetName} | ${t.carryingAmount.toLocaleString()} | ${t.recoverableAmount.toLocaleString()} | ${t.impairmentLoss.toLocaleString()} | ${t.impairmentPercent}% |\n`;
      }
    }

    section += `\n### المرجعية المهنية:\n`;
    section += `• IAS 36.8 — يجب تقييم مؤشرات الانخفاض في كل تاريخ تقرير\n`;
    section += `• IAS 36.18 — القيمة القابلة للاسترداد = الأعلى من (القيمة العادلة ناقص تكاليف البيع) و(القيمة الاستخدامية)\n`;
    section += `• IFRS 3.B63 — الشهرة تخضع لاختبار انخفاض سنوي إلزامي\n`;

    return { section, tests, totalCarrying, totalRecoverable, totalLoss, impairedCount };
  } catch (e) {
    console.error("Impairment analysis error:", e);
    return empty;
  }
}

function getAge(d: Record<string, any>): number {
  const y = Number(d.year_built || d.year || 0);
  return y > 1900 ? new Date().getFullYear() - y : Number(d.age || 5);
}

function getMarketFactor(condition: string | null): number {
  if (!condition) return 0.75;
  const map: Record<string, number> = {
    "ممتاز": 0.95, "جيد جداً": 0.85, "جيد": 0.75, "متوسط": 0.60, "سيء": 0.35,
    "excellent": 0.95, "very_good": 0.85, "good": 0.75, "fair": 0.60, "poor": 0.35,
  };
  return map[condition] || 0.75;
}
