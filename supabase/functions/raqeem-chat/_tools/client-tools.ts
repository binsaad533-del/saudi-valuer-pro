// Client tools — extracted from index.ts without logic changes
import { AI } from "../../_shared/assistantIdentity.ts";
import { ToolResult } from "./helpers.ts";

export async function execute(
  toolName: string,
  args: any,
  db: any,
): Promise<ToolResult | null> {

  if (toolName === "track_my_requests") {
    const { data: requests } = await db.from("valuation_requests")
      .select("id, assignment_id, status, client_name_ar, property_type, created_at, total_price, amount_paid, payment_status, valuation_assignments(reference_number, status, final_value)")
      .order("created_at", { ascending: false })
      .limit(20);

    const activeStatuses = ["submitted", "scope_generated", "scope_approved", "first_payment_confirmed", "data_collection_open", "data_collection_complete", "inspection_pending", "inspection_completed", "data_validated", "analysis_complete", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"];
    const completedStatuses = ["issued", "archived"];

    let filtered = requests || [];
    if (args.status_filter === "active") filtered = filtered.filter((r: any) => activeStatuses.includes(r.valuation_assignments?.status || r.status));
    if (args.status_filter === "completed") filtered = filtered.filter((r: any) => completedStatuses.includes(r.valuation_assignments?.status || r.status));

    const statusLabels: Record<string, string> = {
      draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق معتمد",
      first_payment_confirmed: "دفعة أولى مؤكدة", data_collection_open: "جمع بيانات", data_collection_complete: "بيانات مكتملة",
      inspection_pending: "معاينة معلقة", inspection_completed: "معاينة مكتملة", data_validated: "بيانات محققة",
      analysis_complete: "تحليل مكتمل", professional_review: "مراجعة مهنية", draft_report_ready: "مسودة جاهزة",
      client_review: "مراجعة العميل", draft_approved: "مسودة معتمدة", final_payment_confirmed: "دفعة نهائية",
      issued: "صادر", archived: "مؤرشف", cancelled: "ملغي",
    };

    return {
      success: true,
      result: {
        total: filtered.length,
        requests: filtered.map((r: any) => ({
          reference: r.valuation_assignments?.reference_number || "—",
          status: r.valuation_assignments?.status || r.status,
          status_label: statusLabels[r.valuation_assignments?.status || r.status] || r.status,
          property_type: r.property_type,
          total_price: r.total_price,
          amount_paid: r.amount_paid || 0,
          created: new Date(r.created_at).toLocaleDateString("ar-SA"),
        })),
      }
    };
  }

  if (toolName === "get_request_status") {
    let assignment: any = null;
    if (args.reference_number) {
      const { data } = await db.from("valuation_assignments")
        .select("*, clients(name_ar, phone), subjects(*), valuation_requests(total_price, amount_paid, payment_status, valuation_mode, property_description)")
        .ilike("reference_number", `%${args.reference_number}%`).limit(1).maybeSingle();
      assignment = data;
    } else if (args.assignment_id) {
      const { data } = await db.from("valuation_assignments")
        .select("*, clients(name_ar, phone), subjects(*), valuation_requests(total_price, amount_paid, payment_status, valuation_mode, property_description)")
        .eq("id", args.assignment_id).single();
      assignment = data;
    }
    if (!assignment) return { success: false, result: null, error: "لم يتم العثور على الطلب" };

    const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
    const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;

    const createdDate = new Date(assignment.created_at);
    const modeMap: Record<string, number> = { field: 14, desktop_with_photos: 10, desktop_without_photos: 7 };
    const deliveryDays = modeMap[req?.valuation_mode || "field"] || 14;
    const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 86400000);
    const remaining = Math.max(0, Math.ceil((estimatedDelivery.getTime() - Date.now()) / 86400000));

    const statusLabels: Record<string, string> = {
      draft: "مسودة", submitted: "مقدم وقيد المراجعة", scope_generated: "نطاق العمل جاهز — بانتظار موافقتك",
      scope_approved: "تمت الموافقة — بانتظار الدفعة الأولى", first_payment_confirmed: "بدأ العمل",
      data_collection_open: "جمع البيانات جارٍ", inspection_pending: "المعاينة مجدولة",
      inspection_completed: "تمت المعاينة — جارٍ التحليل", data_validated: "البيانات محققة",
      analysis_complete: "التحليل مكتمل", professional_review: "مراجعة مهنية من المقيم المعتمد",
      draft_report_ready: "المسودة جاهزة لمراجعتك", client_review: "بانتظار ملاحظاتك",
      draft_approved: "المسودة معتمدة — بانتظار الدفعة النهائية", final_payment_confirmed: "جارٍ إصدار التقرير",
      issued: "التقرير صدر ✅", archived: "مؤرشف",
    };

    return {
      success: true,
      result: {
        reference: assignment.reference_number,
        status: assignment.status,
        status_label: statusLabels[assignment.status] || assignment.status,
        property_type: assignment.property_type,
        location: { city: subject?.city_ar, district: subject?.district_ar },
        description: req?.property_description || "—",
        financials: { total_price: req?.total_price, paid: req?.amount_paid || 0, remaining: (req?.total_price || 0) - (req?.amount_paid || 0) },
        timeline: { created: createdDate.toLocaleDateString("ar-SA"), estimated_delivery: estimatedDelivery.toLocaleDateString("ar-SA"), days_remaining: remaining },
      }
    };
  }

  if (toolName === "get_my_documents") {
    const [attachRes, reqDocRes] = await Promise.all([
      db.from("attachments").select("file_name, category, mime_type, created_at, file_size").eq("assignment_id", args.assignment_id),
      db.from("request_documents").select("file_name, mime_type, ai_category, created_at").eq("request_id", args.assignment_id),
    ]);

    const docs = [...(attachRes.data || []), ...(reqDocRes.data || [])];
    return {
      success: true,
      result: {
        total: docs.length,
        documents: docs.map((d: any) => ({
          name: d.file_name,
          category: d.category || d.ai_category || "عام",
          type: d.mime_type,
          date: new Date(d.created_at).toLocaleDateString("ar-SA"),
        })),
      }
    };
  }

  if (toolName === "get_my_payments") {
    let query = db.from("payments")
      .select("id, amount, payment_stage, payment_status, payment_type, created_at, paid_at")
      .order("created_at", { ascending: false }).limit(20);
    if (args.assignment_id) query = query.eq("assignment_id", args.assignment_id);

    const { data: payments } = await query;
    const stageLabels: Record<string, string> = { first: "الدفعة الأولى (50%)", final: "الدفعة النهائية (50%)", full: "دفعة كاملة" };
    const statusLabels: Record<string, string> = { pending: "بانتظار السداد", proof_uploaded: "إثبات مرفوع — قيد المراجعة", paid: "مدفوع ✅", rejected: "مرفوض" };

    return {
      success: true,
      result: {
        total: payments?.length || 0,
        payments: (payments || []).map((p: any) => ({
          amount: p.amount,
          stage: stageLabels[p.payment_stage] || p.payment_stage,
          status: statusLabels[p.payment_status] || p.payment_status,
          type: p.payment_type,
          date: new Date(p.created_at).toLocaleDateString("ar-SA"),
          paid_date: p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar-SA") : null,
        })),
      }
    };
  }

  if (toolName === "get_delivery_timeline") {
    const { data: assignment } = await db.from("valuation_assignments")
      .select("status, created_at, updated_at, valuation_requests(valuation_mode)")
      .eq("id", args.assignment_id).single();
    if (!assignment) return { success: false, result: null, error: "الطلب غير موجود" };

    const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;
    const mode = req?.valuation_mode || "field";
    const modeMap: Record<string, number> = { field: 14, desktop_with_photos: 10, desktop_without_photos: 7 };
    const totalDays = modeMap[mode] || 14;
    const created = new Date(assignment.created_at);
    const delivery = new Date(created.getTime() + totalDays * 86400000);
    const remaining = Math.max(0, Math.ceil((delivery.getTime() - Date.now()) / 86400000));

    const allStatuses = ["submitted", "scope_generated", "scope_approved", "first_payment_confirmed", "data_collection_open", "inspection_pending", "inspection_completed", "analysis_complete", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed", "issued"];
    const currentIdx = allStatuses.indexOf(assignment.status);
    const progress = currentIdx >= 0 ? Math.round(((currentIdx + 1) / allStatuses.length) * 100) : 0;

    return {
      success: true,
      result: {
        current_status: assignment.status,
        progress_percentage: progress,
        total_days: totalDays,
        days_remaining: remaining,
        created_date: created.toLocaleDateString("ar-SA"),
        estimated_delivery: delivery.toLocaleDateString("ar-SA"),
        on_track: remaining > 0,
      }
    };
  }

  if (toolName === "submit_draft_feedback") {
    if (args.approve) {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id, _new_status: "draft_approved",
        _user_id: null, _action_type: "auto", _reason: `موافقة العميل عبر ${AI.name}: ${args.feedback}`,
      });
      if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "فشل التحديث" };
      return { success: true, result: { message: "تمت الموافقة على المسودة بنجاح. الخطوة التالية: سداد الدفعة النهائية." } };
    }
    await db.from("audit_logs").insert({
      action: "create", table_name: "client_feedback", record_id: args.assignment_id, assignment_id: args.assignment_id,
      description: `ملاحظات العميل على المسودة: ${args.feedback}`,
    });
    return { success: true, result: { message: "تم إرسال ملاحظاتك بنجاح. سيتم مراجعتها وتحديث المسودة." } };
  }

  if (toolName === "request_scope_approval") {
    if (args.approved !== false) {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id, _new_status: "scope_approved",
        _user_id: null, _action_type: "auto", _reason: `موافقة العميل على نطاق العمل عبر ${AI.name}`,
      });
      if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "فشل التحديث" };
      return { success: true, result: { message: "تمت الموافقة على نطاق العمل. الخطوة التالية: سداد الدفعة الأولى (50%)." } };
    }
    return { success: true, result: { message: "تم تسجيل رفضك. يرجى توضيح ملاحظاتك ليتم مراجعة النطاق." } };
  }

  if (toolName === "cancel_my_request") {
    const { data: result, error } = await db.rpc("update_request_status", {
      _assignment_id: args.assignment_id, _new_status: "cancelled",
      _user_id: null, _action_type: "auto", _reason: `إلغاء بطلب العميل: ${args.reason}`,
    });
    if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "لا يمكن الإلغاء من الحالة الحالية" };
    return { success: true, result: { message: `تم إلغاء الطلب بنجاح. السبب: ${args.reason}` } };
  }

  if (toolName === "get_missing_requirements") {
    const [subjRes, attachRes, inspRes, compRes, assumRes] = await Promise.all([
      db.from("subjects").select("id, city_ar, land_area").eq("assignment_id", args.assignment_id),
      db.from("attachments").select("id, category").eq("assignment_id", args.assignment_id),
      db.from("inspections").select("id, completed, status").eq("assignment_id", args.assignment_id).limit(1),
      db.from("assignment_comparables").select("id").eq("assignment_id", args.assignment_id),
      db.from("assumptions").select("id").eq("assignment_id", args.assignment_id),
    ]);

    const missing: string[] = [];
    if (!(subjRes.data?.length)) missing.push("بيانات العقار (موقع، مساحة)");
    if ((attachRes.data?.length || 0) < 2) missing.push("مستندات داعمة (صك، رخصة، الخ)");
    const photoCategories = (attachRes.data || []).map((a: any) => a.category);
    if (!photoCategories.includes("photo")) missing.push("صور العقار");
    if (!photoCategories.includes("deed")) missing.push("صورة الصك");

    return {
      success: true,
      result: {
        total_missing: missing.length,
        missing_items: missing,
        documents_uploaded: attachRes.data?.length || 0,
        status: missing.length === 0 ? "مكتمل ✅" : `${missing.length} متطلبات ناقصة ⚠️`,
      }
    };
  }

  return null; // Not handled by this module
}
