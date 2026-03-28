import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InspectorMatch {
  inspector_profile_id: string;
  user_id: string;
  full_name_ar: string;
  availability_status: string;
  current_workload: number;
  max_concurrent_tasks: number;
  quality_score: number;
  total_completed: number;
  coverage_match: "city_district" | "city" | "region" | "fallback";
  distance_km: number | null;
  score: number;
  cities: string[];
  districts: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { assignment_id, property_city_ar, property_district_ar, property_latitude, property_longitude } = await req.json();

    if (!assignment_id) {
      return new Response(JSON.stringify({ error: "assignment_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get all active inspector profiles with their coverage
    const { data: inspectorProfiles } = await supabase
      .from("inspector_profiles")
      .select("id, user_id, availability_status, current_workload, max_concurrent_tasks, quality_score, total_completed, home_latitude, home_longitude")
      .eq("is_active", true);

    if (!inspectorProfiles || inspectorProfiles.length === 0) {
      return new Response(JSON.stringify({
        recommended: null,
        alternatives: [],
        fallback_needed: true,
        message: "لا يوجد معاينين متاحين",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Get coverage areas for all inspectors
    const inspIds = inspectorProfiles.map(ip => ip.id);
    const { data: coverageAreas } = await supabase
      .from("inspector_coverage_areas")
      .select("inspector_profile_id, city_id, district_id")
      .in("inspector_profile_id", inspIds);

    // 3. Get city/district info to match by name
    const { data: cities } = await supabase.from("cities").select("id, name_ar, region_ar, latitude, longitude");
    const { data: districts } = await supabase.from("districts").select("id, city_id, name_ar, latitude, longitude");

    // 4. Get profile names
    const userIds = inspectorProfiles.map(ip => ip.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name_ar")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name_ar]));

    // Build lookup maps
    const cityMap = new Map((cities || []).map(c => [c.id, c]));
    const cityByName = new Map((cities || []).map(c => [c.name_ar, c]));
    const districtMap = new Map((districts || []).map(d => [d.id, d]));
    const districtByName = new Map((districts || []).map(d => [d.name_ar, d]));

    // Find target city/district
    const targetCity = property_city_ar ? cityByName.get(property_city_ar) : null;
    const targetDistrict = property_district_ar ? districtByName.get(property_district_ar) : null;
    const targetLat = property_latitude || targetCity?.latitude || targetDistrict?.latitude;
    const targetLon = property_longitude || targetCity?.longitude || targetDistrict?.longitude;

    // 5. Score each inspector
    const matches: InspectorMatch[] = [];

    for (const insp of inspectorProfiles) {
      const inspCoverage = (coverageAreas || []).filter(ca => ca.inspector_profile_id === insp.id);
      const inspCityIds = inspCoverage.map(ca => ca.city_id);
      const inspDistrictIds = inspCoverage.filter(ca => ca.district_id).map(ca => ca.district_id);

      // Coverage match level
      let coverageMatch: InspectorMatch["coverage_match"] = "fallback";

      if (targetDistrict && inspDistrictIds.includes(targetDistrict.id)) {
        coverageMatch = "city_district";
      } else if (targetCity && inspCityIds.includes(targetCity.id)) {
        coverageMatch = "city";
      } else if (targetCity) {
        // Check region match
        const inspCities = inspCityIds.map(id => cityMap.get(id)).filter(Boolean);
        if (inspCities.some(c => c!.region_ar === targetCity.region_ar)) {
          coverageMatch = "region";
        }
      }

      // Distance calculation
      let distanceKm: number | null = null;
      if (targetLat && targetLon && insp.home_latitude && insp.home_longitude) {
        const lat1 = Number(insp.home_latitude);
        const lon1 = Number(insp.home_longitude);
        const lat2 = Number(targetLat);
        const lon2 = Number(targetLon);
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        distanceKm = R * 2 * Math.asin(Math.sqrt(a));
        distanceKm = Math.round(distanceKm * 10) / 10;
      }

      // Composite score (higher = better)
      const coverageScore = { city_district: 40, city: 30, region: 15, fallback: 0 }[coverageMatch];
      const availabilityScore = insp.availability_status === "available" ? 20 : insp.availability_status === "busy" ? 5 : 0;
      const workloadRatio = insp.max_concurrent_tasks > 0
        ? 1 - ((insp.current_workload || 0) / insp.max_concurrent_tasks)
        : 0;
      const workloadScore = workloadRatio * 15;
      const distanceScore = distanceKm !== null ? Math.max(0, 15 - (distanceKm / 20)) : 5;
      const qualityScore = ((insp.quality_score || 5) / 5) * 10;

      const totalScore = coverageScore + availabilityScore + workloadScore + distanceScore + qualityScore;

      // Get inspector cities/districts names for display
      const inspCityNames = inspCityIds.map(id => cityMap.get(id)?.name_ar).filter(Boolean) as string[];
      const inspDistrictNames = inspDistrictIds.map(id => districtMap.get(id)?.name_ar).filter(Boolean) as string[];

      matches.push({
        inspector_profile_id: insp.id,
        user_id: insp.user_id,
        full_name_ar: profileMap.get(insp.user_id) || "معاين",
        availability_status: insp.availability_status,
        current_workload: insp.current_workload || 0,
        max_concurrent_tasks: insp.max_concurrent_tasks || 5,
        quality_score: insp.quality_score || 5,
        total_completed: insp.total_completed || 0,
        coverage_match: coverageMatch,
        distance_km: distanceKm,
        score: Math.round(totalScore * 10) / 10,
        cities: inspCityNames,
        districts: inspDistrictNames,
      });
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    const recommended = matches.length > 0 ? matches[0] : null;
    const alternatives = matches.slice(1, 5);
    const fallbackNeeded = !recommended || recommended.coverage_match === "fallback";

    return new Response(JSON.stringify({
      recommended,
      alternatives,
      fallback_needed: fallbackNeeded,
      total_inspectors: matches.length,
      property_location: { city: property_city_ar, district: property_district_ar, lat: targetLat, lon: targetLon },
      message: fallbackNeeded
        ? "لا يوجد معاين يغطي هذه المنطقة — يرجى التعيين يدوياً"
        : `المعاين الموصى به: ${recommended?.full_name_ar} (تطابق: ${recommended?.coverage_match})`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
