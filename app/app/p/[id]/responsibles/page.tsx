import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";
import { ResponsiblesViewer } from "./ResponsiblesViewer";

export default async function ResponsiblesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const normalizeResponsible = (v: unknown) => {
    const s = String(v ?? "").replace(/\s+/g, " ").trim();
    if (s === "-" || s === "—") return "";
    return s;
  };

  const events = getProjectEventsIso(project)
    .filter(
      (e) =>
        (e.visible ?? true) &&
        [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
          .map((v) => normalizeResponsible(v))
          .filter(Boolean).length > 0
    )
    .sort((a, b) => {
      const da = String((a.kind === "untimed" ? a.day : a.start) ?? "").localeCompare(String((b.kind === "untimed" ? b.day : b.start) ?? ""));
      if (da !== 0) return da;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Ответственные</h2>
      <div className="muted" style={{ marginBottom: 14 }}>
        Выберите ответственного из полного списка, чтобы увидеть его мероприятия. Доступно деление по дням и проверка пересечений по времени.
      </div>
      <ResponsiblesViewer events={events} />
    </div>
  );
}
