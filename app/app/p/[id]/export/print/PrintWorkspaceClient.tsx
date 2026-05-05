"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyPrintTimelineScale, clearPrintTimelineScale } from "@/lib/print-timeline-scale";
import { formatDayFull, localDateFromDayKey } from "@/lib/schedule";
import { TimelineViewer } from "../../timeline/TimelineViewer";
import { PrintButton } from "./PrintButton";

type IsoEv = Record<string, unknown> & { kind?: string; start?: string; day?: string; visible?: boolean };

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
  const searchParams = useSearchParams();
  const exportView = String(searchParams.get("view") ?? "").trim();
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
        <div style={{ height: 14 }} />
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
      </div>

      <div className="print-workspace-print-only">
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
      </div>
    </>
  );
}
