"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
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
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
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
            <a className="muted" href="/forgot-password">
              Забыли пароль?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
