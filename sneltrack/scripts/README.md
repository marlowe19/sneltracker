# Firebase Backup Script

## Overview

The `backup-firebase.js` script creates a complete, read-only backup of all data in your Firebase Firestore database. This script:

- ✅ **READ-ONLY**: Only reads data, never writes or deletes
- ✅ **Complete**: Backs up all collections and subcollections recursively
- ✅ **Safe**: Uses only `.get()` operations, no mutations
- ✅ **Structured**: Saves data in JSON format with proper timestamp handling

## Usage

### Prerequisites

1. Ensure your Firebase credentials are configured in your environment variables:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (base64-encoded JSON), OR
   - `FIREBASE_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`

2. Make sure you're in the project root directory.

### Running the Backup

```bash
node scripts/backup-firebase.js
```

Or if you prefer using npm:

```bash
npm run backup:firebase
```

(You'll need to add this script to `package.json` - see below)

## Output

The backup will be saved to:
```
backups/firebase-backup-YYYY-MM-DD-HH-MM-SS/
```

Each backup directory contains:
- `backup.json` - Complete backup of all data
- `summary.json` - Summary with document counts and metadata

## Data Structure

The backup preserves:
- All document IDs and paths
- All document data
- All subcollections (nested collections)
- Firestore Timestamps (converted to ISO strings with metadata)
- Date objects (converted to ISO strings)

## Safety Guarantees

This script is designed to be completely safe:
- Uses only read operations (`.get()`, `.listCollections()`)
- No write operations (`.set()`, `.update()`, `.add()`)
- No delete operations (`.delete()`)
- No batch operations that modify data

## Adding to package.json

To make it easier to run, add this to your `package.json` scripts section:

```json
{
  "scripts": {
    "backup:firebase": "node scripts/backup-firebase.js"
  }
}
```

## Example Output

```
Starting Firebase backup...
This script is READ-ONLY and will not modify any data.

Found 3 top-level collection(s):

Backing up collection: users
  Reading collection: users (5 documents)
  Reading collection: users/user1/time-entries (10 documents)
  Reading collection: users/user1/projects (3 documents)
  ✓ Completed: users (5 documents)

Backing up collection: projects
  Reading collection: projects (2 documents)
  Reading collection: projects/proj1/time-entries (15 documents)
  Reading collection: projects/proj1/members (4 documents)
  ✓ Completed: projects (2 documents)

Backing up collection: expenses
  Reading collection: expenses (20 documents)
  ✓ Completed: expenses (20 documents)

✓ Backup completed successfully!

Backup location: backups/firebase-backup-2024-01-15T10-30-45
Total documents backed up: 59

Files created:
  - backups/firebase-backup-2024-01-15T10-30-45/backup.json
  - backups/firebase-backup-2024-01-15T10-30-45/summary.json
```

