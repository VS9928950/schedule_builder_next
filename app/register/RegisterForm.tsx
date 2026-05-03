"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    onSmartCaptchaSuccess?: (token: string) => void;
  }
}

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);

  const siteKey = useMemo(() => (process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITEKEY || "").trim(), []);

  useEffect(() => {
    window.onSmartCaptchaSuccess = (token: string) => {
      setCaptchaToken(String(token || ""));
      setCaptchaReady(true);
    };
    return () => {
      if (window.onSmartCaptchaSuccess) delete window.onSmartCaptchaSuccess;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage("");
    if (!siteKey) {
      setError("SmartCaptcha не настроена (отсутствует NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITEKEY).");
      return;
    }
    if (!captchaToken) {
      setError("Подтвердите, что вы не робот.");
      return;
    }
    const resp = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const apiError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
      setError(apiError || "Ошибка регистрации");
      return;
    }
    setMessage("Аккаунт создан. Проверьте email и подтвердите регистрацию по ссылке из письма.");
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
        {message && (
          <div className="ok" style={{ marginBottom: 10 }}>
            {message}
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
          <div>
            {siteKey ? (
              <>
                <Script src="https://smartcaptcha.yandexcloud.net/captcha.js" strategy="afterInteractive" />
                <div
                  id="captcha-container"
                  className="smart-captcha"
                  data-sitekey={siteKey}
                  data-callback="onSmartCaptchaSuccess"
                />
                {!captchaReady ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Подтвердите SmartCaptcha перед регистрацией.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="error">SmartCaptcha не настроена на клиенте.</div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
