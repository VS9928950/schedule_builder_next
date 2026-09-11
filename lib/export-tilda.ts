type IsoEvent = {
  id: string;
  title: string;
  description?: string;
  description_md?: string;
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
  layoutDayLanes,
  mergeFinalNirSameTime,
  isArchitectureProgramView,
  isTechScheduleOnlyFormat,
  programCardTone,
  PROGRAM_CARD_BG,
  normalizeHttpUrl
} from "@/lib/schedule";

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function resolveEventOverride(
  byId: Record<string, EventLayoutOverride> | undefined,
  ev: { id?: unknown; sourceIds?: unknown }
): EventLayoutOverride {
  const map = byId ?? {};
  const own = map[String(ev.id ?? "")] ?? {};
  const sourceIds = Array.isArray(ev.sourceIds) ? ev.sourceIds.map((x) => String(x)) : [];
  const fromSources = sourceIds.map((id) => map[id]).filter((x): x is EventLayoutOverride => !!x);
  const heightCandidates = [own.heightPx, ...fromSources.map((o) => o.heightPx)].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  const rowSpanCandidates = [own.rowSpan, ...fromSources.map((o) => o.rowSpan)].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  const colSpanCandidates = [own.colSpan, ...fromSources.map((o) => o.colSpan)].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  return {
    ...fromSources[0],
    ...own,
    ...(heightCandidates.length ? { heightPx: Math.max(...heightCandidates) } : {}),
    ...(rowSpanCandidates.length ? { rowSpan: Math.max(...rowSpanCandidates) } : {}),
    ...(colSpanCandidates.length ? { colSpan: Math.max(...colSpanCandidates) } : {}),
    hidden: Boolean(own.hidden) || fromSources.some((o) => o.hidden)
  };
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
  return [building != null ? String(building).trim() : "", room != null ? String(room).trim() : ""].filter(Boolean).join(", ");
}

function emphasizePlaceHtml(escaped: string) {
  return escaped.replace(/(Корп\.\s*[^<]+)/g, '<span class="sb-placeMark">$1</span>');
}

function renderCardBodyHtml(desc: string) {
  const lines = String(desc)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const allBullets = lines.every((l) => l.startsWith("- ") || l.startsWith("– ") || l.startsWith("— "));
  if (allBullets) {
    const items = lines
      .map((l) => l.replace(/^[-–—]\s*/, ""))
      .map((l) => `<li>${emphasizePlaceHtml(esc(l))}</li>`)
      .join("");
    return `<ul class="sb-list">${items}</ul>`;
  }
  return `<div class="sb-desc">${emphasizePlaceHtml(esc(desc))}</div>`;
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
  const desc = normToken(raw.description_md ?? raw.description);
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
  const place = [normToken(raw.building), normToken(raw.room)].filter(Boolean).join(" · ");
  if (place) lines.push(`Место: ${place}`);
  if (view === "vks") lines.push("ВКС: Да");
  if (view === "broadcasts") lines.push("Трансляция: Да");
  if (view === "interpretation") lines.push("Перевод: Да");
  return lines;
}

function shouldShowFormat(fmt: unknown) {
  const s = fmt == null ? "" : String(fmt).trim();
  if (!s) return false;
  return s !== "Питание";
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
}) {
  const { projectName, events, timelineLayout, timelineStyle, scopeSelector, onlyDayKey, fontMode, view, roomsMode, responsibleFilter } = args;
  const theme = resolveSnippetStyle(timelineStyle);
  const isTechView = String(view ?? "").trim() === "tech-schedule";
  const filteredEvents = applyExportViewFilter(events, view);
  const layout = timelineLayout ?? {};
  const eventOverrides = layout.event_overrides ?? {};

  const timed = filteredEvents
    .filter((e) => (e.kind ?? "timed") === "timed" && e.start && e.end)
    .map((e) => ({ ...e, startD: new Date(e.start!), endD: new Date(e.end!) }))
    .filter((e) => Number.isFinite(e.startD.getTime()) && Number.isFinite(e.endD.getTime()) && e.endD > e.startD);

  const hiddenDay = new Set(
    (timelineLayout?.hidden_day_keys ?? [])
      .map((k) => String(k).slice(0, 10))
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  );
  const days = Array.from(new Set(timed.map((e) => dayKeyFromDate(e.startD))))
    .sort()
    .filter((d) => !hiddenDay.has(d));
  const daysToExport = onlyDayKey ? days.filter((d) => d === onlyDayKey) : days;

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
${rootSel} .sb-program{display:flex;flex-direction:column;gap:20px}
${rootSel} .sb-program + .sb-program{margin-top:12px}
${rootSel} .sb-slot{display:flex;align-items:stretch;gap:20px}
${rootSel} .sb-tile{flex:1 1 0;min-width:0;box-sizing:border-box;padding:32px;border-radius:10px;background:${PROGRAM_CARD_BG.default}}
${rootSel} .sb-tile--accent{background:${PROGRAM_CARD_BG.accent}}
${rootSel} .sb-tile--service{background:${PROGRAM_CARD_BG.service}}
${rootSel} .sb-tile--default{background:${PROGRAM_CARD_BG.default}}
${rootSel} .sb-session + .sb-session{margin-top:18px}
${rootSel} .sb-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
${rootSel} .sb-time{font-size:${theme.timeFontPx}px;font-weight:${theme.timeWeight};font-style:${theme.timeItalic ? "italic" : "normal"};color:var(--sb-time);line-height:1.4}
${rootSel} .sb-place{font-size:${theme.placeFontPx}px;font-weight:${theme.placeWeight};font-style:${theme.placeItalic ? "italic" : "normal"};color:var(--sb-place);text-align:right;line-height:1.4}
${rootSel} .sb-format{margin-top:10px;font-size:${theme.formatFontPx}px;font-weight:${theme.formatWeight};font-style:${theme.formatItalic ? "italic" : "normal"};color:var(--sb-format)}
${rootSel} .sb-title{margin-top:6px;font-size:${theme.titleFontPx}px;font-weight:${theme.titleWeight};font-style:${theme.titleItalic ? "italic" : "normal"};color:var(--sb-title);line-height:1.35}
${rootSel} a.sb-title{color:inherit;text-decoration:none}
${rootSel} a.sb-title:hover{text-decoration:underline}
${rootSel} .sb-rule{margin:14px 0;border:0;border-top:1px solid var(--sb-time)}
${rootSel} .sb-tile--accent .sb-rule{border-top-color:var(--sb-place)}
${rootSel} .sb-desc{font-size:${theme.descFontPx}px;font-weight:${theme.descWeight};font-style:${theme.descItalic ? "italic" : "normal"};color:var(--sb-desc);line-height:1.45;white-space:pre-line}
${rootSel} .sb-list{margin:0;padding-left:1.15em;font-size:${theme.descFontPx}px;line-height:1.45;color:var(--sb-desc)}
${rootSel} .sb-list li{margin:0 0 .35em}
${rootSel} .sb-placeMark{color:var(--sb-place);font-weight:600}
${rootSel} .sb-extra{margin-top:4px;line-height:1.3}
${rootSel} .sb-extra--teamLead{font-size:${theme.teamLeadFontPx}px;font-weight:${theme.teamLeadWeight};font-style:${theme.teamLeadItalic ? "italic" : "normal"};color:${esc(theme.teamLeadColor)}}
${rootSel} .sb-extra--responsibles{font-size:${theme.responsiblesFontPx}px;font-weight:${theme.responsiblesWeight};font-style:${theme.responsiblesItalic ? "italic" : "normal"};color:${esc(theme.responsiblesColor)}}
${rootSel} .sb-extra--vks{font-size:${theme.vksFontPx}px;font-weight:${theme.vksWeight};font-style:${theme.vksItalic ? "italic" : "normal"};color:${esc(theme.vksColor)}}
${rootSel} .sb-extra--translation{font-size:${theme.translationFontPx}px;font-weight:${theme.translationWeight};font-style:${theme.translationItalic ? "italic" : "normal"};color:${esc(theme.translationColor)}}
${rootSel} .sb-extra--interpretation{font-size:${theme.interpretationFontPx}px;font-weight:${theme.interpretationWeight};font-style:${theme.interpretationItalic ? "italic" : "normal"};color:${esc(theme.interpretationColor)}}
${rootSel} .sb-extra--volunteers{font-size:${theme.volunteersFontPx}px;font-weight:${theme.volunteersWeight};font-style:${theme.volunteersItalic ? "italic" : "normal"};color:${esc(theme.volunteersColor)}}
@media (max-width: 768px){
  ${rootSel} .sb-slot{flex-direction:column;gap:16px}
  ${rootSel} .sb-tile{padding:24px;flex:1 1 auto}
}
@media print{
  ${rootSel} .sb-tile{break-inside:avoid}
}
`.trim();

  type ProgramBox = {
    ev: any;
    startD: Date;
    endD: Date;
    col: number;
    hidden: boolean;
  };

  function overlapsMs(a: ProgramBox, b: ProgramBox) {
    return a.startD.getTime() < b.endD.getTime() && a.endD.getTime() > b.startD.getTime();
  }

  function slotsFromBoxes(boxes: ProgramBox[]): ProgramBox[][][] {
    const visible = boxes.filter((b) => !b.hidden).sort((a, b) => a.startD.getTime() - b.startD.getTime() || a.col - b.col);
    const used = new Set<ProgramBox>();
    const slots: ProgramBox[][][] = [];
    for (const box of visible) {
      if (used.has(box)) continue;
      const group: ProgramBox[] = [];
      const queue = [box];
      used.add(box);
      while (queue.length) {
        const cur = queue.pop()!;
        group.push(cur);
        for (const other of visible) {
          if (used.has(other)) continue;
          if (overlapsMs(cur, other)) {
            used.add(other);
            queue.push(other);
          }
        }
      }
      const byCol = new Map<number, ProgramBox[]>();
      for (const g of group) {
        const arr = byCol.get(g.col) ?? [];
        arr.push(g);
        byCol.set(g.col, arr);
      }
      const cols = Array.from(byCol.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, list]) => list.sort((a, b) => a.startD.getTime() - b.startD.getTime()));
      slots.push(cols);
    }
    slots.sort((a, b) => a[0]![0]!.startD.getTime() - b[0]![0]!.startD.getTime());
    return slots;
  }

  function renderSession(ev: any, startD: Date, endD: Date) {
    const place = placeLabel(ev.building, ev.room);
    const fmt = shouldShowFormat(ev.format) ? String(ev.format).trim() : "";
    const desc = String(ev.description_md ?? ev.description ?? "");
    const extras = isTechView ? extraFieldLines(ev) : [];
    const hasBody = !!(desc || extras.length);
    const evUrl = normalizeHttpUrl(ev.url);
    const titleStyle = typeInline(theme.titleFontPx, theme.titleWeight, theme.titleItalic, theme.titleColor);
    let inner = `<div class="sb-head"><div class="sb-time">${esc(formatTimeRange(startD, endD))}</div>`;
    if (place) inner += `<div class="sb-place">${esc(place)}</div>`;
    inner += `</div>\n`;
    if (fmt) inner += `<div class="sb-format">${esc(fmt)}</div>\n`;
    if (evUrl) {
      const tAttr = linkTarget === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
      inner += `<a class="sb-title" href="${esc(evUrl)}"${tAttr} style="${titleStyle}">${esc(ev.title)}</a>\n`;
    } else {
      inner += `<div class="sb-title" style="${titleStyle}">${esc(ev.title)}</div>\n`;
    }
    if (hasBody) inner += `<hr class="sb-rule"/>\n`;
    if (desc) inner += `${renderCardBodyHtml(desc)}\n`;
    if (extras.length) {
      for (const line of extras) {
        inner += `<div class="sb-extra sb-extra--${esc(line.kind)}" style="${extraTypeInline(theme, line.kind)}">${esc(line.text)}</div>\n`;
      }
    }
    return `<div class="sb-session">${inner}</div>`;
  }

  let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;
  const linkTarget = theme.eventLinkTarget;

  for (const dayKey of daysToExport) {
    const dayEvents = timed.filter((e) => dayKeyFromDate(e.startD) === dayKey);
    const scheduleEvents = mergeFinalNirSameTime(
      dayEvents.map((e) => ({
        id: String(e.id),
        title: String(e.title ?? ""),
        description: e.description != null ? String(e.description) : undefined,
        description_md: e.description_md != null ? String(e.description_md) : undefined,
        building: e.building != null ? String(e.building) : undefined,
        room: e.room != null ? String(e.room) : undefined,
        format: e.format != null ? String(e.format) : undefined,
        orderNo: (e as any).orderNo,
        visible: e.visible ?? true,
        start: e.startD,
        end: e.endD,
        url: e.url,
        style_override: e.style_override,
        teamLead: e.teamLead,
        responsible1: e.responsible1,
        responsible2: e.responsible2,
        responsible3: e.responsible3,
        responsible4: e.responsible4,
        responsible5: e.responsible5,
        responsible6: e.responsible6,
        volunteersCount: e.volunteersCount,
        vks: e.vks,
        translation: e.translation,
        simultaneousInterpretation: e.simultaneousInterpretation
      })) as any
    );
    const dayDate = new Date(dayKey + "T00:00:00.000Z");
    const dayLayout = layoutDayLanes(dayDate, scheduleEvents as any);
    const boxes: ProgramBox[] = (dayLayout.items as any[]).map((it) => {
      const ev = it.event as any;
      const ov = resolveEventOverride(eventOverrides?.[dayKey], ev);
      return {
        ev,
        startD: new Date(ev.start),
        endD: new Date(ev.end),
        col: Math.max(0, Math.floor(Number.isFinite(it.clusterIndex) ? it.clusterIndex : 0)),
        hidden: !!ov.hidden
      };
    });
    const slots = slotsFromBoxes(boxes);
    if (!slots.length) continue;
    html += `<div class="sb-program">\n`;
    for (const cols of slots) {
      html += `<div class="sb-slot">\n`;
      for (const col of cols) {
        const first = col[0]!;
        const tone = programCardTone(first.ev);
        const so = (first.ev.style_override ?? {}) as any;
        const bg =
          (so.eventBgColor ? rgbaFrom(String(so.eventBgColor), Number(so.eventBgAlpha ?? 1)) : null) ?? PROGRAM_CARD_BG[tone];
        html += `<div class="sb-tile sb-tile--${esc(tone)}" style="background:${esc(bg)}">\n`;
        for (const box of col) {
          html += renderSession(box.ev, box.startD, box.endD);
        }
        html += `</div>\n`;
      }
      html += `</div>\n`;
    }
    html += `</div>\n`;
  }

  html += `</div>`;

  return { html, css };
}
