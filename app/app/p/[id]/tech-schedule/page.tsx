import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";
import { rowsFromProjectExcelJson } from "@/lib/excel";

function normalizeHeaderKey(k: string) {
  return k.replace(/^\s*#\s*/, "").trim();
}

export default async function TechScheduleTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const rows = rowsFromProjectExcelJson(project.excel_json);
  const headerRow = rows.find((r) => r && typeof r === "object") as Record<string, unknown> | undefined;
  const keys = headerRow ? [...new Set(Object.keys(headerRow).map(normalizeHeaderKey).filter(Boolean))] : [];

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 10px" }}>Техническое расписание</h2>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 720 }}>
        Отдельный вид и отдельный экспорт (в разработке). Источник данных — только лист <b>«Перечень»</b> активного
        документа. Обязательный набор колонок будет согласован после инвентаризации полей шаблона.
      </p>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Колонки в первой строке данных (инвентаризация)</div>
        {keys.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {keys.map((k) => (
              <li key={k} style={{ marginBottom: 4 }}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">Нет загруженного листа «Перечень» или таблица пуста.</div>
        )}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Экспорт «техрасписания» (CSV/печать) подключим на следующем шаге после фиксации полей.
      </div>
    </div>
  );
}
