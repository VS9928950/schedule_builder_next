import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { deleteProjectUpload, getProject } from "@/lib/store";
import fs from "fs";
import path from "path";
import { getProjectUploadsDir } from "@/lib/user-files";
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

  return NextResponse.redirect(toPublicUrl(req, `/app/p/${projectId}/excel`), 303);
}

