# Durable Decisions

Record decisions that future agents must preserve. Avoid logging every minor choice.

## Current decisions
- Build the smallest complete, working, deployable prototype before optional features.
- Avoid overengineering; follow existing repository conventions and minimize dependencies.
- Ask before consequential choices involving product direction, real integrations/data, cost, credentials, persistence, sensitive data, or deployment risk.
- User controls commits, pushes, branches, PRs, and final submissions.
- Official brief, judging rubric, and repository instructions override assumptions in this pack.
- `README.md` is the organizers' brief and stays unchanged. `docs/general/SETUP.md` is the canonical project documentation and setup reference.
- One stack: Next.js App Router + TypeScript. Python and Express starter files were removed.
- Neon Postgres via `pg`; schema self-provisions with idempotent DDL. No ORM.
- Google OAuth authorization-code flow with state cookie; session is an HTTP-only HS256 JWT (`jose`), signed with `AUTH_SECRET` and falling back to `GOOGLE_CLIENT_SECRET`.
- No Redis instance was provisioned. Redirect caching and rate limiting are in-process and documented as best-effort/per-instance in `docs/general/SETUP.md`.
- Unique visitors use HMAC(IP + user agent); raw IPs are not stored.
- Analytics is owner-scoped; unrelated users receive 404 to avoid link enumeration.
- UI is branded **// dlinkit** (per `DESIGN.md`) while the internal package/database name stays `dlinkit`.
- Styling is pure CSS split by surface in `public/css/` and imported from `app/globals.css`. No CSS framework, CSS-in-JS, or animation library.
- The real backend is preserved. Demo-data, click-simulation, and referrer-override controls from the static reference are intentionally omitted so no number is fabricated.
- Analytics range is `24h`, `7d` (default), or `30d`; `/api/links` also returns an account-wide `summary` for the stats strip.
- Motion is CSS-only: scroll-driven parallax on two SVG layers, staggered chart entrance, reduced-motion fallbacks.

## Decision log
| Date | Decision | Rationale | Revisit when |
|---|---|---|---|
| 2026-10-29 | Use Next.js/TypeScript and delete the Flask + Express starters | One deployable stack; user chose Next.js | If organizer requires a different runtime |
| 2026-10-29 | Neon Postgres with `pg` and runtime DDL | Credentials provided; avoids migration tooling in a 3-hour build | If schema changes become frequent |
| 2026-10-29 | In-process TTL cache and rate limiter instead of Redis | No Redis credentials; keeps the demo deployable | When multi-instance consistency is required |
| 2026-10-29 | Click insert awaited but failures never block the redirect | Redirect reliability outranks analytics completeness | If analytics must be lossless |
| 2026-10-29 | Rebuild UI to `DESIGN.md` with pure CSS in `public/css/` | User required strict visual match and component-wise maintainable styles | If the design system changes |
| 2026-10-29 | Keep the real backend; omit demo/simulate controls | Every displayed number must come from Postgres | If a judge explicitly asks for demo mode |
| 2026-10-29 | Range-aware stats (`24h`/`7d`/`30d`) + account summary | The new dashboard needs a segmented chart and accurate strip totals | If more ranges are requested |
| 2026-10-29 | CSS-only parallax with `animation-timeline` behind `@supports` | Advanced motion without JS scroll listeners or libraries | If broader browser support is required |
