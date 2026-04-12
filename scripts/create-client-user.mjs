/**
 * Create test client user: client@test.sa / Client@2026
 * Uses Auth Admin API (service_role key) — skips email confirmation.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bulddgyouutnktheqszz.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required.");
  console.error("   Run: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-client-user.mjs");
  process.exit(1);
}

const CLIENT_EMAIL = "client@test.sa";
const CLIENT_PASSWORD = "Client@2026";
const CLIENT_NAME_AR = "عميل تجريبي";

// ── disable email confirmation via Management API (requires PAT) ──────────────
async function disableEmailConfirmation() {
  if (!ACCESS_TOKEN) {
    console.log("   ℹ️  SUPABASE_ACCESS_TOKEN not set — skipping auto-confirm config.");
    return;
  }
  const res = await fetch(
    "https://api.supabase.com/v1/projects/bulddgyouutnktheqszz/config/auth",
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mailer_autoconfirm: true }),
    }
  );
  if (res.ok) {
    console.log("   ✅ Email auto-confirm enabled (new users skip email verification).");
  } else {
    const t = await res.text();
    console.warn(`   ⚠️  Could not set auto-confirm: ${t.slice(0, 100)}`);
  }
}

async function authAdminCreate(body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && !data?.id) throw new Error(JSON.stringify(data));
  return data;
}

async function restPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function restGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function run() {
  // 0. Disable email confirmation
  console.log("0. Configuring email auto-confirm...");
  await disableEmailConfirmation();

  // 1. Get org
  console.log("1. Fetching organization...");
  const orgs = await restGet("organizations", "is_active=eq.true&limit=1");
  if (!orgs.length) throw new Error("No active organization found. Run setup-owner.mjs first.");
  const orgId = orgs[0].id;
  console.log(`   org_id: ${orgId}`);

  // 2. Create auth user
  console.log("2. Creating client auth user...");
  let userId;
  try {
    const user = await authAdminCreate({
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      email_confirm: true,
    });
    userId = user.id;
    console.log(`   ✅ Created: ${userId}`);
  } catch (err) {
    if (err.message.includes("already") || err.message.includes("exists")) {
      // List and find
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
      );
      const listData = await listRes.json();
      const found = (listData.users || []).find((u) => u.email === CLIENT_EMAIL);
      if (found) {
        userId = found.id;
        console.log(`   ✅ Already exists: ${userId}`);
      } else throw err;
    } else throw err;
  }

  // 3. Profile
  console.log("3. Creating profile...");
  try {
    const existing = await restGet("profiles", `user_id=eq.${userId}`);
    if (existing.length > 0) {
      console.log("   ✅ Profile already exists.");
    } else {
      await restPost("profiles", {
        user_id: userId,
        organization_id: orgId,
        full_name_ar: CLIENT_NAME_AR,
        email: CLIENT_EMAIL,
        account_status: "active",
        user_type: "external",
        preferred_language: "ar",
      });
      console.log("   ✅ Profile created.");
    }
  } catch (err) {
    console.warn(`   ⚠️  Profile: ${err.message.slice(0, 120)}`);
  }

  // 4. user_roles
  console.log("4. Creating user_roles...");
  try {
    const existing = await restGet("user_roles", `user_id=eq.${userId}`);
    if (existing.length > 0) {
      console.log(`   ✅ Role already set: ${existing[0].role}`);
    } else {
      await restPost("user_roles", { user_id: userId, role: "client" });
      console.log("   ✅ Role set to 'client'.");
    }
  } catch (err) {
    console.warn(`   ⚠️  user_roles: ${err.message.slice(0, 120)}`);
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║  CLIENT USER READY                                   ║
╠══════════════════════════════════════════════════════╣
║  Email   : ${CLIENT_EMAIL.padEnd(42)}║
║  Password: ${CLIENT_PASSWORD.padEnd(42)}║
║  User ID : ${userId.padEnd(42)}║
╚══════════════════════════════════════════════════════╝
`);
}

run().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
