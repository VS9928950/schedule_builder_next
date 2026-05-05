import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { eventDayKey, getProjectEventsIso, type ProjectEventIso } from "../event-data";

function collectResponsibles(e: ProjectEventIso) {
  return [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
}

export default async function ResponsiblesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const events = getProjectEventsIso(project)
    .filter((e) => (e.visible ?? true) && collectResponsibles(e).length > 0)
    .sort((a, b) => eventDayKey(a).localeCompare(eventDayKey(b)));

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Ответственные</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Список мероприятий, где заполнены поля «Ответственный сотрудник 1..6».
      </div>
      {events.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {events.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="chip">{eventDayKey(e)}</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {[e.format, e.building, e.room].filter(Boolean).join(" · ")}
              </div>
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                {collectResponsibles(e).map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">Нет мероприятий с заполненными ответственными.</div>
      )}
    </div>
  );
}
