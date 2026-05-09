import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setUserPassword } from "@/lib/store";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
  const ip = extractClientIp(req);
  const rl = consumeRateLimit({
    scope: "admin:set-password",
    key: `${user.id}|${ip}`,
    limit: 40,
    windowMs: 15 * 60 * 1000
  });
  if (!rl.ok) return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);

  const form = await req.formData();
  const userId = Number(form.get("userId"));
  const password = String(form.get("password") || "");
  if (!Number.isFinite(userId) || password.length < 8) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  try {
    setUserPassword(userId, password);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
}

