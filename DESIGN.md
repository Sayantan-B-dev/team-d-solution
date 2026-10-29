# DESIGN.md — //dlinkit (Link Shortener + Analytics)

A single-file, front-end-only link shortener with click analytics. Visual language: **editorial / Swiss-grid, monochrome with bold geometric accents** — inspired by the Devlab reference (thin ruled grid, mono micro-labels, pill buttons, flat shapes).

---

## 1. Design principles

1. **Ruled grid, not cards.** Structure comes from 1px lines (`--line`) dividing hero, stats strip and dashboard — no shadows, no heavy rounding on layout blocks.
2. **Monochrome first, colour as punctuation.** Ink + paper carry 90% of the UI; red, blue and pale-blue appear only in illustration, charts and status.
3. **Two voices.** Space Grotesk for display and body; Space Mono for labels, URLs, numbers and metadata.
4. **Pills for actions.** Every primary action is a fully rounded pill; secondary = outlined pill.
5. **Data is the hero.** Analytics use simple flat bars and bar-rows — no gradients, no 3D.

---

## 2. Theme tokens (light / dark)

Theme is set via `data-theme="light|dark"` on `<html>`; default follows `prefers-color-scheme`, choice persisted in `localStorage` (`dlinkit_theme`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--panel` | `#ffffff` | `#0e0f10` | Page / panels |
| `--ink` | `#0b0b0b` | `#f4f4f2` | Text, icons, black shapes |
| `--muted` | `#555555` | `#a2a7a9` | Secondary text |
| `--line` | `#0b0b0b` | `#f4f4f2` | All 1px rules and outlines |
| `--soft` | `#f3f5f6` | `#17191a` | Inputs, selected rows, tracks |
| `--accent` | `#e8402f` | `#ff5a47` | Red: triangle, expired, spinner |
| `--blue` | `#5b9bb8` | `#6fb0cf` | Chart bars, focus ring, pill shape |
| `--pale` | `#cfe0e6` | `#27424d` | Blobs / dots in artwork |
| `--btn-bg` / `--btn-ink` | `#0b0b0b` / `#fff` | `#f4f4f2` / `#0b0b0b` | Primary pill (inverts) |
| `--frame` | `#b7c4c1` | `#1b2220` | Outer page frame |
| `--ok` | `#1f9d55` | `#4cd68a` | "Live" status |

Rule: **never hard-code colours in components** — SVG artwork and charts read the same CSS variables so the theme switch is instant.

---

## 3. Typography

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| H1 | Space Grotesk | `clamp(38px, 5.4vw, 68px)` | 500 | line-height 1.04, tracking −0.02em |
| H2 | Space Grotesk | `clamp(26px, 3.2vw, 38px)` | 500 | tracking −0.02em |
| Body / lead | Space Grotesk | 14px | 400 | line-height 1.65 |
| Big number | Space Grotesk | 22–26px | 500 | stats strip, KPIs |
| Label | Space Mono | 10–11px | 400 | UPPERCASE, tracking 0.06em |
| Short URL | Space Mono | 12–15px | 700 | always monospaced |

---

## 4. Layout

- **Shell:** max-width 1280px, 1px outer border, inside a 14px tinted frame.
- **Nav:** logo `// dlinkit` (mono) left; nav links, theme toggle, auth pill right.
- **Hero:** 2 columns (1.35fr / 1fr) split by a vertical rule. Left = sparkle + H1, lead, shorten form, result card. Right = geometric SVG artwork.
- **Stats strip:** 5 cells separated by vertical rules — account, links, total clicks, unique visitors, feature tags.
- **Dashboard:** bordered 2-column grid (links table | selected-link analytics).
- **About + footer:** single column, mono footer.
- **Breakpoint 900px:** hero stacks, strip → 2 columns, dashboard stacks, form → 1 column, secondary nav links hide.

---

## 5. Components

| Component | Spec |
|---|---|
| **Pill button** | Radius 999px, 11px mono caps, padding 11×24. Variants: solid (default), `.ghost` (outlined), `.sm` (7×14). Hover lifts 1px. |
| **Input / select** | `--soft` fill, 1px `--line`, radius 10px, 2px `--blue` focus ring. Mono caps label above. |
| **Result card** | Dashed 1px border, `--soft` fill, mono URL, Copy + View stats actions. |
| **Table row** | Mono short code over truncated original URL; selected row tinted `--soft`. |
| **Badge** | Outlined mono pill; `Live` = green outline, `Expired` = solid red. |
| **KPI tile** | 1px outline, radius 12px, label + big number. |
| **Segmented control** | Outlined pill group (24h / 7d / 30d); active = inverted. |
| **Bar chart** | Inline SVG, flat blue bars radius 3, faint grid lines, mono axis labels, `<title>` tooltips. |
| **Bar row** | `label · track · count` — used for devices and referrers (top 5). |
| **Modal** | Centred, 1px border, radius 18px, dim backdrop; Log in / Sign up tabs. |
| **Toast** | Inverted pill, bottom-centre, 2.2s. |
| **Redirect screen** | Full-screen paper background, spinner + destination URL, or "not found / expired" state. |

### Hero artwork (original SVG, themeable)
Four rounded black squares joined by thin lines around a red triangle, a blue pill with a punched hole, a black cursor arrow, a red blob, and pale-blue blob/dot clusters. Black uses `--ink`, the pill hole uses `--bg`, so it inverts correctly in dark mode. It is `aria-hidden`.

---

## 6. Features → UI mapping (checklist coverage)

| Requirement | Where |
|---|---|
| Create short links (auth required) | Hero form; blocked until login; JWT-style signed token (HS256 via Web Crypto, 2h expiry) |
| Fast redirect `/r/:code` | Hash route `#/r/:code`, served from an in-memory `Map` cache |
| Track every click (time, device, referrer) | `track()` records timestamp, device class, browser, referrer host, visitor id |
| Stats + dashboard chart | Dashboard: KPIs, 24h/7d/30d bar chart, device + referrer breakdown, recent clicks |
| Cache for redirects (bonus) | `cache` Map, rebuilt on every write |
| Rate limiting (bonus) | 5 new links / minute / user, with countdown message |
| Custom alias + expiry (bonus) | Optional fields; alias validated + reserved words blocked; expired links show an "expired" page |
| Unique vs total (bonus) | Per-visitor id; both shown in table and KPIs |

---

## 7. Behaviour & states

- **Auth:** passwords are salted + SHA-256 hashed; token stored in `localStorage` and verified on load.
- **Empty states:** mono, centred, instructional copy (signed-out vs no-links variants).
- **Validation:** http(s)-only URLs (blocks `javascript:`), alias `[A-Za-z0-9_-]{3,32}`, all rendered text HTML-escaped.
- **Testing aids:** "Load demo data" seeds 3 links with 14 days of clicks; "Simulate click" adds a random device/referrer; "Test redirect" opens the real redirect route in a new tab. A `?ref=` query on the short link overrides the referrer (e.g. `#/r/docs?ref=twitter`).
- **Cross-tab sync:** `storage` event refreshes the dashboard when a redirect tab logs a click.

---

## 8. Accessibility

- Semantic nav / sections / table / form labels; icon button has `aria-label`.
- Visible focus ring on inputs; high-contrast ink on paper in both themes.
- Chart has `role="img"` + `aria-label` and per-bar `<title>` tooltips; artwork is `aria-hidden`.
- Colour is never the only signal (status badges carry text).

---

## 9. Limits of the single-file build & production path

A static HTML file can't see other people's browsers, so clicks are only recorded where the file/data lives (localStorage). To go production:

| Front-end piece | Replace with |
|---|---|
| `localStorage` links/clicks | **PostgreSQL** (`links`, `clicks`, `users`) |
| In-memory `cache` Map | **Redis** `GET code → url` with TTL = expiry |
| Local JWT sign/verify | Server-signed **JWT** (httpOnly cookie) |
| Client rate limit | Redis token bucket per user + IP |
| `#/r/:code` | Real `GET /r/:code` → 302 + async click insert (queue) |
| Local stats maths | `GET /api/stats/:code` (SQL `GROUP BY` day / device / referrer) |

The UI is already structured around these four operations (`shorten`, `redirect`, `track`, `stats`), so only the data layer needs swapping.