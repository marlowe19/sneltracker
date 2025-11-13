#!/usr/bin/env node

/**
 * Firebase Database Backup Script
 * 
 * This script creates a complete backup of all Firestore data.
 * It is READ-ONLY and will NOT modify or delete any data.
 * 
 * Usage:
 *   node scripts/backup-firebase.js
 * 
 * The backup will be saved to: backups/firebase-backup-YYYY-MM-DD-HH-MM-SS/
 */

import { getDb } from "../lib/firebaseAdmin.js";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  
  console.log(`  Reading collection: ${path.join("/")} (${snapshot.size} documents)`);
  
  for (const doc of snapshot.docs) {
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
    
    documents.push(document);
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
      
      const collectionData = await backupCollection(collectionRef, [collectionName]);
      backupData.collections[collectionName] = collectionData;
      
      console.log(`  ✓ Completed: ${collectionName} (${collectionData.length} documents)\n`);
    }
    
    // Create backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const backupDir = join(__dirname, "..", "backups", `firebase-backup-${timestamp}`);
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
    await writeFile(
      summaryPath,
      JSON.stringify(summary, null, 2),
      "utf-8"
    );
    
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

