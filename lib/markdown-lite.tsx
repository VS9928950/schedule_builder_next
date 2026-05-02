import React from "react";

function parseInline(s: string): React.ReactNode[] {
  // Very small, safe subset:
  // - **bold**
  // - *italic* or _italic_
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const bold = /^\*\*(.+?)\*\*/.exec(rest);
    if (bold) {
      out.push(<strong key={`b-${i}`}>{bold[1]}</strong>);
      i += bold[0].length;
      continue;
    }
    const italicStar = /^\*(.+?)\*/.exec(rest);
    if (italicStar) {
      out.push(<em key={`i-${i}`}>{italicStar[1]}</em>);
      i += italicStar[0].length;
      continue;
    }
    const italicUnd = /^_(.+?)_/.exec(rest);
    if (italicUnd) {
      out.push(<em key={`u-${i}`}>{italicUnd[1]}</em>);
      i += italicUnd[0].length;
      continue;
    }
    // plain chunk up to next marker
    const next = (() => {
      const idxs = [
        rest.indexOf("**"),
        rest.indexOf("*"),
        rest.indexOf("_")
      ].filter((x) => x >= 0);
      return idxs.length ? Math.min(...idxs) : -1;
    })();
    const chunk = next === -1 ? rest : rest.slice(0, next);
    out.push(chunk);
    i += chunk.length;
  }
  return out;
}

export function renderMarkdownLite(md: string): React.ReactNode {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (keyBase: string) => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`${keyBase}-ul`} style={{ margin: "6px 0 0 18px", padding: 0 }}>
        {items.map((t, idx) => (
          <li key={`${keyBase}-li-${idx}`} style={{ margin: "2px 0" }}>
            {parseInline(t)}
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const mH3 = /^###\s+(.*)$/.exec(line);
    const mH2 = /^##\s+(.*)$/.exec(line);
    const mH1 = /^#\s+(.*)$/.exec(line);
    const mLi = /^[-*]\s+(.*)$/.exec(line);

    if (mLi) {
      list.push(mLi[1] ?? "");
      return;
    }

    flushList(`l-${idx}`);

    if (!line.trim()) {
      blocks.push(<div key={`sp-${idx}`} style={{ height: 6 }} />);
      return;
    }

    if (mH1 || mH2 || mH3) {
      const text = (mH3?.[1] ?? mH2?.[1] ?? mH1?.[1] ?? "").trim();
      const fs = mH1 ? 13 : mH2 ? 12 : 11;
      blocks.push(
        <div key={`h-${idx}`} style={{ fontWeight: 900, fontSize: fs, marginTop: 6 }}>
          {parseInline(text)}
        </div>
      );
      return;
    }

    blocks.push(
      <div key={`p-${idx}`} style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
        {parseInline(line)}
      </div>
    );
  });

  flushList(`l-end`);
  return <>{blocks}</>;
}

