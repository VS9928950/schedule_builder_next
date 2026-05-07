"use client";

import { useMemo, useState } from "react";

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

type TemplateId = "standard" | "short" | "social";

const TEMPLATE_OPTIONS: Array<{ id: TemplateId; label: string }> = [
  { id: "standard", label: "Стандартный" },
  { id: "short", label: "Короткий" },
  { id: "social", label: "Для соцсетей/мессенджера" }
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

function buildAnnouncementText(event: AnnouncementEvent, templateId: TemplateId): string {
  const title = clean(event.title);
  const description = clean(event.description);
  const format = clean(event.format);
  const date = formatDate(event.start || event.day);
  const start = formatTime(event.start);
  const end = formatTime(event.end);
  const building = clean(event.building);
  const room = clean(event.room);

  const fieldsBlock = [
    `Наименование: ${title}`,
    `Описание: ${description}`,
    `Формат: ${format}`,
    `Дата: ${date}`,
    `Время начала: ${start}`,
    `Время окончания: ${end}`,
    `Здание: ${building}`,
    `Аудитория: ${room}`
  ].join("\n");

  if (templateId === "short") {
    return `Анонс мероприятия\n\n${fieldsBlock}`;
  }

  if (templateId === "social") {
    return [
      `Друзья, приглашаем на мероприятие "${title}"!`,
      "",
      fieldsBlock,
      "",
      "Будем рады видеть вас на площадке."
    ].join("\n");
  }

  return [
    "Анонс мероприятия",
    "",
    fieldsBlock,
    "",
    "Приходите, чтобы узнать больше и принять участие."
  ].join("\n");
}

export function AnnouncementsBuilder({ events }: { events: AnnouncementEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<TemplateId>("standard");
  const [copied, setCopied] = useState(false);

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  const textBlock = useMemo(() => {
    if (!selectedEvent) return "";
    return buildAnnouncementText(selectedEvent, templateId);
  }, [selectedEvent, templateId]);

  async function copyToClipboard() {
    if (!textBlock) return;
    try {
      await navigator.clipboard.writeText(textBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
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
                {clean(e.title)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Шаблон
          </div>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value as TemplateId)}>
            {TEMPLATE_OPTIONS.map((t) => (
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
      </div>
    </div>
  );
}
