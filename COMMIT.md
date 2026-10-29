# Human-Controlled Git Workflow

The user owns all Git actions that change shared history or submit work. Work happens on `main`.

Before committing: inspect `git status`, review the full diff, check for secrets/generated clutter/unrelated files, and confirm what has actually been verified. The user runs the commit manually.

Agents must not commit/amend, push, create/switch branches, open/merge PRs, submit the project, or run `commit.js`. Do not add AI watermarks, bot signatures, generated-by attribution, or unnecessary AI references.

## Remote

```bash
origin  https://github.com/Sayantan-B-dev/team-d-solution.git
upstream https://github.com/Voyage-Hack4Haldia-26/TEAM-D.git
```

Push with `git push origin main`. The first push of a new branch needs `-u`.

## `commit.js`

Three modes, all local only. It never pushes, branches, amends, rebases or resets.

```bash
bash commit.js --check                  # print the grouped plan, change nothing
bash commit.js "feat: message"          # one commit with every change (use for one coherent change)
bash commit.js "feat: message" --check  # preview the single commit
bash commit.js                          # grouped commits, one per area
```

- Grouped mode stages only each group's own paths with `git add -A -- <paths>`: old starter removal, Next.js scaffold, UI, API, database, docs, tooling.
- It refuses to run if an `.env` or key file is in the working tree, and prints any change that no group covers.
- It asks once for the word `yes` before the first commit and warns if you are not on `main`.

Run it only manually from the repository root.
