# Project Brief — // dlinkit (Team D)

## Challenge

Hack4Haldia'26 starter: build a link shortener with a **real analytics backend**, not just redirects. Organizer brief: `README.md` (unchanged). Setup/deploy reference: `docs/general/SETUP.md`.

**Target user:** a marketing or community lead who shares campaign links and needs to know how many people clicked, from where, and on what device.

**Outcome:** one authenticated dashboard where a user creates a short link, shares it, and immediately sees totals, unique visitors, a 14-day trend, referrers, devices, and recent clicks.

## Mandatory acceptance criteria

1. `POST /api/shorten` requires auth and returns a short code.
2. `GET /r/:code` redirects quickly and records every click.
3. `GET /api/stats/:code` returns click analytics, owner-scoped.
4. Dashboard shows the stats with a chart.
5. Real Postgres persistence and real Google auth.
6. Deployable on a public URL.

## Existing architecture

- Single Next.js 16 App Router app in TypeScript (chosen from the starter's two options).
- `pg` Pool → Neon Postgres; schema self-provisions with idempotent DDL.
- Google OAuth 2.0 authorization-code flow with a state cookie; HS256 JWT session in an HTTP-only cookie (`jose`).
- `app/r/[code]` performs lookup → expiry check → click insert → `302`, with a 60s in-process TTL cache.
- Stats use indexed aggregate queries; ownership is enforced by `user_id`.
- UI: editorial Swiss-grid system implemented with pure CSS in `public/css/` (tokens, base, hero, dashboard, responsive), imported from `app/globals.css`. Components in `components/site` and `components/ui`. CSS-only layered parallax hero, light/dark themes, no CSS framework or animation library.

Removed: `app.py`, `requirements.txt`, `script.js`, root `index.html` (Python + Express starter stubs).

## Smallest viable end-to-end solution

Sign in with Google → create a link with alias/expiry → open `/r/:code` → see the click reflected in totals, chart, referrer, and device.

## Differentiator

One-screen, owner-scoped analytics that combines total vs **hashed unique** visitors, referrer attribution, device split, and a 14-day chart, with expiry and custom aliases handled in the same flow.

## API contracts

| Method | Path | Contract |
|---|---|---|
| `GET` | `/health` | `{ status, project, stack, database }` |
| `POST` | `/api/shorten` | `{ url, alias?, expiresAt? }` → `201 { code, url, shortUrl, expiresAt }` |
| `GET` | `/r/:code` | `302 Location`; `404` missing; `410` expired |
| `GET` | `/api/stats/:code?range=` | `{ link, total, unique, last24h, range, rangeTotal, series[], referrers, devices, recent }`; range `24h` (default `7d`) or `30d` |
| `GET` | `/api/links` | `{ links: [...] }, summary: { linkCount, totalClicks, uniqueVisitors, last24h }` |
| `DELETE` | `/api/links/:code` | `{ ok: true }`; invalidates redirect cache |
| `GET` | `/api/auth/me` | `{ user }` or `{ user: null }` |

Data: `users(1) → links(N) → clicks(N)`. Unique clicks = `count(distinct visitor_hash)`, where the hash is HMAC-SHA256 over IP + user agent using the server secret.

## File ownership

| Area | Files | Owner |
|---|---|---|
| Data/auth core | `lib/db.ts`, `lib/auth.ts`, `lib/links.ts`, `lib/analytics.ts`, `lib/rate-limit.ts` | backend |
| API routes | `app/api/**`, `app/r/[code]/route.ts`, `app/health/route.ts` | backend |
| UI | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**` | frontend |
| Docs | `docs/general/SETUP.md`, `PROJECT_BRIEF.md`, `DECISIONS.md`, `TASK_STATE.md` | main agent |
| Shared manifests | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.gitignore` | main agent only |

No parallel agents were used; one agent owned all files to avoid shared-file conflicts in a 3-hour build.

## Deployment

- Vercel, framework preset Next.js; env vars per `docs/general/SETUP.md`.
- Google Console redirect URI must match `GOOGLE_REDIRECT_URI` exactly for each environment.
- Schema self-provisions on first DB request; `/health` reports DB state.
- Risk: distinct preview/production origins need separate redirect URIs; in-memory cache/limits are per instance.

## Verification

Implemented + command-verified: typecheck, production build, 23-check live API smoke test against Neon, and a 29-check UI/API pass (rendered HTML, design tokens in the CSS bundle, real summary + 24h/7d/30d series, styled error pages, OAuth callback path).

Not verified: real Google sign-in in a browser, deployed URL, responsive visual review — user confirms.

## Demo path

Landing → Google sign-in → create `spring-sale` with expiry → copy → open → refresh dashboard → duplicate-alias error → delete → 404 page.
