"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      className="chip"
      href={href}
      style={{
        color: active ? "var(--text)" : "var(--muted)",
        borderColor: active ? "rgba(96,165,250,.55)" : "var(--line)",
        background: active ? "rgba(96,165,250,.14)" : "transparent"
      }}
    >
      {label}
    </Link>
  );
}

export function ProjectTabs({ projectId }: { projectId: number }) {
  const path = usePathname() || "";
  const base = `/app/p/${projectId}`;
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <Tab href={`${base}/excel`} label="Документы" active={path.includes("/excel")} />
      <Tab href={`${base}/events`} label="События" active={path.includes("/events")} />
      <Tab href={`${base}/timeline`} label="Архитектура" active={path.includes("/timeline")} />
      <Tab href={`${base}/tech-schedule`} label="Техрасписание" active={path.includes("/tech-schedule")} />
      <Tab href={`${base}/rooms`} label="Аудитории" active={path.includes("/rooms")} />
      <Tab href={`${base}/export`} label="Экспорт" active={path.includes("/export")} />
    </div>
  );
}
