import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";
import { VksViewer } from "./VksViewer";

export default async function VksTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const events = getProjectEventsIso(project)
    .filter((e) => (e.visible ?? true) && (e.vks === "Да" || e.vks === "Нет" || e.vks === "Не указано"))
    .sort((a, b) => {
      const da = String((a.kind === "untimed" ? a.day : a.start) ?? "").localeCompare(String((b.kind === "untimed" ? b.day : b.start) ?? ""));
      if (da !== 0) return da;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>ВКС</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Статус ВКС по мероприятиям. Доступно деление по дням и режим «Все дни».
      </div>
      <VksViewer events={events} />
    </div>
  );
}
