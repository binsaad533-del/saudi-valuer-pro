import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileNames, fileDescriptions } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `أنت محرك استخراج بيانات متخصص في التقييم العقاري والآلات والمعدات في السعودية.

مهمتك: بناءً على أسماء الملفات والوصف المقدم، استنتج وحدد:

1. نوع التقييم (real_estate / machinery / mixed)
2. بيانات العميل المحتملة
3. بيانات الأصل المحتملة
4. غرض التقييم المحتمل
5. أي ملاحظات أو توصيات

قواعد:
- إذا احتوت الملفات على "صك" أو "رخصة بناء" أو "مخطط" = عقاري
- إذا احتوت على "فاتورة شراء" أو "كتالوج" أو "صيانة" = آلات
- إذا مزيج = مختلط
- استخرج أي معلومات يمكن استنتاجها من أسماء الملفات`;

    const userMessage = `الملفات المرفوعة (${fileNames.length} ملف):
${fileNames.map((name: string, i: number) => `${i + 1}. ${name}${fileDescriptions?.[i] ? ` — ${fileDescriptions[i]}` : ""}`).join("\n")}

قم بتحليل هذه الملفات واستخرج البيانات المتاحة.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_valuation_data",
                description: "Extract structured valuation data from document analysis",
                parameters: {
                  type: "object",
                  properties: {
                    discipline: {
                      type: "string",
                      enum: ["real_estate", "machinery", "mixed"],
                      description: "Detected valuation type",
                    },
                    discipline_label: {
                      type: "string",
                      description: "Arabic label for the discipline",
                    },
                    confidence: {
                      type: "number",
                      description: "Confidence score 0-100",
                    },
                    client: {
                      type: "object",
                      properties: {
                        clientName: { type: "string" },
                        idNumber: { type: "string" },
                        phone: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                    asset: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        city: { type: "string" },
                        district: { type: "string" },
                        area: { type: "string" },
                        deedNumber: { type: "string" },
                        classification: { type: "string" },
                        machineName: { type: "string" },
                        manufacturer: { type: "string" },
                        model: { type: "string" },
                      },
                    },
                    suggestedPurpose: { type: "string" },
                    notes: {
                      type: "array",
                      items: { type: "string" },
                      description: "AI notes and recommendations in Arabic",
                    },
                    documentCategories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          fileName: { type: "string" },
                          category: { type: "string" },
                          relevance: { type: "string", enum: ["high", "medium", "low"] },
                        },
                        required: ["fileName", "category", "relevance"],
                      },
                    },
                  },
                  required: ["discipline", "discipline_label", "confidence", "notes", "documentCategories"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_valuation_data" } },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "خطأ في التحليل الذكي" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "لم يتم استخراج بيانات" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-documents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
