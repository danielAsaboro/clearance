import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { assignTasksSchema } from "@/lib/validators";

// POST /api/admin/tasks/assign — Bulk assign tasks to creators
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = assignTasksSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { creatorIds, weekNumber, descriptions, deadline } = parsed.data;

  const tasks = [];
  for (const creatorId of creatorIds) {
    for (let i = 0; i < 3; i++) {
      tasks.push({
        creatorId,
        weekNumber,
        taskNumber: i + 1,
        description: descriptions[i],
        deadline: new Date(deadline),
      });
    }
  }

  const result = await prisma.task.createMany({ data: tasks });

  return NextResponse.json(
    { created: result.count },
    { status: 201 }
  );
}
