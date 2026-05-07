import { rowsFromProjectExcelJson } from "@/lib/excel";
import { parseScheduleAllFromExcelRows } from "@/lib/schedule";

export type ProjectEventIso = {
  id?: string;
  title?: string;
  description?: string;
  description_md?: string;
  kind?: "timed" | "untimed";
  day?: string;
  start?: string;
  end?: string;
  format?: string;
  building?: string;
  room?: string;
  responsible1?: string;
  responsible2?: string;
  responsible3?: string;
  responsible4?: string;
  responsible5?: string;
  responsible6?: string;
  teamLead?: string;
  volunteersCount?: number;
  vks?: "Да" | "Нет" | "Не указано";
  photosFromResponsible?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  supportMaterials?: string;
  banner?: "Общий" | "Секционный" | "Не указано";
  visible?: boolean;
};

export function getProjectEventsIso(project: any): ProjectEventIso[] {
  const builds = project.builds ?? [];
  const activeBuildId = project.active_build_id ?? null;
  const activeBuild = activeBuildId ? builds.find((b: any) => b.id === activeBuildId) ?? null : null;

  if (activeBuild && Array.isArray(activeBuild.events_json)) {
    return (activeBuild.events_json as any[]).map((e) => ({
      ...e,
      day: typeof e.day === "string" ? e.day : e.day != null ? new Date(e.day).toISOString() : undefined,
      start: typeof e.start === "string" ? e.start : e.start != null ? new Date(e.start).toISOString() : undefined,
      end: typeof e.end === "string" ? e.end : e.end != null ? new Date(e.end).toISOString() : undefined
    }));
  }

  const rows = rowsFromProjectExcelJson(project.excel_json);
  const parsed = parseScheduleAllFromExcelRows(rows);
  return [
    ...parsed.untimed.map((e) => ({ ...e, kind: "untimed" as const, day: e.day.toISOString() })),
    ...parsed.timed.map((e) => ({ ...e, kind: "timed" as const, start: e.start.toISOString(), end: e.end.toISOString() }))
  ];
}

export function eventDayKey(e: ProjectEventIso): string {
  if (e.kind === "untimed" && e.day) return String(e.day).slice(0, 10);
  if (e.start) return String(e.start).slice(0, 10);
  return "Без даты";
}
