"use client";

import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage("");
    const resp = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const apiError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
      setError(apiError || "Не удалось отправить письмо");
      setLoading(false);
      return;
    }
    setMessage("Если аккаунт существует, письмо для сброса пароля отправлено.");
    setLoading(false);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Schedule Builder</div>
      </div>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 10px" }}>Восстановление пароля</h2>
        <div className="muted" style={{ marginBottom: 12 }}>
          Укажите email, на который зарегистрирован аккаунт.
        </div>
        <form onSubmit={onSubmit} className="grid">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "Отправка..." : "Отправить ссылку"}
            </button>
            <a className="muted" href="/sign-in">
              К входу
            </a>
          </div>
        </form>
        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
        {message ? <div className="ok" style={{ marginTop: 10 }}>{message}</div> : null}
      </div>
    </div>
  );
}

