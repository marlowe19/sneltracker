#!/usr/bin/env node

/**
 * Firestore to Supabase Migration Script
 *
 * Migrates data from Firestore backup to Supabase PostgreSQL
 * Can be run multiple times - uses UPSERT for idempotency
 *
 * Usage: npm run migrate
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in scripts folder
// You can specify a custom env file using ENV_FILE environment variable
// Example: ENV_FILE=.env.production npm run migrate
const defaultEnvFile = ".env";
const envFileName = process.env.ENV_FILE || defaultEnvFile;
const envPath = path.join(__dirname, "..", envFileName);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✓ Loaded environment variables from ${envFileName}`);
} else {
  console.warn("⚠️  No env file found at:", envPath);
  console.warn("   Looking for environment variables in process.env");
}

// Configuration
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_PATH = path.join(
  __dirname,
  "../backups/firebase-backup-local-2025-11-21T19-33-13/backup.json"
);

// Validate environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error(
    "   SUPABASE_SERVICE_ROLE_KEY:",
    SUPABASE_SERVICE_KEY ? "✓" : "✗"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Load backup
let backup;
try {
  backup = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
  console.log("✓ Loaded backup file successfully");
} catch (error) {
  console.error("❌ Failed to load backup file:", error.message);
  process.exit(1);
}

// Mapping storage
const projectIdMap = new Map(); // firestore_id -> postgres UUID

// Helper: Get user UUID by username with caching
const userIdCache = new Map();

async function getUserId(userName) {
  if (!userName) return null;

  // Check cache first
  if (userIdCache.has(userName)) {
    return userIdCache.get(userName);
  }

  // Query Supabase users table
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("user_name", userName)
    .single();

  if (error || !data) {
    console.warn(`  ⚠️  User '${userName}' not found in users table`);
    return null;
  }

  userIdCache.set(userName, data.id);
  return data.id;
}

// ====================
// PHASE 1: MIGRATE PROJECTS
// ====================
async function migrateProjects() {
  console.log("\n📦 Phase 1: Migrating Projects...\n");

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // 1. Migrate SHARED projects from collections.projects
  console.log("→ Migrating shared projects...");
  for (const project of backup.collections.projects || []) {
    try {
      const ownerName = project.data.owner;
      const ownerId = await getUserId(ownerName);

      if (!ownerId) {
        console.error(
          `  ✗ Skipping: ${project.data.name} - owner '${ownerName}' not found in users table`
        );
        errorCount++;
        errors.push({
          type: "shared-project",
          id: project.id,
          name: project.data.name,
          error: `Owner '${ownerName}' not found in users table`,
        });
        continue;
      }

      const projectData = {
        firestore_id: project.id,
        name: project.data.name,
        owner_name: ownerName,
        owner_id: ownerId, // ✅ Now has a valid UUID
        hourly_rate: project.data.hourly_rate || null,
        budget_hours: project.data.budget_hours || null,
        is_shared: project.data.is_shared ?? true,
        is_default: project.data.is_default ?? false,
        created_at: project.data.created_at?._iso || new Date().toISOString(),
        modified_at: project.data.modified_at?._iso || new Date().toISOString(),
      };

      // UPSERT using firestore_id as unique constraint
      const { data, error } = await supabase
        .from("projects")
        .upsert(projectData, { onConflict: "firestore_id" })
        .select("id, firestore_id")
        .single();

      if (error) throw error;

      projectIdMap.set(project.id, data.id);
      successCount++;
      console.log(`  ✓ ${project.data.name} (${project.id} → ${data.id})`);
    } catch (error) {
      errorCount++;
      errors.push({
        type: "shared-project",
        id: project.id,
        name: project.data?.name,
        error: error.message,
      });
      console.error(`  ✗ Failed: ${project.data.name} - ${error.message}`);
    }
  }

  // 2. Migrate USER projects from collections.users[].subcollections.projects
  console.log("\n→ Migrating user projects...");
  for (const user of backup.collections.users || []) {
    const userName = user.id;
    const projects = user.subcollections?.projects || [];

    for (const project of projects) {
      try {
        const ownerId = await getUserId(userName);

        if (!ownerId) {
          console.error(
            `  ✗ Skipping: ${userName}/${project.data.name} - user '${userName}' not found in users table`
          );
          errorCount++;
          errors.push({
            type: "user-project",
            user: userName,
            id: project.id,
            name: project.data?.name,
            error: `User '${userName}' not found in users table`,
          });
          continue;
        }

        const projectData = {
          firestore_id: project.id,
          name: project.data.name,
          owner_name: userName,
          owner_id: ownerId, // ✅ Now has a valid UUID
          hourly_rate: project.data.hourly_rate || null,
          budget_hours: project.data.budget_hours || null,
          is_shared: project.data.is_shared ?? false,
          is_default: project.data.is_default ?? false,
          created_at: project.data.created_at?._iso || new Date().toISOString(),
          modified_at:
            project.data.modified_at?._iso || new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          .upsert(projectData, { onConflict: "firestore_id" })
          .select("id, firestore_id")
          .single();

        if (error) throw error;

        projectIdMap.set(project.id, data.id);
        successCount++;
        console.log(
          `  ✓ ${userName}/${project.data.name} (${project.id} → ${data.id})`
        );
      } catch (error) {
        errorCount++;
        errors.push({
          type: "user-project",
          user: userName,
          id: project.id,
          name: project.data?.name,
          error: error.message,
        });
        console.error(
          `  ✗ Failed: ${userName}/${project.data.name} - ${error.message}`
        );
      }
    }
  }

  console.log(`\n✅ Projects: ${successCount} success, ${errorCount} errors`);
  console.log(`📊 Mapped ${projectIdMap.size} projects\n`);

  return { successCount, errorCount, errors };
}

// ====================
// PHASE 2: MIGRATE PROJECT MEMBERS
// ====================
async function migrateProjectMembers() {
  console.log("\n👥 Phase 2: Migrating Project Members...\n");

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  const errors = [];

  for (const project of backup.collections.projects || []) {
    const postgresProjectId = projectIdMap.get(project.id);
    if (!postgresProjectId) {
      console.warn(
        `  ⚠ Skipping members for ${project.id} - project not found in map`
      );
      skipCount++;
      continue;
    }

    const members = project.subcollections?.members || [];

    for (const member of members) {
      try {
        const memberData = {
          project_id: postgresProjectId,
          user_name: member.data.user_name,
          role: member.data.role || "member",
          hourly_rate: member.data.hourly_rate || null,
          added_at: member.data.added_at?._iso || new Date().toISOString(),
        };

        const { error } = await supabase
          .from("project_members")
          .upsert(memberData, { onConflict: "project_id,user_name" });

        if (error) throw error;

        successCount++;
        console.log(
          `  ✓ ${member.data.user_name} → ${project.data.name} (${member.data.role})`
        );
      } catch (error) {
        errorCount++;
        errors.push({
          type: "member",
          project: project.id,
          member: member.data.user_name,
          error: error.message,
        });
        console.error(
          `  ✗ Failed: ${member.data.user_name} → ${project.data.name} - ${error.message}`
        );
      }
    }
  }

  console.log(
    `\n✅ Members: ${successCount} success, ${skipCount} skipped, ${errorCount} errors\n`
  );

  return { successCount, errorCount, skipCount, errors };
}

// ====================
// PHASE 3: MIGRATE TIME ENTRIES
// ====================
async function migrateTimeEntries() {
  console.log("\n⏰ Phase 3: Migrating Time Entries...\n");

  let successCount = 0;
  let errorCount = 0;
  let noProjectCount = 0;
  const errors = [];

  // 1. Shared project time entries
  console.log("→ Migrating shared project time entries...");
  for (const project of backup.collections.projects || []) {
    const postgresProjectId = projectIdMap.get(project.id);
    const entries = project.subcollections?.["time-entries"] || [];

    for (const entry of entries) {
      try {
        const entryData = {
          firestore_id: entry.id,
          user_name: entry.data.user_name,
          project_id: postgresProjectId || null,
          firestore_project_id: entry.data.project,
          start_time: entry.data.start_time?._iso,
          end_time: entry.data.end_time?._iso || null,
          duration_ms: entry.data.duration_ms || null,
          hourly_rate: entry.data.hourly_rate || null,
          creation_method: entry.data.creation_method || null,
          is_running: entry.data.is_running ?? false,
          created_at: entry.data.created_at?._iso || new Date().toISOString(),
          modified_at: entry.data.modified_at?._iso || new Date().toISOString(),
        };

        const { error } = await supabase
          .from("time_entries")
          .upsert(entryData, { onConflict: "firestore_id" });

        if (error) throw error;
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          type: "shared-entry",
          id: entry.id,
          error: error.message,
        });
        console.error(`  ✗ Failed entry ${entry.id}: ${error.message}`);
      }
    }
  }
  console.log(`  ✓ Processed ${successCount} shared project entries`);

  // 2. User-specific time entries
  console.log("\n→ Migrating user time entries...");
  const userEntriesStart = successCount;
  for (const user of backup.collections.users || []) {
    const entries = user.subcollections?.["time-entries"] || [];

    for (const entry of entries) {
      try {
        const firestoreProjectId = entry.data.project;
        const postgresProjectId = firestoreProjectId
          ? projectIdMap.get(firestoreProjectId)
          : null;

        if (firestoreProjectId && !postgresProjectId) {
          noProjectCount++;
        }

        const entryData = {
          firestore_id: entry.id,
          user_name: entry.data.user_name,
          project_id: postgresProjectId || null,
          firestore_project_id: firestoreProjectId || null,
          start_time: entry.data.start_time?._iso,
          end_time: entry.data.end_time?._iso || null,
          duration_ms: entry.data.duration_ms || null,
          hourly_rate: entry.data.hourly_rate || null,
          creation_method: entry.data.creation_method || null,
          is_running: entry.data.is_running ?? false,
          created_at: entry.data.created_at?._iso || new Date().toISOString(),
          modified_at: entry.data.modified_at?._iso || new Date().toISOString(),
        };

        const { error } = await supabase
          .from("time_entries")
          .upsert(entryData, { onConflict: "firestore_id" });

        if (error) throw error;
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          type: "user-entry",
          user: user.id,
          id: entry.id,
          error: error.message,
        });
        console.error(`  ✗ Failed entry ${entry.id}: ${error.message}`);
      }
    }
  }
  console.log(`  ✓ Processed ${successCount - userEntriesStart} user entries`);

  // 3. Standalone time entries (no project context)
  console.log("\n→ Migrating standalone time entries...");
  const standaloneStart = successCount;
  for (const entry of backup.collections.time_entries || []) {
    try {
      const firestoreProjectId = entry.data.project;
      const postgresProjectId = firestoreProjectId
        ? projectIdMap.get(firestoreProjectId)
        : null;

      if (firestoreProjectId && !postgresProjectId) {
        noProjectCount++;
      }

      const entryData = {
        firestore_id: entry.id,
        user_name: entry.data.user_name,
        project_id: postgresProjectId || null,
        firestore_project_id: firestoreProjectId || null,
        start_time: entry.data.start_time?._iso,
        end_time: entry.data.end_time?._iso || null,
        duration_ms: entry.data.duration_ms || null,
        hourly_rate: entry.data.hourly_rate || null,
        creation_method: entry.data.creation_method || null,
        is_running: entry.data.is_running ?? false,
        created_at: entry.data.created_at?._iso || new Date().toISOString(),
        modified_at: entry.data.modified_at?._iso || new Date().toISOString(),
      };

      const { error } = await supabase
        .from("time_entries")
        .upsert(entryData, { onConflict: "firestore_id" });

      if (error) throw error;
      successCount++;
    } catch (error) {
      errorCount++;
      errors.push({
        type: "standalone-entry",
        id: entry.id,
        error: error.message,
      });
      console.error(`  ✗ Failed entry ${entry.id}: ${error.message}`);
    }
  }
  console.log(
    `  ✓ Processed ${successCount - standaloneStart} standalone entries`
  );

  console.log(
    `\n✅ Time Entries: ${successCount} success, ${errorCount} errors`
  );
  if (noProjectCount > 0) {
    console.warn(
      `⚠️  ${noProjectCount} entries reference unmapped projects (kept firestore_project_id)`
    );
  }
  console.log();

  return { successCount, errorCount, noProjectCount, errors };
}

// ====================
// PHASE 4: MIGRATE EXPENSES
// ====================
async function migrateExpenses() {
  console.log("\n💰 Phase 4: Migrating Expenses...\n");

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  const errors = [];

  for (const expense of backup.collections.expenses || []) {
    try {
      const firestoreProjectId = expense.data.project;
      const postgresProjectId = projectIdMap.get(firestoreProjectId);

      // Skip if project doesn't exist in our map
      if (firestoreProjectId && !postgresProjectId) {
        console.warn(
          `  ⚠ Skipping expense ${expense.id} - project ${firestoreProjectId} not found`
        );
        skipCount++;
        continue;
      }

      const expenseData = {
        firestore_id: expense.id,
        user_name: expense.data.user_name,
        project_id: postgresProjectId || null,
        firestore_project_id: firestoreProjectId || null,
        name: expense.data.name,
        price: expense.data.price,
        includes_vat: expense.data.includes_vat ?? false,
        expense_type: expense.data.expense_type || null,
        date: expense.data.date?._iso,
        created_at: expense.data.created_at?._iso || new Date().toISOString(),
        modified_at: expense.data.modified_at?._iso || new Date().toISOString(),
      };

      const { error } = await supabase
        .from("expenses")
        .upsert(expenseData, { onConflict: "firestore_id" });

      if (error) throw error;
      successCount++;
      console.log(
        `  ✓ ${expense.data.name} - €${expense.data.price} (${expense.data.user_name})`
      );
    } catch (error) {
      errorCount++;
      errors.push({ type: "expense", id: expense.id, error: error.message });
      console.error(`  ✗ Failed expense ${expense.id}: ${error.message}`);
    }
  }

  console.log(
    `\n✅ Expenses: ${successCount} success, ${skipCount} skipped, ${errorCount} errors\n`
  );

  return { successCount, errorCount, skipCount, errors };
}

// ====================
// MAIN EXECUTION
// ====================
async function main() {
  console.log("🚀 Starting Firestore → Supabase Migration\n");
  console.log(`📅 Backup timestamp: ${backup.timestamp}`);

  // Count items
  const sharedProjectsCount = backup.collections.projects?.length || 0;
  const userProjectsCount = (backup.collections.users || []).reduce(
    (sum, u) => sum + (u.subcollections?.projects?.length || 0),
    0
  );
  const sharedEntriesCount = (backup.collections.projects || []).reduce(
    (sum, p) => sum + (p.subcollections?.["time-entries"]?.length || 0),
    0
  );
  const userEntriesCount = (backup.collections.users || []).reduce(
    (sum, u) => sum + (u.subcollections?.["time-entries"]?.length || 0),
    0
  );
  const standaloneEntriesCount = backup.collections.time_entries?.length || 0;
  const expensesCount = backup.collections.expenses?.length || 0;

  console.log(`📊 Found in backup:
  - ${sharedProjectsCount} shared projects
  - ${userProjectsCount} user projects
  - ${sharedEntriesCount} shared project time entries
  - ${userEntriesCount} user time entries
  - ${standaloneEntriesCount} standalone time entries
  - ${expensesCount} expenses
  `);

  const results = {
    projects: null,
    members: null,
    timeEntries: null,
    expenses: null,
  };

  try {
    results.projects = await migrateProjects();
    results.members = await migrateProjectMembers();
    results.timeEntries = await migrateTimeEntries();
    results.expenses = await migrateExpenses();

    console.log("\n✨ Migration Complete!\n");
    console.log("📋 Final Summary:");
    console.log(
      `  Projects:     ${results.projects.successCount} migrated, ${results.projects.errorCount} errors`
    );
    console.log(
      `  Members:      ${results.members.successCount} migrated, ${results.members.errorCount} errors`
    );
    console.log(
      `  Time Entries: ${results.timeEntries.successCount} migrated, ${results.timeEntries.errorCount} errors`
    );
    console.log(
      `  Expenses:     ${results.expenses.successCount} migrated, ${results.expenses.errorCount} errors`
    );
    console.log(
      `\n  Total Errors: ${
        results.projects.errorCount +
        results.members.errorCount +
        results.timeEntries.errorCount +
        results.expenses.errorCount
      }`
    );

    // Save error log if there were any errors
    const allErrors = [
      ...results.projects.errors,
      ...results.members.errors,
      ...results.timeEntries.errors,
      ...results.expenses.errors,
    ];

    if (allErrors.length > 0) {
      const errorLogPath = path.join(__dirname, "migration-errors.json");
      fs.writeFileSync(errorLogPath, JSON.stringify(allErrors, null, 2));
      console.log(`\n⚠️  Error details saved to: ${errorLogPath}`);
    }

    console.log(
      "\n✅ All done! You can run this script again to sync new data.\n"
    );
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run it
main();
