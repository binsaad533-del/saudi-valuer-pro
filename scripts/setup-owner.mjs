/**
 * Create owner user and profile in the new Supabase project.
 *
 * Uses the Auth Admin API (service_role key — bypasses email confirmation).
 *
 * Usage:
 *   node scripts/setup-owner.mjs
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bulddgyouutnktheqszz.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required.");
  console.error("   Run: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/setup-owner.mjs");
  process.exit(1);
}

const OWNER_EMAIL = "owner@jassas.sa";
const OWNER_PASSWORD = "Owner@2026";
const OWNER_FULL_NAME_AR = "مالك جساس";

async function authAdmin(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
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

async function restUpsert(table, body, onConflict) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    }
  );
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
  // ── 1. Create auth user ────────────────────────────────────────────────────
  console.log("1. Creating auth user...");
  // Known user ID from previous run (auth user already created)
  const KNOWN_USER_ID = "fa6cde4b-d122-44f4-a20b-368d65be38d7";
  let userId;

  try {
    const user = await authAdmin("/users", {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    userId = user.id;
    console.log(`   ✅ Created: ${userId}`);
  } catch (err) {
    // Already exists — look up by listing and filtering
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const listData = await listRes.json();
    const found = (listData.users || []).find((u) => u.email === OWNER_EMAIL);
    if (found) {
      userId = found.id;
      console.log(`   ✅ Already exists: ${userId}`);
    } else {
      // Fall back to known ID
      userId = KNOWN_USER_ID;
      console.log(`   ✅ Using known ID: ${userId}`);
    }
  }

  // ── 2. Get or create organization ─────────────────────────────────────────
  console.log("2. Checking organization...");
  let orgId;
  try {
    const orgs = await restGet("organizations", "is_active=eq.true&limit=1");
    if (orgs.length > 0) {
      orgId = orgs[0].id;
      console.log(`   ✅ Using existing org: ${orgId}`);
    } else {
      const created = await restPost("organizations", {
        name_ar: "شركة جساس للتقييم",
        name_en: "Jassas Valuation Company",
        is_active: true,
      });
      orgId = created[0].id;
      console.log(`   ✅ Created org: ${orgId}`);
    }
  } catch (err) {
    console.error(`   ❌ Organization error: ${err.message}`);
    process.exit(1);
  }

  // ── 3. Create profile ──────────────────────────────────────────────────────
  console.log("3. Creating profile...");
  try {
    await restUpsert(
      "profiles",
      {
        user_id: userId,
        organization_id: orgId,
        full_name_ar: OWNER_FULL_NAME_AR,
        account_status: "active",
      },
      "user_id"
    );
    console.log("   ✅ Profile upserted.");
  } catch (err) {
    console.warn(`   ⚠️  Profile: ${err.message}`);
  }

  // ── 4. Create user_roles record ────────────────────────────────────────────
  console.log("4. Creating user_roles record...");
  try {
    // Check if role already exists first
    const existing = await restGet("user_roles", `user_id=eq.${userId}`);
    if (existing.length > 0) {
      console.log(`   ✅ Role already set: ${existing[0].role}`);
    } else {
      await restPost("user_roles", { user_id: userId, role: "owner" });
      console.log("   ✅ Role set to 'owner'.");
    }
  } catch (err) {
    console.warn(`   ⚠️  user_roles: ${err.message}`);
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║  OWNER USER SETUP COMPLETE                           ║
╠══════════════════════════════════════════════════════╣
║  Email   : ${OWNER_EMAIL.padEnd(42)}║
║  Password: ${OWNER_PASSWORD.padEnd(42)}║
║  User ID : ${userId.padEnd(42)}║
║  Org ID  : ${orgId.padEnd(42)}║
╚══════════════════════════════════════════════════════╝
`);
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
