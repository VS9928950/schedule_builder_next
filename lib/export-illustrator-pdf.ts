import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkitMod from "@pdf-lib/fontkit";
import {
  formatDayProgramTitle,
  formatPlaceLabel,
  formatTimeRange,
  groupedCardIntro,
  localDateFromDayKey,
  PROGRAM_CARD_BG,
  programCardTone,
  shouldShowDescription,
  shouldShowFormat
} from "@/lib/schedule";
import { layoutProgramDays, type ProgramBox, type TimelineLayout } from "@/lib/program-slots";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 22.68;
const FONT_SCALE = 0.6;
const TITLE_SIZE = 18;
const TIME_SIZE = Math.max(8, Math.round(16 * FONT_SCALE));
const FORMAT_SIZE = Math.max(8, Math.round(15 * FONT_SCALE));
const BODY_SIZE = Math.max(8, Math.round(20 * FONT_SCALE));
const DESC_SIZE = Math.max(8, Math.round(15 * FONT_SCALE));
const PAD = Math.max(6, Math.round(32 * FONT_SCALE * 0.6));
const SLOT_GAP = 8;
const COL_GAP = 8;
const STACK_GAP = 6;
const LINE = 1.25;

const DAY_COLOR = rgb(202 / 255, 7 / 255, 52 / 255);
const TIME_COLOR = rgb(202 / 255, 7 / 255, 52 / 255);
const TITLE_COLOR = rgb(4 / 255, 26 / 255, 89 / 255);
const MUTED = rgb(0, 0, 0);
const PLACE_COLOR = rgb(90 / 255, 40 / 255, 90 / 255);

function hexRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex.trim());
  if (!m) return rgb(0.94, 0.95, 0.98);
  return rgb(parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255);
}

function wrapText(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const raw = String(text ?? "").replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const paragraphs = raw.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let cur = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${cur} ${words[i]}`;
      if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
      else {
        lines.push(cur);
        cur = words[i]!;
      }
    }
    lines.push(cur);
  }
  return lines;
}

function descLines(raw: string): string[] {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((ln) => ln.replace(/^[-*]\s+/, "• ").replace(/^#+\s+/, "").trimEnd())
    .filter((ln, i, arr) => ln.length > 0 || (i > 0 && arr[i - 1]));
}

type Fonts = { regular: PDFFont; bold: PDFFont };

function sessionLines(box: ProgramBox, font: PDFFont, titleFont: PDFFont, maxW: number) {
  const ev = box.ev;
  const place = formatPlaceLabel(ev.building, ev.room);
  const fmt = shouldShowFormat(ev.format) ? String(ev.format).trim() : "";
  const desc = shouldShowDescription(ev.format) ? String(ev.description_md ?? ev.description ?? "") : "";
  const lead = groupedCardIntro(ev.id);
  const time = formatTimeRange(box.startD, box.endD);
  const title = String(ev.title ?? "");
  const inner = Math.max(20, maxW - PAD * 2);
  const blocks: Array<{ text: string; size: number; font: PDFFont; color: RGB }> = [];
  blocks.push({ text: time, size: TIME_SIZE, font: titleFont, color: TIME_COLOR });
  if (place) blocks.push({ text: place, size: TIME_SIZE, font, color: PLACE_COLOR });
  if (fmt) blocks.push({ text: fmt, size: FORMAT_SIZE, font, color: MUTED });
  wrapText(titleFont, title, BODY_SIZE, inner).forEach((t) =>
    blocks.push({ text: t, size: BODY_SIZE, font: titleFont, color: TITLE_COLOR })
  );
  if (lead && desc) {
    wrapText(font, lead, DESC_SIZE, inner).forEach((t) => blocks.push({ text: t, size: DESC_SIZE, font, color: MUTED }));
  }
  if (desc) {
    for (const ln of descLines(desc)) {
      wrapText(font, ln, DESC_SIZE, inner).forEach((t) => blocks.push({ text: t, size: DESC_SIZE, font, color: MUTED }));
    }
  }
  let h = PAD * 2;
  for (const b of blocks) h += b.size * LINE;
  return { blocks, height: h, inner };
}

function slotHeights(cols: ProgramBox[][], fonts: Fonts, contentW: number) {
  const spans = cols.map((col) => Math.max(1, ...col.map((b) => b.colSpan || 1)));
  const flex = spans.reduce((a, b) => a + b, 0) || 1;
  const usable = contentW - COL_GAP * Math.max(0, cols.length - 1);
  const widths = spans.map((s) => (s / flex) * usable);
  const colHs: number[] = [];
  const measured = cols.map((col, i) => {
    const w = widths[i]!;
    const tiles = col.map((box) => {
      const s = sessionLines(box, fonts.regular, fonts.bold, w);
      const mins = Math.max(1, Math.round((box.endD.getTime() - box.startD.getTime()) / 60000));
      return { box, ...s, mins };
    });
    const stack = tiles.reduce((a, t) => a + t.height, 0) + STACK_GAP * Math.max(0, tiles.length - 1);
    colHs.push(stack);
    return { w, tiles, stack };
  });
  const slotH = Math.max(...colHs, 24);
  return { measured, slotH, widths };
}

function drawTile(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  yTop: number,
  w: number,
  h: number,
  box: ProgramBox,
  lines: ReturnType<typeof sessionLines>
) {
  const tone = programCardTone(box.ev);
  const so = (box.ev.style_override ?? {}) as { eventBgColor?: string };
  const bgHex = so.eventBgColor || PROGRAM_CARD_BG[tone];
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    color: hexRgb(bgHex),
    borderWidth: 0
  });
  let cy = yTop - PAD - TIME_SIZE;
  const textX = x + PAD;
  const maxW = lines.inner;
  for (const b of lines.blocks) {
    const t = b.text.length ? b.text : " ";
    const shown =
      b.font.widthOfTextAtSize(t, b.size) <= maxW
        ? t
        : (() => {
            let s = t;
            while (s.length > 1 && b.font.widthOfTextAtSize(`${s}…`, b.size) > maxW) s = s.slice(0, -1);
            return `${s}…`;
          })();
    page.drawText(shown, {
      x: textX,
      y: cy,
      size: b.size,
      font: b.font,
      color: b.color
    });
    cy -= b.size * LINE;
  }
}

function packAndDrawDay(
  doc: PDFDocument,
  fonts: Fonts,
  dayKey: string,
  slots: ProgramBox[][][]
) {
  const contentW = A4_W - MARGIN * 2;
  const contentH = A4_H - MARGIN * 2;
  const dayDate = localDateFromDayKey(dayKey);
  const heading = Number.isFinite(dayDate.getTime()) ? formatDayProgramTitle(dayDate) : dayKey;
  const titleBlock = TITLE_SIZE + 10;

  type SlotMeas = ReturnType<typeof slotHeights>;
  const measuredSlots: SlotMeas[] = slots.map((cols) => slotHeights(cols, fonts, contentW));

  const pages: number[][] = [];
  let cur: number[] = [];
  let used = titleBlock;
  for (let i = 0; i < measuredSlots.length; i++) {
    const h = measuredSlots[i]!.slotH;
    const need = (cur.length ? SLOT_GAP : 0) + h;
    if (cur.length && used + need > contentH) {
      pages.push(cur);
      cur = [i];
      used = titleBlock + h;
    } else {
      cur.push(i);
      used += need;
    }
  }
  if (cur.length) pages.push(cur);

  for (const group of pages) {
    const page = doc.addPage([A4_W, A4_H]);
    const titleW = fonts.bold.widthOfTextAtSize(heading, TITLE_SIZE);
    page.drawText(heading, {
      x: (A4_W - titleW) / 2,
      y: A4_H - MARGIN - TITLE_SIZE,
      size: TITLE_SIZE,
      font: fonts.bold,
      color: DAY_COLOR
    });
    let y = A4_H - MARGIN - titleBlock;
    for (const idx of group) {
      const slot = measuredSlots[idx]!;
      const cols = slots[idx]!;
      let x = MARGIN;
      for (let c = 0; c < slot.measured.length; c++) {
        const col = slot.measured[c]!;
        const w = col.w;
        const stacked = col.tiles.length > 1;
        const target = slot.slotH;
        if (!stacked) {
          const tile = col.tiles[0]!;
          drawTile(page, fonts, x, y, w, target, tile.box, tile);
        } else {
          const totalMins = col.tiles.reduce((a, t) => a + t.mins, 0) || 1;
          let yy = y;
          const flexGaps = STACK_GAP * Math.max(0, col.tiles.length - 1);
          const body = Math.max(1, target - flexGaps);
          for (let t = 0; t < col.tiles.length; t++) {
            const tile = col.tiles[t]!;
            const th = (tile.mins / totalMins) * body;
            drawTile(page, fonts, x, yy, w, th, tile.box, tile);
            yy -= th + STACK_GAP;
          }
        }
        x += w + COL_GAP;
      }
      y -= slot.slotH + SLOT_GAP;
    }
  }
}

export async function buildIllustratorPdf(args: {
  events: any[];
  timelineLayout: TimelineLayout | null;
  onlyDayKey?: string | null;
  view?: string | null;
}): Promise<Uint8Array> {
  const days = layoutProgramDays({
    events: args.events,
    timelineLayout: args.timelineLayout,
    view: args.view ?? "timeline",
    onlyDayKey: args.onlyDayKey
  });
  const doc = await PDFDocument.create();
  const fontkit = (fontkitMod as { default?: typeof fontkitMod }).default ?? fontkitMod;
  doc.registerFontkit(fontkit);
  const fontsDir = join(process.cwd(), "lib", "fonts");
  const regularBytes = readFileSync(join(fontsDir, "LiberationSans-Regular.ttf"));
  const boldBytes = readFileSync(join(fontsDir, "LiberationSans-Bold.ttf"));
  const fonts: Fonts = {
    regular: await doc.embedFont(regularBytes, { subset: false }),
    bold: await doc.embedFont(boldBytes, { subset: false })
  };
  if (!days.length) {
    const page = doc.addPage([A4_W, A4_H]);
    page.drawText("Нет программы для выбранного периода.", {
      x: MARGIN,
      y: A4_H - MARGIN - 18,
      size: 12,
      font: fonts.regular,
      color: TITLE_COLOR
    });
  } else {
    for (const day of days) packAndDrawDay(doc, fonts, day.dayKey, day.slots);
  }
  return doc.save({ useObjectStreams: false });
}
