import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { collectSortedProgramDayKeysFromIso, parseScheduleAllFromExcelRows } from "@/lib/schedule";
import { redirect } from "next/navigation";
import { TildaSnippetClient } from "./TildaSnippetClient";

function normalizeResponsible(v: unknown): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (s === "-" || s === "—") return "";
  return s;
}

function applyExportViewFilter(events: any[], view: string): any[] {
  if (view === "vks") return events.filter((e) => (e.visible ?? true) && e.vks === "Да");
  if (view === "broadcasts") return events.filter((e) => (e.visible ?? true) && e.translation === "Да");
  if (view === "interpretation") return events.filter((e) => (e.visible ?? true) && e.simultaneousInterpretation === "Да");
  if (view === "volunteers") {
    return events.filter((e) => (e.visible ?? true) && typeof e.volunteersCount === "number" && Number.isFinite(e.volunteersCount) && e.volunteersCount > 0);
  }
  if (view === "responsibles") {
    return events.filter(
      (e) =>
        (e.visible ?? true) &&
        [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
          .map((x) => normalizeResponsible(x))
          .filter(Boolean).length > 0
    );
  }
  if (view === "rooms") {
    return events.filter((e) => (e.visible ?? true) && String(e.room ?? "").trim() !== "");
  }
  return events.filter((e) => e.visible ?? true);
}

export default async function ExportTildaTab({
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
  const sp = searchParams ? await searchParams : undefined;
  const view = String(sp?.view ?? "").trim();
  const isTechView = view === "tech-schedule";
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
  const filteredForView = applyExportViewFilter(eventsIsoForExport as any[], view);
  const programDayKeys =
    filteredForView.length > 0 ? collectSortedProgramDayKeysFromIso(filteredForView as any[]) : [];
  const hiddenDayKeysRaw = isTechView
    ? (activeBuild as any)?.tech_timeline_layout?.hidden_day_keys
    : (activeBuild as any)?.timeline_layout?.hidden_day_keys;
  const hiddenDayKeys = new Set(
    (Array.isArray(hiddenDayKeysRaw) ? (hiddenDayKeysRaw as unknown[]) : []
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
        Генерируется из <b>активного build</b> и раскладки области экспорта:{" "}
        <b>
          {isTechView ? "Техрасписание" : view === "rooms"
            ? "Аудитории"
            : view === "responsibles"
              ? "Ответственные"
              : view === "vks"
                ? "ВКС"
                : view === "broadcasts"
                  ? "Трансляции"
                  : view === "interpretation"
                    ? "Перевод"
                    : view === "volunteers"
                      ? "Волонтеры"
                      : "Архитектура"}
        </b>.
      </div>
      <div style={{ height: 12 }} />
      <TildaSnippetClient projectId={project.id} visibleDayKeys={visibleDayKeys} view={view} />
    </div>
  );
}

