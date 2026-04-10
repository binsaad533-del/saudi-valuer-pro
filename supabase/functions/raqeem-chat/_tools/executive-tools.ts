// Executive/Owner tools — extracted from index.ts without logic changes
import { AI } from "../../_shared/assistantIdentity.ts";
import { ToolResult, callInternalFunction } from "./helpers.ts";

export async function execute(
  toolName: string,
  args: any,
  db: any,
  supabaseUrl: string,
  serviceKey: string,
): Promise<ToolResult | null> {

  if (toolName === "change_assignment_status") {
    const { data: result, error } = await db.rpc("update_request_status", {
      _assignment_id: args.assignment_id,
      _new_status: args.new_status,
      _user_id: null,
      _action_type: "normal",
      _reason: args.reason || AI.actionVia("تغيير بطلب المالك"),
    });
    if (error) return { success: false, result: null, error: error.message };
    return { success: result?.success ?? false, result, error: result?.error };
  }

  if (toolName === "assign_inspector") {
    let inspectorId = args.inspector_user_id;
    if (!inspectorId) {
      const query = db.from("inspector_profiles")
        .select("user_id, availability_status, current_workload, cities_ar, avg_rating")
        .eq("is_active", true)
        .eq("availability_status", "available")
        .order("current_workload", { ascending: true })
        .order("avg_rating", { ascending: false })
        .limit(5);
      
      const { data: inspectors } = await query;
      if (!inspectors?.length) return { success: false, result: null, error: "لا يوجد معاينون متاحون حالياً" };
      
      if (args.city) {
        const cityMatch = inspectors.find((i: any) => i.cities_ar?.some((c: string) => c.includes(args.city)));
        inspectorId = cityMatch?.user_id || inspectors[0].user_id;
      } else {
        inspectorId = inspectors[0].user_id;
      }
    }

    const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", inspectorId).single();

    const { error: inspError } = await db.from("inspections").insert({
      assignment_id: args.assignment_id,
      inspector_id: inspectorId,
      inspection_date: new Date().toISOString().split("T")[0],
      status: "scheduled",
    });
    if (inspError) return { success: false, result: null, error: inspError.message };

    await db.from("valuation_assignments").update({ inspector_id: inspectorId, updated_at: new Date().toISOString() }).eq("id", args.assignment_id);

    return { success: true, result: { inspector_name: profile?.full_name_ar || "معاين", inspector_id: inspectorId, assignment_id: args.assignment_id } };
  }

  if (toolName === "get_performance_report") {
    const periodMap: Record<string, number> = { today: 1, week: 7, month: 30, quarter: 90 };
    const days = periodMap[args.period] || 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [assignmentsRes, paymentsRes, inspectionsRes] = await Promise.all([
      db.from("valuation_assignments").select("id, status, created_at, updated_at").gte("created_at", since),
      db.from("payments").select("amount, payment_status, created_at").gte("created_at", since),
      db.from("inspections").select("id, status, completed").gte("created_at", since),
    ]);

    const assignments = assignmentsRes.data || [];
    const payments = paymentsRes.data || [];
    const inspections = inspectionsRes.data || [];

    const statusCounts: Record<string, number> = {};
    for (const a of assignments) { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; }

    const totalRevenue = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const completedInspections = inspections.filter((i: any) => i.completed || i.status === "completed").length;

    return {
      success: true,
      result: {
        period: args.period,
        total_assignments: assignments.length,
        status_breakdown: statusCounts,
        total_revenue: totalRevenue,
        total_inspections: inspections.length,
        completed_inspections: completedInspections,
        pending_payments: payments.filter((p: any) => p.payment_status === "pending").length,
      }
    };
  }

  if (toolName === "get_overdue_summary") {
    const now = new Date();
    const [staleRes, overduePayRes, overdueInspRes] = await Promise.all([
      db.from("valuation_assignments").select("id, reference_number, status, updated_at").not("status", "in", "(issued,archived,cancelled,draft)").lt("updated_at", new Date(now.getTime() - 48 * 3600000).toISOString()).order("updated_at").limit(20),
      db.from("invoices").select("id, invoice_number, total_amount, due_date").eq("payment_status", "pending").lt("due_date", now.toISOString()).limit(20),
      db.from("inspections").select("id, assignment_id, inspection_date, status").in("status", ["scheduled", "pending"]).lt("inspection_date", now.toISOString().split("T")[0]).limit(20),
    ]);

    return {
      success: true,
      result: {
        stale_assignments: (staleRes.data || []).map((a: any) => ({ ref: a.reference_number, status: a.status, days_stale: Math.floor((now.getTime() - new Date(a.updated_at).getTime()) / 86400000) })),
        overdue_invoices: (overduePayRes.data || []).map((i: any) => ({ number: i.invoice_number, amount: i.total_amount, days_overdue: Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000) })),
        overdue_inspections: (overdueInspRes.data || []).map((i: any) => ({ assignment_id: i.assignment_id, date: i.inspection_date })),
      }
    };
  }

  if (toolName === "confirm_payment") {
    const { data: req } = await db.from("valuation_requests").select("id").eq("assignment_id", args.assignment_id).single();
    if (!req) return { success: false, result: null, error: "لم يتم العثور على الطلب المرتبط" };

    const { error: payError } = await db.from("payments").insert({
      request_id: req.id,
      assignment_id: args.assignment_id,
      amount: args.amount || 0,
      payment_stage: args.payment_stage,
      payment_status: "paid",
      payment_type: "bank_transfer",
      is_mock: false,
    });
    if (payError) return { success: false, result: null, error: payError.message };

    return { success: true, result: { message: `تم تأكيد ${args.payment_stage === "first" ? "الدفعة الأولى" : "الدفعة النهائية"} بنجاح`, assignment_id: args.assignment_id } };
  }

  if (toolName === "get_revenue_summary") {
    const periodMap: Record<string, number> = { today: 1, week: 7, month: 30, quarter: 90, year: 365 };
    const days = periodMap[args.period] || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: payments } = await db.from("payments").select("amount, payment_status, payment_stage, created_at").gte("created_at", since);
    const paid = (payments || []).filter((p: any) => p.payment_status === "paid");
    const pending = (payments || []).filter((p: any) => p.payment_status === "pending");

    return {
      success: true,
      result: {
        period: args.period,
        total_collected: paid.reduce((s: number, p: any) => s + (p.amount || 0), 0),
        pending_amount: pending.reduce((s: number, p: any) => s + (p.amount || 0), 0),
        total_transactions: (payments || []).length,
        paid_count: paid.length,
        pending_count: pending.length,
      }
    };
  }

  if (toolName === "get_inspector_tasks") {
    let query = db.from("inspections").select("id, assignment_id, inspector_id, inspection_date, status, completed, created_at");
    if (args.inspector_user_id) query = query.eq("inspector_id", args.inspector_user_id);
    if (args.status_filter === "pending") query = query.in("status", ["scheduled", "pending"]);
    else if (args.status_filter === "completed") query = query.eq("status", "completed");
    query = query.order("inspection_date", { ascending: false }).limit(30);

    const { data: tasks } = await query;
    
    const assignmentIds = [...new Set((tasks || []).map((t: any) => t.assignment_id))];
    const { data: assignments } = assignmentIds.length > 0 
      ? await db.from("valuation_assignments").select("id, reference_number").in("id", assignmentIds) 
      : { data: [] };
    const refMap: Record<string, string> = {};
    for (const a of (assignments || [])) refMap[a.id] = a.reference_number;

    return {
      success: true,
      result: {
        total: (tasks || []).length,
        tasks: (tasks || []).map((t: any) => ({
          reference: refMap[t.assignment_id] || t.assignment_id,
          date: t.inspection_date,
          status: t.status,
          completed: t.completed,
        })),
      }
    };
  }

  if (toolName === "create_valuation_request") {
    let clientId: string | null = null;
    const { data: existingClient } = await db.from("clients")
      .select("id, name_ar")
      .or(`name_ar.eq.${args.client_name},phone.eq.${args.client_phone || "NONE"}`)
      .limit(1)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: org } = await db.from("organizations").select("id").limit(1).single();
      if (!org) return { success: false, result: null, error: "لا توجد منشأة مسجلة" };

      const { data: newClient, error: clientErr } = await db.from("clients").insert({
        name_ar: args.client_name,
        phone: args.client_phone || null,
        email: args.client_email || null,
        organization_id: org.id,
        client_type: "individual",
        client_status: "active",
      }).select("id").single();
      if (clientErr) return { success: false, result: null, error: clientErr.message };
      clientId = newClient.id;
    }

    const { data: orgData } = await db.from("organizations").select("id").limit(1).single();
    
    const { data: assignment, error: assignErr } = await db.from("valuation_assignments").insert({
      organization_id: orgData!.id,
      client_id: clientId,
      property_type: args.property_type || "residential",
      valuation_type: args.valuation_type || "real_estate",
      valuation_mode: args.valuation_mode || "field",
      purpose: args.purpose || "sale_purchase",
      status: "draft",
      reference_number: "",
      sequential_number: 0,
      report_language: "ar",
      notes: args.description || AI.actionVia("طلب مُنشأ"),
    }).select("id, reference_number").single();

    if (assignErr) return { success: false, result: null, error: assignErr.message };

    return {
      success: true,
      result: {
        message: "تم إنشاء طلب التقييم بنجاح",
        assignment_id: assignment.id,
        reference_number: assignment.reference_number,
        client_name: args.client_name,
        property_type: args.property_type,
        city: args.city || "غير محدد",
      }
    };
  }

  if (toolName === "generate_invoice") {
    const { data: assignment } = await db.from("valuation_assignments")
      .select("id, reference_number, client_id")
      .eq("id", args.assignment_id).single();
    if (!assignment) return { success: false, result: null, error: "لم يتم العثور على المهمة" };

    const { data: req } = await db.from("valuation_requests")
      .select("id, total_price")
      .eq("assignment_id", args.assignment_id).maybeSingle();

    const totalPrice = req?.total_price || 5000;
    const invoiceAmount = args.invoice_type === "first" ? totalPrice * 0.5 : totalPrice * 0.5;
    const vatAmount = invoiceAmount * 0.15;

    const { data: invoice, error: invErr } = await db.from("invoices").insert({
      assignment_id: args.assignment_id,
      request_id: req?.id || null,
      client_id: assignment.client_id,
      invoice_number: "",
      subtotal: invoiceAmount,
      vat_amount: vatAmount,
      total_amount: invoiceAmount + vatAmount,
      payment_status: "pending",
      payment_stage: args.invoice_type,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      notes: args.invoice_type === "first" ? "الدفعة الأولى (50%)" : "الدفعة النهائية (50%)",
    }).select("id, invoice_number, total_amount").single();

    if (invErr) return { success: false, result: null, error: invErr.message };

    return {
      success: true,
      result: {
        invoice_number: invoice.invoice_number,
        amount: invoice.total_amount,
        type: args.invoice_type === "first" ? "الدفعة الأولى" : "الدفعة النهائية",
        reference: assignment.reference_number,
      }
    };
  }

  if (toolName === "search_assignments") {
    let query = db.from("valuation_assignments")
      .select("id, reference_number, status, property_type, created_at, updated_at, client_id, clients(name_ar)")
      .order("created_at", { ascending: false })
      .limit(args.limit || 20);

    if (args.status) query = query.eq("status", args.status);
    if (args.property_type) query = query.eq("property_type", args.property_type);
    if (args.reference_number) query = query.ilike("reference_number", `%${args.reference_number}%`);
    if (args.date_from) query = query.gte("created_at", args.date_from);
    if (args.date_to) query = query.lte("created_at", args.date_to);

    const { data: results, error: searchErr } = await query;
    if (searchErr) return { success: false, result: null, error: searchErr.message };

    let filtered = results || [];
    if (args.client_name) {
      filtered = filtered.filter((r: any) => r.clients?.name_ar?.includes(args.client_name));
    }

    return {
      success: true,
      result: {
        total: filtered.length,
        assignments: filtered.map((a: any) => ({
          reference: a.reference_number,
          status: a.status,
          type: a.property_type,
          client: a.clients?.name_ar || "غير محدد",
          created: new Date(a.created_at).toLocaleDateString("ar-SA"),
        })),
      }
    };
  }

  if (toolName === "reassign_inspector") {
    const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", args.new_inspector_user_id).single();

    const { error: updErr } = await db.from("valuation_assignments")
      .update({ inspector_id: args.new_inspector_user_id, updated_at: new Date().toISOString() })
      .eq("id", args.assignment_id);
    if (updErr) return { success: false, result: null, error: updErr.message };

    await db.from("inspections")
      .update({ inspector_id: args.new_inspector_user_id })
      .eq("assignment_id", args.assignment_id)
      .in("status", ["scheduled", "pending"]);

    await db.from("audit_logs").insert({
      action: "update",
      table_name: "valuation_assignments",
      record_id: args.assignment_id,
      assignment_id: args.assignment_id,
      description: `نقل المعاينة إلى ${profile?.full_name_ar || "معاين جديد"} — السبب: ${args.reason || "بطلب المالك"}`,
    });

    return { success: true, result: { message: `تم نقل المعاينة إلى ${profile?.full_name_ar || "المعاين الجديد"}`, inspector: profile?.full_name_ar } };
  }

  if (toolName === "send_notification") {
    const { error: notifErr } = await db.from("notifications").insert({
      user_id: args.user_id,
      title_ar: args.title,
      body_ar: args.body,
      category: args.category || "general",
      priority: args.priority || "normal",
      notification_type: "custom_from_raqeem",
      channel: "in_app",
      delivery_status: "delivered",
      related_assignment_id: args.assignment_id || null,
      related_request_id: args.request_id || null,
    });
    if (notifErr) return { success: false, result: null, error: notifErr.message };
    return { success: true, result: { message: "تم إرسال الإشعار بنجاح", assignment_id: args.assignment_id || null, request_id: args.request_id || null } };
  }

  if (toolName === "update_follow_up_priority") {
    let assignmentId = args.assignment_id;
    let requestId = args.request_id;

    if (!assignmentId && requestId) {
      const { data: reqLink } = await db.from("valuation_requests").select("assignment_id").eq("id", requestId).maybeSingle();
      assignmentId = reqLink?.assignment_id || null;
    }
    if (!requestId && assignmentId) {
      const { data: requestLink } = await db.from("valuation_requests").select("id").eq("assignment_id", assignmentId).maybeSingle();
      requestId = requestLink?.id || null;
    }
    if (!assignmentId) return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لتحديث أولوية المتابعة" };

    const { data: previous } = await db.from("valuation_assignments").select("priority").eq("id", assignmentId).maybeSingle();
    const { error: updErr } = await db.from("valuation_assignments")
      .update({ priority: args.priority, updated_at: new Date().toISOString() })
      .eq("id", assignmentId);
    if (updErr) return { success: false, result: null, error: updErr.message };

    await db.from("audit_logs").insert({
      action: "update",
      table_name: "valuation_assignments",
      record_id: assignmentId,
      assignment_id: assignmentId,
      description: `تحديث أولوية المتابعة من ${previous?.priority || "غير محددة"} إلى ${args.priority}${args.reason ? ` | السبب: ${args.reason}` : ""}`,
      old_data: { priority: previous?.priority || null },
      new_data: { priority: args.priority, request_id: requestId || null, reason: args.reason || null },
    });

    return { success: true, result: { message: `تم تحديث أولوية المتابعة إلى ${args.priority}`, assignment_id: assignmentId, request_id: requestId || null, priority: args.priority } };
  }

  if (toolName === "add_assignment_note") {
    let assignmentId = args.assignment_id;
    let requestId = args.request_id;

    if (!assignmentId && requestId) {
      const { data: reqLink } = await db.from("valuation_requests").select("assignment_id").eq("id", requestId).maybeSingle();
      assignmentId = reqLink?.assignment_id || null;
    }
    if (!requestId && assignmentId) {
      const { data: requestLink } = await db.from("valuation_requests").select("id").eq("assignment_id", assignmentId).maybeSingle();
      requestId = requestLink?.id || null;
    }
    if (!assignmentId) return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لإضافة الملاحظة" };

    const { data: previous } = await db.from("valuation_assignments").select("notes").eq("id", assignmentId).maybeSingle();
    const mergedNotes = [previous?.notes, args.note].filter(Boolean).join("\n\n");
    const { error: updErr } = await db.from("valuation_assignments")
      .update({ notes: mergedNotes, updated_at: new Date().toISOString() })
      .eq("id", assignmentId);
    if (updErr) return { success: false, result: null, error: updErr.message };

    await db.from("audit_logs").insert({
      action: "update",
      table_name: "valuation_assignments",
      record_id: assignmentId,
      assignment_id: assignmentId,
      description: `إضافة ملاحظة تنفيذية على الطلب${requestId ? ` | request_id: ${requestId}` : ""}`,
      old_data: { notes: previous?.notes || null },
      new_data: { note: args.note, notes: mergedNotes, request_id: requestId || null },
    });

    return { success: true, result: { message: "تمت إضافة الملاحظة بنجاح", assignment_id: assignmentId, request_id: requestId || null, note: args.note } };
  }

  if (toolName === "get_client_summary") {
    let clientQuery = db.from("clients").select("id, name_ar, phone, email, client_type, client_status, created_at");
    if (args.client_id) clientQuery = clientQuery.eq("id", args.client_id);
    else if (args.client_name) clientQuery = clientQuery.ilike("name_ar", `%${args.client_name}%`);
    
    const { data: clients } = await clientQuery.limit(1).maybeSingle();
    if (!clients) return { success: false, result: null, error: "لم يتم العثور على العميل" };

    const [assignRes, payRes] = await Promise.all([
      db.from("valuation_assignments").select("id, reference_number, status, created_at, property_type").eq("client_id", clients.id).order("created_at", { ascending: false }).limit(10),
      db.from("payments").select("amount, payment_status, payment_stage, created_at").eq("request_id", clients.id),
    ]);

    const assignments = assignRes.data || [];
    const payments = payRes.data || [];
    const totalPaid = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);

    return {
      success: true,
      result: {
        client: { name: clients.name_ar, phone: clients.phone, email: clients.email, type: clients.client_type, status: clients.client_status, since: new Date(clients.created_at).toLocaleDateString("ar-SA") },
        total_assignments: assignments.length,
        active_assignments: assignments.filter((a: any) => !["issued", "archived", "cancelled"].includes(a.status)).length,
        total_paid: totalPaid,
        recent_assignments: assignments.slice(0, 5).map((a: any) => ({ ref: a.reference_number, status: a.status, type: a.property_type })),
      }
    };
  }

  if (toolName === "bulk_status_update") {
    const results: any[] = [];
    for (const assignId of args.assignment_ids) {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: assignId,
        _new_status: args.new_status,
        _user_id: null,
        _action_type: "normal",
        _reason: args.reason || AI.actionVia("تحديث جماعي"),
      });
      results.push({ assignment_id: assignId, success: !error && result?.success, error: error?.message || result?.error });
    }
    const successCount = results.filter(r => r.success).length;
    return { success: successCount > 0, result: { total: results.length, succeeded: successCount, failed: results.length - successCount, details: results } };
  }

  if (toolName === "get_dashboard_summary") {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [assignRes, payRes, inspRes, notifRes, recentRes] = await Promise.all([
      db.from("valuation_assignments").select("id, status, created_at, updated_at").not("status", "in", "(cancelled)"),
      db.from("payments").select("amount, payment_status, payment_stage, created_at").gte("created_at", weekAgo),
      db.from("inspections").select("id, status, completed, inspection_date").gte("created_at", weekAgo),
      db.from("notifications").select("id, is_read").eq("is_read", false).limit(100),
      db.from("valuation_assignments").select("id, reference_number, status, created_at, updated_at, clients(name_ar)").order("created_at", { ascending: false }).limit(5),
    ]);

    const assignments = assignRes.data || [];
    const statusCounts: Record<string, number> = {};
    for (const a of assignments) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;

    const activeCount = assignments.filter((a: any) => !["issued", "archived", "cancelled", "draft"].includes(a.status)).length;
    const staleCount = assignments.filter((a: any) => {
      if (["issued", "archived", "cancelled"].includes(a.status)) return false;
      return (now.getTime() - new Date(a.updated_at).getTime()) > 48 * 3600000;
    }).length;

    const payments = payRes.data || [];
    const weekRevenue = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const pendingPayments = payments.filter((p: any) => p.payment_status === "pending").length;

    const inspections = inspRes.data || [];
    const completedInsp = inspections.filter((i: any) => i.completed || i.status === "completed").length;
    const pendingInsp = inspections.filter((i: any) => ["scheduled", "pending"].includes(i.status)).length;

    return {
      success: true,
      result: {
        platform_health: staleCount === 0 ? "ممتازة 🟢" : staleCount <= 3 ? "جيدة 🟡" : "تحتاج انتباه 🔴",
        total_assignments: assignments.length,
        active_in_progress: activeCount,
        stale_count: staleCount,
        status_breakdown: statusCounts,
        week_revenue: weekRevenue,
        pending_payments: pendingPayments,
        week_inspections: { total: inspections.length, completed: completedInsp, pending: pendingInsp },
        unread_notifications: (notifRes.data || []).length,
        recent_assignments: (recentRes.data || []).map((a: any) => ({
          ref: a.reference_number, status: a.status, client: a.clients?.name_ar || "—",
          created: new Date(a.created_at).toLocaleDateString("ar-SA"),
        })),
      }
    };
  }

  if (toolName === "get_assignment_details") {
    let query = db.from("valuation_assignments")
      .select("*, clients(name_ar, phone, email, client_type), subjects(city_ar, district_ar, address_ar, land_area, building_area, property_type, description_ar), valuation_requests(total_fees, payment_status, valuation_mode, property_description_ar, purpose)");

    if (args.assignment_id) query = query.eq("id", args.assignment_id);
    else if (args.reference_number) query = query.ilike("reference_number", `%${args.reference_number}%`);
    else return { success: false, result: null, error: "يجب تحديد معرّف المهمة أو الرقم المرجعي" };

    const { data: assignment, error: assignmentError } = await query.maybeSingle();
    if (assignmentError) {
      console.error("[get_assignment_details] Query error:", JSON.stringify(assignmentError));
      return { success: false, result: null, error: `خطأ في الاستعلام: ${assignmentError.message}` };
    }
    if (!assignment) return { success: false, result: null, error: `لم يتم العثور على الطلب (assignment_id: ${args.assignment_id || '—'}, ref: ${args.reference_number || '—'})` };

    const [inspRes, payRes, compRes, assumRes, reportRes] = await Promise.all([
      db.from("inspections").select("id, status, completed, inspection_date, inspector_id").eq("assignment_id", assignment.id).limit(1),
      db.from("payments").select("id, amount, payment_status, payment_stage, created_at").eq("assignment_id", assignment.id),
      db.from("assignment_comparables").select("id").eq("assignment_id", assignment.id),
      db.from("assumptions").select("id").eq("assignment_id", assignment.id),
      db.from("reports").select("id, status, version, is_final").eq("assignment_id", assignment.id).order("version", { ascending: false }).limit(1),
    ]);

    const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
    const client = assignment.clients;
    const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;

    let inspectorName = "—";
    if (assignment.inspector_id) {
      const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", assignment.inspector_id).single();
      inspectorName = profile?.full_name_ar || "—";
    }

    const payments = payRes.data || [];
    const totalPaid = payments.filter((p: any) => p.payment_status === "paid" || p.payment_status === "completed").reduce((s: number, p: any) => s + (p.amount || 0), 0);

    const STATUS_AR: Record<string, string> = {
      submitted: "مقدّم", pending: "قيد الانتظار", intake: "استلام", sow_pending: "بانتظار نطاق العمل",
      sow_approved: "نطاق العمل معتمد", quotation_sent: "عرض السعر مرسل", quotation_approved: "عرض السعر معتمد",
      first_payment_pending: "بانتظار الدفعة الأولى", first_payment_confirmed: "الدفعة الأولى مؤكدة",
      inspection_scheduled: "المعاينة مجدولة", inspection_completed: "المعاينة مكتملة",
      data_collection: "جمع البيانات", valuation_in_progress: "التقييم جارٍ",
      review: "قيد المراجعة", draft_ready: "المسودة جاهزة", draft_sent: "المسودة مرسلة",
      client_approved: "معتمد من العميل", final_payment_pending: "بانتظار الدفعة النهائية",
      final_payment_confirmed: "الدفعة النهائية مؤكدة", completed: "مكتمل", cancelled: "ملغى",
      archived: "مؤرشف", on_hold: "معلّق",
    };
    const PROP_TYPE_AR: Record<string, string> = {
      residential: "سكني", commercial: "تجاري", industrial: "صناعي", land: "أرض",
      mixed_use: "متعدد الاستخدام", agricultural: "زراعي", special_purpose: "أغراض خاصة",
      machinery: "آلات ومعدات", business: "منشأة تجارية", vehicle: "مركبة", equipment: "معدات",
    };
    const VAL_TYPE_AR: Record<string, string> = {
      real_estate: "عقار", machinery: "آلات ومعدات", business: "منشأة تجارية",
      vehicle: "مركبة", equipment: "معدات",
    };
    const PURPOSE_AR: Record<string, string> = {
      sale_purchase: "بيع/شراء", financing: "تمويل", insurance: "تأمين",
      legal: "قانوني/قضائي", financial_reporting: "تقارير مالية",
      zakat_tax: "زكاة وضريبة", other: "أخرى",
    };
    const MODE_AR: Record<string, string> = {
      field: "معاينة ميدانية", desktop_with_photos: "مكتبي بصور", desktop_without_photos: "مكتبي بدون صور",
    };
    const PAY_STATUS_AR: Record<string, string> = {
      unpaid: "غير مدفوع", partial: "مدفوع جزئياً", paid: "مدفوع بالكامل",
      completed: "مدفوع بالكامل", pending: "قيد الانتظار", overdue: "متأخر",
    };
    const CLIENT_TYPE_AR: Record<string, string> = {
      individual: "فرد", company: "شركة", government: "جهة حكومية",
    };
    const INSP_STATUS_AR: Record<string, string> = {
      scheduled: "مجدولة", in_progress: "جارية", completed: "مكتملة",
      submitted: "مُسلَّمة", reviewed: "مُراجَعة", cancelled: "ملغاة",
    };

    const rawMode = req?.valuation_mode || assignment.valuation_mode || "";
    const rawStatus = assignment.status || "";
    const rawPurpose = assignment.purpose || req?.purpose || "";
    const rawPropType = assignment.property_type || "";
    const rawValType = assignment.valuation_type || "";
    const rawPayStatus = req?.payment_status || "";
    const rawClientType = client?.client_type || "";
    const rawInspStatus = inspRes.data?.[0]?.status || "";

    const missingItems: string[] = [];
    if (!subject) missingItems.push("بيانات الأصل/العقار غير مسجلة");
    if (!client?.phone && !client?.email) missingItems.push("بيانات تواصل العميل ناقصة");
    if (!req?.total_fees) missingItems.push("لم يتم التسعير بعد");
    if (!inspRes.data?.length && rawMode === "field") missingItems.push("المعاينة الميدانية غير مجدولة");

    let nextStep = "متابعة سير العمل";
    if (rawStatus === "submitted") nextStep = "مراجعة الطلب وتأكيد التصنيف ثم توليد نطاق العمل";
    else if (rawStatus === "sow_pending") nextStep = "اعتماد نطاق العمل من العميل";
    else if (rawStatus === "quotation_sent") nextStep = "انتظار موافقة العميل على عرض السعر";
    else if (rawStatus === "first_payment_pending") nextStep = "تأكيد استلام الدفعة الأولى";
    else if (rawStatus === "first_payment_confirmed" || rawStatus === "inspection_scheduled") nextStep = "تنفيذ المعاينة الميدانية";
    else if (rawStatus === "inspection_completed" || rawStatus === "data_collection") nextStep = "جمع البيانات وتحليل المقارنات";
    else if (rawStatus === "valuation_in_progress") nextStep = "إكمال التقييم وإعداد المسودة";
    else if (rawStatus === "review") nextStep = "مراجعة التقرير والتحقق من الامتثال";
    else if (rawStatus === "draft_ready" || rawStatus === "draft_sent") nextStep = "انتظار اعتماد العميل للمسودة";
    else if (rawStatus === "final_payment_pending") nextStep = "تأكيد الدفعة النهائية وإصدار التقرير";
    else if (rawStatus === "completed") nextStep = "الطلب مكتمل — لا إجراءات مطلوبة";

    const lines: string[] = [];
    lines.push(`- **رقم الطلب:** ${assignment.reference_number}`);
    lines.push(`- **الحالة:** ${STATUS_AR[rawStatus] || rawStatus}`);

    const purposeAr = PURPOSE_AR[rawPurpose] || "";
    if (purposeAr) lines.push(`- **الغرض:** ${purposeAr}`);

    const propTypeAr = PROP_TYPE_AR[rawPropType] || VAL_TYPE_AR[rawValType] || "";
    if (propTypeAr) lines.push(`- **نوع الأصل:** ${propTypeAr}`);

    const modeAr = MODE_AR[rawMode] || "";
    if (modeAr) lines.push(`- **وضع التنفيذ:** ${modeAr}`);

    if (assignment.final_value) {
      lines.push(`- **القيمة النهائية:** ${Number(assignment.final_value).toLocaleString()} ر.س`);
    }

    if (rawMode === "field" || rawInspStatus) {
      const inspStatus = rawInspStatus ? (INSP_STATUS_AR[rawInspStatus] || "غير محددة") : "غير مجدولة";
      let inspLine = `- **المعاينة:** ${inspStatus}`;
      if (inspectorName !== "—") inspLine += ` — المعاين: ${inspectorName}`;
      if (inspRes.data?.[0]?.inspection_date) inspLine += ` — التاريخ: ${inspRes.data[0].inspection_date}`;
      lines.push(inspLine);
    }

    const payStatusAr = PAY_STATUS_AR[rawPayStatus] || "";
    if (payStatusAr || totalPaid > 0 || req?.total_fees) {
      let payLine = `- **المالية:**`;
      if (req?.total_fees) payLine += ` الرسوم ${Number(req.total_fees).toLocaleString()} ر.س`;
      if (totalPaid > 0) payLine += ` | المدفوع ${totalPaid.toLocaleString()} ر.س`;
      if (payStatusAr) payLine += ` | ${payStatusAr}`;
      lines.push(payLine);
    }

    if (client?.name_ar) {
      const clientTypeAr = CLIENT_TYPE_AR[rawClientType] || "";
      lines.push(`- **العميل:** ${client.name_ar}${clientTypeAr ? ` (${clientTypeAr})` : ""}`);
    }

    if (missingItems.length > 0) {
      lines.push(`- **النواقص:** ${missingItems.join("، ")}`);
    }

    lines.push(`- **الخطوة التالية:** ${nextStep}`);

    return {
      success: true,
      result: lines.join("\n"),
      _format: "markdown",
    };
  }

  if (toolName === "get_audit_trail") {
    let query = db.from("audit_logs")
      .select("action, table_name, description, user_role, created_at, old_data, new_data")
      .order("created_at", { ascending: false })
      .limit(args.limit || 20);

    if (args.assignment_id) query = query.eq("assignment_id", args.assignment_id);
    if (args.table_name) query = query.eq("table_name", args.table_name);

    const { data: logs } = await query;

    let workflowLogs: any[] = [];
    if (args.assignment_id) {
      const { data: wfLogs } = await db.from("request_audit_log")
        .select("old_status, new_status, action_type, reason, user_id, created_at, metadata")
        .eq("assignment_id", args.assignment_id)
        .order("created_at", { ascending: false })
        .limit(20);
      workflowLogs = wfLogs || [];
    }

    return {
      success: true,
      result: {
        audit_logs: (logs || []).map((l: any) => ({
          action: l.action, table: l.table_name, description: l.description, role: l.user_role,
          date: new Date(l.created_at).toLocaleString("ar-SA"),
        })),
        workflow_transitions: workflowLogs.map((w: any) => ({
          from: w.old_status, to: w.new_status, type: w.action_type, reason: w.reason,
          date: new Date(w.created_at).toLocaleString("ar-SA"),
          role: w.metadata?.user_role || "—",
        })),
      }
    };
  }

  if (toolName === "approve_final_value") {
    const { error: updateErr } = await db.from("valuation_assignments")
      .update({ final_value: args.approved_value, updated_at: new Date().toISOString() })
      .eq("id", args.assignment_id);
    if (updateErr) return { success: false, result: null, error: updateErr.message };

    await db.from("audit_logs").insert({
      action: "update",
      table_name: "valuation_assignments",
      record_id: args.assignment_id,
      assignment_id: args.assignment_id,
      description: `اعتماد القيمة النهائية: ${args.approved_value.toLocaleString()} ر.س${args.justification ? ` | المبرر: ${args.justification}` : ""}`,
      new_data: { approved_value: args.approved_value, approved_at: new Date().toISOString() },
    });

    return { success: true, result: { message: `تم اعتماد القيمة النهائية: ${args.approved_value.toLocaleString()} ر.س`, assignment_id: args.assignment_id } };
  }

  if (toolName === "issue_final_report") {
    const checks: { code: string; label: string; passed: boolean; details?: string }[] = [];

    const { data: assignment } = await db.from("valuation_assignments").select("*, subjects(*)").eq("id", args.assignment_id).single();
    if (!assignment) return { success: false, result: null, error: "المهمة غير موجودة" };

    checks.push({ code: "FINAL_VALUE", label: "القيمة النهائية", passed: !!assignment.final_value, details: assignment.final_value ? `${Number(assignment.final_value).toLocaleString()} ر.س` : "غير محددة" });

    const { data: reports } = await db.from("reports").select("id, content_ar").eq("assignment_id", args.assignment_id).order("version", { ascending: false }).limit(1);
    checks.push({ code: "REPORT", label: "وجود التقرير", passed: !!(reports?.length), details: reports?.length ? "موجود" : "لا يوجد تقرير" });
    if (reports?.[0]) checks.push({ code: "CONTENT", label: "محتوى التقرير", passed: !!reports[0].content_ar });

    const { count: assumCount } = await db.from("assumptions").select("id", { count: "exact", head: true }).eq("assignment_id", args.assignment_id);
    checks.push({ code: "ASSUMPTIONS", label: "الافتراضات", passed: (assumCount || 0) > 0, details: `${assumCount || 0} بند` });

    if (assignment.valuation_mode !== "desktop") {
      const { data: insp } = await db.from("inspections").select("completed, status").eq("assignment_id", args.assignment_id).limit(1);
      const inspDone = insp?.[0]?.completed || insp?.[0]?.status === "completed";
      checks.push({ code: "INSPECTION", label: "المعاينة", passed: !!inspDone });
    }

    const { data: compChecks } = await db.from("compliance_checks").select("is_passed, is_mandatory").eq("assignment_id", args.assignment_id);
    if (compChecks?.length) {
      const mandatoryFailed = compChecks.filter((c: any) => c.is_mandatory && !c.is_passed);
      checks.push({ code: "COMPLIANCE", label: "فحوصات الامتثال", passed: mandatoryFailed.length === 0, details: mandatoryFailed.length > 0 ? `${mandatoryFailed.length} فحوصات فاشلة` : "جميعها ناجحة" });
    }

    const { data: linkedReq } = await db.from("valuation_requests").select("id").eq("assignment_id", args.assignment_id).maybeSingle();
    if (linkedReq) {
      const { data: finalPay } = await db.from("payments").select("id").eq("request_id", linkedReq.id).eq("payment_stage", "final").eq("payment_status", "paid").limit(1);
      checks.push({ code: "PAYMENT", label: "الدفعة النهائية", passed: !!(finalPay?.length), details: finalPay?.length ? "مدفوعة" : "غير مدفوعة" });
    }

    const failedChecks = checks.filter(c => !c.passed);
    const canIssue = failedChecks.length === 0;

    if (!canIssue && !args.bypass_justification) {
      return {
        success: false,
        result: {
          can_issue: false,
          passed: checks.filter(c => c.passed).length,
          total: checks.length,
          checks,
          blocked_reasons: failedChecks.map(c => `${c.label}: ${c.details || "لم يجتز"}`),
          message: "لا يمكن الإصدار — يوجد بوابات فاشلة. يمكنك تقديم مبرر للتجاوز.",
        },
        error: "بوابات فاشلة تمنع الإصدار"
      };
    }

    const { data: result, error: statusErr } = await db.rpc("update_request_status", {
      _assignment_id: args.assignment_id,
      _new_status: "issued",
      _user_id: null,
      _action_type: args.bypass_justification ? "bypass" : "normal",
      _reason: AI.actionVia("إصدار التقرير النهائي"),
      _bypass_justification: args.bypass_justification || null,
    });

    if (statusErr || !result?.success) {
      return { success: false, result: null, error: statusErr?.message || result?.error || "فشل الإصدار" };
    }

    return {
      success: true,
      result: {
        message: "✅ تم إصدار التقرير النهائي بنجاح",
        checks_passed: checks.filter(c => c.passed).length,
        total_checks: checks.length,
        bypassed: !!args.bypass_justification,
      }
    };
  }

  if (toolName === "cancel_assignment") {
    const { data: result, error } = await db.rpc("update_request_status", {
      _assignment_id: args.assignment_id,
      _new_status: "cancelled",
      _user_id: null,
      _action_type: "normal",
      _reason: args.reason,
    });
    if (error) return { success: false, result: null, error: error.message };
    if (!result?.success) return { success: false, result: null, error: result?.error || "لا يمكن الإلغاء من الحالة الحالية" };
    return { success: true, result: { message: `تم إلغاء الطلب بنجاح | السبب: ${args.reason}` } };
  }

  if (toolName === "get_compliance_overview") {
    const { data: active } = await db.from("valuation_assignments")
      .select("id, reference_number, status, final_value, methodology, purpose")
      .not("status", "in", "(issued,archived,cancelled,draft)")
      .order("created_at", { ascending: false })
      .limit(50);

    const overview: any[] = [];
    for (const a of (active || [])) {
      const [subjRes, compRes, assumRes, inspRes] = await Promise.all([
        db.from("subjects").select("id").eq("assignment_id", a.id),
        db.from("assignment_comparables").select("id").eq("assignment_id", a.id),
        db.from("assumptions").select("id").eq("assignment_id", a.id),
        db.from("inspections").select("completed, status").eq("assignment_id", a.id).limit(1),
      ]);

      const score = [
        !!(subjRes.data?.length),
        (compRes.data?.length || 0) >= 3,
        (assumRes.data?.length || 0) > 0,
        !!a.final_value,
        !!a.methodology,
        inspRes.data?.[0]?.completed || inspRes.data?.[0]?.status === "completed",
      ].filter(Boolean).length;

      overview.push({
        ref: a.reference_number, status: a.status,
        compliance_score: Math.round((score / 6) * 100),
        missing: [
          !(subjRes.data?.length) && "بيانات العقار",
          (compRes.data?.length || 0) < 3 && "مقارنات (≥3)",
          !(assumRes.data?.length) && "افتراضات",
          !a.final_value && "القيمة النهائية",
          !a.methodology && "المنهجية",
          !(inspRes.data?.[0]?.completed) && !(inspRes.data?.[0]?.status === "completed") && "المعاينة",
        ].filter(Boolean),
      });
    }

    const avgScore = overview.length > 0 ? Math.round(overview.reduce((s, o) => s + o.compliance_score, 0) / overview.length) : 0;
    return {
      success: true,
      result: {
        total_active: overview.length,
        average_compliance: avgScore,
        fully_compliant: overview.filter(o => o.compliance_score === 100).length,
        needs_attention: overview.filter(o => o.compliance_score < 60).length,
        assignments: overview,
      }
    };
  }

  if (toolName === "get_team_workload") {
    const { data: inspectors } = await db.from("inspector_profiles")
      .select("user_id, is_active, availability_status, current_workload, avg_rating, cities_ar, profiles(full_name_ar)")
      .eq("is_active", true);

    const workloads: any[] = [];
    for (const insp of (inspectors || [])) {
      const [activeRes, completedRes] = await Promise.all([
        db.from("inspections").select("id").eq("inspector_id", insp.user_id).in("status", ["scheduled", "pending", "in_progress"]),
        db.from("inspections").select("id").eq("inspector_id", insp.user_id).in("status", ["completed", "submitted"]),
      ]);

      workloads.push({
        name: insp.profiles?.full_name_ar || "—",
        availability: insp.availability_status,
        active_tasks: activeRes.data?.length || 0,
        completed_tasks: completedRes.data?.length || 0,
        workload: insp.current_workload || 0,
        rating: insp.avg_rating || 0,
        cities: insp.cities_ar || [],
      });
    }

    workloads.sort((a, b) => b.active_tasks - a.active_tasks);
    return {
      success: true,
      result: {
        total_inspectors: workloads.length,
        available: workloads.filter(w => w.availability === "available").length,
        overloaded: workloads.filter(w => w.active_tasks > 5).length,
        inspectors: workloads,
      }
    };
  }

  if (toolName === "get_workflow_bottlenecks") {
    const threshold = (args.hours_threshold || 48) * 3600000;
    const cutoff = new Date(Date.now() - threshold).toISOString();

    const { data: stale } = await db.from("valuation_assignments")
      .select("id, reference_number, status, updated_at, created_at, clients(name_ar)")
      .not("status", "in", "(issued,archived,cancelled,draft)")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(30);

    const bottlenecks: Record<string, any[]> = {};
    for (const a of (stale || [])) {
      if (!bottlenecks[a.status]) bottlenecks[a.status] = [];
      bottlenecks[a.status].push({
        ref: a.reference_number,
        client: a.clients?.name_ar || "—",
        hours_stuck: Math.round((Date.now() - new Date(a.updated_at).getTime()) / 3600000),
        since: new Date(a.updated_at).toLocaleDateString("ar-SA"),
      });
    }

    const stageLabels: Record<string, string> = {
      submitted: "بانتظار التسعير", scope_generated: "بانتظار موافقة العميل", scope_approved: "بانتظار الدفعة الأولى",
      first_payment_confirmed: "بانتظار فتح جمع البيانات", data_collection_open: "جمع بيانات جاري",
      data_collection_complete: "بانتظار المعاينة", inspection_pending: "معاينة معلقة",
      inspection_completed: "بانتظار التحقق", data_validated: "بانتظار التحليل",
      analysis_complete: "بانتظار المراجعة المهنية", professional_review: "مراجعة مهنية جارية",
      draft_report_ready: "بانتظار مراجعة العميل", client_review: "العميل يراجع",
      draft_approved: "بانتظار الدفعة النهائية", final_payment_confirmed: "بانتظار الإصدار",
    };

    return {
      success: true,
      result: {
        total_bottlenecks: (stale || []).length,
        by_stage: Object.entries(bottlenecks).map(([stage, items]) => ({
          stage, label: stageLabels[stage] || stage, count: items.length, assignments: items,
        })),
        recommendation: (stale || []).length === 0
          ? "لا توجد اختناقات — سير العمل يتحرك بسلاسة ✅"
          : `يوجد ${(stale || []).length} طلبات عالقة تحتاج تدخل فوري ⚠️`,
      }
    };
  }

  if (toolName === "update_assignment_pricing") {
    const { data: req } = await db.from("valuation_requests")
      .select("id, total_price")
      .eq("assignment_id", args.assignment_id)
      .maybeSingle();

    const oldPrice = req?.total_price || 0;
    if (req) {
      await db.from("valuation_requests")
        .update({ total_price: args.new_price, updated_at: new Date().toISOString() })
        .eq("id", req.id);
    }

    await db.from("audit_logs").insert({
      action: "update",
      table_name: "valuation_requests",
      record_id: req?.id || args.assignment_id,
      assignment_id: args.assignment_id,
      description: `تعديل التسعير: ${oldPrice} → ${args.new_price} ر.س | السبب: ${args.reason}`,
      old_data: { total_price: oldPrice },
      new_data: { total_price: args.new_price, reason: args.reason },
    });

    return { success: true, result: { message: `تم تعديل السعر من ${oldPrice.toLocaleString()} إلى ${args.new_price.toLocaleString()} ر.س`, old_price: oldPrice, new_price: args.new_price } };
  }

  if (toolName === "manage_discount_code") {
    if (args.action === "create") {
      let clientId: string | null = null;
      if (args.client_name) {
        const { data: client } = await db.from("clients").select("id").ilike("name_ar", `%${args.client_name}%`).limit(1).maybeSingle();
        clientId = client?.id || null;
      }

      const { data: dc, error: dcErr } = await db.from("discount_codes").insert({
        code: args.code.toUpperCase(),
        discount_percentage: args.discount_percentage || 10,
        discount_type: "percentage",
        max_uses: args.max_uses || null,
        client_id: clientId,
        is_active: true,
        expires_at: args.expires_days ? new Date(Date.now() + args.expires_days * 86400000).toISOString() : null,
      }).select("id, code").single();

      if (dcErr) return { success: false, result: null, error: dcErr.message };
      return { success: true, result: { message: `تم إنشاء كود الخصم: ${args.code.toUpperCase()}`, discount_id: dc.id } };
    }

    if (args.action === "deactivate") {
      const { error } = await db.from("discount_codes").update({ is_active: false }).eq("code", args.code.toUpperCase());
      if (error) return { success: false, result: null, error: error.message };
      return { success: true, result: { message: `تم تعطيل كود الخصم: ${args.code.toUpperCase()}` } };
    }

    return { success: false, result: null, error: "إجراء غير معروف" };
  }

  if (toolName === "send_bulk_notifications") {
    let userIds: string[] = args.user_ids || [];

    if (args.target_group === "overdue_clients") {
      const { data: overdueInv } = await db.from("invoices")
        .select("client_id, clients(portal_user_id)")
        .in("status", ["unpaid", "overdue"])
        .lt("due_date", new Date().toISOString())
        .limit(100);
      userIds = (overdueInv || []).map((i: any) => i.clients?.portal_user_id).filter(Boolean);
    } else if (args.target_group === "active_inspectors") {
      const { data: inspectors } = await db.from("inspector_profiles").select("user_id").eq("is_active", true);
      userIds = (inspectors || []).map((i: any) => i.user_id);
    } else if (args.target_group === "all_clients") {
      const { data: clients } = await db.from("clients").select("portal_user_id").not("portal_user_id", "is", null).eq("is_active", true).limit(200);
      userIds = (clients || []).map((c: any) => c.portal_user_id).filter(Boolean);
    }

    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return { success: false, result: null, error: "لم يتم العثور على مستخدمين في المجموعة المستهدفة" };

    const notifications = uniqueIds.map(uid => ({
      user_id: uid,
      title_ar: args.title,
      body_ar: args.body,
      category: "general",
      priority: args.priority || "normal",
      notification_type: "bulk_from_raqeem",
      channel: "in_app",
      delivery_status: "delivered",
    }));

    const { error: bulkErr } = await db.from("notifications").insert(notifications);
    if (bulkErr) return { success: false, result: null, error: bulkErr.message };

    return { success: true, result: { message: `تم إرسال ${uniqueIds.length} إشعار بنجاح`, recipients_count: uniqueIds.length, target_group: args.target_group } };
  }

  return null; // Not handled by this module
}
