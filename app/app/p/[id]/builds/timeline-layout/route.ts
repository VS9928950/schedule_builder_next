import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { getProject, updateProjectBuildTimelineLayout } from "@/lib/store";

const Schema = z.object({
  buildId: z.number().int().positive(),
  layout: z.object({
    row_heights: z.record(z.string(), z.record(z.string(), z.number().finite().min(8).max(5000))).optional(),
    col_width_px: z.record(z.string(), z.number().finite().min(120).max(1200)).optional(),
    col_count: z.record(z.string(), z.number().int().min(1).max(64)).optional(),
    event_overrides: z
      .record(
        z.string(),
        z.record(
          z.string(),
          z.object({
            anchor: z.string().min(1).max(16).optional(),
            col: z.number().int().min(0).max(200).optional(),
            colSpan: z.number().int().min(1).max(200).optional(),
            rowSpan: z.number().int().min(1).max(200).optional(),
            heightPx: z.number().finite().min(30).max(5000).optional(),
            hidden: z.boolean().optional()
          })
        )
      )
      .optional(),
    days_per_pack: z.number().int().min(1).max(10).optional(),
    hidden_day_keys: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(500).optional()
  })
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.json({ error: "bad_project" }, { status: 400 });

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_payload" }, { status: 400 });

  updateProjectBuildTimelineLayout(projectId, user.id, parsed.data.buildId, parsed.data.layout);
  return NextResponse.json({ ok: true });
}

