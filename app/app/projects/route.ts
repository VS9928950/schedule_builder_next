import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createProject } from "@/lib/store";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const form = await req.formData();
  const name = String(form.get("name") || "").trim().slice(0, 80) || "Без названия";
  const p = createProject(user.id, name);

  return NextResponse.redirect(new URL(`/app/p/${p.id}`, req.url), 303);
}

