/**
 * Apply all migrations to Supabase via Management API
 *
 * Requires SUPABASE_ACCESS_TOKEN in env (personal access token from
 * https://supabase.com/dashboard/account/tokens)
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<pat> node scripts/apply-migrations.mjs
 *
 * Or: paste scripts/all_migrations.sql into the Supabase SQL Editor manually.
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "bulddgyouutnktheqszz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN is required.");
  console.error("   Get it from: https://supabase.com/dashboard/account/tokens");
  console.error("   Then run: SUPABASE_ACCESS_TOKEN=<token> node scripts/apply-migrations.mjs");
  process.exit(1);
}

const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Found ${files.length} migration files.\n`);

async function execSQL(sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

let passed = 0;
let failed = 0;

for (const file of files) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, "utf-8").trim();
  if (!sql) {
    console.log(`⏭  ${file} (empty)`);
    continue;
  }

  process.stdout.write(`▶ ${file} ... `);
  try {
    await execSQL(sql, file);
    console.log("✅");
    passed++;
  } catch (err) {
    console.log(`❌ ${err.message.slice(0, 120)}`);
    failed++;
    // Continue — idempotent migrations (IF NOT EXISTS) survive partial failures
  }
}

console.log(`\n✅ Passed: ${passed}  ❌ Failed: ${failed}`);
