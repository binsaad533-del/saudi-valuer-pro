import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    // ── Manual Payment Submission ──────────────────────────────
    if (action === "submit_manual_payment") {
      const { requestId, paymentStage, amount, paymentProofPath, bankTransferRef, clientNotes } = body;

      if (!requestId || !amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid request or amount" }), { status: 400, headers: corsHeaders });
      }

      const txId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payRef = `MAN-${Date.now().toString(36).toUpperCase()}`;

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          request_id: requestId,
          amount,
          currency: "SAR",
          payment_stage: paymentStage || "full",
          payment_method: "bank_transfer",
          payment_type: "manual",
          gateway_name: "manual",
          transaction_id: txId,
          payment_status: "payment_submitted",
          payment_reference: payRef,
          payment_proof_path: paymentProofPath,
          bank_transfer_ref: bankTransferRef || null,
          client_notes: clientNotes || null,
          is_mock: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (payErr) {
        return new Response(JSON.stringify({ error: payErr.message }), { status: 500, headers: corsHeaders });
      }

      // Update request payment_status
      await supabase.from("valuation_requests").update({
        payment_status: "payment_submitted",
      }).eq("id", requestId);

      // System message
      await supabase.from("request_messages").insert({
        request_id: requestId,
        sender_type: "system",
        content: `📎 تم إرسال إثبات دفع بمبلغ ${Number(amount).toLocaleString()} ر.س - بانتظار المراجعة`,
      });

      return new Response(JSON.stringify({ payment, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Review Manual Payment (Owner) ─────────────────────────
    if (action === "review_manual_payment") {
      const { paymentId, decision, reviewNotes } = body;

      // Check owner role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isOwner = roles?.some((r: any) => ["owner", "super_admin", "firm_admin", "financial_manager"].includes(r.role));
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: corsHeaders });
      }

      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (!payment) {
        return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });
      }

      // ── HARD GATE: Block confirmation without proof ──
      if (decision === "paid") {
        const hasProof = (payment as any).payment_proof_path?.trim() || (payment as any).proof_url?.trim();
        if (!hasProof) {
          // Log blocked attempt
          await supabase.from("audit_logs").insert({
            user_id: user.id,
            action: "reject" as any,
            table_name: "payments",
            record_id: paymentId,
            assignment_id: (payment as any).assignment_id,
            description: "رفض تأكيد الدفعة — لا يوجد إثبات سداد مرفق في النظام",
            new_data: { rejected: true, reason: "no_proof", payment_id: paymentId },
            user_role: roles?.find((r: any) => r.role)?.role || "unknown",
          } as any).catch(() => {});

          return new Response(JSON.stringify({
            error: "لا يمكن تأكيد الدفعة بدون إثبات سداد مرفق. يرجى إرفاق إثبات التحويل أولاً.",
            code: "NO_PROOF",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const newStatus = decision === "paid" ? "paid" : "rejected";

      await supabase.from("payments").update({
        payment_status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      }).eq("id", paymentId);

      if (newStatus === "paid") {
        // Update request
        const { data: request } = await supabase
          .from("valuation_requests")
          .select("*")
          .eq("id", (payment as any).request_id)
          .single();

        if (request) {
          const totalPaid = ((request as any).amount_paid || 0) + (payment as any).amount;
          const isFullyPaid = totalPaid >= ((request as any).total_fees || 0);

          await supabase.from("valuation_requests").update({
            amount_paid: totalPaid,
            payment_status: isFullyPaid ? "fully_paid" : "partially_paid",
            ...(isFullyPaid ? {} : {}),
          }).eq("id", (request as any).id);

          await supabase.from("request_messages").insert({
            request_id: (request as any).id,
            sender_type: "system",
            content: `✅ تم تأكيد الدفع بمبلغ ${Number((payment as any).amount).toLocaleString()} ر.س`,
          });
        }
      } else {
        await supabase.from("request_messages").insert({
          request_id: (payment as any).request_id,
          sender_type: "system",
          content: `❌ تم رفض إثبات الدفع${reviewNotes ? ` - السبب: ${reviewNotes}` : ""}. يرجى إعادة التحويل وإرفاق الإيصال الصحيح.`,
        });

        await supabase.from("valuation_requests").update({
          payment_status: "awaiting_payment",
        }).eq("id", (payment as any).request_id);
      }

      // Log
      await supabase.from("payment_webhook_logs").insert({
        payment_id: paymentId,
        event_type: `manual.${decision}`,
        raw_payload: { action: "manual_review", decision, reviewer: user.id, notes: reviewNotes },
        processed: true,
        processing_result: `Manual payment ${decision} by owner`,
      });

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Payment (Online - future) ──────────────────────
    if (action === "create_payment") {
      const { requestId, paymentStage, paymentMethod, amount: payAmount } = body;

      const { data: request, error: reqErr } = await supabase
        .from("valuation_requests")
        .select("*")
        .eq("id", requestId)
        .eq("client_user_id", user.id)
        .single();

      if (reqErr || !request) {
        return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: corsHeaders });
      }

      const paymentAmount = payAmount || (
        paymentStage === "first" ? (request as any).first_payment_amount :
        paymentStage === "final" ? ((request as any).total_fees - ((request as any).amount_paid || 0)) :
        (request as any).total_fees
      );

      if (!paymentAmount || paymentAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid payment amount" }), { status: 400, headers: corsHeaders });
      }

      const txId = `mock_txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payRef = `PAY-${Date.now().toString(36).toUpperCase()}`;

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          request_id: requestId,
          assignment_id: (request as any).assignment_id,
          amount: paymentAmount,
          currency: (request as any).quotation_currency || "SAR",
          payment_stage: paymentStage || "first",
          payment_method: paymentMethod || "mada",
          payment_type: "online",
          gateway_name: "moyasar",
          transaction_id: txId,
          payment_status: "pending",
          payment_reference: payRef,
          is_mock: true,
          created_by: user.id,
          gateway_response_json: {
            id: txId, status: "initiated",
            amount: paymentAmount * 100,
            currency: (request as any).quotation_currency || "SAR",
            source: { type: "creditcard", company: paymentMethod || "mada" },
          },
        })
        .select()
        .single();

      if (payErr) {
        return new Response(JSON.stringify({ error: payErr.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ payment, message: "Payment created in mock mode", isMock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Simulate Payment (mock online) ────────────────────────
    if (action === "simulate_payment") {
      const { data: payment } = await supabase
        .from("payments").select("*").eq("id", body.paymentId).single();

      if (!payment) {
        return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });
      }

      const simScenario = body.scenario || "success";
      const newStatus = simScenario === "success" ? "paid" : simScenario === "failed" ? "failed" : "pending";

      await supabase.from("payments").update({
        payment_status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        gateway_response_json: {
          ...((payment as any).gateway_response_json || {}),
          status: newStatus, simulated: true, scenario: simScenario,
          completed_at: new Date().toISOString(),
        },
      }).eq("id", payment.id);

      await supabase.from("payment_webhook_logs").insert({
        payment_id: payment.id,
        event_type: `payment.${newStatus}`,
        raw_payload: { type: `payment.${newStatus}`, data: { id: (payment as any).transaction_id, status: newStatus }, simulated: true },
        processed: true,
        processing_result: `Simulated ${simScenario} scenario`,
      });

      if (newStatus === "paid") {
        const { data: request } = await supabase
          .from("valuation_requests").select("*").eq("id", (payment as any).request_id).single();
        if (request) {
          const totalPaid = ((request as any).amount_paid || 0) + (payment as any).amount;
          const isFullyPaid = totalPaid >= ((request as any).total_fees || 0);
          await supabase.from("valuation_requests").update({
            amount_paid: totalPaid,
            payment_status: isFullyPaid ? "fully_paid" : "partially_paid",
            ...(isFullyPaid && { status: "in_production" }),
          }).eq("id", (request as any).id);

          await supabase.from("request_messages").insert({
            request_id: (request as any).id, sender_type: "system",
            content: `✅ تم تأكيد الدفع بنجاح - ${(payment as any).amount.toLocaleString()} ر.س`,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, status: newStatus, scenario: simScenario }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin Override ─────────────────────────────────────────
    if (action === "admin_override") {
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id)
        .in("role", ["owner", "super_admin", "firm_admin"]);

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
      }

      const { paymentId, newStatus, notes } = body;
      await supabase.from("payments").update({
        payment_status: newStatus,
        notes: notes || `Manual override by admin`,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      }).eq("id", paymentId);

      await supabase.from("payment_webhook_logs").insert({
        payment_id: paymentId,
        event_type: "admin.override",
        raw_payload: { action: "manual_override", new_status: newStatus, admin_id: user.id, notes },
        processed: true,
        processing_result: `Admin override to ${newStatus}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
