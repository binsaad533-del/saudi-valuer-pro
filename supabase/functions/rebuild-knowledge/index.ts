import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let jobId: string | null = null;

  try {
    const { job_id } = await req.json();
    jobId = job_id;
    if (!jobId) throw new Error("job_id required");

    // Mark job as running
    await supabase.from("knowledge_rebuild_jobs").update({
      status: "running",
      started_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Fetch all uploaded documents with content
    const { data: docs, error: docsErr } = await supabase
      .from("raqeem_knowledge")
      .select("id, title_ar, content, category")
      .eq("is_active", true)
      .not("content", "is", null);

    if (docsErr) throw new Error(docsErr.message);
    const validDocs = (docs || []).filter((d: any) => d.content && d.content.length >= 50);

    await supabase.from("knowledge_rebuild_jobs").update({
      total_documents: validDocs.length,
    }).eq("id", jobId);

    if (validDocs.length === 0) {
      await supabase.from("knowledge_rebuild_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return new Response(JSON.stringify({ message: "No documents to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete old rules from these documents to avoid stacking
    const docIds = validDocs.map((d: any) => d.id);
    await supabase.from("raqeem_rules").delete().in("source_document_id", docIds);

    const MAX_CHUNK = 18000;
    let totalExtracted = 0;
    let totalInserted = 0;
    let processedDocs = 0;

    for (const doc of validDocs) {
      const content = doc.content || "";
      const chunks: string[] = [];
      for (let i = 0; i < content.length; i += MAX_CHUNK) {
        chunks.push(content.slice(i, i + MAX_CHUNK));
      }

      const docRules: any[] = [];

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
8. condition_text: WHEN this rule applies — Arabic, specific, contextual
9. requirement_text: WHAT must be satisfied — Arabic, actionable
10. impact_type: one of "warning", "risk", "confidence_reduction", "blocking"

IMPORTANT:
- Be SPECIFIC, not generic
- condition_text must describe exact scenario
- requirement_text must be actionable and measurable
- Differentiate between real estate rules and machinery rules

Document category: ${doc.category}
Document title: ${doc.title_ar}

Content:
${chunk}`;

        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You extract structured, context-aware valuation rules from professional documents. Always respond via the tool call." },
                { role: "user", content: prompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "extract_rules",
                  description: "Extract structured rules",
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
                            category: { type: "string", enum: ["valuation", "compliance", "reporting", "methodology", "data_quality"] },
                            severity: { type: "string", enum: ["warning", "blocking"] },
                            rule_type: { type: "string", enum: ["rule", "checklist", "required_field", "validation", "prohibition"] },
                            enforcement_stage: { type: "array", items: { type: "string" } },
                            applicable_asset_type: { type: "string", enum: ["real_estate", "machinery", "both"] },
                            condition_text: { type: "string" },
                            requirement_text: { type: "string" },
                            impact_type: { type: "string", enum: ["warning", "risk", "confidence_reduction", "blocking"] },
                          },
                          required: ["rule_title_ar", "rule_content", "category", "severity", "rule_type", "enforcement_stage", "applicable_asset_type", "condition_text", "requirement_text", "impact_type"],
                        },
                      },
                    },
                    required: ["rules"],
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "extract_rules" } },
            }),
          });

          if (!resp.ok) { console.error("AI error:", resp.status); continue; }
          const aiData = await resp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          if (Array.isArray(parsed.rules)) docRules.push(...parsed.rules);
        } catch (e) {
          console.error("Chunk error:", e);
        }
      }

      totalExtracted += docRules.length;

      // Insert rules for this doc
      for (const rule of docRules) {
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
          source_document_id: doc.id,
          priority: rule.severity === "blocking" ? 10 : 5,
          is_active: true,
          created_by: "rebuild-system",
        });
        if (!error) totalInserted++;
      }

      processedDocs++;

      // Update progress
      await supabase.from("knowledge_rebuild_jobs").update({
        processed_documents: processedDocs,
        total_rules_extracted: totalExtracted,
        total_rules_inserted: totalInserted,
      }).eq("id", jobId);
    }

    // Deduplication pass: keep newest rule per unique title
    const { data: allRules } = await supabase
      .from("raqeem_rules")
      .select("id, rule_title_ar, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    let dupsRemoved = 0;
    if (allRules) {
      const seen = new Set<string>();
      const toDelete: string[] = [];
      for (const r of allRules) {
        const key = r.rule_title_ar.trim();
        if (seen.has(key)) {
          toDelete.push(r.id);
        } else {
          seen.add(key);
        }
      }
      if (toDelete.length > 0) {
        // Delete in batches
        for (let i = 0; i < toDelete.length; i += 100) {
          const batch = toDelete.slice(i, i + 100);
          await supabase.from("raqeem_rules").delete().in("id", batch);
        }
        dupsRemoved = toDelete.length;
      }
    }

    // Count critical vs warning
    const { count: criticalCount } = await supabase
      .from("raqeem_rules")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("severity", "blocking");

    const { count: warningCount } = await supabase
      .from("raqeem_rules")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("severity", "warning");

    await supabase.from("knowledge_rebuild_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_rules_extracted: totalExtracted,
      total_rules_inserted: totalInserted - dupsRemoved,
      duplicates_removed: dupsRemoved,
      critical_rules: criticalCount || 0,
      warning_rules: warningCount || 0,
    }).eq("id", jobId);

    return new Response(JSON.stringify({
      status: "completed",
      total_extracted: totalExtracted,
      total_inserted: totalInserted - dupsRemoved,
      duplicates_removed: dupsRemoved,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("rebuild-knowledge error:", e);
    if (jobId) {
      await supabase.from("knowledge_rebuild_jobs").update({
        status: "failed",
        error_message: e instanceof Error ? e.message : "Unknown error",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
