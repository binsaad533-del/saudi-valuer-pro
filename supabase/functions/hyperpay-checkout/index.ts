import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HYPERPAY_TEST_URL = "https://eu-test.oppwa.com";
const HYPERPAY_LIVE_URL = "https://eu-prod.oppwa.com";

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

    // Get gateway settings
    const { data: gwSettings } = await supabase
      .from("payment_gateway_settings")
      .select("*")
      .eq("provider", "hyperpay")
      .single();

    if (!gwSettings) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), { status: 400, headers: corsHeaders });
    }

    const baseUrl = (gwSettings as any).environment === "production" ? HYPERPAY_LIVE_URL : HYPERPAY_TEST_URL;
    const accessToken = (gwSettings as any).access_token;

    // ── Prepare Checkout ──────────────────────────────────────
    if (action === "prepare_checkout") {
      const { requestId, paymentStage, amount, paymentBrand } = body;

      if (!accessToken) {
        return new Response(JSON.stringify({ error: "HyperPay access token not configured" }), { status: 400, headers: corsHeaders });
      }

      // Determine entity ID based on brand
      let entityId = (gwSettings as any).entity_id;
      if (paymentBrand === "MADA") {
        entityId = (gwSettings as any).entity_id_mada || entityId;
      } else if (paymentBrand === "APPLEPAY") {
        entityId = (gwSettings as any).entity_id_applepay || entityId;
      }

      if (!entityId) {
        return new Response(JSON.stringify({ error: "Entity ID not configured" }), { status: 400, headers: corsHeaders });
      }

      // Create checkout via HyperPay API
      const params = new URLSearchParams({
        "entityId": entityId,
        "amount": Number(amount).toFixed(2),
        "currency": "SAR",
        "paymentType": "DB",
        "merchantTransactionId": `${requestId}_${paymentStage}_${Date.now()}`,
        "customer.email": user.email || "",
        "customParameters[requestId]": requestId,
        "customParameters[paymentStage]": paymentStage || "full",
        "customParameters[userId]": user.id,
      });

      const hpResponse = await fetch(`${baseUrl}/v1/checkouts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const hpData = await hpResponse.json();

      if (!hpData.id) {
        return new Response(JSON.stringify({ error: "Failed to create checkout", details: hpData }), { status: 500, headers: corsHeaders });
      }

      // Create payment record
      const txId = `hp_${hpData.id}`;
      const payRef = `HP-${Date.now().toString(36).toUpperCase()}`;

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          request_id: requestId,
          amount,
          currency: "SAR",
          payment_stage: paymentStage || "full",
          payment_method: paymentBrand?.toLowerCase() || "card",
          payment_type: "online",
          gateway_name: "hyperpay",
          transaction_id: txId,
          payment_status: "pending",
          payment_reference: payRef,
          hyperpay_checkout_id: hpData.id,
          is_mock: (gwSettings as any).environment === "test",
          created_by: user.id,
          gateway_response_json: hpData,
        })
        .select()
        .single();

      if (payErr) {
        return new Response(JSON.stringify({ error: payErr.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        checkoutId: hpData.id,
        paymentId: payment.id,
        scriptUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${hpData.id}`,
        environment: (gwSettings as any).environment,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Get Payment Status ────────────────────────────────────
    if (action === "get_payment_status") {
      const { checkoutId, paymentId } = body;

      if (!accessToken || !checkoutId) {
        return new Response(JSON.stringify({ error: "Missing checkout ID or access token" }), { status: 400, headers: corsHeaders });
      }

      let entityId = (gwSettings as any).entity_id;

      const hpResponse = await fetch(
        `${baseUrl}/v1/checkouts/${checkoutId}/payment?entityId=${entityId}`,
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );

      const hpData = await hpResponse.json();

      // Parse HyperPay result code
      const resultCode = hpData.result?.code || "";
      let paymentStatus = "pending";
      if (/^(000\.000\.|000\.100\.1|000\.[36])/.test(resultCode)) {
        paymentStatus = "paid";
      } else if (/^(000\.200)/.test(resultCode)) {
        paymentStatus = "pending"; // pending review
      } else if (/^(800\.|100\.1|100\.2|700\.|600\.)/.test(resultCode)) {
        paymentStatus = "failed";
      }

      // Update payment record
      if (paymentId) {
        await supabase.from("payments").update({
          payment_status: paymentStatus,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
          gateway_response_json: hpData,
          payment_method: hpData.paymentBrand?.toLowerCase() || null,
        }).eq("id", paymentId);

        // If paid, update request
        if (paymentStatus === "paid") {
          const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();
          if (payment) {
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
                content: `✅ تم تأكيد الدفع الإلكتروني بنجاح - ${Number((payment as any).amount).toLocaleString()} ر.س`,
              });
            }
          }
        }

        // Log webhook
        await supabase.from("payment_webhook_logs").insert({
          payment_id: paymentId,
          event_type: `hyperpay.${paymentStatus}`,
          raw_payload: hpData,
          processed: true,
          processing_result: `HyperPay result: ${resultCode} → ${paymentStatus}`,
        });
      }

      return new Response(JSON.stringify({
        status: paymentStatus,
        resultCode,
        resultDescription: hpData.result?.description,
        paymentBrand: hpData.paymentBrand,
        raw: hpData,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Check Gateway Status ──────────────────────────────────
    if (action === "check_gateway_status") {
      return new Response(JSON.stringify({
        provider: (gwSettings as any).provider,
        isActive: (gwSettings as any).is_active,
        environment: (gwSettings as any).environment,
        enabledMethods: (gwSettings as any).enabled_methods,
        hasAccessToken: !!accessToken,
        hasEntityId: !!(gwSettings as any).entity_id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
