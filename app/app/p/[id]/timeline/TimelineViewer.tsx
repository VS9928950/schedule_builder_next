"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  chunkIntoPacks,
  collectSortedProgramDayKeys,
  dayKeyLocalFromDate,
  formatDayFull,
  formatTime,
  layoutDayLanes,
  localDateFromDayKey,
  normalizeHttpUrl
} from "@/lib/schedule";
import { renderMarkdownLite } from "@/lib/markdown-lite";

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
  layout_override?: {
    fullWidth?: boolean;
    stackOthersBelow?: boolean;
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
  vks?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  orderNo?: number;
  visible?: boolean;
  kind?: "timed" | "untimed";
  day?: string; // ISO date for untimed
  start?: string; // ISO
  end?: string; // ISO
  url?: string;
};

export function TimelineViewer({
  events,
  pxPerMin = 2,
  projectId,
  activeBuildId,
  initialMarks,
  initialStyle,
  initialLayout,
  hideControls = false,
  pinnedDayKey = null,
  hidePackChrome = false,
  onActiveDayKeyChange,
  omitDayBanner = false,
  apiBase = "timeline",
  showExtraFields = false
}: {
  events: IsoEvent[];
  pxPerMin?: number;
  projectId: number;
  activeBuildId: number | null;
  initialMarks: Record<string, string[]> | null;
  initialStyle: {
    eveningProgramTitle?: string;
    titleFontPx?: number;
    timeFontPx?: number;
    formatFontPx?: number;
    placeFontPx?: number;

    titleWeight?: number;
    titleItalic?: boolean;
    timeWeight?: number;
    timeItalic?: boolean;
    formatWeight?: number;
    formatItalic?: boolean;
    placeWeight?: number;
    placeItalic?: boolean;

    eventBgColor?: string;
    eventBgAlpha?: number;
    eventBorderColor?: string;
    eventBorderAlpha?: number;
    fieldBgColor?: string;
    fieldBgAlpha?: number;

    // back-compat
    eventBg?: string;
    eventBorder?: string;

    eventLinkTarget?: "_blank" | "_self";
  } | null;
  initialLayout: {
    row_heights?: Record<string, Record<string, number>>;
    col_width_px?: Record<string, number>;
    col_count?: Record<string, number>;
    event_overrides?: Record<
      string,
      Record<string, { anchor?: string; col?: number; colSpan?: number; rowSpan?: number; heightPx?: number; hidden?: boolean }>
    >;
    days_per_pack?: number;
    hidden_day_keys?: string[];
  } | null;
  hideControls?: boolean;
  /** When set, show only this calendar day (YYYY-MM-DD); pack UI omitted if `hidePackChrome`. */
  pinnedDayKey?: string | null;
  hidePackChrome?: boolean;
  onActiveDayKeyChange?: (dayKey: string) => void;
  /** Скрыть строку с датой и счётчиком (для PDF: заголовок задаётся снаружи). */
  omitDayBanner?: boolean;
  /** Base route for marks/style/layout persistence (e.g. "timeline", "tech-timeline"). */
  apiBase?: string;
  /** Show extra event fields for technical schedule view. */
  showExtraFields?: boolean;
}) {
  const MIN_COL_PX = 180;
  const MAX_COL_PX = 340;
  const GUTTER_PX = 10;
  const INSET_X = 8;
  const INSET_Y = 8;
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const [lanesWidth, setLanesWidth] = useState(0);
  const [autoSaveLayout, setAutoSaveLayout] = useState(true);
  const [styleDraft, setStyleDraft] = useState<{
    eveningProgramTitle: string;
    titleFontPx: number;
    timeFontPx: number;
    formatFontPx: number;
    placeFontPx: number;

    titleWeight: number;
    titleItalic: boolean;
    timeWeight: number;
    timeItalic: boolean;
    formatWeight: number;
    formatItalic: boolean;
    placeWeight: number;
    placeItalic: boolean;

    eventBgColor: string;
    eventBgAlpha: number;
    eventBorderColor: string;
    eventBorderAlpha: number;
    fieldBgColor: string;
    fieldBgAlpha: number;

    eventLinkTarget: "_blank" | "_self";
  }>({
    eveningProgramTitle: "Вечерняя программа",
    titleFontPx: 13,
    timeFontPx: 11,
    formatFontPx: 11,
    placeFontPx: 11,

    titleWeight: 700,
    titleItalic: false,
    timeWeight: 400,
    timeItalic: false,
    formatWeight: 400,
    formatItalic: false,
    placeWeight: 400,
    placeItalic: false,

    eventBgColor: "#60a5fa",
    eventBgAlpha: 0.1,
    eventBorderColor: "#ffffff",
    eventBorderAlpha: 0.14,
    fieldBgColor: "#0f172a",
    fieldBgAlpha: 0.02,

    eventLinkTarget: "_blank"
  });
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [layoutDraft, setLayoutDraft] = useState<{
    row_heights: Record<string, Record<string, number>>;
    col_width_px: Record<string, number>;
    col_count: Record<string, number>;
    event_overrides: Record<
      string,
      Record<string, { anchor?: string; col?: number; colSpan?: number; rowSpan?: number; heightPx?: number; hidden?: boolean }>
    >;
    days_per_pack: number;
    hidden_day_keys: string[];
  }>({
    row_heights: initialLayout?.row_heights ?? {},
    col_width_px: initialLayout?.col_width_px ?? {},
    col_count: initialLayout?.col_count ?? {},
    event_overrides: initialLayout?.event_overrides ?? {},
    days_per_pack:
      typeof initialLayout?.days_per_pack === "number" && Number.isFinite(initialLayout.days_per_pack)
        ? Math.max(1, Math.min(10, Math.floor(initialLayout.days_per_pack)))
        : 5,
    hidden_day_keys: Array.isArray(initialLayout?.hidden_day_keys)
      ? (initialLayout!.hidden_day_keys as string[]).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      : []
  });
  const [layoutEdit, setLayoutEdit] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const layoutLastSavedJsonRef = useRef<string>("");
  const [layoutSavedTick, setLayoutSavedTick] = useState(0);
  const layoutAutoSaveTimerRef = useRef<number | null>(null);
  const layoutHasHydratedRef = useRef(false);
  const [dragRow, setDragRow] = useState<null | { dayKey: string; anchorLabel: string; startY: number; startH: number }>(null);
  const [dragTile, setDragTile] = useState<
    null | {
      dayKey: string;
      eventId: string;
      mode: "move" | "resizeH" | "resizeRowSpan" | "resizeColSpan";
      startX: number;
      startY: number;
      startCol: number;
      startAnchorIdx: number;
      startH: number;
      startRowSpan: number;
      startColSpan: number;
      anchors: string[];
      anchorHeights: number[];
      colPx: number;
      totalCols: number;
    }
  >(null);

  useEffect(() => {
    if (!dragRow) return;
    const SNAP = 10;
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - dragRow.startY;
      const raw = dragRow.startH + dy;
      const snapped = Math.round(raw / SNAP) * SNAP;
      const nextH = Math.max(18, Math.min(5000, snapped));
      setLayoutDraft((prev) => {
        const byDay = { ...(prev.row_heights ?? {}) };
        const rows = { ...(byDay[dragRow.dayKey] ?? {}) };
        rows[dragRow.anchorLabel] = nextH;
        byDay[dragRow.dayKey] = rows;
        return { ...prev, row_heights: byDay };
      });
    };
    const onUp = () => setDragRow(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragRow]);

  useEffect(() => {
    if (!dragTile) return;
    const SNAP_PX = 10;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragTile.startX;
      const dy = ev.clientY - dragTile.startY;
      const sdx = Math.round(dx / SNAP_PX) * SNAP_PX;
      const sdy = Math.round(dy / SNAP_PX) * SNAP_PX;

      setLayoutDraft((prev) => {
        const byDay = { ...(prev.event_overrides ?? {}) };
        const m = { ...(byDay[dragTile.dayKey] ?? {}) };
        const cur = { ...(m[dragTile.eventId] ?? {}) };
        if (dragTile.mode === "resizeH") {
          const nextH = Math.max(30, Math.min(5000, dragTile.startH + sdy));
          cur.heightPx = nextH;
        } else if (dragTile.mode === "resizeColSpan") {
          const delta = dragTile.colPx > 0 ? Math.round(sdx / dragTile.colPx) : 0;
          const nextSpan = Math.max(1, Math.min(dragTile.totalCols, dragTile.startColSpan + delta));
          cur.colSpan = nextSpan;
        } else if (dragTile.mode === "resizeRowSpan") {
          const startTop = yForAnchor(dragTile.startAnchorIdx, dragTile.anchorHeights);
          const targetBottom = Math.max(0, startTop + dragTile.startH + sdy);
          let bestEndIdx = dragTile.startAnchorIdx;
          let bestDist = Infinity;
          for (let i = dragTile.startAnchorIdx; i < dragTile.anchors.length; i++) {
            const yEnd = yForAnchor(i + 1, dragTile.anchorHeights); // bottom of row i
            const d = Math.abs(yEnd - targetBottom);
            if (d < bestDist) {
              bestDist = d;
              bestEndIdx = i;
            }
          }
          const span = Math.max(1, bestEndIdx - dragTile.startAnchorIdx + 1);
          cur.rowSpan = span;
        } else {
          const deltaCol = dragTile.colPx > 0 ? Math.round(sdx / dragTile.colPx) : 0;
          const nextCol = Math.min(Math.max(0, dragTile.startCol + deltaCol), Math.max(0, dragTile.totalCols - 1));

          const startTop = yForAnchor(dragTile.startAnchorIdx, dragTile.anchorHeights);
          const targetY = Math.max(0, startTop + sdy);
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < dragTile.anchors.length; i++) {
            const y = yForAnchor(i, dragTile.anchorHeights);
            const d = Math.abs(y - targetY);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          cur.col = nextCol;
          cur.anchor = dragTile.anchors[bestIdx] ?? cur.anchor;
        }
        m[dragTile.eventId] = cur;
        byDay[dragTile.dayKey] = m;
        return { ...prev, event_overrides: byDay };
      });
    };
    const onUp = () => {
      setDragTile(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragTile]);

  useEffect(() => {
    const el = lanesRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect?.width ?? 0);
      if (Number.isFinite(w) && w > 0) setLanesWidth(w);
    });
    ro.observe(el);

    const w0 = Math.floor(el.getBoundingClientRect().width);
    if (Number.isFinite(w0) && w0 > 0) setLanesWidth(w0);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!initialStyle) return;
    setStyleDraft((prev) => ({
      eveningProgramTitle:
        typeof initialStyle.eveningProgramTitle === "string" && initialStyle.eveningProgramTitle.trim()
          ? initialStyle.eveningProgramTitle.trim()
          : prev.eveningProgramTitle,
      titleFontPx: typeof initialStyle.titleFontPx === "number" ? initialStyle.titleFontPx : prev.titleFontPx,
      timeFontPx: typeof initialStyle.timeFontPx === "number" ? initialStyle.timeFontPx : prev.timeFontPx,
      formatFontPx: typeof initialStyle.formatFontPx === "number" ? initialStyle.formatFontPx : prev.formatFontPx,
      placeFontPx: typeof initialStyle.placeFontPx === "number" ? initialStyle.placeFontPx : prev.placeFontPx,

      titleWeight: typeof initialStyle.titleWeight === "number" ? initialStyle.titleWeight : prev.titleWeight,
      titleItalic: typeof initialStyle.titleItalic === "boolean" ? initialStyle.titleItalic : prev.titleItalic,
      timeWeight: typeof initialStyle.timeWeight === "number" ? initialStyle.timeWeight : prev.timeWeight,
      timeItalic: typeof initialStyle.timeItalic === "boolean" ? initialStyle.timeItalic : prev.timeItalic,
      formatWeight: typeof initialStyle.formatWeight === "number" ? initialStyle.formatWeight : prev.formatWeight,
      formatItalic: typeof initialStyle.formatItalic === "boolean" ? initialStyle.formatItalic : prev.formatItalic,
      placeWeight: typeof initialStyle.placeWeight === "number" ? initialStyle.placeWeight : prev.placeWeight,
      placeItalic: typeof initialStyle.placeItalic === "boolean" ? initialStyle.placeItalic : prev.placeItalic,

      eventBgColor: typeof initialStyle.eventBgColor === "string" ? initialStyle.eventBgColor : prev.eventBgColor,
      eventBgAlpha: typeof initialStyle.eventBgAlpha === "number" ? initialStyle.eventBgAlpha : prev.eventBgAlpha,
      eventBorderColor: typeof initialStyle.eventBorderColor === "string" ? initialStyle.eventBorderColor : prev.eventBorderColor,
      eventBorderAlpha: typeof initialStyle.eventBorderAlpha === "number" ? initialStyle.eventBorderAlpha : prev.eventBorderAlpha,
      fieldBgColor: typeof initialStyle.fieldBgColor === "string" ? initialStyle.fieldBgColor : prev.fieldBgColor,
      fieldBgAlpha: typeof initialStyle.fieldBgAlpha === "number" ? initialStyle.fieldBgAlpha : prev.fieldBgAlpha,

      eventLinkTarget:
        initialStyle.eventLinkTarget === "_self" || initialStyle.eventLinkTarget === "_blank"
          ? initialStyle.eventLinkTarget
          : prev.eventLinkTarget
    }));
  }, [initialStyle]);

  useEffect(() => {
    if (!initialLayout) return;
    setLayoutDraft({
      row_heights: initialLayout.row_heights ?? {},
      col_width_px: initialLayout.col_width_px ?? {},
      col_count: initialLayout.col_count ?? {},
      event_overrides: initialLayout.event_overrides ?? {},
      days_per_pack:
        typeof initialLayout.days_per_pack === "number" && Number.isFinite(initialLayout.days_per_pack)
          ? Math.max(1, Math.min(10, Math.floor(initialLayout.days_per_pack)))
          : 5,
      hidden_day_keys: Array.isArray(initialLayout.hidden_day_keys)
        ? (initialLayout.hidden_day_keys as string[]).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        : []
    });
  }, [initialLayout]);

  useEffect(() => {
    // Mark the current state as "saved" after hydration from props.
    // This lets us show a reliable "unsaved changes" indicator and avoid autosaving on mount.
    const json = JSON.stringify(layoutDraft);
    if (!layoutHasHydratedRef.current) {
      layoutLastSavedJsonRef.current = json;
      layoutHasHydratedRef.current = true;
      setLayoutSavedTick((x) => x + 1);
    }
  }, [layoutDraft]);

  async function saveLayout() {
    if (!activeBuildId) return;
    setSavingLayout(true);
    setLayoutError(null);
    try {
      const resp = await fetch(`/app/p/${projectId}/builds/${apiBase}-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId: activeBuildId, layout: layoutDraft })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      layoutLastSavedJsonRef.current = JSON.stringify(layoutDraft);
      setLayoutSavedTick((x) => x + 1);
    } catch (e: any) {
      setLayoutError(e?.message || "Ошибка сохранения раскладки");
    } finally {
      setSavingLayout(false);
    }
  }

  const hasUnsavedLayout = useMemo(() => {
    try {
      return JSON.stringify(layoutDraft) !== layoutLastSavedJsonRef.current;
    } catch {
      return true;
    }
  }, [layoutDraft, layoutSavedTick]);

  useEffect(() => {
    if (hideControls) return;
    if (!layoutEdit) return;
    if (!autoSaveLayout) return;
    if (!activeBuildId) return;
    if (!layoutHasHydratedRef.current) return;
    if (!hasUnsavedLayout) return;
    if (savingLayout) return;

    if (layoutAutoSaveTimerRef.current != null) {
      window.clearTimeout(layoutAutoSaveTimerRef.current);
      layoutAutoSaveTimerRef.current = null;
    }

    // Debounced autosave after interactions settle.
    layoutAutoSaveTimerRef.current = window.setTimeout(() => {
      layoutAutoSaveTimerRef.current = null;
      void saveLayout();
    }, 900);

    return () => {
      if (layoutAutoSaveTimerRef.current != null) {
        window.clearTimeout(layoutAutoSaveTimerRef.current);
        layoutAutoSaveTimerRef.current = null;
      }
    };
    // NOTE: saveLayout is stable enough for this component; we intentionally omit it from deps
    // to keep the debounce behavior predictable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDraft, hideControls, layoutEdit, autoSaveLayout, activeBuildId, hasUnsavedLayout, savingLayout]);

  async function saveStyle() {
    if (!activeBuildId) return;
    setSavingStyle(true);
    setStyleError(null);
    try {
      const resp = await fetch(`/app/p/${projectId}/builds/${apiBase}-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildId: activeBuildId,
          style: {
            eveningProgramTitle: styleDraft.eveningProgramTitle.trim() || "Вечерняя программа",
            titleFontPx: styleDraft.titleFontPx,
            timeFontPx: styleDraft.timeFontPx,
            formatFontPx: styleDraft.formatFontPx,
            placeFontPx: styleDraft.placeFontPx,

            titleWeight: styleDraft.titleWeight,
            titleItalic: styleDraft.titleItalic,
            timeWeight: styleDraft.timeWeight,
            timeItalic: styleDraft.timeItalic,
            formatWeight: styleDraft.formatWeight,
            formatItalic: styleDraft.formatItalic,
            placeWeight: styleDraft.placeWeight,
            placeItalic: styleDraft.placeItalic,

            eventBgColor: styleDraft.eventBgColor,
            eventBgAlpha: styleDraft.eventBgAlpha,
            eventBorderColor: styleDraft.eventBorderColor,
            eventBorderAlpha: styleDraft.eventBorderAlpha,
            fieldBgColor: styleDraft.fieldBgColor,
            fieldBgAlpha: styleDraft.fieldBgAlpha,

            eventLinkTarget: styleDraft.eventLinkTarget
          }
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
    } catch (e: any) {
      setStyleError(e?.message || "Ошибка сохранения стилей");
    } finally {
      setSavingStyle(false);
    }
  }

  const eveningProgramTitle = styleDraft.eveningProgramTitle.trim() || "Вечерняя программа";

  function hexToRgb(hex: string) {
    const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex.trim());
    if (!m) return null;
    return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
  }

  function rgbaFrom(hex: string, a: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const aa = Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1));
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${aa})`;
  }

  function minutesSinceLocalDayStart(d: Date) {
    // Match `lib/schedule.ts` semantics (local clock fields).
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  function shouldShowFormat(fmt: unknown) {
    const s = fmt == null ? "" : String(fmt).trim();
    if (!s) return false;
    return s !== "Питание";
  }

  function extraFieldLines(ev: IsoEvent): string[] {
    const responsibles = [ev.responsible1, ev.responsible2, ev.responsible3, ev.responsible4, ev.responsible5, ev.responsible6]
      .map((x) => (x ?? "").trim())
      .filter(Boolean);
    const teamLead = (ev.teamLead ?? "").trim();
    const lines: string[] = [];
    const pushFlagIfYes = (label: string, value?: "Да" | "Нет" | "Не указано") => {
      if (value === "Да") lines.push(label);
    };
    if (teamLead) lines.push(teamLead);
    if (responsibles.length) lines.push(`Ответственные: ${responsibles.join(", ")}`);
    if (typeof ev.volunteersCount === "number" && Number.isFinite(ev.volunteersCount)) lines.push(`Волонтеры: ${ev.volunteersCount}`);
    pushFlagIfYes("ВКС", ev.vks);
    pushFlagIfYes("Трансляция", ev.translation);
    pushFlagIfYes("Перевод", ev.simultaneousInterpretation);
    return lines;
  }

  function estimateMinHeightPx(e: any, widthPx: number) {
    // Rough text fitting estimate (no DOM measurement).
    // Height is not strictly proportional to time: we ensure enough space for text.
    const innerW = Math.max(80, widthPx - 20);
    const charsPerLine = Math.max(10, Math.floor(innerW / 6)); // pessimistic to avoid clipping
    const linesFor = (s: string) => Math.max(1, Math.ceil((s || "").length / charsPerLine));

    const titleLines = linesFor(String(e.title ?? ""));
    const formatLines = shouldShowFormat(e.format) ? linesFor(String(e.format)) : 0;
    const timeLines = 1;
    const placeLines = e.building || e.room ? 1 : 0;

    let descLines = 0;
    const descSrc = String(e.description_md ?? e.description ?? "");
    if (e.title === "Финал конкурса НИР" && descSrc) {
      descLines = descSrc.split("\n").filter(Boolean).length;
    } else if (descSrc) {
      // we clamp visually, but reserve space so meta lines don't get eaten by borders
      descLines = Math.min(4, linesFor(descSrc));
    }

    const totalLines = titleLines + formatLines + timeLines + placeLines + descLines;
    const lineH = 16; // more realistic with wrapping + spacing
    const padding = 28; // top+bottom padding + internal gaps
    const borders = 6; // border/rounding/shadow overhead
    return padding + totalLines * lineH + borders + 18; // breathing room
  }

  function estimateMinHeightNoDescPx(e: any, widthPx: number) {
    // Like estimateMinHeightPx, but ignores description. Used to ensure
    // title/time/place never get clipped in time-based rows.
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

  function normalizeTime(s: string) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function timeLabelToMinutes(label: string) {
    const t = normalizeTime(label);
    if (!t) return null;
    const [hh, mm] = t.split(":").map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  }

  function yForAnchor(idx: number, heights: number[]) {
    let y = 0;
    for (let i = 0; i < idx; i++) y += heights[i] ?? 0;
    return y;
  }

  const scheduleEvents = useMemo(
    () =>
      (() => {
        const timed = events
          .filter((e) => (e.visible ?? true) && (e.kind ?? "timed") === "timed" && !!e.start && !!e.end)
          .map((e) => ({
            ...e,
            start: new Date(e.start!),
            end: new Date(e.end!)
          }))
          .filter((e) => Number.isFinite(e.start.getTime()) && Number.isFinite(e.end.getTime()) && e.end > e.start)
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        // Presentation-only aggregation for NIR finals:
        // - group parallel events by (day, start, end) when format === "Финал конкурса НИР"
        // - render a single synthetic block in the timeline, but keep original events intact for rooms/checks/editing
        const isFinal = (fmt: unknown) => (fmt == null ? "" : String(fmt).trim()) === "Финал конкурса НИР";
        const finals = timed.filter((e) => isFinal(e.format));
        if (finals.length <= 1) return timed;

        const rest = timed.filter((e) => !isFinal(e.format));
        const groups = new Map<string, typeof finals>();
        for (const ev of finals) {
          const dayKey = `${ev.start.getFullYear()}-${ev.start.getMonth() + 1}-${ev.start.getDate()}`;
          const key = `${dayKey}|${ev.start.toISOString()}|${ev.end.toISOString()}`;
          const arr = groups.get(key) ?? [];
          arr.push(ev);
          groups.set(key, arr as any);
        }

        const out: any[] = [...rest];
        for (const arr of groups.values()) {
          if (arr.length === 1) {
            out.push(arr[0]!);
            continue;
          }
          const first = arr[0]!;
          const lines = arr
            .slice()
            .sort((a, b) => ((a as any).orderNo ?? 1e9) - ((b as any).orderNo ?? 1e9))
            .map((e) => {
              const placeParts = [e.building ? String(e.building).trim() : null, e.room ? String(e.room).trim() : null].filter(Boolean);
              const place = placeParts.length ? ` (${placeParts.join(", ")})` : "";
              return `- ${String(e.title ?? "")}${place}`;
            });
          out.push({
            id: `final-nir-${first.start.toISOString()}-${first.end.toISOString()}`,
            title: "Финал конкурса НИР",
            description: lines.join("\n"),
            description_md: undefined,
            format: undefined,
            building: undefined,
            room: undefined,
            orderNo: Math.min(...arr.map((x: any) => x.orderNo ?? 1e9)),
            visible: true,
            kind: "timed",
            start: first.start,
            end: first.end
          });
        }

        out.sort((a, b) => a.start.getTime() - b.start.getTime());
        return out;
      })(),
    [events]
  );

  const untimedByDay = useMemo(() => {
    const map = new Map<string, IsoEvent[]>();
    for (const e of events) {
      if (!(e.visible ?? true) || (e.kind ?? "timed") !== "untimed" || !e.day) continue;
      const key = e.day.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9));
      map.set(k, arr);
    }
    return map;
  }, [events]);

  const hiddenDaySet = useMemo(
    () =>
      new Set(
        (layoutDraft.hidden_day_keys ?? [])
          .map((k) => k.slice(0, 10))
          .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      ),
    [layoutDraft.hidden_day_keys]
  );

  const packSizeClamped = Math.max(1, Math.min(10, Math.floor(Number(layoutDraft.days_per_pack)) || 5));

  const programDayKeysAll = useMemo(
    () =>
      collectSortedProgramDayKeys({
        timed: scheduleEvents,
        untimedDayKeys: Array.from(untimedByDay.keys())
      }),
    [scheduleEvents, untimedByDay]
  );

  const programDayKeys = useMemo(() => {
    const pin = pinnedDayKey?.trim().slice(0, 10);
    if (pin && /^\d{4}-\d{2}-\d{2}$/.test(pin)) {
      return hiddenDaySet.has(pin) ? [] : [pin];
    }
    return programDayKeysAll.filter((k) => !hiddenDaySet.has(k));
  }, [programDayKeysAll, hiddenDaySet, pinnedDayKey]);

  const packs = useMemo(() => chunkIntoPacks(programDayKeys, packSizeClamped), [programDayKeys, packSizeClamped]);

  const [packIdx, setPackIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const [marksByDay, setMarksByDay] = useState<Record<string, string[]>>(initialMarks ?? {});
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksError, setMarksError] = useState<string | null>(null);

  useEffect(() => {
    setPackIdx((i) => Math.min(i, Math.max(0, packs.length - 1)));
  }, [packs.length]);

  useEffect(() => {
    setDayIdx(0);
    setPackIdx(0);
  }, [events, packSizeClamped, pinnedDayKey]);

  useEffect(() => {
    const cur = packs[packIdx] ?? [];
    setDayIdx((d) => Math.min(d, Math.max(0, cur.length - 1)));
  }, [packIdx, packs]);

  useEffect(() => {
    if (initialMarks) setMarksByDay(initialMarks);
  }, [initialMarks]);

  const currentPack = packs[packIdx] ?? [];
  const selectedDayKey =
    currentPack.length > 0 ? currentPack[Math.min(dayIdx, Math.max(0, currentPack.length - 1))]! : "";

  const daysToShow = selectedDayKey
    ? [
        {
          day: localDateFromDayKey(selectedDayKey),
          events: scheduleEvents.filter((e) => dayKeyLocalFromDate(e.start) === selectedDayKey)
        }
      ]
    : [];

  useEffect(() => {
    if (selectedDayKey && onActiveDayKeyChange) onActiveDayKeyChange(selectedDayKey);
  }, [selectedDayKey, onActiveDayKeyChange]);

  async function saveMarks(dayKey: string) {
    if (!activeBuildId) return;
    setSavingMarks(true);
    setMarksError(null);
    try {
      const resp = await fetch(`/app/p/${projectId}/builds/${apiBase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId: activeBuildId, marks: marksByDay })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
    } catch (e: any) {
      setMarksError(e?.message || "Ошибка сохранения меток");
    } finally {
      setSavingMarks(false);
    }
  }

  if (!programDayKeysAll.length) {
    return (
      <div className="muted">
        Нет строк на листе «Перечень» (или документ не выбран). Загрузите шаблон на вкладке «Документы» и сохраните версию сборки.
      </div>
    );
  }

  if (!programDayKeys.length) {
    return (
      <div className="muted">
        Все дни скрыты в этой версии сборки. Нажмите «Сбросить скрытые дни» в настройках пачки или выберите другую версию.
      </div>
    );
  }

  return (
    <div
      className="grid"
      style={{
        gap: 12,
        ["--tl-title-font-px" as any]: `${styleDraft.titleFontPx}px`,
        ["--tl-time-font-px" as any]: `${styleDraft.timeFontPx}px`,
        ["--tl-format-font-px" as any]: `${styleDraft.formatFontPx}px`,
        ["--tl-place-font-px" as any]: `${styleDraft.placeFontPx}px`,

        ["--tl-title-font-weight" as any]: String(styleDraft.titleWeight),
        ["--tl-title-font-style" as any]: styleDraft.titleItalic ? "italic" : "normal",
        ["--tl-time-font-weight" as any]: String(styleDraft.timeWeight),
        ["--tl-time-font-style" as any]: styleDraft.timeItalic ? "italic" : "normal",
        ["--tl-format-font-weight" as any]: String(styleDraft.formatWeight),
        ["--tl-format-font-style" as any]: styleDraft.formatItalic ? "italic" : "normal",
        ["--tl-place-font-weight" as any]: String(styleDraft.placeWeight),
        ["--tl-place-font-style" as any]: styleDraft.placeItalic ? "italic" : "normal",

        ["--tl-event-bg" as any]: rgbaFrom(styleDraft.eventBgColor, styleDraft.eventBgAlpha) ?? "rgba(37,99,235,.08)",
        ["--tl-event-border" as any]: rgbaFrom(styleDraft.eventBorderColor, styleDraft.eventBorderAlpha) ?? "rgba(37,99,235,.22)",
        ["--tl-lanes-bg" as any]: rgbaFrom(styleDraft.fieldBgColor, styleDraft.fieldBgAlpha) ?? "rgba(15,23,42,.02)"
      }}
    >
      {!hidePackChrome && currentPack.length ? (
        <div className="tl-day-tabs card" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {showExtraFields ? "Период" : "Пачка"}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={packIdx <= 0}
                onClick={() => setPackIdx((i) => Math.max(0, i - 1))}
                title="Предыдущая пачка дней"
              >
                ←
              </button>
              <span className="chip">
                {packIdx + 1} / {Math.max(1, packs.length)}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={packIdx >= packs.length - 1}
                onClick={() => setPackIdx((i) => Math.min(packs.length - 1, i + 1))}
                title="Следующая пачка дней"
              >
                →
              </button>
            </div>
            {!hideControls && activeBuildId ? (
              <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="row muted" style={{ gap: 6, fontSize: 12 }}>
                  {showExtraFields ? "Дней в периоде (От 1 до 10)" : "Дней в пачке (N, до 10)"}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={packSizeClamped}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(10, Math.floor(Number(e.target.value)) || 5));
                      setLayoutDraft((p) => ({ ...p, days_per_pack: v }));
                    }}
                    style={{ width: 64 }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={!(layoutDraft.hidden_day_keys && layoutDraft.hidden_day_keys.length)}
                  onClick={() => setLayoutDraft((p) => ({ ...p, hidden_day_keys: [] }))}
                  title="Показать все дни снова в сетке"
                >
                  Сбросить скрытые дни
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ height: 10 }} />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {currentPack.map((dk, i) => {
              const d = localDateFromDayKey(dk);
              return (
                <button key={dk} type="button" className={i === dayIdx ? "" : "secondary"} onClick={() => setDayIdx(i)}>
                  {Number.isFinite(d.getTime()) ? formatDayFull(d) : dk}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {daysToShow.map(({ day, events }) => {
          const dayDate = day instanceof Date ? day : new Date(day as any);
          const layout = layoutDayLanes(dayDate, events);
          const totalColsAuto = Math.max(1, layout.maxCols || 1);
          const dayKey = Number.isFinite(dayDate.getTime()) ? dayKeyLocalFromDate(dayDate) : "";
          const manualColsRaw = dayKey ? layoutDraft.col_count?.[dayKey] : undefined;
          const manualCols =
            typeof manualColsRaw === "number" && Number.isFinite(manualColsRaw) ? Math.floor(manualColsRaw) : null;
          const totalCols = manualCols != null ? Math.max(1, Math.min(64, manualCols)) : totalColsAuto;
          // If there is enough space, fit columns into the visible container width to avoid horizontal scrollbar.
          // If there isn't (too many parallel lanes), keep MIN_COL_PX and allow horizontal scroll.
          const usableWidth = Math.max(0, lanesWidth - INSET_X * 2);
          const fittedColPx = usableWidth > 0 ? Math.floor(usableWidth / totalCols) : MIN_COL_PX;
          const manualColPxRaw = dayKey ? layoutDraft.col_width_px?.[dayKey] : undefined;
          const manualColPx =
            typeof manualColPxRaw === "number" && Number.isFinite(manualColPxRaw) ? Math.floor(manualColPxRaw) : null;
          const colPx = manualColPx != null ? Math.max(120, Math.min(1200, manualColPx)) : Math.max(MIN_COL_PX, Math.min(MAX_COL_PX, fittedColPx));
          const gridMinWidth = totalCols * colPx;
          const manualMarks = dayKey ? (marksByDay[dayKey] ?? []) : [];
          const dayEventOverrides = dayKey ? layoutDraft.event_overrides?.[dayKey] : undefined;

          // Build anchors (time marks):
          // - always include all event start times
          // - include user marks (manual)
          const anchors = (() => {
            const set = new Set<string>();
            const labelFor = (absMin: number) => {
              const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
              const mm = String(absMin % 60).padStart(2, "0");
              return `${hh}:${mm}`;
            };
            for (const it of layout.items) {
              const absMin = layout.dayStartMin + it.topMin;
              set.add(labelFor(absMin));
            }
            for (const m of manualMarks) {
              const t = normalizeTime(m);
              if (t) set.add(t);
            }
            const arr = Array.from(set).sort();
            return arr;
          })();

          const MIN_ANCHOR_PX = 18; // grid row minimum
          const ANCHOR_PAD_PX = 18;
          const safeDayStartMin = Number.isFinite(layout.dayStartMin) ? layout.dayStartMin : 0;
          // NOTE: Geometry is grid-based (not real-time-based). Time is for labels only.

          const boxes = layout.items.map((it) => {
            const cols = Math.max(1, it.clusterCols || 1);
            const idx = Math.min(Math.max(0, it.clusterIndex || 0), cols - 1);
            const colW = gridMinWidth / cols;
            const leftPx = idx * colW;
            const widthPx = colW;

            const ovLayout = (it.event as any).layout_override as { fullWidth?: boolean; stackOthersBelow?: boolean } | undefined;
            // Auto rule for "Финал конкурса НИР":
            // - full-width only when it is the only event for that exact time range (same start+end)
            // - otherwise (peers with same time range exist), keep normal column layout (split the row)
            const isNirFinal = String((it.event as any).title ?? "") === "Финал конкурса НИР";
            const sMs = it.event.start.getTime();
            const eMs = it.event.end.getTime();
            const sameRangePeers = layout.items.filter((x) => x.event.start.getTime() === sMs && x.event.end.getTime() === eMs).length;
            // Also: if anything else starts at the same *timeline anchor* (same start minute on this day),
            // do NOT auto full-width — otherwise other cards will be drawn on top of a full-width block.
            const startMin = minutesSinceLocalDayStart(it.event.start);
            const sameStartAnchorPeers = layout.items.filter((x) => minutesSinceLocalDayStart(x.event.start) === startMin).length;
            const autoFullWidth = isNirFinal && sameRangePeers <= 1 && sameStartAnchorPeers <= 1;

            const isFullWidth = typeof ovLayout?.fullWidth === "boolean" ? ovLayout.fullWidth : autoFullWidth;
            const stackOthersBelow = (ovLayout?.stackOthersBelow ?? true) && isFullWidth;

            const heightWidthPx = isFullWidth ? gridMinWidth : widthPx;
            const minH = estimateMinHeightPx(it.event, heightWidthPx);
            const minNoDescH = estimateMinHeightNoDescPx(it.event, heightWidthPx);
            const isFood = String(it.event.format ?? "").trim() === "Питание";
            // Grid rule: height comes from content (time is displayed as text only).
            // For food blocks ("Питание") we keep a compact header-only height (no description influence).
            const height = isFood ? Math.max(54, minNoDescH) : minH;

            const absMin = layout.dayStartMin + it.topMin;
            const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
            const mm = String(absMin % 60).padStart(2, "0");
            const label = `${hh}:${mm}`;
            const evId = String((it.event as any).id ?? "");
            const ov = dayEventOverrides && evId ? dayEventOverrides[evId] : undefined;
            const anchorLabel = typeof ov?.anchor === "string" && ov.anchor.trim() ? ov.anchor.trim() : label;
            const anchorIdx = Math.max(0, anchors.indexOf(anchorLabel));
            const hidden = !!ov?.hidden;
            const heightFinal = typeof ov?.heightPx === "number" && Number.isFinite(ov.heightPx) ? Math.max(30, ov.heightPx) : height;
            const rowSpan = typeof ov?.rowSpan === "number" && Number.isFinite(ov.rowSpan) ? Math.max(1, Math.floor(ov.rowSpan)) : 1;
            const colSpan = typeof ov?.colSpan === "number" && Number.isFinite(ov.colSpan) ? Math.max(1, Math.floor(ov.colSpan)) : 1;

            // Column override (snap to grid cols)
            const colsN = Math.max(1, totalCols);
            const desiredCol =
              typeof ov?.col === "number" && Number.isFinite(ov.col) ? Math.min(Math.max(0, Math.floor(ov.col)), colsN - 1) : idx;
            const desiredColClamped = Math.min(Math.max(0, desiredCol), Math.max(0, colsN - 1));
            const leftPxFinal = desiredColClamped * colPx;
            const widthPxFinal = colPx;

            return {
              it,
              anchorIdx: anchorIdx >= 0 ? anchorIdx : 0,
              height: heightFinal,
              minNoDescH,
              leftPx: leftPxFinal,
              widthPx: widthPxFinal,
              isFullWidth,
              stackOthersBelow,
              sMs,
              eMs,
              isFood,
              hidden,
              desiredCol: desiredColClamped,
              rowSpan,
              colSpan
            };
          });

          // Collision avoidance (kanban behavior): within a row (same anchorIdx),
          // if multiple tiles want the same column, shift later tiles right to the nearest free column.
          const boxesPacked = (() => {
            const byAnchor = new Map<number, any[]>();
            for (const b of boxes as any[]) {
              if (b.hidden) continue;
              if (b.isFullWidth) continue; // full-width doesn't participate in column packing
              const arr = byAnchor.get(b.anchorIdx) ?? [];
              arr.push(b);
              byAnchor.set(b.anchorIdx, arr);
            }
            const out = (boxes as any[]).map((b) => ({ ...b }));
            for (const [aIdx, arr] of byAnchor.entries()) {
              const used = new Set<number>(); // used column slots in this row
              const sorted = arr
                .slice()
                .sort((x, y) => (Number(x.desiredCol ?? 0) - Number(y.desiredCol ?? 0)) || String(x.it?.event?.id ?? "").localeCompare(String(y.it?.event?.id ?? "")));
              for (const b of sorted) {
                const colsN = Math.max(1, totalCols);
                const span = Math.max(1, Math.min(colsN, Number.isFinite(b.colSpan) ? b.colSpan : 1));
                let c = Math.max(0, Math.min(colsN - 1, Number.isFinite(b.desiredCol) ? b.desiredCol : 0));
                const fitsAt = (col: number) => {
                  if (col < 0) return false;
                  if (col + span > colsN) return false;
                  for (let k = 0; k < span; k++) if (used.has(col + k)) return false;
                  return true;
                };
                while (c < colsN && !fitsAt(c)) c++;
                if (c >= colsN || !fitsAt(c)) {
                  // no space left; keep last col (rare when col_count is too small)
                  c = Math.max(0, colsN - span);
                }
                for (let k = 0; k < span; k++) used.add(c + k);
                const idx = out.findIndex((z) => z.it?.event?.id === b.it?.event?.id && z.anchorIdx === aIdx);
                if (idx >= 0) {
                  out[idx] = { ...out[idx], desiredCol: c, leftPx: c * colPx, colSpan: span };
                }
              }
            }
            return out;
          })();

          // For print-friendly layout: align all blocks starting at the same anchor (same start time)
          // to the same height, so the row reads as a single band without awkward empty gaps.
          const boxesAligned = (() => {
            const byAnchor = new Map<number, typeof boxes>();
            for (const b of boxesPacked as any) {
              if ((b as any).hidden) continue;
              const arr = byAnchor.get(b.anchorIdx) ?? [];
              arr.push(b);
              byAnchor.set(b.anchorIdx, arr as any);
            }
            const out = (boxesPacked as any[]).filter((b: any) => !(b as any).hidden).map((b) => ({ ...b }));
            for (const [aIdx, arr] of byAnchor.entries()) {
              // Do not let food blocks define the row height if there are other blocks.
              const candidates = arr.filter((b) => !b.isFood);
              const maxH = Math.max(...(candidates.length ? candidates : arr).map((b) => b.height));
              for (const b of out) {
                if (b.anchorIdx === aIdx) b.height = maxH;
              }
            }
            return out;
          })();

          // Time-aware anchor heights:
          // - baseline height comes from real time gaps (Δt * pxPerMin)
          // - row is expanded if content needs more height (to avoid overlaps)
          // Grid row heights: start from a small baseline and expand as needed.
          const anchorHeights = anchors.map(() => MIN_ANCHOR_PX);

          // Ensure mandatory parts (title/time/place) fit for the row.
          for (let i = 0; i < anchorHeights.length; i++) {
            const row = boxesAligned.filter((b: any) => b.anchorIdx === i);
            if (!row.length) continue;
            const rowForSizing = row.some((b: any) => !b.isFood) ? row.filter((b: any) => !b.isFood) : row;
            const maxNeed = Math.max(...rowForSizing.map((b: any) => Number(b.minNoDescH) || 0));
            anchorHeights[i] = Math.max(anchorHeights[i] ?? 0, maxNeed + ANCHOR_PAD_PX);
          }

          // Apply manual overrides (detached/presentation adjustments).
          const dayRowHeights = dayKey ? layoutDraft.row_heights[dayKey] : undefined;
          if (dayRowHeights) {
            for (let i = 0; i < anchors.length; i++) {
              const a = anchors[i]!;
              const ov = dayRowHeights[a];
              if (typeof ov === "number" && Number.isFinite(ov) && ov > 0) {
                anchorHeights[i] = Math.max(MIN_ANCHOR_PX, ov);
              }
            }
          }

          const GAP_PX = 10;
          for (let i = 0; i < anchorHeights.length; i++) {
            const row = boxesAligned.filter((b) => b.anchorIdx === i);
            if (!row.length) continue;
            // By default, keep row heights time-based for consistent print layout.
            // Only auto-expand rows for the NIR final synthetic block (must show full list).
            const hasNirFinal = row.some((b) => String((b.it.event as any)?.title ?? "") === "Финал конкурса НИР");
            if (!hasNirFinal) continue;
            // Do not expand the row just because of food blocks.
            const rowForSizing = row.some((b) => !b.isFood) ? row.filter((b) => !b.isFood) : row;
            const full = rowForSizing.filter((b) => b.isFullWidth);
            const others = rowForSizing.filter((b) => !b.isFullWidth);
            const fullStack = full.length ? full.reduce((sum, b) => sum + b.height, 0) + GAP_PX * Math.max(0, full.length - 1) : 0;
            const othersMax = others.length ? Math.max(...others.map((b) => b.height)) : 0;
            const anyStackingFull = full.some((b) => b.stackOthersBelow);
            const needed =
              anyStackingFull && fullStack
                ? fullStack + (othersMax ? GAP_PX + othersMax : 0) + ANCHOR_PAD_PX
                : Math.max(fullStack || 0, othersMax || 0) + ANCHOR_PAD_PX;
            anchorHeights[i] = Math.max(anchorHeights[i] ?? 0, needed);
          }

          const heightPx = anchorHeights.reduce((a, x) => a + (x ?? 0), 0);
          const heightWithInset = Math.max(120, heightPx) + INSET_Y * 2;

          const yForLabel = (label: string) => {
            const idx = anchors.indexOf(label);
            if (idx < 0) return 0;
            return yForAnchor(idx, anchorHeights);
          };

          const beginRowDrag = (anchorLabel: string, currentHeight: number) => (e: React.MouseEvent) => {
            if (!layoutEdit) return;
            e.preventDefault();
            e.stopPropagation();
            if (!dayKey) return;
            setDragRow({ dayKey, anchorLabel, startY: e.clientY, startH: currentHeight });
          };

          const beginTileMove =
            (eventId: string, anchorIdx: number, colIdx: number, currentH: number, rowSpan: number, colSpan: number) =>
            (e: React.MouseEvent) => {
            if (!layoutEdit) return;
            e.preventDefault();
            e.stopPropagation();
            if (!dayKey) return;
            setDragTile({
              dayKey,
              eventId,
              mode: "move",
              startX: e.clientX,
              startY: e.clientY,
              startCol: colIdx,
              startAnchorIdx: anchorIdx,
              startH: currentH,
              startRowSpan: rowSpan,
              startColSpan: colSpan,
              anchors,
              anchorHeights,
              colPx,
              totalCols
            });
          };

          const beginTileResizeH =
            (eventId: string, anchorIdx: number, colIdx: number, currentH: number, rowSpan: number, colSpan: number) =>
            (e: React.MouseEvent) => {
            if (!layoutEdit) return;
            e.preventDefault();
            e.stopPropagation();
            if (!dayKey) return;
            setDragTile({
              dayKey,
              eventId,
              mode: "resizeH",
              startX: e.clientX,
              startY: e.clientY,
              startCol: colIdx,
              startAnchorIdx: anchorIdx,
              startH: currentH,
              startRowSpan: rowSpan,
              startColSpan: colSpan,
              anchors,
              anchorHeights,
              colPx,
              totalCols
            });
          };

          const beginTileResizeRowSpan =
            (eventId: string, anchorIdx: number, colIdx: number, currentH: number, rowSpan: number, colSpan: number) =>
            (e: React.MouseEvent) => {
              if (!layoutEdit) return;
              e.preventDefault();
              e.stopPropagation();
              if (!dayKey) return;
              setDragTile({
                dayKey,
                eventId,
                mode: "resizeRowSpan",
                startX: e.clientX,
                startY: e.clientY,
                startCol: colIdx,
                startAnchorIdx: anchorIdx,
                startH: currentH,
                startRowSpan: rowSpan,
                startColSpan: colSpan,
                anchors,
                anchorHeights,
                colPx,
                totalCols
              });
            };

          const beginTileResizeColSpan =
            (eventId: string, anchorIdx: number, colIdx: number, currentH: number, rowSpan: number, colSpan: number) =>
            (e: React.MouseEvent) => {
              if (!layoutEdit) return;
              e.preventDefault();
              e.stopPropagation();
              if (!dayKey) return;
              setDragTile({
                dayKey,
                eventId,
                mode: "resizeColSpan",
                startX: e.clientX,
                startY: e.clientY,
                startCol: colIdx,
                startAnchorIdx: anchorIdx,
                startH: currentH,
                startRowSpan: rowSpan,
                startColSpan: colSpan,
                anchors,
                anchorHeights,
                colPx,
                totalCols
              });
            };

          const hideTile = (eventId: string) => {
            if (!dayKey) return;
            setLayoutDraft((prev) => {
              const byDay = { ...(prev.event_overrides ?? {}) };
              const m = { ...(byDay[dayKey] ?? {}) };
              const cur = { ...(m[eventId] ?? {}) };
              cur.hidden = true;
              m[eventId] = cur;
              byDay[dayKey] = m;
              return { ...prev, event_overrides: byDay };
            });
          };

          return (
            <div key={Number.isFinite(dayDate.getTime()) ? dayDate.toISOString() : String(day)} className="card" style={{ padding: 12 }}>
              {!omitDayBanner ? (
                <>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>{Number.isFinite(dayDate.getTime()) ? formatDayFull(dayDate) : String(day)}</div>
                    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div className="chip">{events.length} с таймингом</div>
                      {!hideControls && activeBuildId && dayKey && !pinnedDayKey ? (
                        <button
                          type="button"
                          className="secondary"
                          title="Скрыть день только в сетке (события и версия сборки не меняются)"
                          onClick={() =>
                            setLayoutDraft((p) => ({
                              ...p,
                              hidden_day_keys: Array.from(new Set([...(p.hidden_day_keys ?? []), dayKey]))
                            }))
                          }
                        >
                          Скрыть день
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ height: 10 }} />
                </>
              ) : null}

              {!hideControls ? (
                <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>Стили таймлайна</div>
                  <div className="row">
                    {styleError ? <div className="error">{styleError}</div> : null}
                    {activeBuildId ? (
                      <button type="button" className="secondary" disabled={savingStyle} onClick={saveStyle}>
                        {savingStyle ? "Сохранение..." : "Сохранить стили"}
                      </button>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Создайте/выберите версию сборки, чтобы сохранять стили
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ height: 8 }} />
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>Границы (раскладка)</div>
                  <div className="row" style={{ gap: 10, alignItems: "center" }}>
                    {layoutError ? <div className="error">{layoutError}</div> : null}
                    {activeBuildId && layoutEdit ? (
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <label className="row muted" style={{ gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={autoSaveLayout}
                            onChange={(e) => setAutoSaveLayout(e.target.checked)}
                          />
                          автосохранение
                        </label>
                        {hasUnsavedLayout ? (
                          <span className="chip" title="Изменения пока не записаны в активную версию сборки">
                            не сохранено
                          </span>
                        ) : (
                          <span className="chip" title="Раскладка сохранена в активную версию сборки">
                            сохранено
                          </span>
                        )}
                      </div>
                    ) : null}
                    <label className="row muted" style={{ gap: 6, fontSize: 12 }}>
                      <input type="checkbox" checked={layoutEdit} onChange={(e) => setLayoutEdit(e.target.checked)} />
                      режим правки
                    </label>
                    {activeBuildId ? (
                      <button type="button" className="secondary" disabled={savingLayout} onClick={saveLayout}>
                        {savingLayout ? "Сохранение..." : "Сохранить раскладку"}
                      </button>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Выберите версию сборки, чтобы сохранять раскладку
                      </div>
                    )}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Перетаскивайте горизонтальные линии сетки, чтобы менять высоту строк. Привязка — шаг 10px.
                </div>
                <div className="row" style={{ gap: 10, alignItems: "flex-end", marginTop: 8 }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Колонок
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={dayKey ? Math.floor(layoutDraft.col_count?.[dayKey] ?? totalCols) : totalCols}
                      onChange={(e) => {
                        if (!dayKey) return;
                        const v = Math.max(1, Math.min(64, Number(e.target.value)));
                        setLayoutDraft((p) => ({ ...p, col_count: { ...(p.col_count ?? {}), [dayKey]: v } }));
                      }}
                      style={{ width: 90 }}
                    />
                  </label>
                  {dayKey && layoutDraft.col_count?.[dayKey] != null ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setLayoutDraft((p) => {
                          const next = { ...(p.col_count ?? {}) };
                          delete (next as any)[dayKey];
                          return { ...p, col_count: next };
                        })
                      }
                      title="Вернуть авто (по пересечениям)"
                    >
                      авто
                    </button>
                  ) : null}

                  <div style={{ width: 1, height: 26, background: "rgba(15,23,42,.10)" }} />

                  <label className="muted" style={{ fontSize: 12 }}>
                    Ширина колонки (px)
                    <input
                      type="number"
                      min={120}
                      max={1200}
                      value={dayKey ? Math.floor(layoutDraft.col_width_px?.[dayKey] ?? colPx) : colPx}
                      onChange={(e) => {
                        if (!dayKey) return;
                        const v = Math.max(120, Math.min(1200, Number(e.target.value)));
                        setLayoutDraft((p) => ({ ...p, col_width_px: { ...(p.col_width_px ?? {}), [dayKey]: v } }));
                      }}
                      style={{ width: 160 }}
                    />
                  </label>
                  <input
                    type="range"
                    min={120}
                    max={1200}
                    step={10}
                    value={dayKey ? Math.floor(layoutDraft.col_width_px?.[dayKey] ?? colPx) : colPx}
                    onChange={(e) => {
                      if (!dayKey) return;
                      const v = Math.max(120, Math.min(1200, Number(e.target.value)));
                      setLayoutDraft((p) => ({ ...p, col_width_px: { ...(p.col_width_px ?? {}), [dayKey]: v } }));
                    }}
                    style={{ width: 220 }}
                    disabled={!dayKey}
                    title="Ширина всех колонок на этом дне"
                  />
                  {dayKey && layoutDraft.col_width_px?.[dayKey] != null ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setLayoutDraft((p) => {
                          const next = { ...(p.col_width_px ?? {}) };
                          delete (next as any)[dayKey];
                          return { ...p, col_width_px: next };
                        })
                      }
                      title="Вернуть авто-подбор ширины"
                    >
                      авто
                    </button>
                  ) : null}
                </div>
                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Заголовок секции “вечер”
                    <input
                      type="text"
                      value={styleDraft.eveningProgramTitle}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, eveningProgramTitle: e.target.value }))}
                      style={{ width: 280 }}
                      placeholder="Вечерняя программа"
                    />
                  </label>
                </div>
                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Заголовок (px)
                    <input
                      type="number"
                      min={10}
                      max={28}
                      value={styleDraft.titleFontPx}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, titleFontPx: Number(e.target.value) }))}
                      style={{ width: 120 }}
                    />
                  </label>

                  <label className="muted" style={{ fontSize: 12 }}>
                    Время (px)
                    <input
                      type="number"
                      min={9}
                      max={22}
                      value={styleDraft.timeFontPx}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, timeFontPx: Number(e.target.value) }))}
                      style={{ width: 110 }}
                    />
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Формат (px)
                    <input
                      type="number"
                      min={9}
                      max={22}
                      value={styleDraft.formatFontPx}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, formatFontPx: Number(e.target.value) }))}
                      style={{ width: 120 }}
                    />
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Место (px)
                    <input
                      type="number"
                      min={9}
                      max={22}
                      value={styleDraft.placeFontPx}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, placeFontPx: Number(e.target.value) }))}
                      style={{ width: 110 }}
                    />
                  </label>
                </div>

                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Заголовок: жирность
                    <select
                      value={styleDraft.titleWeight}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, titleWeight: Number(e.target.value) }))}
                      style={{ width: 140 }}
                    >
                      {[400, 500, 600, 700, 800, 900].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={styleDraft.titleItalic}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, titleItalic: e.target.checked }))}
                      style={{ width: 16, marginRight: 8 }}
                    />
                    Заголовок: курсив
                  </label>

                  <label className="muted" style={{ fontSize: 12 }}>
                    Время: жирность
                    <select
                      value={styleDraft.timeWeight}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, timeWeight: Number(e.target.value) }))}
                      style={{ width: 120 }}
                    >
                      {[300, 400, 500, 600, 700].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={styleDraft.timeItalic}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, timeItalic: e.target.checked }))}
                      style={{ width: 16, marginRight: 8 }}
                    />
                    Время: курсив
                  </label>

                  <label className="muted" style={{ fontSize: 12 }}>
                    Формат: жирность
                    <select
                      value={styleDraft.formatWeight}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, formatWeight: Number(e.target.value) }))}
                      style={{ width: 130 }}
                    >
                      {[300, 400, 500, 600, 700].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={styleDraft.formatItalic}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, formatItalic: e.target.checked }))}
                      style={{ width: 16, marginRight: 8 }}
                    />
                    Формат: курсив
                  </label>

                  <label className="muted" style={{ fontSize: 12 }}>
                    Место: жирность
                    <select
                      value={styleDraft.placeWeight}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, placeWeight: Number(e.target.value) }))}
                      style={{ width: 120 }}
                    >
                      {[300, 400, 500, 600, 700].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={styleDraft.placeItalic}
                      onChange={(e) => setStyleDraft((p) => ({ ...p, placeItalic: e.target.checked }))}
                      style={{ width: 16, marginRight: 8 }}
                    />
                    Место: курсив
                  </label>
                </div>

                <div className="row" style={{ gap: 10, alignItems: "flex-end", marginTop: 6, flexWrap: "wrap" }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Открытие ссылки в названии
                    <select
                      value={styleDraft.eventLinkTarget}
                      onChange={(e) =>
                        setStyleDraft((p) => ({
                          ...p,
                          eventLinkTarget: e.target.value === "_self" ? "_self" : "_blank"
                        }))
                      }
                      style={{ width: 220, marginLeft: 8 }}
                    >
                      <option value="_blank">Новая вкладка</option>
                      <option value="_self">Та же вкладка</option>
                    </select>
                  </label>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Работает, если у события задано поле URL (http/https) на вкладке «События» или в Excel.
                  </span>
                </div>

                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Подложка
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={styleDraft.eventBgColor}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, eventBgColor: e.target.value }))}
                        style={{ width: 44, padding: 0, height: 36 }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={styleDraft.eventBgAlpha}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, eventBgAlpha: Number(e.target.value) }))}
                        style={{ width: 140 }}
                      />
                      <span className="chip">{styleDraft.eventBgAlpha.toFixed(2)}</span>
                    </div>
                  </label>

                  <label className="muted" style={{ fontSize: 12 }}>
                    Обводка
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={styleDraft.eventBorderColor}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, eventBorderColor: e.target.value }))}
                        style={{ width: 44, padding: 0, height: 36 }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={styleDraft.eventBorderAlpha}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, eventBorderAlpha: Number(e.target.value) }))}
                        style={{ width: 140 }}
                      />
                      <span className="chip">{styleDraft.eventBorderAlpha.toFixed(2)}</span>
                    </div>
                  </label>
                  <label className="muted" style={{ fontSize: 12 }}>
                    Фон поля (где лежат события)
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={styleDraft.fieldBgColor}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, fieldBgColor: e.target.value }))}
                        style={{ width: 44, padding: 0, height: 36 }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={styleDraft.fieldBgAlpha}
                        onChange={(e) => setStyleDraft((p) => ({ ...p, fieldBgAlpha: Number(e.target.value) }))}
                        style={{ width: 140 }}
                      />
                      <span className="chip">{styleDraft.fieldBgAlpha.toFixed(2)}</span>
                    </div>
                  </label>
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Цвета настраиваются через picker и прозрачность: отдельно для карточек мероприятий, их обводки и фона всей рабочей области.
                </div>
                </div>
              ) : null}

              {!hideControls && dayKey && activeBuildId ? (
                <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>Метки времени</div>
                    <div className="row">
                      {marksError ? <div className="error">{marksError}</div> : null}
                      <button type="button" className="secondary" disabled={savingMarks} onClick={() => saveMarks(dayKey)}>
                        {savingMarks ? "Сохранение..." : "Сохранить метки"}
                      </button>
                    </div>
                  </div>
                  <div style={{ height: 8 }} />
                  <div className="row" style={{ gap: 8 }}>
                    {(marksByDay[dayKey] ?? []).map((m, i) => (
                      <span key={`${dayKey}-${i}`} className="chip">
                        <input
                          type="time"
                          value={normalizeTime(m) ?? "12:00"}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMarksByDay((prev) => {
                              const cur = [...(prev[dayKey] ?? [])];
                              cur[i] = v;
                              return { ...prev, [dayKey]: cur };
                            });
                          }}
                          style={{ background: "transparent", border: "none", color: "var(--text)", width: 78 }}
                        />
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "4px 8px" }}
                          onClick={() =>
                            setMarksByDay((prev) => {
                              const cur = [...(prev[dayKey] ?? [])];
                              cur.splice(i, 1);
                              return { ...prev, [dayKey]: cur };
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setMarksByDay((prev) => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), "12:30"] }))
                      }
                    >
                      + метка
                    </button>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    По умолчанию метки строятся по стартам мероприятий. Здесь можно вручную убрать лишние (например 12:00) и поставить 12:30.
                  </div>
                </div>
              ) : null}

              {(() => {
                const key = Number.isFinite(dayDate.getTime()) ? dayKeyLocalFromDate(dayDate) : "";
                const list = key ? (untimedByDay.get(key) ?? []) : [];
                const evening = list.filter((e) => (e.format ?? "").trim() === "Вечерняя программа");
                const top = list.filter((e) => (e.format ?? "").trim() !== "Вечерняя программа");
                if (!top.length) return null;
                return (
                  <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                    <div className="grid" style={{ gap: 8 }}>
                      {top.map((e) => (
                        <div key={`u-${e.id}`} className="card" style={{ padding: 10 }}>
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                            <div style={{ fontWeight: 800 }}>{e.title}</div>
                            <div className="chip">№ {e.orderNo ?? "—"}</div>
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            {[
                              shouldShowFormat(e.format) ? String(e.format).trim() : null,
                              e.building ? String(e.building).trim() : null,
                              e.room ? String(e.room).trim() : null
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {showExtraFields && extraFieldLines(e).length ? (
                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                              {extraFieldLines(e).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {events.length ? (
                <div className="timelineWrap">
                  <div className="timeCol">
                    {anchors.map((label, i) => {
                      const top = yForLabel(label);
                      return (
                        <div key={label} style={{ height: 0, position: "relative" }}>
                          <div className="timeLabel" style={{ top: top - 8 + INSET_Y }}>
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div ref={lanesRef} className="lanes" style={{ height: heightWithInset }}>
                    <div className="lanesInner" style={{ height: heightWithInset, width: gridMinWidth + INSET_X }}>
                      {anchors.map((label, i) => {
                        const top = yForLabel(label);
                        // Dragging the boundary at this line adjusts the row ABOVE it (like a spreadsheet),
                        // i.e. the row that starts at anchors[i-1].
                        const targetIdx = Math.max(0, i - 1);
                        const targetLabel = anchors[targetIdx] ?? label;
                        const h = anchorHeights[targetIdx] ?? 0;
                        return (
                          <div
                            key={label}
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              width: "100%",
                              height: 0,
                              pointerEvents: "none"
                            }}
                          >
                            <div className="laneGridLine" style={{ top: top + INSET_Y, left: INSET_X, width: gridMinWidth }} />
                            {layoutEdit && i > 0 ? (
                              <div
                                role="separator"
                                aria-label={`resize-row-${targetLabel}`}
                                onMouseDown={beginRowDrag(targetLabel, h)}
                                title="Тяните вверх/вниз, чтобы изменить высоту строки (шаг 10px)"
                                style={{
                                  position: "absolute",
                                  left: INSET_X,
                                  top: top + INSET_Y - 8,
                                  width: gridMinWidth,
                                  height: 16,
                                  cursor: "row-resize",
                                  zIndex: 5,
                                  pointerEvents: "auto",
                                  background: "rgba(37, 99, 235, 0.08)",
                                  borderTop: "1px solid rgba(37, 99, 235, 0.35)",
                                  borderBottom: "1px solid rgba(37, 99, 235, 0.15)"
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}

                      <div
                        className="laneCols"
                        style={{
                          gridTemplateColumns: `repeat(${totalCols}, ${colPx}px)`,
                          left: INSET_X,
                          width: gridMinWidth,
                          pointerEvents: "none"
                        }}
                      >
                        {Array.from({ length: totalCols }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,.08)"
                            }}
                          />
                        ))}
                      </div>

                      {boxesAligned.map(({ it, anchorIdx, height, leftPx, widthPx, isFullWidth, stackOthersBelow, sMs, eMs, rowSpan, colSpan }) => {
                        const top = yForAnchor(anchorIdx, anchorHeights) + INSET_Y;
                        const spanH =
                          typeof rowSpan === "number" && rowSpan > 1
                            ? anchorHeights.slice(anchorIdx, anchorIdx + rowSpan).reduce((a, x) => a + (x ?? 0), 0)
                            : null;
                        const heightRender = spanH != null && Number.isFinite(spanH) ? Math.max(height, spanH - 4) : height;
                        const isTiny = height < 54;
                        const rawFormat = it.event.format ?? "";
                        const format = shouldShowFormat(rawFormat) ? String(rawFormat).trim() : "";
                        const time = `${formatTime(it.event.start)}–${formatTime(it.event.end)}`;
                        const place = [it.event.building ? String(it.event.building).trim() : null, it.event.room ? String(it.event.room).trim() : null]
                          .filter(Boolean)
                          .join(" · ");
                        const tooltip = [time, format || null, place || null].filter(Boolean).join(" · ");
                        const ov = (it.event as any).style_override as
                          | { eventBgColor?: string; eventBgAlpha?: number; eventBorderColor?: string; eventBorderAlpha?: number }
                          | undefined;
                        const bg = ov?.eventBgColor ? rgbaFrom(ov.eventBgColor, ov.eventBgAlpha ?? 1) : null;
                        const border = ov?.eventBorderColor ? rgbaFrom(ov.eventBorderColor, ov.eventBorderAlpha ?? 1) : null;
                        const descMd = (it.event as any).description_md ? String((it.event as any).description_md) : "";
                        const descPlain = it.event.description ? String(it.event.description) : "";
                        const descToShow = descMd || descPlain;
                        const extraLines = showExtraFields ? extraFieldLines(it.event as any) : [];
                        const evUrl = normalizeHttpUrl((it.event as any).url);
                        const linkT = styleDraft.eventLinkTarget === "_self" ? "_self" : "_blank";

                        // For rows with a full-width event that stacks others below, shift non-full blocks down by full-stack height.
                        let extraTop = 0;
                        if (!isFullWidth) {
                          const row = boxesAligned.filter((b: any) => b.anchorIdx === anchorIdx);
                          // Shift down only if there is a stacking full-width block for the *same time range*.
                          const full = row.filter((b) => b.isFullWidth && b.stackOthersBelow && b.sMs === sMs && b.eMs === eMs);
                          const anyStackingFull = full.length > 0;
                          if (anyStackingFull && full.length) {
                            const fullStack = full.reduce((sum, b) => sum + b.height, 0) + 10 * Math.max(0, full.length - 1);
                            extraTop = fullStack + 10;
                          }
                        }

                        return (
                          <div
                            key={`${it.event.id}-${it.event.start.toISOString()}`}
                            className={`eventBlock${isTiny ? " tiny" : ""}`}
                            style={{
                              top: top + extraTop,
                              height: heightRender,
                              left: isFullWidth ? INSET_X : INSET_X + leftPx + GUTTER_PX / 2,
                              width: isFullWidth
                                ? Math.max(10, gridMinWidth - GUTTER_PX)
                                : Math.max(10, widthPx * Math.max(1, Number(colSpan) || 1) - GUTTER_PX),
                              ...(bg ? { background: bg } : null),
                              ...(border ? { borderColor: border } : null)
                            }}
                            title={tooltip}
                          >
                            <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                              {layoutEdit ? (
                                <div
                                  className="eventTitle"
                                  style={{ cursor: "grab" }}
                                  onMouseDown={beginTileMove(
                                    String(it.event.id),
                                    anchorIdx,
                                    Math.round(leftPx / Math.max(1, widthPx)),
                                    heightRender,
                                    typeof rowSpan === "number" ? rowSpan : 1,
                                    typeof colSpan === "number" ? colSpan : 1
                                  )}
                                >
                                  {it.event.title}
                                </div>
                              ) : evUrl ? (
                                <a
                                  className="eventTitle"
                                  href={evUrl}
                                  target={linkT === "_blank" ? "_blank" : undefined}
                                  rel={linkT === "_blank" ? "noopener noreferrer" : undefined}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  {it.event.title}
                                </a>
                              ) : (
                                <div className="eventTitle" style={{ cursor: "default" }}>
                                  {it.event.title}
                                </div>
                              )}
                              {layoutEdit ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => hideTile(String(it.event.id))}
                                  style={{ padding: "2px 8px", fontSize: 12, lineHeight: 1 }}
                                  title="Скрыть плитку в архитектуре"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                            {isTiny ? (
                              <div className="eventTime">{time}</div>
                            ) : (
                              <>
                                {format ? <div className="eventFormat">{format}</div> : null}
                                <div className="eventTime">{time}</div>
                                {descToShow ? (
                                  it.event.title === "Финал конкурса НИР" ? (
                                    <div className="eventDesc" style={{ whiteSpace: "pre-line" }}>
                                      {descToShow}
                                    </div>
                                  ) : descMd ? (
                                    <div className="eventDesc eventDescClamp">{renderMarkdownLite(descMd)}</div>
                                  ) : (
                                    <div className="eventDesc eventDescClamp">{descPlain}</div>
                                  )
                                ) : null}
                                {place ? <div className="eventPlace">{place}</div> : null}
                                {extraLines.length ? <div className="eventDesc">{extraLines.join(" · ")}</div> : null}
                              </>
                            )}
                            {layoutEdit ? (
                              <div
                                onMouseDown={beginTileResizeH(
                                  String(it.event.id),
                                  anchorIdx,
                                  Math.round(leftPx / Math.max(1, widthPx)),
                                  heightRender,
                                  typeof rowSpan === "number" ? rowSpan : 1,
                                  typeof colSpan === "number" ? colSpan : 1
                                )}
                                title="Тяните вниз/вверх, чтобы изменить высоту плитки"
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  height: 10,
                                  cursor: "ns-resize",
                                  background: "rgba(37,99,235,0.06)"
                                }}
                              />
                            ) : null}

                            {layoutEdit ? (
                              <div
                                onMouseDown={beginTileResizeRowSpan(
                                  String(it.event.id),
                                  anchorIdx,
                                  Math.round(leftPx / Math.max(1, widthPx)),
                                  heightRender,
                                  typeof rowSpan === "number" ? rowSpan : 1,
                                  typeof colSpan === "number" ? colSpan : 1
                                )}
                                title="Тяните, чтобы занять больше строк"
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  bottom: 0,
                                  width: 14,
                                  height: 14,
                                  cursor: "nwse-resize",
                                  background: "rgba(37,99,235,0.12)",
                                  borderLeft: "1px solid rgba(37,99,235,0.25)",
                                  borderTop: "1px solid rgba(37,99,235,0.25)"
                                }}
                              />
                            ) : null}

                            {layoutEdit && !isFullWidth ? (
                              <div
                                onMouseDown={beginTileResizeColSpan(
                                  String(it.event.id),
                                  anchorIdx,
                                  Math.round(leftPx / Math.max(1, widthPx)),
                                  heightRender,
                                  typeof rowSpan === "number" ? rowSpan : 1,
                                  typeof colSpan === "number" ? colSpan : 1
                                )}
                                title="Тяните вправо/влево, чтобы занять больше колонок"
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  right: 0,
                                  width: 14,
                                  height: 34,
                                  transform: "translateY(-50%)",
                                  cursor: "ew-resize",
                                  background: "rgba(37,99,235,0.10)",
                                  borderLeft: "1px solid rgba(37,99,235,0.35)",
                                  borderTopLeftRadius: 8,
                                  borderBottomLeftRadius: 8
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  Нет событий в этот день.
                </div>
              )}

              {(() => {
                const key = Number.isFinite(dayDate.getTime()) ? dayKeyLocalFromDate(dayDate) : "";
                const list = key ? (untimedByDay.get(key) ?? []) : [];
                const evening = list.filter((e) => (e.format ?? "").trim() === "Вечерняя программа");
                if (!evening.length) return null;
                return (
                  <div className="card" style={{ padding: 12, marginTop: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>{eveningProgramTitle}</div>
                      <div className="chip">{evening.length}</div>
                    </div>
                    <div style={{ height: 8 }} />
                    <div className="grid" style={{ gap: 8 }}>
                      {evening.map((e) => (
                        <div key={`ev-${e.id}`} className="card" style={{ padding: 10 }}>
                          <div style={{ fontWeight: 800 }}>{e.title}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            {[e.building ? String(e.building).trim() : null, e.room ? String(e.room).trim() : null].filter(Boolean).join(" · ")}
                          </div>
                          {showExtraFields && extraFieldLines(e).length ? (
                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                              {extraFieldLines(e).join(" · ")}
                            </div>
                          ) : null}
                          {(() => {
                            const md = (e as any).description_md ? String((e as any).description_md) : "";
                            const plain = e.description ? String(e.description) : "";
                            if (!md && !plain) return null;
                            return (
                              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                {md ? renderMarkdownLite(md) : <span style={{ whiteSpace: "pre-line" }}>{plain}</span>}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

