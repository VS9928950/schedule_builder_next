import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addProjectUpload, getProject } from "@/lib/store";
import { parseXlsxBuffer } from "@/lib/excel";
import fs from "fs";
import path from "path";
import { getProjectUploadsDir, sanitizeFilename } from "@/lib/user-files";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(new URL("/app", req.url), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(new URL("/app", req.url), 303);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=no_file`, req.url), 303);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = parseXlsxBuffer(buf);

  const uploadsDir = getProjectUploadsDir(user.id, projectId);
  const safe = sanitizeFilename(file.name);
  const storedName = `${Date.now()}-${safe}`;
  const fullPath = path.join(uploadsDir, storedName);
  fs.writeFileSync(fullPath, buf);

  addProjectUpload(projectId, user.id, file.name, storedName, parsed);

  return NextResponse.redirect(new URL(`/app/p/${projectId}/excel`, req.url), 303);
}

