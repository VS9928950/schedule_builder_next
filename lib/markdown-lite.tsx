import React from "react";

function parseInlineNodes(s: string, toNode: (tag: "strong" | "em", inner: string, key: string) => React.ReactNode): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const bothStar = /^\*\*\*(.+?)\*\*\*/.exec(rest);
    if (bothStar) {
      out.push(toNode("strong", `*${bothStar[1]}*`, `bi-${i}`));
      i += bothStar[0].length;
      continue;
    }
    const bothUnd = /^___(.+?)___/.exec(rest);
    if (bothUnd) {
      out.push(toNode("strong", `_${bothUnd[1]}_`, `biu-${i}`));
      i += bothUnd[0].length;
      continue;
    }
    const bold = /^\*\*(.+?)\*\*/.exec(rest);
    if (bold) {
      out.push(toNode("strong", bold[1]!, `b-${i}`));
      i += bold[0].length;
      continue;
    }
    const italicStar = /^\*(.+?)\*/.exec(rest);
    if (italicStar) {
      out.push(toNode("em", italicStar[1]!, `i-${i}`));
      i += italicStar[0].length;
      continue;
    }
    const italicUnd = /^_(.+?)_/.exec(rest);
    if (italicUnd) {
      out.push(toNode("em", italicUnd[1]!, `u-${i}`));
      i += italicUnd[0].length;
      continue;
    }
    const idxs = [rest.indexOf("***"), rest.indexOf("**"), rest.indexOf("*"), rest.indexOf("___"), rest.indexOf("_")].filter(
      (x) => x >= 0
    );
    const next = idxs.length ? Math.min(...idxs) : -1;
    const chunk = next === -1 ? rest : rest.slice(0, next);
    out.push(chunk);
    i += chunk.length;
  }
  return out;
}

export function parseInline(s: string): React.ReactNode[] {
  return parseInlineNodes(s, (tag, inner, key) =>
    tag === "strong" ? <strong key={key}>{parseInline(inner)}</strong> : <em key={key}>{parseInline(inner)}</em>
  );
}

const LIST_ITEM = /^(?:[-•–—]\s*|\*\s+)(.+)$/;

type MdBlock =
  | { type: "list"; items: string[] }
  | { type: "gap"; large: boolean }
  | { type: "h"; text: string; level: number }
  | { type: "p"; text: string };

function parseMarkdownLiteBlocks(md: string): MdBlock[] {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let list: string[] = [];
  let emptyRun = 0;

  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", items: list });
    list = [];
  };
  const flushEmpty = () => {
    if (!emptyRun) return;
    blocks.push({ type: "gap", large: emptyRun >= 2 });
    emptyRun = 0;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const mLi = LIST_ITEM.exec(line.trimStart());
    if (mLi) {
      flushEmpty();
      list.push(mLi[1] ?? "");
      continue;
    }
    flushList();
    if (!line.trim()) {
      emptyRun += 1;
      continue;
    }
    flushEmpty();
    const mH = /^(#{1,3})\s+(.*)$/.exec(line.trimStart());
    if (mH) {
      blocks.push({ type: "h", level: mH[1]!.length, text: (mH[2] ?? "").trim() });
      continue;
    }
    blocks.push({ type: "p", text: line });
  }
  flushList();
  flushEmpty();
  return blocks;
}

export function renderMarkdownLite(md: string): React.ReactNode {
  return (
    <>
      {parseMarkdownLiteBlocks(md).map((b, idx) => {
        if (b.type === "list") {
          return (
            <ul key={`ul-${idx}`} className="eventDescList">
              {b.items.map((t, i) => (
                <li key={`li-${idx}-${i}`}>
                  <span className="eventDescBullet" aria-hidden="true">
                    •
                  </span>
                  <span>{parseInline(t)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "gap") {
          return <div key={`sp-${idx}`} style={{ height: b.large ? 24 : 8 }} />;
        }
        if (b.type === "h") {
          const fs = b.level <= 1 ? 13 : b.level === 2 ? 12 : 11;
          return (
            <div key={`h-${idx}`} style={{ fontWeight: 900, fontSize: fs, marginTop: 6 }}>
              {parseInline(b.text)}
            </div>
          );
        }
        return (
          <div key={`p-${idx}`} style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
            {parseInline(b.text)}
          </div>
        );
      })}
    </>
  );
}

function escHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseInlineHtml(s: string): string {
  let out = "";
  let i = 0;
  const src = String(s ?? "");
  while (i < src.length) {
    const rest = src.slice(i);
    const bothStar = /^\*\*\*(.+?)\*\*\*/.exec(rest);
    if (bothStar) {
      out += `<strong><em>${parseInlineHtml(bothStar[1]!)}</em></strong>`;
      i += bothStar[0].length;
      continue;
    }
    const bothUnd = /^___(.+?)___/.exec(rest);
    if (bothUnd) {
      out += `<strong><em>${parseInlineHtml(bothUnd[1]!)}</em></strong>`;
      i += bothUnd[0].length;
      continue;
    }
    const bold = /^\*\*(.+?)\*\*/.exec(rest);
    if (bold) {
      out += `<strong>${parseInlineHtml(bold[1]!)}</strong>`;
      i += bold[0].length;
      continue;
    }
    const italicStar = /^\*(.+?)\*/.exec(rest);
    if (italicStar) {
      out += `<em>${parseInlineHtml(italicStar[1]!)}</em>`;
      i += italicStar[0].length;
      continue;
    }
    const italicUnd = /^_(.+?)_/.exec(rest);
    if (italicUnd) {
      out += `<em>${parseInlineHtml(italicUnd[1]!)}</em>`;
      i += italicUnd[0].length;
      continue;
    }
    const idxs = [rest.indexOf("***"), rest.indexOf("**"), rest.indexOf("*"), rest.indexOf("___"), rest.indexOf("_")].filter(
      (x) => x >= 0
    );
    const next = idxs.length ? Math.min(...idxs) : -1;
    const chunk = next === -1 ? rest : rest.slice(0, next);
    out += escHtml(chunk);
    i += chunk.length;
  }
  return out;
}

/** Same subset as renderMarkdownLite, for Tilda snippet HTML. */
export function renderMarkdownLiteHtml(md: string): string {
  return parseMarkdownLiteBlocks(md)
    .map((b) => {
      if (b.type === "list") {
        const items = b.items.map((t) => `<li><span class="sb-bullet">•</span><span>${parseInlineHtml(t)}</span></li>`).join("");
        return `<ul class="sb-list">${items}</ul>`;
      }
      if (b.type === "gap") {
        return `<div class="sb-desc-gap${b.large ? " sb-desc-gap--lg" : ""}"></div>`;
      }
      if (b.type === "h") {
        return `<div class="sb-desc" style="font-weight:700">${parseInlineHtml(b.text)}</div>`;
      }
      return `<div class="sb-desc">${parseInlineHtml(b.text)}</div>`;
    })
    .join("");
}

