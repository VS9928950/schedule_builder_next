import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { buildIllustratorPdf } from "@/lib/export-illustrator-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return new NextResponse("bad_project", { status: 400 });

  const project = getProject(projectId, user.id);
  if (!project) return new NextResponse("not_found", { status: 404 });

  const builds = project.builds ?? [];
  const activeBuildId = project.active_build_id ?? null;
  const activeBuild = activeBuildId ? builds.find((b) => b.id === activeBuildId) ?? null : null;
  if (!activeBuild) return new NextResponse("no_active_build", { status: 400 });

  const events = Array.isArray(activeBuild.events_json) ? (activeBuild.events_json as any[]) : [];
  const u = new URL(req.url);
  const day = u.searchParams.get("day");
  const bytes = await buildIllustratorPdf({
    events,
    timelineLayout: ((activeBuild as any).timeline_layout ?? null) as any,
    onlyDayKey: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    view: "timeline"
  });
  const name = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `program-${day}.pdf` : "program.pdf";
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store"
    }
  });
}
