# Firestore to Supabase Migration

This directory contains the migration script for moving data from Firestore to Supabase (PostgreSQL).

## Overview

The migration script (`migrate-firestore-to-supabase.mjs`) performs a complete data migration in 4 phases:

1. **Projects** - Migrates both shared and user-specific projects
2. **Project Members** - Migrates team members for shared projects
3. **Time Entries** - Migrates all time tracking entries
4. **Expenses** - Migrates project expenses

## Prerequisites

### 1. Database Tables

Ensure all required tables exist in Supabase. Run these migrations:

```bash
# In Supabase SQL Editor, run these in order:
# (These should already be in your supabase-migrations folder)
001_create_notes_tables.sql
002_create_rls_policies.sql
003_add_due_date.sql
004_create_time_entries_table.sql
005_create_expenses_table.sql
```

**Key tables needed:**
- `public.projects` (with `firestore_id` UNIQUE column)
- `public.project_members` (with `project_id, user_name` unique constraint)
- `public.time_entries` (with `firestore_id` UNIQUE column)
- `public.expenses` (with `firestore_id` UNIQUE column)

### 2. Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **Important:** Use the SERVICE ROLE key, not the anon key (to bypass RLS during migration).

### 3. Firestore Backup

The script expects a backup file at:
```
scripts/backups/firebase-backup-local-2025-11-15T08-07-04/backup.json
```

To create a fresh backup:
```bash
npm run backup:firebase:local
```

## Running the Migration

### First Time Migration

```bash
cd sneltrack
npm run migrate
```

### Subsequent Runs (Weekly Updates)

The script is **idempotent** - you can run it multiple times safely:

```bash
npm run migrate
```

This will:
- Skip existing records (using UPSERT with `firestore_id`)
- Update modified records
- Add new records

## What Gets Migrated

### Phase 1: Projects
- ✅ Shared projects from `collections.projects[]`
- ✅ User projects from `collections.users[]/subcollections/projects[]`
- ✅ All project metadata (name, rates, budgets, etc.)
- ✅ Timestamps preserved

**Mapping Created:**
- Firestore project ID → PostgreSQL UUID
- Stored in `projectIdMap` for linking other entities

### Phase 2: Project Members
- ✅ All members from shared projects
- ✅ Member roles (owner/member)
- ✅ Member-specific hourly rates
- ✅ Join dates

### Phase 3: Time Entries
- ✅ Shared project entries (from `projects[]/subcollections/time-entries[]`)
- ✅ User entries (from `users[]/subcollections/time-entries[]`)
- ✅ Standalone entries (from `collections.time_entries[]`)
- ✅ Links entries to migrated projects via `project_id`
- ✅ Keeps `firestore_project_id` for entries with unmapped projects

### Phase 4: Expenses
- ✅ All expenses from `collections.expenses[]`
- ✅ Links to projects via `project_id`
- ✅ Expense metadata (type, price, VAT status, etc.)

## Output

The script provides detailed logging:

```
🚀 Starting Firestore → Supabase Migration

📦 Phase 1: Migrating Projects...
→ Migrating shared projects...
  ✓ Guest House schilderwerkzaamheden (II5a0hvI5SWunqXN4Yh8 → uuid-...)
  ✓ Brielsemeer verbouwing (U30LAEijHIa4Fke9WELl → uuid-...)
  ...

✅ Projects: 10 success, 0 errors
📊 Mapped 10 projects

👥 Phase 2: Migrating Project Members...
  ✓ dire → Guest House schilderwerkzaamheden (member)
  ...

✅ Members: 25 success, 0 errors

⏰ Phase 3: Migrating Time Entries...
  ✓ Processed 150 shared project entries
  ...

✅ Time Entries: 350 success, 0 errors

💰 Phase 4: Migrating Expenses...
  ✓ Balken - €150 (marlowe)
  ...

✅ Expenses: 4 success, 0 errors

✨ Migration Complete!
```

## Error Handling

If errors occur, they are:
1. Logged to console with details
2. Saved to `scripts/migration/migration-errors.json` for review
3. Don't stop the migration (best-effort approach)

Example error log entry:
```json
{
  "type": "shared-project",
  "id": "abc123",
  "error": "duplicate key value violates unique constraint"
}
```

## Verifying Migration

After migration, verify data in Supabase:

```sql
-- Check project counts
SELECT 
  is_shared,
  COUNT(*) as count,
  COUNT(DISTINCT owner_name) as unique_owners
FROM public.projects
GROUP BY is_shared;

-- Check time entries linked to projects
SELECT 
  COUNT(*) as total_entries,
  COUNT(project_id) as entries_with_project,
  COUNT(firestore_project_id) as entries_with_firestore_ref
FROM public.time_entries;

-- Check project members
SELECT 
  p.name,
  COUNT(pm.*) as member_count
FROM public.projects p
LEFT JOIN public.project_members pm ON p.id = pm.project_id
WHERE p.is_shared = true
GROUP BY p.id, p.name
ORDER BY member_count DESC;

-- Check expenses
SELECT 
  COUNT(*) as total_expenses,
  SUM(price) as total_amount,
  COUNT(DISTINCT project_id) as projects_with_expenses
FROM public.expenses;
```

## Data Mapping

### Firestore → PostgreSQL

| Firestore Location | PostgreSQL Table | Key Field |
|-------------------|------------------|-----------|
| `collections.projects[]` | `public.projects` | `firestore_id` |
| `users/{user}/projects/` | `public.projects` | `firestore_id` |
| `projects/{id}/members/` | `public.project_members` | `project_id, user_name` |
| `projects/{id}/time-entries/` | `public.time_entries` | `firestore_id` |
| `users/{user}/time-entries/` | `public.time_entries` | `firestore_id` |
| `collections.time_entries[]` | `public.time_entries` | `firestore_id` |
| `collections.expenses[]` | `public.expenses` | `firestore_id` |

## Troubleshooting

### "Missing environment variables"
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Make sure you're in the `sneltrack/` directory

### "Failed to load backup file"
- Verify backup exists at expected path
- Update `BACKUP_PATH` in script if using different backup
- Generate fresh backup: `npm run backup:firebase:local`

### "Duplicate key violations"
- Safe to ignore on subsequent runs - means data already exists
- Script uses UPSERT to handle this gracefully

### "Foreign key violations"
- Usually means projects weren't migrated first
- Run migration again (Phase 1 runs first)
- Check `projectIdMap` has entries

### "No projects mapped"
- Phase 1 failed - check console for errors
- Verify `projects` table exists with `firestore_id` column
- Check Supabase permissions

## Cleanup After Migration

Once fully migrated and verified, you can:

1. **Remove temporary fields** (optional):
```sql
-- These were only for migration tracking
ALTER TABLE public.time_entries DROP COLUMN firestore_project_id;
ALTER TABLE public.expenses DROP COLUMN firestore_project_id;
ALTER TABLE public.projects DROP COLUMN firestore_id;
ALTER TABLE public.time_entries DROP COLUMN firestore_id;
ALTER TABLE public.expenses DROP COLUMN firestore_id;
```

2. **Update application code** to use Supabase instead of Firestore

3. **Keep Firestore read-only** as backup during transition period

## Migration Schedule

Recommended approach:

**Week 1:** Initial migration
- Run full migration
- Verify all data
- Test with Supabase in read-only mode

**Week 2-4:** Parallel operation
- Keep Firestore as primary
- Sync to Supabase weekly with `npm run migrate`
- Test application features with Supabase

**Week 5+:** Switch over
- Make Supabase primary
- Keep Firestore as backup
- Eventually deprecate Firestore

## Support

For issues or questions:
1. Check error log: `scripts/migration/migration-errors.json`
2. Review SQL execution in Supabase dashboard
3. Verify environment variables
4. Check table schemas match expectations

## Files

- `migrate-firestore-to-supabase.mjs` - Main migration script
- `README.md` - This file
- `migration-errors.json` - Generated error log (if errors occur)

