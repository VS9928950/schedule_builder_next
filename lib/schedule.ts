export type ScheduleEvent = {
  id: string;
  title: string;
  description?: string;
  /** http(s) only; empty / invalid omitted */
  url?: string;
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
  vks?: "Да" | "Нет" | "Не указано";
  photosFromResponsible?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  supportMaterials?: string;
  banner?: "Общий" | "Секционный" | "Не указано";
  orderNo?: number;
  visible?: boolean;
  start: Date;
  end: Date;
};

export type UntimedEvent = {
  id: string;
  title: string;
  description?: string;
  url?: string;
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
  vks?: "Да" | "Нет" | "Не указано";
  photosFromResponsible?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  supportMaterials?: string;
  banner?: "Общий" | "Секционный" | "Не указано";
  orderNo?: number;
  visible?: boolean;
  day: Date; // date only (start of day)
};

export type ParsedSchedule = {
  timed: ScheduleEvent[];
  untimed: UntimedEvent[];
};

export type DayLayoutItem = {
  event: ScheduleEvent;
  lane: number;
  topMin: number;
  heightMin: number;
  clusterIndex: number; // 0..clusterCols-1
  clusterCols: number; // how many parallel columns in this overlap cluster
};

export type DayLayout = {
  day: Date;
  dayStartMin: number;
  dayEndMin: number;
  lanes: number;
  maxCols: number;
  items: DayLayoutItem[];
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function strAny(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return str(v);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Valid http(s) URL or undefined (empty / invalid rejected). */
export function normalizeHttpUrl(v: unknown): string | undefined {
  const s = v == null ? "" : String(v).trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

function pickUrlFromRow(row: Record<string, unknown>): string | undefined {
  const v = row["Ссылка"] ?? row["URL"] ?? row["Url"] ?? row["url"] ?? row["Link"] ?? row["link"];
  return normalizeHttpUrl(v);
}

function parseTernary(value: unknown): "Да" | "Нет" | "Не указано" | undefined {
  const s = strAny(value)?.toLowerCase();
  if (!s) return undefined;
  if (s === "да") return "Да";
  if (s === "нет") return "Нет";
  if (s === "не указано") return "Не указано";
  return undefined;
}

function parseBanner(value: unknown): "Общий" | "Секционный" | "Не указано" | undefined {
  const s = strAny(value)?.toLowerCase();
  if (!s) return undefined;
  if (s === "общий") return "Общий";
  if (s === "секционный") return "Секционный";
  if (s === "не указано") return "Не указано";
  return undefined;
}

function normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = k.replace(/^\s*#\s*/, "").trim();
    out[nk] = v;
  }
  return out;
}

// Excel serial (1900 system): 25569 = days between 1899-12-30 and 1970-01-01.
// The clock in the cell is naive (18:30 means 18:30), not a city timezone.
function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function minutesSinceDayStart(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

function roundDownTo(n: number, step: number) {
  return Math.floor(n / step) * step;
}
function roundUpTo(n: number, step: number) {
  return Math.ceil(n / step) * step;
}

export function parseScheduleFromExcelRows(rows: unknown[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || typeof raw !== "object") continue;
    const row = normalizeKeys(raw as Record<string, unknown>);

    const dateSerial = num(row["Дата"]);
    const startFrac = num(row["Начало"]);
    const endFrac = num(row["Окончание"]);
    if (dateSerial === null || startFrac === null || endFrac === null) continue;

    const start = excelSerialToDate(dateSerial + startFrac);
    const end = excelSerialToDate(dateSerial + endFrac);
    if (!(start instanceof Date) || !(end instanceof Date)) continue;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
    if (end <= start) continue;

    const title = str(row["Наименование"]) ?? "Без названия";
    const ev: ScheduleEvent = {
      id: String(row["id"] ?? row["ID"] ?? row["Id"] ?? i),
      title,
      description: str(row["Описание"]) ?? undefined,
      url: pickUrlFromRow(row),
      building: strAny(row["Корпус"]) ?? undefined,
      room: row["Аудитория"] != null ? String(row["Аудитория"]).trim() || undefined : undefined,
      format: str(row["Формат"]) ?? undefined,
      responsible1: strAny(row["Ответственный сотрудник 1"]) ?? undefined,
      responsible2: strAny(row["Ответственный сотрудник 2"]) ?? undefined,
      responsible3: strAny(row["Ответственный сотрудник 3"]) ?? undefined,
      responsible4: strAny(row["Ответственный сотрудник 4"]) ?? undefined,
      responsible5: strAny(row["Ответственный сотрудник 5"]) ?? undefined,
      responsible6: strAny(row["Ответственный сотрудник 6"]) ?? undefined,
      teamLead: strAny(row["Тимлид"]) ?? undefined,
      volunteersCount: num(row["Количество волонтеров"]) ?? undefined,
      vks: parseTernary(row["ВКС"]),
      photosFromResponsible: parseTernary(row["Фотографии от ответственного"]),
      translation: parseTernary(row["Трансляция"]),
      simultaneousInterpretation: parseTernary(row["Синхронный перевод"]),
      supportMaterials: str(row["Сопроводительные материалы"]) ?? undefined,
      banner: parseBanner(row["Баннер"]),
      orderNo: num(row["№"] ?? row["N"] ?? row["No"] ?? row["Номер"]) ?? undefined,
      visible: true,
      start,
      end
    };
    events.push(ev);
  }

  return normalizeTimedEvents(events);
}

/** Events with this format belong on Tech Schedule only, not Architecture. */
export const TECH_SCHEDULE_ONLY_FORMAT = "Техническое обеспечение";

export function isTechScheduleOnlyFormat(format?: unknown): boolean {
  return String(format ?? "").trim() === TECH_SCHEDULE_ONLY_FORMAT;
}

/** Architecture / public-program export views (`timeline` or empty). */
export function isArchitectureProgramView(view?: string | null): boolean {
  const v = String(view ?? "").trim();
  return v === "" || v === "timeline" || v === "architecture";
}

const NIR_FORMAT = "Финал конкурса НИР";
const SECTIONAL_FORMAT = "Заседания научных секций";
/** Previous table format — still grouped until the sheet is re-imported. */
const LEGACY_SECTIONAL_FORMAT = "Секционное заседание";
const SECTIONAL_GROUP_TITLE = "Доклады ученых";

function isSectionalFormat(format?: unknown): boolean {
  const s = String(format ?? "").trim();
  return s === SECTIONAL_FORMAT || s === LEGACY_SECTIONAL_FORMAT;
}

function groupedFormatKind(format?: string): "nir" | "sectional" | null {
  const s = (format ?? "").trim();
  if (s === NIR_FORMAT) return "nir";
  if (isSectionalFormat(s)) return "sectional";
  return null;
}

/** True when this is a synthetic merged card (NIR final or sectional session). */
export function isParallelGroupCardTitle(title?: unknown) {
  const t = title == null ? "" : String(title).trim();
  return t === NIR_FORMAT || t === SECTIONAL_GROUP_TITLE || t === LEGACY_SECTIONAL_FORMAT;
}

export function isParallelGroupCardId(id?: unknown) {
  const s = String(id ?? "");
  return s.startsWith("final-nir-") || s.startsWith("sectional-");
}

export function isFinalNirGroupCardId(id?: unknown) {
  return String(id ?? "").startsWith("final-nir-");
}

export function isSectionalGroupCardId(id?: unknown) {
  return String(id ?? "").startsWith("sectional-");
}

/** Intro above the grouped NIR talk list (public program wording). */
export const FINAL_NIR_GROUP_INTRO = "Устные доклады (10 параллельных секций):";

/** Intro above the grouped scientific-session talk list. */
export const SECTIONAL_GROUP_INTRO = "Параллельные секции:";

export function groupedCardIntro(id?: unknown): string | null {
  if (isFinalNirGroupCardId(id)) return FINAL_NIR_GROUP_INTRO;
  if (isSectionalGroupCardId(id)) return SECTIONAL_GROUP_INTRO;
  return null;
}

function parallelGroupCardId(kind: "nir" | "sectional", start: Date, end: Date) {
  if (kind === "nir") return `final-nir-${start.toISOString()}-${end.toISOString()}`;
  return `sectional-${start.toISOString()}-${end.toISOString()}`;
}

function normalizeTimedEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  // Keep source events intact. Presentation-layer aggregation (e.g. NIR finals)
  // should happen in viewers (timeline), not in the data normalization step.
  const out = [...events];
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

function placeSuffix(e: ScheduleEvent) {
  const placeParts = [
    e.building != null && String(e.building).trim() ? String(e.building).trim() : null,
    e.room != null && String(e.room).trim() ? String(e.room).trim() : null
  ].filter(Boolean);
  return placeParts.length ? ` (${placeParts.join(", ")})` : "";
}

export type PlaceHighlightPart = { kind: "text" | "place"; text: string };

/** Split a grouped-card line so the trailing `(place)` can use the place color. */
export function highlightPlaceInLine(raw: string): PlaceHighlightPart[] {
  const line = String(raw ?? "")
    .replace(/^[-–—]\s*/, "")
    .trim();
  if (!line) return [];
  const m = /^(.*)(\s\([^)]+\))(\s·\s\d{1,2}:\d{2}[–-]\d{1,2}:\d{2})?$/.exec(line);
  if (!m?.[2]) return [{ kind: "text", text: line }];
  const parts: PlaceHighlightPart[] = [];
  if (m[1]) parts.push({ kind: "text", text: m[1] });
  parts.push({ kind: "place", text: m[2].trim() });
  if (m[3]) parts.push({ kind: "text", text: m[3] });
  return parts;
}

function durationMs(e: ScheduleEvent) {
  return e.end.getTime() - e.start.getTime();
}

/** Inclusive containment: inner start/end lie inside outer start/end. */
function intervalContains(outer: ScheduleEvent, inner: ScheduleEvent) {
  return outer.start.getTime() <= inner.start.getTime() && inner.end.getTime() <= outer.end.getTime();
}

function mergeNirExactSameTime(events: ScheduleEvent[]): ScheduleEvent[] {
  if (events.length <= 1) return events;
  const groups = new Map<string, ScheduleEvent[]>();
  for (const ev of events) {
    const dayKey = dayKeyLocalFromDate(ev.start);
    const key = `${dayKey}|${ev.start.toISOString()}|${ev.end.toISOString()}`;
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }
  const out: ScheduleEvent[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]!);
      continue;
    }
    const first = arr[0]!;
    const lines = arr
      .slice()
      .sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9))
      .map((e) => `- ${e.title}${placeSuffix(e)}`);
    out.push({
      id: parallelGroupCardId("nir", first.start, first.end),
      title: NIR_FORMAT,
      description: lines.join("\n"),
      format: undefined,
      building: undefined,
      room: undefined,
      orderNo: Math.min(...arr.map((x) => x.orderNo ?? 1e9)),
      visible: true,
      start: first.start,
      end: first.end,
      sourceIds: arr.map((e) => e.id)
    } as ScheduleEvent);
  }
  return out;
}

/**
 * Sectionals: merge only when an event's interval is fully inside another event's window.
 * Nested talks keep their own time in the list. Partial overlap or disjoint slots stay separate.
 */
function mergeSectionalContained(events: ScheduleEvent[]): ScheduleEvent[] {
  if (events.length <= 1) return events;
  const byDay = new Map<string, ScheduleEvent[]>();
  for (const ev of events) {
    const dk = dayKeyLocalFromDate(ev.start);
    const arr = byDay.get(dk) ?? [];
    arr.push(ev);
    byDay.set(dk, arr);
  }
  const out: ScheduleEvent[] = [];
  for (const dayEvents of byDay.values()) {
    const leftover = [...dayEvents].sort(
      (a, b) =>
        durationMs(b) - durationMs(a) ||
        a.start.getTime() - b.start.getTime() ||
        (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9)
    );
    const used = new Set<string>();
    for (const host of leftover) {
      if (used.has(host.id)) continue;
      const members = leftover.filter((e) => !used.has(e.id) && intervalContains(host, e));
      if (members.length <= 1) {
        used.add(host.id);
        out.push(host);
        continue;
      }
      for (const e of members) used.add(e.id);
      const winS = host.start.getTime();
      const winE = host.end.getTime();
      const lines = members
        .slice()
        .sort(
          (a, b) =>
            a.start.getTime() - b.start.getTime() || (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9)
        )
        .map((e) => {
          const sameSlot = e.start.getTime() === winS && e.end.getTime() === winE;
          const time = sameSlot ? "" : ` · ${formatTime(e.start)}–${formatTime(e.end)}`;
          return `- ${e.title}${placeSuffix(e)}${time}`;
        });
      out.push({
        id: parallelGroupCardId("sectional", host.start, host.end),
        title: SECTIONAL_GROUP_TITLE,
        description: lines.join("\n"),
        format: undefined,
        building: undefined,
        room: undefined,
        orderNo: Math.min(...members.map((x) => x.orderNo ?? 1e9)),
        visible: true,
        start: host.start,
        end: host.end,
        sourceIds: members.map((e) => e.id)
      } as ScheduleEvent);
    }
  }
  return out;
}

/** Presentation-only: merge parallel NIR finals and nested sectional sessions. */
export function mergeFinalNirSameTime(events: ScheduleEvent[]): ScheduleEvent[] {
  const nir: ScheduleEvent[] = [];
  const sectional: ScheduleEvent[] = [];
  const rest: ScheduleEvent[] = [];
  for (const ev of events) {
    const kind = groupedFormatKind(ev.format);
    if (kind === "nir") nir.push(ev);
    else if (kind === "sectional") sectional.push(ev);
    else rest.push(ev);
  }
  const out = [...rest, ...mergeNirExactSameTime(nir), ...mergeSectionalContained(sectional)];
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

export function parseScheduleAllFromExcelRows(rows: unknown[]): ParsedSchedule {
  const timed: ScheduleEvent[] = [];
  const untimed: UntimedEvent[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || typeof raw !== "object") continue;
    const row = normalizeKeys(raw as Record<string, unknown>);

    const dateSerial = num(row["Дата"]);
    if (dateSerial === null) continue;

    const title = str(row["Наименование"]) ?? "Без названия";
    const orderNo = num(row["№"] ?? row["N"] ?? row["No"] ?? row["Номер"]) ?? undefined;
    const responsible1 = strAny(row["Ответственный сотрудник 1"]) ?? undefined;
    const responsible2 = strAny(row["Ответственный сотрудник 2"]) ?? undefined;
    const responsible3 = strAny(row["Ответственный сотрудник 3"]) ?? undefined;
    const responsible4 = strAny(row["Ответственный сотрудник 4"]) ?? undefined;
    const responsible5 = strAny(row["Ответственный сотрудник 5"]) ?? undefined;
    const responsible6 = strAny(row["Ответственный сотрудник 6"]) ?? undefined;
    const teamLead = strAny(row["Тимлид"]) ?? undefined;
    const volunteersCount = num(row["Количество волонтеров"]) ?? undefined;
    const vks = parseTernary(row["ВКС"]);
    const photosFromResponsible = parseTernary(row["Фотографии от ответственного"]);
    const translation = parseTernary(row["Трансляция"]);
    const simultaneousInterpretation = parseTernary(row["Синхронный перевод"]);
    const supportMaterials = str(row["Сопроводительные материалы"]) ?? undefined;
    const banner = parseBanner(row["Баннер"]);

    const baseDay = startOfDay(excelSerialToDate(dateSerial));

    const startFrac = num(row["Начало"]);
    const endFrac = num(row["Окончание"]);

    if (startFrac !== null && endFrac !== null) {
      const start = excelSerialToDate(dateSerial + startFrac);
      const end = excelSerialToDate(dateSerial + endFrac);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      if (end <= start) continue;

      timed.push({
        id: String(row["id"] ?? row["ID"] ?? row["Id"] ?? i),
        title,
        description: str(row["Описание"]) ?? undefined,
        url: pickUrlFromRow(row),
        building: strAny(row["Корпус"]) ?? undefined,
        room: row["Аудитория"] != null ? String(row["Аудитория"]).trim() || undefined : undefined,
        format: str(row["Формат"]) ?? undefined,
        responsible1,
        responsible2,
        responsible3,
        responsible4,
        responsible5,
        responsible6,
        teamLead,
        volunteersCount,
        vks,
        photosFromResponsible,
        translation,
        simultaneousInterpretation,
        supportMaterials,
        banner,
        orderNo,
        visible: true,
        start,
        end
      });
    } else {
      untimed.push({
        id: String(row["id"] ?? row["ID"] ?? row["Id"] ?? i),
        title,
        description: str(row["Описание"]) ?? undefined,
        url: pickUrlFromRow(row),
        building: strAny(row["Корпус"]) ?? undefined,
        room: row["Аудитория"] != null ? String(row["Аудитория"]).trim() || undefined : undefined,
        format: str(row["Формат"]) ?? undefined,
        responsible1,
        responsible2,
        responsible3,
        responsible4,
        responsible5,
        responsible6,
        teamLead,
        volunteersCount,
        vks,
        photosFromResponsible,
        translation,
        simultaneousInterpretation,
        supportMaterials,
        banner,
        orderNo,
        visible: true,
        day: baseDay
      });
    }
  }

  const normTimed = normalizeTimedEvents(timed);
  untimed.sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9));
  return { timed: normTimed, untimed };
}

export function groupEventsByFourDays(events: ScheduleEvent[]): Array<{ day: Date; events: ScheduleEvent[] }> {
  if (!events.length) return [];
  const base = startOfDay(events[0].start);

  const buckets = new Map<number, ScheduleEvent[]>();
  for (const ev of events) {
    const day = startOfDay(ev.start).getTime();
    const idx = Math.floor((day - base.getTime()) / (86400 * 1000));
    if (idx < 0 || idx > 3) continue;
    const key = addDays(base, idx).getTime();
    const arr = buckets.get(key) ?? [];
    arr.push(ev);
    buckets.set(key, arr);
  }

  const out: Array<{ day: Date; events: ScheduleEvent[] }> = [];
  for (let i = 0; i < 4; i++) {
    const d = addDays(base, i);
    out.push({ day: d, events: (buckets.get(d.getTime()) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime()) });
  }
  return out;
}

export function layoutDayLanes(day: Date, events: ScheduleEvent[]): DayLayout {
  const evs = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const items: DayLayoutItem[] = [];

  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const ev of evs) {
    const s = minutesSinceDayStart(ev.start);
    const e = minutesSinceDayStart(ev.end);
    if (Number.isFinite(s)) minStart = Math.min(minStart, s);
    if (Number.isFinite(e)) maxEnd = Math.max(maxEnd, e);
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || evs.length === 0) {
    return { day, dayStartMin: 9 * 60, dayEndMin: 18 * 60, lanes: 1, maxCols: 1, items: [] };
  }

  // No artificial padding: keep timeline tight to actual day events.
  // Still round to 15 minutes for a clean grid.
  const dayStartMin = roundDownTo(Math.max(0, minStart), 15);
  const dayEndMin = roundUpTo(Math.min(24 * 60, maxEnd), 15);

  for (const ev of evs) {
    const startMin = minutesSinceDayStart(ev.start);
    const endMin = minutesSinceDayStart(ev.end);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

    items.push({
      event: ev,
      lane: 0,
      topMin: Math.max(0, startMin - dayStartMin),
      heightMin: Math.max(1, endMin - startMin),
      clusterIndex: 0,
      clusterCols: 1
    });
  }

  let maxCols = 1;

  // Compute "conflict clusters" (connected components of the overlap graph).
  // Within each cluster we compact lane numbers to contiguous columns,
  // so all events in the same cluster use the same column grid and never overlap visually.
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    const a = items[i]!;
    const as = a.event.start.getTime();
    const ae = a.event.end.getTime();
    for (let j = i + 1; j < n; j++) {
      const b = items[j]!;
      const bs = b.event.start.getTime();
      const be = b.event.end.getTime();
      const overlaps = bs < ae && be > as;
      if (overlaps) union(i, j);
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = clusters.get(r) ?? [];
    arr.push(i);
    clusters.set(r, arr);
  }

  // Assign stable columns *within each cluster* using interval-graph coloring.
  // This avoids "wide" clusters caused by reusing global lanes and makes layout predictable.
  for (const idxs of clusters.values()) {
    const sorted = [...idxs].sort((ia, ib) => {
      const a = items[ia]!.event;
      const b = items[ib]!.event;
      const as = a.start.getTime();
      const bs = b.start.getTime();
      if (as !== bs) return as - bs;
      const ae = a.end.getTime();
      const be = b.end.getTime();
      if (ae !== be) return be - ae; // longer first when same start
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

    const colEnds: number[] = []; // absolute ms end time per column
    let clusterMax = 1;

    for (const idx of sorted) {
      const it = items[idx]!;
      const s = it.event.start.getTime();
      const e = it.event.end.getTime();

      let col = -1;
      let bestEnd = Infinity;
      for (let c = 0; c < colEnds.length; c++) {
        const endMs = colEnds[c]!;
        if (endMs <= s && endMs < bestEnd) {
          bestEnd = endMs;
          col = c;
        }
      }
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(e);
      } else {
        colEnds[col] = e;
      }

      clusterMax = Math.max(clusterMax, colEnds.length);
      it.lane = col;
      it.clusterIndex = col;
    }

    for (const idx of sorted) {
      const it = items[idx]!;
      it.clusterCols = Math.max(1, clusterMax);
    }

    // Important: `clusterMax` can be larger than the number of columns actually used
    // (e.g. sparse lane assignment when some columns are never assigned).
    // That creates empty "holes" in the UI grid. Recompute based on assigned indices.
    const usedCols = sorted.reduce((m, idx) => Math.max(m, items[idx]!.clusterIndex + 1), 0);
    const compactCols = Math.max(1, usedCols);
    for (const idx of sorted) {
      items[idx]!.clusterCols = compactCols;
    }

    maxCols = Math.max(maxCols, compactCols);
  }

  const lanes = Math.max(1, maxCols);
  return { day, dayStartMin, dayEndMin, lanes, maxCols, items };
}

export function formatTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Public program range, e.g. `10:00 – 11:45`. */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function migrateLegacyStyleColor(v: unknown, legacy: string, next: string): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s || s.toLowerCase() === legacy.toLowerCase()) return next;
  return s;
}

export function migrateLegacyStyleNum(v: unknown, legacy: number, next: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v === legacy ? next : v;
}

/** Hide format label on public cards for these values. */
export function shouldShowFormat(fmt: unknown): boolean {
  const s = fmt == null ? "" : String(fmt).trim();
  if (!s) return false;
  return s !== "Питание" && s !== "Регистрация";
}

/** Food cards show time/title/place only — no description body. */
export function shouldShowDescription(fmt: unknown): boolean {
  return String(fmt ?? "").trim() !== "Питание";
}

export type ProgramCardTone = "accent" | "service" | "default";

export const PROGRAM_CARD_BG: Record<ProgramCardTone, string> = {
  accent: "#FFECF1",
  service: "#E7DBEE",
  default: "#EFF2FB"
};

/** Pink = NIR / sections, lilac = breaks, pale blue = everything else (sfy-conf.ru program). */
export function programCardTone(ev: { format?: unknown; title?: unknown }): ProgramCardTone {
  const format = String(ev.format ?? "").trim();
  const title = String(ev.title ?? "").trim();
  if (
    format === NIR_FORMAT ||
    isSectionalFormat(format) ||
    title === NIR_FORMAT ||
    title === SECTIONAL_GROUP_TITLE ||
    title === LEGACY_SECTIONAL_FORMAT ||
    /заседани[ея] по секциям/i.test(format) ||
    /заседани[ея] по секциям/i.test(title)
  ) {
    return "accent";
  }
  if (
    format === "Питание" ||
    format === "Регистрация" ||
    /^(регистрация|кофе|кофе-брейк|обед)\b/i.test(title)
  ) {
    return "service";
  }
  return "default";
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function formatDayFull(d: Date): string {
  const s = d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Calendar day key YYYY-MM-DD from the spreadsheet clock (not the browser timezone). */
export function dayKeyLocalFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Parse YYYY-MM-DD as that calendar date at noon UTC. */
export function localDateFromDayKey(dayKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey ?? "").trim());
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
}

/** Unique sorted day keys from timed events plus untimed-only days. */
export function collectSortedProgramDayKeys(args: {
  timed: Array<{ start: Date }>;
  untimedDayKeys: string[];
}): string[] {
  const set = new Set<string>();
  for (const e of args.timed) {
    const s = e.start;
    if (!(s instanceof Date) || !Number.isFinite(s.getTime())) continue;
    set.add(dayKeyLocalFromDate(s));
  }
  for (const k of args.untimedDayKeys) {
    const kk = k.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(kk)) set.add(kk);
  }
  return Array.from(set).sort();
}

/** Split into packs of size N (clamped 1..10). */
export function chunkIntoPacks<T>(items: T[], packSize: number): T[][] {
  const raw = Math.floor(Number(packSize));
  const n = Math.max(1, Math.min(10, Number.isFinite(raw) && raw > 0 ? raw : 5));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Day keys from persisted / API-shaped events (ISO strings). */
export function collectSortedProgramDayKeysFromIso(
  iso: Array<{ kind?: string; start?: string; day?: string; visible?: boolean }>
): string[] {
  const timed: Array<{ start: Date }> = [];
  const utKeys: string[] = [];
  for (const e of iso) {
    if (!(e.visible ?? true)) continue;
    const kind = e.kind ?? "timed";
    if (kind === "timed" && e.start) {
      const d = new Date(e.start);
      if (Number.isFinite(d.getTime())) timed.push({ start: d });
    } else if (kind === "untimed" && e.day) {
      utKeys.push(String(e.day).slice(0, 10));
    }
  }
  return collectSortedProgramDayKeys({ timed: timed as any, untimedDayKeys: utKeys });
}

