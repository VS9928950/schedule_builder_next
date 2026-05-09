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
  orderNo?: number;
  visible?: boolean;
  kind?: "timed" | "untimed";
  day?: string; // ISO date
  start?: string; // ISO
  end?: string; // ISO
  url?: string;
};

type RoomTimedEvent = { id: string; title: string; start: Date; end: Date; dayKey: string };
type RoomUntimedEvent = { id: string; title: string; dayKey: string; orderNo?: number };
type RoomEntry = {
  key: string;
  label: string;
  building: string;
  room: string;
  timed: RoomTimedEvent[];
  untimed: RoomUntimedEvent[];
};

type TimelineLayout = {
  row_heights?: Record<string, Record<string, number>>;
  col_width_px?: Record<string, number>;
  col_count?: Record<string, number>;
  event_overrides?: Record<
    string,
    Record<string, { anchor?: string; col?: number; colSpan?: number; rowSpan?: number; heightPx?: number; hidden?: boolean }>
  >;
  hidden_day_keys?: string[];
};

import { layoutDayLanes, normalizeHttpUrl } from "@/lib/schedule";

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

function normTimeLabelFromDate(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dayKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normToken(v: unknown): string {
  if (v == null) return "";
  const t = String(v).replace(/\s+/g, " ").trim();
  if (!t || t === "-" || t === "—") return "";
  return t;
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

function formatDayHuman(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return dayKey;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
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
          dayKey
        });
      }
    } else if ((ev.kind ?? "timed") === "untimed") {
      entry.untimed.push({
        id: String(ev.id ?? `${dayKey}-untimed`),
        title: String(ev.title ?? "Без названия"),
        dayKey,
        orderNo: typeof ev.orderNo === "number" && Number.isFinite(ev.orderNo) ? ev.orderNo : undefined
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
    const byRoomName = a.room.localeCompare(b.room, "ru-RU");
    if (byRoomName !== 0) return byRoomName;
    return a.building.localeCompare(b.building, "ru-RU");
  });
  return out;
}

function shouldShowFormat(fmt: unknown) {
  const s = fmt == null ? "" : String(fmt).trim();
  if (!s) return false;
  return s !== "Питание";
}

function estimateMinHeightNoDescPx(e: { title?: unknown; format?: unknown; building?: unknown; room?: unknown }, widthPx: number) {
  const innerW = Math.max(80, widthPx - 20);
  const charsPerLine = Math.max(10, Math.floor(innerW / 6));
  const linesFor = (s: string) => Math.max(1, Math.ceil((s || "").length / charsPerLine));

  const titleLines = linesFor(String(e.title ?? ""));
  const formatLines = shouldShowFormat(e.format) ? linesFor(String(e.format)) : 0;
  const timeLines = 1;
  const placeLines = e.building || e.room ? 1 : 0;

  const totalLines = titleLines + formatLines + timeLines + placeLines;
  const lineH = 16;
  const padding = 28;
  const borders = 6;
  return padding + totalLines * lineH + borders + 12;
}

function yForAnchor(idx: number, heights: number[]) {
  let y = 0;
  for (let i = 0; i < idx; i++) y += heights[i] ?? 0;
  return y;
}

function normalizeTimeLabel(s: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function buildTildaSnippet(args: {
  projectName: string;
  events: IsoEvent[];
  marksByDay: Record<string, string[]>;
  timelineLayout: TimelineLayout | null;
  timelineStyle?: {
    eventBgColor?: string;
    eventBgAlpha?: number;
    eventBorderColor?: string;
    eventBorderAlpha?: number;
    // back-compat (raw strings)
    eventBg?: string;
    eventBorder?: string;
    eventLinkTarget?: "_blank" | "_self";
  } | null;
  scopeSelector?: string | null; // e.g. "#rec123456"
  onlyDayKey?: string | null; // YYYY-MM-DD (optional)
  view?: string | null;
  roomsMode?: "occupancy" | "events";
  /** Default: inherit site fonts. `tilda-sans` forces Tilda Sans for layout checks. */
  fontMode?: "inherit" | "tilda-sans";
}) {
  const { projectName, events, marksByDay, timelineLayout, timelineStyle, scopeSelector, onlyDayKey, fontMode, view, roomsMode } = args;
  const layout = timelineLayout ?? {};
  const eventOverrides = layout.event_overrides ?? {};

  const timed = events
    .filter((e) => (e.visible ?? true) && (e.kind ?? "timed") === "timed" && e.start && e.end)
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
    const timedForDays = events
      .filter((e) => (e.visible ?? true) && (e.kind ?? "timed") === "timed" && e.start && e.end)
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
        ...events
          .filter((e) => (e.visible ?? true) && (e.kind ?? "timed") === "untimed" && e.day)
          .map((e) => String(e.day).slice(0, 10))
      ])
    )
      .sort()
      .filter((d) => !hiddenDay.has(d));
    const selectedDayKeys = new Set(onlyDayKey ? allDayKeys.filter((d) => d === onlyDayKey) : allDayKeys);
    const entries = buildRoomsEntries(events, selectedDayKeys);
    const mode = roomsMode === "events" ? "events" : "occupancy";

    const css = `
/* Tilda snippet: ${esc(projectName)} rooms export */
${rootSel}{
  --sb-text:#0f172a;
  --sb-muted:rgba(15,23,42,.62);
  --sb-border:rgba(15,23,42,.12);
  --sb-card-bg:#fff;
  ${fontMode === "tilda-sans" ? `font-family:"Tilda Sans",system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;` : `/* font: inherit from Tilda page */`}
  color:var(--sb-text);
}
${rootSel} .sb-title{font-size:20px;line-height:1.2;font-weight:800;margin:0 0 10px}
${rootSel} .sb-meta{font-size:13px;color:var(--sb-muted);margin:0 0 14px}
${rootSel} .sb-rooms{display:grid;gap:10px}
${rootSel} .sb-room{border:1px solid var(--sb-border);border-radius:12px;background:var(--sb-card-bg);padding:10px}
${rootSel} .sb-room-head{font-size:15px;line-height:1.3;font-weight:800}
${rootSel} .sb-lines{display:grid;gap:4px;margin-top:6px}
${rootSel} .sb-line{font-size:12px;line-height:1.35;color:var(--sb-muted)}
${rootSel} .sb-day{font-weight:700;color:var(--sb-text)}
`.trim();

    let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;
    html += `<h2 class="sb-title">Аудитории</h2>\n`;
    html += `<div class="sb-meta">Вид: ${mode === "occupancy" ? "перечень аудиторий с временем занятости" : "перечень аудиторий со списками мероприятий"}. Период: ${
      onlyDayKey ? esc(formatDayHuman(onlyDayKey)) : "Все дни"
    }.</div>\n`;

    if (!entries.length) {
      html += `<div class="sb-line">Нет данных по аудиториям для выбранного периода.</div>\n`;
      html += `</div>`;
      return { html, css };
    }

    html += `<div class="sb-rooms">\n`;
    for (const entry of entries) {
      html += `<div class="sb-room">\n`;
      html += `<div class="sb-room-head">${esc(entry.label)}</div>\n`;

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
          for (const dk of Array.from(grouped.keys()).sort()) {
            html += `<div class="sb-line"><span class="sb-day">${esc(formatDayHuman(dk))}</span>: ${esc(grouped.get(dk)!.join(", "))}</div>\n`;
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
            html += `<div class="sb-line"><span class="sb-day">${esc(formatDayHuman(dk))}</span></div>\n`;
            const list = grouped.get(dk) ?? [];
            const ordered = [...list].sort((a, b) => {
              const aIsTimed = "start" in a;
              const bIsTimed = "start" in b;
              if (aIsTimed && bIsTimed) return a.start.getTime() - b.start.getTime();
              if (aIsTimed) return -1;
              if (bIsTimed) return 1;
              return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
            });
            for (const ev of ordered) {
              if ("start" in ev) {
                html += `<div class="sb-line">${esc(formatTime(ev.start))}-${esc(formatTime(ev.end))} — ${esc(ev.title)}</div>\n`;
              } else {
                html += `<div class="sb-line">Без времени — ${esc(ev.title)}</div>\n`;
              }
            }
          }
          html += `</div>\n`;
        }
      }

      html += `</div>\n`;
    }
    html += `</div>\n`;
    html += `</div>`;

    return { html, css };
  }

  const defaultTileBg =
    (timelineStyle?.eventBgColor ? rgbaFrom(timelineStyle.eventBgColor, timelineStyle.eventBgAlpha ?? 1) : null) ??
    (typeof timelineStyle?.eventBg === "string" && timelineStyle.eventBg.trim() ? timelineStyle.eventBg.trim() : null) ??
    "rgba(37,99,235,.08)";
  const defaultTileBorder =
    (timelineStyle?.eventBorderColor
      ? rgbaFrom(timelineStyle.eventBorderColor, timelineStyle.eventBorderAlpha ?? 1)
      : null) ??
    (typeof timelineStyle?.eventBorder === "string" && timelineStyle.eventBorder.trim()
      ? timelineStyle.eventBorder.trim()
      : null) ??
    "rgba(37,99,235,.18)";

  const fontStack =
    fontMode === "tilda-sans"
      ? `font-family:"Tilda Sans",system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;`
      : `/* font: inherit from Tilda page */`;

  const css = `
/* Tilda snippet: ${esc(projectName)} */
${rootSel}{
  --sb-text:#0f172a;
  --sb-muted:rgba(15,23,42,.58);
  --sb-border:rgba(15,23,42,.12);
  --sb-gridBg:rgba(15,23,42,.02);
  --sb-tileBorder:${esc(defaultTileBorder)};
  --sb-tileBg:${esc(defaultTileBg)};
  --sb-shadow:0 10px 26px rgba(15,23,42,.10);
  ${fontStack}
  color:var(--sb-text);
}
${rootSel} .sb-day{margin:18px 0 26px}
${rootSel} .sb-grid{position:relative;border:1px solid var(--sb-border);border-radius:14px;background:var(--sb-gridBg);overflow:hidden;max-width:100%}
${rootSel} .sb-timeCol{position:absolute;left:0;top:0;bottom:0;width:56px;background:linear-gradient(to right,rgba(255,255,255,.65),rgba(255,255,255,0))}
${rootSel} .sb-time{position:absolute;left:0;transform:translateY(-50%);font-size:12px;color:var(--sb-muted);width:52px;text-align:right;padding-right:6px;box-sizing:border-box;white-space:nowrap}
${rootSel} .sb-scroll{position:relative;margin-left:56px;height:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
${rootSel} .sb-inner{position:relative;display:inline-block;min-height:100%}
${rootSel} .sb-line{position:absolute;left:0;right:0;border-top:1px dashed var(--sb-border);pointer-events:none}
${rootSel} .sb-tile{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;padding:9px 10px;border-radius:12px;border:1px solid var(--sb-tileBorder);background:var(--sb-tileBg);box-shadow:var(--sb-shadow);overflow:hidden}
${rootSel} .sb-title{font-weight:850;font-size:13px;line-height:1.22;letter-spacing:.1px}
${rootSel} a.sb-title{color:inherit;text-decoration:none}
${rootSel} a.sb-title:hover{text-decoration:underline}
${rootSel} .sb-format,${rootSel} .sb-timeRange,${rootSel} .sb-place{margin-top:6px;font-size:11px;color:var(--sb-muted)}
${rootSel} .sb-desc{margin-top:6px;font-size:12px;line-height:1.3;opacity:.92;white-space:pre-line}
@media (max-width: 768px){
  ${rootSel} .sb-grid{height:auto !important}
  ${rootSel} .sb-timeCol{display:none}
  ${rootSel} .sb-scroll{margin-left:0;overflow:visible;height:auto !important}
  ${rootSel} .sb-inner{height:auto !important;min-width:0 !important;width:100% !important;display:block !important;padding:10px 12px 12px;box-sizing:border-box}
  ${rootSel} .sb-line{display:none !important}
  ${rootSel} .sb-tile{position:relative !important;top:auto !important;left:auto !important;width:auto !important;height:auto !important;min-height:52px;margin:0 0 10px}
  ${rootSel} .sb-title{font-size:12.5px}
}
@media print{
  ${rootSel}{color:#000}
  ${rootSel} .sb-day{break-inside:avoid-page;page-break-inside:avoid}
  ${rootSel} .sb-grid{box-shadow:none;border-color:#cbd5e1;background:#fff}
  ${rootSel} .sb-timeCol{background:none}
  ${rootSel} .sb-scroll{overflow:visible}
  ${rootSel} .sb-tile{box-shadow:none}
}
`.trim();

  let html = `<div class="sb-wrap" data-sb-scope="${esc(internalScopeId)}">\n`;
  // Intentionally no top-level "Export"/project header in the snippet:
  // Tilda pages usually provide their own headings; we export only the layout block.

  const linkTarget = timelineStyle?.eventLinkTarget === "_self" ? "_self" : "_blank";

  for (const dayKey of daysToExport) {
    const dayEvents = timed.filter((e) => dayKeyFromDate(e.startD) === dayKey);
    const markTokens = marksByDay[dayKey] ?? [];
    const hiddenBaseMarks = new Set<string>();
    const manualMarks: string[] = [];
    for (const token of markTokens) {
      const s = String(token ?? "").trim();
      if (!s) continue;
      if (s.startsWith("!")) {
        const t = normalizeTimeLabel(s.slice(1));
        if (t) hiddenBaseMarks.add(t);
        continue;
      }
      const t = normalizeTimeLabel(s);
      if (t) manualMarks.push(t);
    }

    // Build layout like Timeline does (so columns are distributed, not all col=0).
    const scheduleEvents = dayEvents.map((e) => ({
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
      end: e.endD
    }));
    const dayDate = new Date(dayKey + "T00:00:00.000Z");
    const dayLayout = layoutDayLanes(dayDate, scheduleEvents as any);

    const labelForAbsMin = (absMin: number) => {
      const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
      const mm = String(absMin % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    };

    const anchorsSet = new Set<string>();
    for (const it of dayLayout.items) {
      const t = labelForAbsMin(dayLayout.dayStartMin + it.topMin);
      if (!hiddenBaseMarks.has(t)) anchorsSet.add(t);
    }
    for (const m of manualMarks) anchorsSet.add(m);
    const anchors = Array.from(anchorsSet).sort();
    if (!anchors.length) continue;

    const colPx = Math.floor((layout.col_width_px?.[dayKey] ?? 240) as number);
    const colsAuto = Math.max(1, Math.min(64, Math.floor((dayLayout.maxCols ?? 1) as number)));
    const cols = Math.max(1, Math.min(64, Math.floor((layout.col_count?.[dayKey] ?? colsAuto) as number)));

    const MIN_ANCHOR_PX = 18;
    const ANCHOR_PAD_PX = 18;

    // Build boxes with the same semantics as TimelineViewer (defaults + overrides).
    const boxesRaw = (dayLayout.items as any[]).map((it) => {
      const ev = it.event as any;
      const evId = String(ev.id ?? "");
      const ov = eventOverrides?.[dayKey]?.[evId] ?? {};
      const startD = new Date(ev.start);
      const endD = new Date(ev.end);
      const defaultAnchor = labelForAbsMin(dayLayout.dayStartMin + Number(it.topMin ?? 0));
      const anchorWanted = (ov.anchor ?? defaultAnchor).trim();
      const anchorIdxWanted = anchors.indexOf(anchorWanted);
      const defaultIdx = Math.max(0, anchors.indexOf(defaultAnchor));
      const anchorIdx = anchorIdxWanted >= 0 ? anchorIdxWanted : defaultIdx;

      const colDefault = Number.isFinite(it.clusterIndex)
        ? Math.max(0, Math.min(cols - 1, Math.floor(it.clusterIndex)))
        : 0;
      const desiredCol = Math.max(0, Math.min(cols - 1, Math.floor(ov.col ?? colDefault)));
      const desiredColSpan = Math.max(1, Math.min(cols, Math.floor(ov.colSpan ?? 1)));
      const desiredRowSpan = Math.max(1, Math.min(anchors.length - anchorIdx, Math.floor(ov.rowSpan ?? 1)));

      const hidden = !!ov.hidden;
      const minNoDesc = estimateMinHeightNoDescPx(ev, colPx);
      const heightPx = typeof ov.heightPx === "number" && Number.isFinite(ov.heightPx) ? Math.max(30, ov.heightPx) : null;

      return {
        it,
        ev,
        evId,
        ov,
        hidden,
        startD,
        endD,
        defaultAnchor,
        anchorWanted,
        anchorIdx,
        desiredCol,
        col: desiredCol,
        colSpan: desiredColSpan,
        rowSpan: desiredRowSpan,
        minNoDesc,
        heightPx
      };
    });

    // Packing (kanban behavior): within a row (same anchorIdx), if multiple tiles want the same column,
    // shift later tiles right to the nearest free column, considering colSpan.
    const boxesPacked = (() => {
      const byAnchor = new Map<number, typeof boxesRaw>();
      for (const b of boxesRaw) {
        if (b.hidden) continue;
        const arr = byAnchor.get(b.anchorIdx) ?? [];
        arr.push(b);
        byAnchor.set(b.anchorIdx, arr as any);
      }
      const out = boxesRaw.map((b) => ({ ...b }));
      for (const [aIdx, arr] of byAnchor.entries()) {
        const used = new Set<number>();
        const sorted = arr
          .slice()
          .sort(
            (x, y) =>
              (Number(x.desiredCol ?? 0) - Number(y.desiredCol ?? 0)) ||
              String(x.evId ?? "").localeCompare(String(y.evId ?? ""))
          );
        for (const b of sorted) {
          const colsN = Math.max(1, cols);
          const span = Math.max(1, Math.min(colsN, Number.isFinite(b.colSpan) ? b.colSpan : 1));
          let c = Math.max(0, Math.min(colsN - 1, Number.isFinite(b.desiredCol) ? b.desiredCol : 0));
          const fitsAt = (col: number) => {
            if (col < 0) return false;
            if (col + span > colsN) return false;
            for (let k = 0; k < span; k++) if (used.has(col + k)) return false;
            return true;
          };
          while (c < colsN && !fitsAt(c)) c++;
          if (c >= colsN || !fitsAt(c)) c = Math.max(0, colsN - span);
          for (let k = 0; k < span; k++) used.add(c + k);
          const idx = out.findIndex((z) => z.evId === b.evId && z.anchorIdx === aIdx);
          if (idx >= 0) out[idx] = { ...out[idx], col: c, colSpan: span };
        }
      }
      return out;
    })();

    // Row heights: baseline + ensure mandatory content fits, then apply manual overrides.
    let anchorHeights = anchors.map(() => MIN_ANCHOR_PX);
    for (let i = 0; i < anchorHeights.length; i++) {
      const row = boxesPacked.filter((b) => !b.hidden && b.anchorIdx === i);
      if (!row.length) continue;
      const maxNeed = Math.max(...row.map((b) => Number(b.minNoDesc) || 0));
      anchorHeights[i] = Math.max(anchorHeights[i] ?? 0, maxNeed + ANCHOR_PAD_PX);
    }
    const rh = layout.row_heights?.[dayKey];
    if (rh) {
      anchorHeights = anchorHeights.map((h, i) => {
        const ov = rh[anchors[i]!]!;
        return typeof ov === "number" && Number.isFinite(ov) ? Math.max(MIN_ANCHOR_PX, ov) : h;
      });
    }

    // Ensure manual tile height (heightPx) is not clipped: if a tile asks to be taller than its
    // allocated rowSpan height, expand the involved rows so the bottom fits inside the grid.
    // This matches the "detached architecture" expectation that resizing height affects export.
    for (const b of boxesPacked) {
      if (b.hidden) continue;
      if (typeof b.heightPx !== "number" || !Number.isFinite(b.heightPx)) continue;
      const aIdx = Math.max(0, Math.min(anchors.length - 1, Math.floor(b.anchorIdx ?? 0)));
      const span = Math.max(1, Math.min(anchors.length - aIdx, Math.floor(b.rowSpan ?? 1)));
      const want = Math.max(30, b.heightPx) + 4;
      const have = anchorHeights.slice(aIdx, aIdx + span).reduce((sum, x) => sum + (x ?? 0), 0);
      if (want > have) {
        const add = want - have;
        const last = aIdx + span - 1;
        anchorHeights[last] = Math.max(MIN_ANCHOR_PX, (anchorHeights[last] ?? MIN_ANCHOR_PX) + add);
      }
    }

    const gridH = anchorHeights.reduce((a, x) => a + (x ?? 0), 0) + 16;
    const gridW = cols * colPx;

    html += `<div class="sb-day">\n`;
    html += `<div class="sb-grid" style="height:${gridH}px">\n`;
    html += `<div class="sb-timeCol">\n`;
    for (let i = 0; i < anchors.length; i++) {
      const y = yForAnchor(i, anchorHeights) + 8;
      html += `<div class="sb-time" style="top:${y}px">${esc(anchors[i]!)}</div>\n`;
    }
    html += `</div>\n`; // time col
    html += `<div class="sb-scroll">\n`;
    html += `<div class="sb-inner" style="height:${gridH}px;min-width:${gridW}px">\n`;
    for (let i = 0; i < anchors.length; i++) {
      const y = yForAnchor(i, anchorHeights) + 8;
      html += `<div class="sb-line" style="top:${y}px"></div>\n`;
    }

    // place tiles (no React, static absolute). Use packed boxes for consistent columns.
    for (const b of boxesPacked) {
      if (b.hidden) continue;
      const ev = b.ev;
      const startD = b.startD;
      const endD = b.endD;
      const aIdx = Math.max(0, Math.min(anchors.length - 1, Math.floor(b.anchorIdx ?? 0)));
      const col = Math.max(0, Math.min(cols - 1, Math.floor(b.col ?? 0)));
      const colSpan = Math.max(1, Math.min(cols - col, Math.floor(b.colSpan ?? 1)));
      const rowSpan = Math.max(1, Math.min(anchors.length - aIdx, Math.floor(b.rowSpan ?? 1)));

      const y = yForAnchor(aIdx, anchorHeights) + 8;
      const hSpan = anchorHeights.slice(aIdx, aIdx + rowSpan).reduce((a, x) => a + (x ?? 0), 0);
      const baseH = Math.max(30, hSpan - 4);
      const h = typeof b.heightPx === "number" && Number.isFinite(b.heightPx) ? Math.max(30, b.heightPx) : baseH;
      const x = col * colPx + 8;
      const w = colSpan * colPx - 10;

      const place = [ev.building ? String(ev.building).trim() : null, ev.room ? String(ev.room).trim() : null].filter(Boolean).join(" · ");
      const fmt = shouldShowFormat(ev.format) ? String(ev.format).trim() : "";
      const timeRange = `${formatTime(startD)}–${formatTime(endD)}`;
      const desc = String(ev.description_md ?? ev.description ?? "");

      const so = (ev.style_override ?? {}) as any;
      const bg =
        (so.eventBgColor ? rgbaFrom(String(so.eventBgColor), Number(so.eventBgAlpha ?? 1)) : null) ?? null;
      const border =
        (so.eventBorderColor ? rgbaFrom(String(so.eventBorderColor), Number(so.eventBorderAlpha ?? 1)) : null) ?? null;
      const extraStyle = `${bg ? `background:${esc(bg)};` : ""}${border ? `border-color:${esc(border)};` : ""}`;

      html += `<div class="sb-tile" style="top:${y}px;left:${x}px;width:${w}px;height:${h}px;${extraStyle}">\n`;
      const evUrl = normalizeHttpUrl((ev as any).url);
      if (evUrl) {
        const tAttr = linkTarget === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
        html += `<a class="sb-title" href="${esc(evUrl)}"${tAttr}>${esc(ev.title)}</a>\n`;
      } else {
        html += `<div class="sb-title">${esc(ev.title)}</div>\n`;
      }
      if (fmt) html += `<div class="sb-format">${esc(fmt)}</div>\n`;
      html += `<div class="sb-timeRange">${esc(timeRange)}</div>\n`;
      if (desc) html += `<div class="sb-desc">${esc(desc)}</div>\n`;
      if (place) html += `<div class="sb-place">${esc(place)}</div>\n`;
      html += `</div>\n`;
    }

    html += `</div>\n</div>\n</div>\n</div>\n`; // inner, scroll, grid, day
  }

  html += `</div>`;

  return { html, css };
}

