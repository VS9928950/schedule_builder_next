import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/store";
import { issueAuthToken } from "@/lib/auth-tokens";
import { isMailerConfigured, sendEmail } from "@/lib/mailer";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(req: Request) {
  try {
    const ip = extractClientIp(req);
    const ipLimit = consumeRateLimit({ scope: "register:ip", key: ip, limit: 10, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: `Too many registration attempts. Retry in ${ipLimit.retryAfterSec}s` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    if (findUserByEmail(email)) return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    if (!isMailerConfigured()) {
      return NextResponse.json({ error: "Email service is not configured" }, { status: 500 });
    }

    const user = createUser(email, password);
    const token = issueAuthToken(user.id, "verify_email", 24 * 60);
    const baseUrl = process.env.APP_BASE_URL || new URL(req.url).origin;
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: "Подтвердите регистрацию в Schedule Builder",
      text: `Здравствуйте!\n\nПодтвердите ваш email: ${verifyUrl}\n\nСсылка действует 24 часа.`
    });

    return NextResponse.json({ ok: true, requires_email_verification: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

