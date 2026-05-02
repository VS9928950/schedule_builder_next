import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createProjectBuild, deleteProjectBuild, getProject, setActiveProjectBuild } from "@/lib/store";
import { parseScheduleAllFromExcelRows } from "@/lib/schedule";
import { rowsFromProjectExcelJson } from "@/lib/excel";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(new URL("/app", req.url), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(new URL("/app", req.url), 303);

  const form = await req.formData();
  const action = String(form.get("action") || "");

  if (action === "create") {
    const version = String(form.get("version") || "").trim();
    const rows = rowsFromProjectExcelJson(project.excel_json);
    const parsed = parseScheduleAllFromExcelRows(rows);
    const events = [
      ...parsed.untimed.map((e) => ({ ...e, kind: "untimed", day: e.day.toISOString() })),
      ...parsed.timed.map((e) => ({ ...e, kind: "timed", start: e.start.toISOString(), end: e.end.toISOString() }))
    ];
    createProjectBuild(
      projectId,
      user.id,
      version || "",
      user.email ?? null,
      project.active_upload_id ?? null,
      events
    );
    return NextResponse.redirect(new URL(`/app/p/${projectId}/events`, req.url), 303);
  }

  if (action === "setActive") {
    const buildId = Number(form.get("buildId"));
    if (Number.isFinite(buildId)) setActiveProjectBuild(projectId, user.id, buildId);
    return NextResponse.redirect(new URL(`/app/p/${projectId}/events`, req.url), 303);
  }

  if (action === "delete") {
    const buildId = Number(form.get("buildId"));
    if (Number.isFinite(buildId)) deleteProjectBuild(projectId, user.id, buildId);
    return NextResponse.redirect(new URL(`/app/p/${projectId}/events`, req.url), 303);
  }

  return NextResponse.redirect(new URL(`/app/p/${projectId}/events`, req.url), 303);
}

