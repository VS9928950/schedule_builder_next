"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyPrintTimelineScale, clearPrintTimelineScale } from "@/lib/print-timeline-scale";
import { formatDayFull, localDateFromDayKey } from "@/lib/schedule";
import { TimelineViewer } from "../../timeline/TimelineViewer";
import { PrintButton } from "./PrintButton";

type IsoEv = Record<string, unknown> & {
  id?: string;
  title?: string;
  description?: string;
  description_md?: string;
  format?: string;
  kind?: string;
  start?: string;
  end?: string;
  day?: string;
  building?: string;
  room?: string;
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
};

type TimedRoomEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  dayKey: string;
  raw: IsoEv;
};

type UntimedRoomEvent = {
  id: string;
  title: string;
  dayKey: string;
  orderNo?: number;
  raw: IsoEv;
};

type RoomExportEntry = {
  key: string;
  label: string;
  building: string;
  room: string;
  timed: TimedRoomEvent[];
  untimed: UntimedRoomEvent[];
};

type RoomBuildingGroup = {
  building: string;
  label: string;
  rooms: RoomExportEntry[];
};

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

function roomShortLabel(entry: RoomExportEntry): string {
  return normToken(entry.room) || "Не указано";
}

function dayKeyFromEvent(ev: IsoEv): string {
  if ((ev.kind ?? "timed") === "untimed") return String(ev.day ?? "").slice(0, 10);
  return String(ev.start ?? "").slice(0, 10);
}

function formatHm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dateFromDayKey(dayKey: string): Date {
  const d = localDateFromDayKey(dayKey);
  if (Number.isFinite(d.getTime())) return d;
  return new Date(`${dayKey}T00:00:00`);
}

function buildRoomsExportEntries(events: IsoEv[], selectedDayKeys: string[]): RoomExportEntry[] {
  const daySet = new Set(selectedDayKeys);
  const byRoom = new Map<string, RoomExportEntry>();

  for (const ev of events) {
    if (!(ev.visible ?? true)) continue;
    const key = roomKeyFrom(ev.building, ev.room);
    if (!key) continue;
    const dayKey = dayKeyFromEvent(ev);
    if (!dayKey || (daySet.size > 0 && !daySet.has(dayKey))) continue;

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
      } satisfies RoomExportEntry);

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
      const dk = a.dayKey.localeCompare(b.dayKey);
      if (dk !== 0) return dk;
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

function groupRoomsByBuilding(entries: RoomExportEntry[]): RoomBuildingGroup[] {
  const map = new Map<string, RoomExportEntry[]>();
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

function eventDetails(raw: IsoEv): string[] {
  const responsibles = [
    raw.responsible1,
    raw.responsible2,
    raw.responsible3,
    raw.responsible4,
    raw.responsible5,
    raw.responsible6
  ]
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

export function PrintWorkspaceClient({
  projectId,
  activeBuildId,
  events,
  marks,
  style,
  layout,
  programDayKeys
}: {
  projectId: number;
  activeBuildId: number | null;
  events: IsoEv[];
  marks: Record<string, string[]> | null;
  style: Record<string, unknown> | null;
  layout: Record<string, unknown> | null;
  programDayKeys: string[];
}) {
  const [mode, setMode] = useState<"single" | "all">("single");
  const [activeKey, setActiveKey] = useState(programDayKeys[0] ?? "");
  const [roomsListMode, setRoomsListMode] = useState<"occupancy" | "events">("occupancy");
  const searchParams = useSearchParams();
  const exportView = String(searchParams.get("view") ?? "").trim();
  const isRoomsView = exportView === "rooms";
  const viewLabel =
    exportView === "tech-schedule"
      ? "Техрасписание"
      : exportView === "rooms"
        ? "Аудитории"
        : exportView === "responsibles"
          ? "Ответственные"
          : exportView === "vks"
            ? "ВКС"
            : exportView === "broadcasts"
              ? "Трансляции"
              : exportView === "interpretation"
                ? "Перевод"
                : exportView === "volunteers"
                  ? "Волонтеры"
                  : "Архитектура";

  const visibleKeys = useMemo(() => {
    const raw = (layout as { hidden_day_keys?: string[] } | null)?.hidden_day_keys;
    const hidden = new Set((Array.isArray(raw) ? raw : []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x))));
    return programDayKeys.filter((k) => !hidden.has(k));
  }, [programDayKeys, layout]);

  /** Глубокие ссылки с «Экспорт»: `?pdfMode=all|single`, `?pdfDay=YYYY-MM-DD`. */
  useEffect(() => {
    const pm = searchParams.get("pdfMode");
    if (pm === "all") setMode("all");
    else if (pm === "single") setMode("single");
  }, [searchParams]);

  useEffect(() => {
    const d = searchParams.get("pdfDay");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && visibleKeys.includes(d)) setActiveKey(d);
  }, [searchParams, visibleKeys]);

  useEffect(() => {
    if (!activeKey || !visibleKeys.includes(activeKey)) {
      setActiveKey(visibleKeys[0] ?? "");
    }
  }, [visibleKeys, activeKey]);

  /** С «Экспорт»: `?printDialog=1` — после загрузки открыть диалог печати (PDF через «Сохранить как PDF» в браузере). */
  useEffect(() => {
    if (searchParams.get("printDialog") !== "1") return;
    const t = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyPrintTimelineScale();
          window.print();
          try {
            const u = new URL(window.location.href);
            u.searchParams.delete("printDialog");
            window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
          } catch {
            // ignore
          }
        });
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchParams, mode, activeKey, visibleKeys]);

  const runPrintScale = () => {
    requestAnimationFrame(() => {
      applyPrintTimelineScale();
      requestAnimationFrame(() => applyPrintTimelineScale());
    });
  };

  /** Подгонка сетки: `beforeprint` + переход в print (PDF превью иногда без надёжного beforeprint). */
  useEffect(() => {
    window.addEventListener("beforeprint", runPrintScale);
    window.addEventListener("afterprint", clearPrintTimelineScale);

    const mq = window.matchMedia("(print)");
    const onMq = () => {
      if (mq.matches) runPrintScale();
      else clearPrintTimelineScale();
    };
    mq.addEventListener("change", onMq);

    return () => {
      window.removeEventListener("beforeprint", runPrintScale);
      window.removeEventListener("afterprint", clearPrintTimelineScale);
      mq.removeEventListener("change", onMq);
    };
  }, [mode, activeKey, visibleKeys]);

  const headingFor = (k: string) => {
    const d = localDateFromDayKey(k);
    return Number.isFinite(d.getTime()) ? formatDayFull(d) : k;
  };

  const selectedRoomsDayKeys = useMemo(() => {
    if (mode === "all") return visibleKeys;
    return activeKey ? [activeKey] : [];
  }, [mode, visibleKeys, activeKey]);

  const roomsEntries = useMemo(() => buildRoomsExportEntries(events, selectedRoomsDayKeys), [events, selectedRoomsDayKeys]);

  const renderRoomsList = (entries: RoomExportEntry[], dayKeys: string[]) => {
    if (!entries.length) {
      return <div className="muted">Нет данных по аудиториям для выбранного периода.</div>;
    }

    const daySet = new Set(dayKeys);

    const buildingGroups = groupRoomsByBuilding(entries);
    return (
      <div className="grid" style={{ gap: 12 }}>
        {buildingGroups.map((group) => (
          <div key={`building-${group.building}`} className="card" style={{ padding: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>{group.label}</div>
              <div className="chip">{group.rooms.length} аудиторий</div>
            </div>
            <div style={{ height: 8 }} />
            <div className="grid" style={{ gap: 10 }}>
              {group.rooms.map((entry) => {
          const isSingleDay = dayKeys.length === 1;
          if (roomsListMode === "occupancy") {
            const grouped = new Map<string, string[]>();
            const groupedTimed = new Map<string, TimedRoomEvent[]>();
            for (const t of entry.timed) {
              if (daySet.size > 0 && !daySet.has(t.dayKey)) continue;
              const arr = grouped.get(t.dayKey) ?? [];
              arr.push(`${formatHm(t.start)}-${formatHm(t.end)}`);
              grouped.set(t.dayKey, arr);
              const evArr = groupedTimed.get(t.dayKey) ?? [];
              evArr.push(t);
              groupedTimed.set(t.dayKey, evArr);
            }
            const untimedCount = entry.untimed.filter((u) => (daySet.size > 0 ? daySet.has(u.dayKey) : true)).length;

            return (
              <div key={`occ-${entry.key}`} className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 800 }}>{roomShortLabel(entry)}</div>
                {grouped.size ? (
                  <div className="grid" style={{ gap: 4, marginTop: 6 }}>
                    {Array.from(groupedTimed.keys())
                      .sort()
                      .map((dk) => {
                        const items = groupedTimed.get(dk) ?? [];
                        const first = items[0];
                        const last = items[items.length - 1];
                        return (
                        <div key={`${entry.key}-${dk}`} className="muted" style={{ fontSize: 12 }}>
                          {!isSingleDay ? <b>{headingFor(dk)}. </b> : null}
                          Количество мероприятий: {items.length}
                          {first && last ? ` · Старт мероприятий: ${formatHm(first.start)} · Окончание мероприятий: ${formatHm(last.end)}` : ""}
                          <div className="grid" style={{ gap: 2, marginTop: 4 }}>
                            {items.map((ev, idx) => (
                              <div key={`${entry.key}-${dk}-ev-${ev.id}-${idx}`} className="muted" style={{ fontSize: 12 }}>
                                {formatHm(ev.start)}-{formatHm(ev.end)} - {ev.title}
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Нет мероприятий с указанным временем.
                  </div>
                )}
                {untimedCount > 0 ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Дополнительно: {untimedCount} мероприят(ий) без указанного времени.
                  </div>
                ) : null}
              </div>
            );
          }

          const groupedEvents = new Map<string, Array<TimedRoomEvent | UntimedRoomEvent>>();
          for (const t of entry.timed) {
            if (daySet.size > 0 && !daySet.has(t.dayKey)) continue;
            const arr = groupedEvents.get(t.dayKey) ?? [];
            arr.push(t);
            groupedEvents.set(t.dayKey, arr);
          }
          for (const u of entry.untimed) {
            if (daySet.size > 0 && !daySet.has(u.dayKey)) continue;
            const arr = groupedEvents.get(u.dayKey) ?? [];
            arr.push(u);
            groupedEvents.set(u.dayKey, arr);
          }

          return (
            <div key={`ev-${entry.key}`} className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 800 }}>{roomShortLabel(entry)}</div>
              {!groupedEvents.size ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Нет событий в выбранном периоде.
                </div>
              ) : (
                <div className="grid" style={{ gap: 8, marginTop: 6 }}>
                  {Array.from(groupedEvents.keys())
                    .sort()
                    .map((dk) => {
                      const list = groupedEvents.get(dk) ?? [];
                      const ordered = [...list].sort((a, b) => {
                        const aIsTimed = "start" in a;
                        const bIsTimed = "start" in b;
                        if (aIsTimed && bIsTimed) return a.start.getTime() - b.start.getTime();
                        if (aIsTimed) return -1;
                        if (bIsTimed) return 1;
                        return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
                      });
                      const timedOnly = ordered.filter((x): x is TimedRoomEvent => "start" in x);
                      const first = timedOnly[0];
                      const last = timedOnly[timedOnly.length - 1];
                      return (
                        <div key={`${entry.key}-${dk}`}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            {!isSingleDay ? `${headingFor(dk)}. ` : ""}
                            Количество мероприятий: {ordered.length}
                            {first && last
                              ? ` · Старт мероприятий: ${formatHm(first.start)} · Окончание мероприятий: ${formatHm(last.end)}`
                              : ""}
                          </div>
                          <div className="grid" style={{ gap: 4, marginTop: 4 }}>
                            {ordered.map((ev, idx) => {
                              if ("start" in ev) {
                                const details = eventDetails(ev.raw);
                                return (
                                  <div key={`${entry.key}-${dk}-${ev.id}-${idx}`} className="grid" style={{ gap: 2 }}>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      {formatHm(ev.start)}-{formatHm(ev.end)} — {ev.title}
                                    </div>
                                    {details.map((line, dIdx) => (
                                      <div key={`${entry.key}-${dk}-${ev.id}-d-${dIdx}`} className="muted" style={{ fontSize: 12 }}>
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              const details = eventDetails(ev.raw);
                              return (
                                <div key={`${entry.key}-${dk}-${ev.id}-${idx}`} className="grid" style={{ gap: 2 }}>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    Без времени — {ev.title}
                                  </div>
                                  {details.map((line, dIdx) => (
                                    <div key={`${entry.key}-${dk}-${ev.id}-d-${dIdx}`} className="muted" style={{ fontSize: 12 }}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="print-workspace-no-print">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Печать / PDF · {viewLabel}</h2>
          <div className="row" style={{ gap: 8 }}>
            <PrintButton />
            <a className="chip" href={`/app/p/${projectId}/export`}>
              ← К экспорту
            </a>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8, maxWidth: 720 }}>
          A4 книжная: в диалоге печати — «Сохранить как PDF». На бумагу уходят только блоки ниже (без верхнего меню, без
          вкладок проекта и без панели настроек): заголовок даты один раз и сетка; при широкой сетке она автоматически
          уменьшается под ширину листа. Режим «Все дни» — каждый день с новой страницы.
        </p>
        <div className="row" style={{ gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>Область печати</span>
          <label className="row muted" style={{ gap: 8, fontSize: 13 }}>
            <input type="radio" name="pmode" checked={mode === "single"} onChange={() => setMode("single")} />
            Один выбранный день
          </label>
          <label className="row muted" style={{ gap: 8, fontSize: 13 }}>
            <input type="radio" name="pmode" checked={mode === "all"} onChange={() => setMode("all")} />
            Все дни (каждый с новой страницы)
          </label>
        </div>
        {isRoomsView ? (
          <>
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>Вид списка аудиторий</span>
              <label className="row muted" style={{ gap: 8, fontSize: 13 }}>
                <input
                  type="radio"
                  name="rooms-list-mode"
                  checked={roomsListMode === "occupancy"}
                  onChange={() => setRoomsListMode("occupancy")}
                />
                Перечень аудиторий с временем занятости
              </label>
              <label className="row muted" style={{ gap: 8, fontSize: 13 }}>
                <input
                  type="radio"
                  name="rooms-list-mode"
                  checked={roomsListMode === "events"}
                  onChange={() => setRoomsListMode("events")}
                />
                Перечень аудиторий со списками мероприятий
              </label>
            </div>
            {mode === "single" && visibleKeys.length ? (
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {visibleKeys.map((dk) => (
                  <button
                    key={dk}
                    type="button"
                    className={dk === activeKey ? "" : "secondary"}
                    onClick={() => setActiveKey(dk)}
                  >
                    {headingFor(dk)}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <div style={{ height: 14 }} />
        {isRoomsView ? (
          <div className="grid" style={{ gap: 8 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Сортировка аудиторий строится по выбранному периоду ({mode === "single" ? headingFor(activeKey) : "Все дни"}) с
              учетом пары «Корпус + Аудитория».
            </div>
            {renderRoomsList(roomsEntries, selectedRoomsDayKeys)}
          </div>
        ) : (
          <div className="tl-print-screen-scale">
            <TimelineViewer
              events={events as any}
              projectId={projectId}
              activeBuildId={activeBuildId}
              initialMarks={marks}
              initialStyle={style as any}
              initialLayout={layout as any}
              hideControls
              onActiveDayKeyChange={setActiveKey}
            />
          </div>
        )}
      </div>

      <div className="print-workspace-print-only">
        {isRoomsView ? (
          <>
            {mode === "single" && activeKey ? (
              <section className="print-a4-sheet">
                <h2 className="print-day-heading">{headingFor(activeKey)}</h2>
                {renderRoomsList(buildRoomsExportEntries(events, [activeKey]), [activeKey])}
              </section>
            ) : null}
            {mode === "all"
              ? visibleKeys.map((k) => (
                  <section key={k} className="print-a4-sheet print-page-break-after">
                    <h2 className="print-day-heading">{headingFor(k)}</h2>
                    {renderRoomsList(buildRoomsExportEntries(events, [k]), [k])}
                  </section>
                ))
              : null}
          </>
        ) : (
          <>
            {mode === "single" && activeKey ? (
              <section className="print-a4-sheet">
                <h2 className="print-day-heading">{headingFor(activeKey)}</h2>
                <div className="print-timeline-fit">
                  <div className="print-timeline-print-scale-inner">
                    <TimelineViewer
                      events={events as any}
                      projectId={projectId}
                      activeBuildId={null}
                      initialMarks={marks}
                      initialStyle={style as any}
                      initialLayout={layout as any}
                      hideControls
                      pinnedDayKey={activeKey}
                      hidePackChrome
                      omitDayBanner
                    />
                  </div>
                </div>
              </section>
            ) : null}
            {mode === "all"
              ? visibleKeys.map((k) => (
                  <section key={k} className="print-a4-sheet print-page-break-after">
                    <h2 className="print-day-heading">{headingFor(k)}</h2>
                    <div className="print-timeline-fit">
                      <div className="print-timeline-print-scale-inner">
                        <TimelineViewer
                          events={events as any}
                          projectId={projectId}
                          activeBuildId={null}
                          initialMarks={marks}
                          initialStyle={style as any}
                          initialLayout={layout as any}
                          hideControls
                          pinnedDayKey={k}
                          hidePackChrome
                          omitDayBanner
                        />
                      </div>
                    </div>
                  </section>
                ))
              : null}
          </>
        )}
      </div>
    </>
  );
}
