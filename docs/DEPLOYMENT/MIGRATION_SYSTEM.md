# Professional Database Migration System

## Why This Way? (The Right Answer™)

### ❌ What We're NOT Using: `drizzle-kit push`

`drizzle-kit push` is **dangerous in production** because:

- Auto-syncs schema without review
- Can't rollback easily
- No audit trail of what changed
- Can cause data loss if not careful

### ✅ What We ARE Using: Explicit SQL Migrations

**Professional approach** with:

- Full control over each change
- Audit trail (migration files + database table)
- Rollback capability
- Safe, tested, reviewable

## How It Works

### Migration Files

```
migrations/
├── 0000_init_migrations_table.sql  ← Tracks applied migrations
├── 0008_fix_combined_cost_type.sql ← Our current fix
└── ...future migrations...
```

### Migration Runner (`scripts/migrate.ts`)

1. Reads all `.sql` files from `migrations/`
2. Checks `schema_migrations` table for applied migrations
3. Runs only NEW migrations in alphabetical order
4. Records each migration as applied
5. Safe, idempotent, production-ready

### Deployment Flow

```
Push → Build → npm run db:migrate → Start Server
                      ↑
            Runs only new migrations safely
```

## Current Migration

**File**: `0008_fix_combined_cost_type.sql`

```sql
ALTER TABLE chat_analytics
ALTER COLUMN combined_cost TYPE real USING combined_cost::real;
```

**Fixes**: "invalid input syntax for type integer: '10.5'"  
**Allows**: Decimal costs from Retell (10.5, 12.0, etc.)

## Configuration

### render.yaml (✅ Ready)

```yaml
preDeployCommand: npm run db:migrate
```

### package.json (✅ Ready)

```json
"db:migrate": "tsx scripts/migrate.ts"
```

## Safety Features

✅ **Idempotent** - Safe to run multiple times  
✅ **Tracked** - `schema_migrations` table shows history  
✅ **Fail-safe** - Deployment stops if migration fails  
✅ **Rollback** - Can create reverse migrations if needed

## Creating New Migrations

```bash
# 1. Create migration file (numbered sequentially)
touch migrations/0009_add_feature.sql

# 2. Write SQL
ALTER TABLE users ADD COLUMN preferences JSONB;

# 3. Update schema.ts for TypeScript types
export const users = pgTable('users', {
  preferences: jsonb('preferences'),
});

# 4. Commit and push - migrations run automatically!
```

## Testing Locally

```bash
npm run db:migrate
```

Output:

```
🔄 Starting database migrations...
⏭️  Skipping 0000_init_migrations_table.sql (already applied)
⚡ Applying 0008_fix_combined_cost_type.sql...
✅ Applied 0008_fix_combined_cost_type.sql
✅ Successfully applied 1 migration(s)!
```

## What Happens on Deploy

1. Code pushed to GitHub ✅
2. Render builds app ✅
3. **npm run db:migrate** executes ✅
4. Only new migrations run ✅
5. Server starts with updated schema ✅

## Why This Is Professional

This is how **Stripe, GitHub, and serious companies** handle migrations:

✅ **Explicit control** - Review every change  
✅ **Audit trail** - Know what changed and when  
✅ **Safe rollback** - Reverse changes if needed  
✅ **Team-friendly** - Clear migration history  
✅ **Production-grade** - Battle-tested approach

**No shortcuts. The right way.** 💪
