"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collectSortedProgramDayKeys,
  dayKeyLocalFromDate,
  formatDayFull,
  formatTime,
  groupEventsByFourDays,
  localDateFromDayKey
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
  building?: string;
  room?: string;
  format?: string;
  orderNo?: number;
  visible?: boolean;
  kind?: "timed" | "untimed";
  day?: string; // ISO date for untimed
  start?: string; // ISO
  end?: string; // ISO
};

function normToken(s: unknown) {
  if (s == null) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function shouldShowFormat(fmt: unknown) {
  const s = fmt == null ? "" : String(fmt).trim();
  if (!s) return false;
  return s !== "Питание";
}

function roomKey(e: IsoEvent) {
  const b = normToken(e.building);
  const r = normToken(e.room);
  if (!b && !r) return "";
  return `${b}||${r}`;
}

function roomLabel(key: string) {
  const [b, r] = key.split("||");
  const bb = normToken(b);
  const rr = normToken(r);
  if (bb && rr) return `${bb} · ${rr}`;
  if (rr) return rr;
  if (bb) return bb;
  return "—";
}

function eventMatchesRoom(e: { building?: string; room?: string }, buildingNorm: string, roomNorm: string) {
  if (normToken(e.room) !== roomNorm) return false;
  if (buildingNorm && normToken(e.building) !== buildingNorm) return false;
  return true;
}

export function RoomsScheduleViewer({ events }: { events: IsoEvent[] }) {
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
  const timed = useMemo(
    () =>
      events
        .filter((e) => (e.visible ?? true) && (e.kind ?? "timed") === "timed" && !!e.start && !!e.end)
        .map((e) => ({ ...e, start: new Date(e.start!), end: new Date(e.end!) }))
        .filter((e) => Number.isFinite(e.start.getTime()) && Number.isFinite(e.end.getTime()) && e.end > e.start)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
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

  const programDayKeysAll = useMemo(
    () =>
      collectSortedProgramDayKeys({
        timed: timed as any,
        untimedDayKeys: Array.from(untimedByDay.keys())
      }),
    [timed, untimedByDay]
  );

  const fourDays = useMemo(() => groupEventsByFourDays(timed as any), [timed]);
  const [dayIdx, setDayIdx] = useState(0);
  /** «Все дни» — занятость аудитории за весь найденный период, не только один день из четырёхдневного окна. */
  const [periodScope, setPeriodScope] = useState<"chunk_day" | "all_days">("chunk_day");
  const [activeRoomKey, setActiveRoomKey] = useState<string>("");

  useEffect(() => {
    setDayIdx(0);
    if (fourDays.length > 0) setPeriodScope("chunk_day");
    else if (programDayKeysAll.length > 0) setPeriodScope("all_days");
    else setPeriodScope("chunk_day");
  }, [events, fourDays.length, programDayKeysAll.length]);

  const allRoomKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (!(e.visible ?? true)) continue;
      const k = roomKey(e);
      if (!k) continue;
      const [, r] = k.split("||");
      if (!normToken(r)) continue; // require room; building is strongly recommended but not mandatory
      set.add(k);
    }
    return Array.from(set).sort((a, b) => roomLabel(a).localeCompare(roomLabel(b), "ru-RU"));
  }, [events]);

  useEffect(() => {
    if (!activeRoomKey && allRoomKeys.length) setActiveRoomKey(allRoomKeys[0]!);
    if (activeRoomKey && !allRoomKeys.includes(activeRoomKey) && allRoomKeys.length) setActiveRoomKey(allRoomKeys[0]!);
  }, [activeRoomKey, allRoomKeys]);

  const internalCheck = useMemo(() => {
    const missingBuilding: IsoEvent[] = [];
    for (const e of events) {
      if (!(e.visible ?? true)) continue;
      const r = normToken(e.room);
      if (!r) continue;
      const b = normToken(e.building);
      if (!b) missingBuilding.push(e);
    }
    return { missingBuildingCount: missingBuilding.length, examples: missingBuilding.slice(0, 6) };
  }, [events]);

  const chunkDayKey = useMemo(() => {
    if (periodScope !== "chunk_day" || !fourDays.length) return "";
    const d = fourDays[Math.min(dayIdx, fourDays.length - 1)]!.day;
    return dayKeyLocalFromDate(d);
  }, [periodScope, dayIdx, fourDays]);

  const roomFilteredTimed = useMemo(() => {
    if (!activeRoomKey) return [];
    const [b0, r0] = activeRoomKey.split("||");
    const b = normToken(b0);
    const r = normToken(r0);

    if (periodScope === "all_days") {
      return (timed as any[])
        .filter((e) => eventMatchesRoom(e, b, r))
        .sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime());
    }

    if (!fourDays.length) return [];
    const day = fourDays[Math.min(dayIdx, fourDays.length - 1)]!.day;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return (timed as any[]).filter((e) => {
      if (!eventMatchesRoom(e, b, r)) return false;
      const s = e.start as Date;
      return s >= dayStart && s < dayEnd;
    });
  }, [activeRoomKey, timed, periodScope, fourDays, dayIdx]);

  const roomFilteredUntimed = useMemo(() => {
    if (!activeRoomKey) return [];
    const [b0, r0] = activeRoomKey.split("||");
    const b = normToken(b0);
    const r = normToken(r0);

    if (periodScope === "all_days") {
      const out: IsoEvent[] = [];
      for (const [, list] of untimedByDay) {
        for (const e of list) {
          if (eventMatchesRoom(e, b, r)) out.push(e);
        }
      }
      out.sort((a, b) => {
        const da = (a.day ?? "").slice(0, 10).localeCompare((b.day ?? "").slice(0, 10));
        if (da !== 0) return da;
        return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
      });
      return out;
    }

    if (!chunkDayKey) return [];
    const list = untimedByDay.get(chunkDayKey) ?? [];
    return list.filter((e) => eventMatchesRoom(e, b, r));
  }, [activeRoomKey, chunkDayKey, untimedByDay, periodScope]);

  const allDaysSections = useMemo(() => {
    if (periodScope !== "all_days" || !activeRoomKey) return null;
    const [b0, r0] = activeRoomKey.split("||");
    const b = normToken(b0);
    const r = normToken(r0);
    const map = new Map<string, { timed: any[]; untimed: IsoEvent[] }>();
    for (const e of timed as any[]) {
      if (!eventMatchesRoom(e, b, r)) continue;
      const dk = dayKeyLocalFromDate(e.start as Date);
      const row = map.get(dk) ?? { timed: [], untimed: [] };
      row.timed.push(e);
      map.set(dk, row);
    }
    for (const [dk, list] of untimedByDay) {
      for (const e of list) {
        if (!eventMatchesRoom(e, b, r)) continue;
        const row = map.get(dk) ?? { timed: [], untimed: [] };
        row.untimed.push(e);
        map.set(dk, row);
      }
    }
    for (const row of map.values()) {
      row.timed.sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime());
      row.untimed.sort((a, b) => (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9));
    }
    const keys = Array.from(map.keys()).sort();
    if (!keys.length) return [];
    return keys.map((k) => ({ dayKey: k, ...(map.get(k) as { timed: any[]; untimed: IsoEvent[] }) }));
  }, [activeRoomKey, timed, untimedByDay, periodScope]);

  const showPeriodBar = allRoomKeys.length > 0 && (fourDays.length > 0 || programDayKeysAll.length > 0);

  const roomTimeConflicts = useMemo(() => {
    const evs = [...(roomFilteredTimed as any[])].sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime());
    const overlaps: Array<{ a: any; b: any }> = [];
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const a = evs[i]!;
        const b = evs[j]!;
        if ((b.start as Date).getTime() >= (a.end as Date).getTime()) break; // later ones won't overlap with `a`
        overlaps.push({ a, b });
      }
    }

    const lines: string[] = [];
    const seen = new Set<string>();
    for (const { a, b } of overlaps) {
      const key = `${a.id}__${(a.start as Date).toISOString()}__${b.id}__${(b.start as Date).toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const t = `${formatTime(a.start)}–${formatTime(a.end)}`;
      lines.push(`${t}: "${String(a.title ?? "")}" ↔ "${String(b.title ?? "")}"`);
    }

    return { count: overlaps.length, lines: lines.slice(0, 12) };
  }, [roomFilteredTimed]);

  if (!events.length) return null;

  const chipDayLabel =
    periodScope === "all_days"
      ? !allDaysSections?.length
        ? "Все дни"
        : allDaysSections.length > 1
          ? `${formatDayFull(localDateFromDayKey(allDaysSections[0]!.dayKey))} — ${formatDayFull(localDateFromDayKey(allDaysSections[allDaysSections.length - 1]!.dayKey))}`
          : formatDayFull(localDateFromDayKey(allDaysSections[0]!.dayKey))
      : chunkDayKey || "—";

  const renderTimedCard = (e: any) => {
    const time = `${formatTime(e.start)}–${formatTime(e.end)}`;
    const meta = [shouldShowFormat(e.format) ? String(e.format).trim() : null, time].filter(Boolean).join(" · ");
    const ov = (e as any).style_override as any;
    const bg = ov?.eventBgColor ? rgbaFrom(ov.eventBgColor, ov.eventBgAlpha ?? 1) : null;
    const border = ov?.eventBorderColor ? rgbaFrom(ov.eventBorderColor, ov.eventBorderAlpha ?? 1) : null;
    const descMd = (e as any).description_md ? String((e as any).description_md) : "";
    const descPlain = e.description ? String(e.description) : "";
    return (
      <div
        key={`t-${e.id}-${e.start.toISOString()}`}
        className="card"
        style={{
          padding: 10,
          ...(bg ? { background: bg } : null),
          ...(border ? { borderColor: border } : null)
        }}
      >
        <div style={{ fontWeight: 800 }}>{String(e.title ?? "")}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {meta}
        </div>
        {descMd ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {renderMarkdownLite(descMd)}
          </div>
        ) : descPlain ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-line" }}>
            {descPlain}
          </div>
        ) : null}
      </div>
    );
  };

  const renderUntimedCard = (e: IsoEvent) => {
    const meta = [shouldShowFormat(e.format) ? String(e.format).trim() : null, e.orderNo != null ? `№ ${e.orderNo}` : null]
      .filter(Boolean)
      .join(" · ");
    const ov = (e as any).style_override as any;
    const bg = ov?.eventBgColor ? rgbaFrom(ov.eventBgColor, ov.eventBgAlpha ?? 1) : null;
    const border = ov?.eventBorderColor ? rgbaFrom(ov.eventBorderColor, ov.eventBorderAlpha ?? 1) : null;
    const descMd = (e as any).description_md ? String((e as any).description_md) : "";
    const descPlain = e.description ? String(e.description) : "";
    return (
      <div
        key={`u-${e.id}`}
        className="card"
        style={{
          padding: 10,
          ...(bg ? { background: bg } : null),
          ...(border ? { borderColor: border } : null)
        }}
      >
        <div style={{ fontWeight: 800 }}>{String(e.title ?? "")}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {meta}
        </div>
        {descMd ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {renderMarkdownLite(descMd)}
          </div>
        ) : descPlain ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-line" }}>
            {descPlain}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      {roomTimeConflicts.count ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Проверка места проведения</div>
          <div className="muted" style={{ fontSize: 12 }}>
            В {activeRoomKey ? roomLabel(activeRoomKey) : "этой аудитории"} найдены пересечения по времени
            {periodScope === "all_days" ? " за выбранный период" : " в выбранный день"}: <b>{roomTimeConflicts.count}</b>.
          </div>
          {roomTimeConflicts.lines.length ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8, whiteSpace: "pre-line" }}>
              {roomTimeConflicts.lines.join("\n")}
            </div>
          ) : null}
        </div>
      ) : null}

      {internalCheck.missingBuildingCount ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Внутренняя проверка</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Найдено событий с заполненной аудиторияй, но без корпуса: <b>{internalCheck.missingBuildingCount}</b>. Это может быть неоднозначно
            (например, “203” в разных корпусах).
          </div>
          {internalCheck.examples.length ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Примеры: {internalCheck.examples.map((e) => `"${e.title}"`).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {allRoomKeys.length ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Аудитории</div>
          <div className="row" style={{ gap: 8 }}>
            {allRoomKeys.map((k) => (
              <button key={k} type="button" className={k === activeRoomKey ? "" : "secondary"} onClick={() => setActiveRoomKey(k)}>
                {roomLabel(k)}
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Если аудиторий много, можно позже добавить поиск/фильтр по корпусу.
          </div>
        </div>
      ) : (
        <div className="muted">Не найдено событий с заполненной аудиторией.</div>
      )}

      {showPeriodBar ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className={periodScope === "all_days" ? "" : "secondary"}
            onClick={() => setPeriodScope("all_days")}
          >
            Все дни
          </button>
          {fourDays.map((d, i) => (
            <button
              key={d.day.toISOString()}
              type="button"
              className={periodScope === "chunk_day" && i === dayIdx ? "" : "secondary"}
              onClick={() => {
                setPeriodScope("chunk_day");
                setDayIdx(i);
              }}
            >
              {formatDayFull(d.day)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>{activeRoomKey ? roomLabel(activeRoomKey) : "Аудитория"}</div>
          <div className="chip">
            {roomFilteredTimed.length + roomFilteredUntimed.length} событий · {chipDayLabel}
          </div>
        </div>

        <div style={{ height: 10 }} />

        {periodScope === "all_days" && allDaysSections ? (
          allDaysSections.length ? (
            <div className="grid" style={{ gap: 14 }}>
              {allDaysSections.map((sec) => (
                <div key={sec.dayKey} className="grid" style={{ gap: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{formatDayFull(localDateFromDayKey(sec.dayKey))}</div>
                  <div className="grid" style={{ gap: 10 }}>
                    {sec.timed.map((e: any) => renderTimedCard(e))}
                    {sec.untimed.map((e) => renderUntimedCard(e))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              Нет событий для этой аудитории за выбранный период.
            </div>
          )
        ) : roomFilteredTimed.length || roomFilteredUntimed.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {roomFilteredTimed.map((e: any) => renderTimedCard(e))}
            {roomFilteredUntimed.map((e) => renderUntimedCard(e))}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            {periodScope === "all_days"
              ? "Нет событий для этой аудитории за выбранный период."
              : "Нет событий для этой аудитории в выбранный день."}
          </div>
        )}
      </div>
    </div>
  );
}

