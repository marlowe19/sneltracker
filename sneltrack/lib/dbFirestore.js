import { getDb } from "./firebaseAdmin";
import {
  computeEntryDurationMs,
  computeEntryDurationMsClipped,
} from "./time";

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
  // Check user entries first
  const userRef = getUserTimeEntriesCollection(userName);
  const userSnap = await userRef
    .where("end_time", "==", null)
    .orderBy("start_time", "desc")
    .limit(1)
    .get();
  if (!userSnap.empty) {
    return docToEntry(userSnap.docs[0]);
  }
  
  // Check shared project entries
  const sharedProjects = await getAllSharedProjects(userName);
  for (const project of sharedProjects) {
    const activeEntry = await getProjectActiveEntry(project.id, userName);
    if (activeEntry) {
      return activeEntry;
    }
  }
  
  return null;
}

export async function startEntry(userName, hourlyRate = null, project = null) {
  console.log("startEntry--------------------", userName);
  const existing = await getActiveEntry(userName);
  console.log("existing--------------------", existing);
  if (existing) return existing;
  
  const now = new Date();
  
  // Determine hourly rate: check member rate first, then project rate, then provided rate
  let finalHourlyRate = hourlyRate;
  let projectDoc = null;
  if (project) {
    projectDoc = await getProjectById(userName, project);
    
    // Check if project is shared and get member rate
    if (projectDoc && projectDoc.is_shared) {
      const memberRate = await getMemberHourlyRate(project, userName);
      if (memberRate !== null && memberRate !== undefined) {
        finalHourlyRate = memberRate;
      } else if (projectDoc.hourly_rate) {
        finalHourlyRate = projectDoc.hourly_rate;
      }
    } else if (projectDoc && projectDoc.hourly_rate) {
      finalHourlyRate = projectDoc.hourly_rate;
    }
  }
  
  // Check if project is shared
  const isShared = projectDoc ? projectDoc.is_shared : false;
  
  if (isShared && project) {
    // Verify user is a member of the shared project
    const isMember = await isProjectMember(userName, project);
    if (!isMember) {
      throw new Error("User is not a member of this shared project");
    }
    // Store in shared project time entries
    return await createProjectTimeEntry(
      project,
      userName,
      now,
      null,
      null,
      finalHourlyRate
    );
  } else {
    // Store in user time entries (existing behavior)
    const ref = getUserTimeEntriesCollection(userName);
    const entryData = {
      user_name: userName,
      start_time: now,
      end_time: null,
      created_at: now,
    };

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
}

export async function stopEntry(userName) {
  const active = await getActiveEntry(userName);
  if (!active) return null;
  
  // Check if entry is from a shared project
  if (active.project) {
    const projectDoc = await getProjectById(userName, active.project);
    if (projectDoc && projectDoc.is_shared) {
      // Update in shared project time entries
      const end = new Date();
      return await updateProjectTimeEntry(active.project, active.id, { end_time: end });
    }
  }
  
  // Update in user time entries (existing behavior)
  const ref = getUserTimeEntriesCollection(userName);
  const docRef = ref.doc(active.id);
  const end = new Date();
  await docRef.update({ end_time: end });
  const updated = await docRef.get();
  return docToEntry(updated);
}

export async function getWeekEntries(userName, weekStartIso, weekEndIso) {
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekEndIso);
  
  // Get user entries
  const userRef = getUserTimeEntriesCollection(userName);
  const [q1Snap, q2Snap] = await Promise.all([
    userRef.where("start_time", "<", weekEnd).get(),
    userRef.where("end_time", ">=", weekStart).get(),
  ]);

  const byId = new Map();
  for (const d of q1Snap.docs) byId.set(d.id, d);
  for (const d of q2Snap.docs) byId.set(d.id, d);
  const userEntries = Array.from(byId.values()).map(docToEntry);
  
  // Get shared project entries
  const sharedProjects = await getAllSharedProjects(userName);
  const sharedEntries = [];
  
  for (const project of sharedProjects) {
    const projectEntries = await getProjectTimeEntries(project.id, userName);
    // Filter entries by week bounds
    const weekEntries = projectEntries.filter((entry) => {
      const entryStart = new Date(entry.start_time);
      const entryEnd = entry.end_time ? new Date(entry.end_time) : null;
      
      // Must start before week ends
      if (entryStart >= weekEnd) return false;
      
      // Must end on or after week starts (or be active/null)
      if (entryEnd !== null && entryEnd < weekStart) return false;
      
      return true;
    });
    sharedEntries.push(...weekEntries);
  }
  
  // Merge all entries
  const allEntries = [...userEntries, ...sharedEntries];
  
  // Filter to ensure entries actually overlap the week
  const filtered = allEntries.filter((entry) => {
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
  const now = new Date();

  // Set start_time to the start of the selected day
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);

  // If duration is provided, calculate end_time
  let endTime = null;
  if (durationMs !== null && durationMs !== undefined) {
    endTime = new Date(dayStart.getTime() + durationMs);
  }
  
  // Determine hourly rate: check member rate first, then project rate, then provided rate
  let finalHourlyRate = hourlyRate;
  let projectDoc = null;
  if (project) {
    projectDoc = await getProjectById(userName, project);
    
    // Check if project is shared and get member rate
    if (projectDoc && projectDoc.is_shared) {
      const memberRate = await getMemberHourlyRate(project, userName);
      if (memberRate !== null && memberRate !== undefined) {
        finalHourlyRate = memberRate;
      } else if (projectDoc.hourly_rate) {
        finalHourlyRate = projectDoc.hourly_rate;
      }
    } else if (projectDoc && projectDoc.hourly_rate) {
      finalHourlyRate = projectDoc.hourly_rate;
    }
  }
  const isShared = projectDoc ? projectDoc.is_shared : false;
  
  if (isShared && project) {
    // Verify user is a member of the shared project
    const isMember = await isProjectMember(userName, project);
    if (!isMember) {
      throw new Error("User is not a member of this shared project");
    }
    // Store in shared project time entries
    return await createProjectTimeEntry(
      project,
      userName,
      dayStart,
      endTime,
      durationMs,
      finalHourlyRate
    );
  } else {
    // Store in user time entries (existing behavior)
    const ref = getUserTimeEntriesCollection(userName);
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

    if (finalHourlyRate !== null && finalHourlyRate !== undefined) {
      entryData.hourly_rate =
        typeof finalHourlyRate === "string" ? parseFloat(finalHourlyRate) : finalHourlyRate;
    }

    if (project !== null && project !== undefined) {
      entryData.project = project;
    }

    const docRef = await ref.add(entryData);
    const doc = await docRef.get();
    return docToEntry(doc);
  }
}

export async function updateEntry(userName, entryId, updates) {
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
  
  // Check if entry exists in user entries first
  const userRef = getUserTimeEntriesCollection(userName);
  const userDoc = await userRef.doc(entryId).get();
  
  if (userDoc.exists) {
    const userEntryData = userDoc.data();
    const oldProject = userEntryData.project;
    const newProject = updates.project !== undefined ? (updates.project === "" ? null : updates.project) : oldProject;
    
    // Check if project is changing to/from a shared project
    const oldProjectDoc = oldProject ? await getProjectById(userName, oldProject) : null;
    const newProjectDoc = newProject ? await getProjectById(userName, newProject) : null;
    
    const wasShared = oldProjectDoc && oldProjectDoc.is_shared;
    const willBeShared = newProjectDoc && newProjectDoc.is_shared;
    
    // If moving from user entry to shared project entry, migrate it
    if (!wasShared && willBeShared && newProject) {
      // Verify user is a member of the shared project
      const isMember = await isProjectMember(userName, newProject);
      if (!isMember) {
        throw new Error("User is not a member of this shared project");
      }
      
      // Get member hourly rate if available
      let finalHourlyRate = updates.hourly_rate !== undefined ? updateData.hourly_rate : userEntryData.hourly_rate;
      if (finalHourlyRate === null || finalHourlyRate === undefined) {
        const memberRate = await getMemberHourlyRate(newProject, userName);
        if (memberRate !== null && memberRate !== undefined) {
          finalHourlyRate = memberRate;
        } else if (newProjectDoc.hourly_rate) {
          finalHourlyRate = newProjectDoc.hourly_rate;
        }
      }
      
      // Create entry in shared project collection
      const newEntry = await createProjectTimeEntry(
        newProject,
        userName,
        updateData.start_time !== undefined ? updateData.start_time : (userEntryData.start_time instanceof Date ? userEntryData.start_time : new Date(userEntryData.start_time)),
        updateData.end_time !== undefined ? updateData.end_time : (userEntryData.end_time ? (userEntryData.end_time instanceof Date ? userEntryData.end_time : new Date(userEntryData.end_time)) : null),
        updateData.duration_ms !== undefined ? updateData.duration_ms : userEntryData.duration_ms,
        finalHourlyRate
      );
      
      // Delete old entry from user collection
      await userRef.doc(entryId).delete();
      
      return newEntry;
    }
    
    // If project is being removed or changed to non-shared, or if staying in user entries, just update
    await userRef.doc(entryId).update(updateData);
    const updated = await userRef.doc(entryId).get();
    return docToEntry(updated);
  }
  
  // Entry not in user collection, check shared projects
  // First, find which shared project this entry currently belongs to
  const sharedProjects = await getAllSharedProjects(userName);
  let currentSharedProject = null;
  let currentEntryDoc = null;
  
  for (const project of sharedProjects) {
    const entriesRef = getSharedProjectTimeEntriesCollection(project.id);
    const entryDoc = await entriesRef.doc(entryId).get();
    if (entryDoc.exists) {
      currentSharedProject = project;
      currentEntryDoc = entryDoc;
      break;
    }
  }
  
  if (currentEntryDoc && currentSharedProject) {
    const entryData = currentEntryDoc.data();
    const oldProject = entryData.project;
    const newProject = updates.project !== undefined ? (updates.project === "" ? null : updates.project) : oldProject;
    
    // If project is being removed or changed to non-shared project, migrate back to user entries
    if (newProject === null || newProject === "") {
      const userRef = getUserTimeEntriesCollection(userName);
      const newUserEntry = {
        user_name: userName,
        start_time: updateData.start_time !== undefined ? updateData.start_time : (entryData.start_time instanceof Date ? entryData.start_time : new Date(entryData.start_time)),
        end_time: updateData.end_time !== undefined ? updateData.end_time : (entryData.end_time ? (entryData.end_time instanceof Date ? entryData.end_time : new Date(entryData.end_time)) : null),
        duration_ms: updateData.duration_ms !== undefined ? updateData.duration_ms : entryData.duration_ms,
        hourly_rate: updateData.hourly_rate !== undefined ? updateData.hourly_rate : entryData.hourly_rate,
        created_at: entryData.created_at,
        modified_at: updateData.modified_at,
      };
      await userRef.doc(entryId).set(newUserEntry);
      await getSharedProjectTimeEntriesCollection(currentSharedProject.id).doc(entryId).delete();
      return docToEntry(await userRef.doc(entryId).get());
    }
    
    // If project is being changed to a different shared project
    if (newProject !== oldProject && newProject) {
      const newProjectDoc = await getProjectById(userName, newProject);
      if (newProjectDoc && newProjectDoc.is_shared) {
        // Verify user is a member of the new shared project
        const isMember = await isProjectMember(userName, newProject);
        if (!isMember) {
          throw new Error("User is not a member of this shared project");
        }
        
        // Get member rate for new project
        let finalHourlyRate = updateData.hourly_rate;
        if (finalHourlyRate === null || finalHourlyRate === undefined) {
          const memberRate = await getMemberHourlyRate(newProject, userName);
          if (memberRate !== null && memberRate !== undefined) {
            finalHourlyRate = memberRate;
          } else if (newProjectDoc.hourly_rate) {
            finalHourlyRate = newProjectDoc.hourly_rate;
          } else {
            finalHourlyRate = entryData.hourly_rate;
          }
        }
        
        // Create entry in new shared project
        const newEntry = await createProjectTimeEntry(
          newProject,
          userName,
          updateData.start_time !== undefined ? updateData.start_time : (entryData.start_time instanceof Date ? entryData.start_time : new Date(entryData.start_time)),
          updateData.end_time !== undefined ? updateData.end_time : (entryData.end_time ? (entryData.end_time instanceof Date ? entryData.end_time : new Date(entryData.end_time)) : null),
          updateData.duration_ms !== undefined ? updateData.duration_ms : entryData.duration_ms,
          finalHourlyRate
        );
        
        // Delete from old shared project
        await getSharedProjectTimeEntriesCollection(currentSharedProject.id).doc(entryId).delete();
        return newEntry;
      }
    }
    
    // Same shared project, just update
    return await updateProjectTimeEntry(currentSharedProject.id, entryId, updateData);
  }
  
  throw new Error(`Entry ${entryId} not found`);
}

// Projects functions

function getUserProjectsCollection(userName) {
  const db = getDb();
  return db.collection("users").doc(userName).collection("projects");
}

// Shared projects functions

function getSharedProjectsCollection() {
  const db = getDb();
  return db.collection("projects");
}

function getSharedProjectTimeEntriesCollection(projectId) {
  const db = getDb();
  return db.collection("projects").doc(projectId).collection("time-entries");
}

function getSharedProjectMembersCollection(projectId) {
  const db = getDb();
  return db.collection("projects").doc(projectId).collection("members");
}

function docToSharedProject(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    hourly_rate: data.hourly_rate ?? null,
    budget_hours: data.budget_hours ?? null,
    owner: data.owner,
    is_shared: true,
    created_at: toIso(data.created_at),
    modified_at: toIso(data.modified_at),
  };
}

export async function isSharedProject(projectId) {
  if (!projectId) return false;
  const ref = getSharedProjectsCollection();
  const doc = await ref.doc(projectId).get();
  return doc.exists;
}

export async function getProjectById(userName, projectId) {
  if (!projectId) return null;
  // Check shared projects first
  const sharedRef = getSharedProjectsCollection();
  const sharedDoc = await sharedRef.doc(projectId).get();
  if (sharedDoc.exists) {
    return docToSharedProject(sharedDoc);
  }
  // Fall back to user projects
  const userRef = getUserProjectsCollection(userName);
  const userDoc = await userRef.doc(projectId).get();
  if (!userDoc.exists) return null;
  return docToProject(userDoc);
}

export async function getAllSharedProjects(userName) {
  const projectsRef = getSharedProjectsCollection();
  // Query all projects where user is a member
  // We need to query the members subcollection of each project
  // This is expensive, so we'll use a different approach:
  // Get all projects and filter by membership
  const allProjectsSnap = await projectsRef.get();
  const sharedProjects = [];
  
  for (const projectDoc of allProjectsSnap.docs) {
    const membersRef = getSharedProjectMembersCollection(projectDoc.id);
    const memberDoc = await membersRef.doc(userName).get();
    if (memberDoc.exists) {
      sharedProjects.push(docToSharedProject(projectDoc));
    }
  }
  
  return sharedProjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createSharedProject(
  userName,
  name,
  hourlyRate = null,
  budgetHours = null
) {
  const ref = getSharedProjectsCollection();
  const now = new Date();
  
  const projectData = {
    name,
    hourly_rate:
      hourlyRate !== null && hourlyRate !== undefined
        ? typeof hourlyRate === "string"
          ? parseFloat(hourlyRate)
          : hourlyRate
        : null,
    budget_hours:
      budgetHours !== null && budgetHours !== undefined
        ? typeof budgetHours === "string"
          ? parseFloat(budgetHours)
          : budgetHours
        : null,
    owner: userName,
    created_at: now,
    modified_at: now,
  };
  
  const docRef = await ref.add(projectData);
  const projectId = docRef.id;
  
  // Add owner as first member with role "owner"
  await addMemberToProject(projectId, userName, "owner");
  
  const doc = await docRef.get();
  return docToSharedProject(doc);
}

export async function updateSharedProject(projectId, updates) {
  const ref = getSharedProjectsCollection();
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
  if (updates.budget_hours !== undefined) {
    updateData.budget_hours =
      updates.budget_hours === null || updates.budget_hours === ""
        ? null
        : typeof updates.budget_hours === "string"
        ? parseFloat(updates.budget_hours)
        : updates.budget_hours;
  }
  
  // Always update modified_at timestamp
  updateData.modified_at = new Date();
  
  await docRef.update(updateData);
  const updated = await docRef.get();
  return docToSharedProject(updated);
}

export async function deleteSharedProject(projectId) {
  const ref = getSharedProjectsCollection();
  await ref.doc(projectId).delete();
}

export async function addMemberToProject(projectId, userName, role = "member", hourlyRate = null) {
  const membersRef = getSharedProjectMembersCollection(projectId);
  const now = new Date();
  const memberData = {
    user_name: userName,
    role: role,
    added_at: now,
  };
  
  if (hourlyRate !== null && hourlyRate !== undefined) {
    memberData.hourly_rate =
      typeof hourlyRate === "string"
        ? parseFloat(hourlyRate)
        : hourlyRate;
  }
  
  await membersRef.doc(userName).set(memberData);
}

export async function removeMemberFromProject(projectId, userName) {
  const membersRef = getSharedProjectMembersCollection(projectId);
  await membersRef.doc(userName).delete();
}

export async function getProjectMembers(projectId) {
  const membersRef = getSharedProjectMembersCollection(projectId);
  const snap = await membersRef.get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      user_name: data.user_name,
      role: data.role,
      hourly_rate: data.hourly_rate ?? null,
      added_at: toIso(data.added_at),
    };
  });
}

export async function isProjectOwner(userName, projectId) {
  if (!projectId) return false;
  const project = await getProjectById(userName, projectId);
  if (!project || !project.is_shared) return false;
  return project.owner === userName;
}

export async function isProjectMember(userName, projectId) {
  if (!projectId) return false;
  const membersRef = getSharedProjectMembersCollection(projectId);
  const memberDoc = await membersRef.doc(userName).get();
  return memberDoc.exists;
}

export async function getMemberHourlyRate(projectId, userName) {
  if (!projectId || !userName) return null;
  const membersRef = getSharedProjectMembersCollection(projectId);
  const memberDoc = await membersRef.doc(userName).get();
  if (!memberDoc.exists) return null;
  const data = memberDoc.data();
  return data.hourly_rate ?? null;
}

export async function updateMemberHourlyRate(projectId, userName, hourlyRate) {
  if (!projectId || !userName) {
    throw new Error("projectId and userName are required");
  }
  const membersRef = getSharedProjectMembersCollection(projectId);
  const memberDoc = await membersRef.doc(userName).get();
  if (!memberDoc.exists) {
    throw new Error("Member not found in project");
  }
  
  const updateData = {
    hourly_rate:
      hourlyRate === null || hourlyRate === "" || hourlyRate === undefined
        ? null
        : typeof hourlyRate === "string"
        ? parseFloat(hourlyRate)
        : hourlyRate,
  };
  
  await membersRef.doc(userName).update(updateData);
}

// Project time entries functions

export async function createProjectTimeEntry(
  projectId,
  userName,
  startTime,
  endTime = null,
  durationMs = null,
  hourlyRate = null
) {
  const ref = getSharedProjectTimeEntriesCollection(projectId);
  const now = new Date();
  
  const entryData = {
    user_name: userName,
    project: projectId,
    start_time: startTime instanceof Date ? startTime : new Date(startTime),
    end_time: endTime === null ? null : endTime instanceof Date ? endTime : new Date(endTime),
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
  
  const docRef = await ref.add(entryData);
  const doc = await docRef.get();
  return docToEntry(doc);
}

export async function getProjectTimeEntries(projectId, userName = null) {
  const ref = getSharedProjectTimeEntriesCollection(projectId);
  let query = ref;
  
  if (userName) {
    query = query.where("user_name", "==", userName);
  }
  
  const snap = await query.orderBy("start_time", "desc").get();
  return snap.docs.map(docToEntry);
}

export async function getProjectActiveEntry(projectId, userName) {
  const ref = getSharedProjectTimeEntriesCollection(projectId);
  const snap = await ref
    .where("user_name", "==", userName)
    .where("end_time", "==", null)
    .orderBy("start_time", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToEntry(snap.docs[0]);
}

export async function updateProjectTimeEntry(projectId, entryId, updates) {
  const ref = getSharedProjectTimeEntriesCollection(projectId);
  const docRef = ref.doc(entryId);
  
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
  
  // Always update modified_at timestamp
  updateData.modified_at = new Date();
  
  await docRef.update(updateData);
  const updated = await docRef.get();
  return docToEntry(updated);
}

function docToProject(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    hourly_rate: data.hourly_rate ?? null,
    budget_hours: data.budget_hours ?? null,
    is_default: data.is_default ?? false,
    is_shared: false,
    created_at: toIso(data.created_at),
    modified_at: toIso(data.modified_at),
  };
}

export async function getAllProjects(userName) {
  const userProjects = await getUserProjectsCollection(userName)
    .orderBy("created_at", "desc")
    .get();
  const userProjectsList = userProjects.docs.map(docToProject);
  
  const sharedProjects = await getAllSharedProjects(userName);
  
  return [...userProjectsList, ...sharedProjects];
}

export async function getProject(userName, projectId) {
  // Use getProjectById which checks shared first, then user projects
  const project = await getProjectById(userName, projectId);
  // If it's a shared project, return it; otherwise ensure it's not shared
  if (project && !project.is_shared) {
    return project;
  }
  return project;
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
  isDefault = false,
  budgetHours = null
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
    budget_hours:
      budgetHours !== null && budgetHours !== undefined
        ? typeof budgetHours === "string"
          ? parseFloat(budgetHours)
          : budgetHours
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
  if (updates.budget_hours !== undefined) {
    updateData.budget_hours =
      updates.budget_hours === null || updates.budget_hours === ""
        ? null
        : typeof updates.budget_hours === "string"
        ? parseFloat(updates.budget_hours)
        : updates.budget_hours;
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

export async function getProjectStatistics(
  userName,
  projectId,
  dateRange = null
) {
  // Get project to find entries by project ID
  const project = await getProject(userName, projectId);
  if (!project) {
    return { totalHours: 0, totalMoney: 0, entryCount: 0 };
  }

  let entries = [];

  if (project.is_shared) {
    // For shared projects, query from project time entries
    const isOwner = await isProjectOwner(userName, projectId);
    if (isOwner) {
      // Owner sees all entries
      entries = await getProjectTimeEntries(projectId);
    } else {
      // Member sees only their entries
      entries = await getProjectTimeEntries(projectId, userName);
    }
  } else {
    // For user projects, query from user time entries
    const ref = getUserTimeEntriesCollection(userName);
    const snap = await ref.where("project", "==", projectId).get();
    entries = snap.docs.map(docToEntry);
  }

  // Filter entries by date range if provided
  if (dateRange && dateRange.start && dateRange.end) {
    const rangeStart = dateRange.start instanceof Date
      ? dateRange.start
      : new Date(dateRange.start);
    const rangeEnd = dateRange.end instanceof Date
      ? dateRange.end
      : new Date(dateRange.end);
    
    entries = entries.filter((entry) => {
      const entryStart = new Date(entry.start_time);
      const entryEnd = entry.end_time ? new Date(entry.end_time) : null;

      // Entry must start before range ends AND
      // Entry must end after range starts (or be active/null)
      return entryStart < rangeEnd && (entryEnd === null || entryEnd >= rangeStart);
    });
  }

  let totalDurationMs = 0;
  let totalMoney = 0;
  let entryCount = 0;

  for (const entry of entries) {
    // If date range is provided, clip duration to the range
    let durationMs;
    if (dateRange && dateRange.start && dateRange.end) {
      const rangeStart = dateRange.start instanceof Date
        ? dateRange.start
        : new Date(dateRange.start);
      const rangeEnd = dateRange.end instanceof Date
        ? dateRange.end
        : new Date(dateRange.end);
      durationMs = computeEntryDurationMsClipped(
        entry.start_time,
        entry.end_time,
        rangeStart,
        rangeEnd,
        entry.duration_ms
      );
    } else {
      durationMs = computeEntryDurationMs(
        entry.start_time,
        entry.end_time,
        entry.duration_ms
      );
    }

    if (durationMs > 0) {
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
  }

  const totalHours = totalDurationMs / (1000 * 60 * 60);
  const budgetHours = project.budget_hours ?? null;
  const budgetPercentage =
    budgetHours !== null && budgetHours > 0
      ? (totalHours / budgetHours) * 100
      : null;
  const budgetPrice =
    budgetHours !== null && budgetHours > 0 && project.hourly_rate
      ? budgetHours * project.hourly_rate
      : null;
  const isOverBudget =
    budgetPercentage !== null && budgetPercentage > 100 ? true : false;

  // Calculate profitability metrics based on hours efficiency
  // For contractors: using fewer hours than budgeted = more profitable
  const hoursSaved = budgetHours !== null && budgetHours > 0
    ? budgetHours - totalHours
    : null;
  const hoursSavedPercentage = budgetHours !== null && budgetHours > 0
    ? (hoursSaved / budgetHours) * 100
    : null;
  const moneySaved = hoursSaved !== null && hoursSaved > 0 && project.hourly_rate
    ? hoursSaved * project.hourly_rate
    : null;
  
  // Profitability status: under budget = good, over budget = bad
  const profitabilityStatus =
    budgetPercentage !== null
      ? budgetPercentage < 80
        ? "profitable" // Under 80% of budget - very profitable
        : budgetPercentage <= 100
        ? "at_risk" // 80-100% of budget - at risk
        : "underperforming" // Over 100% - over budget
      : null;

  return {
    totalHours,
    totalMoney,
    entryCount,
    budgetHours,
    budgetPercentage,
    budgetPrice,
    isOverBudget,
    hoursSaved, // New field
    hoursSavedPercentage, // New field
    moneySaved, // New field
    profitabilityStatus,
    // Keep old fields for backward compatibility if needed
    revenueVariance: moneySaved !== null ? moneySaved : null,
    profitabilityRatio: hoursSavedPercentage !== null ? 100 - budgetPercentage : null,
  };
}

export async function getProjectStatisticsByMember(projectId, dateRange = null) {
  // Get all entries for the project
  const entries = await getProjectTimeEntries(projectId);
  const project = await getSharedProjectsCollection().doc(projectId).get();
  if (!project.exists) {
    return [];
  }
  const projectData = project.data();
  
  // Filter entries by date range if provided
  let filteredEntries = entries;
  if (dateRange && dateRange.start && dateRange.end) {
    const rangeStart = dateRange.start instanceof Date
      ? dateRange.start
      : new Date(dateRange.start);
    const rangeEnd = dateRange.end instanceof Date
      ? dateRange.end
      : new Date(dateRange.end);
    
    filteredEntries = entries.filter((entry) => {
      const entryStart = new Date(entry.start_time);
      const entryEnd = entry.end_time ? new Date(entry.end_time) : null;

      // Entry must start before range ends AND
      // Entry must end after range starts (or be active/null)
      return entryStart < rangeEnd && (entryEnd === null || entryEnd >= rangeStart);
    });
  }
  
  // Group entries by user_name
  const byMember = new Map();
  
  for (const entry of filteredEntries) {
    const userName = entry.user_name;
    if (!byMember.has(userName)) {
      byMember.set(userName, {
        user_name: userName,
        totalDurationMs: 0,
        entryCount: 0,
      });
    }
    
    const member = byMember.get(userName);
    // If date range is provided, clip duration to the range
    let durationMs;
    if (dateRange && dateRange.start && dateRange.end) {
      const rangeStart = dateRange.start instanceof Date
        ? dateRange.start
        : new Date(dateRange.start);
      const rangeEnd = dateRange.end instanceof Date
        ? dateRange.end
        : new Date(dateRange.end);
      durationMs = computeEntryDurationMsClipped(
        entry.start_time,
        entry.end_time,
        rangeStart,
        rangeEnd,
        entry.duration_ms
      );
    } else {
      durationMs = computeEntryDurationMs(
        entry.start_time,
        entry.end_time,
        entry.duration_ms
      );
    }
    
    if (durationMs > 0) {
      member.totalDurationMs += durationMs;
      member.entryCount++;
    }
  }
  
  // Convert to array with hours and money
  const result = Array.from(byMember.values()).map((member) => {
    const totalHours = member.totalDurationMs / (1000 * 60 * 60);
    const rate = projectData.hourly_rate ?? null;
    const totalMoney = rate ? totalHours * rate : 0;
    
    return {
      user_name: member.user_name,
      totalHours,
      totalMoney,
      entryCount: member.entryCount,
    };
  });
  
  return result.sort((a, b) => b.totalHours - a.totalHours);
}

export async function convertToSharedProject(userName, projectId) {
  // Get the user project
  const userProject = await getUserProjectsCollection(userName).doc(projectId).get();
  if (!userProject.exists) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const projectData = userProject.data();
  
  // Create shared project
  const sharedProject = await createSharedProject(
    userName,
    projectData.name,
    projectData.hourly_rate ?? null,
    projectData.budget_hours ?? null
  );
  
  // Get all time entries for this project from user collection
  const userEntriesRef = getUserTimeEntriesCollection(userName);
  const entriesSnap = await userEntriesRef.where("project", "==", projectId).get();
  
  // Migrate entries to shared project
  const batch = getDb().batch();
  for (const entryDoc of entriesSnap.docs) {
    const entryData = entryDoc.data();
    const newEntryRef = getSharedProjectTimeEntriesCollection(sharedProject.id).doc();
    batch.set(newEntryRef, {
      user_name: entryData.user_name,
      project: sharedProject.id,
      start_time: entryData.start_time,
      end_time: entryData.end_time,
      duration_ms: entryData.duration_ms ?? null,
      hourly_rate: entryData.hourly_rate ?? null,
      created_at: entryData.created_at,
      modified_at: entryData.modified_at,
    });
    // Delete old entry
    batch.delete(entryDoc.ref);
  }
  
  await batch.commit();
  
  // Delete user project
  await getUserProjectsCollection(userName).doc(projectId).delete();
  
  return sharedProject;
}
