# Shared Agent Rules

## Documentation map

Root is intentionally small. Read the file for the area you are touching before editing.

| Path | What it is |
|---|---|
| `README.md` | Organizers' original challenge brief. Do not edit. |
| `AGENTS.md` | These rules. Read first. |
| `DESIGN.md` | Visual and interaction system, tokens, layout, motion. |
| `COMMIT.md` | Human-controlled commit workflow. |
| `docs/brain/` | Project working memory: `AGENT_START_HERE.md` (onboarding), `PROJECT_BRIEF.md`, `DECISIONS.md`, `TASK_STATE.md` (current state), `PROJECT_BRIEF.template.md`. |
| `docs/general/SETUP.md` | Environment, database, Google OAuth, deployment, verification and known limits. |
| `db/db.md` | Database reference and troubleshooting. |

Any new working memory (plans, state, decisions) goes in `docs/brain/`. Any general how-to or reference doc goes in `docs/general/`. Do not add new markdown files to the repository root beyond `README.md`, `AGENTS.md`, `DESIGN.md` and `COMMIT.md`; reference the right folder instead.

## Mission and priorities
Deliver the strongest feasible hackathon prototype within the time limit. Optimize for judging fit, a working demo, reliability, clarity, and deployment—not code volume.

1. Working, deployable prototype first.
2. Meet the official brief and judging rubric.
3. Complete the core user journey end-to-end.
4. Keep the implementation simple and understandable.
5. Add polish and optional features only afterward.

## Don't overengineer
Do not build a platform when a small app solves the problem. Avoid microservices, complex state management, speculative abstractions, extra dependencies, broad refactors, and features not required by the brief. Prefer the smallest complete vertical slice. Cut optional features rather than compromise the core flow or deployment.

## Before implementation
Read `docs/brain/AGENT_START_HERE.md`, the official brief, rubric, `README.md`, and existing instructions. Identify user, problem, value, and demo-critical flow. Ask about consequential unknowns before coding. Do not invent requirements or imply fake integrations are real. If the brief is absent, ask for it.

## Execution and agents
Plan briefly, then build. Main agent owns implementation. Use subagents only when useful and independent; reviewers default to read-only. One owner per file. Do not concurrently mutate shared components, package manifests/lockfiles, routing, env/deployment files, or migrations.

## Database changes
Every database change must come with runnable SQL committed under `db/` — never code-only DDL. This includes new tables, columns, indexes, constraints, functions, and triggers. Make the SQL idempotent (`if not exists`, guarded `alter table`) and safe to re-run. Keep `db/setup.sql` (complete setup), `db/addon.sql` (non-destructive upgrade for existing databases), `db/test.sql` (read-only checks), `db/db.md`, and the runtime schema in `lib/db.ts` in sync. Destructive SQL (drops, truncates, deletes) needs explicit user confirmation and a clear warning at the top of the file.

## Verification
For long installs, lint, build, full tests, migrations, and deploys, ask the user to run the exact command from the correct directory and paste output. Do not claim success without evidence. Distinguish implemented, command-verified, and manually verified. User verifies browser/deployed behavior.

## Security and quality
Keep secrets server-side in environment variables. Never expose secrets in source, logs, commits, screenshots, or client bundles. Validate inputs at trust boundaries; use safe, useful errors; avoid sensitive logs. Keep code idiomatic and changes focused.

## Git and submission
User alone commits, pushes, creates branches, opens PRs, and submits to MLH OrganizerHQ. Never run `commit.js`. Recommend reviewing status and diff before commits. No AI watermarking, bot signatures, generated-by attribution, or unnecessary AI references.
