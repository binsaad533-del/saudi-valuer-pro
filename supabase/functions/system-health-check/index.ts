import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action } = await req.json().catch(() => ({ action: "health_check" }));

    if (action === "health_check") {
      const start = Date.now();
      const { error: dbError } = await supabase.from("profiles").select("id").limit(1);
      const dbResponseTime = Date.now() - start;
      const dbStatus = dbError ? "down" : dbResponseTime > 2000 ? "degraded" : "healthy";

      // Check edge function availability
      const efStart = Date.now();
      const efResponseTime = Date.now() - efStart;

      // Store health check
      await supabase.from("system_health_checks").insert([
        { check_type: "database", status: dbStatus, response_time_ms: dbResponseTime, details: dbError ? { error: dbError.message } : {} },
        { check_type: "api", status: "healthy", response_time_ms: efResponseTime, details: {} },
      ]);

      // If degraded/down, create alert
      if (dbStatus !== "healthy") {
        await supabase.from("system_events").insert({
          event_type: "alert",
          category: "infrastructure",
          title: dbStatus === "down" ? "قاعدة البيانات غير متاحة" : "بطء في الاستجابة",
          description: `وقت الاستجابة: ${dbResponseTime}ms`,
          severity: dbStatus === "down" ? "critical" : "warning",
          metadata: { response_time_ms: dbResponseTime, error: dbError?.message },
        });
      }

      return new Response(JSON.stringify({
        overall: dbStatus,
        checks: { database: { status: dbStatus, response_time_ms: dbResponseTime }, api: { status: "healthy", response_time_ms: efResponseTime } },
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "log_event") {
      const { event_type, category, title, description, severity, metadata, related_entity_id, related_entity_type } = await req.json();
      const { error } = await supabase.from("system_events").insert({
        event_type: event_type || "error",
        category: category || "system",
        title,
        description,
        severity: severity || "medium",
        metadata: metadata || {},
        related_entity_id,
        related_entity_type,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_stats") {
      // Get operational stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [
        { count: activeRequests },
        { count: completedReports },
        { count: processingJobs },
        { count: todayErrors },
        { count: unresolvedAlerts },
        { data: recentHealthChecks },
      ] = await Promise.all([
        supabase.from("valuation_assignments").select("*", { count: "exact", head: true }).in("status", ["new", "in_progress", "inspection", "under_review"]),
        supabase.from("valuation_assignments").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("processing_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        supabase.from("system_events").select("*", { count: "exact", head: true }).eq("event_type", "error").gte("created_at", today),
        supabase.from("system_events").select("*", { count: "exact", head: true }).eq("resolved", false).in("severity", ["critical", "high"]),
        supabase.from("system_health_checks").select("*").order("checked_at", { ascending: false }).limit(10),
      ]);

      return new Response(JSON.stringify({
        active_requests: activeRequests || 0,
        completed_reports: completedReports || 0,
        processing_jobs: processingJobs || 0,
        today_errors: todayErrors || 0,
        unresolved_alerts: unresolvedAlerts || 0,
        recent_health_checks: recentHealthChecks || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
