# Development Workflow

## Pre-Commit Checklist

### Always Before Committing to Git:

1. **Run Prettier** to format all code:

   ```bash
   npm run format
   # or
   npx prettier --write .
   ```

2. **Check for lint errors**:

   ```bash
   npm run lint
   ```

3. **Run type checking** (if applicable):

   ```bash
   npm run type-check
   # or
   npx tsc --noEmit
   ```

4. **Stage and commit**:
   ```bash
   git add -A
   git commit -m "your message"
   git push origin <branch-name>
   ```

## Quick Command Sequence

```bash
# Format, lint, and commit in one go
npm run format && npm run lint && git add -A && git commit -m "your message" && git push
```

## Automated Setup (Recommended)

### Option 1: Husky + Lint-Staged (Automatic on commit)

Install husky and lint-staged:

```bash
npm install --save-dev husky lint-staged
npx husky init
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write", "git add"]
  }
}
```

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

### Option 2: Git Hooks (Manual setup)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
echo "Running Prettier..."
npm run format
git add -A
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

## VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Package.json Scripts

Ensure these scripts exist in `package.json`:

```json
{
  "scripts": {
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,css,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,css,md}\"",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix"
  }
}
```

## Remember

✅ **ALWAYS run `npm run format` or `npx prettier --write .` before committing**

This ensures:

- Consistent code style across the project
- No formatting conflicts in pull requests
- Clean git diffs focused on actual changes
- Professional code quality
