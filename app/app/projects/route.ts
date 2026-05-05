import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createProject } from "@/lib/store";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);

  const form = await req.formData();
  const name = String(form.get("name") || "").trim().slice(0, 80) || "Без названия";
  const p = createProject(user.id, name);

  return NextResponse.redirect(toPublicUrl(req, `/app/p/${p.id}`), 303);
}

