import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function computeSignatureHash(reportId: string, signerName: string, signedAt: string, finalValue: number): Promise<string> {
  const payload = `${reportId}|${signerName}|${signedAt}|${finalValue}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignment_id, report_id, type } = await req.json();
    const sb = supabaseAdmin();
    const isDraft = type === "draft";

    // === COMPLIANCE ENFORCEMENT FOR FINAL REPORTS ===
    if (!isDraft) {
      // Check compliance
      const { data: compliance } = await sb
        .from("compliance_checks")
        .select("*")
        .eq("assignment_id", assignment_id);

      const mandatoryFailures = compliance?.filter((c: any) => c.is_mandatory && !c.is_passed) || [];
      if (mandatoryFailures.length > 0) {
        throw new Error(`Cannot issue final report: ${mandatoryFailures.length} mandatory compliance checks failed`);
      }

      // Check inspection completed
      const { data: inspections } = await sb
        .from("inspections")
        .select("status")
        .eq("assignment_id", assignment_id);

      const hasCompletedInspection = inspections?.some((i: any) => i.status === "submitted" || i.status === "reviewed");
      if (!hasCompletedInspection) {
        throw new Error("Cannot issue final report: inspection not completed");
      }

      // Check reconciliation exists (valuation completed)
      const { data: recon } = await sb
        .from("reconciliation_results")
        .select("id")
        .eq("assignment_id", assignment_id)
        .single();

      if (!recon) {
        throw new Error("Cannot issue final report: valuation not completed");
      }

      // Check final payment
      const { data: assignmentCheck } = await sb
        .from("valuation_assignments")
        .select("id")
        .eq("id", assignment_id)
        .single();

      if (assignmentCheck) {
        const { data: requests } = await sb
          .from("valuation_requests")
          .select("payment_status")
          .eq("assignment_id", assignment_id);

        const hasFinalPayment = requests?.some((r: any) => r.payment_status === "paid" || r.payment_status === "fully_paid");
        if (!hasFinalPayment) {
          throw new Error("Cannot issue final report: final payment not received");
        }
      }
    }

    // Fetch all data
    const [
      { data: assignment },
      { data: report },
      { data: recon },
      { data: subjects },
      { data: methods },
      { data: org },
      { data: compliance },
    ] = await Promise.all([
      sb.from("valuation_assignments").select("*, clients(*)").eq("id", assignment_id).single(),
      sb.from("reports").select("*").eq("id", report_id).single(),
      sb.from("reconciliation_results").select("*").eq("assignment_id", assignment_id).single(),
      sb.from("subjects").select("*").eq("assignment_id", assignment_id),
      sb.from("valuation_methods").select("*, valuation_calculations(*)").eq("assignment_id", assignment_id),
      sb.from("organizations").select("*").limit(1).single(),
      sb.from("compliance_checks").select("*").eq("assignment_id", assignment_id),
    ]);

    if (!assignment || !report) throw new Error("Assignment or report not found");

    const subject = subjects?.[0] || {};
    const client = (assignment as any).clients || {};
    const content = (report.content_ar || {}) as Record<string, any>;

    // Compute signature hash for final reports
    let signatureHash: string | null = null;
    const signedAt = new Date().toISOString();

    if (!isDraft) {
      signatureHash = await computeSignatureHash(
        report_id,
        "Ahmed Al-Malki",
        signedAt,
        recon?.final_value || 0
      );
    }

    // Build report JSON structure
    const issueDate = isDraft ? null : new Date().toISOString().split("T")[0];
    const expiryDate = isDraft ? null : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      return d.toISOString().split("T")[0];
    })();
    const isRetrospective = assignment.is_retrospective || false;

    const reportJSON = {
      metadata: {
        type: isDraft ? "DRAFT" : "FINAL",
        reference_number: assignment.reference_number,
        report_date: new Date().toISOString().split("T")[0],
        valuation_date: assignment.valuation_date || new Date().toISOString().split("T")[0],
        issue_date: issueDate,
        expiry_date: expiryDate,
        is_retrospective: isRetrospective,
        retrospective_note: isRetrospective ? (assignment.retrospective_note_ar || "تقييم بأثر رجعي") : null,
        language: assignment.report_language,
        version: report.version,
        qr_code: isDraft ? null : `${SUPABASE_URL.replace('/rest/v1', '')}/verify/${assignment.reference_number}`,
        qr_verification_url: isDraft ? null : `/verify-report/${report_id}`,
        watermark: isDraft ? "DRAFT / مسودة" : null,
        signature_hash: signatureHash,
      },
      cover: {
        title_ar: report.title_ar || "تقرير تقييم عقاري",
        title_en: report.title_en || "Property Valuation Report",
        organization: {
          name_ar: org?.name_ar || "جساس للتقييم",
          name_en: org?.name_en || "Jsaas Valuation",
          logo_url: org?.logo_url,
          license: org?.license_number,
          taqeem_reg: org?.taqeem_registration,
        },
        client: {
          name_ar: client.name_ar,
          name_en: client.name_en,
          id_number: client.id_number,
        },
        property: {
          type_ar: subject.property_type,
          city_ar: subject.city_ar,
          district_ar: subject.district_ar,
        },
        final_value: recon?.final_value,
        currency: recon?.currency || "SAR",
      },
      sections: [
        { key: "executive_summary", title_ar: "الملخص التنفيذي", title_en: "Executive Summary", content_ar: content.executive_summary_ar, content_en: content.executive_summary_en },
        { key: "purpose", title_ar: "الغرض من التقييم", title_en: "Purpose of Valuation", content_ar: content.purpose_ar, content_en: content.purpose_en },
        { key: "scope", title_ar: "نطاق العمل", title_en: "Scope of Work", content_ar: content.scope_of_work_ar, content_en: content.scope_of_work_en },
        { key: "property_description", title_ar: "وصف العقار", title_en: "Property Description", content_ar: content.property_description_ar, content_en: content.property_description_en },
        { key: "legal_description", title_ar: "الوصف القانوني", title_en: "Legal Description", content_ar: content.legal_description_ar, content_en: content.legal_description_en },
        { key: "market_analysis", title_ar: "تحليل السوق", title_en: "Market Analysis", content_ar: content.market_analysis_ar, content_en: content.market_analysis_en },
        { key: "hbu", title_ar: "الاستخدام الأعلى والأفضل", title_en: "Highest & Best Use", content_ar: content.hbu_analysis_ar, content_en: content.hbu_analysis_en },
        { key: "methodology", title_ar: "منهجية التقييم", title_en: "Valuation Methodology", content_ar: content.valuation_methodology_ar, content_en: content.valuation_methodology_en },
        { key: "calculations", title_ar: "الحسابات والتحليل", title_en: "Calculations & Analysis", content_ar: content.calculations_ar, content_en: content.calculations_en },
        { key: "reconciliation", title_ar: "التسوية والمطابقة", title_en: "Reconciliation", content_ar: content.reconciliation_ar, content_en: content.reconciliation_en },
        { key: "conclusion", title_ar: "الرأي النهائي في القيمة", title_en: "Final Opinion of Value", content_ar: content.value_conclusion_ar, content_en: content.value_conclusion_en },
        { key: "assumptions", title_ar: "الافتراضات", title_en: "Assumptions", content_ar: content.assumptions_ar, content_en: content.assumptions_en },
        { key: "special_assumptions", title_ar: "الافتراضات الخاصة", title_en: "Special Assumptions", content_ar: content.special_assumptions_ar, content_en: content.special_assumptions_en },
        { key: "limiting_conditions", title_ar: "القيود", title_en: "Limiting Conditions", content_ar: content.limiting_conditions_ar, content_en: content.limiting_conditions_en },
        { key: "compliance", title_ar: "بيان الامتثال", title_en: "Compliance Statement", content_ar: content.compliance_statement_ar, content_en: content.compliance_statement_en },
      ],
      valuation_data: {
        methods: methods?.map(m => ({
          approach: m.approach,
          is_used: m.is_used,
          is_primary: m.is_primary,
          concluded_value: m.concluded_value,
          weight: m.weight_in_reconciliation,
          calculations: (m as any).valuation_calculations || [],
        })),
        reconciliation: recon,
      },
      signature: isDraft ? null : {
        signer_name_ar: "احمد المالكي",
        signer_name_en: "Ahmed Al-Malki",
        signer_title_ar: "مقيّم معتمد",
        signer_title_en: "Certified Valuer",
        signer_license: org?.license_number || "",
        signed_at: signedAt,
        signature_hash: signatureHash,
      },
      compliance_summary: {
        total_checks: compliance?.length || 0,
        passed: compliance?.filter((c: any) => c.is_passed).length || 0,
        ready: compliance?.every((c: any) => !c.is_mandatory || c.is_passed) ?? false,
      },
    };

    // Store report JSON
    const reportPath = `${assignment_id}/${isDraft ? "draft" : "final"}_report_${Date.now()}.json`;
    await sb.storage.from("reports").upload(reportPath, JSON.stringify(reportJSON, null, 2), {
      contentType: "application/json",
      upsert: true,
    });

    const { data: urlData } = sb.storage.from("reports").getPublicUrl(reportPath);
    const reportUrl = urlData?.publicUrl || reportPath;

    // Update report record
    const updateData: any = {
      status: isDraft ? "draft" : "final",
      is_final: !isDraft,
      pdf_url: reportUrl,
    };

    if (!isDraft) {
      updateData.is_locked = true;
      updateData.locked_at = new Date().toISOString();
      updateData.locked_by = assignment.created_by;
      updateData.signature_hash = signatureHash;
    }

    await sb.from("reports").update(updateData).eq("id", report_id);

    // If final, save signature with hash
    if (!isDraft) {
      await sb.from("report_signatures").insert({
        report_id,
        signer_id: assignment.created_by,
        signer_name_ar: "احمد المالكي",
        signer_name_en: "Ahmed Al-Malki",
        signer_title_ar: "مقيّم معتمد",
        signer_title_en: "Certified Valuer",
        signer_license: org?.license_number || "",
        signed_at: signedAt,
        signature_hash: signatureHash,
      });

      // Lock the assignment
      await sb.from("valuation_assignments").update({
        status: "completed",
        issue_date: new Date().toISOString().split("T")[0],
        is_locked: true,
        locked_at: new Date().toISOString(),
      }).eq("id", assignment_id);

      // Audit logs
      await sb.from("audit_logs").insert([
        {
          table_name: "reports",
          action: "update",
          record_id: report_id,
          assignment_id,
          description: "Final report issued with electronic signature and SHA-256 hash",
          new_data: { type: "final", final_value: recon?.final_value, signature_hash: signatureHash },
        },
        {
          table_name: "reports",
          action: "update",
          record_id: report_id,
          assignment_id,
          description: "Report locked - read-only mode activated",
          new_data: { is_locked: true, locked_at: new Date().toISOString() },
        },
      ]);
    }

    return new Response(JSON.stringify({
      success: true,
      report_url: reportUrl,
      report_json: reportJSON,
      type: isDraft ? "draft" : "final",
      signature_hash: signatureHash,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
