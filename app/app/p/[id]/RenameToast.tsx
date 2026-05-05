"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function RenameToast() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isRenamed = searchParams.get("ok") === "renamed";
    if (!isRenamed) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        zIndex: 9999,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(34,197,94,.45)",
        background: "rgba(34,197,94,.14)",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600
      }}
    >
      Проект переименован
    </div>
  );
}
