import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { knowledge_id } = await req.json();
    if (!knowledge_id) throw new Error("knowledge_id required");

    const { data: doc, error: docErr } = await supabase
      .from("raqeem_knowledge")
      .select("*")
      .eq("id", knowledge_id)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    const content = doc.content || "";
    if (content.length < 50) {
      return new Response(
        JSON.stringify({ rules_extracted: 0, message: "Content too short" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MAX_CHUNK = 18000;
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += MAX_CHUNK) {
      chunks.push(content.slice(i, i + MAX_CHUNK));
    }

    const allRules: any[] = [];

    for (const chunk of chunks) {
      const prompt = `You are a professional valuation standards analyst specializing in IVS, RICS, and Saudi Taqeem standards.

Analyze this document and extract ALL enforceable rules as STRUCTURED, CONTEXT-AWARE professional rules.

For each rule, you MUST provide:
1. rule_title_ar: Concise Arabic title
2. rule_content: Full rule description in Arabic
3. category: one of "valuation", "compliance", "reporting", "methodology", "data_quality"
4. severity: "warning" or "blocking"
5. rule_type: one of "rule", "checklist", "required_field", "validation", "prohibition"
6. enforcement_stage: array of stages: "asset_extraction", "asset_review", "valuation_calculation", "reconciliation", "report_generation", "report_issuance"
7. applicable_asset_type: "real_estate", "machinery", or "both"
8. condition_text: WHEN this rule applies — Arabic, specific, contextual. Example: "عند تقييم عقار سكني بأسلوب المقارنة السوقية"
9. requirement_text: WHAT must be satisfied — Arabic, actionable. Example: "يجب توفر 3 مقارنات سوقية حديثة على الأقل ضمن نطاق جغرافي مناسب"
10. impact_type: one of "warning" (show alert), "risk" (add to risk report), "confidence_reduction" (lower confidence score), "blocking" (prevent workflow)

IMPORTANT RULES FOR EXTRACTION:
- Be SPECIFIC, not generic. Reference actual standards and sections.
- condition_text must describe the exact scenario, not just "always"
- requirement_text must be actionable and measurable
- Differentiate between real estate rules and machinery rules
- Map each rule to the correct enforcement stage(s)

Document category: ${doc.category}
Document title: ${doc.title_ar}

Content:
${chunk}`;

      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You extract structured, context-aware valuation rules from professional documents. Always respond via the tool call. Rules must be specific and actionable, not generic.",
              },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_rules",
                  description: "Extract structured context-aware valuation rules",
                  parameters: {
                    type: "object",
                    properties: {
                      rules: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            rule_title_ar: { type: "string" },
                            rule_content: { type: "string" },
                            category: {
                              type: "string",
                              enum: ["valuation", "compliance", "reporting", "methodology", "data_quality"],
                            },
                            severity: {
                              type: "string",
                              enum: ["warning", "blocking"],
                            },
                            rule_type: {
                              type: "string",
                              enum: ["rule", "checklist", "required_field", "validation", "prohibition"],
                            },
                            enforcement_stage: {
                              type: "array",
                              items: {
                                type: "string",
                                enum: ["asset_extraction", "asset_review", "valuation_calculation", "reconciliation", "report_generation", "report_issuance"],
                              },
                            },
                            applicable_asset_type: {
                              type: "string",
                              enum: ["real_estate", "machinery", "both"],
                            },
                            condition_text: { type: "string" },
                            requirement_text: { type: "string" },
                            impact_type: {
                              type: "string",
                              enum: ["warning", "risk", "confidence_reduction", "blocking"],
                            },
                          },
                          required: [
                            "rule_title_ar", "rule_content", "category", "severity",
                            "rule_type", "enforcement_stage", "applicable_asset_type",
                            "condition_text", "requirement_text", "impact_type",
                          ],
                        },
                      },
                    },
                    required: ["rules"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_rules" } },
          }),
        }
      );

      if (!resp.ok) {
        console.error("AI error:", resp.status, await resp.text());
        continue;
      }

      const aiData = await resp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) continue;

      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (Array.isArray(parsed.rules)) allRules.push(...parsed.rules);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    // Get user
    const authHeader = req.headers.get("Authorization");
    let userId = "system";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    let inserted = 0;
    for (const rule of allRules) {
      const { error } = await supabase.from("raqeem_rules").insert({
        rule_title_ar: rule.rule_title_ar,
        rule_content: rule.rule_content,
        category: rule.category,
        severity: rule.severity,
        rule_type: rule.rule_type,
        enforcement_stage: rule.enforcement_stage,
        applicable_asset_type: rule.applicable_asset_type || "both",
        condition_text: rule.condition_text || null,
        requirement_text: rule.requirement_text || null,
        impact_type: rule.impact_type || "warning",
        source_document_id: knowledge_id,
        priority: rule.severity === "blocking" ? 10 : 5,
        is_active: true,
        created_by: userId,
      });
      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({
        rules_extracted: allRules.length,
        rules_inserted: inserted,
        chunks_processed: chunks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
