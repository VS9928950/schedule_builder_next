import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";
import { AnnouncementsBuilder } from "./AnnouncementsBuilder";

export default async function AnnouncementsTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const events = getProjectEventsIso(project)
    .filter((e) => e.visible ?? true)
    .sort((a, b) => {
      const da = String((a.kind === "untimed" ? a.day : a.start) ?? "").localeCompare(
        String((b.kind === "untimed" ? b.day : b.start) ?? "")
      );
      if (da !== 0) return da;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });
  const announcementEvents = events.map((e, idx) => ({
    id: String(e.id ?? `${e.kind ?? "timed"}-${idx}`),
    title: e.title,
    description: e.description,
    format: e.format,
    day: e.day,
    start: e.start,
    end: e.end,
    building: e.building,
    room: e.room
  }));

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Анонсы для мероприятий</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Выберите мероприятие и формат шаблона, чтобы получить готовый текстовый блок для отправки в соцсети или мессенджер.
      </div>
      <AnnouncementsBuilder events={announcementEvents} />
    </div>
  );
}
