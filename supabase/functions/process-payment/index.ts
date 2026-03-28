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

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, requestId, paymentStage, paymentMethod, amount, scenario } = body;

    if (action === "create_payment") {
      // Validate request belongs to user
      const { data: request, error: reqErr } = await supabase
        .from("valuation_requests")
        .select("*")
        .eq("id", requestId)
        .eq("client_user_id", user.id)
        .single();

      if (reqErr || !request) {
        return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: corsHeaders });
      }

      // Calculate amount
      const paymentAmount = amount || (
        paymentStage === "first" ? request.first_payment_amount :
        paymentStage === "final" ? (request.total_fees - (request.amount_paid || 0)) :
        request.total_fees
      );

      if (!paymentAmount || paymentAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid payment amount" }), { status: 400, headers: corsHeaders });
      }

      // Create payment record
      const txId = `mock_txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payRef = `PAY-${Date.now().toString(36).toUpperCase()}`;

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          request_id: requestId,
          assignment_id: request.assignment_id,
          amount: paymentAmount,
          currency: request.quotation_currency || "SAR",
          payment_stage: paymentStage || "first",
          payment_method: paymentMethod || "mada",
          gateway_name: "moyasar",
          transaction_id: txId,
          payment_status: "pending",
          payment_reference: payRef,
          is_mock: true,
          created_by: user.id,
          gateway_response_json: {
            id: txId,
            status: "initiated",
            amount: paymentAmount * 100,
            currency: request.quotation_currency || "SAR",
            source: { type: "creditcard", company: paymentMethod || "mada" },
          },
        })
        .select()
        .single();

      if (payErr) {
        return new Response(JSON.stringify({ error: payErr.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        payment,
        message: "Payment created in mock mode",
        isMock: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "simulate_payment") {
      // Simulate payment outcome (success/failed/pending)
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .select("*")
        .eq("id", body.paymentId)
        .single();

      if (payErr || !payment) {
        return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });
      }

      const simScenario = scenario || "success";
      const newStatus = simScenario === "success" ? "paid" : simScenario === "failed" ? "failed" : "pending";

      // Update payment
      await supabase.from("payments").update({
        payment_status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        gateway_response_json: {
          ...((payment as any).gateway_response_json || {}),
          status: newStatus,
          simulated: true,
          scenario: simScenario,
          completed_at: new Date().toISOString(),
        },
      }).eq("id", payment.id);

      // Log webhook event
      await supabase.from("payment_webhook_logs").insert({
        payment_id: payment.id,
        event_type: `payment.${newStatus}`,
        raw_payload: {
          type: `payment.${newStatus}`,
          data: { id: (payment as any).transaction_id, status: newStatus },
          simulated: true,
        },
        processed: true,
        processing_result: `Simulated ${simScenario} scenario`,
      });

      // If paid, update request status and amount_paid
      if (newStatus === "paid") {
        const { data: request } = await supabase
          .from("valuation_requests")
          .select("*")
          .eq("id", (payment as any).request_id)
          .single();

        if (request) {
          const totalPaid = ((request as any).amount_paid || 0) + (payment as any).amount;
          const isFullyPaid = totalPaid >= ((request as any).total_fees || 0);
          const isFirstPayment = (payment as any).payment_stage === "first";
          const isFinalPayment = (payment as any).payment_stage === "final";

          let newRequestStatus = (request as any).status;
          let paymentStatus = "partially_paid";

          if (isFullyPaid) {
            paymentStatus = "fully_paid";
            if (isFinalPayment || ["final_payment_pending", "draft_report_sent"].includes((request as any).status)) {
              newRequestStatus = "final_report_ready";
            } else {
              newRequestStatus = "in_production";
            }
          } else if (isFirstPayment) {
            newRequestStatus = "in_production";
            paymentStatus = "partially_paid";
          }

          await supabase.from("valuation_requests").update({
            status: newRequestStatus,
            amount_paid: totalPaid,
            payment_status: paymentStatus,
            ...(newRequestStatus === "in_production" ? { production_started_at: new Date().toISOString() } : {}),
          }).eq("id", (request as any).id);

          // System message
          await supabase.from("request_messages").insert({
            request_id: (request as any).id,
            sender_type: "system",
            content: `✅ تم تأكيد الدفع بنجاح - ${(payment as any).amount.toLocaleString()} ر.س (${isFirstPayment ? "الدفعة الأولى" : isFinalPayment ? "الدفعة النهائية" : "دفعة كاملة"})`,
          });
        }
      } else if (newStatus === "failed") {
        // System message for failure
        await supabase.from("request_messages").insert({
          request_id: (payment as any).request_id,
          sender_type: "system",
          content: `❌ فشل الدفع - يرجى المحاولة مرة أخرى أو اختيار وسيلة دفع أخرى`,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        status: newStatus,
        scenario: simScenario,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "admin_override") {
      // Admin manual override for payment status
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["super_admin", "firm_admin"]);

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
      }

      const { paymentId, newStatus, notes } = body;
      await supabase.from("payments").update({
        payment_status: newStatus,
        notes: notes || `Manual override by admin`,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      }).eq("id", paymentId);

      // Log
      await supabase.from("payment_webhook_logs").insert({
        payment_id: paymentId,
        event_type: "admin.override",
        raw_payload: { action: "manual_override", new_status: newStatus, admin_id: user.id, notes },
        processed: true,
        processing_result: `Admin override to ${newStatus}`,
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
