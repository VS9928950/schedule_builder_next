import {
  layoutDayLanes,
  mergeFinalNirSameTime,
  isArchitectureProgramView,
  isTechScheduleOnlyFormat
} from "@/lib/schedule";

export type EventLayoutOverride = {
  anchor?: string;
  col?: number;
  colSpan?: number;
  rowSpan?: number;
  heightPx?: number;
  hidden?: boolean;
};

export type TimelineLayout = {
  row_heights?: Record<string, Record<string, number>>;
  col_width_px?: Record<string, number>;
  col_count?: Record<string, number>;
  event_overrides?: Record<string, Record<string, EventLayoutOverride>>;
  hidden_day_keys?: string[];
};

export type ProgramBox = {
  ev: any;
  startD: Date;
  endD: Date;
  col: number;
  colSpan: number;
  rowSpan: number;
  slotMin: number;
  hidden: boolean;
};

function dayKeyFromDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function slotMinutes(startD: Date, ov: EventLayoutOverride): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(ov.anchor ?? "").trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return startD.getUTCHours() * 60 + startD.getUTCMinutes();
}

export function resolveEventOverride(
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

export function slotsFromBoxes(boxes: ProgramBox[]): ProgramBox[][][] {
  const visible = boxes.filter((b) => !b.hidden);
  const bySlot = new Map<number, ProgramBox[]>();
  for (const box of visible) {
    const arr = bySlot.get(box.slotMin) ?? [];
    arr.push(box);
    bySlot.set(box.slotMin, arr);
  }
  const slotMins = Array.from(bySlot.keys()).sort((a, b) => a - b);
  for (const box of visible.filter((b) => b.rowSpan > 1).sort((a, b) => b.rowSpan - a.rowSpan)) {
    const startIdx = slotMins.indexOf(box.slotMin);
    if (startIdx < 0) continue;
    for (let k = 1; k < box.rowSpan; k++) {
      const later = slotMins[startIdx + k];
      if (later == null) break;
      const moving = bySlot.get(later);
      if (!moving?.length) continue;
      const dest = bySlot.get(box.slotMin) ?? [];
      dest.push(...moving);
      bySlot.set(box.slotMin, dest);
      bySlot.delete(later);
    }
  }
  return Array.from(bySlot.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => {
      const byCol = new Map<number, ProgramBox[]>();
      for (const box of group) {
        const arr = byCol.get(box.col) ?? [];
        arr.push(box);
        byCol.set(box.col, arr);
      }
      return Array.from(byCol.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, colBoxes]) => colBoxes.slice().sort((a, b) => a.startD.getTime() - b.startD.getTime()));
    });
}

function toScheduleEvent(e: any, startD: Date, endD: Date) {
  return {
    id: String(e.id),
    title: String(e.title ?? ""),
    description: e.description != null ? String(e.description) : undefined,
    description_md: e.description_md != null ? String(e.description_md) : undefined,
    announcement: e.announcement != null ? String(e.announcement) : undefined,
    speakers: e.speakers != null ? String(e.speakers) : undefined,
    popup: e.popup != null ? String(e.popup) : undefined,
    popupButtonText: e.popupButtonText != null ? String(e.popupButtonText) : undefined,
    popupButtonUrl: e.popupButtonUrl != null ? String(e.popupButtonUrl) : undefined,
    building: e.building != null ? String(e.building) : undefined,
    room: e.room != null ? String(e.room) : undefined,
    format: e.format != null ? String(e.format) : undefined,
    orderNo: e.orderNo,
    visible: e.visible ?? true,
    start: startD,
    end: endD,
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
    simultaneousInterpretation: e.simultaneousInterpretation,
    sourceIds: e.sourceIds,
    groupedItems: e.groupedItems
  };
}

export function layoutProgramDays(args: {
  events: any[];
  timelineLayout: TimelineLayout | null;
  view?: string | null;
  onlyDayKey?: string | null;
}): Array<{ dayKey: string; slots: ProgramBox[][][] }> {
  const view = args.view;
  const filtered = (args.events ?? []).filter(
    (e) => (e.visible ?? true) && !(isArchitectureProgramView(view) && isTechScheduleOnlyFormat(e.format))
  );
  const timed = filtered
    .filter((e) => (e.kind ?? "timed") === "timed" && e.start && e.end)
    .map((e) => ({ ...e, startD: new Date(e.start), endD: new Date(e.end) }))
    .filter((e) => Number.isFinite(e.startD.getTime()) && Number.isFinite(e.endD.getTime()) && e.endD > e.startD);

  const hiddenDay = new Set(
    (args.timelineLayout?.hidden_day_keys ?? [])
      .map((k) => String(k).slice(0, 10))
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  );
  const days = Array.from(new Set(timed.map((e) => dayKeyFromDate(e.startD))))
    .sort()
    .filter((d) => !hiddenDay.has(d));
  const daysToExport = args.onlyDayKey ? days.filter((d) => d === args.onlyDayKey) : days;
  const eventOverrides = args.timelineLayout?.event_overrides ?? {};

  const out: Array<{ dayKey: string; slots: ProgramBox[][][] }> = [];
  for (const dayKey of daysToExport) {
    const dayEvents = timed.filter((e) => dayKeyFromDate(e.startD) === dayKey);
    const scheduleEvents = mergeFinalNirSameTime(dayEvents.map((e) => toScheduleEvent(e, e.startD, e.endD)) as any);
    const dayDate = new Date(dayKey + "T00:00:00.000Z");
    const dayLayout = layoutDayLanes(dayDate, scheduleEvents as any);
    const boxes: ProgramBox[] = (dayLayout.items as any[]).map((it) => {
      const ev = it.event as any;
      const ov = resolveEventOverride(eventOverrides?.[dayKey], ev);
      const cluster = Math.max(0, Math.floor(Number.isFinite(it.clusterIndex) ? it.clusterIndex : 0));
      const col =
        typeof ov.col === "number" && Number.isFinite(ov.col) ? Math.max(0, Math.floor(ov.col)) : cluster;
      const colSpan =
        typeof ov.colSpan === "number" && Number.isFinite(ov.colSpan) ? Math.max(1, Math.floor(ov.colSpan)) : 1;
      const rowSpan =
        typeof ov.rowSpan === "number" && Number.isFinite(ov.rowSpan) ? Math.max(1, Math.floor(ov.rowSpan)) : 1;
      return {
        ev,
        startD: new Date(ev.start),
        endD: new Date(ev.end),
        col,
        colSpan,
        rowSpan,
        slotMin: slotMinutes(new Date(ev.start), ov),
        hidden: !!ov.hidden
      };
    });
    const slots = slotsFromBoxes(boxes);
    if (slots.length) out.push({ dayKey, slots });
  }
  return out;
}
