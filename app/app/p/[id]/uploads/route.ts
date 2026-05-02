import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deleteProjectUpload, getProject } from "@/lib/store";
import fs from "fs";
import path from "path";
import { getProjectUploadsDir } from "@/lib/user-files";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url), 303);

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.redirect(new URL("/app", req.url), 303);

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.redirect(new URL("/app", req.url), 303);

  const form = await req.formData();
  const action = String(form.get("action") || "");

  if (action === "delete") {
    const uploadId = Number(form.get("uploadId"));
    if (Number.isFinite(uploadId)) {
      const up = project.uploads?.find((u) => u.id === uploadId);
      if (up) {
        const dir = getProjectUploadsDir(user.id, projectId);
        const full = path.join(dir, up.stored_name);
        try {
          if (fs.existsSync(full)) fs.unlinkSync(full);
        } catch {
          // ignore
        }
      }
      deleteProjectUpload(projectId, user.id, uploadId);
    }
  }

  return NextResponse.redirect(new URL(`/app/p/${projectId}/excel`, req.url), 303);
}

