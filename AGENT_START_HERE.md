# Universal Agent Startup Protocol

Applies regardless of model, coding agent, CLI, or IDE.

## Before coding
1. Inspect repository root, Git status, project scripts, framework, README, and organizer instructions.
2. Read `AGENTS.md`, `PROJECT_BRIEF.md`, `TASK_STATE.md`, and `DECISIONS.md`.
3. If the official challenge brief is missing, ask the user for it. Never invent a solution.
4. Ask the user **before implementation** about consequential unknowns that could change product direction, architecture, data, integrations, credentials, cost, privacy, deployment, or acceptance criteria. Ask one concise, consolidated set of questions. Do not ask about harmless reversible choices; choose a sensible default and proceed.

## Prototype first; avoid overcomplication
- The first milestone is the smallest complete, working, deployable prototype—not a perfect architecture or a long plan.
- Identify one core user journey and implement it end-to-end.
- Prefer the existing repository, conventions, and simplest suitable stack.
- Avoid speculative features, unnecessary dependencies, elaborate abstractions, premature optimization, and broad refactors.
- Build in this order: app starts → core journey works → useful loading/empty/error states → deployment readiness → polish → optional extras.
- Make a short plan, then start building. Do not spend the hackathon planning endlessly.
- Mock data is acceptable only when allowed and clearly labeled. Never claim a mock is a live integration.

## Ask beforehand if
- The challenge or judging rubric is ambiguous in a way that changes the product.
- Real data/API integration versus mock data is consequential.
- Paid services, API keys, external accounts, a database, sensitive data, or a new backend may be required.
- A choice may block deployment within the time window.
- An organizer file or existing architecture would be removed or substantially changed.
- External side effects or credentials are involved.

## Multiple agents
- One owner per file at a time.
- Parallelize genuinely independent work (read-only rubric analysis, UX/accessibility review, security review, pitch checklist).
- Main agent owns implementation; reviewers default to read-only.
- Never concurrently edit shared components, package manifests/lockfiles, routing, environment files, deployment config, or migrations.
- Treat agent output as suggestions until checked against repository state and requirements.

## Long commands and verification
For long installs, lint, build, full tests, migrations, or deployment: finish safe implementation, give the user the exact command and working directory, ask them to run it and paste output, then wait before claiming success. Continue only with independent work that cannot invalidate the check.
The user manually verifies browser and deployed behavior. Provide a short checklist; do not claim unverified behavior.

## Code quality
Readable, idiomatic, small changes. Validate untrusted input. Handle likely failures with useful messages. Log only what helps; never log secrets, tokens, personal data, or sensitive payloads. Avoid breaking existing behavior and preserve organizer files.

## Git and submissions
Never commit, push, create branches, open PRs, or submit to OrganizerHQ for the user. Never run `commit.js`. Do not add AI watermarks, bot signatures, generated-by attribution, or unnecessary AI references. Ask the user to inspect `git status` and the diff before committing.

## Handoff
Keep `TASK_STATE.md` factual: working, missing, known issues, actual command results, manual checks, next action. Put durable decisions in `DECISIONS.md`; avoid repetitive notes.
