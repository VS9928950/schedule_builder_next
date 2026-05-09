import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createUserByAdmin, UserRole } from "@/lib/store";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
  const ip = extractClientIp(req);
  const rl = consumeRateLimit({ scope: "admin:create-user", key: `${user.id}|${ip}`, limit: 30, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const roleRaw = String(form.get("role") || "user");
  const role: UserRole = roleRaw === "admin" ? "admin" : "user";

  if (!email || !password || password.length < 8) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  try {
    createUserByAdmin(email, password, role);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
}

