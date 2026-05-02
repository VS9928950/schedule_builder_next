"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resp = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const apiError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
      setError(apiError || "Ошибка регистрации");
      return;
    }
    router.push("/app");
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Schedule Builder</div>
      </div>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 10px" }}>Регистрация</h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          Создайте аккаунт для сохранения проектов.
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
              Пароль (мин. 6 символов)
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
            />
          </div>
          <div className="row">
            <button type="submit">Создать аккаунт</button>
            <a className="muted" href="/sign-in">
              Уже есть аккаунт? Войти
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
