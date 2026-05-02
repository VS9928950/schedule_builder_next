import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { parseScheduleFromExcelRows } from "@/lib/schedule";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { EventsEditor, type EditableEvent, type UntimedEditableEvent } from "./EventsEditor";

export default async function EventsTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const rows = rowsFromProjectExcelJson(project.excel_json);
  const eventsFromExcel = parseScheduleFromExcelRows(rows);

  const builds = project.builds ?? [];
  const activeBuildId = project.active_build_id ?? null;
  const activeBuild = activeBuildId ? builds.find((b) => b.id === activeBuildId) ?? null : null;
  const rawEvents = Array.isArray(activeBuild?.events_json) ? (activeBuild!.events_json as any[]) : eventsFromExcel;

  const untimed: UntimedEditableEvent[] = rawEvents
    .filter((e: any) => (e.kind ?? "timed") === "untimed" || (!e.start && !e.end && e.day))
    .map((e: any, idx: number) => ({
      id: String(e.id ?? `u-${idx}`),
      title: String(e.title ?? ""),
      description: e.description ? String(e.description) : undefined,
      description_md: e.description_md ? String(e.description_md) : undefined,
      style_override: e.style_override ?? undefined,
      layout_override: e.layout_override ?? undefined,
      building: e.building != null ? String(e.building) : undefined,
      room: e.room != null ? String(e.room) : undefined,
      format: e.format ? String(e.format) : undefined,
      orderNo: typeof e.orderNo === "number" ? e.orderNo : typeof e["№"] === "number" ? e["№"] : undefined,
      visible: typeof e.visible === "boolean" ? e.visible : true,
      day: typeof e.day === "string" ? e.day : new Date(e.day ?? Date.now()).toISOString(),
      url: typeof e.url === "string" ? e.url : undefined
    }))
    .filter((e) => e.title);
  untimed.sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9));

  const editable: EditableEvent[] = rawEvents
    .filter((e: any) => (e.kind ?? "timed") === "timed" && (e.start || e.end))
    .map((e: any, idx: number) => ({
      id: String(e.id ?? idx),
      title: String(e.title ?? ""),
      description: e.description ? String(e.description) : undefined,
      description_md: e.description_md ? String(e.description_md) : undefined,
      style_override: e.style_override ?? undefined,
      layout_override: e.layout_override ?? undefined,
      building: e.building != null ? String(e.building) : undefined,
      room: e.room != null ? String(e.room) : undefined,
      format: e.format ? String(e.format) : undefined,
      visible: typeof e.visible === "boolean" ? e.visible : true,
      start: typeof e.start === "string" ? e.start : e.start instanceof Date ? e.start.toISOString() : new Date(e.start).toISOString(),
      end: typeof e.end === "string" ? e.end : e.end instanceof Date ? e.end.toISOString() : new Date(e.end).toISOString(),
      url: typeof e.url === "string" ? e.url : undefined
    }))
    .filter((e) => e.title && Number.isFinite(new Date(e.start).getTime()) && Number.isFinite(new Date(e.end).getTime()));

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Версии сборки</h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          Версия фиксирует “результат сборки” (снимок событий). Можно держать несколько версий и выбирать актуальную.
        </div>

        <form className="row" action={`/app/p/${project.id}/builds`} method="post">
          <input type="hidden" name="action" value="create" />
          <input name="version" type="text" placeholder="Версия (например, v1, 2026-04-29, финал)" style={{ maxWidth: 420 }} />
          <button type="submit">Сохранить как версию</button>
          <div className="muted" style={{ fontSize: 12 }}>
            Источник: активный Excel (upload id: {project.active_upload_id ?? "—"})
          </div>
        </form>

        <div style={{ height: 12 }} />

        {builds.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {builds.map((b) => (
              <div key={b.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      v{(b as any).seq ?? b.id} {b.version ? `· ${b.version}` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      id={b.id} · создано: {b.created_at} · автор: {(b as any).created_by_email ?? "—"} · upload: {b.source_upload_id ?? "—"}
                    </div>
                  </div>
                  <div className="row">
                    {activeBuildId === b.id ? <div className="chip">Актуальная</div> : null}
                    {activeBuildId !== b.id ? (
                      <form action={`/app/p/${project.id}/builds`} method="post">
                        <input type="hidden" name="action" value="setActive" />
                        <input type="hidden" name="buildId" value={b.id} />
                        <button className="secondary" type="submit">
                          Сделать актуальной
                        </button>
                      </form>
                    ) : null}
                    <form action={`/app/p/${project.id}/builds`} method="post">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="buildId" value={b.id} />
                      <button className="secondary" type="submit">
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Пока нет версий — нажми “Сохранить как версию”.</div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>
          События {activeBuild ? `(версия: ${activeBuild.version})` : "(из активного Excel, без версии)"}
        </h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          {activeBuild
            ? "Правьте/удаляйте события и сохраняйте — изменения записываются в выбранную версию."
            : "Чтобы править события, сначала создайте версию сборки выше (кнопка «Сохранить как версию»)."}
        </div>
        {editable.length ? (
          activeBuildId ? (
            <EventsEditor projectId={project.id} activeBuildId={activeBuildId} initialEvents={editable} untimedEvents={untimed} />
          ) : (
            <div className="muted">Нет активной версии — создайте версию сборки, чтобы включить редактирование.</div>
          )
        ) : (
          <div className="muted">События не найдены (нет активного Excel или нет строк с Дата/Начало/Окончание).</div>
        )}
      </div>
    </div>
  );
}

