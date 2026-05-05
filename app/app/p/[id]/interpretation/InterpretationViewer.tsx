"use client";

import { useEffect, useMemo, useState } from "react";
import { collectSortedProgramDayKeysFromIso, formatDayFull, localDateFromDayKey } from "@/lib/schedule";

type IsoEvent = {
  id?: string;
  title?: string;
  kind?: "timed" | "untimed";
  day?: string;
  start?: string;
  end?: string;
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
};

function eventDayKey(e: IsoEvent): string {
  if (e.kind === "untimed" && e.day) return String(e.day).slice(0, 10);
  if (e.start) return String(e.start).slice(0, 10);
  return "Без даты";
}

export function InterpretationViewer({ events }: { events: IsoEvent[] }) {
  const [periodScope, setPeriodScope] = useState<"chunk_day" | "all_days">("chunk_day");
  const [activeDayKey, setActiveDayKey] = useState("");

  const dayKeys = useMemo(() => collectSortedProgramDayKeysFromIso(events as any), [events]);

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
      const da = eventDayKey(a).localeCompare(eventDayKey(b));
      if (da !== 0) return da;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru-RU");
    });
  }, [events, periodScope, activeDayKey]);

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

      {filtered.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {filtered.map((e, idx) => (
            <div key={`${e.id ?? idx}-${eventDayKey(e)}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>{e.title ?? "Без названия"}</div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="chip">{eventDayKey(e)}</div>
                  <div className="chip">{e.simultaneousInterpretation}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">
          {periodScope === "all_days" ? "Нет данных по синхронному переводу." : "Нет данных по синхронному переводу в выбранный день."}
        </div>
      )}
    </div>
  );
}

