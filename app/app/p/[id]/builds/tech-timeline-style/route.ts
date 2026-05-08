import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { getProject, updateProjectBuildTechTimelineStyle } from "@/lib/store";

const Schema = z.object({
  buildId: z.number().int().positive(),
  style: z.object({
    eveningProgramTitle: z.string().min(1).max(80).optional(),
    titleFontPx: z.number().int().min(10).max(28).optional(),
    timeFontPx: z.number().int().min(9).max(22).optional(),
    formatFontPx: z.number().int().min(9).max(22).optional(),
    placeFontPx: z.number().int().min(9).max(22).optional(),
    titleWeight: z.number().int().min(100).max(900).optional(),
    titleItalic: z.boolean().optional(),
    titleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    timeWeight: z.number().int().min(100).max(900).optional(),
    timeItalic: z.boolean().optional(),
    timeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    formatWeight: z.number().int().min(100).max(900).optional(),
    formatItalic: z.boolean().optional(),
    formatColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    placeWeight: z.number().int().min(100).max(900).optional(),
    placeItalic: z.boolean().optional(),
    placeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    teamLeadFontPx: z.number().int().min(9).max(20).optional(),
    teamLeadColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    teamLeadWeight: z.number().int().min(100).max(900).optional(),
    teamLeadItalic: z.boolean().optional(),
    responsiblesFontPx: z.number().int().min(9).max(20).optional(),
    responsiblesColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    responsiblesWeight: z.number().int().min(100).max(900).optional(),
    responsiblesItalic: z.boolean().optional(),
    flagsFontPx: z.number().int().min(9).max(20).optional(),
    flagsColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    flagsWeight: z.number().int().min(100).max(900).optional(),
    flagsItalic: z.boolean().optional(),
    volunteersFontPx: z.number().int().min(9).max(20).optional(),
    volunteersColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    volunteersWeight: z.number().int().min(100).max(900).optional(),
    volunteersItalic: z.boolean().optional(),
    markFontPx: z.number().int().min(9).max(18).optional(),
    markColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    markLineColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    eventBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    eventBgAlpha: z.number().min(0).max(1).optional(),
    eventBorderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    eventBorderAlpha: z.number().min(0).max(1).optional(),
    fieldBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    fieldBgAlpha: z.number().min(0).max(1).optional(),
    eventBg: z.string().min(1).max(64).optional(),
    eventBorder: z.string().min(1).max(64).optional(),
    eventLinkTarget: z.union([z.literal("_blank"), z.literal("_self")]).optional()
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

  updateProjectBuildTechTimelineStyle(projectId, user.id, parsed.data.buildId, parsed.data.style);
  return NextResponse.json({ ok: true });
}
