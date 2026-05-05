import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProject, renameProject } from "@/lib/store";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const form = await req.formData();
  const nextName = String(form.get("name") || "");
  renameProject(projectId, user.id, nextName);

  return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?ok=renamed`), 303);
}
