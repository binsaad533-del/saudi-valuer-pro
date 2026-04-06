import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, client_name } = await req.json();

    if (!phone || typeof phone !== "string" || phone.trim().length < 9) {
      return json({ error: "رقم جوال غير صالح" }, 400);
    }

    // Normalize: strip leading 0, ensure digits only
    const raw = phone.trim().replace(/^0+/, "").replace(/\D/g, "");
    const fullPhone = raw.startsWith("966") ? `+${raw}` : `+966${raw}`;
    const demoEmail = `${fullPhone.replace("+", "")}@demo.jsaas.app`;
    const demoPassword = `demo_${fullPhone}_2026!`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1,
      page: 1,
    });

    let userId: string | null = null;
    let isNewAccount = false;

    // Search by email
    const { data: userByEmail } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", fullPhone)
      .maybeSingle();

    if (userByEmail?.user_id) {
      userId = userByEmail.user_id;
    } else {
      // Try to find by email pattern in auth
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const found = users?.find((u) => u.email === demoEmail);
      if (found) {
        userId = found.id;
      }
    }

    if (!userId) {
      // Create new user
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true,
          phone: fullPhone,
          phone_confirm: true,
          user_metadata: {
            full_name: client_name || "",
            phone: fullPhone,
            demo_account: true,
          },
        });

      if (createError) throw createError;
      userId = newUser.user!.id;
      isNewAccount = true;

      // Create profile
      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        full_name_ar: client_name || "",
        phone: fullPhone,
        account_status: "active",
      }, { onConflict: "user_id" });

      // Assign client role
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "client",
      }, { onConflict: "user_id,role" });

      // Try to link to existing client record
      await supabaseAdmin.rpc("link_portal_user_to_client", {
        _user_id: userId,
        _phone: fullPhone,
        _name_ar: client_name || null,
      });
    }

    // Generate magic link for instant sign-in
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: demoEmail,
      });

    if (linkError) throw linkError;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) throw new Error("فشل إنشاء رمز الدخول");

    return json({
      valid: true,
      token_hash: tokenHash,
      is_new_account: isNewAccount,
    });
  } catch (err) {
    console.error("demo-auth error:", err);
    return json({ error: err.message || "خطأ في الخادم" }, 500);
  }
});
