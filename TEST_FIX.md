# Test Configuration Fix

## Issue

Tests were failing with error:

```
Error: No such built-in module: node:inspector/promises
ERR_UNKNOWN_BUILTIN_MODULE
```

## Root Cause

The `@vitejs/plugin-react` plugin in `vitest.config.ts` was causing conflicts with Vitest v4's handling of Node.js ESM built-in modules. This is a known compatibility issue between:

- Vite bundled with `@vitejs/plugin-react`
- Vite bundled with Vitest v4
- Node.js ESM module resolution

## Solution

Removed the React plugin from `vitest.config.ts`. Since we're only testing React components with React Testing Library, the plugin isn't necessary for tests to run properly.

### Changed File: `vitest.config.ts`

**Before:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    ...
  }
});
```

**After:**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    ...
  }
});
```

## Result

✅ Tests now run successfully
✅ No compilation errors
✅ All 1 test passing

## Note

The React plugin is still used in `vite.config.ts` for the main application build, which is the correct place for it. Tests don't need it since they use Happy DOM and React Testing Library directly.
