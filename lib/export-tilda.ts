type IsoEvent = {
  id: string;
  title: string;
  description?: string;
  description_md?: string;
  announcement?: string;
  style_override?: {
    eventBgColor?: string;
    eventBgAlpha?: number;
    eventBorderColor?: string;
    eventBorderAlpha?: number;
  };
  building?: string;
  room?: string;
  format?: string;
  responsible1?: string;
  responsible2?: string;
  responsible3?: string;
  responsible4?: string;
  responsible5?: string;
  responsible6?: string;
  teamLead?: string;
  volunteersCount?: number;
  vks?: string;
  translation?: string;
  simultaneousInterpretation?: string;
  photosFromResponsible?: string;
  supportMaterials?: string;
  banner?: string;
  orderNo?: number;
  visible?: boolean;
  kind?: "timed" | "untimed";
  day?: string; // ISO date
  start?: string; // ISO
  end?: string; // ISO
  url?: string;
  speakers?: string;
  popup?: string;
  popupButtonText?: string;
  popupButtonUrl?: string;
};

type RoomTimedEvent = { id: string; title: string; start: Date; end: Date; dayKey: string; raw: IsoEvent };
type RoomUntimedEvent = { id: string; title: string; dayKey: string; orderNo?: number; raw: IsoEvent };
type RoomEntry = {
  key: string;
  label: string;
  building: string;
  room: string;
  timed: RoomTimedEvent[];
  untimed: RoomUntimedEvent[];
};
type RoomBuildingGroup = {
  building: string;
  label: string;
  rooms: RoomEntry[];
};

type EventLayoutOverride = {
  anchor?: string;
  col?: number;
  colSpan?: number;
  rowSpan?: number;
  heightPx?: number;
  hidden?: boolean;
};

type TimelineLayout = {
  row_heights?: Record<string, Record<string, number>>;
  col_width_px?: Record<string, number>;
  col_count?: Record<string, number>;
  event_overrides?: Record<string, Record<string, EventLayoutOverride>>;
  hidden_day_keys?: string[];
};

import {
  isArchitectureProgramView,
  isTechScheduleOnlyFormat,
  programCardTone,
  PROGRAM_CARD_BG,
  shouldShowFormat,
  publicCardDescription,
  highlightPlaceInLine,
  groupedCardIntro,
  formatPlaceLabel,
  normalizeEventLink,
  resolveEventLinkTarget,
  composePopupText,
  meaningfulText,
  resolvePopupButton,
  type GroupedListItem
} from "@/lib/schedule";
import { layoutProgramDays } from "@/lib/program-slots";
import { renderMarkdownLiteHtml } from "@/lib/markdown-lite";

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escAttr(s: unknown) {
  return esc(s).replaceAll("\n", "&#10;").replaceAll("\r", "");
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(hex ?? "").trim());
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

function rgbaFrom(hex: string, a: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const aa = Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${aa})`;
}

type SnippetStyleIn = {
  titleFontPx?: number;
  timeFontPx?: number;
  formatFontPx?: number;
  placeFontPx?: number;
  descFontPx?: number;
  titleWeight?: number;
  titleItalic?: boolean;
  titleColor?: string;
  timeWeight?: number;
  timeItalic?: boolean;
  timeColor?: string;
  formatWeight?: number;
  formatItalic?: boolean;
  formatColor?: string;
  placeWeight?: number;
  placeItalic?: boolean;
  placeColor?: string;
  descWeight?: number;
  descItalic?: boolean;
  descColor?: string;
  teamLeadFontPx?: number;
  teamLeadColor?: string;
  teamLeadWeight?: number;
  teamLeadItalic?: boolean;
  responsiblesFontPx?: number;
  responsiblesColor?: string;
  responsiblesWeight?: number;
  responsiblesItalic?: boolean;
  vksFontPx?: number;
  vksColor?: string;
  vksWeight?: number;
  vksItalic?: boolean;
  translationFontPx?: number;
  translationColor?: string;
  translationWeight?: number;
  translationItalic?: boolean;
  interpretationFontPx?: number;
  interpretationColor?: string;
  interpretationWeight?: number;
  interpretationItalic?: boolean;
  volunteersFontPx?: number;
  volunteersColor?: string;
  volunteersWeight?: number;
  volunteersItalic?: boolean;
  markFontPx?: number;
  markColor?: string;
  markLineColor?: string;
  eventBgColor?: string;
  eventBgAlpha?: number;
  eventBorderColor?: string;
  eventBorderAlpha?: number;
  fieldBgColor?: string;
  fieldBgAlpha?: number;
  eventBg?: string;
  eventBorder?: string;
  eventLinkTarget?: "_blank" | "_self";
} | null | undefined;

type ResolvedSnippetStyle = {
  titleFontPx: number;
  timeFontPx: number;
  formatFontPx: number;
  placeFontPx: number;
  descFontPx: number;
  titleWeight: number;
  titleItalic: boolean;
  titleColor: string;
  timeWeight: number;
  timeItalic: boolean;
  timeColor: string;
  formatWeight: number;
  formatItalic: boolean;
  formatColor: string;
  placeWeight: number;
  placeItalic: boolean;
  placeColor: string;
  descWeight: number;
  descItalic: boolean;
  descColor: string;
  teamLeadFontPx: number;
  teamLeadColor: string;
  teamLeadWeight: number;
  teamLeadItalic: boolean;
  responsiblesFontPx: number;
  responsiblesColor: string;
  responsiblesWeight: number;
  responsiblesItalic: boolean;
  vksFontPx: number;
  vksColor: string;
  vksWeight: number;
  vksItalic: boolean;
  translationFontPx: number;
  translationColor: string;
  translationWeight: number;
  translationItalic: boolean;
  interpretationFontPx: number;
  interpretationColor: string;
  interpretationWeight: number;
  interpretationItalic: boolean;
  volunteersFontPx: number;
  volunteersColor: string;
  volunteersWeight: number;
  volunteersItalic: boolean;
  markFontPx: number;
  markColor: string;
  markLineColor: string;
  tileBg: string;
  tileBorder: string;
  fieldBg: string;
  eventLinkTarget: "_blank" | "_self";
};

function clampNum(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampWeight(v: unknown, fallback: number) {
  return Math.round(clampNum(v, fallback, 100, 900));
}

function strOr(v: unknown, fallback: string) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
}

function boolOr(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

function colorOrMigrated(v: unknown, legacy: string, next: string) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s.toLowerCase() === legacy.toLowerCase()) return next;
  return s;
}

function numOrMigrated(v: unknown, legacy: number, next: number, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v)) return clampNum(next, next, min, max);
  if (v === legacy) return clampNum(next, next, min, max);
  return clampNum(v, next, min, max);
}

function scaleThemeType(theme: ResolvedSnippetStyle, scale: number): ResolvedSnippetStyle {
  const next = { ...theme };
  (Object.keys(next) as Array<keyof ResolvedSnippetStyle>).forEach((key) => {
    if (!String(key).endsWith("FontPx")) return;
    const n = next[key];
    if (typeof n === "number" && Number.isFinite(n)) {
      (next as Record<string, unknown>)[key as string] = Math.max(8, Math.round(n * scale));
    }
  });
  return next;
}

/** Same defaults as Architecture / Tech schedule style panels. */
function resolveSnippetStyle(raw: SnippetStyleIn): ResolvedSnippetStyle {
  const s = raw ?? {};
  const tileBg =
    (s.eventBgColor ? rgbaFrom(String(s.eventBgColor), Number(s.eventBgAlpha ?? 1)) : null) ??
    (typeof s.eventBg === "string" && s.eventBg.trim() ? s.eventBg.trim() : null) ??
    "#EFF2FB";
  const tileBorder =
    (s.eventBorderColor ? rgbaFrom(String(s.eventBorderColor), Number(s.eventBorderAlpha ?? 1)) : null) ??
    (typeof s.eventBorder === "string" && s.eventBorder.trim() ? s.eventBorder.trim() : null) ??
    "transparent";
  const fieldBg =
    (s.fieldBgColor ? rgbaFrom(String(s.fieldBgColor), Number(s.fieldBgAlpha ?? 1)) : null) ?? "transparent";
  return {
    titleFontPx: numOrMigrated(s.titleFontPx, 13, 20, 8, 48),
    timeFontPx: numOrMigrated(s.timeFontPx, 11, 16, 8, 48),
    formatFontPx: numOrMigrated(s.formatFontPx, 11, 15, 8, 48),
    placeFontPx: numOrMigrated(s.placeFontPx, 11, 16, 8, 48),
    descFontPx: numOrMigrated(s.descFontPx, 12, 15, 8, 48),
    titleWeight: numOrMigrated(s.titleWeight, 700, 600, 100, 900),
    titleItalic: boolOr(s.titleItalic, false),
    titleColor: colorOrMigrated(s.titleColor, "#0f172a", "#041A59"),
    timeWeight: numOrMigrated(s.timeWeight, 400, 600, 100, 900),
    timeItalic: boolOr(s.timeItalic, false),
    timeColor: colorOrMigrated(s.timeColor, "#64748b", "#CA0734"),
    formatWeight: clampWeight(s.formatWeight, 400),
    formatItalic: boolOr(s.formatItalic, false),
    formatColor: colorOrMigrated(s.formatColor, "#64748b", "#000000"),
    placeWeight: numOrMigrated(s.placeWeight, 400, 600, 100, 900),
    placeItalic: boolOr(s.placeItalic, false),
    placeColor: colorOrMigrated(s.placeColor, "#64748b", "#51226B"),
    descWeight: clampWeight(s.descWeight, 400),
    descItalic: boolOr(s.descItalic, false),
    descColor: colorOrMigrated(s.descColor, "#0f172a", "#000000"),
    teamLeadFontPx: clampNum(s.teamLeadFontPx, 11, 8, 48),
    teamLeadColor: strOr(s.teamLeadColor, "#475569"),
    teamLeadWeight: clampWeight(s.teamLeadWeight, 500),
    teamLeadItalic: boolOr(s.teamLeadItalic, false),
    responsiblesFontPx: clampNum(s.responsiblesFontPx, 11, 8, 48),
    responsiblesColor: strOr(s.responsiblesColor, "#475569"),
    responsiblesWeight: clampWeight(s.responsiblesWeight, 500),
    responsiblesItalic: boolOr(s.responsiblesItalic, false),
    vksFontPx: clampNum(s.vksFontPx, 11, 8, 48),
    vksColor: strOr(s.vksColor, "#475569"),
    vksWeight: clampWeight(s.vksWeight, 500),
    vksItalic: boolOr(s.vksItalic, false),
    translationFontPx: clampNum(s.translationFontPx, 11, 8, 48),
    translationColor: strOr(s.translationColor, "#475569"),
    translationWeight: clampWeight(s.translationWeight, 500),
    translationItalic: boolOr(s.translationItalic, false),
    interpretationFontPx: clampNum(s.interpretationFontPx, 11, 8, 48),
    interpretationColor: strOr(s.interpretationColor, "#475569"),
    interpretationWeight: clampWeight(s.interpretationWeight, 500),
    interpretationItalic: boolOr(s.interpretationItalic, false),
    volunteersFontPx: clampNum(s.volunteersFontPx, 11, 8, 48),
    volunteersColor: strOr(s.volunteersColor, "#475569"),
    volunteersWeight: clampWeight(s.volunteersWeight, 500),
    volunteersItalic: boolOr(s.volunteersItalic, false),
    markFontPx: clampNum(s.markFontPx, 11, 8, 48),
    markColor: strOr(s.markColor, "#64748b"),
    markLineColor: strOr(s.markLineColor, "#cbd5e1"),
    tileBg,
    tileBorder,
    fieldBg,
    eventLinkTarget: s.eventLinkTarget === "_self" ? "_self" : "_blank"
  };
}

function typeInline(sizePx: number, weight: number, italic: boolean, color: string) {
  return `font-size:${sizePx}px;font-weight:${weight};font-style:${italic ? "italic" : "normal"};color:${esc(color)}`;
}

function extraTypeInline(theme: ResolvedSnippetStyle, kind: string) {
  if (kind === "teamLead") return typeInline(theme.teamLeadFontPx, theme.teamLeadWeight, theme.teamLeadItalic, theme.teamLeadColor);
  if (kind === "responsibles") return typeInline(theme.responsiblesFontPx, theme.responsiblesWeight, theme.responsiblesItalic, theme.responsiblesColor);
  if (kind === "vks") return typeInline(theme.vksFontPx, theme.vksWeight, theme.vksItalic, theme.vksColor);
  if (kind === "translation") return typeInline(theme.translationFontPx, theme.translationWeight, theme.translationItalic, theme.translationColor);
  if (kind === "interpretation") return typeInline(theme.interpretationFontPx, theme.interpretationWeight, theme.interpretationItalic, theme.interpretationColor);
  if (kind === "volunteers") return typeInline(theme.volunteersFontPx, theme.volunteersWeight, theme.volunteersItalic, theme.volunteersColor);
  return typeInline(theme.timeFontPx, theme.timeWeight, theme.timeItalic, theme.timeColor);
}

function extraFieldLines(ev: IsoEvent): Array<{ kind: string; text: string }> {
  const responsibles = [
    ev.responsible1,
    ev.responsible2,
    ev.responsible3,
    ev.responsible4,
    ev.responsible5,
    ev.responsible6
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  const lines: Array<{ kind: string; text: string }> = [];
  const teamLead = (ev.teamLead ?? "").trim();
  if (teamLead) lines.push({ kind: "teamLead", text: teamLead });
  if (responsibles.length) lines.push({ kind: "responsibles", text: `Ответственные: ${responsibles.join(", ")}` });
  if (typeof ev.volunteersCount === "number" && Number.isFinite(ev.volunteersCount)) {
    lines.push({ kind: "volunteers", text: `Волонтеры: ${ev.volunteersCount}` });
  }
  if (ev.vks === "Да") lines.push({ kind: "vks", text: "ВКС" });
  if (ev.translation === "Да") lines.push({ kind: "translation", text: "Трансляция" });
  if (ev.simultaneousInterpretation === "Да") lines.push({ kind: "interpretation", text: "Перевод" });
  return lines;
}

function safeScopeId(s: string) {
  const cleaned = String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "sb";
}

function hashShort(s: string) {
  // stable small hash for CSS attribute scoping (not security-relevant)
  let h = 5381;
  const str = String(s ?? "");
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36).slice(0, 6);
}

function dayKeyFromDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatTime(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTimeRange(start: Date, end: Date) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function placeLabel(building?: unknown, room?: unknown) {
  return formatPlaceLabel(building, room);
}

function renderHighlightedLineHtml(line: string) {
  const parts = highlightPlaceInLine(line);
  if (!parts.length) return esc(line);
  return parts
    .map((p, i) => {
      if (p.kind === "place") {
        const gap = i > 0 ? " " : "";
        return `${gap}<span class="sb-placeMark">${esc(p.text)}</span>`;
      }
      return esc(p.text);
    })
    .join("");
}

function emphasizePlaceHtml(escaped: string) {
  return escaped.replace(/(Корп\.\s*[^<]+)/g, '<span class="sb-placeMark">$1</span>');
}

function dateFrom(v: unknown): Date | null {
  const d = v instanceof Date ? v : new Date(String(v ?? ""));
  return Number.isFinite(d.getTime()) ? d : null;
}

function renderGroupedItemsHtml(items: GroupedListItem[], linkTarget: string): string {
  const lis = items
    .map((item) => {
      const title = esc(item.title);
      const evUrl = normalizeEventLink(item.url);
      let titleHtml = title;
      if (evUrl) {
        const tTarget = resolveEventLinkTarget(evUrl, linkTarget);
        const tAttr = tTarget === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
        const popupBody = meaningfulText(item.popup) || "";
        const ourPopup = evUrl.startsWith("#popup:sb");
        const cta = resolvePopupButton(item.popupButtonText, item.popupButtonUrl);
        const startD = dateFrom(item.start);
        const endD = dateFrom(item.end);
        const timeLabel = startD && endD ? formatTimeRange(startD, endD) : "";
        const popupAttrs = ourPopup
          ? ` data-sb-popup="1" data-sb-time="${escAttr(timeLabel)}" data-sb-place="${escAttr(item.place)}" data-sb-format="" data-sb-body="${escAttr(renderMarkdownLiteHtml(popupBody))}" data-sb-btn="${escAttr(cta?.text ?? "")}" data-sb-btn-href="${escAttr(cta?.href ?? "")}"`
          : "";
        titleHtml = `<a class="sb-item-link" href="${esc(evUrl)}"${tAttr}${popupAttrs}>${title}</a>`;
      }
      const place = item.place ? ` <span class="sb-placeMark">(${esc(item.place)})</span>` : "";
      const time = item.extraTime ? ` · ${esc(item.extraTime)}` : "";
      return `<li><span class="sb-bullet">•</span><span>${titleHtml}${place}${time}</span></li>`;
    })
    .join("");
  return `<ul class="sb-list">${lis}</ul>`;
}

function renderCardBodyHtml(desc: string) {
  return emphasizePlaceHtml(renderMarkdownLiteHtml(desc));
}

function normToken(v: unknown): string {
  if (v == null) return "";
  const t = String(v).replace(/\s+/g, " ").trim();
  if (!t || t === "-" || t === "—") return "";
  return t;
}

function normalizeResponsible(v: unknown): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (s === "-" || s === "—") return "";
  return s;
}

function applyExportViewFilter(events: IsoEvent[], view?: string | null): IsoEvent[] {
  if (view === "vks") return events.filter((e) => (e.visible ?? true) && e.vks === "Да");
  if (view === "broadcasts") return events.filter((e) => (e.visible ?? true) && e.translation === "Да");
  if (view === "interpretation") return events.filter((e) => (e.visible ?? true) && e.simultaneousInterpretation === "Да");
  if (view === "volunteers") {
    return events.filter((e) => (e.visible ?? true) && typeof e.volunteersCount === "number" && Number.isFinite(e.volunteersCount) && e.volunteersCount > 0);
  }
  if (view === "responsibles") {
    return events.filter(
      (e) =>
        (e.visible ?? true) &&
        [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
          .map((x) => normalizeResponsible(x))
          .filter(Boolean).length > 0
    );
  }
  if (view === "rooms") return events.filter((e) => (e.visible ?? true) && normToken(e.room));
  return events.filter(
    (e) => (e.visible ?? true) && !(isArchitectureProgramView(view) && isTechScheduleOnlyFormat(e.format))
  );
}

function roomKeyFrom(building: unknown, room: unknown): string {
  const b = normToken(building);
  const r = normToken(room);
  if (!r) return "";
  return `${b}||${r}`;
}

function roomLabelFromKey(key: string): string {
  const [bRaw, rRaw] = key.split("||");
  const b = normToken(bRaw);
  const r = normToken(rRaw);
  return b ? `${b} · ${r}` : r || "Не указано";
}

function roomShortLabel(entry: RoomEntry): string {
  return normToken(entry.room) || "Не указано";
}

function formatDayHuman(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return dayKey;
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(d);
}

function buildRoomsEntries(events: IsoEvent[], selectedDayKeys: Set<string>): RoomEntry[] {
  const byRoom = new Map<string, RoomEntry>();
  for (const ev of events) {
    if (!(ev.visible ?? true)) continue;
    const key = roomKeyFrom(ev.building, ev.room);
    if (!key) continue;
    const dayKey = (ev.kind ?? "timed") === "untimed" ? String(ev.day ?? "").slice(0, 10) : String(ev.start ?? "").slice(0, 10);
    if (!dayKey || !selectedDayKeys.has(dayKey)) continue;

    const [bRaw, rRaw] = key.split("||");
    const entry =
      byRoom.get(key) ??
      ({
        key,
        label: roomLabelFromKey(key),
        building: normToken(bRaw),
        room: normToken(rRaw),
        timed: [],
        untimed: []
      } satisfies RoomEntry);

    if ((ev.kind ?? "timed") === "timed" && ev.start && ev.end) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start) {
        entry.timed.push({
          id: String(ev.id ?? `${dayKey}-${start.toISOString()}`),
          title: String(ev.title ?? "Без названия"),
          start,
          end,
          dayKey,
          raw: ev
        });
      }
    } else if ((ev.kind ?? "timed") === "untimed") {
      entry.untimed.push({
        id: String(ev.id ?? `${dayKey}-untimed`),
        title: String(ev.title ?? "Без названия"),
        dayKey,
        orderNo: typeof ev.orderNo === "number" && Number.isFinite(ev.orderNo) ? ev.orderNo : undefined,
        raw: ev
      });
    }

    byRoom.set(key, entry);
  }

  const out = Array.from(byRoom.values());
  for (const room of out) {
    room.timed.sort((a, b) => a.start.getTime() - b.start.getTime());
    room.untimed.sort((a, b) => {
      const byDay = a.dayKey.localeCompare(b.dayKey);
      if (byDay !== 0) return byDay;
      return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
    });
  }
  out.sort((a, b) => {
    const byBuilding = a.building.localeCompare(b.building, "ru-RU");
    if (byBuilding !== 0) return byBuilding;
    return a.room.localeCompare(b.room, "ru-RU");
  });
  return out;
}

function groupRoomsByBuilding(entries: RoomEntry[]): RoomBuildingGroup[] {
  const map = new Map<string, RoomEntry[]>();
  for (const entry of entries) {
    const key = entry.building || "__no_building__";
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  const groups: RoomBuildingGroup[] = Array.from(map.entries()).map(([building, rooms]) => ({
    building,
    label: building === "__no_building__" ? "Здание не указано" : building,
    rooms: [...rooms].sort((a, b) => a.room.localeCompare(b.room, "ru-RU"))
  }));
  groups.sort((a, b) => a.label.localeCompare(b.label, "ru-RU"));
  return groups;
}

function eventDetails(raw: IsoEvent): string[] {
  const responsibles = [raw.responsible1, raw.responsible2, raw.responsible3, raw.responsible4, raw.responsible5, raw.responsible6]
    .map((x) => normToken(x))
    .filter(Boolean);
  const lines: string[] = [];
  const format = normToken(raw.format);
  if (format) lines.push(`Формат: ${format}`);
  const teamLead = normToken(raw.teamLead);
  if (teamLead) lines.push(`Тимлид: ${teamLead}`);
  if (responsibles.length) lines.push(`Ответственные: ${responsibles.join(", ")}`);
  const vks = normToken(raw.vks);
  if (vks) lines.push(`ВКС: ${vks}`);
  const tr = normToken(raw.translation);
  if (tr) lines.push(`Трансляция: ${tr}`);
  const intr = normToken(raw.simultaneousInterpretation);
  if (intr) lines.push(`Перевод: ${intr}`);
  if (typeof raw.volunteersCount === "number" && Number.isFinite(raw.volunteersCount)) {
    lines.push(`Волонтеры: ${raw.volunteersCount}`);
  }
  const photos = normToken(raw.photosFromResponsible);
  if (photos) lines.push(`Фотографии от ответственного: ${photos}`);
  const banner = normToken(raw.banner);
  if (banner) lines.push(`Баннер: ${banner}`);
  const support = normToken(raw.supportMaterials);
  if (support) lines.push(`Сопроводительные материалы: ${support}`);
  const announce = normToken(raw.description_md ?? raw.announcement);
  if (announce) lines.push(`Анонс: ${announce}`);
  const desc = normToken(raw.description);
  if (desc) lines.push(`Описание: ${desc}`);
  return lines;
}

function listEventDetails(raw: IsoEvent, view: "responsibles" | "vks" | "broadcasts" | "interpretation" | "volunteers"): string[] {
  if (view === "responsibles") return eventDetails(raw);
  if (view === "volunteers") {
    return typeof raw.volunteersCount === "number" && Number.isFinite(raw.volunteersCount)
      ? [`Волонтеры: ${raw.volunteersCount}`]
      : [];
  }
  const lines: string[] = [];
  const fmt = normToken(raw.format);
  if (fmt) lines.push(`Формат: ${fmt}`);
  const place = formatPlaceLabel(raw.building, raw.room);
  if (place) lines.push(`Место: ${place}`);
  if (view === "vks") lines.push("ВКС: Да");
  if (view === "broadcasts") lines.push("Трансляция: Да");
  if (view === "interpretation") lines.push("Перевод: Да");
  return lines;
}

export function buildTildaSnippet(args: {
  projectName: string;
  events: IsoEvent[];
  marksByDay: Record<string, string[]>;
  timelineLayout: TimelineLayout | null;
  timelineStyle?: SnippetStyleIn;
  scopeSelector?: string | null; // e.g. "#rec123456"
  onlyDayKey?: string | null; // YYYY-MM-DD (optional)
  view?: string | null;
  roomsMode?: "occupancy" | "events";
  responsibleFilter?: string | null;
  /** Default: inherit site fonts. `tilda-sans` forces Tilda Sans for layout checks. */
  fontMode?: "inherit" | "tilda-sans";
  /** Multiply Architecture type sizes (print uses ~0.6 so a day can fit A4). */
  fontScale?: number;
}) {
  const { projectName, events, timelineLayout, timelineStyle, scopeSelector, onlyDayKey, fontMode, view, roomsMode, responsibleFilter } = args;
  const fontScaleRaw = Number(args.fontScale);
  const fontScale =
    Number.isFinite(fontScaleRaw) && fontScaleRaw > 0 ? Math.max(0.4, Math.min(1.2, fontScaleRaw)) : 1;
  const theme = scaleThemeType(resolveSnippetStyle(timelineStyle), fontScale);
  const space = fontScale;
  const programGapPx = Math.max(6, Math.round(20 * space));
  const tilePadPx = Math.max(8, Math.round(32 * space));
  const ruleMarginPx = Math.max(6, Math.round(14 * space));
  const formatTopPx = Math.max(4, Math.round(10 * space));
  const formatBottomPx = Math.max(2, Math.round(10 * space));
  const titleTopPx = Math.max(2, Math.round(10 * space));
  const isTechView = String(view ?? "").trim() === "tech-schedule";
  const filteredEvents = applyExportViewFilter(events, view);

  const scope = (scopeSelector ?? "").trim();
  const sc = scope ? `${scope} ` : "";

  // Internal scoping to avoid CSS collisions when multiple snippets are placed on one Tilda page.
  // (e.g. 4 T123 blocks for 4 different days)
  const internalScopeId = safeScopeId(
    `sb-${onlyDayKey ? onlyDayKey : "all"}-${hashShort(projectName)}`
  );
  const rootSel = `${sc}.sb-wrap[data-sb-scope="${internalScopeId}"]`;

  if (view === "rooms") {
    const timedForDays = filteredEvents
      .filter((e) => (e.kind ?? "timed") === "timed" && e.start && e.end)
      .map((e) => ({ ...e, startD: new Date(e.start!), endD: new Date(e.end!) }))
      .filter((e) => Number.isFinite(e.startD.getTime()) && Number.isFinite(e.endD.getTime()) && e.endD > e.startD);

    const hiddenDay = new Set(
      (timelineLayout?.hidden_day_keys ?? [])
        .map((k) => String(k).slice(0, 10))
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    );
    const allDayKeys = Array.from(
      new Set([
        ...timedForDays.map((e) => dayKeyFromDate(e.startD)),
        ...filteredEvents
          .filter((e) => (e.kind ?? "timed") === "untimed" && e.day)
          .map((e) => String(e.day).slice(0, 10))
      ])
    )
      .sort()
      .filter((d) => !hiddenDay.has(d));
    const selectedDayKeys = new Set(onlyDayKey ? allDayKeys.filter((d) => d === onlyDayKey) : allDayKeys);
    const entries = buildRoomsEntries(filteredEvents, selectedDayKeys);
    const groups = groupRoomsByBuilding(entries);
    const mode = roomsMode === "events" ? "events" : "occupancy";

    const css = `
/* Tilda snippet: ${esc(projectName)} rooms export */
${rootSel}{
  --sb-text:${esc(theme.titleColor)};
  --sb-muted:${esc(theme.timeColor)};
  --sb-border:${esc(theme.markLineColor)};
  --sb-card-bg:#fff;
  ${fontMode === "tilda-sans" ? `font-family:"Tilda Sans",system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;` : `/* font: inherit from Tilda page */`}
  color:var(--sb-text);
}
${rootSel} .sb-title{font-size:${theme.titleFontPx + 7}px !important;line-height:1.2;font-weight:${theme.titleWeight} !important;font-style:${theme.titleItalic ? "italic" : "normal"} !important;color:${esc(theme.titleColor)} !important;margin:0 0 10px}
${rootSel} .sb-meta{font-size:${theme.timeFontPx + 2}px;color:${esc(theme.timeColor)} !important;margin:0 0 14px}
${rootSel} .sb-rooms{display:grid;gap:10px}
${rootSel} .sb-building{border:1px solid var(--sb-border);border-radius:12px;background:var(--sb-card-bg);padding:10px}
${rootSel} .sb-building-head{font-size:${theme.titleFontPx + 3}px !important;line-height:1.3;font-weight:${theme.titleWeight} !important;font-style:${theme.titleItalic ? "italic" : "normal"} !important;color:${esc(theme.titleColor)} !important;margin-bottom:2px}
${rootSel} .sb-building-meta{font-size:${theme.placeFontPx}px;line-height:1.3;color:${esc(theme.placeColor)} !important;margin-bottom:8px}
${rootSel} .sb-room{border:1px solid var(--sb-border);border-radius:12px;background:var(--sb-card-bg);padding:10px}
${rootSel} .sb-room-head{font-size:${theme.titleFontPx + 2}px !important;line-height:1.3;font-weight:${theme.titleWeight} !important;font-style:${theme.titleItalic ? "italic" : "normal"} !important;color:${esc(theme.titleColor)} !important}
${rootSel} .sb-lines{display:grid;gap:4px;margin-top:6px}
${rootSel} .sb-line{font-size:${theme.timeFontPx}px !important;line-height:1.35;font-weight:${theme.timeWeight} !important;font-style:${theme.timeItalic ? "italic" : "normal"} !important;color:${esc(theme.timeColor)} !important}
${rootSel} .sb-day{font-weight:${theme.titleWeight} !important;color:${esc(theme.titleColor)} !important}
`.trim();

    let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;
    html += `<h2 class="sb-title" style="${typeInline(theme.titleFontPx + 7, theme.titleWeight, theme.titleItalic, theme.titleColor)}">Аудитории</h2>\n`;
    html += `<div class="sb-meta">Вид: ${mode === "occupancy" ? "перечень аудиторий с временем занятости" : "перечень аудиторий со списками мероприятий"}. Период: ${
      onlyDayKey ? esc(formatDayHuman(onlyDayKey)) : "Все дни"
    }.</div>\n`;

    if (!groups.length) {
      html += `<div class="sb-line">Нет данных по аудиториям для выбранного периода.</div>\n`;
      html += `</div>`;
      return { html, css };
    }

    html += `<div class="sb-rooms">\n`;
    for (const group of groups) {
      html += `<div class="sb-building">\n`;
      html += `<div class="sb-building-head" style="${typeInline(theme.titleFontPx + 3, theme.titleWeight, theme.titleItalic, theme.titleColor)}">${esc(group.label)}</div>\n`;
      html += `<div class="sb-building-meta">${group.rooms.length} аудиторий</div>\n`;
      for (const entry of group.rooms) {
        html += `<div class="sb-room">\n`;
        html += `<div class="sb-room-head" style="${typeInline(theme.titleFontPx + 2, theme.titleWeight, theme.titleItalic, theme.titleColor)}">${esc(roomShortLabel(entry))}</div>\n`;

        if (mode === "occupancy") {
          const grouped = new Map<string, string[]>();
          for (const t of entry.timed) {
            const arr = grouped.get(t.dayKey) ?? [];
            arr.push(`${formatTime(t.start)}-${formatTime(t.end)}`);
            grouped.set(t.dayKey, arr);
          }
          const untimedCount = entry.untimed.length;
          if (grouped.size === 0) {
            html += `<div class="sb-lines"><div class="sb-line">Нет мероприятий с указанным временем.</div></div>\n`;
          } else {
            html += `<div class="sb-lines">\n`;
            const isSingleDay = selectedDayKeys.size === 1;
            for (const dk of Array.from(grouped.keys()).sort()) {
              const items = grouped.get(dk)!;
              const sortedTimed = [...(entry.timed.filter((t) => t.dayKey === dk))].sort((a, b) => a.start.getTime() - b.start.getTime());
              const first = sortedTimed[0];
              const last = sortedTimed[sortedTimed.length - 1];
              html += `<div class="sb-line">${isSingleDay ? "" : `<span class="sb-day">${esc(formatDayHuman(dk))}. </span>`}Количество мероприятий: ${items.length}${
                first && last ? ` · Старт мероприятий: ${esc(formatTime(first.start))} · Окончание мероприятий: ${esc(formatTime(last.end))}` : ""
              }</div>\n`;
              for (const ev of sortedTimed) {
                html += `<div class="sb-line">${esc(formatTime(ev.start))}-${esc(formatTime(ev.end))} - ${esc(ev.title)}</div>\n`;
              }
            }
            html += `</div>\n`;
          }
          if (untimedCount > 0) {
            html += `<div class="sb-line">Дополнительно: ${untimedCount} мероприят(ий) без указанного времени.</div>\n`;
          }
        } else {
          const grouped = new Map<string, Array<RoomTimedEvent | RoomUntimedEvent>>();
          for (const t of entry.timed) {
            const arr = grouped.get(t.dayKey) ?? [];
            arr.push(t);
            grouped.set(t.dayKey, arr);
          }
          for (const u of entry.untimed) {
            const arr = grouped.get(u.dayKey) ?? [];
            arr.push(u);
            grouped.set(u.dayKey, arr);
          }
          if (grouped.size === 0) {
            html += `<div class="sb-lines"><div class="sb-line">Нет событий в выбранном периоде.</div></div>\n`;
          } else {
            html += `<div class="sb-lines">\n`;
            for (const dk of Array.from(grouped.keys()).sort()) {
              const list = grouped.get(dk) ?? [];
              const ordered = [...list].sort((a, b) => {
                const aIsTimed = "start" in a;
                const bIsTimed = "start" in b;
                if (aIsTimed && bIsTimed) return a.start.getTime() - b.start.getTime();
                if (aIsTimed) return -1;
                if (bIsTimed) return 1;
                return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
              });
              const timedOnly = ordered.filter((x): x is RoomTimedEvent => "start" in x);
              const first = timedOnly[0];
              const last = timedOnly[timedOnly.length - 1];
              const isSingleDay = selectedDayKeys.size === 1;
              html += `<div class="sb-line">${isSingleDay ? "" : `<span class="sb-day">${esc(formatDayHuman(dk))}. </span>`}Количество мероприятий: ${ordered.length}${
                first && last ? ` · Старт мероприятий: ${esc(formatTime(first.start))} · Окончание мероприятий: ${esc(formatTime(last.end))}` : ""
              }</div>\n`;
              for (const ev of ordered) {
                if ("start" in ev) {
                  html += `<div class="sb-line">${esc(formatTime(ev.start))}-${esc(formatTime(ev.end))} — ${esc(ev.title)}</div>\n`;
                  for (const line of eventDetails(ev.raw)) {
                    html += `<div class="sb-line">${esc(line)}</div>\n`;
                  }
                } else {
                  html += `<div class="sb-line">Без времени — ${esc(ev.title)}</div>\n`;
                  for (const line of eventDetails(ev.raw)) {
                    html += `<div class="sb-line">${esc(line)}</div>\n`;
                  }
                }
              }
            }
            html += `</div>\n`;
          }
        }

        html += `</div>\n`;
      }
      html += `</div>\n`;
    }
    html += `</div>\n`;
    html += `</div>`;

    return { html, css };
  }

  if (
    view === "responsibles" ||
    view === "vks" ||
    view === "broadcasts" ||
    view === "interpretation" ||
    view === "volunteers"
  ) {
    const listView = view;
    const respNorm = normalizeResponsible(responsibleFilter).toLocaleLowerCase("ru-RU");
    const listEvents = filteredEvents.filter((e) => {
      if (listView !== "responsibles" || !respNorm) return true;
      return [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
        .map((x) => normalizeResponsible(x).toLocaleLowerCase("ru-RU"))
        .some((x) => x === respNorm);
    });
    const hiddenDay = new Set(
      (timelineLayout?.hidden_day_keys ?? [])
        .map((k) => String(k).slice(0, 10))
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    );
    const dayKeys = Array.from(
      new Set(
        listEvents
          .map((e) => ((e.kind ?? "timed") === "untimed" ? String(e.day ?? "").slice(0, 10) : String(e.start ?? "").slice(0, 10)))
          .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
      )
    )
      .sort()
      .filter((d) => !hiddenDay.has(d));
    const selectedDayKeys = onlyDayKey ? dayKeys.filter((d) => d === onlyDayKey) : dayKeys;
    const daySet = new Set(selectedDayKeys);

    const normalized = listEvents
      .map((e, idx) => {
        const dayKey = (e.kind ?? "timed") === "untimed" ? String(e.day ?? "").slice(0, 10) : String(e.start ?? "").slice(0, 10);
        if (!daySet.has(dayKey)) return null;
        const start = e.start ? new Date(e.start) : undefined;
        const end = e.end ? new Date(e.end) : undefined;
        return {
          id: String(e.id ?? `${dayKey}-${idx}`),
          title: String(e.title ?? "Без названия"),
          dayKey,
          start: start && Number.isFinite(start.getTime()) ? start : undefined,
          end: end && Number.isFinite(end.getTime()) ? end : undefined,
          raw: e
        };
      })
      .filter(Boolean) as Array<{ id: string; title: string; dayKey: string; start?: Date; end?: Date; raw: IsoEvent }>;

    const listAccent =
      listView === "responsibles"
        ? { size: theme.responsiblesFontPx, weight: theme.responsiblesWeight, italic: theme.responsiblesItalic, color: theme.responsiblesColor }
        : listView === "vks"
          ? { size: theme.vksFontPx, weight: theme.vksWeight, italic: theme.vksItalic, color: theme.vksColor }
          : listView === "broadcasts"
            ? { size: theme.translationFontPx, weight: theme.translationWeight, italic: theme.translationItalic, color: theme.translationColor }
            : listView === "interpretation"
              ? { size: theme.interpretationFontPx, weight: theme.interpretationWeight, italic: theme.interpretationItalic, color: theme.interpretationColor }
              : { size: theme.volunteersFontPx, weight: theme.volunteersWeight, italic: theme.volunteersItalic, color: theme.volunteersColor };

    const css = `
/* Tilda snippet: ${esc(projectName)} list export */
${rootSel}{
  --sb-text:${esc(theme.titleColor)};
  --sb-muted:${esc(theme.timeColor)};
  --sb-border:${esc(theme.markLineColor)};
  --sb-card-bg:#fff;
  ${fontMode === "tilda-sans" ? `font-family:"Tilda Sans",system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;` : `/* font: inherit from Tilda page */`}
  color:var(--sb-text);
}
${rootSel} .sb-title{font-size:${theme.titleFontPx + 7}px !important;line-height:1.2;font-weight:${theme.titleWeight} !important;font-style:${theme.titleItalic ? "italic" : "normal"} !important;color:${esc(theme.titleColor)} !important;margin:0 0 10px}
${rootSel} .sb-meta{font-size:${theme.timeFontPx + 2}px;color:${esc(theme.timeColor)} !important;margin:0 0 12px}
${rootSel} .sb-days{display:grid;gap:10px}
${rootSel} .sb-day{border:1px solid var(--sb-border);border-radius:12px;background:var(--sb-card-bg);padding:10px}
${rootSel} .sb-head{font-size:${theme.timeFontPx}px !important;line-height:1.35;font-weight:${theme.titleWeight} !important;color:${esc(theme.titleColor)} !important}
${rootSel} .sb-lines{display:grid;gap:4px;margin-top:6px}
${rootSel} .sb-line{font-size:${listAccent.size}px !important;line-height:1.35;font-weight:${listAccent.weight} !important;font-style:${listAccent.italic ? "italic" : "normal"} !important;color:${esc(listAccent.color)} !important}
${rootSel} .sb-day-label{font-weight:${theme.titleWeight} !important;color:${esc(theme.titleColor)} !important}
`.trim();

    const viewLabel =
      listView === "responsibles"
        ? "Ответственные"
        : listView === "vks"
          ? "ВКС"
          : listView === "broadcasts"
            ? "Трансляции"
            : listView === "interpretation"
              ? "Перевод"
              : "Волонтеры";
    let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;
    html += `<h2 class="sb-title" style="${typeInline(theme.titleFontPx + 7, theme.titleWeight, theme.titleItalic, theme.titleColor)}">${esc(viewLabel)}</h2>\n`;
    html += `<div class="sb-meta">Период: ${onlyDayKey ? esc(formatDayHuman(onlyDayKey)) : "Все дни"}.</div>\n`;
    if (listView === "responsibles" && respNorm) {
      const label =
        [normalized[0]?.raw.responsible1, normalized[0]?.raw.responsible2, normalized[0]?.raw.responsible3, normalized[0]?.raw.responsible4, normalized[0]?.raw.responsible5, normalized[0]?.raw.responsible6]
          .map((x) => normalizeResponsible(x))
          .find((x) => x.toLocaleLowerCase("ru-RU") === respNorm) ?? responsibleFilter ?? "";
      if (label) html += `<div class="sb-meta">Ответственный: ${esc(label)}</div>\n`;
    }
    if (!normalized.length) {
      html += `<div class="sb-line">Нет данных для выбранного периода.</div>\n`;
      html += `</div>`;
      return { html, css };
    }

    const byDay = new Map<string, typeof normalized>();
    for (const ev of normalized) {
      const arr = byDay.get(ev.dayKey) ?? [];
      arr.push(ev);
      byDay.set(ev.dayKey, arr);
    }
    html += `<div class="sb-days">\n`;
    const isSingleDay = selectedDayKeys.length === 1;
    for (const dk of Array.from(byDay.keys()).sort()) {
      const items = (byDay.get(dk) ?? []).slice().sort((a, b) => {
        if (a.start && b.start) return a.start.getTime() - b.start.getTime();
        if (a.start) return -1;
        if (b.start) return 1;
        return a.title.localeCompare(b.title, "ru-RU");
      });
      const timedItems = items.filter((x) => x.start && x.end);
      const first = timedItems[0];
      const last = timedItems[timedItems.length - 1];
      html += `<div class="sb-day">\n`;
      html += `<div class="sb-head">${isSingleDay ? "" : `<span class="sb-day-label">${esc(formatDayHuman(dk))}. </span>`}Количество мероприятий: ${items.length}${
        first && last ? ` · Старт мероприятий: ${esc(formatTime(first.start!))} · Окончание мероприятий: ${esc(formatTime(last.end!))}` : ""
      }</div>\n`;
      html += `<div class="sb-lines">\n`;
      for (const ev of items) {
        html += `<div class="sb-line">${ev.start && ev.end ? `${esc(formatTime(ev.start))}-${esc(formatTime(ev.end))}` : "Без времени"} - ${esc(ev.title)}</div>\n`;
        for (const line of listEventDetails(ev.raw, listView)) {
          html += `<div class="sb-line">${esc(line)}</div>\n`;
        }
      }
      html += `</div>\n</div>\n`;
    }
    html += `</div>\n</div>`;
    return { html, css };
  }

  const fontStack =
    fontMode === "tilda-sans"
      ? `font-family:"Tilda Sans",Arial,sans-serif;`
      : `font-family:TildaSans,Arial,sans-serif;`;

  const css = `
/* Tilda snippet: ${esc(projectName)} */
${rootSel}{
  --sb-title:${esc(theme.titleColor)};
  --sb-time:${esc(theme.timeColor)};
  --sb-place:${esc(theme.placeColor)};
  --sb-format:${esc(theme.formatColor)};
  --sb-desc:${esc(theme.descColor)};
  ${fontStack}
  color:var(--sb-desc);
}
${rootSel} .sb-program{display:flex;flex-direction:column;gap:${programGapPx}px}
${rootSel} .sb-program + .sb-program{margin-top:${Math.max(6, Math.round(12 * space))}px}
${rootSel} .sb-slot{display:flex;align-items:stretch;gap:${programGapPx}px}
${rootSel} .sb-col{display:flex;flex-direction:column;gap:${programGapPx}px;min-width:0}
${rootSel} .sb-tile{min-width:0;box-sizing:border-box;padding:${tilePadPx}px;border-radius:10px;background:${PROGRAM_CARD_BG.default}}
${rootSel} .sb-tile--accent{background:${PROGRAM_CARD_BG.accent}}
${rootSel} .sb-tile--service{background:${PROGRAM_CARD_BG.service}}
${rootSel} .sb-tile--default{background:${PROGRAM_CARD_BG.default}}
${rootSel} .sb-session + .sb-session{margin-top:${Math.max(8, Math.round(18 * space))}px}
${rootSel} .sb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:${Math.max(6, Math.round(12 * space))}px;min-width:0}
${rootSel} .sb-time{flex:0 0 auto;font-size:${theme.timeFontPx}px;font-weight:${theme.timeWeight};font-style:${theme.timeItalic ? "italic" : "normal"};color:var(--sb-time);line-height:1.4}
${rootSel} .sb-place{flex:1 1 0;min-width:0;font-size:${theme.placeFontPx}px;font-weight:${theme.placeWeight};font-style:${theme.placeItalic ? "italic" : "normal"};color:var(--sb-place);text-align:right;line-height:1.4;white-space:pre-line;overflow-wrap:break-word}
${rootSel} .sb-format{margin-top:${formatTopPx}px;margin-bottom:${formatBottomPx}px;font-size:${theme.formatFontPx}px;font-weight:${theme.formatWeight};font-style:${theme.formatItalic ? "italic" : "normal"};color:var(--sb-format)}
${rootSel} .sb-title{display:block;margin-top:${titleTopPx}px;font-size:${theme.titleFontPx}px;font-weight:${theme.titleWeight};font-style:${theme.titleItalic ? "italic" : "normal"};color:var(--sb-title);line-height:1.35}
${rootSel} .sb-format + .sb-title{margin-top:0}
${rootSel} a.sb-title{display:block;color:inherit;text-decoration:none}
${rootSel} a.sb-title:hover{text-decoration:underline}
${rootSel} .sb-rule{margin:${ruleMarginPx}px 0;border:0;border-top:1px solid var(--sb-time)}
${rootSel} .sb-tile--accent .sb-rule{border-top-color:var(--sb-place)}
${rootSel} .sb-lead{margin:0 0 8px;font-size:${theme.descFontPx}px;font-weight:${theme.descWeight};font-style:${theme.descItalic ? "italic" : "normal"};color:var(--sb-desc);line-height:1.45}
${rootSel} .sb-desc{font-size:${theme.descFontPx}px;font-weight:${theme.descWeight};font-style:${theme.descItalic ? "italic" : "normal"};color:var(--sb-desc);line-height:1.45}
${rootSel} .sb-desc-gap{height:8px}
${rootSel} .sb-desc-gap--lg{height:24px}
${rootSel} .sb-desc strong,${rootSel} .sb-list strong,${rootSel} .sb-lead strong{font-weight:700}
${rootSel} .sb-desc em,${rootSel} .sb-list em,${rootSel} .sb-lead em{font-style:italic}
${rootSel} .sb-list{margin:0 0 8px;padding:0;list-style:none !important;font-size:${theme.descFontPx}px;line-height:1.45;color:var(--sb-desc)}
${rootSel} .sb-list li{display:flex;gap:.45em;align-items:baseline;margin:0 0 .4em;padding:0;list-style:none !important}
${rootSel} .sb-list .sb-bullet{flex:0 0 auto;font-weight:700;line-height:1}
${rootSel} .sb-list a.sb-item-link{color:var(--sb-title);font-weight:600;text-decoration:none}
${rootSel} .sb-list a.sb-item-link:hover{text-decoration:underline}
${rootSel} .sb-placeMark{color:var(--sb-place);font-weight:600}
${rootSel} .sb-extra{margin-top:4px;line-height:1.3}
${rootSel} .sb-extra--teamLead{font-size:${theme.teamLeadFontPx}px;font-weight:${theme.teamLeadWeight};font-style:${theme.teamLeadItalic ? "italic" : "normal"};color:${esc(theme.teamLeadColor)}}
${rootSel} .sb-extra--responsibles{font-size:${theme.responsiblesFontPx}px;font-weight:${theme.responsiblesWeight};font-style:${theme.responsiblesItalic ? "italic" : "normal"};color:${esc(theme.responsiblesColor)}}
${rootSel} .sb-extra--vks{font-size:${theme.vksFontPx}px;font-weight:${theme.vksWeight};font-style:${theme.vksItalic ? "italic" : "normal"};color:${esc(theme.vksColor)}}
${rootSel} .sb-extra--translation{font-size:${theme.translationFontPx}px;font-weight:${theme.translationWeight};font-style:${theme.translationItalic ? "italic" : "normal"};color:${esc(theme.translationColor)}}
${rootSel} .sb-extra--interpretation{font-size:${theme.interpretationFontPx}px;font-weight:${theme.interpretationWeight};font-style:${theme.interpretationItalic ? "italic" : "normal"};color:${esc(theme.interpretationColor)}}
${rootSel} .sb-extra--volunteers{font-size:${theme.volunteersFontPx}px;font-weight:${theme.volunteersWeight};font-style:${theme.volunteersItalic ? "italic" : "normal"};color:${esc(theme.volunteersColor)}}
@media (max-width: 768px){
  ${rootSel} .sb-slot{flex-direction:column;gap:${Math.max(8, Math.round(16 * space))}px}
  ${rootSel} .sb-col{flex:1 1 auto}
  ${rootSel} .sb-tile{padding:${tilePadPx}px;flex:1 1 auto}
}
@media print{
  ${rootSel} .sb-tile{break-inside:avoid}
  .sb-modal{display:none !important}
}
.sb-modal[data-sb-scope="${internalScopeId}"]{position:fixed;inset:0;z-index:10000000;display:flex;align-items:center;justify-content:flex-start;padding:24px 0;${fontStack}box-sizing:border-box}
.sb-modal[data-sb-scope="${internalScopeId}"][hidden]{display:none !important}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__backdrop{position:absolute;inset:0;background:rgba(${(hexToRgb(theme.titleColor) ?? { r: 4, g: 26, b: 89 }).r},${(hexToRgb(theme.titleColor) ?? { r: 4, g: 26, b: 89 }).g},${(hexToRgb(theme.titleColor) ?? { r: 4, g: 26, b: 89 }).b},.8)}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__panel{position:relative;z-index:1;width:auto;max-width:none;max-height:80vh;overflow:auto;background:#fff;border-radius:16px;padding:28px 28px 20px;box-shadow:0 16px 48px rgba(4,26,89,.25);box-sizing:border-box}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__x{position:absolute;top:8px;right:8px;width:44px;height:44px;border:0;background:transparent;color:${esc(theme.titleColor)};font-size:28px;line-height:1;cursor:pointer;padding:0}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__meta{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding-right:40px;min-width:0}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__time{flex:0 0 auto;color:${esc(theme.timeColor)};font-weight:${theme.timeWeight};font-size:${theme.timeFontPx}px}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__place{flex:1 1 0;min-width:0;color:${esc(theme.placeColor)};font-weight:${theme.placeWeight};font-size:${theme.placeFontPx}px;text-align:right;white-space:pre-line;overflow-wrap:break-word}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__format{margin-top:10px;margin-bottom:10px;color:${esc(theme.formatColor)};font-size:${theme.formatFontPx}px}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__title{margin-top:10px;color:${esc(theme.titleColor)};font-size:${theme.titleFontPx + 6}px;font-weight:${theme.titleWeight};line-height:1.3}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body{margin-top:16px;padding-top:16px;border-top:1px solid ${esc(theme.timeColor)};color:${esc(theme.descColor)};font-size:${theme.descFontPx + 1}px;line-height:1.5}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-desc{margin:0 0 8px;font-size:inherit;color:inherit}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-desc-gap{height:8px}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-desc-gap--lg{height:24px}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-list{margin:0 0 8px;padding:0;list-style:none !important}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-list li{display:flex;gap:.45em;align-items:baseline;margin:0 0 .4em;padding:0;list-style:none !important}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body .sb-list .sb-bullet{flex:0 0 auto;font-weight:700;line-height:1}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body strong{font-weight:700}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__body em{font-style:italic}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__foot{margin-top:24px;display:flex;justify-content:flex-end}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__foot[hidden]{display:none !important}
.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn,.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn:link,.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn:visited,.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn:hover,.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn:focus,.sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn:active{appearance:none;border:0;cursor:pointer;background:#ca0734 !important;color:#fff !important;font:inherit;font-weight:600;font-size:16px;padding:12px 28px;border-radius:10px;text-decoration:none !important;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
@media (max-width:768px){
  .sb-modal[data-sb-scope="${internalScopeId}"]{padding:12px;align-items:flex-end;justify-content:center}
  .sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__panel{width:100%;max-width:none;max-height:90vh;border-radius:16px 16px 0 0;padding:24px 20px 16px;margin-left:0}
  .sb-modal[data-sb-scope="${internalScopeId}"] .sb-modal__btn{width:100%}
}
`.trim();

  const linkTarget = theme.eventLinkTarget;

  function renderSession(ev: any, startD: Date, endD: Date) {
    const place = placeLabel(ev.building, ev.room);
    const fmt = shouldShowFormat(ev.format) ? String(ev.format).trim() : "";
    const desc = publicCardDescription(ev);
    const extras = isTechView ? extraFieldLines(ev) : [];
    const groupedItems = Array.isArray(ev.groupedItems) ? (ev.groupedItems as GroupedListItem[]) : [];
    const hasBody = !!(desc || extras.length || groupedItems.length);
    const evUrl = normalizeEventLink(ev.url);
    const titleStyle = typeInline(theme.titleFontPx, theme.titleWeight, theme.titleItalic, theme.titleColor);
    let inner = `<div class="sb-head"><div class="sb-time">${esc(formatTimeRange(startD, endD))}</div>`;
    if (place) inner += `<div class="sb-place">${esc(place)}</div>`;
    inner += `</div>\n`;
    if (fmt) inner += `<div class="sb-format">${esc(fmt)}</div>\n`;
    if (evUrl) {
      const tTarget = resolveEventLinkTarget(evUrl, linkTarget);
      const tAttr = tTarget === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
      const popupBody = meaningfulText(ev.popup) || composePopupText(ev.speakers, ev.description) || "";
      const ourPopup = evUrl.startsWith("#popup:sb");
      const cta = resolvePopupButton(ev.popupButtonText, ev.popupButtonUrl);
      const popupAttrs = ourPopup
        ? ` data-sb-popup="1" data-sb-time="${escAttr(formatTimeRange(startD, endD))}" data-sb-place="${escAttr(place)}" data-sb-format="${escAttr(fmt)}" data-sb-body="${escAttr(renderMarkdownLiteHtml(popupBody))}" data-sb-btn="${escAttr(cta?.text ?? "")}" data-sb-btn-href="${escAttr(cta?.href ?? "")}"`
        : "";
      inner += `<a class="sb-title" href="${esc(evUrl)}"${tAttr}${popupAttrs} style="${titleStyle}">${esc(ev.title)}</a>\n`;
    } else {
      inner += `<div class="sb-title" style="${titleStyle}">${esc(ev.title)}</div>\n`;
    }
    if (hasBody) inner += `<hr class="sb-rule"/>\n`;
    const lead = groupedCardIntro(ev.id);
    if (lead && (desc || groupedItems.length)) {
      inner += `<div class="sb-lead">${esc(lead)}</div>\n`;
    }
    if (groupedItems.length) inner += `${renderGroupedItemsHtml(groupedItems, linkTarget)}\n`;
    else if (desc) inner += `${renderCardBodyHtml(desc)}\n`;
    if (extras.length) {
      for (const line of extras) {
        inner += `<div class="sb-extra sb-extra--${esc(line.kind)}" style="${extraTypeInline(theme, line.kind)}">${esc(line.text)}</div>\n`;
      }
    }
    return `<div class="sb-session">${inner}</div>`;
  }

  let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;

  const laidOut = layoutProgramDays({
    events: filteredEvents,
    timelineLayout,
    view,
    onlyDayKey
  });
  for (const { slots } of laidOut) {
    if (!slots.length) continue;
    html += `<div class="sb-program">\n`;
    for (const cols of slots) {
      html += `<div class="sb-slot">\n`;
      for (const col of cols) {
        const stacked = col.length > 1;
        const span = Math.max(1, ...col.map((b) => b.colSpan || 1));
        html += `<div class="sb-col" style="flex:${span} 1 0">\n`;
        for (const box of col) {
          const tone = programCardTone(box.ev);
          const so = (box.ev.style_override ?? {}) as any;
          const bg =
            (so.eventBgColor ? rgbaFrom(String(so.eventBgColor), Number(so.eventBgAlpha ?? 1)) : null) ?? PROGRAM_CARD_BG[tone];
          const mins = Math.max(1, Math.round((box.endD.getTime() - box.startD.getTime()) / 60000));
          const tileFlex = stacked ? `${mins} 1 0` : "1 1 auto";
          html += `<div class="sb-tile sb-tile--${esc(tone)}" style="background:${esc(bg)};flex:${tileFlex}">\n`;
          html += renderSession(box.ev, box.startD, box.endD);
          html += `</div>\n`;
        }
        html += `</div>\n`;
      }
      html += `</div>\n`;
    }
    html += `</div>\n`;
  }

  html += `</div>
<script>
(function(){
  var SCOPE=${JSON.stringify(internalScopeId)};
  var modal=null;
  function el(n){ return n && n.nodeType===1 ? n : (n && n.parentElement); }
  function ensure(){
    if(modal) return modal;
    modal=document.createElement("div");
    modal.className="sb-modal";
    modal.setAttribute("data-sb-scope",SCOPE);
    modal.hidden=true;
    modal.innerHTML='<div class="sb-modal__backdrop" data-sb-close="1"></div><div class="sb-modal__panel" role="dialog" aria-modal="true"><button type="button" class="sb-modal__x" data-sb-close="1" aria-label="Закрыть">×</button><div class="sb-modal__meta"><span class="sb-modal__time"></span><span class="sb-modal__place"></span></div><div class="sb-modal__format"></div><div class="sb-modal__title"></div><div class="sb-modal__body"></div><div class="sb-modal__foot" hidden><a class="sb-modal__btn" target="_blank" rel="noopener noreferrer"></a></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click",function(e){
      var t=el(e.target);
      if(t && t.closest && t.closest("[data-sb-close]")) close();
    });
    return modal;
  }
  function isNarrow(){
    return window.matchMedia && window.matchMedia("(max-width:768px)").matches;
  }
  function alignPanel(){
    if(!modal) return;
    var panel=modal.querySelector(".sb-modal__panel");
    if(!panel) return;
    if(isNarrow()){
      panel.style.width="";
      panel.style.maxWidth="";
      panel.style.marginLeft="";
      return;
    }
    var wrap=document.querySelector('.sb-wrap[data-sb-scope="'+SCOPE+'"]');
    var vw=document.documentElement.clientWidth||window.innerWidth;
    var r=wrap?wrap.getBoundingClientRect():null;
    var w=r&&r.width>0?Math.round(r.width):Math.max(560,vw-48);
    var left=r?Math.round(r.left):Math.round((vw-w)/2);
    if(left<12) left=12;
    if(left+w>vw-12) w=Math.max(280,vw-12-left);
    panel.style.width=w+"px";
    panel.style.maxWidth=w+"px";
    panel.style.marginLeft=left+"px";
  }
  function close(){
    if(!modal) return;
    modal.hidden=true;
    document.body.style.overflow="";
  }
  function openFrom(a){
    var m=ensure();
    m.querySelector(".sb-modal__title").textContent=(a.textContent||"").replace(/\\s+/g," ").trim();
    m.querySelector(".sb-modal__time").textContent=a.getAttribute("data-sb-time")||"";
    m.querySelector(".sb-modal__place").textContent=a.getAttribute("data-sb-place")||"";
    var fmt=a.getAttribute("data-sb-format")||"";
    var fEl=m.querySelector(".sb-modal__format");
    var tEl=m.querySelector(".sb-modal__title");
    fEl.textContent=fmt;
    fEl.style.display=fmt?"":"none";
    tEl.style.marginTop=fmt?"0":"";
    m.querySelector(".sb-modal__body").innerHTML=a.getAttribute("data-sb-body")||"";
    var btnText=a.getAttribute("data-sb-btn")||"";
    var btnHref=a.getAttribute("data-sb-btn-href")||"";
    var foot=m.querySelector(".sb-modal__foot");
    var btn=m.querySelector(".sb-modal__btn");
    if(btnText && btnText!=="-" && btnHref && foot && btn){
      btn.textContent=btnText;
      btn.setAttribute("href",btnHref);
      foot.hidden=false;
      foot.style.display="flex";
    } else if(foot){
      if(btn) { btn.textContent=""; btn.removeAttribute("href"); }
      foot.hidden=true;
      foot.style.display="none";
    }
    m.hidden=false;
    document.body.style.overflow="hidden";
    alignPanel();
  }
  document.addEventListener("click",function(e){
    var t=el(e.target);
    var a=t && t.closest ? t.closest("a[data-sb-popup=\\"1\\"]") : null;
    if(!a || !a.closest('[data-sb-scope="'+SCOPE+'"]')) return;
    e.preventDefault();
    e.stopPropagation();
    openFrom(a);
  },true);
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape" && modal && !modal.hidden) close();
  });
  function openHash(){
    var h=location.hash||"";
    if(h.indexOf("#popup:sb")!==0) return;
    var a=document.querySelector('[data-sb-scope="'+SCOPE+'"] a[data-sb-popup="1"][href="'+h.replace(/"/g,"")+'"]');
    if(a) openFrom(a);
  }
  function whenReady(fn){
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn);
    else fn();
  }
  whenReady(openHash);
  setTimeout(openHash,400);
  window.addEventListener("resize",function(){
    if(modal && !modal.hidden) alignPanel();
  });
})();
</script>`;

  return { html, css };
}
