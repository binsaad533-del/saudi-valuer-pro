import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Workflow Orchestrator
 * 
 * ALL status changes go through update_request_status RPC.
 * Uses the unified 19-status matrix defined in workflow-engine.ts:
 *   draft → submitted → scope_generated → scope_approved →
 *   first_payment_confirmed → data_collection_open → data_collection_complete →
 *   inspection_pending → inspection_completed → data_validated →
 *   analysis_complete → professional_review → draft_report_ready →
 *   client_review → draft_approved → final_payment_confirmed →
 *   issued → archived → cancelled
 */

async function changeStatus(
  supabase: any,
  assignmentId: string,
  newStatus: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc("update_request_status", {
    _assignment_id: assignmentId,
    _new_status: newStatus,
    _user_id: "system",
    _action_type: "auto",
    _reason: reason,
    _bypass_justification: null,
  });

  if (error) {
    console.error(`[Orchestrator] Status change failed: ${newStatus}`, error.message);
    return { success: false, error: error.message };
  }

  const result = data as any;
  if (!result?.success) {
    console.warn(`[Orchestrator] Status change rejected: ${newStatus}`, result?.error);
    return { success: false, error: result?.error };
  }

  return { success: true, old_status: result.old_status, new_status: result.new_status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { request_id, trigger, assignment_id } = await req.json();

    // ── Post-submission orchestration ──
    if (request_id && !trigger) {
      const log = async (step: string, details?: string) => {
        console.log(`[Orchestrator] ${step}: ${details || ""}`);
        await supabase.from("audit_logs").insert({
          user_id: "system",
          action: "create" as any,
          table_name: "workflow_orchestrator",
          record_id: request_id,
          description: `[أتمتة] ${step}${details ? `: ${details}` : ""}`,
        }).catch(() => {});
      };

      await log("بدء سير العمل التلقائي", `طلب ${request_id}`);

      // 1. Check if an assignment already exists for this request
      const { data: existingAssignment } = await supabase
        .from("valuation_assignments")
        .select("id, status")
        .eq("request_id", request_id)
        .limit(1)
        .single();

      let assignmentId = existingAssignment?.id;

      if (!assignmentId) {
        await log("انتظار إنشاء ملف التقييم", "سيتم إنشاء الملف عند معالجة الطلب");
        
        try {
          const { data: intakeResult } = await supabase.functions.invoke("ai-intake", {
            body: { request_id },
          });
          await log("تم تحليل الطلب بالذكاء الاصطناعي", JSON.stringify(intakeResult?.summary || ""));
        } catch (e) {
          await log("خطأ في التحليل الذكي", String(e));
        }

        const { data: newAssignment } = await supabase
          .from("valuation_assignments")
          .select("id, status")
          .eq("request_id", request_id)
          .limit(1)
          .single();

        assignmentId = newAssignment?.id;
      }

      if (!assignmentId) {
        await log("لم يتم إنشاء ملف تقييم بعد", "سيتم استكمال الأتمتة عند إنشاء الملف");
        return new Response(JSON.stringify({
          success: true,
          message: "Pipeline triggered, waiting for assignment creation",
          request_id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Auto-assign inspector → move to inspection_pending
      try {
        const { data: subjects } = await supabase
          .from("subjects")
          .select("city_ar, district_ar, latitude, longitude")
          .eq("assignment_id", assignmentId)
          .limit(1);

        const subject = subjects?.[0];

        const { data: inspectorResult } = await supabase.functions.invoke("smart-inspector-assignment", {
          body: {
            assignment_id: assignmentId,
            property_city_ar: subject?.city_ar || "",
            property_district_ar: subject?.district_ar || "",
            property_latitude: subject?.latitude,
            property_longitude: subject?.longitude,
          },
        });

        if (inspectorResult?.assigned) {
          await log("تم تعيين المعاين تلقائياً", inspectorResult.inspector_name || "");

          // Use RPC to move to inspection_pending (unified status)
          await changeStatus(supabase, assignmentId, "inspection_pending",
            "تعيين معاين تلقائي بالذكاء الاصطناعي");
        } else {
          await log("لم يتم العثور على معاين متاح", "بانتظار التعيين اليدوي");
        }
      } catch (e) {
        await log("خطأ في تعيين المعاين", String(e));
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Pipeline initiated successfully",
        assignment_id: assignmentId,
        next_step: "waiting_for_inspection",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Post-inspection trigger (called when inspector submits) ──
    if (trigger === "inspection_completed" && assignment_id) {
      const log = async (step: string) => {
        console.log(`[Orchestrator] post-inspection: ${step}`);
        await supabase.from("audit_logs").insert({
          user_id: "system",
          action: "create" as any,
          table_name: "workflow_orchestrator",
          record_id: assignment_id,
          description: `[أتمتة ما بعد المعاينة] ${step}`,
        }).catch(() => {});
      };

      // 1. Move to inspection_completed → data_validated → analysis_complete
      await changeStatus(supabase, assignment_id, "inspection_completed",
        "اكتمال المعاينة الميدانية");

      await log("بدء التقييم الآلي");

      // 2. Run AI analysis
      try {
        await supabase.functions.invoke("analyze-inspection", {
          body: { assignment_id },
        });
        await log("تم تحليل بيانات المعاينة");
      } catch (e) {
        await log(`خطأ في تحليل المعاينة: ${e}`);
      }

      // Move to data_validated
      await changeStatus(supabase, assignment_id, "data_validated",
        "تم التحقق من البيانات بعد التحليل");

      // 3. Run valuation engine
      try {
        await supabase.functions.invoke("valuation-engine", {
          body: { assignment_id },
        });
        await log("تم تنفيذ محرك التقييم");
      } catch (e) {
        await log(`خطأ في محرك التقييم: ${e}`);
      }

      // Move to analysis_complete
      await changeStatus(supabase, assignment_id, "analysis_complete",
        "اكتمال التحليل والتقييم");

      // 4. Generate report
      try {
        await supabase.functions.invoke("generate-report-pdf", {
          body: { assignment_id },
        });
        await log("تم إنشاء مسودة التقرير");
      } catch (e) {
        await log(`خطأ في إنشاء التقرير: ${e}`);
      }

      // 5. Move to professional_review → draft_report_ready
      await changeStatus(supabase, assignment_id, "professional_review",
        "مسودة تقرير مُنشأة — بانتظار المراجعة المهنية");

      await log("تم إرسال المسودة للمراجعة المهنية");

      return new Response(JSON.stringify({
        success: true,
        message: "Post-inspection pipeline completed",
        assignment_id,
        current_status: "professional_review",
        next_step: "owner_professional_review",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Admin approval trigger (owner approves draft) ──
    if (trigger === "admin_approved" && assignment_id) {
      // Move from draft_report_ready → client_review
      const result = await changeStatus(supabase, assignment_id, "client_review",
        "اعتماد المقيّم — إرسال المسودة للعميل");

      return new Response(JSON.stringify({
        success: true,
        message: "Draft sent to client for review",
        current_status: "client_review",
        transition: result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Client approved draft → final payment or issuance ──
    if (trigger === "client_approved" && assignment_id) {
      const result = await changeStatus(supabase, assignment_id, "draft_approved",
        "اعتماد العميل للمسودة");

      return new Response(JSON.stringify({
        success: true,
        message: "Client approved draft",
        current_status: "draft_approved",
        transition: result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Final payment confirmed → issue report ──
    if (trigger === "final_payment_confirmed" && assignment_id) {
      // Issue the report
      const issueResult = await changeStatus(supabase, assignment_id, "issued",
        "إصدار التقرير النهائي بعد اكتمال السداد");

      // Archive
      const archiveResult = await changeStatus(supabase, assignment_id, "archived",
        "أرشفة تلقائية بعد الإصدار");

      return new Response(JSON.stringify({
        success: true,
        message: "Report issued and archived",
        current_status: "archived",
        transitions: { issue: issueResult, archive: archiveResult },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid request parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
