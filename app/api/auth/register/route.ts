import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/store";
import { getSession } from "@/lib/session";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  if (findUserByEmail(email)) return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  const user = createUser(email, password);

  const session = await getSession();
  session.userId = user.id;
  session.email = email;
  await session.save();

  return NextResponse.json({ ok: true });
}

