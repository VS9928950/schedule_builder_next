import { getSessionUser } from "@/lib/session";
import { listUsers } from "@/lib/store";
import { redirect } from "next/navigation";

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ invite?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin") redirect("/app");
  const sp = searchParams ? await searchParams : undefined;
  const inviteStatus = String(sp?.invite ?? "").trim();

  const users = listUsers();

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="topbar no-print-chrome">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand">Schedule Builder</div>
          <div className="chip">{user.email}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="chip" href="/app">
            ← К проектам
          </a>
          <form action="/sign-out" method="post">
            <button className="secondary" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 10px" }}>Администрирование</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Управление пользователями: создание, удаление и смена пароля.
        </p>
        {inviteStatus === "sent" ? (
          <div className="ok" style={{ marginBottom: 10 }}>
            Приглашение отправлено.
          </div>
        ) : inviteStatus === "error" ? (
          <div className="error" style={{ marginBottom: 10 }}>
            Не удалось отправить приглашение. Проверьте почтовые настройки.
          </div>
        ) : null}

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Приглашение на регистрацию</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Отправляет письмо со ссылкой на страницу регистрации.
        </div>
        <form className="row" action="/app/admin/users/invite" method="post" style={{ gap: 8, flexWrap: "wrap" }}>
          <input name="email" type="email" required placeholder="Email для приглашения" style={{ minWidth: 300 }} />
          <button type="submit">Отправить приглашение</button>
        </form>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Добавить пользователя</div>
        <form className="grid" action="/app/admin/users/create" method="post">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input name="email" type="email" required placeholder="Email" style={{ minWidth: 260 }} />
            <input name="password" type="password" minLength={8} required placeholder="Пароль (мин. 8)" style={{ minWidth: 220 }} />
            <select name="role" defaultValue="user" style={{ minWidth: 180 }}>
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
            <button type="submit">Добавить</button>
          </div>
        </form>
      </div>

        <div className="grid" style={{ gap: 10 }}>
        {users.map((u) => (
          <div key={u.id} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{u.email}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Роль: {u.role === "admin" ? "Администратор" : "Пользователь"} · #{u.id}
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <form className="row" action="/app/admin/users/password" method="post" style={{ gap: 8 }}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="password" type="password" minLength={8} required placeholder="Новый пароль (мин. 8)" />
                  <button className="secondary" type="submit">
                    Сменить пароль
                  </button>
                </form>
                <form action="/app/admin/users/delete" method="post">
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    className="secondary"
                    type="submit"
                    style={{ borderColor: "rgba(239,68,68,.6)", color: "rgb(239,68,68)" }}
                  >
                    Удалить
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

