# Enforce Pull Requests for merging into `main`

This repository prefers that contributors open pull requests instead of pushing directly to the `main` branch.

Two complementary measures are provided below:

1. A script that configures GitHub branch protection using the GitHub CLI (`gh`). This modifies repository settings on GitHub to require pull requests and optionally enforce other checks.
2. A local `pre-push` git hook template to help prevent accidental direct pushes to `main` (local only; users must enable it in their clones).

---

Prerequisites

- GitHub CLI (`gh`) installed and authenticated (https://cli.github.com/).
- Your authenticated `gh` user must have admin rights on the repository to modify branch protection.

Using the provided script

1. Make the script executable:

```bash
chmod +x scripts/protect-main.sh
```

2. Run it from the repository root:

```bash
./scripts/protect-main.sh
```

The script will parse the `origin` remote to determine the owner/repo, prompt for confirmation, and then call the GitHub API (via `gh api`) to put a branch-protection rule on `main` that:

- requires pull requests to merge
- enforces admins
- requires pull request reviews (dismiss stale reviews)

If you want to require CI checks to pass before merging, edit the script to add the required `contexts` in the `required_status_checks` payload.

Web UI alternative

1. Go to your repository on GitHub.
2. Settings -> Branches -> Add rule.
3. Type `main` as the branch name pattern.
4. Check `Require pull request reviews before merging` and `Restrict who can push to matching branches` and/or `Require status checks to pass before merging` as needed.

Local git hook to discourage direct pushes

There's a template hook at `.githooks/pre-push`. This is not active by default. To enable it in your local clone run:

```bash
git config core.hooksPath .githooks
```

This will make Git use the hook found in `.githooks/pre-push` and stop direct pushes from your local machine (it prevents the push locally; repository-level protection must still be configured on GitHub).

---

Notes

- The script and hook are convenience tools. The authoritative enforcement is a branch protection rule configured on GitHub (via web UI or API).
- Branch protection requires repository admin permissions to change. If you do not have them, ask a repository admin to run the script or use the web UI.
