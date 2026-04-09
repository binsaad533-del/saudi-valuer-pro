import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PredictionResult {
  estimatedDays: number | null;
  valueRange: { min: number; max: number } | null;
  riskFlags: string[];
  section: string;
}

export async function generatePredictions(
  db: SupabaseClient,
  propertyType: string | null,
  city: string | null,
  valuationMode: string | null,
  organizationId: string | null
): Promise<PredictionResult> {
  const result: PredictionResult = {
    estimatedDays: null,
    valueRange: null,
    riskFlags: [],
    section: "",
  };

  if (!organizationId) return result;

  // ── 1. Predict duration from historical assignments ──
  const { data: completed } = await db
    .from("valuation_assignments")
    .select("created_at, updated_at, valuation_mode, property_type")
    .eq("organization_id", organizationId)
    .in("status", ["issued", "archived"])
    .order("updated_at", { ascending: false })
    .limit(50);

  if (completed?.length) {
    // Filter by similar type/mode
    const similar = completed.filter(
      (a) =>
        (!propertyType || a.property_type === propertyType) &&
        (!valuationMode || a.valuation_mode === valuationMode)
    );
    const pool = similar.length >= 3 ? similar : completed;
    const durations = pool.map((a) => {
      const start = new Date(a.created_at).getTime();
      const end = new Date(a.updated_at).getTime();
      return Math.ceil((end - start) / 86400000);
    }).filter((d) => d > 0 && d < 90);

    if (durations.length >= 2) {
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      const median = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];
      result.estimatedDays = median;
      result.section += `\n\n## التنبؤ الذكي\n`;
      result.section += `- المدة المتوقعة (بناءً على ${pool.length} تقييم سابق): **${median} يوم عمل**\n`;
      result.section += `- المتوسط التاريخي: ${avg} يوم\n`;
    }
  }

  // ── 2. Value range prediction from comparables ──
  if (city) {
    const { data: comps } = await db
      .from("comparables")
      .select("price, price_per_sqm, land_area")
      .eq("organization_id", organizationId)
      .eq("city_ar", city)
      .eq("property_type", propertyType || "residential")
      .eq("is_verified", true)
      .order("transaction_date", { ascending: false })
      .limit(20);

    if (comps?.length && comps.length >= 3) {
      const prices = comps.map((c) => c.price).filter(Boolean) as number[];
      if (prices.length >= 3) {
        prices.sort((a, b) => a - b);
        const q1 = prices[Math.floor(prices.length * 0.25)];
        const q3 = prices[Math.floor(prices.length * 0.75)];
        result.valueRange = { min: q1, max: q3 };
        if (!result.section) result.section = "\n\n## التنبؤ الذكي\n";
        result.section += `- النطاق التقديري للقيمة (الربع الأول - الثالث): ${q1.toLocaleString()} — ${q3.toLocaleString()} ر.س\n`;
        result.section += `- مبني على ${prices.length} صفقة مماثلة في ${city}\n`;
        result.section += `\n⚠️ هذا تقدير إحصائي أولي وليس تقييماً رسمياً. نوّه بذلك عند مشاركته مع العميل.\n`;
      }
    }
  }

  // ── 3. Risk detection ──
  // High-value area risk
  if (valuationMode === "desktop") {
    result.riskFlags.push("تقييم مكتبي — خطر عدم اكتشاف عيوب مخفية");
  }
  
  // Check if property type is unusual for this org
  if (propertyType && completed?.length) {
    const typeCount = completed.filter((a) => a.property_type === propertyType).length;
    if (typeCount < 2) {
      result.riskFlags.push(`نوع الأصل (${propertyType}) نادر في سجلات الشركة — قد يتطلب وقتاً إضافياً`);
    }
  }

  if (result.riskFlags.length > 0) {
    if (!result.section) result.section = "\n\n## التنبؤ الذكي\n";
    result.section += `\n### مؤشرات المخاطر\n`;
    for (const flag of result.riskFlags) {
      result.section += `- ⚠️ ${flag}\n`;
    }
    result.section += `\nاذكر المخاطر بأسلوب مطمئن ومهني عند سؤال العميل.\n`;
  }

  return result;
}
