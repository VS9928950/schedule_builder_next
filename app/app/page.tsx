import { getSessionUser } from "@/lib/session";
import { listProjects } from "@/lib/store";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = listProjects(user.id);

  return (
    <div className="grid2">
      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Проекты</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          В проекте хранятся документы Excel (лист <b>«Перечень»</b>), версии сборки и настройки сетки/экспорта.
        </p>
        <form className="row" action="/app/projects" method="post" style={{ marginBottom: 14 }}>
          <input name="name" type="text" placeholder="Название проекта" required style={{ maxWidth: 380 }} />
          <button type="submit">Создать</button>
        </form>

        <div className="grid">
          {projects.length ? (
            projects.map((p) => (
              <a key={p.id} className="card" href={`/app/p/${p.id}`} style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Обновлён: {p.updated_at}
                    </div>
                  </div>
                  <div className="chip">Открыть</div>
                </div>
              </a>
            ))
          ) : (
            <div className="muted">Пока нет проектов — создайте первый.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Как это работает</h2>
        <div className="grid">
          <div className="card" style={{ padding: 12 }}>
            <div>
              <b>1) Документы</b> — загрузка <code>.xlsx</code>, шаблон «Перечень», выбор активного файла.
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div>
              <b>2) События и архитектура</b> — версия сборки, правки, сетка по дням, стили.
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div>
              <b>3) Экспорт</b> — печать и PDF через браузер, сниппет для Тильды.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

