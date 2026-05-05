import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { parseScheduleAllFromExcelRows, collectSortedProgramDayKeysFromIso } from "@/lib/schedule";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { PrintWorkspaceClient } from "./PrintWorkspaceClient";

export default async function ExportPrintTab({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const builds = project.builds ?? [];
  const activeBuildId = project.active_build_id ?? null;
  const activeBuild = activeBuildId ? builds.find((b) => b.id === activeBuildId) ?? null : null;

  const rows = rowsFromProjectExcelJson(project.excel_json);
  const sp = searchParams ? await searchParams : undefined;
  const view = String(sp?.view ?? "").trim();
  const isTechView = view === "tech-schedule";

  const eventsIso =
    activeBuild && Array.isArray(activeBuild.events_json)
      ? (activeBuild.events_json as any[]).map((e) => ({
          ...e,
          day: typeof e.day === "string" ? e.day : e.day != null ? new Date(e.day).toISOString() : undefined,
          start: typeof e.start === "string" ? e.start : e.start != null ? new Date(e.start).toISOString() : undefined,
          end: typeof e.end === "string" ? e.end : e.end != null ? new Date(e.end).toISOString() : undefined
        }))
      : (() => {
          const parsed = parseScheduleAllFromExcelRows(rows);
          return [
            ...parsed.untimed.map((e) => ({ ...e, kind: "untimed", day: e.day.toISOString() })),
            ...parsed.timed.map((e) => ({ ...e, kind: "timed", start: e.start.toISOString(), end: e.end.toISOString() }))
          ];
        })();

  const programDayKeys = collectSortedProgramDayKeysFromIso(eventsIso as any[]);

  return (
    <div className="card print-export-page-host" style={{ padding: 12 }}>
      {eventsIso.length ? (
        <Suspense fallback={<div className="muted">Загрузка…</div>}>
          <PrintWorkspaceClient
            projectId={project.id}
            activeBuildId={activeBuild ? activeBuild.id : null}
            events={eventsIso as any[]}
            marks={isTechView ? (activeBuild as any)?.tech_timeline_marks ?? null : (activeBuild as any)?.timeline_marks ?? null}
            style={isTechView ? (activeBuild as any)?.tech_timeline_style ?? null : (activeBuild as any)?.timeline_style ?? null}
            layout={isTechView ? (activeBuild as any)?.tech_timeline_layout ?? null : (activeBuild as any)?.timeline_layout ?? null}
            programDayKeys={programDayKeys}
          />
        </Suspense>
      ) : (
        <div className="muted">Нет событий для печати — выберите активный документ и версию сборки.</div>
      )}
    </div>
  );
}
