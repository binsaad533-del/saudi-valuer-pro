import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const results = { reminders_sent: 0, stale_alerts: 0, overdue_alerts: 0 };

    // ── 1. Stale requests: no activity for 3+ days ──
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: staleRequests } = await db
      .from("valuation_requests")
      .select("id, assignment_id, client_user_id, client_name_ar, status, updated_at")
      .in("status", ["submitted", "data_collection_open", "scope_generated"])
      .lt("updated_at", threeDaysAgo)
      .limit(20);

    if (staleRequests?.length) {
      for (const req of staleRequests) {
        // Check if we already sent a reminder in the last 24h
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        const { data: recentReminder } = await db
          .from("request_messages")
          .select("id")
          .eq("request_id", req.id)
          .eq("sender_type", "system")
          .gte("created_at", oneDayAgo)
          .limit(1);

        if (recentReminder?.length) continue;

        // Determine reminder message based on status
        let reminderMsg = "";
        if (req.status === "submitted") {
          reminderMsg = "⏰ **تذكير**: طلبك قيد المراجعة. سنوافيك بعرض السعر قريباً. إذا كان لديك مستندات إضافية، يمكنك رفعها الآن.";
        } else if (req.status === "data_collection_open") {
          reminderMsg = "⏰ **تذكير**: مرحلة جمع البيانات لا تزال مفتوحة. يرجى رفع المستندات المطلوبة (صك الملكية، رخصة البناء، المخططات) لتسريع العملية.";
        } else if (req.status === "scope_generated") {
          reminderMsg = "⏰ **تذكير**: عرض السعر ونطاق العمل جاهزان لمراجعتك. يرجى الاطلاع عليهما والموافقة للمتابعة.";
        }

        if (reminderMsg) {
          await db.from("request_messages").insert({
            request_id: req.id,
            sender_type: "system",
            content: reminderMsg,
          });
          results.reminders_sent++;
        }
      }
    }

    // ── 2. Overdue requests: past estimated delivery ──
    const { data: activeRequests } = await db
      .from("valuation_requests")
      .select("id, assignment_id, client_user_id, created_at, status")
      .in("status", [
        "first_payment_confirmed", "data_collection_open", "data_collection_complete",
        "inspection_pending", "inspection_completed", "data_validated",
        "analysis_complete", "professional_review",
      ])
      .limit(50);

    if (activeRequests?.length) {
      for (const req of activeRequests) {
        const createdDate = new Date(req.created_at);
        const deliveryDays = 10; // default field inspection
        const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 86400000);

        if (Date.now() > estimatedDelivery.getTime()) {
          // Alert admin via notifications
          const { data: existingAlert } = await db
            .from("notifications")
            .select("id")
            .eq("related_assignment_id", req.assignment_id)
            .eq("notification_type", "overdue_request")
            .gte("created_at", new Date(Date.now() - 86400000).toISOString())
            .limit(1);

          if (!existingAlert?.length && req.assignment_id) {
            await db.from("notifications").insert({
              user_id: "00000000-0000-0000-0000-000000000000",
              title_ar: "طلب متأخر عن الموعد المتوقع",
              body_ar: `الطلب ${req.id} تجاوز موعد التسليم المتوقع. الحالة الحالية: ${req.status}`,
              category: "workflow",
              priority: "high",
              notification_type: "overdue_request",
              channel: "in_app",
              delivery_status: "delivered",
              related_assignment_id: req.assignment_id,
            });
            results.overdue_alerts++;
          }
        }
      }
    }

    // ── 3. Update client memory request counts ──
    const { data: memoryClients } = await db
      .from("raqeem_client_memory")
      .select("client_user_id");

    if (memoryClients?.length) {
      for (const mc of memoryClients) {
        const { count: total } = await db
          .from("valuation_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_user_id", mc.client_user_id);

        const { count: completed } = await db
          .from("valuation_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_user_id", mc.client_user_id)
          .in("status", ["issued", "archived"]);

        await db
          .from("raqeem_client_memory")
          .update({ total_requests: total || 0, completed_requests: completed || 0 })
          .eq("client_user_id", mc.client_user_id);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-auto-followup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
