/**
 * Level 49: Predictive Valuation Engine
 * Forecasts asset value at 6/12/36 months using ML-like statistical models
 */

interface PredictionPoint {
  months: number;
  estimatedValue: number;
  confidenceRange: { low: number; high: number };
  growthRate: number;
}

interface PredictiveResult {
  section: string;
  predictions: PredictionPoint[];
  marketTrend: "rising" | "stable" | "declining";
  seasonalFactor: number;
  macroFactors: string[];
}

export async function analyzePredictiveValuation(
  db: any,
  assignmentId: string | undefined
): Promise<PredictiveResult> {
  const empty: PredictiveResult = {
    section: "",
    predictions: [],
    marketTrend: "stable",
    seasonalFactor: 1.0,
    macroFactors: [],
  };
  if (!assignmentId) return empty;

  try {
    // Get current assignment data
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("property_type, organization_id, created_at")
      .eq("id", assignmentId)
      .single();

    if (!assignment) return empty;

    // Get historical valuations for same property type
    const { data: historicalValues } = await db
      .from("valuation_assignments")
      .select("final_value_sar, created_at, property_type")
      .eq("organization_id", assignment.organization_id)
      .eq("property_type", assignment.property_type)
      .not("final_value_sar", "is", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!historicalValues?.length || historicalValues.length < 3) return empty;

    // Calculate trend using linear regression approximation
    const values = historicalValues.map((v: any, i: number) => ({
      x: i,
      y: v.final_value_sar,
      date: new Date(v.created_at),
    }));

    const n = values.length;
    const sumX = values.reduce((s: number, v: any) => s + v.x, 0);
    const sumY = values.reduce((s: number, v: any) => s + v.y, 0);
    const sumXY = values.reduce((s: number, v: any) => s + v.x * v.y, 0);
    const sumX2 = values.reduce((s: number, v: any) => s + v.x * v.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const avgValue = sumY / n;
    const monthlyGrowthRate = slope / avgValue;

    // Determine trend
    const marketTrend: "rising" | "stable" | "declining" =
      monthlyGrowthRate > 0.005 ? "rising" : monthlyGrowthRate < -0.005 ? "declining" : "stable";

    // Seasonal adjustment (Q4 typically higher in Saudi market)
    const currentMonth = new Date().getMonth();
    const seasonalFactor = currentMonth >= 9 ? 1.03 : currentMonth <= 2 ? 0.97 : 1.0;

    // Generate predictions
    const latestValue = values[values.length - 1].y;
    const predictions: PredictionPoint[] = [6, 12, 36].map((months) => {
      const projected = latestValue * (1 + monthlyGrowthRate * months) * seasonalFactor;
      const uncertainty = 0.05 + months * 0.01; // uncertainty grows with time
      return {
        months,
        estimatedValue: Math.round(projected),
        confidenceRange: {
          low: Math.round(projected * (1 - uncertainty)),
          high: Math.round(projected * (1 + uncertainty)),
        },
        growthRate: Math.round(monthlyGrowthRate * months * 10000) / 100,
      };
    });

    // Macro factors
    const macroFactors: string[] = [];
    if (marketTrend === "rising") macroFactors.push("اتجاه صعودي في السوق المحلي");
    if (marketTrend === "declining") macroFactors.push("اتجاه هبوطي — يُنصح بالحذر");
    macroFactors.push("رؤية 2030 — مشاريع التطوير الكبرى");
    if (assignment.property_type === "commercial") macroFactors.push("نمو القطاع التجاري");

    let section = "\n\n## التقييم التنبؤي (المستوى 49)\n";
    section += `- الاتجاه العام: ${marketTrend === "rising" ? "صعودي 📈" : marketTrend === "declining" ? "هبوطي 📉" : "مستقر ➡️"}\n`;
    section += `- معامل النمو الشهري: ${(monthlyGrowthRate * 100).toFixed(2)}%\n`;
    for (const p of predictions) {
      section += `- توقع ${p.months} شهر: ${p.estimatedValue.toLocaleString()} ر.س (${p.confidenceRange.low.toLocaleString()} — ${p.confidenceRange.high.toLocaleString()})\n`;
    }
    section += `- العوامل الكلية: ${macroFactors.join("، ")}\n`;
    section += `⚠️ تنبيه: التوقعات أولية مبنية على البيانات التاريخية ولا تمثل تقييماً رسمياً\n`;

    return { section, predictions, marketTrend, seasonalFactor, macroFactors };
  } catch (e) {
    console.error("Predictive valuation error:", e);
    return empty;
  }
}
