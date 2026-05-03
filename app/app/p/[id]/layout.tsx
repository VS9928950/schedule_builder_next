import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { ProjectTabs } from "./ProjectTabs";

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  // Heuristic: Next doesn't provide current pathname in server layout without extra work; we keep simple by relying on URLs.
  // Active state will be handled on each page for now.
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="topbar no-print-chrome">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand">Schedule Builder</div>
          <div className="chip">{user.email}</div>
        </div>
        <form action="/sign-out" method="post">
          <button className="secondary" type="submit">
            Выйти
          </button>
        </form>
      </div>
      <div className="card no-print-chrome">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h2 style={{ margin: 0 }}>{project.name}</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Project #{project.id} · Обновлён: {project.updated_at}
            </div>
          </div>
          <a className="chip" href="/app">
            ← К проектам
          </a>
        </div>
        <div style={{ height: 10 }} />
        <ProjectTabs projectId={project.id} />
      </div>
      {children}
    </div>
  );
}

