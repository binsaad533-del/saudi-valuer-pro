import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find existing user
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.users?.find((u: any) => u.email === "financial@jsaas-group.com");
  
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  const userId = user.id;

  // Update password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: "123456",
    email_confirm: true,
  });

  // Get org id
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("email", "a.almalki@jsaas-group.com")
    .maybeSingle();
  const orgId = ownerProfile?.organization_id;

  // Upsert profile
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    user_id: userId,
    full_name_ar: "Ahmed Al-Shadhili",
    email: "financial@jsaas-group.com",
    user_type: "internal",
    organization_id: orgId,
  }, { onConflict: "user_id" });

  // Upsert role
  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({
    user_id: userId,
    role: "financial_manager",
  }, { onConflict: "user_id,role" });

  return new Response(JSON.stringify({
    success: true,
    user_id: userId,
    update_error: updateError?.message || null,
    profile_error: profileError?.message || null,
    role_error: roleError?.message || null,
  }), { headers: { "Content-Type": "application/json" } });
});
