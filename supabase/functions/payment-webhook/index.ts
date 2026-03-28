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

    const payload = await req.json();

    // In production, verify Moyasar webhook signature here
    // const signature = req.headers.get("x-moyasar-signature");
    // For mock mode, we accept all

    const { type, data } = payload;
    const transactionId = data?.id;

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Missing transaction ID" }), { status: 400, headers: corsHeaders });
    }

    // Find payment by transaction_id
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (payErr || !payment) {
      // Log unknown webhook
      await supabase.from("payment_webhook_logs").insert({
        event_type: type || "unknown",
        raw_payload: payload,
        processed: false,
        processing_result: "Payment not found for transaction",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });
    }

    // Anti-duplicate: check if already processed
    const { data: existingLog } = await supabase
      .from("payment_webhook_logs")
      .select("id")
      .eq("payment_id", payment.id)
      .eq("event_type", type)
      .eq("processed", true)
      .maybeSingle();

    if (existingLog) {
      return new Response(JSON.stringify({ message: "Already processed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map webhook status
    const statusMap: Record<string, string> = {
      "payment.paid": "paid",
      "payment.failed": "failed",
      "payment.cancelled": "cancelled",
      "payment.refunded": "refunded",
    };

    const newStatus = statusMap[type] || "manual_review";

    // Update payment
    await supabase.from("payments").update({
      payment_status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      gateway_response_json: { ...(payment as any).gateway_response_json, webhook: payload },
    }).eq("id", payment.id);

    // Log webhook
    await supabase.from("payment_webhook_logs").insert({
      payment_id: payment.id,
      event_type: type,
      raw_payload: payload,
      processed: true,
      processing_result: `Status updated to ${newStatus}`,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
    });

    // If paid, update request
    if (newStatus === "paid") {
      const { data: request } = await supabase
        .from("valuation_requests")
        .select("*")
        .eq("id", (payment as any).request_id)
        .single();

      if (request) {
        const totalPaid = ((request as any).amount_paid || 0) + (payment as any).amount;
        const isFullyPaid = totalPaid >= ((request as any).total_fees || 0);
        const isFinalPayment = (payment as any).payment_stage === "final";

        let newRequestStatus = (request as any).status;
        if (isFullyPaid) {
          newRequestStatus = isFinalPayment ? "final_report_ready" : "in_production";
        } else {
          newRequestStatus = "in_production";
        }

        await supabase.from("valuation_requests").update({
          status: newRequestStatus,
          amount_paid: totalPaid,
          payment_status: isFullyPaid ? "fully_paid" : "partially_paid",
          ...(newRequestStatus === "in_production" ? { production_started_at: new Date().toISOString() } : {}),
        }).eq("id", (request as any).id);
      }
    }

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
