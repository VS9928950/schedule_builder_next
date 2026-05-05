"use client";

import { useEffect, useMemo, useState } from "react";
import { collectSortedProgramDayKeysFromIso, formatDayFull, formatTime, localDateFromDayKey } from "@/lib/schedule";

type IsoEvent = {
  id?: string;
  title?: string;
  kind?: "timed" | "untimed";
  day?: string;
  start?: string;
  end?: string;
  format?: string;
  building?: string;
  room?: string;
  responsible1?: string;
  responsible2?: string;
  responsible3?: string;
  responsible4?: string;
  responsible5?: string;
  responsible6?: string;
};

type TimedWithDates = IsoEvent & { _startDate: Date; _endDate: Date };

function eventDayKey(e: IsoEvent): string {
  if (e.kind === "untimed" && e.day) return String(e.day).slice(0, 10);
  if (e.start) return String(e.start).slice(0, 10);
  return "Без даты";
}

function normalizeName(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectResponsibles(e: IsoEvent): string[] {
  return [e.responsible1, e.responsible2, e.responsible3, e.responsible4, e.responsible5, e.responsible6]
    .map((v) => normalizeName(v))
    .filter(Boolean);
}

function hasResponsible(e: IsoEvent, selectedNorm: string): boolean {
  if (!selectedNorm) return true;
  return collectResponsibles(e).some((name) => normalizeName(name).toLocaleLowerCase("ru-RU") === selectedNorm);
}

export function ResponsiblesViewer({ events }: { events: IsoEvent[] }) {
  const [periodScope, setPeriodScope] = useState<"chunk_day" | "all_days">("chunk_day");
  const [activeDayKey, setActiveDayKey] = useState("");
  const [activeResponsibleNorm, setActiveResponsibleNorm] = useState("");

  const dayKeys = useMemo(() => collectSortedProgramDayKeysFromIso(events as any), [events]);

  const responsibleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) {
      for (const name of collectResponsibles(e)) {
        const norm = name.toLocaleLowerCase("ru-RU");
        if (!norm) continue;
        if (!seen.has(norm)) seen.set(norm, name);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ru-RU"))
      .map(([value, label]) => ({ value, label }));
  }, [events]);

  useEffect(() => {
    if (!dayKeys.length) {
      setActiveDayKey("");
      setPeriodScope("all_days");
    } else {
      setActiveDayKey(dayKeys[0]!);
      setPeriodScope("chunk_day");
    }
  }, [events, dayKeys]);

  useEffect(() => {
    if (!responsibleOptions.length) {
      setActiveResponsibleNorm("");
      return;
    }
    if (activeResponsibleNorm && responsibleOptions.some((x) => x.value === activeResponsibleNorm)) return;
    setActiveResponsibleNorm(responsibleOptions[0]!.value);
  }, [activeResponsibleNorm, responsibleOptions]);

  const filtered = useMemo(() => {
    const byPerson = events.filter((e) => hasResponsible(e, activeResponsibleNorm));
    const byDay = periodScope === "all_days" ? byPerson : byPerson.filter((e) => eventDayKey(e) === activeDayKey);
    return [...byDay].sort((a, b) => {
      const da = eventDayKey(a).localeCompare(eventDayKey(b));
      if (da !== 0) return da;
      if (a.start && b.start) {
        const dt = String(a.start).localeCompare(String(b.start));
        if (dt !== 0) return dt;
      }
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });
  }, [events, activeResponsibleNorm, periodScope, activeDayKey]);

  const selectedLabel = useMemo(
    () => responsibleOptions.find((x) => x.value === activeResponsibleNorm)?.label ?? "—",
    [responsibleOptions, activeResponsibleNorm]
  );

  const timedForConflicts = useMemo(() => {
    const out: TimedWithDates[] = [];
    for (const e of filtered) {
      if (!e.start || !e.end) continue;
      const s = new Date(e.start);
      const en = new Date(e.end);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(en.getTime()) || en <= s) continue;
      out.push({ ...e, _startDate: s, _endDate: en });
    }
    out.sort((a, b) => a._startDate.getTime() - b._startDate.getTime());
    return out;
  }, [filtered]);

  const conflicts = useMemo(() => {
    const overlaps: Array<{ a: TimedWithDates; b: TimedWithDates }> = [];
    for (let i = 0; i < timedForConflicts.length; i++) {
      const a = timedForConflicts[i]!;
      for (let j = i + 1; j < timedForConflicts.length; j++) {
        const b = timedForConflicts[j]!;
        if (b._startDate.getTime() >= a._endDate.getTime()) break;
        overlaps.push({ a, b });
      }
    }
    return overlaps;
  }, [timedForConflicts]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {responsibleOptions.length ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Ответственный</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {responsibleOptions.map((x) => (
              <button
                key={x.value}
                type="button"
                className={x.value === activeResponsibleNorm ? "" : "secondary"}
                onClick={() => setActiveResponsibleNorm(x.value)}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {dayKeys.length ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className={periodScope === "all_days" ? "" : "secondary"} onClick={() => setPeriodScope("all_days")}>
            Все дни
          </button>
          {dayKeys.map((dk) => (
            <button
              key={dk}
              type="button"
              className={periodScope === "chunk_day" && dk === activeDayKey ? "" : "secondary"}
              onClick={() => {
                setPeriodScope("chunk_day");
                setActiveDayKey(dk);
              }}
            >
              {formatDayFull(localDateFromDayKey(dk))}
            </button>
          ))}
        </div>
      ) : null}

      {activeResponsibleNorm && conflicts.length ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Проверка занятости ответственного</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Для <b>{selectedLabel}</b> найдены пересечения по времени: <b>{conflicts.length}</b>.
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8, whiteSpace: "pre-line" }}>
            {conflicts
              .slice(0, 16)
              .map(({ a, b }) => {
                const span = `${eventDayKey(a)} ${formatTime(a._startDate)}-${formatTime(a._endDate)}`;
                const left = String(a.title ?? "Без названия");
                const right = String(b.title ?? "Без названия");
                return `${span}: "${left}" ↔ "${right}"`;
              })
              .join("\n")}
          </div>
        </div>
      ) : null}

      {filtered.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {filtered.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="chip">{eventDayKey(e)}</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {[e.format, e.building, e.room].filter(Boolean).join(" · ")}
              </div>
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                {collectResponsibles(e).map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">
          {responsibleOptions.length
            ? periodScope === "all_days"
              ? "Нет мероприятий для выбранного ответственного."
              : "Нет мероприятий для выбранного ответственного в выбранный день."
            : "Нет мероприятий с заполненными ответственными."}
        </div>
      )}
    </div>
  );
}

