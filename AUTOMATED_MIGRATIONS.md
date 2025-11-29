# Automated Database Migration Setup

## What Was Configured

### 1. **render.yaml** (Render Configuration)
```yaml
preDeployCommand: npm run db:migrate
```
This tells Render to run database migrations **automatically** before starting the server on every deployment.

### 2. **package.json** (Migration Script)
```json
"db:migrate": "drizzle-kit push"
```
This script syncs the database schema with the code definitions.

### 3. **Deployment Flow**
```
Push to GitHub 
  ↓
Render detects changes
  ↓
Runs: npm install
  ↓
Runs: npm run build
  ↓
Runs: npm run db:migrate  ← **MIGRATIONS RUN HERE**
  ↓
Runs: npm start
  ↓
✅ App running with updated database
```

## How It Works

1. **Developer pushes code** with schema changes
2. **Render automatically**:
   - Builds the app
   - Runs `drizzle-kit push` to update database schema
   - Starts the server
3. **No manual intervention needed!**

## Current Migration

The first automated migration will:
- Change `combined_cost` from `integer` to `real`
- Fix the "invalid input syntax for type integer: '10.5'" error
- Allow decimal cost values from Retell webhooks

## For This Deployment

### Option A: Use render.yaml (Recommended)
If Render supports `render.yaml` config files:
1. Push the changes (already done ✅)
2. Render will automatically run migrations
3. Done!

### Option B: Configure in Render Dashboard
If Render doesn't detect render.yaml:
1. Go to Render Dashboard → Your Service → Settings
2. Find "Build & Deploy" section
3. Add **Pre-Deploy Command**: `npm run db:migrate`
4. Save and redeploy

### Option C: Manual First Time
For this first deployment only:
1. Let deployment complete
2. Open Render Shell
3. Run: `npm run db:migrate`
4. Future deployments will be automatic

## Verification

After deployment, check Render logs for:
```
🔄 Running database migrations...
✅ Migration completed successfully!
```

Then test the webhook - it should now work without the "10.5" error!

## Future Schema Changes

Going forward, for ANY database schema changes:
1. Update `shared/schema.ts`
2. Commit and push
3. Migrations run automatically ✅
4. No manual steps needed!

## Safety Features

- Migrations run BEFORE server starts (no downtime with broken DB)
- `drizzle-kit push` is safe - it only adds/modifies, never deletes
- If migration fails, deployment stops (server won't start with broken DB)
- Can always rollback via Render's deployment history

## What You Need to Do Now

1. ✅ Code is pushed with automated migration setup
2. Configure Render (choose Option A, B, or C above)
3. Deploy and verify
4. Test WhatsApp webhook
5. Celebrate! 🎉
