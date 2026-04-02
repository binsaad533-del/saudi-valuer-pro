import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: "financial@jsaas-group.com",
    password: "123456",
    email_confirm: true,
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
  }

  const userId = authData.user.id;

  // 2. Get organization_id from owner profile
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("email", "a.almalki@jsaas-group.com")
    .maybeSingle();

  const orgId = ownerProfile?.organization_id;

  // 3. Insert profile
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    user_id: userId,
    full_name_ar: "Ahmed Al-Shadhili",
    email: "financial@jsaas-group.com",
    user_type: "internal",
    organization_id: orgId,
  });

  // 4. Insert role
  const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
    user_id: userId,
    role: "financial_manager",
  });

  return new Response(JSON.stringify({
    success: true,
    user_id: userId,
    profile_error: profileError?.message || null,
    role_error: roleError?.message || null,
  }), { headers: { "Content-Type": "application/json" } });
});
