import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { collectSortedProgramDayKeysFromIso, parseScheduleAllFromExcelRows } from "@/lib/schedule";
import { redirect } from "next/navigation";
import { TildaSnippetClient } from "./TildaSnippetClient";

export default async function ExportTildaTab({ params }: { params: Promise<{ id: string }> }) {
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
  const eventsIsoForExport =
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
  const programDayKeys =
    eventsIsoForExport.length > 0 ? collectSortedProgramDayKeysFromIso(eventsIsoForExport as any[]) : [];
  const hiddenDayKeys = new Set(
    (Array.isArray((activeBuild as any)?.timeline_layout?.hidden_day_keys)
      ? ((activeBuild as any).timeline_layout.hidden_day_keys as unknown[])
      : []
    )
      .map((k) => String(k).slice(0, 10))
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  );
  const visibleDayKeys = programDayKeys.filter((k) => !hiddenDayKeys.has(k));

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Экспорт: Tilda</h2>
        <a className="chip" href={`/app/p/${project.id}/export`}>
          ← Назад
        </a>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Генерируется из <b>активного build</b> и его <code>timeline_layout</code>, чтобы совпадало с Архитектурой.
      </div>
      <div style={{ height: 12 }} />
      <TildaSnippetClient projectId={project.id} visibleDayKeys={visibleDayKeys} />
    </div>
  );
}

