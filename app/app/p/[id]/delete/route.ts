import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deleteProject, getProject } from "@/lib/store";
import { toPublicUrl } from "@/lib/public-origin";
import fs from "fs";
import path from "path";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const projectDir = path.resolve(process.cwd(), "data", "users", String(user.id), "projects", String(projectId));
  try {
    if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
  } catch {
    // ignore file cleanup errors, project will still be removed from store
  }

  deleteProject(projectId, user.id);
  return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
}
