#!/usr/bin/env bash
set -euo pipefail

# Script to create a branch-protection rule on the remote repository's `main` branch
# Requires the GitHub CLI (`gh`) to be installed and authenticated with a token
# that has admin:repo scope on the repository.

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/ and authenticate (gh auth login)."
  exit 1
fi

ORIGIN_URL=$(git config --get remote.origin.url || true)
if [ -z "$ORIGIN_URL" ]; then
  echo "Unable to read remote.origin.url; run this from a git repo with an 'origin' remote."
  exit 1
fi

# parse owner/repo from origin URL
parse_repo_from_url() {
  local url="$1"
  if [[ "$url" =~ git@github.com:(.+)\.git$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$url" =~ https://github.com/(.+)\.git$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$url" =~ https://github.com/(.+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  echo ""
}

REPO_FULL=$(parse_repo_from_url "$ORIGIN_URL")
if [ -z "$REPO_FULL" ]; then
  echo "Could not parse owner/repo from origin URL: $ORIGIN_URL"
  exit 1
fi

OWNER=$(echo "$REPO_FULL" | cut -d'/' -f1)
REPO_NAME=$(echo "$REPO_FULL" | cut -d'/' -f2)

echo "Applying branch protection to: $OWNER/$REPO_NAME (branch: main)"

read -p "This will require pull requests to merge into 'main' and enforce admins. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted by user."
  exit 1
fi

# Note: Adjust the JSON payload as needed to add required status checks contexts, code owner review, etc.
# This call requires appropriate repository permissions. The gh CLI will use your authenticated user.

gh api --method PUT \
  "/repos/$OWNER/$REPO_NAME/branches/main/protection" \
  -f required_status_checks='{"strict":true,"contexts":[]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
  -f restrictions='null'

echo "Branch protection rule created (or updated). Verify in the repo settings or via 'gh api'."
echo "If you want to require specific CI checks, re-run and add the contexts under required_status_checks.contexts."
