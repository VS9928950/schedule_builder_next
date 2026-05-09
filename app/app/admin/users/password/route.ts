import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setUserPassword } from "@/lib/store";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const form = await req.formData();
  const userId = Number(form.get("userId"));
  const password = String(form.get("password") || "");
  if (!Number.isFinite(userId) || password.length < 6) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  try {
    setUserPassword(userId, password);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
}

