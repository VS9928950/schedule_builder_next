import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { rowsFromProjectExcelJson } from "@/lib/excel";
import { collectSortedProgramDayKeysFromIso, formatDayFull, localDateFromDayKey, parseScheduleAllFromExcelRows } from "@/lib/schedule";
import { redirect } from "next/navigation";

export default async function ExportTab({ params }: { params: Promise<{ id: string }> }) {
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

  const rows = rowsFromProjectExcelJson(project.excel_json);
  const eventsIsoForExport =
    activeBuild && Array.isArray(activeBuild.events_json)
      ? (activeBuild.events_json as any[]).map((e) => ({
          ...e,
          day: typeof e.day === "string" ? e.day : e.day != null ? new Date(e.day).toISOString() : undefined,
          start: typeof e.start === "string" ? e.start : e.start != null ? new Date(e.start).toISOString() : undefined,
          end: typeof e.end === "string" ? e.end : e.end != null ? new Date(e.end).toISOString() : undefined
        }))
      : (() => {
          const parsed = parseScheduleAllFromExcelRows(rows);
          return [
            ...parsed.untimed.map((e) => ({ ...e, kind: "untimed", day: e.day.toISOString() })),
            ...parsed.timed.map((e) => ({ ...e, kind: "timed", start: e.start.toISOString(), end: e.end.toISOString() }))
          ];
        })();

  const pdfProgramDayKeys =
    eventsIsoForExport.length > 0 ? collectSortedProgramDayKeysFromIso(eventsIsoForExport as any[]) : [];
  const hiddenForPdf = new Set(
    (Array.isArray((activeBuild as any)?.timeline_layout?.hidden_day_keys)
      ? ((activeBuild as any).timeline_layout.hidden_day_keys as unknown[])
      : []
    )
      .map((k) => String(k).slice(0, 10))
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  );
  const pdfVisibleDayKeys = pdfProgramDayKeys.filter((k) => !hiddenForPdf.has(k));
  const exportViews: Array<{ key: string; label: string }> = [
    { key: "tech-schedule", label: "Техрасписание" },
    { key: "rooms", label: "Аудитории" },
    { key: "responsibles", label: "Ответственные" },
    { key: "vks", label: "ВКС" },
    { key: "broadcasts", label: "Трансляции" },
    { key: "interpretation", label: "Перевод" },
    { key: "volunteers", label: "Волонтеры" }
  ];

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Экспорт</h2>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 820 }}>
        Печать и PDF через браузер (без установки ПО у пользователя) и экспорт в Тильду доступны по отдельным областям:
        Техрасписание, Аудитории, Ответственные, ВКС, Трансляции, Перевод, Волонтеры.
      </p>
      <div className="grid" style={{ gap: 10 }}>
        {exportViews.map((v) => (
          <div key={v.key} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>{v.label}</div>
              <div className="chip">Область экспорта</div>
            </div>
            <div style={{ height: 8 }} />
            {activeBuild ? (
              <div className="grid" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <a className="chip" href={`/app/p/${project.id}/export/print?view=${encodeURIComponent(v.key)}`}>
                    Печать / PDF
                  </a>
                  <a className="chip" href={`/app/p/${project.id}/export/print?view=${encodeURIComponent(v.key)}&pdfMode=all&printDialog=1`}>
                    PDF: все дни
                  </a>
                  <a className="chip" href={`/app/p/${project.id}/export/tilda?view=${encodeURIComponent(v.key)}`}>
                    Тильда
                  </a>
                </div>
                {pdfVisibleDayKeys.length ? (
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {pdfVisibleDayKeys.map((dk) => (
                      <a
                        key={`${v.key}-${dk}`}
                        className="chip secondary"
                        href={`/app/p/${project.id}/export/print?view=${encodeURIComponent(v.key)}&pdfMode=single&pdfDay=${encodeURIComponent(dk)}&printDialog=1`}
                        title={dk}
                      >
                        {formatDayFull(localDateFromDayKey(dk))}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <button className="secondary" disabled>
                Нужна актуальная версия сборки
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 10 }} />
      <div className="muted" style={{ fontSize: 12 }}>
        Проект: <b>{project.name}</b>
      </div>
    </div>
  );
}

