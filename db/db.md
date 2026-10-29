# Database — Neon PostgreSQL

Everything for the database lives in `db/`. The schema is **idempotent**, so running it twice is safe and never deletes data.

```
db/
  setup.sql    complete schema: tables, roles, indexes, constraints, ANALYZE, checks
  addon.sql    non-destructive role/admin migration for an existing database
  test.sql     read-only test suite: tables, indexes, constraints, counts, integrity
  reset.sql    DESTRUCTIVE: drops users, links and clicks
  setup.mjs    apply setup.sql + verify (supports --reset)
  db.md        this file
```

---

## Run order

| Order | File | When to run |
|---|---|---|
| 1 | `setup.sql` | Always. Creates/updates tables, roles, indexes and constraints. |
| 2 | `addon.sql` | Only on a database that existed **before** roles were added. Skip it if you just ran `setup.sql`. |
| 3 | `test.sql` | Read-only verification. Safe to run any time after setup. |
| — | `reset.sql` | **Never during normal setup.** Destructive; drops all users, links and clicks. |

### Fresh Neon database

1. `db/setup.sql`
2. `db/test.sql`

### Existing database that only needs roles

1. `db/addon.sql`
2. `db/test.sql`

`addon.sql` adds `users.role`, the `users_role_check` constraint, `users_role_idx`, and the guest-link columns, constraint and index. `setup.sql` already contains those statements, so the two are not meant to be run one after the other.

### Full reset

1. `db/reset.sql`
2. `db/setup.sql`
3. `db/test.sql` (optional)

Or use the npm wrapper, which does the reset and setup together:

```bash
npm run db:reset
```

### Terminal shortcut

```bash
npm run db:setup
```

That applies `setup.sql` and verifies it. It does not run `addon.sql`, `test.sql` or `reset.sql`.

### After setup: make yourself admin

```sql
update users
set role = 'admin'
where lower(email) = lower('your-email@example.com');
```

Sign out and sign in again after running it.

---

## TL;DR

With `NEON_DATABASE_URL` in `.env`:

```bash
npm run db:setup
```

Expected output:

```
// dlinkit database setup
Host: ep-....neon.tech/neondb
Connected: PostgreSQL 18.x
Applied setup.sql
Tables: clicks, links, users
Indexes: 12 (7 explicit + primary/unique)
Roles: users.role present
Rows: users 0 (admins 0) · links 0 · clicks 0
Done. The app can use this database now.
```

In the **Neon SQL Editor**, paste `db/setup.sql` and press **Run**. Then optionally paste `db/test.sql` to verify.

---

## 1. Point at your Neon database

1. Open the [Neon Console](https://console.neon.tech) and select your project.
2. Click **Connect** and copy the **pooled** connection string (host contains `-pooler`).
3. Add it to `.env` in the repo root:

```env
NEON_DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

`.env` is gitignored. Never commit it. `db/setup.mjs` and `lib/db.ts` remove the legacy `sslmode` parameter and set SSL explicitly.

---

## 2. Create or update the schema

### Option A — npm script (recommended)

```bash
npm run db:setup
```

This applies `setup.sql`, then checks tables, the role column, indexes, and row counts.

### Option B — psql

```bash
psql "$NEON_DATABASE_URL" -f db/setup.sql
```

PowerShell:

```powershell
$env:NEON_DATABASE_URL = "postgresql://...?sslmode=require"
psql $env:NEON_DATABASE_URL -f db/setup.sql
```

### Option C — Neon SQL Editor

1. Neon Console → your project → **SQL Editor**.
2. Open `db/setup.sql`, copy the whole file, paste it, press **Run**.
3. Open `db/test.sql`, paste it, press **Run** to verify.

### Existing database that only needs roles

```bash
psql "$NEON_DATABASE_URL" -f db/addon.sql
```

`addon.sql` adds `users.role`, the `users_role_check` constraint, and `users_role_idx`. It is non-destructive.

### Option D — do nothing

`lib/db.ts` calls `ensureSchema()` before the first query, so any API request or `/r/warmup` creates the core tables. Run `db:setup` explicitly before a demo so the role column and indexes are guaranteed.

---

## 3. Roles and the admin account

Every user has `role = 'user'` by default. An admin can open the admin console, see every user and link, change roles, change link expiry, and delete links or users.

Promote yourself after signing in at least once:

```sql
update users
set role = 'admin'
where lower(email) = lower('you@example.com');
```

Then **sign out and sign in again** so the session JWT contains the new role. Admin API routes also re-check the database, so the console works immediately after the row changes.

Check roles:

```sql
select email, role, created_at from users order by role desc, created_at;
select count(*)::int as admins from users where role = 'admin';
```

Safety rules enforced by the API:

- The last admin cannot be demoted.
- An admin cannot delete their own account.
- Deleting a user cascades to their links and clicks.
- `role` only accepts `user` or `admin`.

---

## 4. Test the database

`db/test.sql` is read-only and prints:

1. tables
2. role and ownership columns
3. all indexes
4. constraints and cascade rules (including `links_owner_required`)
5. row counts and role counts
6. per-user activity
7. all links with owner, expiry state, clicks, uniques
8. top links
9. clicks per day for 14 days
10. recent clicks
11. expired links
12. integrity checks (orphan links/clicks must be `0`)
13. admin accounts

Run it with `psql "$NEON_DATABASE_URL" -f db/test.sql` or paste it into the SQL Editor.

---

## 5. Reset the database (DESTRUCTIVE)

This deletes **all users, links, and clicks**, then recreates the empty schema:

```bash
npm run db:reset
```

Equivalent:

```bash
node --env-file=.env db/setup.mjs --reset --yes
```

`db/setup.mjs` refuses to reset unless `--yes` is present. `db/reset.sql` alone only drops the tables; run `db/setup.sql` afterwards if you use that file directly.

---

## 6. Tables

```
users (1) ──< links (1) ──< clicks (N)
```

| Table | Purpose | Key columns |
|---|---|---|
| `users` | One row per Google account | `id` uuid, `google_sub` unique, `email`, `name`, `avatar_url`, `role`, `created_at` |
| `links` | One row per short link | `id` uuid, `user_id` → users (nullable), `owner_token_hash` (guest owner), `code` unique, `url`, `created_at`, `expires_at` |
| `clicks` | One row per redirect | `id` bigserial, `link_id` → links, `clicked_at`, `referrer`, `user_agent`, `device`, `visitor_hash` |

- A link belongs to exactly one owner: `user_id` for a signed-in account, or `owner_token_hash` (SHA-256 of an httpOnly guest cookie) for a signed-out visitor. `links_owner_required` enforces that it is never neither. Signing in claims that browser's guest links by setting `user_id` and clearing the hash.
- Guest links are capped at 5 per browser per rolling 24 hours. The cap is enforced inside a transaction with an advisory lock, so parallel requests cannot exceed it.
- Deleting a user cascades to their links; deleting a link cascades to its clicks.
- All timestamps are `timestamptz`; chart buckets are formatted in UTC.
- `visitor_hash` is an HMAC of IP + user agent. Raw IP addresses are never stored.
- No seed or demo data. Every dashboard number comes from these tables.

### Indexes

| Index | Columns | Speeds up |
|---|---|---|
| `links_user_created_idx` | `links (user_id, created_at desc)` | Dashboard list for one owner |
| `links_owner_created_idx` | `links (owner_token_hash, created_at desc) where not null` | Guest daily quota count |
| `clicks_link_time_idx` | `clicks (link_id, clicked_at desc)` | Redirect insert/read, recent clicks, time buckets, last 24h |
| `clicks_link_visitor_idx` | `clicks (link_id, visitor_hash)` | `count(distinct visitor_hash)` |
| `clicks_link_breakdown_idx` | `clicks (link_id, clicked_at desc) include (device, referrer)` | Range totals, device/referrer split without heap reads |
| `users_email_idx` | `users (lower(email))` | Case-insensitive owner lookup |
| `users_role_idx` | `users (role)` | Admin console role counts and filters |

Seven explicit indexes plus five primary/unique indexes = **12 total**.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `NEON_DATABASE_URL is not set` | Add it to `.env` in the repo root, not inside `db/`. |
| `psql: command not found` | Use `npm run db:setup` or the Neon SQL Editor. |
| `password authentication failed` | Re-copy the whole connection string from Neon. |
| `could not translate host name` | The host is mistyped. Copy it again. |
| `permission denied for schema public` | Connect with the default owner role (`neondb_owner`). |
| `relation "users" already exists` | Should not happen — `setup.sql` uses `if not exists`. Inspect, then reset if needed. |
| Connection times out | The Neon project may be suspended. Open the console or retry. |
| `SECURITY WARNING: The SSL modes ...` | Harmless. `db/setup.mjs` sets SSL explicitly. |
| App shows `database: "down"` at `/health` | Check `NEON_DATABASE_URL` and that the project is awake. |
| Admin console says `403` | Run the `update users set role='admin' ...` query, then sign out and in. |
| `rateLimitHeaders is not a function` after editing `lib/rate-limit.ts` | Stale dev bundle. Stop the dev server and run `npm run dev` again. |
| Google sign-in fails | Open `/api/auth/diagnose` and add the exact `effectiveRedirectUri` to Google Console. See `docs/general/SETUP.md` section 2. |

### Google redirect diagnostics

`GET /api/auth/diagnose` returns:

```json
{
  "requestOrigin": "http://localhost:3000",
  "configuredRedirectUri": "http://localhost:3000/api/auth/callback/google",
  "effectiveRedirectUri": "http://localhost:3000/api/auth/callback/google",
  "originMatchesConfigured": true,
  "clientIdSet": true,
  "clientSecretSet": true
}
```

No secret is returned. The `effectiveRedirectUri` must match an **Authorized redirect URI** in Google Cloud Console character for character.
