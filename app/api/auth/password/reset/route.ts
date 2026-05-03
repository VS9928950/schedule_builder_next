import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { setUserPassword } from "@/lib/store";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";

const Schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export async function POST(req: Request) {
  const ip = extractClientIp(req);
  const ipRate = consumeRateLimit({ scope: "reset:ip", key: ip, limit: 20, windowMs: 15 * 60 * 1000 });
  if (!ipRate.ok) {
    return NextResponse.json({ error: `Too many requests. Retry in ${ipRate.retryAfterSec}s` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const userId = consumeAuthToken("reset_password", parsed.data.token);
  if (!userId) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });

  setUserPassword(userId, parsed.data.password);
  return NextResponse.json({ ok: true });
}

