import { extractClientIp } from "@/lib/rate-limit";

type VerifyResult = {
  ok: boolean;
  message?: string;
};

export function isSmartCaptchaConfigured() {
  return Boolean((process.env.YANDEX_SMARTCAPTCHA_SERVER_KEY || "").trim());
}

export async function verifySmartCaptchaToken(req: Request, token: string): Promise<VerifyResult> {
  const serverKey = (process.env.YANDEX_SMARTCAPTCHA_SERVER_KEY || "").trim();
  if (!serverKey) return { ok: false, message: "SmartCaptcha server key is not configured" };
  if (!token || token.trim().length < 10) return { ok: false, message: "Captcha token is missing" };

  const ip = extractClientIp(req);
  const body = new URLSearchParams();
  body.set("secret", serverKey);
  body.set("token", token.trim());
  body.set("ip", ip);

  const validateUrl = (process.env.YANDEX_SMARTCAPTCHA_VALIDATE_URL || "https://smartcaptcha.yandexcloud.net/validate").trim();
  const resp = await fetch(validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, message: `Captcha validation HTTP ${resp.status} ${text}`.trim() };
  }

  const data = (await resp.json().catch(() => null)) as { status?: string; message?: string } | null;
  if (!data || data.status !== "ok") {
    return { ok: false, message: data?.message || "Captcha validation failed" };
  }

  return { ok: true };
}

