import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const { files, excelSample } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error("files array required");
    }

    const fileList = files.map((f: any) => `- ${f.name} (${f.mimeType || f.type || "unknown"})`).join("\n");

    const prompt = `You are an asset classification expert for a professional valuation firm in Saudi Arabia.

Based on the uploaded file names and any sample data provided, determine the asset type for this valuation request.

Files uploaded:
${fileList}

${excelSample ? `Sample data from Excel files:\n${excelSample}` : ""}

Classify the assets into ONE of these categories:
- "real_estate" — if files relate to land, buildings, apartments, villas, real estate properties
- "machinery_equipment" — if files relate to machinery, equipment, vehicles, industrial assets, furniture, electronics
- "both" — if files contain a mix of real estate AND machinery/equipment assets

Consider these hints:
- PDF files with names like "صك", "deed", "title", "عقد", "إيجار", "lease", "مخطط", "plan" → real_estate
- PDF/images of buildings, properties, land → real_estate  
- Excel files with columns like "manufacturer", "model", "serial", "الشركة المصنعة", "الموديل", "رقم تسلسلي" → machinery_equipment
- Excel files with columns like "مساحة", "area", "طابق", "floor", "غرف", "rooms" → real_estate
- Mixed content → both

Respond ONLY with a JSON object: {"asset_type": "real_estate" | "machinery_equipment" | "both", "confidence": 0-100, "reason_ar": "..."}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You classify uploaded files for a valuation firm. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      console.error("AI error:", resp.status);
      return new Response(
        JSON.stringify({ asset_type: "real_estate", confidence: 30, reason_ar: "تعذر التحليل — تم اختيار عقار كافتراضي" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await resp.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { asset_type: "real_estate", confidence: 30, reason_ar: "تعذر تحليل الرد" };
    }

    // Validate
    const validTypes = ["real_estate", "machinery_equipment", "both"];
    if (!validTypes.includes(result.asset_type)) {
      result.asset_type = "real_estate";
      result.confidence = 30;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-asset-type error:", e);
    return new Response(
      JSON.stringify({ asset_type: "real_estate", confidence: 20, reason_ar: "خطأ في التصنيف" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
