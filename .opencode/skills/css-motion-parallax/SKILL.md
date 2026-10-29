---
name: css-motion-parallax
description: Use when adding smooth, advanced motion with pure CSS, especially layered parallax, chart entrance animations, and reduced-motion fallbacks.
---

# CSS Motion and Parallax

## Rules
- Pure CSS only. Use `@keyframes`, `transition`, `animation-timeline`/`animation-range`. No scroll listeners, no RAF loops.
- Animate `transform` and `opacity` only; never animate layout properties.
- Use `will-change: transform` sparingly, only on the 2–3 parallax layers.
- Always wrap scroll-driven motion in `@supports (animation-timeline: view())`; the static composition must look correct without support.
- Always disable motion under `@media (prefers-reduced-motion: reduce)`.

## Layered parallax pattern
- Split one composition into 2–3 absolutely-positioned SVG layers with the same `viewBox`.
- Back layer drifts one direction, front layer counter-drifts less; `animation-range: cover 0% cover 100%`.
- Keep total movement under ~60px for a hero; motion should be felt, not watched.
- Decorative layers are `aria-hidden="true"` and `pointer-events: none`.

## Entrance motion
- Bars: `transform-box: fill-box; transform-origin: 50% 100%;` then scale `Y` from 0 to 1 with a short stagger.
- Toasts/modals: translate + fade under 0.25s.
- Theme changes: colour/background transitions around 0.2s.

## Verify
- Build passes; no hydration mismatch; hero artwork remains visible with motion disabled.
- No parallax on elements that contain text or controls.
