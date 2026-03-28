import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "expire_reports";

    if (action === "expire_reports") {
      // Find all issued (final) reports past 90 days that aren't already expired
      const { data: expiredReports, error } = await sb
        .from("reports")
        .select("id, issue_date, status, assignment_id")
        .eq("is_final", true)
        .is("expired_at", null)
        .not("issue_date", "is", null);

      if (error) throw error;

      const now = new Date();
      let expiredCount = 0;

      for (const report of expiredReports || []) {
        const issueDate = new Date(report.issue_date);
        const expiryDate = new Date(issueDate);
        expiryDate.setDate(expiryDate.getDate() + 90);

        if (now > expiryDate) {
          // Mark as expired — we only set expired_at, not modify locked report
          await sb
            .from("reports")
            .update({
              expired_at: now.toISOString(),
              status: "expired",
            } as any)
            .eq("id", report.id);

          // Audit log
          await sb.from("audit_logs").insert({
            table_name: "reports",
            action: "update" as any,
            record_id: report.id,
            assignment_id: report.assignment_id,
            description: "Report automatically expired after 90 days",
            new_data: { status: "expired", expired_at: now.toISOString() },
          });

          expiredCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          expired_count: expiredCount,
          checked_count: expiredReports?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("report-lifecycle error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
