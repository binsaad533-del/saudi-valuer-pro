import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { report_id, reference_number } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find report by ID or reference number
    let report: any = null;
    let assignment: any = null;

    if (report_id) {
      const { data } = await sb.from("reports").select("*").eq("id", report_id).single();
      report = data;
    }

    if (!report && reference_number) {
      const { data: assignmentData } = await sb
        .from("valuation_assignments")
        .select("*")
        .eq("reference_number", reference_number)
        .single();

      if (assignmentData) {
        assignment = assignmentData;
        const { data: reportData } = await sb
          .from("reports")
          .select("*")
          .eq("assignment_id", assignmentData.id)
          .eq("is_final", true)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        report = reportData;
      }
    }

    if (!report) {
      // Log failed verification
      await sb.from("report_verification_log").insert({
        report_id: report_id || "00000000-0000-0000-0000-000000000000",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        result: "not_found",
      });

      return new Response(JSON.stringify({
        verified: false,
        status: "not_found",
        message_ar: "لم يتم العثور على التقرير",
        message_en: "Report not found",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch assignment if not already loaded
    if (!assignment) {
      const { data } = await sb
        .from("valuation_assignments")
        .select("*, clients(*)")
        .eq("id", report.assignment_id)
        .single();
      assignment = data;
    } else {
      const { data: clientData } = await sb
        .from("clients")
        .select("*")
        .eq("id", assignment.client_id)
        .single();
      (assignment as any).clients = clientData;
    }

    // Fetch signature
    const { data: signature } = await sb
      .from("report_signatures")
      .select("*")
      .eq("report_id", report.id)
      .order("signed_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch reconciliation for value
    const { data: recon } = await sb
      .from("reconciliation_results")
      .select("final_value, currency")
      .eq("assignment_id", report.assignment_id)
      .single();

    // Determine report status
    let reportStatus = "valid";
    if (report.superseded_by) reportStatus = "superseded";
    if (!report.is_final) reportStatus = "draft";

    // Verify signature hash
    let signatureValid = false;
    if (signature?.signature_hash) {
      const payload = `${report.id}|${signature.signer_name_en}|${signature.signed_at}|${recon?.final_value || 0}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      signatureValid = computedHash === signature.signature_hash;
    }

    const client = (assignment as any)?.clients;
    const clientName = client?.name_ar
      ? client.name_ar.substring(0, 4) + "***"
      : null;

    // Log successful verification
    await sb.from("report_verification_log").insert({
      report_id: report.id,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      result: reportStatus,
    });

    return new Response(JSON.stringify({
      verified: reportStatus === "valid",
      status: reportStatus,
      report_id: report.id,
      reference_number: assignment?.reference_number,
      issue_date: assignment?.issue_date,
      report_version: report.version,
      client_name_masked: clientName,
      property_type: assignment?.property_type,
      valuation_amount: recon?.final_value,
      currency: recon?.currency || "SAR",
      signature: signature ? {
        signer_name_ar: signature.signer_name_ar,
        signer_name_en: signature.signer_name_en,
        signer_title_ar: signature.signer_title_ar,
        signer_title_en: signature.signer_title_en,
        signed_at: signature.signed_at,
        hash_valid: signatureValid,
      } : null,
      message_ar: reportStatus === "valid" ? "تقرير موثق وصالح ✓" : reportStatus === "superseded" ? "تم استبدال هذا التقرير بإصدار أحدث" : "تقرير غير نهائي",
      message_en: reportStatus === "valid" ? "Report is authentic and valid ✓" : reportStatus === "superseded" ? "This report has been superseded by a newer version" : "Report is not final",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("verify-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
