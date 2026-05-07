import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";

type LayoutShape = {
  hidden_day_keys?: string[];
  event_overrides?: Record<string, Record<string, { hidden?: boolean }>>;
};

type ReportStats = {
  totalEvents: number;
  withBroadcast: number;
  withVks: number;
  withSimultaneousInterpretation: number;
  roomsCount: number;
};

function eventDayKey(e: any): string {
  if (e.kind === "untimed" && e.day) return String(e.day).slice(0, 10);
  if (e.start) return String(e.start).slice(0, 10);
  return "";
}

function isVisibleInScope(e: any, layout: LayoutShape | null | undefined): boolean {
  if (!(e.visible ?? true)) return false;
  const dayKey = eventDayKey(e);
  const hiddenDays = new Set((layout?.hidden_day_keys ?? []).map((k) => String(k).slice(0, 10)));
  if (dayKey && hiddenDays.has(dayKey)) return false;

  const eventId = String(e.id ?? "");
  if (dayKey && eventId) {
    const evHidden = !!layout?.event_overrides?.[dayKey]?.[eventId]?.hidden;
    if (evHidden) return false;
  }

  return true;
}

function calcStats(events: any[], layout: LayoutShape | null | undefined): ReportStats {
  const scoped = events.filter((e) => isVisibleInScope(e, layout));

  const roomKeys = new Set<string>();
  for (const e of scoped) {
    const building = String(e.building ?? "").trim();
    const room = String(e.room ?? "").trim();
    if (!room) continue;
    roomKeys.add(`${building}::${room}`);
  }

  return {
    totalEvents: scoped.length,
    withBroadcast: scoped.filter((e) => e.translation === "Да").length,
    withVks: scoped.filter((e) => e.vks === "Да").length,
    withSimultaneousInterpretation: scoped.filter((e) => e.simultaneousInterpretation === "Да").length,
    roomsCount: roomKeys.size
  };
}

export default async function ReportTab({ params }: { params: Promise<{ id: string }> }) {
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

  const events = getProjectEventsIso(project)
    .sort((a, b) => {
      const da = String((a.kind === "untimed" ? a.day : a.start) ?? "").localeCompare(
        String((b.kind === "untimed" ? b.day : b.start) ?? "")
      );
      if (da !== 0) return da;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });

  const architectureLayout = ((activeBuild as any)?.timeline_layout ?? null) as LayoutShape | null;
  const technicalLayout = ((activeBuild as any)?.tech_timeline_layout ?? null) as LayoutShape | null;

  const architectureStats = calcStats(events as any[], architectureLayout);
  const technicalStats = calcStats(events as any[], technicalLayout);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Отчет</h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          Статистика рассчитывается отдельно для «Архитектуры» и «Техрасписания» с учетом сокрытия в активной сборке
          (скрытые дни и скрытые события).
        </div>
        {activeBuild ? (
          <div className="muted" style={{ marginBottom: 12, fontSize: 12 }}>
            Источник: версия сборки <b>v{(activeBuild as any).seq ?? activeBuild.id}</b>
            {activeBuild.version ? ` · ${activeBuild.version}` : ""}
          </div>
        ) : null}

        <div className="grid2">
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Архитектура</div>
            <div className="grid" style={{ gap: 8 }}>
              <div className="chip">Общее количество мероприятий: {architectureStats.totalEvents}</div>
              <div className="chip">Количество мероприятий с трансляциями: {architectureStats.withBroadcast}</div>
              <div className="chip">Количество мероприятий с ВКС: {architectureStats.withVks}</div>
              <div className="chip">
                Количество мероприятий с синхронным переводом: {architectureStats.withSimultaneousInterpretation}
              </div>
              <div className="chip">Общее количество задействованных аудиторий: {architectureStats.roomsCount}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Техрасписание</div>
            <div className="grid" style={{ gap: 8 }}>
              <div className="chip">Общее количество мероприятий: {technicalStats.totalEvents}</div>
              <div className="chip">Количество мероприятий с трансляциями: {technicalStats.withBroadcast}</div>
              <div className="chip">Количество мероприятий с ВКС: {technicalStats.withVks}</div>
              <div className="chip">
                Количество мероприятий с синхронным переводом: {technicalStats.withSimultaneousInterpretation}
              </div>
              <div className="chip">Общее количество задействованных аудиторий: {technicalStats.roomsCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
