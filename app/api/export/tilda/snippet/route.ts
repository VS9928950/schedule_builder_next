import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { buildTildaSnippet } from "@/lib/export-tilda";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("unauthorized", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) {
    return new NextResponse("bad_project", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const project = getProject(projectId, user.id);
  if (!project) return new NextResponse("not_found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const builds = project.builds ?? [];
  const activeBuildId = project.active_build_id ?? null;
  const activeBuild = activeBuildId ? builds.find((b) => b.id === activeBuildId) ?? null : null;
  if (!activeBuild) {
    return new NextResponse("no_active_build", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const events = Array.isArray(activeBuild.events_json) ? (activeBuild.events_json as any[]) : [];
  const marksByDay = ((activeBuild as any).timeline_marks ?? {}) as Record<string, string[]>;
  const timelineLayout = ((activeBuild as any).timeline_layout ?? null) as any;
  const timelineStyle = ((activeBuild as any).timeline_style ?? null) as any;

  const scope = url.searchParams.get("scope");
  const day = url.searchParams.get("day");
  const font = url.searchParams.get("font");
  const fontMode = font === "tildaSans" || font === "tilda-sans" ? "tilda-sans" : "inherit";

  const { html, css } = buildTildaSnippet({
    projectName: project.name,
    events,
    marksByDay,
    timelineLayout,
    timelineStyle,
    scopeSelector: scope,
    onlyDayKey: day,
    fontMode
  });

  const snippet = `<style>\n${css}\n</style>\n\n${html}`;
  return new NextResponse(snippet, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
