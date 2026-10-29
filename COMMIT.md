# Human-Controlled Git Workflow

The user owns all Git actions that change shared history or submit work.

Before committing: inspect `git status`, review the full diff, check for secrets/generated clutter/unrelated files, and confirm what has actually been verified. The user runs the commit manually.

Agents must not commit/amend, push, create/switch branches, open/merge PRs, submit the project, or run `commit.js`. Do not add AI watermarks, bot signatures, generated-by attribution, or unnecessary AI references.

`commit.js` commits the project in small, logical groups (remove the Python starter, scaffold Next.js, UI, API, database, docs, tooling) instead of one giant blob. Each group stages only its own paths with `git add -A -- <paths>`.

```bash
bash commit.js --check   # print the planned groups, change nothing
bash commit.js           # show the plan, ask once, then commit each group
```

The script never pushes, branches, amends, rebases or resets. It refuses to run if an `.env` or key file is in the working tree, prints any changes that no group covers, and requires the word `yes` before the first commit. Run it only manually from the repository root.
