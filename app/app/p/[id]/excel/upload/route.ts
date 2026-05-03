import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addProjectUpload, getProject } from "@/lib/store";
import { parseXlsxBuffer } from "@/lib/excel";
import fs from "fs";
import path from "path";
import { getProjectUploadsDir, sanitizeFilename } from "@/lib/user-files";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_EXCEL_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_UPLOADS_PER_PROJECT = Number(process.env.MAX_EXCEL_UPLOADS_PER_PROJECT || 30);
const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream"
]);

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
  const ext = path.extname(file.name || "").toLowerCase();
  if (ext !== ".xlsx") {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=bad_type`, req.url), 303);
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=bad_mime`, req.url), 303);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=too_large`, req.url), 303);
  }
  if ((project.uploads?.length ?? 0) >= MAX_UPLOADS_PER_PROJECT) {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=too_many_uploads`, req.url), 303);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed: unknown;
  try {
    parsed = parseXlsxBuffer(buf);
  } catch {
    return NextResponse.redirect(new URL(`/app/p/${projectId}/excel?err=bad_excel`, req.url), 303);
  }

  const uploadsDir = getProjectUploadsDir(user.id, projectId);
  const safe = sanitizeFilename(file.name);
  const storedName = `${Date.now()}-${safe}`;
  const fullPath = path.join(uploadsDir, storedName);
  fs.writeFileSync(fullPath, buf);

  addProjectUpload(projectId, user.id, file.name, storedName, parsed);

  return NextResponse.redirect(new URL(`/app/p/${projectId}/excel`, req.url), 303);
}

