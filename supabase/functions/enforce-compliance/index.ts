import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Compliance Rule Enforcement Engine
 * Runs active rules against an assignment at a specific workflow stage.
 * Returns pass/fail results and stores them in compliance_check_results.
 */
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { assignment_id, stage } = await req.json();
    if (!assignment_id || !stage) throw new Error("assignment_id and stage required");

    // Fetch active rules for this stage
    const { data: rules, error: rulesErr } = await supabase
      .from("raqeem_rules")
      .select("*")
      .eq("is_active", true)
      .contains("enforcement_stage", [stage]);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({
          stage,
          total_rules: 0,
          passed: 0,
          failed: 0,
          blockers: 0,
          can_proceed: true,
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch assignment data
    const { data: assignment } = await supabase
      .from("valuation_assignments")
      .select("*")
      .eq("id", assignment_id)
      .single();

    // Fetch related data based on stage
    let subjects: any[] = [];
    let inspections: any[] = [];
    let comparables: any[] = [];
    let assumptions: any[] = [];
    let complianceChecks: any[] = [];

    const fetches = [
      supabase.from("subjects").select("*").eq("assignment_id", assignment_id).then(r => { subjects = r.data || []; }),
      supabase.from("inspections").select("*").eq("assignment_id", assignment_id).then(r => { inspections = r.data || []; }),
      supabase.from("assignment_comparables").select("*").eq("assignment_id", assignment_id).then(r => { comparables = r.data || []; }),
      supabase.from("assumptions").select("*").eq("assignment_id", assignment_id).then(r => { assumptions = r.data || []; }),
      supabase.from("compliance_checks").select("*").eq("assignment_id", assignment_id).then(r => { complianceChecks = r.data || []; }),
    ];
    await Promise.all(fetches);

    // Build context for AI evaluation
    const context = {
      assignment: assignment || {},
      subjects_count: subjects.length,
      subjects,
      inspections_count: inspections.length,
      inspections_completed: inspections.filter((i: any) => i.status === "completed").length,
      comparables_count: comparables.length,
      assumptions_count: assumptions.length,
      compliance_checks_passed: complianceChecks.filter((c: any) => c.is_passed).length,
      compliance_checks_total: complianceChecks.length,
      stage,
    };

    // Batch rules for AI evaluation (max 20 per call)
    const BATCH_SIZE = 20;
    const results: any[] = [];

    for (let i = 0; i < rules.length; i += BATCH_SIZE) {
      const batch = rules.slice(i, i + BATCH_SIZE);

      const ruleDescriptions = batch.map((r: any, idx: number) => 
        `Rule ${idx + 1} (${r.id}): ${r.rule_title_ar}\n${r.rule_content}\nSeverity: ${r.severity}\nType: ${r.rule_type}`
      ).join("\n\n");

      const prompt = `You are a valuation compliance officer. Evaluate each rule against the assignment data.

Assignment Context:
${JSON.stringify(context, null, 2)}

Rules to evaluate:
${ruleDescriptions}

For each rule, determine if it PASSES or FAILS based on the available data.
Return results as a JSON array.`;

      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [
              {
                role: "system",
                content: "You evaluate compliance rules against valuation data. Be strict. If data is missing to evaluate a rule, mark it as FAILED.",
              },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "evaluate_rules",
                  description: "Evaluate compliance rules",
                  parameters: {
                    type: "object",
                    properties: {
                      evaluations: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            rule_id: { type: "string" },
                            passed: { type: "boolean" },
                            violation_message: { type: "string", description: "Arabic explanation if failed" },
                          },
                          required: ["rule_id", "passed"],
                        },
                      },
                    },
                    required: ["evaluations"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "evaluate_rules" } },
          }),
        }
      );

      if (!resp.ok) {
        console.error("AI error:", resp.status, await resp.text());
        // Mark all rules in batch as failed on AI error
        for (const r of batch) {
          results.push({
            rule_id: r.id,
            rule_title_ar: r.rule_title_ar,
            severity: r.severity,
            passed: false,
            violation_message: "تعذر التحقق - خطأ في النظام",
          });
        }
        continue;
      }

      const aiData = await resp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (Array.isArray(parsed.evaluations)) {
            for (const ev of parsed.evaluations) {
              const rule = batch.find((r: any) => r.id === ev.rule_id);
              results.push({
                rule_id: ev.rule_id,
                rule_title_ar: rule?.rule_title_ar || "",
                severity: rule?.severity || "warning",
                passed: ev.passed,
                violation_message: ev.violation_message || null,
              });
            }
          }
        } catch (e) {
          console.error("Parse error:", e);
        }
      }
    }

    // Store results using upsert
    for (const r of results) {
      await supabase
        .from("compliance_check_results")
        .upsert(
          {
            assignment_id,
            rule_id: r.rule_id,
            stage,
            passed: r.passed,
            violation_message: r.violation_message,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "assignment_id,rule_id,stage" }
        );
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const blockers = results.filter((r) => !r.passed && r.severity === "blocking").length;

    return new Response(
      JSON.stringify({
        stage,
        total_rules: results.length,
        passed,
        failed,
        blockers,
        can_proceed: blockers === 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enforce-compliance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
