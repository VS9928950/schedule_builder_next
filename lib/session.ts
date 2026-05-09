import { cookies } from "next/headers";
import { getIronSession, IronSession } from "iron-session";

export type SessionData = {
  userId?: number;
  email?: string;
  role?: "admin" | "user";
};

const secret = (process.env.SB_SECRET || "").trim();
if (!secret) {
  throw new Error("SB_SECRET is required");
}
if (secret.length < 32) {
  throw new Error("SB_SECRET must be at least 32 characters");
}

const sessionOptions = {
  cookieName: "sb_session",
  password: secret,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const
  }
};

export async function getSession(): Promise<IronSession<SessionData>> {
  // Next.js App Router: pass cookies store
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getSessionUser() {
  const session = await getSession();
  if (!session.userId || !session.email) return null;
  return { id: session.userId, email: session.email, role: session.role === "admin" ? "admin" : "user" };
}

