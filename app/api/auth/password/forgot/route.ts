import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/store";
import { issueAuthToken } from "@/lib/auth-tokens";
import { isMailerConfigured, sendEmail } from "@/lib/mailer";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";

const Schema = z.object({
  email: z.string().email()
});

export async function POST(req: Request) {
  const ip = extractClientIp(req);
  const ipRate = consumeRateLimit({ scope: "forgot:ip", key: ip, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!ipRate.ok) {
    return NextResponse.json({ error: `Too many requests. Retry in ${ipRate.retryAfterSec}s` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Do not reveal whether user exists.
  const email = parsed.data.email.trim().toLowerCase();
  const user = findUserByEmail(email);
  if (!isMailerConfigured()) {
    return NextResponse.json({ error: "Email service is not configured" }, { status: 500 });
  }
  if (!user) return NextResponse.json({ ok: true });

  const token = issueAuthToken(user.id, "reset_password", 60);
  const baseUrl = process.env.APP_BASE_URL || new URL(req.url).origin;
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Сброс пароля Schedule Builder",
    text: `Запрошен сброс пароля.\n\nПерейдите по ссылке: ${resetUrl}\n\nСсылка действует 60 минут.`
  });

  return NextResponse.json({ ok: true });
}

