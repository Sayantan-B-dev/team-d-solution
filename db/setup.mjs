// // Snip — apply the database schema and verify it.
//
// Usage (from the repo root):
//   npm run db:setup
//   node --env-file=.env db/setup.mjs
//
// Destructive:
//   npm run db:reset
//   node --env-file=.env db/setup.mjs --reset --yes
//
// Uses NEON_DATABASE_URL from .env. Never prints the password.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const wantsReset = process.argv.includes("--reset");
const confirmed = process.argv.includes("--yes");

if (wantsReset && !confirmed) {
  console.error("Refusing to reset: this deletes all users, links and clicks.");
  console.error("Re-run with --yes if you are sure:");
  console.error("  npm run db:reset");
  process.exit(1);
}

const rawUrl = process.env.NEON_DATABASE_URL;
if (!rawUrl) {
  console.error("NEON_DATABASE_URL is not set.");
  console.error("Add it to .env, then run: npm run db:setup");
  process.exit(1);
}

// Match lib/db.ts: drop the legacy sslmode flag and use an explicit SSL config.
let connectionString = rawUrl;
try {
  const parsed = new URL(rawUrl);
  parsed.searchParams.delete("sslmode");
  connectionString = parsed.toString();
} catch {
  // Keep the raw string when it is not a parseable URL.
}

try {
  const parsed = new URL(rawUrl);
  console.log(`// Snip database setup`);
  console.log(`Host: ${parsed.host}${parsed.pathname}`);
} catch {
  console.log(`// Snip database setup`);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 15_000,
});

const REQUIRED_TABLES = ["users", "links", "clicks"];
const REQUIRED_INDEXES = [
  "links_user_created_idx",
  "links_owner_created_idx",
  "clicks_link_time_idx",
  "clicks_link_visitor_idx",
  "clicks_link_breakdown_idx",
  "users_email_idx",
  "users_role_idx",
];

async function apply(file) {
  const sql = await readFile(join(here, file), "utf8");
  await pool.query(sql);
  console.log(`Applied ${file}`);
}

function fail(message) {
  console.error(`FAILED: ${message}`);
  process.exitCode = 1;
}

try {
  const version = await pool.query("select version() as version");
  const shortVersion = String(version.rows[0]?.version ?? "").split(",")[0];
  console.log(`Connected: ${shortVersion}`);

  if (wantsReset) {
    await apply("reset.sql");
  }

  await apply("setup.sql");

  const tables = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_name = any($1)
     order by table_name`,
    [REQUIRED_TABLES]
  );
  const tableNames = tables.rows.map((row) => row.table_name);
  const missingTables = REQUIRED_TABLES.filter((name) => !tableNames.includes(name));
  if (missingTables.length > 0) {
    fail(`missing tables: ${missingTables.join(", ")}`);
  } else {
    console.log(`Tables: ${tableNames.join(", ")}`);
  }

  const indexes = await pool.query(
    `select indexname
     from pg_indexes
     where schemaname = 'public' and tablename = any($1)
     order by indexname`,
    [REQUIRED_TABLES]
  );
  const indexNames = indexes.rows.map((row) => row.indexname);
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !indexNames.includes(name));
  if (missingIndexes.length > 0) {
    fail(`missing indexes: ${missingIndexes.join(", ")}`);
  }
  console.log(`Indexes: ${indexNames.length} (${REQUIRED_INDEXES.length} explicit + primary/unique)`);

  const roleColumn = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'role'`
  );
  if (roleColumn.rowCount === 0) {
    fail("missing users.role column");
  } else {
    console.log("Roles: users.role present");
  }

  const counts = await pool.query(
    `select
       (select count(*)::int from users) as users,
       (select count(*)::int from users where role = 'admin') as admins,
       (select count(*)::int from links) as links,
       (select count(*)::int from clicks) as clicks`
  );
  const row = counts.rows[0];
  console.log(
    `Rows: users ${row.users} (admins ${row.admins}) · links ${row.links} · clicks ${row.clicks}`
  );

  if (!process.exitCode) {
    console.log("Done. The app can use this database now.");
  }
} catch (error) {
  console.error("Database setup failed:", error instanceof Error ? error.message : String(error));
  console.error("Check NEON_DATABASE_URL, SSL mode, and that the role can write to schema public.");
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => undefined);
}
