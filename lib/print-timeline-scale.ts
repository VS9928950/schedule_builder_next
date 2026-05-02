/** Корневой блок таймлайна в зоне печати (см. PrintWorkspaceClient). */
export const PRINT_TIMELINE_FIT_SEL = ".print-workspace-print-only .print-timeline-fit";

/** Внутренняя обёртка под transform (Firefox и др., где zoom не влияет на раскладку). */
export const PRINT_TIMELINE_SCALE_INNER_SEL = ".print-workspace-print-only .print-timeline-print-scale-inner";

/** @deprecated используйте PRINT_TIMELINE_FIT_SEL / PRINT_TIMELINE_SCALE_INNER_SEL */
export const PRINT_TIMELINE_INNER_SEL = PRINT_TIMELINE_FIT_SEL;

/** Ширина контента A4 при полях ~8mm и листе ~190mm (px при 96dpi). */
function defaultFitWidthPx(): number {
  return Math.floor((186 / 25.4) * 96);
}

let cachedZoomSupport: boolean | null = null;
function zoomPropertyShrinksLayout(): boolean {
  if (typeof document === "undefined") return false;
  if (cachedZoomSupport != null) return cachedZoomSupport;
  const p = document.createElement("div");
  p.style.cssText = "position:absolute;left:-9999px;top:0;width:200px;height:10px;visibility:hidden;";
  (p.style as unknown as { zoom?: string }).zoom = "0.5";
  document.documentElement.appendChild(p);
  const z = getComputedStyle(p).zoom;
  document.documentElement.removeChild(p);
  cachedZoomSupport = z !== "normal" && z !== "1" && z !== "";
  return cachedZoomSupport;
}

function clearInner(inner: HTMLElement) {
  inner.style.removeProperty("transform");
  inner.style.removeProperty("transform-origin");
  inner.style.removeProperty("width");
}

function clearFit(fit: HTMLElement) {
  try {
    fit.style.removeProperty("zoom");
  } catch {
    (fit.style as unknown as { zoom?: string }).zoom = "";
  }
  fit.style.removeProperty("height");
  fit.style.removeProperty("overflow");
}

function clearOne(fit: HTMLElement, inner: HTMLElement | null) {
  if (inner) clearInner(inner);
  clearFit(fit);
}

/**
 * Ужимание всего таймлайна под ширину листа (A4 content), без обрезки по краю.
 * Цель — обёртка `.print-timeline-fit`: в Chromium `zoom`, иначе `transform: scale` + явная высота.
 */
export function applyPrintTimelineScale(maxW?: number) {
  if (typeof document === "undefined") return;

  const fallbackMax = maxW ?? defaultFitWidthPx();
  const inPrint = typeof window !== "undefined" && window.matchMedia?.("(print)")?.matches === true;

  document.querySelectorAll<HTMLElement>(PRINT_TIMELINE_FIT_SEL).forEach((fit) => {
    const inner = fit.querySelector<HTMLElement>(".print-timeline-print-scale-inner");
    clearOne(fit, inner);

    const sheet = fit.closest(".print-a4-sheet") as HTMLElement | null;
    let wPx = fallbackMax;
    if (sheet) {
      const sw = sheet.clientWidth;
      if (sw > 80) wPx = Math.max(200, sw - 16);
      else if (!inPrint) wPx = fallbackMax;
    }

    const measureEl = inner ?? fit;
    const naturalW = measureEl.scrollWidth;
    if (!Number.isFinite(naturalW) || naturalW <= 0 || naturalW <= wPx) return;

    const z = wPx / naturalW;

    if (zoomPropertyShrinksLayout()) {
      (fit.style as unknown as { zoom?: string }).zoom = String(z);
      return;
    }

    if (!inner) {
      (fit.style as unknown as { zoom?: string }).zoom = String(z);
      return;
    }

    const naturalH = inner.scrollHeight;
    fit.style.overflow = "hidden";
    fit.style.height = `${Math.ceil(naturalH * z)}px`;
    inner.style.transformOrigin = "top left";
    inner.style.width = `${naturalW}px`;
    inner.style.transform = `scale(${z})`;
  });
}

export function clearPrintTimelineScale() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>(PRINT_TIMELINE_FIT_SEL).forEach((fit) => {
    const inner = fit.querySelector<HTMLElement>(".print-timeline-print-scale-inner");
    clearOne(fit, inner);
  });
}
