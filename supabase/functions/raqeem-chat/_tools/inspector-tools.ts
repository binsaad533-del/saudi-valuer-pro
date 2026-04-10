// Inspector tools — extracted from index.ts without logic changes
import { ToolResult } from "./helpers.ts";

export async function execute(
  toolName: string,
  args: any,
  db: any,
): Promise<ToolResult | null> {

  if (toolName === "get_my_tasks") {
    const { data: inspections } = await db.from("inspections")
      .select("id, assignment_id, inspection_date, status, notes_ar, valuation_assignments(reference_number, property_type, valuation_type, subjects(city_ar, district_ar, address_ar))")
      .order("inspection_date", { ascending: false })
      .limit(20);

    const statusFilter = args.status_filter || "all";
    let filtered = inspections || [];
    if (statusFilter === "pending") filtered = filtered.filter((i: any) => !["completed", "submitted"].includes(i.status));
    if (statusFilter === "completed") filtered = filtered.filter((i: any) => ["completed", "submitted"].includes(i.status));

    return {
      success: true,
      result: {
        total: filtered.length,
        tasks: filtered.map((i: any) => ({
          inspection_id: i.id,
          assignment_id: i.assignment_id,
          reference: i.valuation_assignments?.reference_number || "—",
          date: i.inspection_date,
          status: i.status,
          property_type: i.valuation_assignments?.property_type || "—",
          location: i.valuation_assignments?.subjects?.[0]?.city_ar || i.valuation_assignments?.subjects?.city_ar || "—",
          address: i.valuation_assignments?.subjects?.[0]?.address_ar || i.valuation_assignments?.subjects?.address_ar || "—",
        })),
      }
    };
  }

  if (toolName === "get_task_details") {
    const { data: assignment } = await db.from("valuation_assignments")
      .select("*, subjects(*), clients(name_ar, phone), valuation_requests(property_description, notes, valuation_mode)")
      .eq("id", args.assignment_id)
      .single();
    if (!assignment) return { success: false, result: null, error: "لم يتم العثور على المهمة" };

    const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
    return {
      success: true,
      result: {
        reference: assignment.reference_number,
        status: assignment.status,
        property_type: assignment.property_type,
        valuation_type: assignment.valuation_type,
        valuation_mode: assignment.valuation_requests?.valuation_mode || assignment.valuation_mode,
        client_name: assignment.clients?.name_ar || "—",
        client_phone: assignment.clients?.phone || "—",
        location: { city: subject?.city_ar, district: subject?.district_ar, address: subject?.address_ar },
        description: assignment.valuation_requests?.property_description || "—",
        notes: assignment.valuation_requests?.notes || assignment.notes || "—",
      }
    };
  }

  if (toolName === "submit_inspection_status") {
    const statusMap: Record<string, string> = { in_progress: "in_progress", completed: "submitted", postponed: "postponed" };
    const dbStatus = statusMap[args.new_status] || args.new_status;
    
    const updateData: any = { status: dbStatus, updated_at: new Date().toISOString() };
    if (args.new_status === "completed") {
      updateData.completed = true;
      updateData.submitted_at = new Date().toISOString();
    }
    if (args.notes) updateData.notes_ar = args.notes;

    const { error } = await db.from("inspections").update(updateData).eq("id", args.inspection_id);
    if (error) return { success: false, result: null, error: error.message };
    return { success: true, result: { message: `تم تحديث حالة المعاينة إلى: ${args.new_status}` } };
  }

  if (toolName === "report_field_issue") {
    const issueLabels: Record<string, string> = {
      access_denied: "عدم إتاحة الوصول",
      wrong_address: "عنوان خاطئ",
      safety_concern: "خطر أمني",
      client_absent: "العميل غير موجود",
      other: "أخرى",
    };

    await db.from("notifications").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      title_ar: `⚠️ مشكلة ميدانية: ${issueLabels[args.issue_type] || args.issue_type}`,
      body_ar: args.description,
      category: "inspection",
      priority: "critical",
      notification_type: "field_issue",
      channel: "in_app",
      delivery_status: "delivered",
      related_assignment_id: args.assignment_id,
    });

    await db.from("audit_logs").insert({
      action: "create",
      table_name: "inspections",
      record_id: args.assignment_id,
      assignment_id: args.assignment_id,
      description: `مشكلة ميدانية: ${issueLabels[args.issue_type]} — ${args.description}`,
    });

    return { success: true, result: { message: "تم الإبلاغ عن المشكلة الميدانية وإرسال إشعار للإدارة" } };
  }

  if (toolName === "get_my_schedule") {
    const { data: upcoming } = await db.from("inspections")
      .select("id, assignment_id, inspection_date, inspection_time, status, valuation_assignments(reference_number, property_type, subjects(city_ar, address_ar))")
      .in("status", ["scheduled", "pending", "in_progress"])
      .gte("inspection_date", new Date().toISOString().split("T")[0])
      .order("inspection_date", { ascending: true })
      .limit(15);

    return {
      success: true,
      result: {
        total: upcoming?.length || 0,
        schedule: (upcoming || []).map((i: any) => ({
          inspection_id: i.id,
          reference: i.valuation_assignments?.reference_number || "—",
          date: i.inspection_date,
          time: i.inspection_time || "غير محدد",
          status: i.status,
          location: i.valuation_assignments?.subjects?.[0]?.city_ar || "—",
          address: i.valuation_assignments?.subjects?.[0]?.address_ar || "—",
        })),
      }
    };
  }

  if (toolName === "get_inspection_checklist") {
    const { data: items } = await db.from("inspection_checklist_items")
      .select("id, category, label_ar, is_checked, is_required, value, notes, sort_order")
      .eq("inspection_id", args.inspection_id)
      .order("sort_order", { ascending: true });

    const total = items?.length || 0;
    const checked = (items || []).filter((i: any) => i.is_checked).length;
    const required = (items || []).filter((i: any) => i.is_required);
    const requiredMissing = required.filter((i: any) => !i.is_checked);

    return {
      success: true,
      result: {
        total, checked, remaining: total - checked,
        required_missing: requiredMissing.length,
        completion: total > 0 ? Math.round((checked / total) * 100) : 0,
        items: (items || []).map((i: any) => ({
          id: i.id, category: i.category, label: i.label_ar,
          checked: i.is_checked, required: i.is_required, value: i.value, notes: i.notes,
        })),
      }
    };
  }

  if (toolName === "update_checklist_item") {
    const updateData: any = { is_checked: args.is_checked };
    if (args.value) updateData.value = args.value;
    if (args.notes) updateData.notes = args.notes;

    const { error } = await db.from("inspection_checklist_items").update(updateData).eq("id", args.item_id);
    if (error) return { success: false, result: null, error: error.message };
    return { success: true, result: { message: `تم تحديث البند ${args.is_checked ? "✅" : "❌"}` } };
  }

  if (toolName === "get_my_photos_status") {
    const { data: photos } = await db.from("inspection_photos")
      .select("id, category, file_name, created_at")
      .eq("inspection_id", args.inspection_id);

    const categoryCounts: Record<string, number> = {};
    for (const p of (photos || [])) categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;

    const requiredCategories = ["exterior", "interior", "entrance", "street", "surroundings"];
    const missingCategories = requiredCategories.filter(c => !categoryCounts[c]);

    return {
      success: true,
      result: {
        total_photos: photos?.length || 0,
        by_category: categoryCounts,
        missing_categories: missingCategories,
        status: missingCategories.length === 0 ? "مكتمل ✅" : `${missingCategories.length} فئات ناقصة`,
      }
    };
  }

  if (toolName === "get_my_performance") {
    const { data: inspections } = await db.from("inspections")
      .select("id, status, completed, inspection_date, duration_minutes")
      .order("created_at", { ascending: false }).limit(100);

    const total = inspections?.length || 0;
    const completed = (inspections || []).filter((i: any) => i.completed).length;
    const avgDuration = (inspections || [])
      .filter((i: any) => i.duration_minutes)
      .reduce((s: number, i: any, _, arr: any[]) => s + (i.duration_minutes / arr.length), 0);

    const { data: evals } = await db.from("inspector_evaluations")
      .select("rating, quality_score, speed_score, notes")
      .order("created_at", { ascending: false }).limit(10);

    const avgRating = (evals || []).length > 0
      ? (evals || []).reduce((s: number, e: any) => s + e.rating, 0) / evals!.length : 0;

    return {
      success: true,
      result: {
        total_tasks: total, completed_tasks: completed,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        avg_duration_minutes: Math.round(avgDuration),
        avg_rating: Math.round(avgRating * 10) / 10,
        recent_evaluations: (evals || []).slice(0, 3).map((e: any) => ({
          rating: e.rating, quality: e.quality_score, speed: e.speed_score, notes: e.notes,
        })),
      }
    };
  }

  if (toolName === "request_task_postponement") {
    const { error } = await db.from("inspections")
      .update({ status: "postponed", notes_ar: `طلب تأجيل: ${args.reason}${args.suggested_date ? ` | التاريخ البديل: ${args.suggested_date}` : ""}`, updated_at: new Date().toISOString() })
      .eq("id", args.inspection_id);
    if (error) return { success: false, result: null, error: error.message };

    await db.from("notifications").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      title_ar: "طلب تأجيل معاينة",
      body_ar: `معاين يطلب تأجيل معاينة. السبب: ${args.reason}`,
      category: "inspection", priority: "high",
      notification_type: "postponement_request", channel: "in_app", delivery_status: "delivered",
    });

    return { success: true, result: { message: "تم إرسال طلب التأجيل للإدارة" } };
  }

  return null; // Not handled by this module
}
