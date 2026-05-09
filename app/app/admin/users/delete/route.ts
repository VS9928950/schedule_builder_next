import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deleteUserByAdmin } from "@/lib/store";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
  const ip = extractClientIp(req);
  const rl = consumeRateLimit({ scope: "admin:delete-user", key: `${user.id}|${ip}`, limit: 20, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);

  const form = await req.formData();
  const userId = Number(form.get("userId"));
  if (!Number.isFinite(userId) || userId === user.id) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  try {
    deleteUserByAdmin(userId);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
}

