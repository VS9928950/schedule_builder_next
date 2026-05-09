import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createUserByAdmin, UserRole } from "@/lib/store";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const roleRaw = String(form.get("role") || "user");
  const role: UserRole = roleRaw === "admin" ? "admin" : "user";

  if (!email || !password || password.length < 6) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  try {
    createUserByAdmin(email, password, role);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin"), 303);
}

