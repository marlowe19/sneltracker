import { NextResponse } from "next/server";
import {
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectStatistics,
} from "@/lib/dbFirestore";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { user } = await context.params;
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const stats = url.searchParams.get("stats") === "true";

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

    // Validate required fields
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

    const newProject = await createProject(user, name, hourlyRate, isDefault);
    return NextResponse.json({ project: newProject }, { status: 201 });
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

    if (!body.id) {
      return NextResponse.json(
        { error: "project id is required" },
        { status: 400 }
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
    if (body.is_default !== undefined) {
      updates.is_default = body.is_default === true;
    }

    const updatedProject = await updateProject(user, body.id, updates);
    return NextResponse.json({ project: updatedProject });
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

    if (!projectId) {
      return NextResponse.json(
        { error: "project id is required" },
        { status: 400 }
      );
    }

    await deleteProject(user, projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project", message: error.message },
      { status: 500 }
    );
  }
}
