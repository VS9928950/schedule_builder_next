import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";
import { redirect } from "next/navigation";

function uploadErrorText(code: string | undefined) {
  if (!code) return null;
  switch (code) {
    case "no_file":
      return "Файл не выбран.";
    case "bad_type":
    case "bad_mime":
      return "Разрешены только файлы Excel формата .xlsx.";
    case "too_large":
      return "Файл слишком большой. Проверьте лимит MAX_EXCEL_UPLOAD_BYTES.";
    case "too_many_uploads":
      return "Достигнут лимит количества загруженных Excel для проекта.";
    case "bad_excel":
      return "Файл не удалось разобрать как корректный Excel.";
    case "no_sheet_url":
      return "Ссылка на Google Sheets не указана.";
    case "bad_sheet_url":
      return "Некорректная ссылка Google Sheets. Нужна ссылка вида docs.google.com/spreadsheets/d/<id>/...";
    case "sheet_not_public":
      return "Таблица недоступна по ссылке. Откройте доступ «У кого есть ссылка» и повторите.";
    case "sheet_fetch_failed":
      return "Не удалось скачать Google Sheets как .xlsx. Проверьте ссылку и попробуйте снова.";
    default:
      return "Ошибка загрузки файла.";
  }
}

export default async function ExcelTab({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) redirect("/app");

  const project = getProject(projectId, user.id);
  if (!project) redirect("/app");

  const uploads = project.uploads ?? [];
  const activeId = project.active_upload_id ?? null;
  const sp = await searchParams;
  const uploadError = uploadErrorText(typeof sp?.err === "string" ? sp.err : undefined);

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Документы</h2>
        {uploadError ? (
          <div className="error" style={{ marginBottom: 12 }}>
            {uploadError}
          </div>
        ) : null}
        <p className="muted" style={{ marginBottom: 14 }}>
          Можно загрузить документ двумя способами: файлом `.xlsx` или ссылкой на Google Sheets. В обоих вариантах используется
          лист <b>«Перечень»</b>, остальные листы игнорируются.
        </p>

        <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <a
            href={`/app/p/${project.id}/excel/template`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid var(--line)",
              background: "rgba(37,99,235,.10)",
              color: "var(--text)",
              padding: "10px 14px",
              borderRadius: 12,
              textDecoration: "none"
            }}
          >
            Скачать шаблон .xlsx (лист «Перечень»)
          </a>
        </div>

        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Загрузка</h3>
          <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
            Выберите удобный источник документа. Оба способа равнозначны: после импорта файл попадёт в список загруженных и
            сможет быть выбран активным.
          </div>
          <div className="grid2 excel-upload-grid" style={{ alignItems: "stretch" }}>
            <form
              className="card grid excel-upload-card"
              style={{ padding: 12, margin: 0, alignContent: "start" }}
              action={`/app/p/${project.id}/excel/upload`}
              method="post"
              encType="multipart/form-data"
            >
              <div style={{ fontWeight: 700 }}>Загрузить файл</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Поддерживается файл `.xlsx`.
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Файл .xlsx
                </div>
                <input className="excel-upload-input" name="file" type="file" accept=".xlsx" required />
              </div>
              <div className="row">
                <button type="submit">Загрузить</button>
              </div>
            </form>

            <form
              className="card grid excel-upload-card"
              style={{ padding: 12, margin: 0, alignContent: "start" }}
              action={`/app/p/${project.id}/excel/import-url`}
              method="post"
            >
              <div style={{ fontWeight: 700 }}>Импорт по ссылке</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Вставьте публичную ссылку Google Sheets.
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Ссылка Google Sheets
                </div>
                <input
                  className="excel-upload-input"
                  name="sheetUrl"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  required
                />
              </div>
              <div className="row">
                <button type="submit">Импортировать</button>
              </div>
            </form>
          </div>
        </div>

        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Загруженные файлы</h3>
        {uploads.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {uploads.map((u) => (
              <div key={u.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.original_name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Загружен: {u.created_at} · id={u.id}
                    </div>
                  </div>
                  <div className="row">
                    {activeId === u.id ? <div className="chip">Активный</div> : <div className="chip muted">Не выбран</div>}
                    <form action={`/app/p/${project.id}/uploads`} method="post">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="uploadId" value={u.id} />
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
          <div className="muted">Пока нет загруженных Excel.</div>
        )}
      </div>
    </div>
  );
}

