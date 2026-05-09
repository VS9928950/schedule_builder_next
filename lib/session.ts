import { cookies } from "next/headers";
import { getIronSession, IronSession } from "iron-session";

export type SessionData = {
  userId?: number;
  email?: string;
  role?: "admin" | "user";
};

const sessionOptions = {
  cookieName: "sb_session",
  password: process.env.SB_SECRET || "dev-secret-change-me-dev-secret-change-me",
  cookieOptions: {
    secure: false,
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

