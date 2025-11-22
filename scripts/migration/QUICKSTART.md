# Migration Quick Start

## 🚀 Run Migration in 3 Steps

### Step 1: Prepare Database

Run the expenses table migration in Supabase SQL Editor:

```sql
-- Copy and run: supabase-migrations/005_create_expenses_table.sql
```

Or if you haven't run any migrations yet:
```sql
-- Run all migrations in order:
-- 001_create_notes_tables.sql
-- 002_create_rls_policies.sql  
-- 003_add_due_date.sql
-- 004_create_time_entries_table.sql
-- 005_create_expenses_table.sql
```

### Step 2: Check Environment

Make sure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb... (your service role key)
```

### Step 3: Run Migration

```bash
cd sneltrack
npm run migrate
```

That's it! 🎉

---

## What Happens?

The script will:
1. ✅ Migrate all projects (shared + user projects)
2. ✅ Migrate project members
3. ✅ Migrate time entries (linking to projects)
4. ✅ Migrate expenses

**Safe to run multiple times** - uses UPSERT so no duplicates.

---

## Expected Output

```
🚀 Starting Firestore → Supabase Migration

📊 Found in backup:
  - 8 shared projects
  - 5 user projects
  - 100 shared project time entries
  - 80 user time entries
  - 70 standalone time entries
  - 4 expenses

📦 Phase 1: Migrating Projects...
✅ Projects: 13 success, 0 errors

👥 Phase 2: Migrating Project Members...
✅ Members: 25 success, 0 errors

⏰ Phase 3: Migrating Time Entries...
✅ Time Entries: 250 success, 0 errors

💰 Phase 4: Migrating Expenses...
✅ Expenses: 4 success, 0 errors

✨ Migration Complete!
```

---

## Verify in Supabase

```sql
-- Quick verification queries
SELECT COUNT(*) as projects FROM public.projects;
SELECT COUNT(*) as members FROM public.project_members;
SELECT COUNT(*) as entries FROM public.time_entries;
SELECT COUNT(*) as expenses FROM public.expenses;
```

---

## Troubleshooting

**"Missing environment variables"**
→ Add them to `.env.local`

**"Failed to load backup file"**
→ Run `npm run backup:firebase:local` first

**"Table does not exist"**
→ Run the SQL migrations in Supabase

**Need help?**
→ Check `scripts/migration/README.md` for full docs

---

## Running Weekly Updates

Just run the same command:
```bash
npm run migrate
```

It will:
- Skip existing records
- Update changed records  
- Add new records

**No data loss!** 🛡️

