import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { archived_report_id, file_name } = await req.json();
    if (!archived_report_id) throw new Error("archived_report_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the archived report record
    const { data: report, error: rErr } = await supabase
      .from("archived_reports")
      .select("*")
      .eq("id", archived_report_id)
      .single();
    if (rErr || !report) throw new Error("Report not found");

    // Try to download and extract text from the file
    const { data: fileData } = await supabase.storage
      .from("archived-reports")
      .download(report.file_path);

    let extractedText = "";
    if (fileData) {
      // For PDFs, try to get some text from the first bytes
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Simple text extraction from PDF streams
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const rawText = decoder.decode(bytes);
      // Extract visible text between parentheses in PDF
      const textMatches = rawText.match(/\(([^)]{2,200})\)/g);
      if (textMatches) {
        extractedText = textMatches
          .map(m => m.slice(1, -1))
          .filter(t => t.length > 3 && /[\u0600-\u06FFa-zA-Z]/.test(t))
          .join(" ")
          .slice(0, 3000);
      }
    }

    // Use AI to extract metadata from filename + any extracted text
    const prompt = `أنت نظام استخراج بيانات تقارير التقييم العقاري. حلل اسم الملف والنص المستخرج واستخرج البيانات التالية.

اسم الملف: ${file_name || report.file_name}
النص المستخرج (إن وجد): ${extractedText.slice(0, 2000)}

استخرج البيانات التالية بأفضل تخمين ممكن:`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: "أنت نظام فهرسة تقارير تقييم عقاري سعودي. استخرج البيانات بدقة." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_report_metadata",
            description: "Extract report metadata from filename and text content",
            parameters: {
              type: "object",
              properties: {
                report_number: { type: "string", description: "رقم التقرير إن وجد" },
                report_title_ar: { type: "string", description: "عنوان التقرير بالعربي" },
                report_type: { type: "string", enum: ["real_estate", "machinery", "land", "commercial", "residential", "mixed", "other"], description: "نوع التقييم" },
                report_date: { type: "string", description: "تاريخ التقرير بصيغة YYYY-MM-DD إن وجد" },
                property_type: { type: "string", description: "نوع العقار (أرض، فيلا، شقة، مبنى تجاري، إلخ)" },
                property_city_ar: { type: "string", description: "المدينة بالعربي" },
                property_district_ar: { type: "string", description: "الحي بالعربي" },
                client_name_ar: { type: "string", description: "اسم العميل بالعربي" },
                tags: { type: "array", items: { type: "string" }, description: "وسوم وصفية" },
                confidence: { type: "number", description: "نسبة الثقة من 0 إلى 1" },
              },
              required: ["report_title_ar", "confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_report_metadata" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Update as not indexed with empty data
      await supabase
        .from("archived_reports")
        .update({ is_indexed: false, ai_confidence: 0 })
        .eq("id", archived_report_id);
      return new Response(JSON.stringify({ success: false, error: "AI extraction failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let metadata: Record<string, any> = {};

    if (toolCall?.function?.arguments) {
      metadata = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    }

    // Update the archived report with extracted metadata
    const updateData: Record<string, any> = {
      is_indexed: true,
      ai_confidence: metadata.confidence || 0,
      ai_extracted_data: metadata,
    };
    if (metadata.report_number) updateData.report_number = metadata.report_number;
    if (metadata.report_title_ar) updateData.report_title_ar = metadata.report_title_ar;
    if (metadata.report_type) updateData.report_type = metadata.report_type;
    if (metadata.report_date) updateData.report_date = metadata.report_date;
    if (metadata.property_type) updateData.property_type = metadata.property_type;
    if (metadata.property_city_ar) updateData.property_city_ar = metadata.property_city_ar;
    if (metadata.property_district_ar) updateData.property_district_ar = metadata.property_district_ar;
    if (metadata.client_name_ar) updateData.client_name_ar = metadata.client_name_ar;
    if (metadata.tags?.length) updateData.tags = metadata.tags;

    await supabase
      .from("archived_reports")
      .update(updateData)
      .eq("id", archived_report_id);

    return new Response(JSON.stringify({ success: true, metadata }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
