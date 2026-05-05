import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { eventDayKey, getProjectEventsIso } from "../event-data";

export default async function VolunteersTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const events = getProjectEventsIso(project)
    .filter((e) => (e.visible ?? true) && typeof e.volunteersCount === "number" && e.volunteersCount > 0)
    .sort((a, b) => (b.volunteersCount ?? 0) - (a.volunteersCount ?? 0));

  const total = events.reduce((sum, e) => sum + (e.volunteersCount ?? 0), 0);

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Волонтеры</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Сводка по количеству волонтеров для мероприятий с заполненным полем.
      </div>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <div className="chip">Мероприятий: {events.length}</div>
        <div className="chip">Всего волонтеров: {total}</div>
      </div>
      {events.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {events.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="chip">{eventDayKey(e)}</div>
                  <div className="chip">{e.volunteersCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">Нет мероприятий с количеством волонтеров больше нуля.</div>
      )}
    </div>
  );
}
