/**
 * المستوى 32 — محرك تقييم المحفظة العقارية
 * تقييم جماعي لأصول الصندوق مع تحليل التنوع والإشغال
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PortfolioAssetValuation {
  name: string;
  value: number;
  capRate: number;
  noi: number;
  occupancy: number;
  city: string;
  sector: string;
  contributionPct: number;
}

export interface PortfolioValuationResult {
  section: string;
  assets: PortfolioAssetValuation[];
  totalValue: number;
  weightedCapRate: number;
  weightedOccupancy: number;
  herfindahlIndex: number; // concentration index
  diversificationRating: string;
}

export async function analyzePortfolioValuation(
  db: SupabaseClient,
  assignmentId?: string
): Promise<PortfolioValuationResult> {
  const empty: PortfolioValuationResult = {
    section: "", assets: [], totalValue: 0, weightedCapRate: 0,
    weightedOccupancy: 0, herfindahlIndex: 0, diversificationRating: "غير محدد",
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
      .select("name, asset_data, category")
      .in("job_id", jobs.map(j => j.id))
      .limit(200);
    if (!assets?.length || assets.length < 2) return empty;

    const results: PortfolioAssetValuation[] = [];
    let totalValue = 0;

    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      const noi = Number(d.noi || d.annual_rental || d.net_income || 0);
      const capRate = Number(d.cap_rate || d.capitalization_rate || 7) / 100;
      const value = noi > 0 && capRate > 0 ? noi / capRate : Number(d.value || d.market_value || d.cost || 0);
      if (value <= 0) continue;

      const occupancy = Number(d.occupancy_rate || d.occupancy || 95);
      const city = d.city || d.location || "غير محدد";
      const sector = d.sector || d.property_type || asset.category || "عام";

      results.push({ name: asset.name, value: Math.round(value), capRate: capRate * 100, noi: Math.round(noi), occupancy, city, sector, contributionPct: 0 });
      totalValue += value;
    }

    if (results.length === 0) return empty;

    // Calculate contributions and concentration
    let hhi = 0;
    for (const r of results) {
      r.contributionPct = Math.round((r.value / totalValue) * 10000) / 100;
      hhi += Math.pow(r.contributionPct, 2);
    }

    const weightedCapRate = results.reduce((s, r) => s + r.capRate * (r.value / totalValue), 0);
    const weightedOccupancy = results.reduce((s, r) => s + r.occupancy * (r.value / totalValue), 0);

    const diversificationRating =
      hhi < 1500 ? "ممتاز — محفظة متنوعة جيداً" :
      hhi < 2500 ? "جيد — تركز معتدل" :
      hhi < 5000 ? "متوسط — تركز عالٍ" : "ضعيف — محفظة مركزة جداً";

    let section = "\n\n## تقييم المحفظة العقارية\n";
    section += `- إجمالي القيمة: ${Math.round(totalValue).toLocaleString()} ر.س\n`;
    section += `- معدل الرسملة المرجح: ${Math.round(weightedCapRate * 100) / 100}%\n`;
    section += `- نسبة الإشغال المرجحة: ${Math.round(weightedOccupancy)}%\n`;
    section += `- مؤشر التركز (HHI): ${Math.round(hhi)} — ${diversificationRating}\n`;
    section += `- عدد الأصول: ${results.length}\n`;

    // Top assets
    const sorted = [...results].sort((a, b) => b.value - a.value);
    section += `\n### أبرز الأصول:\n`;
    section += `| الأصل | القيمة | Cap Rate | الإشغال | المساهمة |\n|---|---|---|---|---|\n`;
    for (const a of sorted.slice(0, 10)) {
      section += `| ${a.name} | ${a.value.toLocaleString()} | ${a.capRate.toFixed(1)}% | ${a.occupancy}% | ${a.contributionPct}% |\n`;
    }

    // Sector breakdown
    const sectorTotals: Record<string, number> = {};
    for (const r of results) sectorTotals[r.sector] = (sectorTotals[r.sector] || 0) + r.value;
    section += `\n### توزيع القطاعات:\n`;
    for (const [s, v] of Object.entries(sectorTotals).sort((a, b) => b[1] - a[1])) {
      section += `• ${s}: ${Math.round((v / totalValue) * 100)}% (${Math.round(v).toLocaleString()} ر.س)\n`;
    }

    return { section, assets: results, totalValue: Math.round(totalValue), weightedCapRate: Math.round(weightedCapRate * 100) / 100, weightedOccupancy: Math.round(weightedOccupancy), herfindahlIndex: Math.round(hhi), diversificationRating };
  } catch (e) {
    console.error("Portfolio valuation error:", e);
    return empty;
  }
}
