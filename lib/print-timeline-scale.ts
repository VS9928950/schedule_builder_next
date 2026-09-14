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

const PRINT_ONLY_SEL = ".print-workspace-print-only";
const PRINT_TILDA_SHEET_SEL = ".print-workspace-print-only .print-arch-tilda";
const MIN_PRINT_SCALE = 0.85;
const A4_CONTENT_H_MM = 297 - 16;
const SNAP_ATTR = "data-print-html";

function pageContentHeightPx(sheet: HTMLElement): number {
  const w = sheet.clientWidth;
  const widthPx = w > 80 ? w : Math.floor((190 / 25.4) * 96);
  return Math.max(200, Math.floor(widthPx * (A4_CONTENT_H_MM / 190)));
}

function programGapPx(program: HTMLElement): number {
  const g = getComputedStyle(program).rowGap || getComputedStyle(program).gap;
  const n = Number.parseFloat(g || "");
  return Number.isFinite(n) ? n : 20;
}

function applyFitScale(fit: HTMLElement, inner: HTMLElement | null, z: number) {
  clearOne(fit, inner);
  if (!Number.isFinite(z) || z >= 0.999) return;
  if (zoomPropertyShrinksLayout()) {
    (fit.style as unknown as { zoom?: string }).zoom = String(z);
    return;
  }
  if (!inner) {
    (fit.style as unknown as { zoom?: string }).zoom = String(z);
    return;
  }
  const naturalH = inner.scrollHeight;
  const naturalW = inner.scrollWidth;
  fit.style.overflow = "hidden";
  fit.style.height = `${Math.ceil(naturalH * z)}px`;
  inner.style.transformOrigin = "top left";
  inner.style.width = `${naturalW}px`;
  inner.style.transform = `scale(${z})`;
}

function keepSlots(sheet: HTMLElement, keep: Set<number>) {
  const program = sheet.querySelector(".sb-program");
  if (!program) return;
  const slots = Array.from(program.querySelectorAll<HTMLElement>(":scope > .sb-slot"));
  slots.forEach((el, i) => {
    if (!keep.has(i)) el.remove();
  });
}

function groupSlotPages(heights: number[], gap: number, usable: number): { indices: number[]; scale: number }[] {
  const n = heights.length;
  if (!n) return [];
  const all = Array.from({ length: n }, (_, i) => i);
  const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
  if (total <= usable) return [{ indices: all, scale: 1 }];
  const z = usable / total;
  if (z >= MIN_PRINT_SCALE) return [{ indices: all, scale: z }];

  const groups: number[][] = [];
  let cur: number[] = [];
  let curH = 0;
  for (let i = 0; i < n; i++) {
    const h = Math.max(0, heights[i] ?? 0);
    const next = cur.length ? curH + gap + h : h;
    if (cur.length && next > usable) {
      groups.push(cur);
      cur = [i];
      curH = h;
    } else {
      cur.push(i);
      curH = next;
    }
  }
  if (cur.length) groups.push(cur);
  return groups.map((indices) => ({ indices, scale: 1 }));
}

function paginateTildaSheet(sheet: HTMLElement) {
  const program = sheet.querySelector<HTMLElement>(".sb-program");
  const fit = sheet.querySelector<HTMLElement>(".print-tilda-fit");
  const inner = fit?.querySelector<HTMLElement>(".print-timeline-print-scale-inner") ?? null;
  if (!program || !fit) return;

  const title = sheet.querySelector<HTMLElement>(".print-tilda-day");
  const titleH = title ? title.offsetHeight + 16 : 0;
  const usable = Math.max(120, pageContentHeightPx(sheet) - titleH);
  const slots = Array.from(program.querySelectorAll<HTMLElement>(":scope > .sb-slot"));
  const gap = programGapPx(program);
  const heights = slots.map((el) => el.offsetHeight);
  const pages = groupSlotPages(heights, gap, usable);
  if (!pages.length) return;

  const parent = sheet.parentElement;
  if (!parent) return;
  const template = sheet.cloneNode(true) as HTMLElement;

  const first = pages[0]!;
  keepSlots(sheet, new Set(first.indices));
  if (pages.length > 1) sheet.classList.add("print-page-break-after");
  applyFitScale(fit, inner, first.scale);
  if (first.indices.length === 1 && (heights[first.indices[0]!] ?? 0) > usable) {
    const only = sheet.querySelector<HTMLElement>(".sb-slot");
    if (only) {
      only.style.breakInside = "auto";
      only.style.pageBreakInside = "auto";
    }
  }

  let last = sheet;
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i]!;
    const clone = template.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-print-day");
    clone.setAttribute("data-print-clone", "1");
    keepSlots(clone, new Set(page.indices));
    const cloneFit = clone.querySelector<HTMLElement>(".print-tilda-fit");
    const cloneInner = cloneFit?.querySelector<HTMLElement>(".print-timeline-print-scale-inner") ?? null;
    if (cloneFit) applyFitScale(cloneFit, cloneInner, page.scale);
    if (i < pages.length - 1) clone.classList.add("print-page-break-after");
    else clone.classList.remove("print-page-break-after");
    if (page.indices.length === 1 && (heights[page.indices[0]!] ?? 0) > usable) {
      const only = clone.querySelector<HTMLElement>(".sb-slot");
      if (only) {
        only.style.breakInside = "auto";
        only.style.pageBreakInside = "auto";
      }
    }
    parent.insertBefore(clone, last.nextSibling);
    last = clone;
  }
}

export function applyPrintTildaLayout() {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>(PRINT_ONLY_SEL);
  if (!root?.querySelector(".print-arch-tilda")) return;

  const snap = root.getAttribute(SNAP_ATTR);
  if (snap != null) root.innerHTML = snap;
  else root.setAttribute(SNAP_ATTR, root.innerHTML);

  const origins = Array.from(document.querySelectorAll<HTMLElement>(PRINT_TILDA_SHEET_SEL)).filter(
    (el) => !el.hasAttribute("data-print-clone")
  );
  for (const sheet of origins) paginateTildaSheet(sheet);

  const allSheets = Array.from(document.querySelectorAll<HTMLElement>(PRINT_TILDA_SHEET_SEL));
  allSheets.forEach((el, i) => {
    if (i < allSheets.length - 1) el.classList.add("print-page-break-after");
    else el.classList.remove("print-page-break-after");
  });
}

export function clearPrintTildaLayout() {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>(PRINT_ONLY_SEL);
  if (!root) return;
  const snap = root.getAttribute(SNAP_ATTR);
  if (snap == null) return;
  root.innerHTML = snap;
  root.removeAttribute(SNAP_ATTR);
}

export function applyPrintForExport() {
  applyPrintTildaLayout();
  applyPrintTimelineScale();
}

export function clearPrintForExport() {
  clearPrintTildaLayout();
  clearPrintTimelineScale();
}
