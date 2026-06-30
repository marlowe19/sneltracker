import { NextResponse } from "next/server";
import {
  convertToSharedProject,
} from "@/lib/dbFirestore";
import {
  getProjectDetail,
  getUserProjectsWithStats,
  addProjectMember,
  updateProjectMemberRate,
  deleteProject as deleteProjectSupabase,
  updateProjectMemberCapacity,
  updateProjectMemberRole,
  removeProjectMember,
  createProject as createProjectSupabase,
  updateProject as updateProjectSupabase,
  lookupUserByEmail,
} from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";
import { isProjectOwnerLevel } from "@/lib/projectPermissions";

export const dynamic = "force-dynamic";

function buildLegacyStatistics(projectDetail) {
  const totalHours = Number(projectDetail?.statistics?.totalHours || 0);
  const totalMoney = Number(projectDetail?.statistics?.totalMoney || 0);
  const entryCount = Number(projectDetail?.statistics?.entryCount || 0);
  const budgetHours =
    projectDetail?.budget_hours !== null &&
    projectDetail?.budget_hours !== undefined
      ? Number(projectDetail.budget_hours)
      : null;
  const projectHourlyRate =
    projectDetail?.hourly_rate !== null &&
    projectDetail?.hourly_rate !== undefined
      ? Number(projectDetail.hourly_rate)
      : null;

  const budgetPercentage =
    budgetHours !== null && budgetHours > 0 ? (totalHours / budgetHours) * 100 : null;
  const budgetPrice =
    budgetHours !== null &&
    budgetHours > 0 &&
    projectHourlyRate !== null &&
    projectHourlyRate > 0
      ? budgetHours * projectHourlyRate
      : null;
  const isOverBudget = budgetPercentage !== null && budgetPercentage > 100;
  const hoursSaved =
    budgetHours !== null && budgetHours > 0 ? budgetHours - totalHours : null;
  const hoursSavedPercentage =
    budgetHours !== null && budgetHours > 0
      ? (hoursSaved / budgetHours) * 100
      : null;
  const moneySaved =
    hoursSaved !== null &&
    hoursSaved > 0 &&
    projectHourlyRate !== null &&
    projectHourlyRate > 0
      ? hoursSaved * projectHourlyRate
      : null;
  const profitabilityStatus =
    budgetPercentage !== null
      ? budgetPercentage < 80
        ? "profitable"
        : budgetPercentage <= 100
          ? "at_risk"
          : "underperforming"
      : null;

  return {
    totalHours,
    totalMoney,
    entryCount,
    budgetHours,
    budgetPercentage,
    budgetPrice,
    isOverBudget,
    hoursSaved,
    hoursSavedPercentage,
    moneySaved,
    profitabilityStatus,
    // Keep old fields for backwards compatibility
    revenueVariance: moneySaved !== null ? moneySaved : null,
    profitabilityRatio:
      hoursSavedPercentage !== null && budgetPercentage !== null
        ? 100 - budgetPercentage
        : null,
  };
}

export const GET = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const stats = url.searchParams.get("stats") === "true";
    const statsByMember = url.searchParams.get("statsByMember") === "true";
    const action = url.searchParams.get("action");

    if (action === "members" && projectId) {
      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
      const members = projectDetail.members || [];
      return NextResponse.json({ members });
    }

    if (projectId && statsByMember) {
      // Return member statistics (owner only)
      // ✅ Use Supabase for ownership check
      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (!isProjectOwnerLevel(projectDetail, user)) {
        return NextResponse.json(
          { error: "Only project owners can view member statistics" },
          { status: 403 }
        );
      }
      const statistics = projectDetail.memberStatistics || [];
      return NextResponse.json({ statistics });
    }

    if (projectId && stats) {
      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
      const statistics = buildLegacyStatistics(projectDetail);
      return NextResponse.json({ statistics });
    }

    // Return all projects with statistics (migrated to Supabase)
    const projects = await getUserProjectsWithStats(user);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects", message: error.message },
      { status: 500 }
    );
  }
});

export const POST = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "addMember") {
      // Add member to shared project
      const { projectId, memberName, hourly_rate } = body;
      if (!projectId || !memberName) {
        return NextResponse.json(
          { error: "projectId and memberName are required" },
          { status: 400 }
        );
      }
      // ✅ NEW: Use Supabase for ownership check
      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
      // check if users exists in table based on the email and return the user by email

      const foundUser = await lookupUserByEmail(memberName.trim());
      if (!foundUser) {
        return NextResponse.json(
          { error: "Gebruiker niet gevonden" },
          { status: 404 }
        );
      }

      if (!isProjectOwnerLevel(projectDetail, user)) {
        return NextResponse.json(
          { error: "Only project owners can add members" },
          { status: 403 }
        );
      }

      // // Write to Firestore (existing data)
      // await addMemberToProject(
      //   projectId,
      //   memberName,
      //   "member",
      //   hourly_rate ?? null
      // );

      // ✅ NEW: Also write to Supabase
      // Use foundUser.user_name (auth0 id) instead of memberName (email)
      try {
        await addProjectMember(
          projectId,
          foundUser.user_name,
          "member",
          hourly_rate ?? null,
          body.capacity_per_week ?? null
        );
      } catch (error) {
        console.error("Failed to add member to Supabase:", error);
        // Continue anyway - Firestore is still written
      }

      return NextResponse.json({ success: true });
    }

    if (action === "convertToShared") {
      // Convert user project to shared project
      const { projectId } = body;
      if (!projectId) {
        return NextResponse.json(
          { error: "projectId is required" },
          { status: 400 }
        );
      }
      const sharedProject = await convertToSharedProject(user, projectId);
      return NextResponse.json({ project: sharedProject });
    }

    // Create new project (user or shared)
    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const name = body.name.trim();
    const hourlyRate = body.hourly_rate ?? null;
    const isDefault = body.is_default === true;
    const budgetHours = body.budget_hours ?? null;
    const isShared = body.is_shared === true;
    const dueDate = body.due_date || null;
    const startDate = body.start_date || null;

    // Create in Supabase only (Firestore migration completed)
    let newProject;
    try {
      newProject = await createProjectSupabase(user, {
        name,
        hourly_rate: hourlyRate,
        budget_hours: budgetHours,
        is_shared: isShared,
        is_default: isShared ? false : isDefault,
        due_date: dueDate,
        start_date: startDate,
      });
    } catch (error) {
      console.error("Failed to create project in Supabase:", error);
      return NextResponse.json(
        {
          error: "Failed to create project in Supabase",
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project", message: error.message },
      { status: 500 }
    );
  }
});

/**
 * Helper function to build project updates object from request body
 * @param {Object} body - Request body
 * @returns {Object} Updates object
 */
function buildProjectUpdates(body) {
  const updates = {};

  if (body.name !== undefined) {
    updates.name = typeof body.name === "string" ? body.name.trim() : body.name;
  }
  if (body.hourly_rate !== undefined) {
    updates.hourly_rate = body.hourly_rate;
  }
  if (body.budget_hours !== undefined) {
    updates.budget_hours = body.budget_hours;
  }
  if (body.budget_amount !== undefined) {
    updates.budget_amount = body.budget_amount;
  }
  if (body.capacity_per_week !== undefined) {
    updates.capacity_per_week = body.capacity_per_week;
  }
  if (body.priority !== undefined) {
    updates.priority = body.priority;
  }
  if (body.zip_code !== undefined) {
    updates.zip_code = body.zip_code;
  }
  if (body.due_date !== undefined) {
    updates.due_date = body.due_date || null;
  }
  if (body.start_date !== undefined) {
    updates.start_date = body.start_date || null;
  }
  if (body.end_date !== undefined) {
    updates.end_date = body.end_date || null;
  }
  if (body.actual_end_date !== undefined) {
    updates.actual_end_date = body.actual_end_date || null;
  }
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : body.description;
  }
  if (body.is_default !== undefined) {
    updates.is_default = body.is_default === true;
  }
  if (body.status !== undefined) {
    updates.status = body.status;
  }
  if (body.default_break_enabled !== undefined) {
    updates.default_break_enabled = body.default_break_enabled === true;
  }
  if (body.default_break_minutes !== undefined) {
    updates.default_break_minutes =
      body.default_break_minutes === null || body.default_break_minutes === ""
        ? null
        : parseInt(body.default_break_minutes, 10);
  }

  return updates;
}

export const PATCH = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Handle updateMemberRate action
    if (action === "updateMemberRate") {
      const { projectId, memberName, hourly_rate } = body;
      if (!projectId || !memberName) {
        return NextResponse.json(
          { error: "projectId and memberName are required" },
          { status: 400 }
        );
      }

      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (!isProjectOwnerLevel(projectDetail, user)) {
        return NextResponse.json(
          { error: "Only project owners can update member rates" },
          { status: 403 }
        );
      }

      try {
        await updateProjectMemberRate(
          projectId,
          memberName,
          hourly_rate ?? null
        );
      } catch (error) {
        console.error("Failed to update member rate in Supabase:", error);
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    // Handle updateMemberCapacity action
    if (action === "updateMemberCapacity") {
      const { projectId, memberName, capacity_per_week } = body;
      if (!projectId || !memberName) {
        return NextResponse.json(
          { error: "projectId and memberName are required" },
          { status: 400 }
        );
      }

      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (!isProjectOwnerLevel(projectDetail, user)) {
        return NextResponse.json(
          { error: "Only project owners can update member capacity" },
          { status: 403 }
        );
      }

      try {
        await updateProjectMemberCapacity(
          projectId,
          memberName,
          capacity_per_week ?? null
        );
      } catch (error) {
        console.error("Failed to update member capacity in Supabase:", error);
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    // Handle updateMemberRole action
    if (action === "updateMemberRole") {
      const { projectId, memberName, role } = body;
      if (!projectId || !memberName || !role) {
        return NextResponse.json(
          { error: "projectId, memberName, and role are required" },
          { status: 400 }
        );
      }

      // Validate role value
      if (role !== "owner" && role !== "member") {
        return NextResponse.json(
          { error: "Role must be either 'owner' or 'member'" },
          { status: 400 }
        );
      }

      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Check if user is project owner OR has "owner" role in project_members
      const canChangeRole =
        projectDetail.is_owner || projectDetail.member_role === "owner";

      if (!canChangeRole) {
        return NextResponse.json(
          {
            error:
              "Only project owners and members with owner role can change member roles",
          },
          { status: 403 }
        );
      }

      // Prevent project owner from changing their own role
      if (projectDetail.is_owner && memberName === user) {
        return NextResponse.json(
          { error: "Project owner cannot change their own role" },
          { status: 403 }
        );
      }

      // Check if member exists in project
      const member = projectDetail.members?.find(
        (m) => m.user_name === memberName
      );
      if (!member) {
        return NextResponse.json(
          { error: "Member not found in project" },
          { status: 404 }
        );
      }

      try {
        await updateProjectMemberRole(projectId, memberName, role);
      } catch (error) {
        console.error("Failed to update member role in Supabase:", error);
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    // Regular project update
    if (!body.id) {
      return NextResponse.json(
        { error: "project id is required" },
        { status: 400 }
      );
    }

    // Validate name if provided
    if (body.name !== undefined && (!body.name || body.name.trim() === "")) {
      return NextResponse.json(
        { error: "name must be a non-empty string" },
        { status: 400 }
      );
    }

    // Build updates object (updateProjectSupabase will handle permissions and is_default validation)
    const updates = buildProjectUpdates(body);

    // Update in Supabase (this function handles permission checks internally)
    const updatedProject = await updateProjectSupabase(user, body.id, updates);

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);

    // Handle specific errors from updateProjectSupabase
    if (error.message === "Project not found") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (
      error.message === "Alleen projecteigenaren kunnen gedeelde projecten bijwerken"
    ) {
      return NextResponse.json(
        { error: "Alleen projecteigenaren kunnen gedeelde projecten bijwerken" },
        { status: 403 }
      );
    }
    if (error.message === "Only user projects can update is_default") {
      return NextResponse.json(
        { error: "Only user projects can update is_default" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update project", message: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const projectId = url.searchParams.get("id");
    const action = url.searchParams.get("action");
    const memberName = url.searchParams.get("member");

    if (!projectId) {
      return NextResponse.json(
        { error: "project id is required" },
        { status: 400 }
      );
    }

    if (action === "removeMember") {
      // Remove member from shared project
      if (!memberName) {
        return NextResponse.json(
          { error: "member name is required" },
          { status: 400 }
        );
      }

      // ✅ Use Supabase for ownership check
      const projectDetail = await getProjectDetail(user, projectId);
      if (!projectDetail) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (!isProjectOwnerLevel(projectDetail, user)) {
        return NextResponse.json(
          { error: "Only project owners can remove members" },
          { status: 403 }
        );
      }

      // Don't allow removing the owner
      if (projectDetail.owner === memberName) {
        return NextResponse.json(
          { error: "Cannot remove project owner" },
          { status: 400 }
        );
      }

      // ✅ NEW: Also remove from Supabase
      try {
        await removeProjectMember(projectId, memberName);
      } catch (error) {
        console.error("Failed to remove member from Supabase:", error);
        // Continue anyway - Firestore is still updated
      }

      return NextResponse.json({ success: true });
    }

    // Delete project
    // ✅ Use Supabase to check project and ownership
    const projectDetail = await getProjectDetail(user, projectId);
    if (!projectDetail) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!projectDetail.is_owner) {
      return NextResponse.json(
        { error: "Only project owners can delete projects" },
        { status: 403 }
      );
    }

    await deleteProjectSupabase(user, projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project", message: error.message },
      { status: 500 }
    );
  }
});
