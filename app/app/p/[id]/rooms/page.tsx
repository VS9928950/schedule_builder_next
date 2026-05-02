import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { parseScheduleAllFromExcelRows } from "@/lib/schedule";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { RoomsScheduleViewer } from "./RoomsScheduleViewer";

export default async function RoomsTab({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Расписание по аудиториям</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Переключайте аудитории (с учётом корпуса). Период: один день из ближайшей четырёхдневки или «Все дни» — вся найденная занятость по календарю.
      </div>
      {activeBuild ? (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Источник: версия сборки <b>v{(activeBuild as any).seq ?? activeBuild.id}</b>
          {activeBuild.version ? ` · ${activeBuild.version}` : ""} · автор: {(activeBuild as any).created_by_email ?? "—"}
        </div>
      ) : null}

      {eventsIso.length ? (
        <RoomsScheduleViewer events={eventsIso} />
      ) : (
        <div className="muted">Событий нет — сначала загрузите Excel и/или выберите активную версию сборки.</div>
      )}
    </div>
  );
}

