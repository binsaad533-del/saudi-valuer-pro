import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Base pricing table (SAR) ───
const BASE_PRICES: Record<string, Record<string, number>> = {
  residential_villa:   { small: 3000, medium: 4500, large: 7000, xlarge: 10000 },
  residential_apt:     { small: 2000, medium: 3000, large: 4500, xlarge: 6500 },
  residential_complex: { small: 5000, medium: 8000, large: 12000, xlarge: 18000 },
  commercial_retail:   { small: 4000, medium: 6000, large: 9000, xlarge: 14000 },
  commercial_office:   { small: 4500, medium: 7000, large: 10000, xlarge: 15000 },
  commercial_mall:     { small: 8000, medium: 12000, large: 18000, xlarge: 25000 },
  industrial:          { small: 5000, medium: 8000, large: 12000, xlarge: 18000 },
  land_residential:    { small: 2000, medium: 3000, large: 4500, xlarge: 6000 },
  land_commercial:     { small: 3000, medium: 4500, large: 7000, xlarge: 10000 },
  land_raw:            { small: 1500, medium: 2500, large: 4000, xlarge: 5500 },
  mixed:               { small: 5500, medium: 8000, large: 12000, xlarge: 18000 },
  farm:                { small: 3000, medium: 5000, large: 8000, xlarge: 12000 },
  hotel:               { small: 8000, medium: 14000, large: 22000, xlarge: 35000 },
};

// ─── City multipliers ───
const CITY_MULTIPLIERS: Record<string, number> = {
  الرياض: 1.0, جدة: 1.08, الدمام: 0.95, الخبر: 0.95, الظهران: 0.95,
  مكة: 1.15, المدينة: 1.05, الطائف: 0.90, تبوك: 0.85, أبها: 0.85,
  جازان: 0.80, نجران: 0.80, حائل: 0.80, القصيم: 0.85, بريدة: 0.85,
  ينبع: 0.90, الجبيل: 0.90,
};

// ─── Purpose multipliers ───
const PURPOSE_MULTIPLIERS: Record<string, number> = {
  "تمويل عقاري": 1.0,
  "شراء": 1.0,
  "بيع": 1.0,
  "رهن": 1.05,
  "تقسيم تركة": 1.10,
  "فض نزاع": 1.15,
  "حكم قضائي": 1.20,
  "تصفية": 1.10,
  "محاسبة": 1.05,
  "تأمين": 1.0,
  "استثمار": 1.05,
  "إعادة تقييم": 0.85,
};

function classifyProperty(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("فيلا") || d.includes("فله")) return "residential_villa";
  if (d.includes("شقة") || d.includes("شقق")) return "residential_apt";
  if (d.includes("مجمع سكني") || d.includes("عمارة سكنية")) return "residential_complex";
  if (d.includes("محل") || d.includes("معرض") || d.includes("تجزئة")) return "commercial_retail";
  if (d.includes("مكتب") || d.includes("مكاتب")) return "commercial_office";
  if (d.includes("مول") || d.includes("مجمع تجاري") || d.includes("سوق")) return "commercial_mall";
  if (d.includes("مصنع") || d.includes("صناعي") || d.includes("ورشة") || d.includes("مستودع")) return "industrial";
  if (d.includes("أرض تجاري")) return "land_commercial";
  if (d.includes("أرض خام") || d.includes("أرض زراعي")) return "land_raw";
  if (d.includes("أرض")) return "land_residential";
  if (d.includes("فندق") || d.includes("فنادق")) return "hotel";
  if (d.includes("مزرعة") || d.includes("استراحة")) return "farm";
  if (d.includes("متعدد") || d.includes("مختلط")) return "mixed";
  if (d.includes("سكني") || d.includes("منزل") || d.includes("بيت")) return "residential_villa";
  if (d.includes("تجاري")) return "commercial_retail";
  return "residential_villa";
}

function getSizeCategory(area: number): string {
  if (area <= 200) return "small";
  if (area <= 800) return "medium";
  if (area <= 3000) return "large";
  return "xlarge";
}

function findPurposeMultiplier(purpose: string): number {
  for (const [key, val] of Object.entries(PURPOSE_MULTIPLIERS)) {
    if (purpose.includes(key)) return val;
  }
  return 1.0;
}

function calculateBasePrice(propertyDesc: string, area: number, city: string, purpose: string) {
  const category = classifyProperty(propertyDesc);
  const sizeCategory = getSizeCategory(area);
  const base = BASE_PRICES[category]?.[sizeCategory] ?? BASE_PRICES["residential_villa"][sizeCategory] ?? 3500;
  const cityMultiplier = CITY_MULTIPLIERS[city] ?? 1.0;
  const purposeMultiplier = findPurposeMultiplier(purpose);

  return { basePrice: base, sizeCategory, cityMultiplier, purposeMultiplier, category };
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

    const area = parseFloat(extractedData.asset?.area || "0") || 500;
    const city = extractedData.asset?.city || "الرياض";
    const propertyDesc = extractedData.asset?.description || "عقار سكني";
    const purpose = extractedData.suggestedPurpose || "تقييم عام";
    const hasRental = extractedData.extractedNumbers?.some((n: any) =>
      n.label?.includes("إيجار") || n.label?.includes("ريع")
    );
    const hasMultipleUnits = extractedData.extractedNumbers?.some((n: any) =>
      n.label?.includes("وحد") || n.label?.includes("شقة") || n.label?.includes("محل")
    );

    const { basePrice, sizeCategory, cityMultiplier, purposeMultiplier, category } =
      calculateBasePrice(propertyDesc, area, city, purpose);

    // ─── Enhanced AI prompt ───
    const systemPrompt = `أنت خبير تقييم عقاري سعودي معتمد من الهيئة السعودية للمقيّمين المعتمدين (تقييم) بخبرة 15+ سنة.

## مهمتك
تحليل بيانات طلب التقييم وتوليد:
1. **تحليل نوع التقييم**: تحديد ما إذا كان الطلب تقييم عقاري أو آلات ومعدات أو مختلط، مع نسبة ثقة وإشارات من المستندات.
2. **تحليل الغرض من التقييم**: تحديد الغرض من التقييم (تمويل بنكي / بيع وشراء / تأمين / تقسيم تركة / فض نزاع / حكم قضائي / محاسبة / استثمار / إعادة تقييم / تصفية / رهن) بناءً على المستندات المرفقة ونوع العميل. اذكر جميع الأغراض المحتملة مع نسب الثقة.
3. نطاق عمل تفصيلي يتوافق مع معايير التقييم الدولية IVS 2025 ومعايير تقييم السعودية.
4. تعديلات تسعير مبنية على تعقيد الطلب الفعلي.

## قواعد تحديد الغرض من التقييم (purposeAnalysis)
- حدد الغرض الرئيسي بناءً على المستندات (مثلاً: خطاب بنك = تمويل بنكي، أمر محكمة = حكم قضائي)
- حدد أغراض محتملة أخرى بنسب ثقة أقل
- اذكر السبب لكل غرض (مثل: "وجود خطاب من بنك الراجحي يطلب تقييم الضمان العقاري")
- الأغراض المتاحة: تمويل بنكي، بيع وشراء، تأمين، تقسيم تركة، فض نزاع، حكم قضائي، محاسبة/قوائم مالية، استثمار، إعادة تقييم، تصفية، رهن

## قواعد تحديد نوع التقييم (discipline)
- **عقاري (real_estate)**: أراضي، فلل، شقق، عمائر، مباني تجارية، فنادق، مزارع
- **آلات ومعدات (machinery)**: معدات صناعية، مصانع، خطوط إنتاج، مركبات، أصول متحركة
- **مختلط (mixed)**: مصنع مع أرضه، فندق مع تجهيزاته، مجمع تجاري مع معداته
- حدد الإشارات (signals) التي استخدمتها في التصنيف من المستندات
- حدد الأنواع الفرعية (subTypes) مثل: فيلا سكنية، أرض تجارية، معدات ثقيلة...

## قواعد اختيار المنهجيات
- **أسلوب السوق (المقارنة)**: دائماً أساسي للعقارات السكنية والأراضي. يُستخدم كأسلوب ثانوي للتجاري.
- **أسلوب الدخل (الرسملة/التدفقات)**: أساسي للعقارات التجارية المؤجرة والفنادق. ثانوي إن وُجد عقد إيجار.
- **أسلوب التكلفة (الإحلال)**: أساسي للعقارات الصناعية والمنشآت الخاصة. ثانوي كدعم.
- يجب استخدام منهجيتين على الأقل في كل تقييم.

## قواعد أساس القيمة (basisOfValueAnalysis)
- حدد أساس القيمة الرئيسي بناءً على الغرض والمستندات مع المرجع المعياري
- "تمويل/رهن/شراء/بيع/تأمين" → القيمة السوقية (Market Value) — IVS 104.20
- "تصفية/فض نزاع" → قيمة التصفية المنظمة (Orderly Liquidation Value) — IVS 104.80
- "حكم قضائي/تقسيم تركة" → القيمة السوقية مع تبرير مفصل — IVS 104.20
- "محاسبة/قوائم مالية" → القيمة العادلة (Fair Value - IFRS 13) — IVS 104.50
- "استثمار" → قيمة الاستثمار (Investment Value) — IVS 104.60
- "تأمين" → قيمة التأمين (Insurable Value)
- "إيجار" → قيمة الإيجار السوقي (Market Rent) — IVS 104.40
- حدد جميع أسس القيمة المحتملة الأخرى مع نسب ثقة وأسباب

## قواعد التسعير
- معامل التعقيد (complexityFactor): من 1.0 إلى 1.5
  - 1.0: عقار عادي، وثائق كاملة
  - 1.1-1.2: تعدد وحدات، موقع مميز، وثائق ناقصة
  - 1.2-1.3: عقار مختلط الاستخدام، نزاع قائم
  - 1.3-1.5: عقار خاص (فندق/مصنع)، تقييم قضائي
- معامل الاستعجال: 1.0 عادي، 1.3 مستعجل (أقل من 3 أيام)، 1.5 فوري (يوم واحد)
- رسوم تحليل الإيجار: 500-2000 ر.س حسب عدد العقود
- خصم المحفظة: 5-15% لأكثر من 3 عقارات

## ملاحظات مهمة
- الافتراضات يجب أن تشمل: صحة المستندات، حالة السوق، الحقوق القانونية
- القيود يجب أن تشمل: نطاق المعاينة، مصادر المعلومات، التحفظات
- المخرجات: تقرير عربي + ملخص تنفيذي + شهادة قيمة كحد أدنى`;

    const buildingInfo = extractedData.building
      ? `\n- مساحة البناء: ${extractedData.building?.buildingArea || "—"} م²
- عدد الطوابق: ${extractedData.building?.floors || "—"}
- عدد الغرف: ${extractedData.building?.rooms || "—"}
- عمر البناء: ${extractedData.building?.age || "—"} سنة`
      : "";

    const rentalInfo = hasRental
      ? `\n- بيانات الإيجار: ${extractedData.extractedNumbers
          ?.filter((n: any) => n.label?.includes("إيجار") || n.label?.includes("ريع"))
          .map((n: any) => `${n.label}: ${n.value}`)
          .join("، ") || "متوفرة"}`
      : "";

    const userPrompt = `بيانات الطلب المستخرجة من المستندات:
━━━ بيانات العقار ━━━
- نوع العقار: ${propertyDesc}
- التصنيف المحدد: ${category}
- المدينة: ${city}
- الحي: ${extractedData.asset?.district || "غير محدد"}
- المساحة الإجمالية: ${area} م²
- فئة المساحة: ${sizeCategory === "small" ? "صغير (≤200م²)" : sizeCategory === "medium" ? "متوسط (201-800م²)" : sizeCategory === "large" ? "كبير (801-3000م²)" : "كبير جداً (>3000م²)"}
- رقم الصك: ${extractedData.asset?.deedNumber || "غير متوفر"}
- التصنيف العقاري: ${extractedData.asset?.classification || "غير محدد"}${buildingInfo}

━━━ بيانات العميل والغرض ━━━
- اسم العميل: ${extractedData.client?.clientName || "غير متوفر"}
- نوع العميل: ${extractedData.client?.clientType || "غير محدد"}
- غرض التقييم: ${purpose}
- يوجد عقد إيجار: ${hasRental ? "نعم" : "لا"}
- تعدد وحدات: ${hasMultipleUnits ? "نعم" : "لا"}${rentalInfo}

━━━ بيانات رقمية مستخرجة ━━━
${extractedData.extractedNumbers?.map((n: any) => `- ${n.label}: ${n.value} (ثقة: ${n.confidence || "—"}%)`).join("\n") || "لا توجد بيانات رقمية إضافية"}

━━━ التسعير الأساسي المحسوب ━━━
- السعر الأساسي: ${basePrice} ر.س
- معامل المدينة: ×${cityMultiplier}
- معامل الغرض: ×${purposeMultiplier}
- السعر بعد المعاملات: ${Math.round(basePrice * cityMultiplier * purposeMultiplier)} ر.س

قم بتوليد نطاق العمل التفصيلي وتعديلات التسعير المناسبة.`;

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
              description: "Generate detailed valuation scope of work and pricing adjustments based on Saudi TAQEEM standards and IVS 2025",
              parameters: {
                type: "object",
                properties: {
                  disciplineAnalysis: {
                    type: "object",
                    properties: {
                      discipline: { type: "string", enum: ["real_estate", "machinery", "mixed"], description: "نوع التقييم: عقاري أو آلات أو مختلط" },
                      disciplineLabel: { type: "string", description: "اسم النوع بالعربي" },
                      confidence: { type: "number", description: "نسبة الثقة 0-100" },
                      reason: { type: "string", description: "سبب التصنيف مثل: تم تحديد تقييم عقاري بناءً على: صك ملكية + رخصة بناء + مخطط معماري" },
                      signals: { type: "array", items: { type: "string" }, description: "إشارات التصنيف المكتشفة من المستندات" },
                      subTypes: { type: "array", items: { type: "string" }, description: "الأنواع الفرعية المحددة" },
                    },
                    required: ["discipline", "disciplineLabel", "confidence", "reason", "signals"],
                  },
                  purposeAnalysis: {
                    type: "object",
                    properties: {
                      selectedPurpose: { type: "string", description: "الغرض الرئيسي المحدد مثل: تمويل بنكي" },
                      confidence: { type: "number", description: "نسبة الثقة 0-100" },
                      reason: { type: "string", description: "سبب تحديد هذا الغرض مثل: وجود خطاب من بنك الراجحي يطلب تقييم الضمان العقاري" },
                      allPurposes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string", description: "معرف الغرض" },
                            label: { type: "string", description: "اسم الغرض بالعربي" },
                            confidence: { type: "number", description: "نسبة الثقة 0-100" },
                            reason: { type: "string", description: "سبب مختصر" },
                          },
                          required: ["key", "label", "confidence", "reason"],
                        },
                        description: "جميع الأغراض المحتملة مرتبة حسب الثقة (3-5 أغراض)"
                      },
                    },
                    required: ["selectedPurpose", "confidence", "reason", "allPurposes"],
                  },
                  basisOfValueAnalysis: {
                    type: "object",
                    properties: {
                      selectedBasis: { type: "string", description: "أساس القيمة الرئيسي بالعربي مثل: القيمة السوقية" },
                      selectedBasisEn: { type: "string", description: "أساس القيمة بالإنجليزي مثل: Market Value" },
                      confidence: { type: "number", description: "نسبة الثقة 0-100" },
                      reason: { type: "string", description: "سبب اختيار أساس القيمة مثل: بناءً على غرض التمويل البنكي يتطلب تحديد القيمة السوقية وفق IVS 104" },
                      ivsReference: { type: "string", description: "المرجع المعياري مثل: IVS 104.20 - القيمة السوقية" },
                      allBases: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string", description: "اسم أساس القيمة بالعربي" },
                            labelEn: { type: "string", description: "اسم أساس القيمة بالإنجليزي" },
                            confidence: { type: "number" },
                            reason: { type: "string" },
                            ivsReference: { type: "string" },
                          },
                          required: ["key", "label", "labelEn", "confidence", "reason"],
                        },
                        description: "جميع أسس القيمة المحتملة (3-5 أسس)"
                      },
                    },
                    required: ["selectedBasis", "selectedBasisEn", "confidence", "reason", "ivsReference", "allBases"],
                  },
                  scope: {
                    type: "object",
                    properties: {
                      valuationType: { type: "string", description: "نوع التقييم بالتفصيل" },
                      valuationStandard: { type: "string", description: "المعيار المتبع مثل IVS 2025" },
                      valuationBasis: { type: "string", description: "أساس القيمة (سوقية/عادلة/تصفية)" },
                      approaches: { type: "array", items: { type: "string" }, description: "جميع المنهجيات المقترحة" },
                      primaryApproach: { type: "string", description: "المنهجية الرئيسية" },
                      secondaryApproach: { type: "string", description: "المنهجية الثانوية" },
                      approachJustification: { type: "string", description: "تبرير اختيار المنهجيات" },
                      inspectionType: { type: "string", description: "نوع المعاينة الميدانية" },
                      inspectionRequirements: { type: "array", items: { type: "string" }, description: "متطلبات المعاينة التفصيلية" },
                      deliverables: { type: "array", items: { type: "string" }, description: "المخرجات المطلوبة" },
                      estimatedDays: { type: "number", description: "المدة المتوقعة بالأيام" },
                      assumptions: { type: "array", items: { type: "string" }, description: "الافتراضات" },
                      limitations: { type: "array", items: { type: "string" }, description: "القيود والتحفظات" },
                      requiredDocuments: { type: "array", items: { type: "string" }, description: "المستندات المطلوبة الإضافية" },
                      specialConsiderations: { type: "array", items: { type: "string" }, description: "اعتبارات خاصة" },
                      complianceNotes: { type: "array", items: { type: "string" }, description: "ملاحظات الامتثال والتنظيم" },
                    },
                    required: [
                      "valuationType", "valuationStandard", "valuationBasis",
                      "approaches", "primaryApproach", "secondaryApproach", "approachJustification",
                      "inspectionType", "deliverables", "estimatedDays",
                      "assumptions", "limitations"
                    ],
                  },
                  pricingAdjustments: {
                    type: "object",
                    properties: {
                      complexityFactor: { type: "number", description: "معامل التعقيد 1.0-1.5" },
                      complexityReason: { type: "string", description: "سبب معامل التعقيد" },
                      urgencyFactor: { type: "number", description: "معامل الاستعجال 1.0-1.5" },
                      portfolioDiscount: { type: "number", description: "خصم المحفظة بالريال" },
                      rentalAnalysisSurcharge: { type: "number", description: "رسوم تحليل الإيجار بالريال" },
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
                      justification: { type: "string", description: "تبرير التسعير النهائي المفصل" },
                    },
                    required: ["complexityFactor", "complexityReason", "justification"],
                  },
                },
                required: ["disciplineAnalysis", "purposeAnalysis", "scope", "pricingAdjustments"],
                additionalProperties: false,
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "رصيد غير كافٍ، يرجى شحن الرصيد" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // ─── Calculate final price ───
    const adjustments = aiData.pricingAdjustments || {};
    const adjustedBase = Math.round(basePrice * cityMultiplier * purposeMultiplier);
    const complexityAdj = Math.round(adjustedBase * ((adjustments.complexityFactor || 1) - 1));
    const urgencyAdj = Math.round(adjustedBase * ((adjustments.urgencyFactor || 1) - 1));
    const rentalAdj = adjustments.rentalAnalysisSurcharge || 0;
    const portfolioDisc = adjustments.portfolioDiscount || 0;
    const additionalTotal = (adjustments.additionalServices || []).reduce(
      (sum: number, s: any) => sum + (s.price || 0), 0
    );
    const totalPrice = adjustedBase + complexityAdj + urgencyAdj + rentalAdj - portfolioDisc + additionalTotal;

    const result = {
      scope: {
        ...aiData.scope,
        disciplineAnalysis: aiData.disciplineAnalysis || {
          discipline: "real_estate",
          disciplineLabel: "تقييم عقاري",
          confidence: 70,
          reason: "تم تحديد تقييم عقاري بناءً على: وصف العقار في البيانات المستخرجة",
          signals: ["تصنيف افتراضي"],
          subTypes: [],
        },
        purposeAnalysis: aiData.purposeAnalysis || {
          selectedPurpose: purpose,
          confidence: 60,
          reason: "تم تحديد الغرض بناءً على البيانات المدخلة",
          allPurposes: [{ key: purpose, label: purpose, confidence: 60, reason: "غرض افتراضي" }],
        },
      },
      pricing: {
        basePrice,
        cityMultiplier,
        purposeMultiplier,
        adjustedBase,
        sizeCategory: sizeCategory === "small" ? "صغير" : sizeCategory === "medium" ? "متوسط" : sizeCategory === "large" ? "كبير" : "كبير جداً",
        propertyCategory: category,
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
