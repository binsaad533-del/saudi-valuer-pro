import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Adjustment ranges (mirrors calculation-engine.ts) ── */
const ADJ_RANGES: Record<string, { min: number; max: number }> = {
  location: { min: -0.2, max: 0.2 },
  size: { min: -0.15, max: 0.15 },
  age: { min: -0.3, max: 0 },
  condition: { min: -0.2, max: 0.1 },
  time: { min: -0.1, max: 0.15 },
};

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      assignment_id,
      subject_city_ar,
      subject_district_ar,
      subject_property_type,
      subject_area_sqm,
      subject_age_years: _subject_age_years,
      subject_condition: _subject_condition,
      max_results = 6,
      area_tolerance = 0.2,
    } = body;

    if (!assignment_id) {
      return new Response(JSON.stringify({ error: "assignment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── 1. Fetch all comparables for the org ── */
    // Get assignment org
    const { data: assignment } = await sb
      .from("valuation_assignments")
      .select("organization_id")
      .eq("id", assignment_id)
      .single();

    if (!assignment) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allComps } = await sb
      .from("comparables")
      .select("*, comparable_sources(*)")
      .eq("organization_id", assignment.organization_id)
      .order("transaction_date", { ascending: false })
      .limit(500);

    if (!allComps || allComps.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          selected: [],
          summary: { total_found: 0, after_cleaning: 0, after_filtering: 0, final_selected: 0 },
          explanation_ar: "لا توجد مقارنات في قاعدة البيانات",
          confidence_score: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /* ── 2. Data Cleaning ── */
    // Remove duplicates (same price + area + district)
    const seen = new Set<string>();
    let cleaned = allComps.filter((c: any) => {
      const key = `${c.price}-${c.land_area}-${c.district_ar}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Remove incomplete records (must have price and area)
    cleaned = cleaned.filter((c: any) => c.price && c.price > 0 && c.land_area && c.land_area > 0);

    // Outlier detection (IQR method on price_per_sqm)
    const priceSqmArr = cleaned
      .map((c: any) => (c.price_per_sqm || c.price / c.land_area))
      .sort((a: number, b: number) => a - b);

    let q1 = 0, q3 = 0;
    if (priceSqmArr.length >= 4) {
      q1 = priceSqmArr[Math.floor(priceSqmArr.length * 0.25)];
      q3 = priceSqmArr[Math.floor(priceSqmArr.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      cleaned = cleaned.filter((c: any) => {
        const psqm = c.price_per_sqm || c.price / c.land_area;
        return psqm >= lower && psqm <= upper;
      });
    }

    const afterCleaning = cleaned.length;

    /* ── 3. Smart Filtering ── */
    let filtered = cleaned;

    // Property type filter
    if (subject_property_type) {
      const typeFiltered = filtered.filter((c: any) => c.property_type === subject_property_type);
      if (typeFiltered.length >= 3) filtered = typeFiltered;
    }

    // City filter
    if (subject_city_ar) {
      const cityFiltered = filtered.filter((c: any) =>
        c.city_ar && c.city_ar.includes(subject_city_ar)
      );
      if (cityFiltered.length >= 3) filtered = cityFiltered;
    }

    // District filter (soft - prefer same district)
    if (subject_district_ar) {
      const districtFiltered = filtered.filter((c: any) =>
        c.district_ar && c.district_ar.includes(subject_district_ar)
      );
      if (districtFiltered.length >= 3) filtered = districtFiltered;
    }

    // Area tolerance filter (±tolerance%)
    if (subject_area_sqm && subject_area_sqm > 0) {
      const minArea = subject_area_sqm * (1 - area_tolerance);
      const maxArea = subject_area_sqm * (1 + area_tolerance);
      const areaFiltered = filtered.filter((c: any) =>
        c.land_area >= minArea && c.land_area <= maxArea
      );
      if (areaFiltered.length >= 3) filtered = areaFiltered;
    }

    const afterFiltering = filtered.length;

    /* ── 4. Similarity Scoring ── */
    const scored = filtered.map((c: any) => {
      let score = 50; // base

      // Location similarity
      if (subject_district_ar && c.district_ar === subject_district_ar) score += 20;
      else if (subject_city_ar && c.city_ar && c.city_ar.includes(subject_city_ar)) score += 10;

      // Area similarity
      if (subject_area_sqm && c.land_area) {
        const areaDiff = Math.abs(c.land_area - subject_area_sqm) / subject_area_sqm;
        score += Math.max(0, 15 - areaDiff * 50);
      }

      // Recency bonus (newer transactions = more relevant)
      if (c.transaction_date) {
        const months = Math.floor(
          (Date.now() - new Date(c.transaction_date).getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        score += Math.max(0, 10 - months);
      }

      // Verified bonus
      if (c.is_verified) score += 5;

      // Source quality bonus
      const sources = c.comparable_sources || [];
      if (sources.length > 0) score += 5;
      if (sources.some((s: any) => s.source_type === "gov_open")) score += 5;

      return { ...c, similarity_score: Math.min(100, Math.round(score)) };
    });

    // Sort by similarity score descending
    scored.sort((a: any, b: any) => b.similarity_score - a.similarity_score);

    /* ── 5. Select top N ── */
    const selected = scored.slice(0, Math.min(max_results, scored.length));

    /* ── 6. Calculate Adjustments ── */
    const withAdjustments = selected.map((c: any) => {
      const adjustments: any[] = [];
      const basePriceSqm = c.price / c.land_area;

      // Location adjustment
      if (subject_district_ar && c.district_ar !== subject_district_ar) {
        const locAdj = subject_city_ar && c.city_ar?.includes(subject_city_ar) ? 0.05 : 0.1;
        adjustments.push({
          type: "location",
          percentage: clamp(locAdj, ADJ_RANGES.location.min, ADJ_RANGES.location.max),
          justification_ar: c.district_ar !== subject_district_ar
            ? `تعديل الموقع: المقارن في ${c.district_ar || "منطقة أخرى"} بينما العقار في ${subject_district_ar}`
            : "نفس الموقع",
        });
      }

      // Size adjustment
      if (subject_area_sqm && c.land_area) {
        const sizeDiff = (subject_area_sqm - c.land_area) / c.land_area;
        if (Math.abs(sizeDiff) > 0.05) {
          adjustments.push({
            type: "size",
            percentage: clamp(sizeDiff * -0.5, ADJ_RANGES.size.min, ADJ_RANGES.size.max),
            justification_ar: `تعديل المساحة: المقارن ${c.land_area} م² والعقار ${subject_area_sqm} م²`,
          });
        }
      }

      // Time/age adjustment
      if (c.transaction_date) {
        const monthsAgo = Math.floor(
          (Date.now() - new Date(c.transaction_date).getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        if (monthsAgo > 3) {
          const timeAdj = Math.min(monthsAgo * 0.005, 0.15);
          adjustments.push({
            type: "time",
            percentage: clamp(timeAdj, ADJ_RANGES.time.min, ADJ_RANGES.time.max),
            justification_ar: `تعديل الوقت: الصفقة قبل ${monthsAgo} شهر`,
          });
        }
      }

      // Calculate adjusted price
      const totalAdj = adjustments.reduce((s: number, a: any) => s + a.percentage, 0);
      const adjustedPriceSqm = basePriceSqm * (1 + totalAdj);

      return {
        id: c.id,
        city_ar: c.city_ar,
        district_ar: c.district_ar,
        property_type: c.property_type,
        land_area: c.land_area,
        price: c.price,
        price_per_sqm: Math.round(basePriceSqm),
        adjusted_price_per_sqm: Math.round(adjustedPriceSqm),
        transaction_date: c.transaction_date,
        transaction_type: c.transaction_type,
        is_verified: c.is_verified,
        similarity_score: c.similarity_score,
        adjustments,
        total_adjustment_pct: Math.round(totalAdj * 100 * 10) / 10,
        sources: (c.comparable_sources || []).map((s: any) => ({
          name_ar: s.source_name_ar,
          type: s.source_type,
          reference: s.reference_number,
        })),
      };
    });

    /* ── 7. Weighted Average ── */
    const totalWeight = withAdjustments.reduce((s: number, c: any) => s + c.similarity_score, 0);
    const weightedAvgSqm = totalWeight > 0
      ? withAdjustments.reduce((s: number, c: any) =>
          s + c.adjusted_price_per_sqm * (c.similarity_score / totalWeight), 0)
      : 0;

    const pricesSqm = withAdjustments.map((c: any) => c.adjusted_price_per_sqm);
    const minPrice = Math.min(...pricesSqm);
    const maxPrice = Math.max(...pricesSqm);

    // Confidence score based on: number of comps, consistency, data quality
    let confidence = 0;
    if (withAdjustments.length >= 5) confidence += 30;
    else if (withAdjustments.length >= 3) confidence += 20;
    else confidence += 10;

    // Consistency: lower variance = higher confidence
    if (pricesSqm.length > 1) {
      const mean = pricesSqm.reduce((a: number, b: number) => a + b, 0) / pricesSqm.length;
      const variance = pricesSqm.reduce((s: number, p: number) => s + Math.pow(p - mean, 2), 0) / pricesSqm.length;
      const cv = Math.sqrt(variance) / mean; // coefficient of variation
      if (cv < 0.1) confidence += 30;
      else if (cv < 0.2) confidence += 20;
      else if (cv < 0.3) confidence += 10;
    }

    // Data quality: verified sources
    const verifiedCount = withAdjustments.filter((c: any) => c.is_verified).length;
    confidence += Math.min(20, verifiedCount * 5);

    // Source quality
    const withSources = withAdjustments.filter((c: any) => c.sources.length > 0).length;
    confidence += Math.min(20, withSources * 4);

    confidence = Math.min(100, confidence);

    /* ── 8. Generate Explanation ── */
    const explanationParts: string[] = [];
    explanationParts.push(`تم فحص ${allComps.length} مقارنة من قاعدة البيانات.`);
    explanationParts.push(`بعد إزالة التكرارات والبيانات غير المكتملة والقيم الشاذة: ${afterCleaning} مقارنة.`);
    explanationParts.push(`بعد تطبيق الفلاتر الذكية (الموقع، النوع، المساحة): ${afterFiltering} مقارنة.`);
    explanationParts.push(`تم اختيار أفضل ${withAdjustments.length} مقارنات بناءً على درجة التشابه.`);

    if (withAdjustments.length > 0) {
      explanationParts.push(`\nمتوسط سعر المتر المعدّل (الموزون): ${Math.round(weightedAvgSqm).toLocaleString()} ر.س/م²`);
      explanationParts.push(`نطاق الأسعار: ${Math.round(minPrice).toLocaleString()} - ${Math.round(maxPrice).toLocaleString()} ر.س/م²`);
      if (subject_area_sqm) {
        explanationParts.push(`القيمة المقدرة: ${Math.round(weightedAvgSqm * subject_area_sqm).toLocaleString()} ر.س`);
      }
    }

    /* ── 9. Save to assignment_comparables ── */
    for (const comp of withAdjustments) {
      // Upsert assignment_comparable link
      const { data: existing } = await sb
        .from("assignment_comparables")
        .select("id")
        .eq("assignment_id", assignment_id)
        .eq("comparable_id", comp.id)
        .maybeSingle();

      if (!existing) {
        await sb.from("assignment_comparables").insert({
          assignment_id,
          comparable_id: comp.id,
          weight: comp.similarity_score,
          rank: withAdjustments.indexOf(comp) + 1,
          notes: `درجة التشابه: ${comp.similarity_score}% | تعديل إجمالي: ${comp.total_adjustment_pct}%`,
        });
      }
    }

    const result = {
      success: true,
      selected: withAdjustments,
      weighted_average_sqm: Math.round(weightedAvgSqm),
      estimated_value: subject_area_sqm ? Math.round(weightedAvgSqm * subject_area_sqm) : null,
      value_range: {
        min: subject_area_sqm ? Math.round(minPrice * subject_area_sqm) : Math.round(minPrice),
        max: subject_area_sqm ? Math.round(maxPrice * subject_area_sqm) : Math.round(maxPrice),
      },
      confidence_score: confidence,
      summary: {
        total_found: allComps.length,
        after_cleaning: afterCleaning,
        after_filtering: afterFiltering,
        final_selected: withAdjustments.length,
      },
      explanation_ar: explanationParts.join("\n"),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Comparable selection error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
