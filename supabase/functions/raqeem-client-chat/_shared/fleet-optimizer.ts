/**
 * المستوى 28 — محسّن الأساطيل والمحافظ
 * تقييم الأساطيل كمحافظ استثمارية — تحليل العائد وتوصيات البيع/الاستبدال/الإيجار
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AssetROI {
  assetName: string;
  currentValue: number;
  annualRevenue: number;
  annualCost: number;
  roi: number;
  recommendation: "keep" | "sell" | "replace" | "lease_out";
  reasonAr: string;
}

export interface FleetOptimizerResult {
  section: string;
  assets: AssetROI[];
  portfolioROI: number;
  sellCandidates: number;
  replaceCandidates: number;
  totalPortfolioValue: number;
}

export async function analyzeFleetPortfolio(
  db: SupabaseClient,
  assignmentId?: string
): Promise<FleetOptimizerResult> {
  const empty: FleetOptimizerResult = {
    section: "", assets: [], portfolioROI: 0,
    sellCandidates: 0, replaceCandidates: 0, totalPortfolioValue: 0,
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

    const results: AssetROI[] = [];
    let totalValue = 0, totalRevenue = 0, totalCost = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const age = getAge(data);
      const usefulLife = Number(data.useful_life || 15);
      const depRate = Math.min(age / usefulLife, 0.9);
      const currentValue = Math.round(cost * (1 - depRate * 0.9));

      // Revenue estimation (from capacity or hours data)
      const annualRevenue = Number(data.annual_revenue || data.revenue || currentValue * 0.12);
      // Cost estimation (maintenance + operating)
      const maintenancePct = age > usefulLife ? 0.12 : age > usefulLife * 0.7 ? 0.08 : 0.04;
      const annualCost = Number(data.annual_cost || cost * maintenancePct);

      const netIncome = annualRevenue - annualCost;
      const roi = currentValue > 0 ? Math.round((netIncome / currentValue) * 100) : 0;

      let recommendation: AssetROI["recommendation"];
      let reasonAr: string;

      if (roi < 0) {
        recommendation = "sell";
        reasonAr = "تكاليف التشغيل تتجاوز العائد — يُنصح بالبيع أو التخلص";
      } else if (age > usefulLife && roi < 8) {
        recommendation = "replace";
        reasonAr = "تجاوز العمر الافتراضي مع عائد منخفض — يُنصح بالاستبدال";
      } else if (roi > 20 && age < usefulLife * 0.5) {
        recommendation = "keep";
        reasonAr = "عائد مرتفع وعمر متبقي جيد — يُنصح بالاحتفاظ";
      } else if (roi > 12) {
        recommendation = "keep";
        reasonAr = "عائد مقبول — يُنصح بالاحتفاظ مع المراقبة";
      } else if (age > usefulLife * 0.8 && roi < 12) {
        recommendation = "lease_out";
        reasonAr = "عائد محدود مع اقتراب نهاية العمر — يُنصح بالتأجير";
      } else {
        recommendation = "keep";
        reasonAr = "أداء مقبول";
      }

      results.push({
        assetName: asset.name, currentValue, annualRevenue: Math.round(annualRevenue),
        annualCost: Math.round(annualCost), roi, recommendation, reasonAr,
      });

      totalValue += currentValue;
      totalRevenue += annualRevenue;
      totalCost += annualCost;
    }

    if (results.length === 0) return empty;

    const portfolioROI = totalValue > 0 ? Math.round(((totalRevenue - totalCost) / totalValue) * 100) : 0;
    const sellCount = results.filter(r => r.recommendation === "sell").length;
    const replaceCount = results.filter(r => r.recommendation === "replace").length;

    let section = "\n\n## تحليل محفظة الأصول (Fleet Optimizer)\n";
    section += `- إجمالي قيمة المحفظة: ${Math.round(totalValue).toLocaleString()} ر.س\n`;
    section += `- العائد الإجمالي: ${portfolioROI}% ${portfolioROI > 10 ? "✅" : portfolioROI > 0 ? "⚠️" : "🔴"}\n`;

    section += `\n| التوصية | العدد |\n|---|---|\n`;
    section += `| احتفاظ | ${results.filter(r => r.recommendation === "keep").length} |\n`;
    section += `| بيع | ${sellCount} |\n`;
    section += `| استبدال | ${replaceCount} |\n`;
    section += `| تأجير | ${results.filter(r => r.recommendation === "lease_out").length} |\n`;

    if (sellCount > 0) {
      section += `\n### 📉 أصول مرشحة للبيع:\n`;
      for (const s of results.filter(r => r.recommendation === "sell").slice(0, 5)) {
        section += `• ${s.assetName}: عائد ${s.roi}% | ${s.reasonAr}\n`;
      }
    }
    if (replaceCount > 0) {
      section += `\n### 🔄 أصول مرشحة للاستبدال:\n`;
      for (const r of results.filter(r => r.recommendation === "replace").slice(0, 5)) {
        section += `• ${r.assetName}: عائد ${r.roi}% | ${r.reasonAr}\n`;
      }
    }

    section += "\n💡 التوصيات مبنية على نماذج ROI تقديرية. القرار النهائي يتطلب مراجعة مالية مهنية.\n";

    return { section, assets: results, portfolioROI, sellCandidates: sellCount, replaceCandidates: replaceCount, totalPortfolioValue: Math.round(totalValue) };
  } catch (e) {
    console.error("Fleet optimizer error:", e);
    return empty;
  }
}

function getAge(data: Record<string, any>): number {
  const yearBuilt = Number(data.year_built || data.year || 0);
  return yearBuilt > 1900 ? new Date().getFullYear() - yearBuilt : Number(data.age || 5);
}
