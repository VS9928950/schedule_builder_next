import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { getProject, updateProjectBuildTimelineMarks } from "@/lib/store";

const Schema = z.object({
  buildId: z.number().int().positive(),
  marks: z.record(z.string(), z.array(z.string()))
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.json({ error: "bad_project" }, { status: 400 });

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_payload" }, { status: 400 });

  updateProjectBuildTimelineMarks(projectId, user.id, parsed.data.buildId, parsed.data.marks);
  return NextResponse.json({ ok: true });
}

