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
  volunteersCount?: number;
  vks?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
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
  volunteersCount?: number;
  vks?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
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

function normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = k.replace(/^\s*#\s*/, "").trim();
    out[nk] = v;
  }
  return out;
}

// Excel serial date (1900 system). We use 1899-12-30 baseline (common in JS libs).
function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  return new Date(ms);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function minutesSinceDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
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
      volunteersCount: num(row["Количество волонтеров"]) ?? undefined,
      vks: parseTernary(row["ВКС"]),
      translation: parseTernary(row["Трансляция"]),
      simultaneousInterpretation: parseTernary(row["Синхронный перевод"]),
      orderNo: num(row["№"] ?? row["N"] ?? row["No"] ?? row["Номер"]) ?? undefined,
      visible: true,
      start,
      end
    };
    events.push(ev);
  }

  return normalizeTimedEvents(events);
}

function isFinalNir(format?: string) {
  return (format ?? "").trim() === "Финал конкурса НИР";
}

function normalizeTimedEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  // Keep source events intact. Presentation-layer aggregation (e.g. NIR finals)
  // should happen in viewers (timeline), not in the data normalization step.
  const out = [...events];
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

function mergeFinalNirSameTime(events: ScheduleEvent[]): ScheduleEvent[] {
  const finals: ScheduleEvent[] = [];
  const rest: ScheduleEvent[] = [];
  for (const ev of events) {
    (isFinalNir(ev.format) ? finals : rest).push(ev);
  }
  if (finals.length <= 1) return [...rest, ...finals];

  // Group by day+time range.
  const groups = new Map<string, ScheduleEvent[]>();
  for (const ev of finals) {
    const dayKey = `${ev.start.getFullYear()}-${ev.start.getMonth() + 1}-${ev.start.getDate()}`;
    const key = `${dayKey}|${ev.start.toISOString()}|${ev.end.toISOString()}`;
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }

  const out: ScheduleEvent[] = [...rest];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]!);
      continue;
    }

    const first = arr[0]!;
    const lines = arr
      .slice()
      .sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9))
      .map((e) => {
        const placeParts = [
          e.building != null && String(e.building).trim() ? String(e.building).trim() : null,
          e.room != null && String(e.room).trim() ? String(e.room).trim() : null
        ].filter(Boolean);
        const place = placeParts.length ? ` (${placeParts.join(", ")})` : "";
        return `- ${e.title}${place}`;
      });

    out.push({
      id: `final-nir-${first.start.toISOString()}-${first.end.toISOString()}`,
      title: "Финал конкурса НИР",
      // Put original titles as description list, per requested rule.
      description: lines.join("\n"),
      format: undefined,
      building: undefined,
      room: undefined,
      orderNo: Math.min(...arr.map((x) => x.orderNo ?? 1e9)),
      visible: true,
      start: first.start,
      end: first.end
    });
  }

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
    const volunteersCount = num(row["Количество волонтеров"]) ?? undefined;
    const vks = parseTernary(row["ВКС"]);
    const translation = parseTernary(row["Трансляция"]);
    const simultaneousInterpretation = parseTernary(row["Синхронный перевод"]);

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
        volunteersCount,
        vks,
        translation,
        simultaneousInterpretation,
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
        volunteersCount,
        vks,
        translation,
        simultaneousInterpretation,
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
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function formatDayFull(d: Date): string {
  const s = d.toLocaleDateString("ru-RU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Local calendar day key YYYY-MM-DD (no UTC shift). */
export function dayKeyLocalFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Parse YYYY-MM-DD as local calendar date (noon avoids DST edge cases). */
export function localDateFromDayKey(dayKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey ?? "").trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
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

