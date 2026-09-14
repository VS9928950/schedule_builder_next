import { readFileSync } from "fs";
import { join } from "path";
import fontkitMod from "@pdf-lib/fontkit";
import type { Font } from "@pdf-lib/fontkit";
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
const FONT_SCALE = 0.85;
const TITLE_SIZE = 18;
const TIME_SIZE = Math.max(10, Math.round(16 * FONT_SCALE));
const FORMAT_SIZE = Math.max(10, Math.round(15 * FONT_SCALE));
const BODY_SIZE = Math.max(11, Math.round(20 * FONT_SCALE));
const DESC_SIZE = Math.max(10, Math.round(15 * FONT_SCALE));
const PAD = Math.max(8, Math.round(32 * FONT_SCALE * 0.55));
const SLOT_GAP = 10;
const COL_GAP = 10;
const STACK_GAP = 8;
const LINE = 1.28;
const FONT_FAMILY = "Arial";

const DAY_COLOR = "#CA0734";
const TIME_COLOR = "#CA0734";
const TITLE_COLOR = "#041A59";
const MUTED = "#000000";
const PLACE_COLOR = "#5A285A";

type Fonts = { regular: Font; bold: Font };

type TextBlock = { text: string; size: number; bold: boolean; color: string };

function escXml(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function loadFontkit() {
  return (fontkitMod as { default?: typeof fontkitMod }).default ?? fontkitMod;
}

function widthOf(font: Font, text: string, size: number) {
  if (!text) return 0;
  const glyphs = font.glyphsForString(text);
  let w = 0;
  for (const g of glyphs) w += g.advanceWidth;
  return (w / font.unitsPerEm) * size;
}

function wrapText(font: Font, text: string, size: number, maxW: number): string[] {
  const raw = String(text ?? "").replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const out: string[] = [];
  for (const para of raw.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let cur = "";
    const flush = () => {
      if (cur) out.push(cur);
      cur = "";
    };
    for (const word of words) {
      if (widthOf(font, word, size) > maxW) {
        flush();
        let piece = "";
        for (const ch of word) {
          const next = piece + ch;
          if (piece && widthOf(font, next, size) > maxW) {
            out.push(piece);
            piece = ch;
          } else piece = next;
        }
        cur = piece;
        continue;
      }
      const next = cur ? `${cur} ${word}` : word;
      if (cur && widthOf(font, next, size) > maxW) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    flush();
  }
  return out;
}

function descLines(raw: string): string[] {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((ln) => ln.replace(/^[-*]\s+/, "• ").replace(/^#+\s+/, "").trimEnd())
    .filter((ln, i, arr) => ln.length > 0 || (i > 0 && arr[i - 1]));
}

function sessionBlocks(box: ProgramBox, fonts: Fonts, maxW: number) {
  const ev = box.ev;
  const place = formatPlaceLabel(ev.building, ev.room);
  const fmt = shouldShowFormat(ev.format) ? String(ev.format).trim() : "";
  const desc = shouldShowDescription(ev.format) ? String(ev.description_md ?? ev.description ?? "") : "";
  const lead = groupedCardIntro(ev.id);
  const time = formatTimeRange(box.startD, box.endD);
  const title = String(ev.title ?? "");
  const inner = Math.max(24, maxW - PAD * 2);
  const blocks: TextBlock[] = [];
  blocks.push({ text: time, size: TIME_SIZE, bold: true, color: TIME_COLOR });
  if (place) blocks.push({ text: place, size: TIME_SIZE, bold: false, color: PLACE_COLOR });
  if (fmt) blocks.push({ text: fmt, size: FORMAT_SIZE, bold: false, color: MUTED });
  wrapText(fonts.bold, title, BODY_SIZE, inner).forEach((t) =>
    blocks.push({ text: t, size: BODY_SIZE, bold: true, color: TITLE_COLOR })
  );
  if (lead && desc) {
    wrapText(fonts.regular, lead, DESC_SIZE, inner).forEach((t) =>
      blocks.push({ text: t, size: DESC_SIZE, bold: false, color: MUTED })
    );
  }
  if (desc) {
    for (const ln of descLines(desc)) {
      wrapText(fonts.regular, ln, DESC_SIZE, inner).forEach((t) =>
        blocks.push({ text: t, size: DESC_SIZE, bold: false, color: MUTED })
      );
    }
  }
  let h = PAD * 2;
  for (const b of blocks) h += b.size * LINE;
  return { blocks, height: h, inner };
}

function tileSvg(x: number, y: number, w: number, h: number, box: ProgramBox, lines: ReturnType<typeof sessionBlocks>) {
  const tone = programCardTone(box.ev);
  const so = (box.ev.style_override ?? {}) as { eventBgColor?: string };
  const bg = so.eventBgColor || PROGRAM_CARD_BG[tone];
  let xml = `<g>\n`;
  xml += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="8" ry="8" fill="${escXml(bg)}"/>\n`;
  let cy = y + PAD + TIME_SIZE;
  const textX = x + PAD;
  for (const b of lines.blocks) {
    const weight = b.bold ? 700 : 400;
    xml += `<text x="${textX.toFixed(2)}" y="${cy.toFixed(2)}" font-family="${FONT_FAMILY}" font-size="${b.size}" font-weight="${weight}" fill="${b.color}">${escXml(
      b.text
    )}</text>\n`;
    cy += b.size * LINE;
  }
  xml += `</g>\n`;
  return xml;
}

function packDayPages(fonts: Fonts, dayKey: string, slots: ProgramBox[][][]) {
  const contentW = A4_W - MARGIN * 2;
  const contentH = A4_H - MARGIN * 2;
  const dayDate = localDateFromDayKey(dayKey);
  const heading = Number.isFinite(dayDate.getTime()) ? formatDayProgramTitle(dayDate) : dayKey;
  const titleBlock = TITLE_SIZE + 12;

  const measured = slots.map((cols) => {
    const spans = cols.map((col) => Math.max(1, ...col.map((b) => b.colSpan || 1)));
    const flex = spans.reduce((a, b) => a + b, 0) || 1;
    const usable = contentW - COL_GAP * Math.max(0, cols.length - 1);
    const colMeas = cols.map((col, i) => {
      const w = (spans[i]! / flex) * usable;
      const tiles = col.map((box) => {
        const s = sessionBlocks(box, fonts, w);
        const mins = Math.max(1, Math.round((box.endD.getTime() - box.startD.getTime()) / 60000));
        return { box, ...s, mins };
      });
      const minStack = tiles.reduce((a, t) => a + t.height, 0) + STACK_GAP * Math.max(0, tiles.length - 1);
      return { w, tiles, minStack };
    });
    const slotH = Math.max(...colMeas.map((c) => c.minStack), 24);
    return { colMeas, slotH };
  });

  const groups: number[][] = [];
  let cur: number[] = [];
  let used = titleBlock;
  for (let i = 0; i < measured.length; i++) {
    const h = measured[i]!.slotH;
    const need = (cur.length ? SLOT_GAP : 0) + h;
    if (cur.length && used + need > contentH) {
      groups.push(cur);
      cur = [i];
      used = titleBlock + h;
    } else {
      cur.push(i);
      used += need;
    }
  }
  if (cur.length) groups.push(cur);

  return groups.map((group) => {
    let xml = `<rect width="${A4_W}" height="${A4_H}" fill="#fff"/>\n`;
    const titleW = widthOf(fonts.bold, heading, TITLE_SIZE);
    xml += `<text x="${((A4_W - titleW) / 2).toFixed(2)}" y="${(MARGIN + TITLE_SIZE).toFixed(2)}" font-family="${FONT_FAMILY}" font-size="${TITLE_SIZE}" font-weight="700" fill="${DAY_COLOR}">${escXml(
      heading
    )}</text>\n`;
    let y = MARGIN + titleBlock;
    for (const idx of group) {
      const slot = measured[idx]!;
      let x = MARGIN;
      for (const col of slot.colMeas) {
        const stacked = col.tiles.length > 1;
        if (!stacked) {
          const tile = col.tiles[0]!;
          xml += tileSvg(x, y, col.w, slot.slotH, tile.box, tile);
        } else {
          const minSum = col.tiles.reduce((a, t) => a + t.height, 0);
          const gaps = STACK_GAP * Math.max(0, col.tiles.length - 1);
          const extra = Math.max(0, slot.slotH - minSum - gaps);
          const totalMins = col.tiles.reduce((a, t) => a + t.mins, 0) || 1;
          let yy = y;
          for (const tile of col.tiles) {
            const th = tile.height + extra * (tile.mins / totalMins);
            xml += tileSvg(x, yy, col.w, th, tile.box, tile);
            yy += th + STACK_GAP;
          }
        }
        x += col.w + COL_GAP;
      }
      y += slot.slotH + SLOT_GAP;
    }
    return xml;
  });
}

export function buildIllustratorSvg(args: {
  events: any[];
  timelineLayout: TimelineLayout | null;
  onlyDayKey?: string | null;
  view?: string | null;
}): string {
  const days = layoutProgramDays({
    events: args.events,
    timelineLayout: args.timelineLayout,
    view: args.view ?? "timeline",
    onlyDayKey: args.onlyDayKey
  });
  const kit = loadFontkit();
  const fontsDir = join(process.cwd(), "lib", "fonts");
  const fonts: Fonts = {
    regular: kit.create(readFileSync(join(fontsDir, "LiberationSans-Regular.ttf"))),
    bold: kit.create(readFileSync(join(fontsDir, "LiberationSans-Bold.ttf")))
  };

  const pages: string[] = [];
  if (!days.length) {
    pages.push(
      `<rect width="${A4_W}" height="${A4_H}" fill="#fff"/>\n` +
        `<text x="${MARGIN}" y="${MARGIN + 18}" font-family="${FONT_FAMILY}" font-size="14" font-weight="400" fill="${TITLE_COLOR}">Нет программы для выбранного периода.</text>\n`
    );
  } else {
    for (const day of days) pages.push(...packDayPages(fonts, day.dayKey, day.slots));
  }

  const height = pages.length * A4_H;
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="${(pages.length * 297).toFixed(2)}mm" viewBox="0 0 ${A4_W} ${height.toFixed(2)}">\n`;
  pages.forEach((page, i) => {
    svg += `<g transform="translate(0, ${(i * A4_H).toFixed(2)})">\n${page}</g>\n`;
  });
  svg += `</svg>\n`;
  return svg;
}
