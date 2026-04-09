/**
 * المستوى 17 — الوعي السوقي الحي
 * مراقبة اتجاهات السوق وتنبيهات الأسعار
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MarketAwareness {
  section: string;
  trends: { city: string; direction: string; changePercent: number }[];
  alerts: string[];
  recentTransactions: number;
}

export async function analyzeMarketTrends(
  db: SupabaseClient,
  propertyType?: string,
  city?: string,
  organizationId?: string
): Promise<MarketAwareness> {
  const empty: MarketAwareness = { section: "", trends: [], alerts: [], recentTransactions: 0 };
  if (!organizationId) return empty;

  try {
    // Get recent comparables for trend analysis
    const query = db
      .from("comparables")
      .select("city_ar, price_per_sqm, transaction_date, property_type, land_area, price")
      .eq("organization_id", organizationId)
      .eq("is_verified", true)
      .not("price_per_sqm", "is", null)
      .not("transaction_date", "is", null)
      .order("transaction_date", { ascending: false })
      .limit(500);

    if (propertyType) query.eq("property_type", propertyType);

    const { data: comparables } = await query;
    if (!comparables || comparables.length < 5) return empty;

    // Group by city and analyze trends
    const cityData: Record<string, { recent: number[]; older: number[]; all: number[] }> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const c of comparables) {
      const cCity = c.city_ar || "غير محدد";
      if (!cityData[cCity]) cityData[cCity] = { recent: [], older: [], all: [] };

      const ppsm = Number(c.price_per_sqm);
      if (isNaN(ppsm) || ppsm <= 0) continue;

      cityData[cCity].all.push(ppsm);
      const txDate = new Date(c.transaction_date);

      if (txDate >= sixMonthsAgo) {
        cityData[cCity].recent.push(ppsm);
      } else if (txDate >= oneYearAgo) {
        cityData[cCity].older.push(ppsm);
      }
    }

    const trends: MarketAwareness["trends"] = [];
    const alerts: string[] = [];

    for (const [cityName, data] of Object.entries(cityData)) {
      if (data.recent.length < 2 || data.older.length < 2) continue;

      const recentAvg = data.recent.reduce((a, b) => a + b, 0) / data.recent.length;
      const olderAvg = data.older.reduce((a, b) => a + b, 0) / data.older.length;
      const changePercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);

      let direction = "stable";
      if (changePercent > 5) direction = "up";
      else if (changePercent < -5) direction = "down";

      trends.push({ city: cityName, direction, changePercent });

      // Alert on significant changes
      if (Math.abs(changePercent) > 15) {
        alerts.push(
          `تغيّر ملحوظ في ${cityName}: ${changePercent > 0 ? "ارتفاع" : "انخفاض"} ${Math.abs(changePercent)}% خلال 6 أشهر`
        );
      }
    }

    // Focus on the requested city
    let section = "\n\n## الوعي السوقي الحي\n";
    section += `- إجمالي الصفقات المرصودة: ${comparables.length}\n`;

    // Show target city first if available
    const targetCity = city ? trends.find((t) => t.city === city) : null;
    if (targetCity) {
      const arrow = targetCity.direction === "up" ? "📈" : targetCity.direction === "down" ? "📉" : "📊";
      section += `\n### اتجاه السوق في ${targetCity.city}:\n`;
      section += `${arrow} تغيّر ${Math.abs(targetCity.changePercent)}% ${targetCity.direction === "up" ? "ارتفاع" : targetCity.direction === "down" ? "انخفاض" : "استقرار"} خلال 6 أشهر\n`;
    }

    // Show top 3 trends
    const topTrends = trends
      .filter((t) => t.city !== city)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 3);

    if (topTrends.length > 0) {
      section += `\n### أبرز الاتجاهات:\n`;
      for (const t of topTrends) {
        const arrow = t.direction === "up" ? "📈" : t.direction === "down" ? "📉" : "📊";
        section += `${arrow} ${t.city}: ${t.changePercent > 0 ? "+" : ""}${t.changePercent}%\n`;
      }
    }

    if (alerts.length > 0) {
      section += `\n### تنبيهات سوقية:\n`;
      for (const a of alerts) section += `⚠️ ${a}\n`;
    }

    section += "\nاستخدم هذه البيانات لإثراء ردودك عن القيمة المتوقعة. نوّه أنها مبنية على بيانات الصفقات المسجلة.\n";

    return { section, trends, alerts, recentTransactions: comparables.length };
  } catch (e) {
    console.error("Market awareness error:", e);
    return empty;
  }
}
