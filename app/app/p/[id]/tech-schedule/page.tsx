import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { getProjectEventsIso } from "../event-data";
import { TimelineViewer } from "../timeline/TimelineViewer";

export default async function TechScheduleTab({ params }: { params: Promise<{ id: string }> }) {
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
  const eventsIso = getProjectEventsIso(project);

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Техническое расписание</h2>
      <p className="muted" style={{ marginBottom: 14, fontSize: 14, maxWidth: "none", width: "100%" }}>
        Полнофункциональная копия «Архитектуры» с отдельными настройками и отдельным набором правил для техрасписания.
        Дополнительные поля событий показываются автоматически, если заполнены.
      </p>
      {activeBuild ? (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Источник: версия сборки <b>v{(activeBuild as any).seq ?? activeBuild.id}</b>
          {activeBuild.version ? ` · ${activeBuild.version}` : ""} · автор: {(activeBuild as any).created_by_email ?? "—"}
        </div>
      ) : null}
      {eventsIso.length ? (
        <TimelineViewer
          events={eventsIso as any}
          projectId={project.id}
          activeBuildId={activeBuild ? activeBuild.id : null}
          initialMarks={(activeBuild as any)?.tech_timeline_marks ?? null}
          initialStyle={(activeBuild as any)?.tech_timeline_style ?? null}
          initialLayout={(activeBuild as any)?.tech_timeline_layout ?? null}
          apiBase="tech-timeline"
          showExtraFields
        />
      ) : (
        <div className="muted">Событий нет — сначала загрузите Excel и/или выберите активную версию сборки.</div>
      )}
    </div>
  );
}
