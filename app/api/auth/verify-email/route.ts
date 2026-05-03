import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { markUserEmailVerified } from "@/lib/store";

const Schema = z.object({
  token: z.string().min(20)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const userId = consumeAuthToken("verify_email", parsed.data.token);
  if (!userId) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });

  markUserEmailVerified(userId);
  return NextResponse.json({ ok: true });
}

