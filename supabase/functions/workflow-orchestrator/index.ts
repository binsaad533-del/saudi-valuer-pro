import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Workflow Orchestrator
 * 
 * Fully automated AI-driven valuation pipeline:
 * 1. AI Review (extract-documents / ai-intake)
 * 2. Auto-assign inspector (smart-inspector-assignment)
 * 3. [WAIT: Inspector completes field work]
 * 4. AI Valuation + Report Generation (triggered after inspection)
 * 5. [HUMAN: Admin approves draft]
 * 6. [HUMAN: Super Admin final approval]
 * 7. Auto-issue + Auto-archive
 */

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

      // If no assignment, the system will create one when it processes the request
      // For now, log that the pipeline has been triggered
      if (!assignmentId) {
        await log("انتظار إنشاء ملف التقييم", "سيتم إنشاء الملف عند معالجة الطلب");
        
        // Try to invoke ai-intake to process the request
        try {
          const { data: intakeResult } = await supabase.functions.invoke("ai-intake", {
            body: { request_id },
          });
          await log("تم تحليل الطلب بالذكاء الاصطناعي", JSON.stringify(intakeResult?.summary || ""));
        } catch (e) {
          await log("خطأ في التحليل الذكي", String(e));
        }

        // Re-check for assignment after AI intake
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

      // 2. Auto-assign inspector
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

          // Update status to inspection_assigned
          await supabase
            .from("valuation_assignments")
            .update({ status: "inspection_assigned" as any })
            .eq("id", assignmentId);

          await supabase.from("status_history").insert({
            assignment_id: assignmentId,
            from_status: "inspection_required" as any,
            to_status: "inspection_assigned" as any,
            changed_by: "system",
            reason: "تعيين معاين تلقائي بالذكاء الاصطناعي",
          });
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

      // 1. Update status to valuation_in_progress
      await supabase
        .from("valuation_assignments")
        .update({ status: "valuation_in_progress" as any })
        .eq("id", assignment_id);

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

      // 3. Run valuation engine
      try {
        await supabase.functions.invoke("valuation-engine", {
          body: { assignment_id },
        });
        await log("تم تنفيذ محرك التقييم");
      } catch (e) {
        await log(`خطأ في محرك التقييم: ${e}`);
      }

      // 4. Generate report
      try {
        await supabase.functions.invoke("generate-report-pdf", {
          body: { assignment_id },
        });
        await log("تم إنشاء مسودة التقرير");
      } catch (e) {
        await log(`خطأ في إنشاء التقرير: ${e}`);
      }

      // 5. Move to draft_report_ready → under_client_review (admin review)
      await supabase
        .from("valuation_assignments")
        .update({ status: "under_client_review" as any })
        .eq("id", assignment_id);

      await supabase.from("status_history").insert([
        {
          assignment_id,
          from_status: "valuation_in_progress" as any,
          to_status: "draft_report_ready" as any,
          changed_by: "system",
          reason: "مسودة تقرير مُنشأة بالذكاء الاصطناعي",
        },
        {
          assignment_id,
          from_status: "draft_report_ready" as any,
          to_status: "under_client_review" as any,
          changed_by: "system",
          reason: "إرسال تلقائي للإداري للاعتماد",
        },
      ]);

      await log("تم إرسال المسودة للإداري للاعتماد");

      return new Response(JSON.stringify({
        success: true,
        message: "Post-inspection pipeline completed",
        assignment_id,
        current_status: "under_client_review",
        next_step: "admin_approval_required",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Admin approval trigger ──
    if (trigger === "admin_approved" && assignment_id) {
      await supabase
        .from("valuation_assignments")
        .update({ status: "awaiting_final_payment" as any })
        .eq("id", assignment_id);

      await supabase.from("status_history").insert({
        assignment_id,
        from_status: "under_client_review" as any,
        to_status: "awaiting_final_payment" as any,
        changed_by: "system",
        reason: "اعتماد الإداري — بانتظار اعتماد المشرف العام",
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Sent to super admin for final approval",
        current_status: "awaiting_final_payment",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Super Admin final approval trigger ──
    if (trigger === "super_admin_approved" && assignment_id) {
      // Approved → Issued → Archived (all automatic)
      const transitions = [
        { from: "awaiting_final_payment", to: "final_payment_received", reason: "اعتماد المشرف العام النهائي" },
        { from: "final_payment_received", to: "report_issued", reason: "إصدار تلقائي للتقرير" },
        { from: "report_issued", to: "closed", reason: "أرشفة تلقائية" },
      ];

      for (const t of transitions) {
        await supabase
          .from("valuation_assignments")
          .update({ status: t.to as any })
          .eq("id", assignment_id);

        await supabase.from("status_history").insert({
          assignment_id,
          from_status: t.from as any,
          to_status: t.to as any,
          changed_by: "system",
          reason: t.reason,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Report issued and archived",
        current_status: "closed",
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
