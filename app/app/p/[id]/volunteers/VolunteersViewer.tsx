"use client";

import { useEffect, useMemo, useState } from "react";
import { collectSortedProgramDayKeysFromIso, formatDayFull, localDateFromDayKey } from "@/lib/schedule";
import type { ProjectEventIso } from "../event-data";

function eventDayKey(e: ProjectEventIso): string {
  if (e.kind === "untimed" && e.day) return String(e.day).slice(0, 10);
  if (e.start) return String(e.start).slice(0, 10);
  return "Без даты";
}

export function VolunteersViewer({ events }: { events: ProjectEventIso[] }) {
  const [periodScope, setPeriodScope] = useState<"chunk_day" | "all_days">("chunk_day");
  const [activeDayKey, setActiveDayKey] = useState("");

  const dayKeys = useMemo(() => collectSortedProgramDayKeysFromIso(events), [events]);

  useEffect(() => {
    if (!dayKeys.length) {
      setActiveDayKey("");
      setPeriodScope("all_days");
      return;
    }
    setActiveDayKey(dayKeys[0]!);
    setPeriodScope("chunk_day");
  }, [events, dayKeys]);

  const filtered = useMemo(() => {
    const base = periodScope === "all_days" ? events : events.filter((e) => eventDayKey(e) === activeDayKey);
    return [...base].sort((a, b) => {
      const dv = (b.volunteersCount ?? 0) - (a.volunteersCount ?? 0);
      if (dv !== 0) return dv;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });
  }, [events, periodScope, activeDayKey]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + (e.volunteersCount ?? 0), 0), [filtered]);

  return (
    <div className="grid" style={{ gap: 12 }}>
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

      <div className="row" style={{ marginBottom: 2, gap: 8 }}>
        <div className="chip">Мероприятий: {filtered.length}</div>
        <div className="chip">Всего волонтеров: {total}</div>
      </div>

      {filtered.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {filtered.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="chip">{eventDayKey(e)}</div>
                  <div className="chip">{e.volunteersCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">
          {periodScope === "all_days"
            ? "Нет мероприятий с количеством волонтеров больше нуля."
            : "Нет мероприятий с количеством волонтеров больше нуля в выбранный день."}
        </div>
      )}
    </div>
  );
}

