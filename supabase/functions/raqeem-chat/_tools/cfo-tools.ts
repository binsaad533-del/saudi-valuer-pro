// CFO/Financial tools — extracted from index.ts without logic changes
import { AI } from "../../_shared/assistantIdentity.ts";
import { ToolResult } from "./helpers.ts";

export async function execute(
  toolName: string,
  args: any,
  db: any,
): Promise<ToolResult | null> {

  if (toolName === "get_pending_payments") {
    let query = db.from("payments")
      .select("id, amount, payment_stage, payment_status, payment_type, created_at, request_id, assignment_id, valuation_requests(client_name_ar), valuation_assignments(reference_number)")
      .in("payment_status", ["pending", "proof_uploaded"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (args.stage_filter && args.stage_filter !== "all") {
      query = query.eq("payment_stage", args.stage_filter);
    }

    const { data: payments } = await query;
    return {
      success: true,
      result: {
        total: payments?.length || 0,
        payments: (payments || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          stage: p.payment_stage,
          status: p.payment_status,
          type: p.payment_type,
          date: new Date(p.created_at).toLocaleDateString("ar-SA"),
          client: p.valuation_requests?.client_name_ar || "—",
          reference: p.valuation_assignments?.reference_number || "—",
        })),
      }
    };
  }

  if (toolName === "confirm_payment_receipt") {
    const { error } = await db.from("payments")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.payment_id);

    if (error) return { success: false, result: null, error: error.message };

    await db.from("audit_logs").insert({
      action: "status_change",
      table_name: "payments",
      record_id: args.payment_id,
      description: `تأكيد استلام دفعة عبر ${AI.name}${args.notes ? ' — ' + args.notes : ''}`,
    });

    return { success: true, result: { message: "تم تأكيد الدفعة بنجاح وتحريك سير العمل" } };
  }

  if (toolName === "reject_payment_proof") {
    const { error } = await db.from("payments")
      .update({ payment_status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", args.payment_id);
    if (error) return { success: false, result: null, error: error.message };

    await db.from("audit_logs").insert({
      action: "status_change", table_name: "payments", record_id: args.payment_id,
      description: `رفض إثبات دفع — السبب: ${args.rejection_reason}`,
    });

    return { success: true, result: { message: `تم رفض الإثبات. السبب: ${args.rejection_reason}` } };
  }

  if (toolName === "get_overdue_invoices") {
    const daysOverdue = args.days_overdue || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const { data: invoices } = await db.from("invoices")
      .select("id, invoice_number, total_amount, due_date, status, created_at, assignment_id, valuation_assignments(reference_number, clients(name_ar, phone))")
      .in("status", ["unpaid", "overdue"])
      .lt("due_date", new Date().toISOString())
      .order("due_date", { ascending: true })
      .limit(30);

    return {
      success: true,
      result: {
        total: invoices?.length || 0,
        invoices: (invoices || []).map((inv: any) => ({
          invoice_number: inv.invoice_number,
          amount: inv.total_amount,
          due_date: inv.due_date,
          days_late: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
          client: inv.valuation_assignments?.clients?.name_ar || "—",
          phone: inv.valuation_assignments?.clients?.phone || "—",
          reference: inv.valuation_assignments?.reference_number || "—",
        })),
      }
    };
  }

  if (toolName === "get_revenue_report") {
    const now = new Date();
    let startDate: Date;
    switch (args.period || "this_month") {
      case "today": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case "this_week": startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); break;
      case "this_quarter": startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case "this_year": startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const { data: payments } = await db.from("payments")
      .select("amount, payment_status, payment_stage, paid_at")
      .gte("created_at", startDate.toISOString());

    const paid = (payments || []).filter((p: any) => p.payment_status === "paid");
    const pending = (payments || []).filter((p: any) => p.payment_status !== "paid" && p.payment_status !== "rejected");
    const totalPaid = paid.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalPending = pending.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    return {
      success: true,
      result: {
        period: args.period || "this_month",
        total_revenue: totalPaid,
        pending_amount: totalPending,
        total_transactions: (payments || []).length,
        paid_count: paid.length,
        pending_count: pending.length,
        collection_rate: (payments || []).length > 0 ? Math.round((paid.length / (payments || []).length) * 100) : 0,
      }
    };
  }

  if (toolName === "get_collection_summary") {
    const { data: allPayments } = await db.from("payments")
      .select("amount, payment_status, payment_stage")
      .limit(1000);

    const paid = (allPayments || []).filter((p: any) => p.payment_status === "paid");
    const pending = (allPayments || []).filter((p: any) => ["pending", "proof_uploaded"].includes(p.payment_status));
    const overdue = (allPayments || []).filter((p: any) => p.payment_status === "overdue");

    const totalPaid = paid.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalPending = pending.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalOverdue = overdue.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const grandTotal = totalPaid + totalPending + totalOverdue;

    return {
      success: true,
      result: {
        total_collected: totalPaid,
        total_pending: totalPending,
        total_overdue: totalOverdue,
        grand_total: grandTotal,
        collection_rate: grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0,
        counts: { paid: paid.length, pending: pending.length, overdue: overdue.length },
      }
    };
  }

  if (toolName === "send_payment_reminder") {
    const { data: client } = await db.from("clients").select("name_ar, portal_user_id").eq("id", args.client_id).single();
    if (!client?.portal_user_id) return { success: false, result: null, error: "العميل غير مسجل في البوابة" };

    const reminderText = args.message || `تذكير: لديك فاتورة بانتظار السداد. يرجى المبادرة بالدفع لتفعيل خدمة التقييم.`;

    await db.from("notifications").insert({
      user_id: client.portal_user_id,
      title_ar: "💳 تذكير بالسداد",
      body_ar: reminderText,
      category: "payment",
      priority: "high",
      notification_type: "payment_reminder",
      channel: "in_app",
      delivery_status: "delivered",
    });

    return { success: true, result: { message: `تم إرسال تذكير الدفع للعميل ${client.name_ar}` } };
  }

  if (toolName === "get_aging_report") {
    const { data: invoices } = await db.from("invoices")
      .select("id, total_amount, due_date, payment_status")
      .in("payment_status", ["pending", "overdue", "unpaid"])
      .limit(500);

    const now = Date.now();
    const buckets: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const bucketCounts: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

    for (const inv of (invoices || [])) {
      const daysLate = Math.max(0, Math.floor((now - new Date(inv.due_date).getTime()) / 86400000));
      const bucket = daysLate <= 30 ? "0-30" : daysLate <= 60 ? "31-60" : daysLate <= 90 ? "61-90" : "90+";
      buckets[bucket] += inv.total_amount || 0;
      bucketCounts[bucket]++;
    }

    return {
      success: true,
      result: {
        total_outstanding: Object.values(buckets).reduce((s, v) => s + v, 0),
        total_invoices: invoices?.length || 0,
        aging: Object.entries(buckets).map(([range, amount]) => ({
          range: `${range} يوم`,
          amount,
          count: bucketCounts[range],
        })),
      }
    };
  }

  if (toolName === "get_client_payment_history") {
    let clientQuery = db.from("clients").select("id, name_ar");
    if (args.client_id) clientQuery = clientQuery.eq("id", args.client_id);
    else if (args.client_name) clientQuery = clientQuery.ilike("name_ar", `%${args.client_name}%`);
    const { data: client } = await clientQuery.limit(1).maybeSingle();
    if (!client) return { success: false, result: null, error: "لم يتم العثور على العميل" };

    const { data: assignments } = await db.from("valuation_assignments").select("id").eq("client_id", client.id);
    const assignIds = (assignments || []).map((a: any) => a.id);

    let payments: any[] = [];
    if (assignIds.length > 0) {
      const { data } = await db.from("payments").select("amount, payment_status, payment_stage, created_at, paid_at").in("assignment_id", assignIds).order("created_at", { ascending: false });
      payments = data || [];
    }

    const paid = payments.filter((p: any) => p.payment_status === "paid");
    const late = payments.filter((p: any) => p.payment_status === "overdue");

    return {
      success: true,
      result: {
        client_name: client.name_ar,
        total_transactions: payments.length,
        total_paid: paid.reduce((s: number, p: any) => s + (p.amount || 0), 0),
        on_time_rate: payments.length > 0 ? Math.round((paid.length / payments.length) * 100) : 0,
        late_payments: late.length,
        discipline: late.length === 0 ? "ممتاز ✅" : late.length <= 2 ? "جيد 🟡" : "يحتاج متابعة 🔴",
      }
    };
  }

  if (toolName === "get_daily_cash_flow") {
    const targetDate = args.date || new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    const { data: dayPayments } = await db.from("payments")
      .select("amount, payment_status, paid_at")
      .gte("paid_at", dayStart).lte("paid_at", dayEnd).eq("payment_status", "paid");

    const { data: pendingDue } = await db.from("invoices")
      .select("total_amount, due_date")
      .eq("due_date", targetDate).in("payment_status", ["pending", "unpaid"]);

    const collected = (dayPayments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const expected = (pendingDue || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

    return {
      success: true,
      result: {
        date: targetDate,
        collected,
        expected,
        transactions: dayPayments?.length || 0,
        pending_invoices: pendingDue?.length || 0,
      }
    };
  }

  if (toolName === "send_bulk_payment_reminders") {
    const daysMin = args.days_overdue || 7;
    const cutoff = new Date(Date.now() - daysMin * 86400000).toISOString();

    const { data: overdueInvoices } = await db.from("invoices")
      .select("id, client_id, total_amount, clients(name_ar, portal_user_id)")
      .in("payment_status", ["pending", "unpaid", "overdue"])
      .lt("due_date", cutoff)
      .limit(50);

    let sentCount = 0;
    for (const inv of (overdueInvoices || [])) {
      const userId = inv.clients?.portal_user_id;
      if (!userId) continue;
      await db.from("notifications").insert({
        user_id: userId,
        title_ar: "تذكير بسداد فاتورة متأخرة",
        body_ar: `لديك فاتورة بمبلغ ${inv.total_amount} ر.س بانتظار السداد. يرجى المبادرة بالدفع.`,
        category: "payment", priority: "high",
        notification_type: "payment_reminder", channel: "in_app", delivery_status: "delivered",
      });
      sentCount++;
    }

    return { success: true, result: { message: `تم إرسال ${sentCount} تذكير دفع`, total_overdue: overdueInvoices?.length || 0, sent: sentCount } };
  }

  return null; // Not handled by this module
}
