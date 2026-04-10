import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { knowledge_id, file_path } = await req.json();
    if (!knowledge_id || !file_path) {
      return new Response(
        JSON.stringify({ error: "knowledge_id and file_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("attachments")
      .download(file_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download file", details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64 for AI processing (chunk-safe for large files)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const mimeType = fileData.type || "application/pdf";

    // Use Gemini vision to extract text from the PDF
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `أنت أداة استخراج نصوص. استخرج كامل النص من المستند المرفق بدقة عالية.
- حافظ على ترتيب النص كما هو في المستند الأصلي.
- لا تضف أي تعليقات أو تلخيصات — فقط النص الأصلي كما هو.
- إذا كان المستند يحتوي على جداول، حاول تمثيلها بتنسيق نصي مقروء.
- استخرج أكبر قدر ممكن من النص.`
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: file_path.split("/").pop() || "document.pdf",
                  file_data: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "استخرج كامل النص من هذا المستند."
              }
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI extraction error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "تم تجاوز الحد المسموح، حاول لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const extractedText = aiResult.choices?.[0]?.message?.content || "";

    if (!extractedText || extractedText.length < 10) {
      return new Response(
        JSON.stringify({ error: "No text extracted", extracted: extractedText }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the knowledge record with extracted content
    const { error: updateError } = await supabase
      .from("raqeem_knowledge")
      .update({ content: extractedText })
      .eq("id", knowledge_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update record", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        knowledge_id,
        content_length: extractedText.length,
        preview: extractedText.substring(0, 200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-pdf-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
