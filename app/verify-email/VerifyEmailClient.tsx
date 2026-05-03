"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setLoading(true);
    setError(null);
    setMessage("");
    const resp = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const apiError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
      setError(apiError || "Не удалось подтвердить email");
      setLoading(false);
      return;
    }
    setMessage("Email подтвержден. Теперь можно войти.");
    setLoading(false);
    setTimeout(() => router.push("/sign-in"), 1200);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Schedule Builder</div>
      </div>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 10px" }}>Подтверждение email</h2>
        {token ? (
          <>
            <div className="muted" style={{ marginBottom: 12 }}>
              Нажмите кнопку ниже, чтобы подтвердить регистрацию.
            </div>
            <div className="row">
              <button type="button" onClick={onVerify} disabled={loading}>
                {loading ? "Проверка..." : "Подтвердить email"}
              </button>
              <a className="muted" href="/sign-in">
                К входу
              </a>
            </div>
          </>
        ) : (
          <div className="error">Токен подтверждения не найден в ссылке.</div>
        )}
        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
        {message ? <div className="ok" style={{ marginTop: 10 }}>{message}</div> : null}
      </div>
    </div>
  );
}

