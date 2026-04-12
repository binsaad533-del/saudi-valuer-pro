/**
 * Quick script — update valuation_request status by reference_number
 *
 * Usage:
 *   node scripts/update-request-status.mjs
 *
 * NOTE: The anon key is subject to RLS.
 *       If the update is blocked, set SUPABASE_SERVICE_ROLE_KEY in your env:
 *         SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/update-request-status.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bulddgyouutnktheqszz.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Use service_role key if provided in env (bypasses RLS)
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY;

if (!KEY) {
  console.error("❌ Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY);

const REFERENCE = "JAS-2026-0001";
const NEW_STATUS = "stage_3_owner_scope";

async function run() {
  console.log(`\nKey type : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role ✓" : "anon (RLS applies)"}`);
  console.log(`Reference: ${REFERENCE}`);
  console.log(`New status: ${NEW_STATUS}\n`);

  // ── 1. Find the request ──────────────────────────────────────────────────────
  const { data: req, error: fetchErr } = await supabase
    .from("valuation_requests")
    .select("id, status, reference_number")
    .eq("reference_number", REFERENCE)
    .single();

  if (fetchErr) {
    console.error("❌ Fetch error:", fetchErr.message);
    process.exit(1);
  }

  if (!req) {
    console.error("❌ Request not found:", REFERENCE);
    process.exit(1);
  }

  console.log(`Found : id=${req.id}  current_status=${req.status}`);

  if (req.status === NEW_STATUS) {
    console.log("✓ Already at target status — nothing to do.");
    process.exit(0);
  }

  // ── 2. Update status ─────────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("valuation_requests")
    .update({ status: NEW_STATUS })
    .eq("id", req.id);

  if (updateErr) {
    console.error("❌ Update error:", updateErr.message);
    console.error("\nHint: If this is an RLS error, re-run with:");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/update-request-status.mjs");
    console.error("\nGet the key from:");
    console.error("  https://supabase.com/dashboard/project/vprxcirjtzsxyllqjjyr/settings/api");
    process.exit(1);
  }

  // ── 3. Also update valuation_assignments if linked ───────────────────────────
  if (req.id) {
    const { data: asgn } = await supabase
      .from("valuation_assignments")
      .select("id, status")
      .eq("request_id", req.id)
      .maybeSingle();

    if (asgn) {
      console.log(`\nLinked assignment: id=${asgn.id}  current_status=${asgn.status}`);
      const { error: asgnErr } = await supabase
        .from("valuation_assignments")
        .update({ status: NEW_STATUS })
        .eq("id", asgn.id);

      if (asgnErr) {
        console.warn("⚠️  Assignment update failed:", asgnErr.message);
      } else {
        console.log(`✓ Assignment status → ${NEW_STATUS}`);
      }
    } else {
      console.log("\nNo linked valuation_assignment found.");
    }
  }

  console.log(`\n✅ valuation_requests.status → ${NEW_STATUS}`);
}

run();
