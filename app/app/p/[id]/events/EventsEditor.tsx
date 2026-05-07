"use client";

import { useMemo, useState } from "react";
import { normalizeHttpUrl } from "@/lib/schedule";

export type EditableEvent = {
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
  photosFromResponsible?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  supportMaterials_md?: string;
  supportMaterials?: string;
  banner?: "Общий" | "Секционный" | "Не указано";
  visible?: boolean;
  start: string; // ISO
  end: string; // ISO
  url?: string;
};

export type UntimedEditableEvent = {
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
  photosFromResponsible?: "Да" | "Нет" | "Не указано";
  translation?: "Да" | "Нет" | "Не указано";
  simultaneousInterpretation?: "Да" | "Нет" | "Не указано";
  supportMaterials_md?: string;
  supportMaterials?: string;
  banner?: "Общий" | "Секционный" | "Не указано";
  orderNo?: number;
  day: string; // ISO date
  visible?: boolean;
  url?: string;
};

function fmtRange(ev: EditableEvent) {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const day = s.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const st = s.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const en = e.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${st}–${en}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const s = d.toLocaleDateString("ru-RU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  // interpret as local time
  const d = new Date(v);
  return d.toISOString();
}

const YES_NO_UNKNOWN: Array<"Да" | "Нет" | "Не указано"> = ["Да", "Нет", "Не указано"];
const BANNER_OPTIONS: Array<"Общий" | "Секционный" | "Не указано"> = ["Общий", "Секционный", "Не указано"];

export function EventsEditor({
  projectId,
  activeBuildId,
  initialEvents,
  untimedEvents: initialUntimed
}: {
  projectId: number;
  activeBuildId: number;
  initialEvents: EditableEvent[];
  untimedEvents: UntimedEditableEvent[];
}) {
  function shouldShowFormat(fmt: unknown) {
    const s = fmt == null ? "" : String(fmt).trim();
    if (!s) return false;
    return s !== "Питание";
  }

  const [events, setEvents] = useState<EditableEvent[]>(initialEvents);
  const [untimed, setUntimed] = useState<UntimedEditableEvent[]>(initialUntimed);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUntimedId, setEditingUntimedId] = useState<string | null>(null);

  const editing = useMemo(() => (editingId ? events.find((e) => e.id === editingId) ?? null : null), [events, editingId]);
  const editingUntimed = useMemo(
    () => (editingUntimedId ? untimed.find((e) => e.id === editingUntimedId) ?? null : null),
    [untimed, editingUntimedId]
  );

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const groups = new Map<string, EditableEvent[]>();
    for (const ev of sorted) {
      const key = dayKey(ev.start);
      const arr = groups.get(key) ?? [];
      arr.push(ev);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, list]) => ({
      key,
      label: dayLabel(list[0]!.start),
      events: list
    }));
  }, [events]);

  const untimedGrouped = useMemo(() => {
    const sorted = [...untimed].sort((a, b) => {
      const da = a.day.slice(0, 10);
      const db = b.day.slice(0, 10);
      if (da !== db) return da < db ? -1 : 1;
      return (a.orderNo ?? 1e9) - (b.orderNo ?? 1e9);
    });
    const groups = new Map<string, UntimedEditableEvent[]>();
    for (const ev of sorted) {
      const key = ev.day.slice(0, 10);
      const arr = groups.get(key) ?? [];
      arr.push(ev);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, list]) => ({
      key,
      label: dayLabel(list[0]!.day),
      events: list
    }));
  }, [untimed]);

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`/app/p/${projectId}/builds/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildId: activeBuildId,
          events: [
            ...untimed.map((e) => ({ ...e, kind: "untimed" })),
            ...events.map((e) => ({ ...e, kind: "timed" }))
          ]
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  function patchEvent(id: string, patch: Partial<EditableEvent>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setDirty(true);
  }

  function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDirty(true);
    if (editingId === id) setEditingId(null);
  }

  function patchUntimed(id: string, patch: Partial<UntimedEditableEvent>) {
    setUntimed((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setDirty(true);
  }

  function deleteUntimed(id: string) {
    setUntimed((prev) => prev.filter((e) => e.id !== id));
    setDirty(true);
    if (editingUntimedId === id) setEditingUntimedId(null);
  }

  function toDateInput(iso: string) {
    return iso.slice(0, 10);
  }
  function fromDateInput(v: string) {
    // keep as ISO at midnight UTC for stability
    return new Date(`${v}T00:00:00`).toISOString();
  }

  function clamp01(x: number) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function roundUpToMinutes(d: Date, stepMin: number) {
    const ms = d.getTime();
    const step = stepMin * 60 * 1000;
    return new Date(Math.ceil(ms / step) * step);
  }

  function createNewTimedEvent() {
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const last = sorted[sorted.length - 1];
    const base = last ? new Date(last.end) : new Date();
    const start = roundUpToMinutes(base, 15);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const id = `t-${Date.now()}`;
    const ev: EditableEvent = {
      id,
      title: "Новое мероприятие",
      format: "",
      building: "",
      room: "",
      visible: true,
      start: start.toISOString(),
      end: end.toISOString(),
      description_md: "",
      description: ""
    };
    setEvents((prev) => [...prev, ev]);
    setDirty(true);
    setEditingId(id);
    setEditingUntimedId(null);
  }

  function createNewUntimedEvent() {
    const day = (() => {
      const anyDay = untimed[0]?.day || events[0]?.start;
      if (anyDay) return new Date(anyDay);
      return new Date();
    })();
    const key = dayKey(day.toISOString());
    const sameDay = untimed.filter((e) => e.day.slice(0, 10) === key);
    const maxNo = sameDay.reduce((m, e) => Math.max(m, typeof e.orderNo === "number" ? e.orderNo : 0), 0);
    const id = `u-${Date.now()}`;
    const ev: UntimedEditableEvent = {
      id,
      title: "Новое мероприятие (без времени)",
      format: "",
      building: "",
      room: "",
      visible: true,
      day: fromDateInput(key),
      orderNo: maxNo + 1,
      description_md: "",
      description: ""
    };
    setUntimed((prev) => [...prev, ev]);
    setDirty(true);
    setEditingUntimedId(id);
    setEditingId(null);
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Событий: {events.length} · Без времени: {untimed.length} {dirty ? "· есть несохранённые изменения" : ""}
        </div>
        <div className="row">
          {error ? <div className="error">{error}</div> : null}
          <button type="button" className="secondary" onClick={createNewTimedEvent}>
            Добавить с указанием времени
          </button>
          <button type="button" className="secondary" onClick={createNewUntimedEvent}>
            Добавить без указания времени
          </button>
          <button type="button" onClick={saveAll} disabled={!dirty || saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      {editing ? (
        <div
          className="card"
          style={{
            padding: 14,
            position: "sticky",
            top: 12,
            zIndex: 6,
            backdropFilter: "blur(10px)",
            background: "rgba(255,255,255,.94)",
            boxShadow: "0 18px 48px rgba(15,23,42,.16)",
            isolation: "isolate",
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto"
          }}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900 }}>Редактирование</div>
            <button type="button" className="secondary" onClick={() => setEditingId(null)}>
              Закрыть
            </button>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid2">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Название
              </div>
              <input value={editing.title} onChange={(e) => patchEvent(editing.id, { title: e.target.value })} />
            </div>
            <div className="row" style={{ alignItems: "center", marginTop: 22 }}>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editing.visible ?? true}
                  onChange={(e) => patchEvent(editing.id, { visible: e.target.checked })}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  Показывать в общем расписании
                </span>
              </label>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Формат
              </div>
              <input value={editing.format ?? ""} onChange={(e) => patchEvent(editing.id, { format: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Начало
              </div>
              <input
                type="datetime-local"
                value={toLocalInputValue(editing.start)}
                onChange={(e) => patchEvent(editing.id, { start: fromLocalInputValue(e.target.value) })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Окончание
              </div>
              <input
                type="datetime-local"
                value={toLocalInputValue(editing.end)}
                onChange={(e) => patchEvent(editing.id, { end: fromLocalInputValue(e.target.value) })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Корпус
              </div>
              <input value={editing.building ?? ""} onChange={(e) => patchEvent(editing.id, { building: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Аудитория
              </div>
              <input value={editing.room ?? ""} onChange={(e) => patchEvent(editing.id, { room: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Количество волонтеров
              </div>
              <input
                type="number"
                min={0}
                value={editing.volunteersCount ?? ""}
                onChange={(e) =>
                  patchEvent(editing.id, {
                    volunteersCount: e.target.value === "" ? undefined : Number(e.target.value)
                  })
                }
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                ВКС
              </div>
              <select value={editing.vks ?? ""} onChange={(e) => patchEvent(editing.id, { vks: (e.target.value as any) || undefined })}>
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`vks-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Трансляция
              </div>
              <select
                value={editing.translation ?? ""}
                onChange={(e) => patchEvent(editing.id, { translation: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`translation-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Синхронный перевод
              </div>
              <select
                value={editing.simultaneousInterpretation ?? ""}
                onChange={(e) =>
                  patchEvent(editing.id, {
                    simultaneousInterpretation: (e.target.value as any) || undefined
                  })
                }
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`si-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 1
              </div>
              <input value={editing.responsible1 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible1: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 2
              </div>
              <input value={editing.responsible2 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible2: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 3
              </div>
              <input value={editing.responsible3 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible3: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 4
              </div>
              <input value={editing.responsible4 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible4: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 5
              </div>
              <input value={editing.responsible5 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible5: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 6
              </div>
              <input value={editing.responsible6 ?? ""} onChange={(e) => patchEvent(editing.id, { responsible6: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Тимлид
              </div>
              <input value={editing.teamLead ?? ""} onChange={(e) => patchEvent(editing.id, { teamLead: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Фотографии от ответственного
              </div>
              <select
                value={editing.photosFromResponsible ?? ""}
                onChange={(e) => patchEvent(editing.id, { photosFromResponsible: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`photos-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Баннер
              </div>
              <select value={editing.banner ?? ""} onChange={(e) => patchEvent(editing.id, { banner: (e.target.value as any) || undefined })}>
                <option value="">—</option>
                {BANNER_OPTIONS.map((v) => (
                  <option key={`banner-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Сопроводительные материалы (Форматируемое)
              </div>
              <textarea
                  value={editing.supportMaterials_md ?? ""}
                  onChange={(e) => patchEvent(editing.id, { supportMaterials_md: e.target.value })}
                />
              </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Сопроводительные материалы (Загруженное)
              </div>
              <textarea
                value={editing.supportMaterials ?? ""}
                onChange={(e) => patchEvent(editing.id, { supportMaterials: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ссылка (http или https, можно пусто)
              </div>
              <input
                value={editing.url ?? ""}
                onChange={(e) => patchEvent(editing.id, { url: e.target.value })}
                onBlur={() => {
                  const u = normalizeHttpUrl(editing.url);
                  patchEvent(editing.id, { url: u ?? "" });
                }}
                placeholder="https://…"
              />
            </div>
          </div>
          <div style={{ height: 10 }} />
          <div>
            <div className="grid2">
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Форматируемое описание
                </div>
                <textarea
                  value={editing.description_md ?? ""}
                  onChange={(e) => patchEvent(editing.id, { description_md: e.target.value })}
                  placeholder={"Пример:\n## Участники мероприятия\n- Иванов И.И. — *участник*\n- Петров П.П. — *жюри*"}
                />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Загруженное описание
                </div>
                <textarea value={editing.description ?? ""} onChange={(e) => patchEvent(editing.id, { description: e.target.value })} />
              </div>
            </div>
            <div style={{ height: 10 }} />
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Стиль мероприятия (переопределение)</div>
              <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                <label className="muted" style={{ fontSize: 12 }}>
                  Подложка
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editing.style_override?.eventBgColor ?? "#60a5fa"}
                      onChange={(e) =>
                        patchEvent(editing.id, {
                          style_override: { ...(editing.style_override ?? {}), eventBgColor: e.target.value }
                        })
                      }
                      style={{ width: 44, padding: 0, height: 36 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={editing.style_override?.eventBgAlpha ?? 0.1}
                      onChange={(e) =>
                        patchEvent(editing.id, {
                          style_override: { ...(editing.style_override ?? {}), eventBgAlpha: clamp01(Number(e.target.value)) }
                        })
                      }
                      style={{ width: 160 }}
                    />
                    <span className="chip">{(editing.style_override?.eventBgAlpha ?? 0.1).toFixed(2)}</span>
                  </div>
                </label>

                <label className="muted" style={{ fontSize: 12 }}>
                  Обводка
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editing.style_override?.eventBorderColor ?? "#ffffff"}
                      onChange={(e) =>
                        patchEvent(editing.id, {
                          style_override: { ...(editing.style_override ?? {}), eventBorderColor: e.target.value }
                        })
                      }
                      style={{ width: 44, padding: 0, height: 36 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={editing.style_override?.eventBorderAlpha ?? 0.14}
                      onChange={(e) =>
                        patchEvent(editing.id, {
                          style_override: { ...(editing.style_override ?? {}), eventBorderAlpha: clamp01(Number(e.target.value)) }
                        })
                      }
                      style={{ width: 160 }}
                    />
                    <span className="chip">{(editing.style_override?.eventBorderAlpha ?? 0.14).toFixed(2)}</span>
                  </div>
                </label>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => patchEvent(editing.id, { style_override: undefined })}
                >
                  Сбросить переопределение
                </button>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Верстка на таймлайне</div>
              <div className="row" style={{ gap: 12 }}>
                <label className="row muted" style={{ gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={editing.layout_override?.fullWidth ?? false}
                    onChange={(e) =>
                      patchEvent(editing.id, {
                        layout_override: { ...(editing.layout_override ?? {}), fullWidth: e.target.checked }
                      })
                    }
                  />
                  растянуть по всей ширине (для длинных блоков)
                </label>
                <label className="row muted" style={{ gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={editing.layout_override?.stackOthersBelow ?? true}
                    onChange={(e) =>
                      patchEvent(editing.id, {
                        layout_override: { ...(editing.layout_override ?? {}), stackOthersBelow: e.target.checked }
                      })
                    }
                  />
                  сдвигать другие события этого времени ниже
                </label>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Режим “на всю ширину” полезен для «Финал конкурса НИР» — можно увеличить высоту и не ломать соседние колонки.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingUntimed ? (
        <div
          className="card"
          style={{
            padding: 14,
            // Avoid sticky-on-sticky overlap when both editors are open.
            position: editing ? "relative" : "sticky",
            top: 12,
            zIndex: 5,
            backdropFilter: editing ? "none" : "blur(10px)",
            ...(editing
              ? null
              : {
                  background: "rgba(255,255,255,.94)",
                  boxShadow: "0 18px 48px rgba(15,23,42,.16)",
                  isolation: "isolate"
                }),
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto"
          }}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900 }}>Редактирование (без времени)</div>
            <button type="button" className="secondary" onClick={() => setEditingUntimedId(null)}>
              Закрыть
            </button>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid2">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Дата
              </div>
              <input
                type="date"
                value={toDateInput(editingUntimed.day)}
                onChange={(e) => patchUntimed(editingUntimed.id, { day: fromDateInput(e.target.value) })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                № (очередность)
              </div>
              <input
                type="number"
                value={editingUntimed.orderNo ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { orderNo: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Название
              </div>
              <input value={editingUntimed.title} onChange={(e) => patchUntimed(editingUntimed.id, { title: e.target.value })} />
            </div>
            <div className="row" style={{ alignItems: "center", marginTop: 22 }}>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editingUntimed.visible ?? true}
                  onChange={(e) => patchUntimed(editingUntimed.id, { visible: e.target.checked })}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  Показывать в общем расписании
                </span>
              </label>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Формат
              </div>
              <input value={editingUntimed.format ?? ""} onChange={(e) => patchUntimed(editingUntimed.id, { format: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Корпус
              </div>
              <input value={editingUntimed.building ?? ""} onChange={(e) => patchUntimed(editingUntimed.id, { building: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Аудитория
              </div>
              <input value={editingUntimed.room ?? ""} onChange={(e) => patchUntimed(editingUntimed.id, { room: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Количество волонтеров
              </div>
              <input
                type="number"
                min={0}
                value={editingUntimed.volunteersCount ?? ""}
                onChange={(e) =>
                  patchUntimed(editingUntimed.id, {
                    volunteersCount: e.target.value === "" ? undefined : Number(e.target.value)
                  })
                }
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                ВКС
              </div>
              <select
                value={editingUntimed.vks ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { vks: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`u-vks-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Трансляция
              </div>
              <select
                value={editingUntimed.translation ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { translation: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`u-translation-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Синхронный перевод
              </div>
              <select
                value={editingUntimed.simultaneousInterpretation ?? ""}
                onChange={(e) =>
                  patchUntimed(editingUntimed.id, {
                    simultaneousInterpretation: (e.target.value as any) || undefined
                  })
                }
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`u-si-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 1
              </div>
              <input
                value={editingUntimed.responsible1 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible1: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 2
              </div>
              <input
                value={editingUntimed.responsible2 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible2: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 3
              </div>
              <input
                value={editingUntimed.responsible3 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible3: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 4
              </div>
              <input
                value={editingUntimed.responsible4 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible4: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 5
              </div>
              <input
                value={editingUntimed.responsible5 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible5: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ответственный сотрудник 6
              </div>
              <input
                value={editingUntimed.responsible6 ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { responsible6: e.target.value })}
              />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Тимлид
              </div>
              <input value={editingUntimed.teamLead ?? ""} onChange={(e) => patchUntimed(editingUntimed.id, { teamLead: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Фотографии от ответственного
              </div>
              <select
                value={editingUntimed.photosFromResponsible ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { photosFromResponsible: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {YES_NO_UNKNOWN.map((v) => (
                  <option key={`u-photos-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Баннер
              </div>
              <select
                value={editingUntimed.banner ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { banner: (e.target.value as any) || undefined })}
              >
                <option value="">—</option>
                {BANNER_OPTIONS.map((v) => (
                  <option key={`u-banner-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Сопроводительные материалы (Форматируемое)
              </div>
              <textarea
                  value={editingUntimed.supportMaterials_md ?? ""}
                  onChange={(e) => patchUntimed(editingUntimed.id, { supportMaterials_md: e.target.value })}
                />
              </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Сопроводительные материалы (Загруженное)
              </div>
              <textarea
                value={editingUntimed.supportMaterials ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { supportMaterials: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Ссылка (http или https, можно пусто)
              </div>
              <input
                value={editingUntimed.url ?? ""}
                onChange={(e) => patchUntimed(editingUntimed.id, { url: e.target.value })}
                onBlur={() => {
                  const u = normalizeHttpUrl(editingUntimed.url);
                  patchUntimed(editingUntimed.id, { url: u ?? "" });
                }}
                placeholder="https://…"
              />
            </div>
          </div>
          <div style={{ height: 10 }} />
          <div>
            <div className="grid2">
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Форматируемое описание
                </div>
                <textarea
                  value={editingUntimed.description_md ?? ""}
                  onChange={(e) => patchUntimed(editingUntimed.id, { description_md: e.target.value })}
                  placeholder={"Пример:\n## Участники мероприятия\n- Иванов И.И. — *участник*\n- Петров П.П. — *жюри*"}
                />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Загруженное описание
                </div>
                <textarea value={editingUntimed.description ?? ""} onChange={(e) => patchUntimed(editingUntimed.id, { description: e.target.value })} />
              </div>
            </div>
            <div style={{ height: 10 }} />
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Стиль мероприятия (переопределение)</div>
              <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                <label className="muted" style={{ fontSize: 12 }}>
                  Подложка
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editingUntimed.style_override?.eventBgColor ?? "#60a5fa"}
                      onChange={(e) =>
                        patchUntimed(editingUntimed.id, {
                          style_override: { ...(editingUntimed.style_override ?? {}), eventBgColor: e.target.value }
                        })
                      }
                      style={{ width: 44, padding: 0, height: 36 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={editingUntimed.style_override?.eventBgAlpha ?? 0.1}
                      onChange={(e) =>
                        patchUntimed(editingUntimed.id, {
                          style_override: { ...(editingUntimed.style_override ?? {}), eventBgAlpha: clamp01(Number(e.target.value)) }
                        })
                      }
                      style={{ width: 160 }}
                    />
                    <span className="chip">{(editingUntimed.style_override?.eventBgAlpha ?? 0.1).toFixed(2)}</span>
                  </div>
                </label>

                <label className="muted" style={{ fontSize: 12 }}>
                  Обводка
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editingUntimed.style_override?.eventBorderColor ?? "#ffffff"}
                      onChange={(e) =>
                        patchUntimed(editingUntimed.id, {
                          style_override: { ...(editingUntimed.style_override ?? {}), eventBorderColor: e.target.value }
                        })
                      }
                      style={{ width: 44, padding: 0, height: 36 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={editingUntimed.style_override?.eventBorderAlpha ?? 0.14}
                      onChange={(e) =>
                        patchUntimed(editingUntimed.id, {
                          style_override: { ...(editingUntimed.style_override ?? {}), eventBorderAlpha: clamp01(Number(e.target.value)) }
                        })
                      }
                      style={{ width: 160 }}
                    />
                    <span className="chip">{(editingUntimed.style_override?.eventBorderAlpha ?? 0.14).toFixed(2)}</span>
                  </div>
                </label>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => patchUntimed(editingUntimed.id, { style_override: undefined })}
                >
                  Сбросить переопределение
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {untimed.length ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900 }}>События без указанного времени</div>
            <div className="chip">{untimed.length}</div>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid" style={{ gap: 12 }}>
            {untimedGrouped.map((g) => (
              <div key={`ug-${g.key}`} className="grid" style={{ gap: 10 }}>
                <div className="card" style={{ padding: "10px 12px" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{g.label}</div>
                    <div className="chip">{g.events.length}</div>
                  </div>
                </div>
                {g.events.map((ev) => (
                  <div key={`u-${ev.id}`} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 800 }}>{ev.title}</div>
                      <div className="row">
                        <label className="row muted" style={{ gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={ev.visible ?? true}
                            onChange={(e) => patchUntimed(ev.id, { visible: e.target.checked })}
                          />
                          показывать
                        </label>
                        <div className="chip">№ {ev.orderNo ?? "—"}</div>
                        <button type="button" className="secondary" onClick={() => setEditingUntimedId(ev.id)}>
                          Править
                        </button>
                        <button type="button" className="secondary" onClick={() => deleteUntimed(ev.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {[
                        shouldShowFormat(ev.format) ? String(ev.format).trim() : null,
                        ev.building ? String(ev.building).trim() : null,
                        ev.room ? String(ev.room).trim() : null
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {ev.description ? <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>{ev.description}</div> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid" style={{ gap: 10 }}>
        {grouped.map((g) => (
          <div key={g.key} className="grid" style={{ gap: 10 }}>
            <div
              className="card"
              style={{
                padding: "10px 12px",
                position: editing || editingUntimed ? "relative" : "sticky",
                top: 12,
                zIndex: 4,
                backdropFilter: editing || editingUntimed ? "none" : "blur(10px)",
                ...(editing || editingUntimed
                  ? null
                  : {
                      background: "rgba(255,255,255,.92)",
                      boxShadow: "0 12px 34px rgba(15,23,42,.14)",
                      isolation: "isolate"
                    })
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900 }}>{g.label}</div>
                <div className="chip">{g.events.length} событий</div>
              </div>
            </div>

            {g.events.slice(0, 300).map((ev) => (
              <div key={`${ev.id}-${ev.start}`} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800 }}>{ev.title}</div>
                  <div className="row">
                    <label className="row muted" style={{ gap: 6, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={ev.visible ?? true}
                        onChange={(e) => patchEvent(ev.id, { visible: e.target.checked })}
                      />
                      показывать
                    </label>
                    <div className="chip">{fmtRange(ev)}</div>
                    <button type="button" className="secondary" onClick={() => setEditingId(ev.id)}>
                      Править
                    </button>
                    <button type="button" className="secondary" onClick={() => deleteEvent(ev.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {[
                    shouldShowFormat(ev.format) ? String(ev.format).trim() : null,
                    ev.building ? String(ev.building).trim() : null,
                    ev.room ? String(ev.room).trim() : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {ev.description ? <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>{ev.description}</div> : null}
              </div>
            ))}
          </div>
        ))}
        {events.length > 300 ? <div className="muted">Показаны первые 300 (пока). Остальные появятся после пагинации.</div> : null}
      </div>
    </div>
  );
}

