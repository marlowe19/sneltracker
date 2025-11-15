#!/usr/bin/env node

/**
 * Firebase Database Backup Script
 *
 * This script creates a complete backup of all Firestore data.
 * It is READ-ONLY and will NOT modify or delete any data.
 *
 * Usage:
 *   cd scripts && npm run backup:firebase              # Uses .env.local (default)
 *   cd scripts && npm run backup:firebase:dev         # Uses .env.development
 *   cd scripts && npm run backup:firebase:local       # Uses .env.local
 *   ENV_FILE=.env.development node backup/backup-firebase.mjs
 *
 * The backup will be saved to: scripts/backups/firebase-backup-YYYY-MM-DD-HH-MM-SS/
 */

import dotenv from "dotenv";
import { resolve } from "path";
import { getDb } from "./firebaseAdmin.js";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which env file to load (from scripts directory)
const envFile = process.env.ENV_FILE || ".env.local";
const envPath = resolve(__dirname, "..", envFile);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`✗ Error loading environment file: ${result.error.message}`);
  console.error(`  Path: ${envPath}`);
  process.exit(1);
}

console.log(`Loading environment from: ${envFile}`);
console.log(`  Resolved path: ${envPath}`);
if (result.parsed) {
  console.log(`  ✓ Loaded ${Object.keys(result.parsed).length} variables`);
}

// Convert Firestore Timestamp to serializable format
function serializeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle Firestore Timestamp
  if (value && typeof value.toDate === "function") {
    return {
      _firestore_timestamp: true,
      _seconds: value.seconds,
      _nanoseconds: value.nanoseconds,
      _iso: value.toDate().toISOString(),
    };
  }

  // Handle Date objects
  if (value instanceof Date) {
    return {
      _date: true,
      _iso: value.toISOString(),
    };
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  // Handle objects
  if (typeof value === "object" && value.constructor === Object) {
    const serialized = {};
    for (const [key, val] of Object.entries(value)) {
      serialized[key] = serializeValue(val);
    }
    return serialized;
  }

  // Primitive values
  return value;
}

// Recursively backup a collection reference
async function backupCollection(collectionRef, path = []) {
  const snapshot = await collectionRef.get();
  const documents = [];
  const processedDocIds = new Set();

  console.log(
    `  Reading collection: ${path.join("/")} (${snapshot.size} documents)`
  );

  // Process documents that were returned by the query
  for (const doc of snapshot.docs) {
    processedDocIds.add(doc.id);
    const data = doc.data();
    const serializedData = serializeValue(data);

    const document = {
      id: doc.id,
      path: doc.ref.path,
      data: serializedData,
      subcollections: {},
    };

    // Get all subcollections for this document
    const subcollections = await doc.ref.listCollections();

    for (const subcollection of subcollections) {
      const subcollectionPath = [...path, doc.id, subcollection.id];
      const subcollectionData = await backupCollection(
        subcollection,
        subcollectionPath
      );
      document.subcollections[subcollection.id] = subcollectionData;
    }

    // Add is_shared field based on project location
    // Top-level projects (in "projects" collection) are shared
    // User projects (under users/{userId}/projects/) are not shared
    if (path.length === 1 && path[0] === "projects") {
      document.data.is_shared = true;
    } else if (
      path.length === 3 &&
      path[0] === "users" &&
      path[2] === "projects"
    ) {
      document.data.is_shared = false;
    }

    documents.push(document);
  }

  // IMPORTANT FIX: Handle empty documents that only have subcollections
  // Firestore doesn't return documents in collection queries if they have no data fields,
  // even if they have subcollections. We need to discover them via collectionGroup queries.
  if (path.length === 1 && path[0] === "users") {
    console.log(`  Checking for empty user documents with subcollections...`);

    const db = collectionRef.firestore;
    const discoveredUserIds = new Set();

    // Use collectionGroup queries to find all subcollections under users
    // Check common subcollections that might exist under user documents
    const subcollectionNames = ["time-entries", "projects"];

    for (const subcollectionName of subcollectionNames) {
      try {
        const subcollectionGroup = await db
          .collectionGroup(subcollectionName)
          .get();

        for (const doc of subcollectionGroup.docs) {
          // Extract user ID from path like "users/{userId}/time-entries/{entryId}"
          const pathParts = doc.ref.path.split("/");
          if (pathParts.length >= 2 && pathParts[0] === "users") {
            discoveredUserIds.add(pathParts[1]);
          }
        }
      } catch (error) {
        // Subcollection might not exist, that's okay - silently continue
      }
    }

    // Process any discovered user documents that weren't already processed
    for (const userId of discoveredUserIds) {
      if (!processedDocIds.has(userId)) {
        console.log(
          `  Found user document with subcollections but no data: ${userId}`
        );
        const userDocRef = collectionRef.doc(userId);

        try {
          const subcollections = await userDocRef.listCollections();

          if (subcollections.length > 0) {
            const document = {
              id: userId,
              path: userDocRef.path,
              data: {}, // Empty document
              subcollections: {},
            };

            for (const subcollection of subcollections) {
              const subcollectionPath = [...path, userId, subcollection.id];
              const subcollectionData = await backupCollection(
                subcollection,
                subcollectionPath
              );
              document.subcollections[subcollection.id] = subcollectionData;
            }

            documents.push(document);
            processedDocIds.add(userId);
          }
        } catch (error) {
          console.warn(
            `    Warning: Could not access user document ${userId}: ${error.message}`
          );
        }
      }
    }
  }

  return documents;
}

// Main backup function
async function backupFirebase() {
  console.log("Starting Firebase backup...");
  console.log("This script is READ-ONLY and will not modify any data.\n");

  const db = getDb();
  const backupData = {
    timestamp: new Date().toISOString(),
    collections: {},
  };

  try {
    // Get all top-level collections
    const collections = await db.listCollections();

    console.log(`Found ${collections.length} top-level collection(s):\n`);

    for (const collectionRef of collections) {
      const collectionName = collectionRef.id;
      console.log(`Backing up collection: ${collectionName}`);

      const collectionData = await backupCollection(collectionRef, [
        collectionName,
      ]);
      backupData.collections[collectionName] = collectionData;

      console.log(
        `  ✓ Completed: ${collectionName} (${collectionData.length} documents)\n`
      );
    }

    // Create backup directory
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);

    // Extract env name (e.g., ".env.development" -> "development", ".env.local" -> "local")
    const envName = envFile.replace(/^\.env\.?/, "") || "local";

    const backupDir = join(
      __dirname,
      "../backups",
      `firebase-backup-${envName}-${timestamp}`
    );
    await mkdir(backupDir, { recursive: true });

    // Save backup to JSON file
    const backupFilePath = join(backupDir, "backup.json");
    await writeFile(
      backupFilePath,
      JSON.stringify(backupData, null, 2),
      "utf-8"
    );

    // Create a summary file
    const summary = {
      timestamp: backupData.timestamp,
      backupPath: backupFilePath,
      collections: Object.keys(backupData.collections).map((name) => ({
        name,
        documentCount: backupData.collections[name].length,
      })),
      totalDocuments: Object.values(backupData.collections).reduce(
        (sum, docs) => sum + docs.length,
        0
      ),
    };

    const summaryPath = join(backupDir, "summary.json");
    await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

    console.log("✓ Backup completed successfully!");
    console.log(`\nBackup location: ${backupDir}`);
    console.log(`Total documents backed up: ${summary.totalDocuments}`);
    console.log(`\nFiles created:`);
    console.log(`  - ${backupFilePath}`);
    console.log(`  - ${summaryPath}`);

    return backupDir;
  } catch (error) {
    console.error("✗ Backup failed:", error);
    throw error;
  }
}

// Run the backup
backupFirebase()
  .then(() => {
    console.log("\n✓ Backup script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Backup script failed:", error);
    process.exit(1);
  });
