"use client";

import { applyPrintForExport } from "@/lib/print-timeline-scale";

export function PrintButton() {
  return (
    <button
      type="button"
      className="secondary"
      onClick={() => {
        applyPrintForExport();
        window.print();
      }}
    >
      Печать / PDF
    </button>
  );
}
