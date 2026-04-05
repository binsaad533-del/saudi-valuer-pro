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

    // Parse webhook payload (could be form-encoded or JSON)
    let payload: Record<string, string> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        payload[key] = String(value);
      }
    } else {
      payload = await req.json();
    }

    const checkoutId = payload.id || payload.checkoutId;
    const resultCode = payload["result.code"] || payload.result?.code || "";
    const merchantTxId = payload.merchantTransactionId || "";

    // Determine status from result code
    let paymentStatus = "pending";
    if (/^(000\.000\.|000\.100\.1|000\.[36])/.test(resultCode)) {
      paymentStatus = "paid";
    } else if (/^(000\.200)/.test(resultCode)) {
      paymentStatus = "manual_review";
    } else if (/^(800\.|100\.1|100\.2|700\.|600\.)/.test(resultCode)) {
      paymentStatus = "failed";
    }

    // Find payment by checkout ID or transaction ID
    let paymentQuery = supabase.from("payments").select("*");
    if (checkoutId) {
      paymentQuery = paymentQuery.eq("hyperpay_checkout_id", checkoutId);
    } else if (merchantTxId) {
      paymentQuery = paymentQuery.like("transaction_id", `%${merchantTxId}%`);
    }

    const { data: payment } = await paymentQuery.single();

    if (payment) {
      // Update payment
      await supabase.from("payments").update({
        payment_status: paymentStatus,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        gateway_response_json: payload,
        payment_method: payload.paymentBrand?.toLowerCase() || (payment as any).payment_method,
      }).eq("id", payment.id);

      // If paid, update request
      if (paymentStatus === "paid") {
        const { data: request } = await supabase
          .from("valuation_requests").select("*").eq("id", (payment as any).request_id).single();
        if (request) {
          const totalPaid = ((request as any).amount_paid || 0) + (payment as any).amount;
          const isFullyPaid = totalPaid >= ((request as any).total_fees || 0);
          await supabase.from("valuation_requests").update({
            amount_paid: totalPaid,
            payment_status: isFullyPaid ? "fully_paid" : "partially_paid",
          }).eq("id", (request as any).id);

          await supabase.from("request_messages").insert({
            request_id: (request as any).id,
            sender_type: "system",
            content: paymentStatus === "paid"
              ? `✅ تم تأكيد الدفع الإلكتروني - ${Number((payment as any).amount).toLocaleString()} ر.س`
              : `❌ فشل الدفع الإلكتروني - يرجى المحاولة مرة أخرى`,
          });
        }

        // Send notification
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              event: "payment_received",
              requestId: (payment as any).request_id,
              metadata: { amount: (payment as any).amount, method: payload.paymentBrand },
            },
          });
        } catch { /* non-critical */ }
      }

      // Log webhook
      await supabase.from("payment_webhook_logs").insert({
        payment_id: payment.id,
        event_type: `hyperpay.webhook.${paymentStatus}`,
        raw_payload: payload,
        processed: true,
        processing_result: `Webhook processed: ${resultCode} → ${paymentStatus}`,
      });
    } else {
      // Log unmatched webhook
      await supabase.from("payment_webhook_logs").insert({
        event_type: "hyperpay.webhook.unmatched",
        raw_payload: payload,
        processed: false,
        processing_result: `No matching payment found for checkout: ${checkoutId}`,
      });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
