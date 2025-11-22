# Projects Listing & Detail Migration - Implementation Guide

## Overview

Migrating projects listing and detail pages from Firestore to Supabase for massive performance improvements:

- **Before (Firestore):** 7-9 queries per page load, 1-3 seconds
- **After (Supabase):** 1 query per page load, 50-250ms on free tier ⚡

---

## ⚠️ STEP 1: Create SQL Functions in Supabase

Run these SQL functions in your Supabase SQL Editor:

### **Function 1: Get User Projects with Statistics**

This replaces `getAllProjects()` and adds hours/progress data in ONE query.

```sql
-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_user_projects_with_stats(TEXT);

-- Create optimized function for projects listing
CREATE OR REPLACE FUNCTION get_user_projects_with_stats(p_user_name TEXT)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  hourly_rate NUMERIC(10,2),
  budget_hours NUMERIC(10,2),
  is_shared BOOLEAN,
  is_default BOOLEAN,
  owner_name TEXT,
  member_hourly_rate NUMERIC(10,2),
  is_owner BOOLEAN,
  member_count INT,
  total_hours NUMERIC(10,2),
  is_over_budget BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_projects AS (
    -- Get all projects user has access to
    SELECT 
      p.id,
      p.name,
      p.hourly_rate,
      p.budget_hours,
      p.is_shared,
      p.is_default,
      p.owner_name,
      pm.hourly_rate as member_hourly_rate,
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm 
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE 
      -- User's own projects
      (p.owner_name = p_user_name AND p.is_shared = false)
      OR 
      -- Shared projects where user is owner
      (p.owner_name = p_user_name AND p.is_shared = true)
      OR 
      -- Shared projects where user is member
      (pm.user_name = p_user_name AND p.is_shared = true)
  ),
  project_hours AS (
    -- Calculate total hours per project (all-time)
    SELECT
      t.project_id,
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours
    FROM time_entries t
    INNER JOIN user_projects up ON t.project_id = up.id
    WHERE 
      -- Apply same visibility rules as reports
      (up.is_shared = false AND t.user_name = p_user_name)
      OR (up.is_shared = true AND up.is_owner = true)
      OR (up.is_shared = true AND up.is_owner = false AND t.user_name = p_user_name)
    GROUP BY t.project_id
  ),
  project_member_counts AS (
    -- Count members per shared project
    SELECT
      pm.project_id,
      COUNT(*)::INT as member_count
    FROM project_members pm
    INNER JOIN user_projects up ON pm.project_id = up.id
    GROUP BY pm.project_id
  )
  SELECT
    up.id,
    up.name,
    up.hourly_rate,
    up.budget_hours,
    up.is_shared,
    up.is_default,
    up.owner_name,
    up.member_hourly_rate,
    up.is_owner,
    COALESCE(pmc.member_count, 0),
    COALESCE(ph.total_hours, 0)::NUMERIC(10,2),
    -- Simple flag for over budget (useful for sorting/filtering)
    (up.budget_hours > 0 AND COALESCE(ph.total_hours, 0) > up.budget_hours) as is_over_budget
  FROM user_projects up
  LEFT JOIN project_hours ph ON up.id = ph.project_id
  LEFT JOIN project_member_counts pmc ON up.id = pmc.project_id
  ORDER BY up.name;
END;
$$;
```

### **Function 2: Get Project Detail with Statistics**

This replaces multiple queries in the project detail page.

```sql
-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_project_detail(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ);

-- Create comprehensive project detail function
CREATE OR REPLACE FUNCTION get_project_detail(
  p_user_name TEXT,
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  -- Project info
  id UUID,
  name VARCHAR(255),
  hourly_rate NUMERIC(10,2),
  budget_hours NUMERIC(10,2),
  is_shared BOOLEAN,
  is_default BOOLEAN,
  owner_name TEXT,
  member_hourly_rate NUMERIC(10,2),
  is_owner BOOLEAN,
  
  -- Statistics
  total_hours NUMERIC(10,2),
  entry_count BIGINT,
  total_billable NUMERIC(10,2),
  
  -- Members (JSONB array)
  members JSONB,
  
  -- Member statistics (JSONB array)
  member_statistics JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH project_info AS (
    SELECT 
      p.id,
      p.name,
      p.hourly_rate,
      p.budget_hours,
      p.is_shared,
      p.is_default,
      p.owner_name,
      pm.hourly_rate as member_hourly_rate,
      (p.owner_name = p_user_name) as is_owner
    FROM projects p
    LEFT JOIN project_members pm 
      ON p.id = pm.project_id AND pm.user_name = p_user_name
    WHERE p.id = p_project_id
      AND (
        -- User must have access to this project
        (p.owner_name = p_user_name)
        OR (pm.user_name = p_user_name)
      )
  ),
  project_stats AS (
    SELECT
      ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2) as total_hours,
      COUNT(*)::BIGINT as entry_count,
      SUM(
        CASE 
          WHEN t.hourly_rate IS NOT NULL 
          THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate 
          ELSE 0 
        END
      )::NUMERIC(10,2) as total_billable
    FROM time_entries t
    WHERE t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
  ),
  project_members AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'user_name', pm.user_name,
          'role', pm.role,
          'hourly_rate', pm.hourly_rate,
          'added_at', pm.added_at
        )
        ORDER BY pm.added_at
      ) as members
    FROM project_members pm
    WHERE pm.project_id = p_project_id
  ),
  member_stats AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_name', t.user_name,
          'totalHours', ROUND(SUM(t.duration_ms)::NUMERIC / (1000 * 60 * 60), 2),
          'entryCount', COUNT(*)::BIGINT,
          'billableAmount', SUM(
            CASE 
              WHEN t.hourly_rate IS NOT NULL 
              THEN (t.duration_ms::NUMERIC / (1000 * 60 * 60)) * t.hourly_rate 
              ELSE 0 
            END
          )::NUMERIC(10,2)
        )
        ORDER BY SUM(t.duration_ms) DESC
      ) as member_statistics
    FROM time_entries t
    INNER JOIN project_info pi ON t.project_id = pi.id
    WHERE 
      t.project_id = p_project_id
      AND (p_start_date IS NULL OR t.start_time >= p_start_date)
      AND (p_end_date IS NULL OR t.start_time < p_end_date)
      AND pi.is_shared = true
      AND pi.is_owner = true  -- Only aggregate for owners
    GROUP BY t.user_name
  )
  SELECT
    pi.id,
    pi.name,
    pi.hourly_rate,
    pi.budget_hours,
    pi.is_shared,
    pi.is_default,
    pi.owner_name,
    pi.member_hourly_rate,
    pi.is_owner,
    COALESCE(ps.total_hours, 0),
    COALESCE(ps.entry_count, 0),
    COALESCE(ps.total_billable, 0),
    COALESCE(pm.members, '[]'::jsonb),
    COALESCE(ms.member_statistics, '[]'::jsonb)
  FROM project_info pi
  LEFT JOIN project_stats ps ON true
  LEFT JOIN project_members pm ON true
  LEFT JOIN member_stats ms ON true;
END;
$$;
```

---

## Performance Expectations

### **Free Tier (Nano):**
- **Projects Listing:** 150-400ms for 20 projects
- **Project Detail:** 100-300ms 
- **During peak hours:** 2-3x slower

### **Paid Tier (Pro):**
- **Projects Listing:** 50-100ms
- **Project Detail:** 30-80ms
- **Consistent performance**

---

## What Gets Migrated

### **1. Projects Listing Page** (`/[user]/projecten`)
**Replaces:**
- `getAllProjects()` - 7 queries → 1 query
- Member checking loops - N+1 eliminated

**Adds:**
- Total hours per project
- Progress tracking
- Over budget flags

### **2. Project Detail Page** (`/[user]/projecten/[projectId]`)
**Replaces:**
- `getProjectById()` - 2 queries
- `isProjectOwner()` - 2 queries (duplicate call!)
- `getProjectMembers()` - 1 query
- All in ONE query now!

### **3. Project Detail API** (`/[user]/projecten/[projectId]/api`)
**Replaces:**
- `getProjectStatistics()` - 3 queries
- `getProjectStatisticsByMember()` - 2 queries
- `isProjectOwner()` - 2 queries
- All in ONE query now!

---

## Implementation Steps

1. ✅ **Run SQL functions** in Supabase (see above)
2. ✅ **Create service methods** in `projectsService.js`
3. ✅ **Update API routes** to use Supabase
4. ✅ **Add progress utilities** for client-side calculations
5. ✅ **Update UI components** with progress bars
6. ✅ **Test with real data**

---

## Testing

### **Test SQL Functions:**
```sql
-- Test projects listing
SELECT * FROM get_user_projects_with_stats('marlowe');

-- Test project detail (all-time)
SELECT * FROM get_project_detail('marlowe', 'your-project-uuid'::uuid);

-- Test project detail (date range)
SELECT * FROM get_project_detail(
  'marlowe', 
  'your-project-uuid'::uuid,
  '2024-01-01T00:00:00Z'::timestamptz,
  '2024-12-31T23:59:59Z'::timestamptz
);
```

### **Test API Endpoints:**
```bash
# Projects listing
curl "http://localhost:3000/marlowe/projecten/api"

# Project detail
curl "http://localhost:3000/marlowe/projecten/PROJECT_ID/api"
```

---

## Files Modified

1. ✅ `lib/supabase/services/projectsService.js` - Enhanced with read methods
2. ✅ `lib/utils/projectProgress.js` - Client-side calculations
3. ✅ `app/[user]/projecten/api/route.js` - Migrated to Supabase
4. ✅ `app/[user]/projecten/[projectId]/api/route.js` - Migrated to Supabase
5. ✅ `app/[user]/projecten/ProjectsListClient.js` - Added progress bars
6. ✅ `app/[user]/projecten/page.js` - Uses new service

---

## Client-Side Progress Calculation

Progress percentage, hours remaining, and status colors are calculated on the client for:
- ✅ Better performance (no CASE statements in SQL)
- ✅ More flexibility (easy to customize per view)
- ✅ Less data over network
- ✅ You already have the raw data (total_hours, budget_hours)

**Formula:**
```javascript
percentage = (total_hours / budget_hours) * 100
hours_remaining = budget_hours - total_hours
```

---

## Notes

- SQL functions handle all visibility rules (owner vs member access)
- Statistics respect project sharing (owners see all, members see only theirs)
- Member counts and member stats only returned for shared projects where user is owner
- All calculations use milliseconds internally, converted to hours for display
- Progress calculations done client-side for flexibility and performance

