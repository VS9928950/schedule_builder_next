import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { eventDayKey, getProjectEventsIso } from "../event-data";

export default async function InterpretationTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const events = getProjectEventsIso(project)
    .filter(
      (e) =>
        (e.visible ?? true) &&
        (e.simultaneousInterpretation === "Да" ||
          e.simultaneousInterpretation === "Нет" ||
          e.simultaneousInterpretation === "Не указано")
    )
    .sort((a, b) => eventDayKey(a).localeCompare(eventDayKey(b)));

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Перевод</h2>
      <div className="muted" style={{ marginBottom: 14 }}>Статус синхронного перевода по мероприятиям.</div>
      {events.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {events.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="chip">{eventDayKey(e)}</div>
                  <div className="chip">{e.simultaneousInterpretation}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">Нет данных по синхронному переводу.</div>
      )}
    </div>
  );
}
