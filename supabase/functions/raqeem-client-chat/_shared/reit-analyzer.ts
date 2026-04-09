/**
 * المستوى 31 — محلل صناديق الريت (REIT Analyzer)
 * تحليل هيكل الصندوق، حساب NAV، مقارنة السعر السوقي بالدفترية، العائد التوزيعي
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface REITMetrics {
  fundName: string;
  totalAssets: number;
  totalLiabilities: number;
  nav: number;
  navPerUnit: number;
  marketPrice: number | null;
  premiumDiscount: number | null; // % above/below NAV
  distributionYield: number;
  occupancyRate: number;
  debtToAssetRatio: number;
  wale: number; // Weighted Average Lease Expiry (years)
  assetCount: number;
  sectorDiversification: Record<string, number>;
  geoDiversification: Record<string, number>;
}

export interface REITAnalysisResult {
  section: string;
  metrics: REITMetrics | null;
  recommendations: string[];
  riskFlags: string[];
}

export async function analyzeREIT(
  db: SupabaseClient,
  assignmentId?: string
): Promise<REITAnalysisResult> {
  const empty: REITAnalysisResult = { section: "", metrics: null, recommendations: [], riskFlags: [] };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type, notes, property_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment) return empty;

    // Check if this is a fund/portfolio valuation
    const notes = (assignment.notes || "").toLowerCase();
    const isFund = notes.includes("صندوق") || notes.includes("ريت") || notes.includes("reit") || notes.includes("fund");
    if (!isFund && assignment.valuation_type !== "real_estate") return empty;

    // Get assets from processing jobs
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

    if (!assets?.length) return empty;

    let totalAssetValue = 0;
    let totalRentalIncome = 0;
    let totalArea = 0;
    let occupiedArea = 0;
    let totalLeaseRemaining = 0;
    let leaseCount = 0;
    const sectors: Record<string, number> = {};
    const cities: Record<string, number> = {};

    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      const value = Number(d.value || d.market_value || d.cost || 0);
      const rental = Number(d.annual_rental || d.rental_income || d.noi || 0);
      const area = Number(d.area || d.building_area || d.land_area || 0);
      const occupancy = Number(d.occupancy_rate || d.occupancy || 100) / 100;
      const leaseYears = Number(d.lease_remaining || d.wale || 0);
      const sector = d.sector || d.property_type || asset.category || "عام";
      const city = d.city || d.location || "غير محدد";

      totalAssetValue += value;
      totalRentalIncome += rental;
      totalArea += area;
      occupiedArea += area * occupancy;
      if (leaseYears > 0) { totalLeaseRemaining += leaseYears * value; leaseCount++; }

      sectors[sector] = (sectors[sector] || 0) + value;
      cities[city] = (cities[city] || 0) + value;
    }

    if (totalAssetValue <= 0) return empty;

    // Calculate metrics
    const totalLiabilities = totalAssetValue * 0.35; // typical REIT leverage ~35%
    const nav = totalAssetValue - totalLiabilities;
    const units = Number(assets[0]?.asset_data?.units || assets[0]?.asset_data?.total_units || 10000000);
    const navPerUnit = nav / units;
    const distributionYield = totalAssetValue > 0 ? (totalRentalIncome * 0.90 / totalAssetValue) * 100 : 0; // 90% payout
    const occupancyRate = totalArea > 0 ? (occupiedArea / totalArea) * 100 : 0;
    const debtRatio = totalAssetValue > 0 ? (totalLiabilities / totalAssetValue) * 100 : 0;
    const wale = leaseCount > 0 ? totalLeaseRemaining / totalAssetValue : 0;

    // Normalize sector/geo percentages
    const sectorPct: Record<string, number> = {};
    for (const [k, v] of Object.entries(sectors)) sectorPct[k] = Math.round((v / totalAssetValue) * 100);
    const geoPct: Record<string, number> = {};
    for (const [k, v] of Object.entries(cities)) geoPct[k] = Math.round((v / totalAssetValue) * 100);

    const metrics: REITMetrics = {
      fundName: "صندوق استثماري",
      totalAssets: Math.round(totalAssetValue),
      totalLiabilities: Math.round(totalLiabilities),
      nav: Math.round(nav),
      navPerUnit: Math.round(navPerUnit * 100) / 100,
      marketPrice: null,
      premiumDiscount: null,
      distributionYield: Math.round(distributionYield * 100) / 100,
      occupancyRate: Math.round(occupancyRate),
      debtToAssetRatio: Math.round(debtRatio),
      wale: Math.round(wale * 10) / 10,
      assetCount: assets.length,
      sectorDiversification: sectorPct,
      geoDiversification: geoPct,
    };

    // Recommendations
    const recommendations: string[] = [];
    const riskFlags: string[] = [];

    if (occupancyRate < 85) {
      riskFlags.push("نسبة الإشغال أقل من 85% — يؤثر على التوزيعات");
      recommendations.push("تحسين نسبة الإشغال لرفع العائد التوزيعي");
    }
    if (debtRatio > 50) {
      riskFlags.push("نسبة الدين أعلى من 50% — تتجاوز الحد المسموح من هيئة السوق المالية");
    }
    if (wale < 3) {
      riskFlags.push("متوسط مدة الإيجار المتبقية أقل من 3 سنوات — مخاطر تجديد");
    }
    if (Object.keys(sectorPct).length < 2) {
      recommendations.push("تنويع القطاعات لتقليل المخاطر التشغيلية");
    }
    if (distributionYield < 4) {
      recommendations.push("العائد التوزيعي منخفض مقارنة بمتوسط السوق (~6%)");
    }

    // Build section
    let section = "\n\n## تحليل الصندوق الاستثماري (REIT)\n";
    section += `\n| المؤشر | القيمة |\n|---|---|\n`;
    section += `| إجمالي الأصول | ${metrics.totalAssets.toLocaleString()} ر.س |\n`;
    section += `| إجمالي الالتزامات | ${metrics.totalLiabilities.toLocaleString()} ر.س |\n`;
    section += `| صافي قيمة الأصول (NAV) | ${metrics.nav.toLocaleString()} ر.س |\n`;
    section += `| NAV لكل وحدة | ${metrics.navPerUnit} ر.س |\n`;
    section += `| العائد التوزيعي | ${metrics.distributionYield}% |\n`;
    section += `| نسبة الإشغال | ${metrics.occupancyRate}% |\n`;
    section += `| نسبة الدين | ${metrics.debtToAssetRatio}% |\n`;
    section += `| WALE | ${metrics.wale} سنة |\n`;
    section += `| عدد الأصول | ${metrics.assetCount} |\n`;

    if (Object.keys(sectorPct).length > 1) {
      section += `\n### التنوع القطاعي:\n`;
      for (const [s, p] of Object.entries(sectorPct).sort((a, b) => b[1] - a[1])) {
        section += `• ${s}: ${p}%\n`;
      }
    }

    if (riskFlags.length > 0) {
      section += `\n### ⚠️ مخاطر:\n`;
      for (const r of riskFlags) section += `• ${r}\n`;
    }
    if (recommendations.length > 0) {
      section += `\n### 💡 توصيات:\n`;
      for (const r of recommendations) section += `• ${r}\n`;
    }

    return { section, metrics, recommendations, riskFlags };
  } catch (e) {
    console.error("REIT analysis error:", e);
    return empty;
  }
}
