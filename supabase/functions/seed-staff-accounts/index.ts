const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const orgId = "52bbe5b4-9de2-4a8d-a156-cbfebed01686";

  const accounts = [
    {
      email: "Finance@jsaas-valuation.com",
      password: "123456@aA",
      full_name_ar: "أحمد الشاذلي",
      role: "financial_manager",
    },
    {
      email: "inspector@jsaas-valuation.com",
      password: "123456@aA",
      full_name_ar: "خالد المعاين",
      role: "inspector",
      cities: ["الرياض"],
      specializations: ["عقارات"],
    },
  ];

  const results = [];

  for (const acc of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { full_name_ar: acc.full_name_ar },
    });

    if (error) {
      results.push({ email: acc.email, error: error.message });
      continue;
    }

    const uid = data.user.id;

    await admin.from("profiles").upsert({
      user_id: uid,
      full_name_ar: acc.full_name_ar,
      email: acc.email,
      user_type: acc.role === "inspector" ? "inspector" : "staff",
      account_status: "active",
      is_active: true,
      organization_id: orgId,
    }, { onConflict: "user_id" });

    await admin.from("user_roles").upsert({
      user_id: uid,
      role: acc.role,
    }, { onConflict: "user_id,role" });

    if (acc.role === "inspector") {
      await admin.from("inspector_profiles").insert({
        user_id: uid,
        is_active: true,
        availability_status: "available",
        cities_ar: (acc as any).cities || [],
        specializations: (acc as any).specializations || [],
      });
    }

    results.push({ email: acc.email, user_id: uid, success: true });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
