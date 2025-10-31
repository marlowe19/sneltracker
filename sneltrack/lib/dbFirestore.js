import { getDb } from "./firebaseAdmin";

const COLLECTION = "time_entries";

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
    hourly_rate: data.hourly_rate ?? null,
    project: data.project ?? null,
  };
}

export async function getActiveEntry(userName) {
  const db = getDb();
  const ref = db.collection(COLLECTION);
  const snap = await ref
    .where("user_name", "==", userName)
    .where("end_time", "==", null)
    .orderBy("start_time", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToEntry(snap.docs[0]);
}

export async function startEntry(userName, hourlyRate = null, project = null) {
  console.log("startEntry--------------------", userName);
  const db = getDb();
  const existing = await getActiveEntry(userName);
  console.log("existing--------------------", existing);
  if (existing) return existing;
  const ref = db.collection(COLLECTION);
  const now = new Date();
  const entryData = {
    user_name: userName,
    start_time: now,
    end_time: null,
  };
  if (hourlyRate !== null) {
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

export async function stopEntry(userName) {
  const db = getDb();
  const active = await getActiveEntry(userName);
  if (!active) return null;
  const docRef = db.collection(COLLECTION).doc(active.id);
  const end = new Date();
  await docRef.update({ end_time: end });
  const updated = await docRef.get();
  return docToEntry(updated);
}

export async function getWeekEntries(userName, weekStartIso, weekEndIso) {
  const db = getDb();
  const ref = db.collection(COLLECTION);
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekEndIso);

  const [q1Snap, q2Snap] = await Promise.all([
    ref
      .where("user_name", "==", userName)
      .where("start_time", "<", weekEnd)
      .get(),
    ref
      .where("user_name", "==", userName)
      .where("end_time", ">=", weekStart)
      .get(),
  ]);

  const byId = new Map();
  for (const d of q1Snap.docs) byId.set(d.id, d);
  for (const d of q2Snap.docs) byId.set(d.id, d);
  const merged = Array.from(byId.values()).map(docToEntry);

  merged.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return merged;
}
