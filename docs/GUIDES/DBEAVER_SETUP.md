# DBeaver Setup Guide - Neon PostgreSQL

## Database Connection Details

Your Neon PostgreSQL database connection details:

```
Host:     ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech
Port:     5432
Database: neondb
Username: neondb_owner
Password: (check your .env file for DATABASE_URL)
SSL Mode: require (REQUIRED for Neon)
```

## Step-by-Step Setup in DBeaver

### 1. Install DBeaver (if not installed)

- Download from: https://dbeaver.io/download/
- Choose "DBeaver Community" (free version)
- Install and open the app

### 2. Create New Connection

1. **Open DBeaver**
2. Click **"New Database Connection"** button (or `Database` → `New Database Connection`)
3. Select **PostgreSQL** from the list
4. Click **Next**

### 3. Main Tab Configuration

Enter the following details:

**Connection Settings:**

```
Host:     ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech
Port:     5432
Database: neondb
```

**Authentication:**

```
Username: neondb_owner
Password: your-neon-database-password
```

✅ Check **"Save password"** (optional, for convenience)

### 4. SSL Configuration (CRITICAL!)

⚠️ **Neon requires SSL** - This step is mandatory!

1. Click the **"SSL"** tab at the top
2. **Enable** the checkbox: **"Use SSL"**
3. In **"SSL Mode"** dropdown, select: **"require"**
4. Leave other SSL settings as default

### 5. Test Connection

1. Click **"Test Connection"** button at the bottom
2. If successful, you'll see: ✅ **"Connected"**
3. If it fails, check:
   - SSL is enabled
   - Password is correct
   - Host name is exactly as shown above

### 6. Driver Download (First Time Only)

If prompted to download PostgreSQL driver:

1. Click **"Download"** in the dialog
2. Wait for download to complete
3. Click **"Test Connection"** again

### 7. Finish Setup

1. Click **"Finish"** to save the connection
2. Give it a name like: **"Embellics - Neon DB"**
3. Connection will appear in the left sidebar

### 8. Connect and Browse

1. **Double-click** the connection in the sidebar (or right-click → **Connect**)
2. Expand the tree: `neondb` → `Schemas` → `public` → `Tables`
3. You should see all your tables:
   - `api_keys`
   - `client_users`
   - `conversations`
   - `human_agents`
   - `tenants`
   - `widget_chat_messages`
   - `widget_handoffs`
   - etc.

## Quick Actions in DBeaver

### View Table Data

- Right-click table → **"View Data"**
- Or double-click the table

### Run SQL Queries

1. Click **"SQL Editor"** button (or press `Ctrl+]` / `Cmd+]`)
2. Write your query:
   ```sql
   SELECT * FROM client_users;
   SELECT * FROM human_agents;
   SELECT * FROM widget_handoffs ORDER BY requested_at DESC;
   ```
3. Press `Ctrl+Enter` / `Cmd+Enter` to execute

### Export Data

- Right-click table → **"Export Data"**
- Choose format (CSV, JSON, SQL, etc.)

### Edit Data

- Double-click a cell to edit
- Press `Ctrl+Enter` to save changes

## Common Issues & Solutions

### ❌ "Connection refused"

**Solution:** Check that SSL is enabled in the SSL tab

### ❌ "Password authentication failed"

**Solution:**

1. Get the exact password from your `.env` file
2. Or run: `npx tsx show-db-config.ts`

### ❌ "SSL connection required"

**Solution:**

1. Go to SSL tab
2. Enable "Use SSL"
3. Set SSL Mode to "require"

### ❌ "Driver not found"

**Solution:** Click "Download" when prompted, or go to:
`Database` → `Driver Manager` → `PostgreSQL` → `Download/Update`

## Useful SQL Queries

### Check all users

```sql
SELECT id, email, first_name, last_name, role, tenant_id, onboarding_completed
FROM client_users
ORDER BY created_at DESC;
```

### Check human agents

```sql
SELECT id, name, email, status, active_chats, max_chats, tenant_id
FROM human_agents;
```

### Check recent handoffs

```sql
SELECT id, status, requested_at, assigned_agent_id, last_user_message
FROM widget_handoffs
ORDER BY requested_at DESC
LIMIT 10;
```

### Check API keys

```sql
SELECT id, key_prefix, tenant_id, created_at, last_used_at
FROM api_keys
ORDER BY created_at DESC;
```

### Check all tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Connection String Format

If you prefer to use the connection string directly:

```
postgresql://neondb_owner:your-password@ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require
```

You can paste this in DBeaver:

1. New Connection → PostgreSQL
2. Click "URL" button at the bottom
3. Paste the full connection string
4. Click "Test Connection"

## Tips

- **Keyboard Shortcuts:**
  - `Ctrl+Enter` / `Cmd+Enter`: Execute SQL
  - `Ctrl+Shift+E` / `Cmd+Shift+E`: Execute SQL script
  - `F4`: Open SQL Editor
  - `Ctrl+]` / `Cmd+]`: New SQL Editor

- **Auto-refresh Data:**
  - Right-click connection → Properties → Connection → Auto-commit: Enable
  - Set auto-refresh interval if needed

- **Multiple Queries:**
  - Separate queries with semicolons
  - Select specific query to run only that one
  - Or run all with `Ctrl+Shift+E`

## Security Note

⚠️ The connection credentials shown here are from your `.env` file. Keep them secure:

- Don't share screenshots with credentials
- Don't commit connection details to Git
- Use DBeaver's password manager to store credentials securely

## Need Help?

Run this command anytime to see connection details:

```bash
npx tsx show-db-config.ts
```

---

Happy querying! 🎉
