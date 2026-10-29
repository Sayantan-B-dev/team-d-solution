# // Snip — Link Shortener + Analytics

Canonical project documentation for **Team D · Hack4Haldia'26**.

`README.md` is the organizers' original challenge brief and is intentionally left unchanged. This file is the setup and deployment reference for the implementation.

**// Snip** turns long URLs into short links and records every redirect: time, device, browser, referrer, and a hashed visitor fingerprint for unique counts. Owners see account-wide totals plus a per-link dashboard with a 24h / 7d / 30d chart, top referrers, device split, and recent clicks.

- **Stack:** Next.js 16 (App Router, TypeScript), Neon PostgreSQL (`pg`), Google OAuth 2.0, HS256 session JWT (`jose`)
- **UI:** editorial Swiss-grid system, pure CSS in `public/css/`, Space Grotesk + Space Mono, CSS-only parallax
- **Live URL:** add your Vercel URL here before submitting
- **Health check:** `GET /health` → `{ "status": "ok", "database": "up" }`

---

## 1. Mandatory challenge features

| Requirement | Status | Where |
|---|---|---|
| Create short links (auth required) | Done | `POST /api/shorten`, Google session cookie required |
| Fast redirect `/r/:code` | Done | `app/r/[code]/route.ts` + 60s in-process cache |
| Track every click (time, device, referrer) | Done | `clicks` table, written on every redirect |
| Stats endpoint + dashboard chart | Done | `GET /api/stats/:code?range=…`, flat SVG bar chart |
| Real database and auth | Done | Neon Postgres, Google OAuth, JWT cookie |
| Bonus: custom aliases and expiry | Done | Alias validation, `410` for expired links |
| Bonus: unique vs total clicks | Done | HMAC(IP + user agent) visitor hash |
| Bonus: rate limiting | Done | Per-IP/user sliding window |
| Bonus: Redis redirect cache | Not used | No Redis instance provisioned; in-process TTL cache instead (see limits) |

---

## 2. Environment

Create `.env` in the repo root. Never commit it (already ignored). `.env.example` lists every variable with the correct callback path.

| Variable | Required | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` | Yes | Neon pooled Postgres connection string (`...-pooler...`, `sslmode=require`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret; also used to sign sessions when `AUTH_SECRET` is absent |
| `GOOGLE_REDIRECT_URI` | Yes | Must exactly match an authorized redirect URI in Google Cloud Console |
| `AUTH_SECRET` | Recommended | Dedicated signing key for session JWT + visitor hashes. If omitted, `GOOGLE_CLIENT_SECRET` is used |
| `APP_URL` | Optional | Public origin for generated short links. Leave unset on Vercel; request headers are used automatically |

### Google redirect URI

The callback route is always **`/api/auth/callback/google`**.

**Local development** (`npm run dev` serves port 3000):

```env
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

**Production** (replace with your deployed domain):

```env
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback/google
```

In **Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs**, add both URLs above. The value must match character for character. Add `http://localhost:3000` and your production origin as **Authorized JavaScript origins** if the console asks.

---

## 3. Run locally

Requirements: Node.js 20.9+ (tested on Node 25), a Neon database, and a Google OAuth web client.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use `npm run dev` for local Google sign-in; production mode marks the session cookie `Secure`, which can behave differently over plain HTTP.

Prepare the database explicitly (optional — the app self-provisions on first use, and this is safe to re-run):

```bash
npm run db:setup     # apply db/schema.sql + verify tables, indexes and counts
```

To create everything from the **Neon SQL Editor**, paste the single file **`db/run.sql`** and press **Run** — it includes tables, indexes, `ANALYZE`, and a verification summary.

Database files and every option (Neon SQL Editor, `psql`, reset) are documented in **`db/db.md`**. `npm run db:reset` deletes all users, links and clicks; it is destructive.

The database schema is created automatically on the first database-backed request. To warm it explicitly:

```bash
curl http://localhost:3000/r/warmup     # 404 page, but creates the tables
curl http://localhost:3000/health       # database: "up"
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run start       # serve the production build
```

---

## 4. Architecture

```
Browser ──► Next.js App Router (Vercel)
              ├─ app/page.tsx             reads the session, renders SiteShell
              ├─ app/r/[code]/route.ts   302 redirect + click insert + TTL cache
              ├─ app/api/shorten         auth + validation + insert link
              ├─ app/api/links[/:code]   owner's links + account summary, delete
              ├─ app/api/stats/[code]    owner-only aggregates, 24h/7d/30d
              └─ app/api/auth/*          Google OAuth, session cookie, logout
                          │
                          ▼
                  Neon PostgreSQL
                  users ─┬─ links ── clicks
```

**Data model**

| Table | Key columns |
|---|---|
| `users` | `id` (uuid), `google_sub` (unique), `email`, `name`, `avatar_url` |
| `links` | `id`, `user_id` → users, `code` (unique), `url`, `expires_at` |
| `clicks` | `id`, `link_id` → links, `clicked_at`, `referrer`, `user_agent`, `device`, `visitor_hash` |

Indexes: `links(user_id, created_at desc)`, `clicks(link_id, clicked_at desc)`, `clicks(link_id, visitor_hash)`.

**Auth flow:** `/api/auth/google` sets an HTTP-only `state` cookie and redirects to Google → `/api/auth/callback/google` validates state, exchanges the code, reads the OpenID profile, upserts the user, and sets a 7-day HTTP-only `sw_session` JWT cookie. API handlers read the JWT; analytics is scoped to `user_id`.

**Redirect flow:** code lookup (cache hit or one indexed query) → expiry check → click insert using a subquery on `code` → `302`. Tracking failures are logged but never block the redirect.

**Dashboard state:** one client shell owns links, account summary, selected link, range, and stats. The hero form and the table both write to the same state, so a new link appears in the table immediately and the analytics pane selects it.

---

## 5. UI system

The visual spec is `DESIGN.md`; the static reference is `referenceui.html`. The implementation keeps the real backend and drops all demo-data controls.

```
public/css/
  tokens.css        light/dark custom properties, fonts, colour-scheme
  base.css          reset, frame, shell, nav, pills, inputs, badges, modal, toast
  hero.css          hero grid, shorten form, result card, two-layer parallax artwork
  dashboard.css     stats strip, link table, KPIs, segmented chart, bar rows, recent
  responsive.css    1120 / 900 / 560 breakpoints, reduced-motion fallbacks

app/globals.css     imports the five files in cascade order
components/
  site/             SiteShell, NavBar, Hero, HeroArtwork, StatsStrip, DashboardSection,
                    LinksTable, AnalyticsPanel, AboutSection, Footer, AuthModal, Toast
  ui/               ClickChart, SegmentedControl, BarRows
```

- Theme: `data-theme` on `<html>`, persisted in `localStorage` (`snip_theme`), set before paint by an inline script; falls back to `prefers-color-scheme`.
- Motion: pure CSS. The hero is split into two SVG layers that drift in opposite directions with `animation-timeline: scroll(root block)`, wrapped in `@supports` and disabled by `prefers-reduced-motion`. Chart bars scale in with a short stagger. No animation library, no scroll listeners.
- Data: no invented numbers. The stats strip reads `summary` from `/api/links`; the chart reads `/api/stats/:code?range=…`. Empty states distinguish signed-out, no-links, no-clicks, and error.
- Auth UI: Google only. There is no email/password tab and no fake session.

---

## 6. API reference

Session cookie required for owner endpoints. Errors use `{ "error": "code", "message": "Safe human message" }`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | `{ status, project, stack, database }` |
| `GET` | `/api/auth/google` | Starts Google OAuth (20/min/IP) |
| `GET` | `/api/auth/callback/google` | OAuth callback, sets session |
| `GET` | `/api/auth/me` | `{ user }` or `{ user: null }` |
| `POST` | `/api/auth/logout` | Clears session |
| `POST` | `/api/shorten` | `{ url, alias?, expiresAt? }` → `201 { code, url, shortUrl, expiresAt }` |
| `GET` | `/api/links` | `{ links: [...], summary }`; counts per link, max 100 |
| `DELETE` | `/api/links/:code` | Owner only; cascades clicks; invalidates cache |
| `GET` | `/api/stats/:code?range=` | Owner only; `range` = `24h` (default `7d`) or `30d`; totals + range series + breakdown |
| `GET` | `/r/:code` | `302` to destination; `404` missing, `410` expired; 120/min/IP |

`/api/links` summary shape:

```json
{ "linkCount": 3, "totalClicks": 128, "uniqueVisitors": 74, "last24h": 11 }
```

`/api/stats/:code` returns `link`, `total`, `unique`, `last24h`, `range`, `rangeTotal`, `series[]` (24 hourly or 7/30 daily buckets), `referrers[]` (top 5 in range), `devices[]` (in range), and `recent[]` (latest 20 all-time with browser).

Validation: only `http`/`https`, max 2048 chars, no embedded credentials; aliases `3–32` chars of `[A-Za-z0-9_-]` and not reserved; expiry must be future and at most one year out.

Example:

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "content-type: application/json" \
  -H "cookie: sw_session=<token>" \
  -d '{"url":"https://example.com/campaign","alias":"spring-sale"}'
```

Rate limits (in-process, per instance): 20 links/min per user+IP, 120 redirects/min per IP, 20 auth starts/min per IP.

---

## 7. Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project**, import the repo. Framework preset: **Next.js**; leave build/output defaults.
3. Add environment variables for Production (and Preview if you want): `NEON_DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and optionally `AUTH_SECRET`.
4. Set `GOOGLE_REDIRECT_URI` to `https://<your-vercel-domain>/api/auth/callback/google` and add that exact URI in Google Cloud Console.
5. Deploy. Changing env vars requires a redeploy.
6. Verify:
   - `https://<domain>/health` → `database: "up"`
   - `https://<domain>/r/warmup` → styled 404 page (creates schema on a fresh database)
   - Sign in, create a link, open it, check the dashboard.

Do not set `APP_URL` unless you use a custom domain; the app derives the origin from forwarded headers.

---

## 8. Verified

Run against the real `.env` and Neon database on 2026-10-29:

- `npx tsc --noEmit` — passed
- `npm run build` — passed (Next.js 16.4.3, all routes compiled)
- API smoke test, **23/23 checks**: auth required, create, duplicate alias 409, non-HTTP URL 400, past expiry 400, two redirects 302 with correct `Location`, click totals 2, unique 2, last-24h 2, referrer/device capture, recent clicks, owner-only stats (other user gets 404), list counts, expired link 410, delete, deleted link 404
- UI/API check, **29/29 checks**: logged-out and logged-in page HTML, `// Snip` hero, form, stats strip, dashboard shell, about, theme script, CSS bundle contains tokens + parallax + breakpoints, public `/css/*.css` served, account name and logout state, real link + 2 clicks, `summary` matches, 24h/7d/30d series lengths and `rangeTotal`, unknown range falls back to `7d`, styled 404/410 pages, OAuth redirect with the correct `/api/auth/callback/google` path, delete
- Temporary verification scripts and their test users were removed; no leftover data

Not verified by the agent: a real Google account sign-in in a browser, the deployed Vercel URL, and a visual review at presentation size. The user must confirm these.

---

## 9. Known limits (honest)

- **No Redis.** The redirect cache and rate limits are in-process and reset on deploy/cold start. On Vercel they are per-instance, so they are best-effort rather than globally consistent. Drop-in next step: Upstash Redis for `GET/SETEX` redirect cache and sliding-window limits.
- **Unique visitors are approximate.** `HMAC-SHA256(IP + user-agent)` with the server secret, so the same person on two devices/browsers counts twice. Raw IPs are never stored.
- **No bot filtering.** Every redirect is recorded as a click.
- **Expiry** is enforced at redirect time (`410`); expired links remain visible in the dashboard with an “Expired” badge until deleted.
- **Neon free tier** may autosuspend; the first query after idle can take around a second. The redirect cache hides this for warm links.
- **In-memory cache invalidation** works within one server instance; another warm instance may serve a deleted link for up to 60 seconds.
- **Parallax** uses scroll-driven CSS animations; unsupporting browsers get the static artwork, and reduced-motion users get no motion.

---

## 10. Demo path (about 60 seconds)

1. Open the landing page: state the problem in one line — “marketing links need to prove who clicked.”
2. Sign in with Google; the account name replaces “Signed out” in the strip.
3. Create a short link with a custom alias (`spring-sale`) and an expiry.
4. The result card shows the real short URL; copy it and open it in a new tab.
5. Return to the dashboard, press **Refresh** (or wait for **Test redirect**): total/unique/last-24h, the chart, referrers, devices, and recent clicks update.
6. Switch the segmented control between 24h, 7d, and 30d.
7. Create a duplicate alias to show the recoverable `409` error.
8. Delete the link; the short URL now returns the styled 404 page.

---

## 11. Judging map

| Criterion | Evidence |
|---|---|
| Working demo (35%) | Full create → redirect → track → dashboard loop, verified live; real database, no demo data |
| Technical depth (25%) | Normalized Postgres schema, indexed analytics, OAuth state validation, JWT sessions, HMAC visitor hashes, TTL cache with invalidation, rate limiting, parameterized SQL |
| Core completeness (20%) | All four must-have endpoints + range-aware dashboard chart |
| Deployment (10%) | Vercel-ready; `/health` exposes DB state; schema self-provisions; `.env.example` documents the callback |
| Presentation (10%) | Editorial one-screen layout, CSS-only parallax, real empty/loading/error states, light/dark themes, responsive at 900px and 560px |

---

## 12. File map

```
app/
  page.tsx                     session lookup → SiteShell
  layout.tsx                   fonts + pre-paint theme script
  globals.css                  imports public/css in cascade order
  health/route.ts              GET /health
  api/shorten/route.ts         create link
  api/links/route.ts           list links + account summary
  api/links/[code]/route.ts    delete link
  api/stats/[code]/route.ts    range-aware analytics
  api/auth/*                   Google OAuth, session, logout
  r/[code]/route.ts            redirect + click tracking + styled error pages
components/
  site/                        page shell and sections
  ui/                          chart, segmented control, bar rows
public/css/                    tokens, base, hero, dashboard, responsive
db/                            run.sql, schema.sql, indexing.sql, verify.sql, queries.sql, reset.sql, setup.mjs, db.md
lib/                           db, auth, links, analytics, rate limit, cache, types
```

The original Python (`app.py`, `requirements.txt`) and Express (`script.js`, root `index.html`) starters were removed; this is a single Next.js/TypeScript stack.
