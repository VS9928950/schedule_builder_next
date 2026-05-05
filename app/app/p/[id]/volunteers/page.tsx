import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";
import { VolunteersViewer } from "./VolunteersViewer";

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
    .sort((a, b) => {
      const da = String((a.kind === "untimed" ? a.day : a.start) ?? "").localeCompare(String((b.kind === "untimed" ? b.day : b.start) ?? ""));
      if (da !== 0) return da;
      return (b.volunteersCount ?? 0) - (a.volunteersCount ?? 0);
    });

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Волонтеры</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Сводка по количеству волонтеров для мероприятий с заполненным полем. Доступно деление по дням и режим «Все дни».
      </div>
      <VolunteersViewer events={events} />
    </div>
  );
}
