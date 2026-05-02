"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setError(data.error || "Ошибка входа");
      return;
    }
    router.push("/app");
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Schedule Builder</div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2 style={{ margin: "0 0 10px" }}>Вход</h2>
          <div className="muted" style={{ marginBottom: 14 }}>
            Войдите, чтобы загружать Excel и собирать результат.
          </div>
          {error && (
            <div className="error" style={{ marginBottom: 10 }}>
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="grid">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Email
              </div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Пароль
              </div>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>
            <div className="row">
              <button type="submit">Войти</button>
              <a className="muted" href="/register">
                Нет аккаунта? Регистрация
              </a>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 10px" }}>Next.js версия</h2>
          <div className="muted">
            Это перенос MVP на Next.js. Если у вас ещё не установлен Node.js, сначала установите Node.js LTS, затем
            запустите <code>npm install</code> и <code>npm run dev</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

