import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { arabic_conclusion, english_conclusion, arabic_value, english_value } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Quick numeric check
    if (arabic_value !== undefined && english_value !== undefined && arabic_value !== english_value) {
      return new Response(
        JSON.stringify({
          consistent: false,
          issues: [
            {
              type: "value_mismatch",
              description_ar: "القيمة النهائية في النسخة العربية لا تتطابق مع النسخة الإنجليزية",
              description_en: "Final value in Arabic version does not match English version",
              arabic_value,
              english_value,
            },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI semantic consistency check
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
              content: `You are a bilingual valuation report consistency checker. Compare the Arabic and English conclusions of a valuation report. Check for:
1. Value mismatches (numbers, currency)
2. Meaning inconsistencies (different conclusions)
3. Missing information in one language
4. Terminology inconsistencies
Return findings as structured data.`,
            },
            {
              role: "user",
              content: `Arabic conclusion:\n${arabic_conclusion}\n\nEnglish conclusion:\n${english_conclusion}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_consistency",
                description: "Report consistency check results",
                parameters: {
                  type: "object",
                  properties: {
                    consistent: { type: "boolean" },
                    issues: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          description_ar: { type: "string" },
                          description_en: { type: "string" },
                        },
                        required: ["type", "description_ar", "description_en"],
                      },
                    },
                  },
                  required: ["consistent", "issues"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_consistency" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-consistency error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
