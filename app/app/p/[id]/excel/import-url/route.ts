import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSessionUser } from "@/lib/session";
import { addProjectUpload, getProject } from "@/lib/store";
import { parseXlsxBuffer } from "@/lib/excel";
import { getProjectUploadsDir, sanitizeFilename } from "@/lib/user-files";
import { toPublicUrl } from "@/lib/public-origin";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_EXCEL_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_UPLOADS_PER_PROJECT = Number(process.env.MAX_EXCEL_UPLOADS_PER_PROJECT || 30);
const FETCH_TIMEOUT_MS = Number(process.env.GSHEETS_FETCH_TIMEOUT_MS || 20_000);

function parseGoogleSheetId(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname !== "docs.google.com") return null;
  const m = /^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(u.pathname);
  return m?.[1] ?? null;
}

function buildGoogleExportXlsxUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
  if ((project.uploads?.length ?? 0) >= MAX_UPLOADS_PER_PROJECT) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=too_many_uploads`), 303);
  }

  const form = await req.formData();
  const sheetUrlRaw = String(form.get("sheetUrl") ?? "").trim();
  if (!sheetUrlRaw) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=no_sheet_url`), 303);
  }

  const sheetId = parseGoogleSheetId(sheetUrlRaw);
  if (!sheetId) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=bad_sheet_url`), 303);
  }

  const exportUrl = buildGoogleExportXlsxUrl(sheetId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(exportUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
  } catch {
    clearTimeout(timeout);
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=sheet_fetch_failed`), 303);
  } finally {
    clearTimeout(timeout);
  }

  if (resp.status === 401 || resp.status === 403) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=sheet_not_public`), 303);
  }
  if (!resp.ok) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=sheet_fetch_failed`), 303);
  }

  const contentLength = Number(resp.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=too_large`), 303);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=too_large`), 303);
  }

  let parsed: unknown;
  try {
    parsed = parseXlsxBuffer(buf);
  } catch {
    return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel?err=bad_excel`), 303);
  }

  const uploadsDir = getProjectUploadsDir(user.id, projectId);
  const originalName = `google-sheet-${sheetId}.xlsx`;
  const safe = sanitizeFilename(originalName);
  const storedName = `${Date.now()}-${safe}`;
  const fullPath = path.join(uploadsDir, storedName);
  fs.writeFileSync(fullPath, buf);

  addProjectUpload(projectId, user.id, originalName, storedName, parsed);

  return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel`), 303);
}
