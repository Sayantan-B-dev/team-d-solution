#!/usr/bin/env bash
# Human-controlled commit helper for dlinkit.
#
# Three modes, all local only. It never pushes, branches, amends, rebases or
# resets, and it always asks before the first commit.
#
#   bash commit.js --check                 print the plan, change nothing
#   bash commit.js "feat: message"         one commit with every change
#   bash commit.js                         grouped commits, one per area
#
# The repository workflow is human-owned: review the printed status/diff and
# confirm with `yes`. Refuses to run if an .env or key file is in the tree.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MODE="grouped"
MESSAGE=""
case "${1:-}" in
  --check) MODE="check" ;;
  "") ;;
  --*) echo "Usage: bash commit.js [--check | \"commit message\"]"; exit 1 ;;
  *) MODE="single"; MESSAGE="$1" ;;
esac

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Repository: $(pwd)"
echo "Branch: $CURRENT_BRANCH"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Note: this project is committed on main. You are on $CURRENT_BRANCH."
fi

secret_paths=$(git status --porcelain | grep -E '(^|/)(\.env(\..*)?|.*\.pem|.*\.key)$' || true)
if [[ -n "$secret_paths" ]]; then
  echo "Refusing to commit: an .env or key file is in the working tree."
  echo "$secret_paths"
  exit 1
fi

GROUP_MESSAGES=(
  "chore: remove the Python starter and its browser assets"
  "chore: stand up the Next.js app with env and build configuration"
  "feat(ui): build the dlinkit single-page interface and styles"
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
  "AGENTS.md DESIGN.md COMMIT.md docs"
  "commit.js verify.local.mjs .opencode"
)

# ---------------------------------------------------------------------------
# Single commit: every change under one message (use for one coherent change
# such as a rebrand that touches app, docs and database comments together).
# ---------------------------------------------------------------------------
if [[ "$MODE" == "single" ]]; then
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "Nothing to commit. Working tree is clean."
    exit 0
  fi

  echo
  echo "Single commit with every change:"
  echo "  $MESSAGE"
  echo
  git status --short | sed 's/^/  /'
  echo
  git diff --stat | sed 's/^/  /'

  if [[ "$MODE" == "check" ]]; then :; fi
  if [[ "${2:-}" == "--check" ]]; then
    echo
    echo "Dry run only. Nothing staged or committed."
    exit 0
  fi

  echo
  read -r -p "Stage ALL changes and commit as \"$MESSAGE\"? (type yes): " ok
  if [[ "$ok" != "yes" ]]; then
    echo "Cancelled. Nothing staged or committed."
    exit 0
  fi

  git add -A
  git commit -m "$MESSAGE"
  echo
  echo "Done. Review with:  git log --oneline -3 && git status"
  exit 0
fi

# ---------------------------------------------------------------------------
# Grouped mode: one commit per area, in order.
# ---------------------------------------------------------------------------
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

if [[ "$MODE" == "check" ]]; then
  echo
  echo "Dry run only. Nothing staged or committed."
  exit 0
fi

echo
read -r -p "Commit these ${#pending[@]} groups to $CURRENT_BRANCH? (type yes): " commit_ok
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
