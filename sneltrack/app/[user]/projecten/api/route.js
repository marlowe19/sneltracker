import { NextResponse } from "next/server";
import {
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectStatistics,
  createSharedProject,
  updateSharedProject,
  deleteSharedProject,
  addMemberToProject,
  removeMemberFromProject,
  getProjectMembers,
  isProjectOwner,
  isProjectMember,
  getProjectStatisticsByMember,
  convertToSharedProject,
  getProjectById,
  updateMemberHourlyRate,
} from "@/lib/dbFirestore";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { user } = await context.params;
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const stats = url.searchParams.get("stats") === "true";
    const statsByMember = url.searchParams.get("statsByMember") === "true";
    const action = url.searchParams.get("action");

    if (action === "members" && projectId) {
      // Get project members
      const members = await getProjectMembers(projectId);
      return NextResponse.json({ members });
    }

    if (projectId && statsByMember) {
      // Return member statistics (owner only)
      const isOwner = await isProjectOwner(user, projectId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can view member statistics" },
          { status: 403 }
        );
      }
      const statistics = await getProjectStatisticsByMember(projectId);
      return NextResponse.json({ statistics });
    }

    if (projectId && stats) {
      // Return statistics for a specific project
      const statistics = await getProjectStatistics(user, projectId);
      return NextResponse.json({ statistics });
    }

    // Return all projects
    const projects = await getAllProjects(user);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req, context) {
  try {
    const { user } = await context.params;
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
      const isOwner = await isProjectOwner(user, projectId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can add members" },
          { status: 403 }
        );
      }
      await addMemberToProject(projectId, memberName, "member", hourly_rate ?? null);
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

    if (isShared) {
      const newProject = await createSharedProject(
        user,
        name,
        hourlyRate,
        budgetHours
      );
      return NextResponse.json({ project: newProject }, { status: 201 });
    } else {
      const newProject = await createProject(
        user,
        name,
        hourlyRate,
        isDefault,
        budgetHours
      );
      return NextResponse.json({ project: newProject }, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    const { user } = await context.params;
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
      const isOwner = await isProjectOwner(user, projectId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can update member rates" },
          { status: 403 }
        );
      }
      await updateMemberHourlyRate(projectId, memberName, hourly_rate ?? null);
      return NextResponse.json({ success: true });
    }

    if (!body.id) {
      return NextResponse.json(
        { error: "project id is required" },
        { status: 400 }
      );
    }

    // Check if project is shared
    const project = await getProjectById(user, body.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.is_shared) {
      // Check ownership before allowing updates
      const isOwner = await isProjectOwner(user, body.id);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can update shared projects" },
          { status: 403 }
        );
      }

      const updates = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
          return NextResponse.json(
            { error: "name must be a non-empty string" },
            { status: 400 }
          );
        }
        updates.name = body.name.trim();
      }
      if (body.hourly_rate !== undefined) {
        updates.hourly_rate = body.hourly_rate;
      }
      if (body.budget_hours !== undefined) {
        updates.budget_hours = body.budget_hours;
      }

      const updatedProject = await updateSharedProject(body.id, updates);
      return NextResponse.json({ project: updatedProject });
    } else {
      // User project update (existing behavior)
      const updates = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
          return NextResponse.json(
            { error: "name must be a non-empty string" },
            { status: 400 }
          );
        }
        updates.name = body.name.trim();
      }
      if (body.hourly_rate !== undefined) {
        updates.hourly_rate = body.hourly_rate;
      }
      if (body.budget_hours !== undefined) {
        updates.budget_hours = body.budget_hours;
      }
      if (body.is_default !== undefined) {
        updates.is_default = body.is_default === true;
      }

      const updatedProject = await updateProject(user, body.id, updates);
      return NextResponse.json({ project: updatedProject });
    }
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { user } = await context.params;
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
      const isOwner = await isProjectOwner(user, projectId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can remove members" },
          { status: 403 }
        );
      }
      // Don't allow removing the owner
      const project = await getProjectById(user, projectId);
      if (project && project.owner === memberName) {
        return NextResponse.json(
          { error: "Cannot remove project owner" },
          { status: 400 }
        );
      }
      await removeMemberFromProject(projectId, memberName);
      return NextResponse.json({ success: true });
    }

    // Delete project
    const project = await getProjectById(user, projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.is_shared) {
      // Check ownership before deleting shared project
      const isOwner = await isProjectOwner(user, projectId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only project owners can delete shared projects" },
          { status: 403 }
        );
      }
      await deleteSharedProject(projectId);
    } else {
      await deleteProject(user, projectId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project", message: error.message },
      { status: 500 }
    );
  }
}
