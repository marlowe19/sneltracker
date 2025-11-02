import { getDb } from "./firebaseAdmin";
import { computeEntryDurationMs } from "./time";

function toIso(ts) {
  if (!ts) return null;
  // Firestore Timestamp in Admin SDK has toDate()
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  // In case a Date sneaks in
  if (ts instanceof Date) return ts.toISOString();
  // If string already
  if (typeof ts === "string") return ts;
  return null;
}

function docToEntry(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    user_name: data.user_name,
    start_time: toIso(data.start_time),
    end_time: toIso(data.end_time),
    duration_ms: data.duration_ms ?? null,
    hourly_rate: data.hourly_rate ?? null,
    project: data.project ?? null,
    created_at: toIso(data.created_at),
    modified_at: toIso(data.modified_at),
  };
}

function getUserTimeEntriesCollection(userName) {
  const db = getDb();
  return db.collection("users").doc(userName).collection("time-entries");
}

export async function getActiveEntry(userName) {
  const ref = getUserTimeEntriesCollection(userName);
  const snap = await ref
    .where("end_time", "==", null)
    .orderBy("start_time", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToEntry(snap.docs[0]);
}

export async function startEntry(userName, hourlyRate = null, project = null) {
  console.log("startEntry--------------------", userName);
  const existing = await getActiveEntry(userName);
  console.log("existing--------------------", existing);
  if (existing) return existing;
  const ref = getUserTimeEntriesCollection(userName);
  const now = new Date();
  const entryData = {
    user_name: userName,
    start_time: now,
    end_time: null,
    created_at: now,
  };

  // If project is provided but no hourly rate, try to get rate from project
  let finalHourlyRate = hourlyRate;
  if ((finalHourlyRate === null || finalHourlyRate === undefined) && project) {
    const projectDoc = await getProject(userName, project);
    if (projectDoc && projectDoc.hourly_rate) {
      finalHourlyRate = projectDoc.hourly_rate;
    }
  }

  if (finalHourlyRate !== null && finalHourlyRate !== undefined) {
    entryData.hourly_rate =
      typeof finalHourlyRate === "string"
        ? parseFloat(finalHourlyRate)
        : finalHourlyRate;
  }
  if (project !== null && project !== undefined) {
    entryData.project = project;
  }
  const docRef = await ref.add(entryData);
  const doc = await docRef.get();
  return docToEntry(doc);
}

export async function stopEntry(userName) {
  const active = await getActiveEntry(userName);
  if (!active) return null;
  const ref = getUserTimeEntriesCollection(userName);
  const docRef = ref.doc(active.id);
  const end = new Date();
  await docRef.update({ end_time: end });
  const updated = await docRef.get();
  return docToEntry(updated);
}

export async function getWeekEntries(userName, weekStartIso, weekEndIso) {
  const ref = getUserTimeEntriesCollection(userName);
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekEndIso);

  // Since all entries in the subcollection belong to the user,
  // we can use a simpler query approach. We fetch entries that might overlap:
  // start_time < weekEnd OR (end_time >= weekStart OR end_time is null)
  // Firestore doesn't support complex OR queries, so we fetch entries that might overlap
  // and filter in memory to ensure proper overlap: start_time < weekEnd AND (end_time >= weekStart OR end_time is null)
  const [q1Snap, q2Snap] = await Promise.all([
    ref.where("start_time", "<", weekEnd).get(),
    ref.where("end_time", ">=", weekStart).get(),
  ]);

  const byId = new Map();
  for (const d of q1Snap.docs) byId.set(d.id, d);
  for (const d of q2Snap.docs) byId.set(d.id, d);
  const merged = Array.from(byId.values()).map(docToEntry);

  // Filter to ensure entries actually overlap the week
  // Entry overlaps if: start_time < weekEnd AND (end_time >= weekStart OR end_time is null)
  const filtered = merged.filter((entry) => {
    const entryStart = new Date(entry.start_time);
    const entryEnd = entry.end_time ? new Date(entry.end_time) : null;

    // Must start before week ends
    if (entryStart >= weekEnd) return false;

    // Must end on or after week starts (or be active/null)
    if (entryEnd !== null && entryEnd < weekStart) return false;

    return true;
  });

  filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return filtered;
}

export async function createEntry(
  userName,
  dayDate,
  durationMs = null,
  hourlyRate = null,
  project = null
) {
  const ref = getUserTimeEntriesCollection(userName);
  const now = new Date();

  // Set start_time to the start of the selected day
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);

  // If duration is provided, calculate end_time
  let endTime = null;
  if (durationMs !== null && durationMs !== undefined) {
    endTime = new Date(dayStart.getTime() + durationMs);
  }

  const entryData = {
    user_name: userName,
    start_time: dayStart,
    end_time: endTime,
    created_at: now,
    modified_at: now,
  };

  if (durationMs !== null && durationMs !== undefined) {
    entryData.duration_ms =
      typeof durationMs === "string" ? parseInt(durationMs, 10) : durationMs;
  }

  if (hourlyRate !== null && hourlyRate !== undefined) {
    entryData.hourly_rate =
      typeof hourlyRate === "string" ? parseFloat(hourlyRate) : hourlyRate;
  }

  if (project !== null && project !== undefined) {
    entryData.project = project;
  }

  const docRef = await ref.add(entryData);
  const doc = await docRef.get();
  return docToEntry(doc);
}

export async function updateEntry(userName, entryId, updates) {
  const ref = getUserTimeEntriesCollection(userName);
  const docRef = ref.doc(entryId);

  // Build update object with only provided fields
  const updateData = {};
  if (updates.start_time !== undefined) {
    updateData.start_time =
      updates.start_time instanceof Date
        ? updates.start_time
        : new Date(updates.start_time);
  }
  if (updates.end_time !== undefined) {
    updateData.end_time =
      updates.end_time === null
        ? null
        : updates.end_time instanceof Date
        ? updates.end_time
        : new Date(updates.end_time);
  }
  if (updates.duration_ms !== undefined) {
    updateData.duration_ms =
      updates.duration_ms === null || updates.duration_ms === ""
        ? null
        : typeof updates.duration_ms === "string"
        ? parseInt(updates.duration_ms, 10)
        : updates.duration_ms;
  }
  if (updates.hourly_rate !== undefined) {
    updateData.hourly_rate =
      updates.hourly_rate === null || updates.hourly_rate === ""
        ? null
        : typeof updates.hourly_rate === "string"
        ? parseFloat(updates.hourly_rate)
        : updates.hourly_rate;
  }
  if (updates.project !== undefined) {
    updateData.project = updates.project === "" ? null : updates.project;
  }

  // Always update modified_at timestamp
  updateData.modified_at = new Date();

  await docRef.update(updateData);
  const updated = await docRef.get();
  return docToEntry(updated);
}

// Projects functions

function getUserProjectsCollection(userName) {
  const db = getDb();
  return db.collection("users").doc(userName).collection("projects");
}

function docToProject(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    hourly_rate: data.hourly_rate ?? null,
    is_default: data.is_default ?? false,
    created_at: toIso(data.created_at),
    modified_at: toIso(data.modified_at),
  };
}

export async function getAllProjects(userName) {
  const ref = getUserProjectsCollection(userName);
  const snap = await ref.orderBy("created_at", "desc").get();
  return snap.docs.map(docToProject);
}

export async function getProject(userName, projectId) {
  const ref = getUserProjectsCollection(userName);
  const doc = await ref.doc(projectId).get();
  if (!doc.exists) return null;
  return docToProject(doc);
}

export async function getDefaultProject(userName) {
  const ref = getUserProjectsCollection(userName);
  const snap = await ref.where("is_default", "==", true).limit(1).get();
  if (snap.empty) return null;
  return docToProject(snap.docs[0]);
}

export async function createProject(
  userName,
  name,
  hourlyRate = null,
  isDefault = false
) {
  const ref = getUserProjectsCollection(userName);
  const now = new Date();

  // If setting as default, clear any existing default project
  if (isDefault) {
    const existingDefault = await getDefaultProject(userName);
    if (existingDefault) {
      await ref.doc(existingDefault.id).update({ is_default: false });
    }
  }

  const projectData = {
    name,
    hourly_rate:
      hourlyRate !== null && hourlyRate !== undefined
        ? typeof hourlyRate === "string"
          ? parseFloat(hourlyRate)
          : hourlyRate
        : null,
    is_default: isDefault,
    created_at: now,
    modified_at: now,
  };

  const docRef = await ref.add(projectData);
  const doc = await docRef.get();
  return docToProject(doc);
}

export async function updateProject(userName, projectId, updates) {
  const ref = getUserProjectsCollection(userName);
  const docRef = ref.doc(projectId);

  const updateData = {};
  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.hourly_rate !== undefined) {
    updateData.hourly_rate =
      updates.hourly_rate === null || updates.hourly_rate === ""
        ? null
        : typeof updates.hourly_rate === "string"
        ? parseFloat(updates.hourly_rate)
        : updates.hourly_rate;
  }
  if (updates.is_default !== undefined) {
    // If setting as default, clear any existing default project
    if (updates.is_default) {
      const existingDefault = await getDefaultProject(userName);
      if (existingDefault && existingDefault.id !== projectId) {
        await ref.doc(existingDefault.id).update({ is_default: false });
      }
    }
    updateData.is_default = updates.is_default;
  }

  // Always update modified_at timestamp
  updateData.modified_at = new Date();

  await docRef.update(updateData);
  const updated = await docRef.get();
  return docToProject(updated);
}

export async function deleteProject(userName, projectId) {
  const ref = getUserProjectsCollection(userName);
  await ref.doc(projectId).delete();
}

export async function getProjectStatistics(userName, projectId) {
  const ref = getUserTimeEntriesCollection(userName);
  // Get project to find entries by project ID
  const project = await getProject(userName, projectId);
  if (!project) {
    return { totalHours: 0, totalMoney: 0, entryCount: 0 };
  }

  // Query entries that have this project ID
  const snap = await ref.where("project", "==", projectId).get();

  let totalDurationMs = 0;
  let totalMoney = 0;
  let entryCount = 0;

  for (const doc of snap.docs) {
    const entry = docToEntry(doc);
    const durationMs = computeEntryDurationMs(
      entry.start_time,
      entry.end_time,
      entry.duration_ms
    );

    totalDurationMs += durationMs;
    entryCount++;

    // Calculate money for this entry
    // Use entry's hourly_rate if available, otherwise use project's hourly_rate
    const rate = entry.hourly_rate ?? project.hourly_rate;
    if (rate) {
      const hours = durationMs / (1000 * 60 * 60);
      totalMoney += hours * rate;
    }
  }

  return {
    totalHours: totalDurationMs / (1000 * 60 * 60),
    totalMoney,
    entryCount,
  };
}
