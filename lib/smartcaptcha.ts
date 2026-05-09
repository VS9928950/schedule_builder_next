import { extractClientIp } from "@/lib/rate-limit";

function env(name: string) {
  return (process.env[name] || "").trim();
}

export function isSmartCaptchaEnabled() {
  return Boolean(env("YANDEX_SMARTCAPTCHA_SERVER_KEY"));
}

export function getSmartCaptchaSiteKey() {
  return env("NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY");
}

export async function verifySmartCaptchaToken(req: Request, token: string) {
  const secret = env("YANDEX_SMARTCAPTCHA_SERVER_KEY");
  if (!secret) return { ok: true as const };

  const captchaToken = String(token || "").trim();
  if (!captchaToken) return { ok: false as const, error: "Captcha token is missing" };

  const ip = extractClientIp(req);
  const url = new URL("https://smartcaptcha.yandexcloud.net/validate");
  url.searchParams.set("secret", secret);
  url.searchParams.set("token", captchaToken);
  if (ip && ip !== "unknown") url.searchParams.set("ip", ip);

  try {
    const resp = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const data = (await resp.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!resp.ok) return { ok: false as const, error: `Captcha verify HTTP ${resp.status}` };
    if (data.status !== "ok") return { ok: false as const, error: data.message || "Captcha verification failed" };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Captcha verification unavailable" };
  }
}

