#!/usr/bin/env bash
# Human-controlled, grouped commit helper.
#
# Stages and commits the working tree in small logical parts, one commit per
# area, so history reads clearly instead of one giant "checkpoint" blob.
#
# Usage (from the repository root):
#   bash commit.js --check          print the plan, stage and commit nothing
#   bash commit.js                  show the plan, ask once, then commit
#
# The script never pushes, branches, amends, rebases or resets. It refuses to
# commit if a .env file or anything that looks like a secret is in the group.
set -euo pipefail

MODE="${1:-run}"
if [[ "$MODE" != "--check" && "$MODE" != "run" ]]; then
  echo "Usage: bash commit.js [--check]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# One message and one path list per commit. Order matters: remove the old app,
# add the new one, then docs and tooling.
GROUP_MESSAGES=(
  "chore: remove the Python starter and its browser assets"
  "chore: stand up the Next.js app with env and build configuration"
  "feat(ui): build the // Snip single-page interface and styles"
  "feat(api): shorten links, redirect, and track click analytics"
  "feat(db): add the guest-ready PostgreSQL schema and setup scripts"
  "docs: record the brief, design decisions and project state"
  "chore(tooling): add the commit helper, local verify script and workspace notes"
)

GROUP_PATHS=(
  "app.py index.html script.js requirements.txt"
  ".gitignore README.md package.json package-lock.json next.config.ts tsconfig.json .env.example"
  "app components public"
  "lib"
  "db"
  "AGENTS.md AGENT_START_HERE.md DECISIONS.md DESIGN.md PROJECT_BRIEF.md PROJECT_BRIEF.template.md README-V2.md TASK_STATE.md"
  "commit.js commit.md verify.local.mjs referenceui.html .opencode"
)

echo "Repository: $(pwd)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"

# Hard stop on anything secret-like in the working tree. .env is also
# gitignored; this is a second line of defence.
secret_paths=$(git status --porcelain | grep -E '(^|/)(\.env(\..*)?|.*\.pem|.*\.key)$' || true)
if [[ -n "$secret_paths" ]]; then
  echo "Refusing to commit: an .env or key file is in the working tree."
  echo "$secret_paths"
  exit 1
fi

pending=()
for index in "${!GROUP_MESSAGES[@]}"; do
  # shellcheck disable=SC2086
  if [[ -n "$(git status --porcelain -- ${GROUP_PATHS[$index]})" ]]; then
    pending+=("$index")
  fi
done

echo
echo "Planned commits (${#pending[@]}):"
for index in "${pending[@]}"; do
  echo
  echo "$((index + 1)). ${GROUP_MESSAGES[$index]}"
  # shellcheck disable=SC2086
  git status --short -- ${GROUP_PATHS[$index]} | sed 's/^/     /'
done

# Anything no group covers is reported, never silently committed.
covered=""
for paths in "${GROUP_PATHS[@]}"; do covered+=" $paths"; done
leftovers=$(git status --porcelain | while IFS= read -r line; do
  file="${line:3}"
  if [[ "$file" == *" -> "* ]]; then file="${file##* -> }"; fi
  skip=0
  # shellcheck disable=SC2086
  for path in $covered; do
    if [[ "$file" == "$path" || "$file" == "$path"/* ]]; then skip=1; break; fi
  done
  if [[ $skip -eq 0 ]]; then echo "  $line"; fi
done)
if [[ -n "$leftovers" ]]; then
  echo
  echo "Unassigned changes (not committed by this script):"
  echo "$leftovers"
fi

if [[ "$MODE" == "--check" ]]; then
  echo
  echo "Dry run only. Nothing staged or committed."
  exit 0
fi

echo
read -r -p "Commit these ${#pending[@]} groups to $(git rev-parse --abbrev-ref HEAD)? (type yes): " commit_ok
if [[ "$commit_ok" != "yes" ]]; then
  echo "Cancelled. Nothing staged or committed."
  exit 0
fi

for index in "${pending[@]}"; do
  # shellcheck disable=SC2086
  git add -A -- ${GROUP_PATHS[$index]}
  # shellcheck disable=SC2086
  if git diff --cached --quiet -- ${GROUP_PATHS[$index]}; then
    echo "Skipped (no staged change): ${GROUP_MESSAGES[$index]}"
    continue
  fi
  git commit -m "${GROUP_MESSAGES[$index]}"
done

echo
echo "Done. Review with:  git log --oneline -10 && git status"
