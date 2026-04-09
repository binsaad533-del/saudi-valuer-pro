import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MarketInsight {
  section: string;
  hasComparables: boolean;
}

export async function generateMarketInsights(
  db: SupabaseClient,
  propertyType: string | null,
  city: string | null,
  organizationId: string | null
): Promise<MarketInsight> {
  if (!city || !organizationId) {
    return { section: "", hasComparables: false };
  }

  // Find comparable transactions in same city
  const { data: comparables } = await db
    .from("comparables")
    .select("price, price_per_sqm, land_area, building_area, transaction_date, district_ar")
    .eq("organization_id", organizationId)
    .eq("city_ar", city)
    .eq("property_type", propertyType || "residential")
    .eq("is_verified", true)
    .order("transaction_date", { ascending: false })
    .limit(5);

  if (!comparables || comparables.length === 0) {
    return { section: "", hasComparables: false };
  }

  // Calculate statistics
  const prices = comparables.map((c) => c.price).filter(Boolean) as number[];
  const priceSqm = comparables.map((c) => c.price_per_sqm).filter(Boolean) as number[];

  let section = "\n\n## رؤى سوقية (للاستخدام الداخلي — قدمها كتقديرات أولية)\n";

  if (prices.length > 0) {
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    section += `- نطاق الأسعار في ${city}: ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} ر.س\n`;
    section += `- متوسط السعر: ${avgPrice.toLocaleString()} ر.س\n`;
  }

  if (priceSqm.length > 0) {
    const avgSqm = Math.round(priceSqm.reduce((a, b) => a + b, 0) / priceSqm.length);
    section += `- متوسط سعر المتر: ${avgSqm.toLocaleString()} ر.س/م²\n`;
  }

  section += `- عدد المقارنات المتوفرة: ${comparables.length}\n`;

  const districts = [...new Set(comparables.map((c) => c.district_ar).filter(Boolean))];
  if (districts.length > 0) {
    section += `- الأحياء المقارنة: ${districts.join("، ")}\n`;
  }

  section += `\nعند سؤال العميل عن تقدير أولي، قدم نطاقاً تقديرياً مع التنويه أنه أولي وغير رسمي.\n`;

  return { section, hasComparables: true };
}

export async function getClientHistory(
  db: SupabaseClient,
  clientUserId: string
): Promise<string> {
  const { data: requests } = await db
    .from("valuation_requests")
    .select("id, status, property_type, client_name_ar, created_at")
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!requests || requests.length <= 1) return "";

  let section = "\n\n## سجل طلبات العميل السابقة\n";
  for (const r of requests) {
    const statusLabel = r.status || "غير محدد";
    const date = new Date(r.created_at).toLocaleDateString("ar-SA");
    section += `• ${r.property_type || "عقار"} — ${statusLabel} — ${date}\n`;
  }
  section += `\nيمكنك الإشارة للتجارب السابقة لبناء الثقة مع العميل.\n`;
  return section;
}
