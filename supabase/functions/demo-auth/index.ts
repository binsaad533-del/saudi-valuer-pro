import { createClient } from "npm:@supabase/supabase-js@2";

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

/* Simple in-memory rate limit: max 5 attempts per phone per 2 minutes */
const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 2 * 60 * 1000;
const RATE_MAX = 5;

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateBucket.get(phone);
  if (!entry || now > entry.resetAt) {
    rateBucket.set(phone, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const { phone, client_name } = await req.json();

    if (!phone || typeof phone !== "string" || phone.trim().length < 8) {
      return json({ error: "رقم جوال غير صالح" }, 400);
    }

    const raw = phone.trim().replace(/^0+/, "").replace(/\D/g, "");
    const fullPhone = raw.startsWith("966") ? `+${raw}` : `+966${raw}`;

    if (isRateLimited(fullPhone)) {
      return json({ error: "محاولات كثيرة، انتظر دقيقتين" }, 429);
    }

    const demoEmail = `${fullPhone.replace("+", "")}@demo.jsaas.app`;
    const demoPassword = `demo_${fullPhone}_2026!`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    /* ---- Find existing user ---- */
    let userId: string | null = null;
    let isNewAccount = false;

    const { data: profileHit } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", fullPhone)
      .maybeSingle();

    if (profileHit?.user_id) {
      userId = profileHit.user_id;
    } else {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const found = users?.find((u) => u.email === demoEmail);
      if (found) userId = found.id;
    }

    /* ---- Create if new ---- */
    if (!userId) {
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

      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          full_name_ar: client_name || "",
          phone: fullPhone,
          account_status: "active",
        },
        { onConflict: "user_id" },
      );

      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "client" },
        { onConflict: "user_id,role" },
      );

      await supabaseAdmin.rpc("link_portal_user_to_client", {
        _user_id: userId,
        _phone: fullPhone,
        _name_ar: client_name || null,
      });
    }

    /* ---- Log attempt ---- */
    console.log(`demo-auth: phone=${fullPhone} ip=${clientIp} new=${isNewAccount}`);

    /* ---- Return credentials for client-side signInWithPassword ---- */
    return json({
      valid: true,
      email: demoEmail,
      password: demoPassword,
      is_new_account: isNewAccount,
    });
  } catch (err) {
    console.error("demo-auth error:", err);
    return json({ error: (err as Error).message || "خطأ في الخادم" }, 500);
  }
});
