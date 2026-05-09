import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/lib/store";
import { getSession } from "@/lib/session";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const emailVerificationRequired = process.env.AUTH_EMAIL_REQUIRED === "true";
  const ip = extractClientIp(req);
  const ipRate = consumeRateLimit({ scope: "login:ip", key: ip, limit: 30, windowMs: 15 * 60 * 1000 });
  if (!ipRate.ok) {
    return NextResponse.json({ error: `Too many login attempts. Retry in ${ipRate.retryAfterSec}s` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const emailRate = consumeRateLimit({ scope: "login:email-ip", key: `${email}|${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!emailRate.ok) {
    return NextResponse.json({ error: `Too many login attempts. Retry in ${emailRate.retryAfterSec}s` }, { status: 429 });
  }

  const user = authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  if (emailVerificationRequired && user.email_verified === false) {
    return NextResponse.json({ error: "Email is not verified. Please confirm your email first." }, { status: 403 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  return NextResponse.json({ ok: true });
}

