import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Base pricing table (SAR)
const BASE_PRICES: Record<string, Record<string, number>> = {
  residential: { small: 2500, medium: 3500, large: 5000 },
  commercial: { small: 4000, medium: 6000, large: 9000 },
  industrial: { small: 5000, medium: 8000, large: 12000 },
  land: { small: 2000, medium: 3000, large: 4500 },
  mixed: { small: 5500, medium: 8000, large: 12000 },
};

// City complexity multipliers
const CITY_MULTIPLIERS: Record<string, number> = {
  الرياض: 1.0,
  جدة: 1.05,
  الدمام: 0.95,
  مكة: 1.1,
  المدينة: 1.0,
};

function getSizeCategory(area: number): string {
  if (area <= 300) return "small";
  if (area <= 1000) return "medium";
  return "large";
}

function calculateBasePrice(propertyType: string, area: number, city: string): {
  basePrice: number;
  sizeCategory: string;
  cityMultiplier: number;
} {
  const category = propertyType.includes("سكني") || propertyType.includes("فيلا") || propertyType.includes("شقة")
    ? "residential"
    : propertyType.includes("تجاري")
    ? "commercial"
    : propertyType.includes("صناعي")
    ? "industrial"
    : propertyType.includes("أرض")
    ? "land"
    : "residential";

  const sizeCategory = getSizeCategory(area);
  const base = BASE_PRICES[category]?.[sizeCategory] ?? 3500;
  const cityMultiplier = CITY_MULTIPLIERS[city] ?? 1.0;

  return { basePrice: base, sizeCategory, cityMultiplier };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { extractedData } = await req.json();
    if (!extractedData) {
      return new Response(JSON.stringify({ error: "Missing extractedData" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate base pricing
    const area = parseFloat(extractedData.asset?.area || "0") || 500;
    const city = extractedData.asset?.city || "الرياض";
    const propertyDesc = extractedData.asset?.description || "عقار سكني";
    const hasRental = extractedData.extractedNumbers?.some((n: any) => n.label?.includes("إيجار"));
    const purpose = extractedData.suggestedPurpose || "تقييم عام";

    const { basePrice, sizeCategory, cityMultiplier } = calculateBasePrice(propertyDesc, area, city);

    // Build AI prompt
    const systemPrompt = `أنت خبير تقييم عقاري سعودي معتمد من الهيئة السعودية للمقيّمين المعتمدين (تقييم).
مهمتك: توليد نطاق عمل تفصيلي وتعديل التسعير بناءً على البيانات المستخرجة من المستندات.

أجب بصيغة JSON فقط وفق الهيكل التالي:
{
  "scope": {
    "valuationType": "نوع التقييم (مثل: تقييم عقاري سكني)",
    "valuationStandard": "المعيار المتبع (مثل: IVS 2025 + معايير تقييم السعودية)",
    "valuationBasis": "أساس القيمة (مثل: القيمة السوقية)",
    "approaches": ["المنهجيات المقترحة"],
    "primaryApproach": "المنهجية الرئيسية",
    "inspectionType": "نوع المعاينة (مثل: معاينة ميدانية شاملة)",
    "deliverables": ["المخرجات المطلوبة"],
    "estimatedDays": 5,
    "assumptions": ["الافتراضات"],
    "limitations": ["القيود"],
    "requiredDocuments": ["المستندات المطلوبة الإضافية إن وجدت"],
    "specialConsiderations": ["اعتبارات خاصة إن وجدت"]
  },
  "pricingAdjustments": {
    "complexityFactor": 1.0,
    "complexityReason": "سبب معامل التعقيد",
    "urgencyFactor": 1.0,
    "portfolioDiscount": 0,
    "rentalAnalysisSurcharge": 0,
    "additionalServices": [{"name": "اسم الخدمة", "price": 0}],
    "totalAdjustmentFactor": 1.0,
    "justification": "تبرير التسعير النهائي"
  }
}`;

    const userPrompt = `بيانات الطلب المستخرجة:
- نوع العقار: ${propertyDesc}
- المدينة: ${city}
- المساحة: ${area} م²
- فئة المساحة: ${sizeCategory === "small" ? "صغير" : sizeCategory === "medium" ? "متوسط" : "كبير"}
- رقم الصك: ${extractedData.asset?.deedNumber || "غير متوفر"}
- التصنيف: ${extractedData.asset?.classification || "غير محدد"}
- غرض التقييم: ${purpose}
- يوجد عقد إيجار: ${hasRental ? "نعم" : "لا"}
- بيانات إضافية: ${JSON.stringify(extractedData.extractedNumbers?.map((n: any) => `${n.label}: ${n.value}`) || [])}
- اسم العميل: ${extractedData.client?.clientName || "غير متوفر"}

السعر الأساسي المحسوب: ${basePrice} ر.س (معامل المدينة: ${cityMultiplier})

قم بتوليد نطاق العمل التفصيلي وتعديلات التسعير بناءً على تعقيد الطلب.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_scope_and_pricing",
              description: "Generate valuation scope of work and pricing adjustments",
              parameters: {
                type: "object",
                properties: {
                  scope: {
                    type: "object",
                    properties: {
                      valuationType: { type: "string" },
                      valuationStandard: { type: "string" },
                      valuationBasis: { type: "string" },
                      approaches: { type: "array", items: { type: "string" } },
                      primaryApproach: { type: "string" },
                      inspectionType: { type: "string" },
                      deliverables: { type: "array", items: { type: "string" } },
                      estimatedDays: { type: "number" },
                      assumptions: { type: "array", items: { type: "string" } },
                      limitations: { type: "array", items: { type: "string" } },
                      requiredDocuments: { type: "array", items: { type: "string" } },
                      specialConsiderations: { type: "array", items: { type: "string" } },
                    },
                    required: ["valuationType", "valuationStandard", "valuationBasis", "approaches", "primaryApproach", "inspectionType", "deliverables", "estimatedDays", "assumptions", "limitations"],
                  },
                  pricingAdjustments: {
                    type: "object",
                    properties: {
                      complexityFactor: { type: "number" },
                      complexityReason: { type: "string" },
                      urgencyFactor: { type: "number" },
                      portfolioDiscount: { type: "number" },
                      rentalAnalysisSurcharge: { type: "number" },
                      additionalServices: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            price: { type: "number" },
                          },
                          required: ["name", "price"],
                        },
                      },
                      totalAdjustmentFactor: { type: "number" },
                      justification: { type: "string" },
                    },
                    required: ["complexityFactor", "complexityReason", "totalAdjustmentFactor", "justification"],
                  },
                },
                required: ["scope", "pricingAdjustments"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_scope_and_pricing" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "رصيد غير كافٍ، يرجى شحن الرصيد" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let aiData;
    if (toolCall?.function?.arguments) {
      aiData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      // Fallback: try parsing from content
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // Calculate final price
    const adjustments = aiData.pricingAdjustments || {};
    const adjustedBase = Math.round(basePrice * cityMultiplier);
    const complexityAdj = Math.round(adjustedBase * ((adjustments.complexityFactor || 1) - 1));
    const urgencyAdj = Math.round(adjustedBase * ((adjustments.urgencyFactor || 1) - 1));
    const rentalAdj = adjustments.rentalAnalysisSurcharge || 0;
    const portfolioDisc = adjustments.portfolioDiscount || 0;
    const additionalTotal = (adjustments.additionalServices || []).reduce((sum: number, s: any) => sum + (s.price || 0), 0);
    const totalPrice = adjustedBase + complexityAdj + urgencyAdj + rentalAdj - portfolioDisc + additionalTotal;

    const result = {
      scope: aiData.scope,
      pricing: {
        basePrice,
        cityMultiplier,
        adjustedBase,
        sizeCategory: sizeCategory === "small" ? "صغير" : sizeCategory === "medium" ? "متوسط" : "كبير",
        breakdown: {
          complexityAdjustment: complexityAdj,
          complexityFactor: adjustments.complexityFactor || 1,
          complexityReason: adjustments.complexityReason || "",
          urgencyAdjustment: urgencyAdj,
          urgencyFactor: adjustments.urgencyFactor || 1,
          rentalAnalysisSurcharge: rentalAdj,
          portfolioDiscount: portfolioDisc,
          additionalServices: adjustments.additionalServices || [],
          additionalTotal,
        },
        totalPrice,
        justification: adjustments.justification || "",
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-scope-pricing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
