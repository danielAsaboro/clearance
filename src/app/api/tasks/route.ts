import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/tasks — Get current user's tasks (for creators) or all tasks (for admins)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  const statusParam = req.nextUrl.searchParams.get("status");

  if (user.role === "admin") {
    const where: Record<string, unknown> = {};
    if (weekParam) where.weekNumber = parseInt(weekParam);
    if (statusParam) where.status = statusParam;

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        creatorId: true,
        weekNumber: true,
        taskNumber: true,
        description: true,
        tiktokUrl: true,
        status: true,
        deadline: true,
        submittedAt: true,
        createdAt: true,
        rejectionNote: true,
        creator: { select: { displayName: true, tiktokUsername: true } },
      },
      orderBy: [{ weekNumber: "desc" }, { taskNumber: "asc" }],
    });
    return NextResponse.json(tasks);
  }

  // Creator: get their own tasks
  const tasks = await prisma.task.findMany({
    where: {
      creatorId: user.id,
      ...(weekParam ? { weekNumber: parseInt(weekParam) } : {}),
    },
    orderBy: [{ weekNumber: "desc" }, { taskNumber: "asc" }],
  });

  return NextResponse.json(tasks);
}

// POST /api/tasks — Admin creates a task
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { creatorId, weekNumber, taskNumber, description, deadline } = body;

  const task = await prisma.task.create({
    data: {
      creatorId,
      weekNumber,
      taskNumber,
      description,
      deadline: new Date(deadline),
    },
  });

  return NextResponse.json(task, { status: 201 });
}
