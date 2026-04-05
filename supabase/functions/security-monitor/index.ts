import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, payload } = await req.json();

    switch (action) {
      case "log_login": {
        const { email, user_id, ip_address, user_agent, success, failure_reason } = payload;
        await supabase.from("login_attempts").insert({
          email,
          user_id,
          ip_address: ip_address || null,
          user_agent: user_agent || null,
          success: !!success,
          failure_reason: failure_reason || null,
        });

        // Track session on success
        if (success && user_id) {
          await supabase.from("active_sessions").upsert({
            user_id,
            device_info: user_agent || "Unknown",
            ip_address: ip_address || null,
            last_active_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_alert": {
        const { alert_type, severity, title, description, user_id, metadata } = payload;
        await supabase.from("security_alerts").insert({
          alert_type,
          severity: severity || "medium",
          title,
          description,
          user_id: user_id || null,
          metadata: metadata || {},
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_sessions": {
        // Remove sessions older than 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("active_sessions").delete().lt("last_active_at", cutoff);
        return new Response(JSON.stringify({ ok: true, message: "Stale sessions cleaned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("security-monitor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
