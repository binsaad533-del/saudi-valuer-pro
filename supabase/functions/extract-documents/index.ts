import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { fileNames, fileDescriptions, storagePaths, requestId: _requestId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // If storage paths provided, download actual file content for multimodal analysis
    let fileContents: { name: string; base64: string; mimeType: string }[] = [];

    if (storagePaths && storagePaths.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const sp of storagePaths) {
        try {
          const { data, error } = await supabase.storage
            .from("client-uploads")
            .download(sp.path);
          if (error || !data) continue;

          const arrayBuf = await data.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), "")
          );
          const mimeType = sp.mimeType || "application/octet-stream";

          // Only include supported types for vision (images, PDFs)
          const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
          if (supportedTypes.some(t => mimeType.startsWith(t.split("/")[0]) || mimeType === t)) {
            fileContents.push({ name: sp.name, base64, mimeType });
          }
        } catch (e) {
          console.error(`Failed to download ${sp.path}:`, e);
        }
      }
    }

    const systemPrompt = `أنت محرك استخراج بيانات متقدم متخصص في التقييم العقاري والآلات والمعدات في المملكة العربية السعودية.

مهمتك: تحليل المستندات المرفوعة (صور، PDF، وثائق) واستخراج:

1. **نوع التقييم** (real_estate / machinery / mixed) مع مستوى الثقة
2. **بيانات العميل**: الاسم، رقم الهوية/السجل التجاري، الهاتف، البريد
3. **بيانات الأصل**: الوصف، المدينة، الحي، المساحة، رقم الصك، التصنيف، وبيانات الآلة/المعدة مثل الاسم والشركة المصنعة والموديل
4. **تصنيف كل مستند**: نوعه (صك، رخصة بناء، مخطط، فاتورة، عقد، صورة أصل عقاري، صورة آلة/معدة، هوية، تقرير فني، أخرى)
5. **غرض التقييم** المحتمل
6. **البيانات المستخرجة من المحتوى**: أرقام، تواريخ، أسماء، عناوين ظاهرة في الوثائق

قواعد التصنيف:
- صك / صك إلكتروني = deed
- رخصة بناء / تصريح = building_permit
- مخطط معماري / كروكي = floor_plan
- صورة مبنى / أرض / واجهة / أصل عقاري = property_photo
- صورة حفار / شيول / مولد / خط إنتاج / رافعة / شاحنة / معدة ثقيلة / آلة صناعية / معدة ورشة = machinery_photo
- هوية / جواز / إقامة = identity_doc
- فاتورة / سند = invoice
- عقد / اتفاقية = contract
- تقرير فني / تقييم سابق = technical_report
- خريطة / موقع = location_map
- أخرى = other

قواعد حاسمة لتحديد نوع التقييم:
- إذا كانت الصور أو المستندات تخص آلات أو معدات فقط ولا توجد مؤشرات عقارية واضحة (مثل صك، أرض، مبنى، مخطط، رخصة بناء) فصنّف الطلب = machinery
- لا تعتبر أي صورة لمعدة أو آلة على أنها property_photo لمجرد أنها صورة
- استخدم mixed فقط عند وجود أدلة واضحة على وجود أصل عقاري + آلات/معدات معاً
- عند الشك بين real_estate و machinery بسبب الصور، أعط الأفضلية للمحتوى المرئي الفعلي داخل الصورة وليس لاسم الملف العام مثل WhatsApp Image

قواعد الأولوية:
- إذا وُجد محتوى فعلي (صور/PDF) = حلل المحتوى بعمق واستخرج كل البيانات الممكنة
- إذا أسماء ملفات فقط = استنتج من الأسماء
- أعط نسبة ثقة أعلى عند تحليل المحتوى الفعلي`;

    // Build messages with multimodal content
    const userContent: any[] = [];

    if (fileContents.length > 0) {
      userContent.push({
        type: "text",
        text: `تم رفع ${fileNames.length} مستند. قم بتحليل محتوى المستندات التالية واستخرج جميع البيانات:`,
      });

      for (const fc of fileContents) {
        userContent.push({
          type: "text",
          text: `\n--- ملف: ${fc.name} ---`,
        });

        if (fc.mimeType.startsWith("image/")) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: `data:${fc.mimeType};base64,${fc.base64}`,
            },
          });
        } else if (fc.mimeType === "application/pdf") {
          // For PDFs, send as base64 with instruction
          userContent.push({
            type: "text",
            text: `[ملف PDF - ${fc.name}] - حلل محتوى هذا الملف بناءً على اسمه ووصفه`,
          });
        }
      }

      // Add files that couldn't be downloaded
      const analyzedNames = fileContents.map(f => f.name);
      const remaining = fileNames.filter((n: string) => !analyzedNames.includes(n));
      if (remaining.length > 0) {
        userContent.push({
          type: "text",
          text: `\nملفات إضافية (أسماء فقط):\n${remaining.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}`,
        });
      }
    } else {
      userContent.push({
        type: "text",
        text: `الملفات المرفوعة (${fileNames.length} ملف):\n${fileNames.map((name: string, i: number) => `${i + 1}. ${name}${fileDescriptions?.[i] ? ` — ${fileDescriptions[i]}` : ""}`).join("\n")}\n\nقم بتحليل هذه الملفات واستخرج البيانات المتاحة.`,
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
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
                          category: {
                            type: "string",
                            enum: [
                              "deed", "building_permit", "floor_plan",
                              "property_photo", "machinery_photo", "identity_doc", "invoice",
                              "contract", "technical_report", "location_map", "other",
                            ],
                          },
                          categoryLabel: { type: "string", description: "Arabic label for the category" },
                          relevance: { type: "string", enum: ["high", "medium", "low"] },
                          extractedInfo: {
                            type: "string",
                            description: "Key info extracted from this specific document in Arabic",
                          },
                        },
                        required: ["fileName", "category", "categoryLabel", "relevance"],
                      },
                    },
                    extractedNumbers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string", description: "What this number represents in Arabic" },
                          value: { type: "string" },
                          source: { type: "string", description: "Which document this was extracted from" },
                        },
                        required: ["label", "value", "source"],
                      },
                      description: "Key numbers, dates, and identifiers extracted from documents",
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
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "خطأ في التحليل الذكي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "لم يتم استخراج بيانات" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Add metadata about analysis method
    extracted.analysisMethod = fileContents.length > 0 ? "content_analysis" : "filename_only";
    extracted.analyzedFilesCount = fileContents.length;
    extracted.totalFilesCount = fileNames.length;

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
