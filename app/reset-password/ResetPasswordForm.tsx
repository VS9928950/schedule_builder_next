"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage("");
    setLoading(true);
    const resp = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const apiError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
      setError(apiError || "Не удалось обновить пароль");
      setLoading(false);
      return;
    }
    setMessage("Пароль обновлен. Переходим на страницу входа...");
    setLoading(false);
    setTimeout(() => router.push("/sign-in"), 1200);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Schedule Builder</div>
      </div>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 10px" }}>Новый пароль</h2>
        {!token ? (
          <div className="error">В ссылке отсутствует токен сброса пароля.</div>
        ) : (
          <form onSubmit={onSubmit} className="grid">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Новый пароль (минимум 8 символов)
              </div>
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="row">
              <button type="submit" disabled={loading}>
                {loading ? "Сохраняем..." : "Сменить пароль"}
              </button>
              <a className="muted" href="/sign-in">
                К входу
              </a>
            </div>
          </form>
        )}
        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
        {message ? <div className="ok" style={{ marginTop: 10 }}>{message}</div> : null}
      </div>
    </div>
  );
}

