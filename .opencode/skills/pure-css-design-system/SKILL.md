---
name: pure-css-design-system
description: Use when building or restyling frontend UI with pure CSS, theme tokens, component CSS files, and accessible responsive layouts.
---

# Pure CSS Design System

## Non-negotiables
- No CSS frameworks, no CSS-in-JS, no animation libraries. Plain CSS files only.
- Follow `design.md` / `DESIGN.md` and the reference UI. Tokens come first; never hard-code a colour in a component.
- Put styles in `public/css/`, one file per surface, and import them at the top of `app/globals.css` in cascade order.
- Keep JSX class names semantic (`hero`, `strip`, `dash`, `kpi`, `seg`, `bar-row`). No inline style except computed chart widths/heights.
- Structure comes from 1px rules, not shadows or rounded cards.

## File order
1. `tokens.css` — light/dark custom properties, fonts, colour-scheme.
2. `base.css` — reset, body frame, shell, nav, pills, inputs, badges, modal, toast, empty/loading.
3. Surface files — `hero.css`, `dashboard.css`.
4. `responsive.css` — breakpoints and `prefers-reduced-motion` last.

## Themes
- `data-theme="light|dark"` on `<html>`; inline pre-paint script reads `localStorage` key `snip_theme` and falls back to `prefers-color-scheme`.
- Both themes read the same variables. SVG artwork uses `currentColor`/`var(...)` so it inverts automatically.
- Toggle must not require React state; CSS shows the correct sun/moon icon via `html[data-theme]`.

## Quality bar
- Responsive at 900px and 560px; no horizontal overflow.
- Visible keyboard focus; labels for every input; chart has `role="img"` + `aria-label` and per-bar `<title>`.
- Loading, empty, error, success states for every async surface.
- `prefers-reduced-motion` disables transforms, parallax and smooth scrolling.
