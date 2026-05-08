"use client";

import { useEffect, useMemo, useState } from "react";

type AnnouncementEvent = {
  id: string;
  title?: string;
  description?: string;
  format?: string;
  day?: string;
  start?: string;
  end?: string;
  building?: string;
  room?: string;
};

type AnnouncementTemplate = {
  id: string;
  label: string;
  body: string;
};

const DEFAULT_TEMPLATES: AnnouncementTemplate[] = [
  {
    id: "standard",
    label: "Стандартный",
    body:
      "Анонс мероприятия\n\nНаименование: {title}\nОписание: {description}\nФормат: {format}\nДата: {date}\nВремя начала: {start}\nВремя окончания: {end}\nЗдание: {building}\nАудитория: {room}\n\nПриходите, чтобы узнать больше и принять участие."
  },
  {
    id: "short",
    label: "Короткий",
    body:
      "Анонс мероприятия\n\nНаименование: {title}\nФормат: {format}\nДата: {date}\nВремя: {start}-{end}\nЗдание: {building}\nАудитория: {room}"
  },
  {
    id: "social",
    label: "Для соцсетей/мессенджера",
    body:
      "Друзья, приглашаем на мероприятие \"{title}\"!\n\n{description}\n\nФормат: {format}\nКогда: {date}, {start}-{end}\nГде: {building}, {room}\n\nБудем рады видеть вас на площадке."
  }
];

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function clean(v?: string): string {
  const s = String(v ?? "").trim();
  return s || "—";
}

function buildAnnouncementText(event: AnnouncementEvent, templateBody: string): string {
  const title = clean(event.title);
  const description = clean(event.description);
  const format = clean(event.format);
  const date = formatDate(event.start || event.day);
  const start = formatTime(event.start);
  const end = formatTime(event.end);
  const building = clean(event.building);
  const room = clean(event.room);

  const data: Record<string, string> = {
    title,
    description,
    format,
    date,
    start,
    end,
    building,
    room
  };
  return templateBody.replace(/\{(title|description|format|date|start|end|building|room)\}/g, (_m, key: string) => data[key] ?? "—");
}

function eventOptionLabel(event: AnnouncementEvent): string {
  const date = formatDate(event.start || event.day);
  const start = formatTime(event.start);
  const end = formatTime(event.end);
  const timePart = start === "—" && end === "—" ? "без времени" : `${start}-${end}`;
  const place = [clean(event.building), clean(event.room)].filter((x) => x !== "—").join(", ");
  const format = clean(event.format);
  const parts = [date !== "—" ? date : null, timePart, format !== "—" ? format : null, place || null].filter(Boolean);
  return `${clean(event.title)} · ${parts.join(" · ")}`;
}

function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function AnnouncementsBuilder({ events }: { events: AnnouncementEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>(DEFAULT_TEMPLATES);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0]!.id);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sb-announcement-templates-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as AnnouncementTemplate[];
      if (!Array.isArray(parsed) || !parsed.length) return;
      const valid = parsed.filter((x) => typeof x?.id === "string" && typeof x?.label === "string" && typeof x?.body === "string");
      if (valid.length) setTemplates(valid);
    } catch {
      // no-op: keep defaults
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sb-announcement-templates-v1", JSON.stringify(templates));
    } catch {
      // no-op
    }
  }, [templates]);

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) ?? templates[0] ?? null, [templates, templateId]);

  useEffect(() => {
    if (selectedTemplate) return;
    if (templates.length) setTemplateId(templates[0]!.id);
  }, [templates, selectedTemplate]);

  const textBlock = useMemo(() => {
    if (!selectedEvent) return "";
    if (!selectedTemplate) return "";
    return buildAnnouncementText(selectedEvent, selectedTemplate.body);
  }, [selectedEvent, selectedTemplate]);

  async function copyToClipboard() {
    if (!textBlock) return;
    setCopyError(false);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textBlock);
      } else {
        const ok = fallbackCopy(textBlock);
        if (!ok) throw new Error("copy_failed");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      const ok = fallbackCopy(textBlock);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        return;
      }
      setCopied(false);
      setCopyError(true);
    }
  }

  if (!events.length) {
    return <div className="muted">Нет мероприятий для анонсов.</div>;
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid2">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Мероприятие
          </div>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {eventOptionLabel(e)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Шаблон
          </div>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Текст для копирования
        </div>
        <textarea value={textBlock} readOnly style={{ minHeight: 300 }} />
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button type="button" onClick={copyToClipboard}>
          Скопировать текст
        </button>
        {copied ? <div className="chip">Скопировано</div> : null}
        {copyError ? <div className="error">Не удалось скопировать автоматически. Скопируйте текст вручную из поля выше.</div> : null}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Редактируемые шаблоны</div>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setTemplates((prev) => [
                ...prev,
                {
                  id: `custom-${Date.now()}`,
                  label: `Новый шаблон ${prev.length + 1}`,
                  body: "Наименование: {title}\nДата: {date}\nВремя: {start}-{end}\nЗдание: {building}\nАудитория: {room}"
                }
              ])
            }
          >
            Добавить шаблон
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Доступные переменные: {"{title}"} {"{description}"} {"{format}"} {"{date}"} {"{start}"} {"{end}"} {"{building}"} {"{room}"}
        </div>
        <div className="grid" style={{ gap: 10 }}>
          {templates.map((tpl) => (
            <div key={tpl.id} className="card" style={{ padding: 10 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                <label className="muted" style={{ fontSize: 12, flex: 1 }}>
                  Название
                  <input
                    type="text"
                    value={tpl.label}
                    onChange={(e) =>
                      setTemplates((prev) => prev.map((x) => (x.id === tpl.id ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setTemplates((prev) => {
                      const next = prev.filter((x) => x.id !== tpl.id);
                      if (!next.length) return prev;
                      if (templateId === tpl.id) setTemplateId(next[0]!.id);
                      return next;
                    })
                  }
                  disabled={templates.length <= 1}
                >
                  Удалить
                </button>
              </div>
              <label className="muted" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                Текст шаблона
                <textarea
                  value={tpl.body}
                  onChange={(e) =>
                    setTemplates((prev) => prev.map((x) => (x.id === tpl.id ? { ...x, body: e.target.value } : x)))
                  }
                  style={{ minHeight: 140 }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
