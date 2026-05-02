"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDayFull, localDateFromDayKey } from "@/lib/schedule";

export function TildaSnippetClient({
  projectId,
  visibleDayKeys
}: {
  projectId: number;
  visibleDayKeys: string[];
}) {
  const [data, setData] = useState<{ html: string; css: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<string>(""); // optional; can be left empty
  const [day, setDay] = useState<string>(""); // YYYY-MM-DD or empty for all
  const [tildaSansProbe, setTildaSansProbe] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("projectId", String(projectId));
    if (scope.trim()) params.set("scope", scope.trim());
    if (day.trim()) params.set("day", day.trim());
    if (tildaSansProbe) params.set("font", "tildaSans");
    fetch(`/api/export/tilda/data?${params.toString()}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          const apiError =
            j && typeof j === "object" && "error" in j && typeof j.error === "string" ? j.error : null;
          throw new Error(apiError || `HTTP ${r.status}`);
        }
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        setData({ html: String(j.html ?? ""), css: String(j.css ?? "") });
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Ошибка");
        setData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, scope, day, tildaSansProbe]);

  useEffect(() => {
    if (day && !visibleDayKeys.includes(day)) setDay("");
  }, [visibleDayKeys, day]);

  const fullHtml = useMemo(() => {
    if (!data) return "";
    // Tilda T123: must start with <style> and end with </style> for the CSS part.
    // Then HTML goes below.
    return `<style>\n${data.css}\n</style>\n\n${data.html}`;
  }, [data]);

  async function copy(text: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyStatus("Скопировано");
      return;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "true");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
        setCopyStatus("Скопировано");
        return;
      } catch {
        setCopyStatus("Не удалось скопировать автоматически. Скопируйте текст вручную из поля ниже.");
      }
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 800 }}>Подсказка</div>
          <a
            className="chip"
            href={(() => {
              const p = new URLSearchParams();
              p.set("projectId", String(projectId));
              if (scope.trim()) p.set("scope", scope.trim());
              if (day.trim()) p.set("day", day.trim());
              if (tildaSansProbe) p.set("font", "tildaSans");
              return `/api/export/tilda/snippet?${p.toString()}`;
            })()}
            target="_blank"
            rel="noreferrer"
          >
            Открыть сырой сниппет (text/plain)
          </a>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Ссылка открывает <b>только текст сниппета</b> (сначала <code>&lt;style&gt;</code>, затем HTML) — удобно копировать в
          блок T123 на Тильде.
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <label className="row muted" style={{ gap: 10, fontSize: 13, alignItems: "center" }}>
          <input type="checkbox" checked={tildaSansProbe} onChange={(e) => setTildaSansProbe(e.target.checked)} />
          Режим проверки: принудительно <b>Tilda Sans</b> (по умолчанию шрифт не задаётся — наследуется со страницы Тильды)
        </label>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Вариант экспорта</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Код для <b>всех дней</b> сразу или для <b>одного дня</b> из программы (скрытые в раскладке дни не показаны).
        </div>
        <div style={{ height: 8 }} />
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Вариант экспорта по дням"
          style={{
            minWidth: 280,
            maxWidth: "100%",
            font: "inherit",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--card)",
            color: "var(--text)"
          }}
        >
          <option value="">Все дни</option>
          {visibleDayKeys.map((dk) => {
            const d = localDateFromDayKey(dk);
            const label = Number.isFinite(d.getTime()) ? formatDayFull(d) : dk;
            return (
              <option key={dk} value={dk}>
                {label}
              </option>
            );
          })}
        </select>
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Опционально: ограничить CSS</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Если хотите, можно указать селектор-обёртку (например <code>#rec123456</code>), чтобы CSS не влиял на другие блоки.
          Можно оставить пустым.
        </div>
        <div style={{ height: 8 }} />
        <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="(пусто) или #rec123456" style={{ width: 260 }} />
      </div>
      {copyStatus ? <div className="muted" style={{ fontSize: 12 }}>{copyStatus}</div> : null}
      {loading ? <div className="muted">Генерация…</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {data ? (
        <>
          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>HTML (для вставки в Тильду)</div>
              <button type="button" className="secondary" onClick={() => copy(data.html)}>
                Скопировать HTML
              </button>
            </div>
            <div style={{ height: 8 }} />
            <textarea value={data.html} readOnly style={{ width: "100%", minHeight: 240, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }} />
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>CSS</div>
              <button type="button" className="secondary" onClick={() => copy(data.css)}>
                Скопировать CSS
              </button>
            </div>
            <div style={{ height: 8 }} />
            <textarea value={data.css} readOnly style={{ width: "100%", minHeight: 240, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }} />
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>Вариант одним блоком (HTML + &lt;style&gt;)</div>
              <button type="button" className="secondary" onClick={() => copy(fullHtml)}>
                Скопировать всё
              </button>
            </div>
            <div style={{ height: 8 }} />
            <textarea value={fullHtml} readOnly style={{ width: "100%", minHeight: 240, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }} />
          </div>
        </>
      ) : null}
    </div>
  );
}

