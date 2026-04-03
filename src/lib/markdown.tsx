import { ReactNode } from "react";

export function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split("\n");
  const result: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let tableRows: string[][] = [];
  let tableHasHeader = false;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`ul-${result.length}`} style={{ margin: "6px 0", paddingLeft: 18, listStyle: "disc" }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows;
    const hasHeader = tableHasHeader;
    result.push(
      <div key={`tbl-${result.length}`} style={{ margin: "8px 0", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          {hasHeader && rows.length > 0 && (
            <thead>
              <tr>
                {rows[0].map((cell, j) => (
                  <th key={j} style={{
                    textAlign: "left",
                    padding: "4px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                  }}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.slice(hasHeader ? 1 : 0).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: "3px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.6)",
                  }}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    tableHasHeader = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      flushTable();
      continue;
    }

    // Table separator row: |---|---|  or  |:--|:--|
    if (/^\|[\s:|-]+\|$/.test(trimmed) || /^[\s:|-]+$/.test(trimmed) && trimmed.includes("|")) {
      // Mark that previous row was a header
      if (tableRows.length === 1) tableHasHeader = true;
      continue;
    }

    // Table data row: | cell | cell |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      tableRows.push(cells);
      continue;
    }

    // Not a table line — flush any pending table
    flushTable();

    // Horizontal rule: --- or *** or ___
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      result.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "10px 0" }} />);
      continue;
    }

    // List items: - or * or numbered
    const listMatch = trimmed.match(/^(?:[-*]|\d+[.)]) (.+)/);
    if (listMatch) {
      listItems.push(<li key={`li-${i}`} style={{ marginBottom: 3 }}>{renderInline(listMatch[1])}</li>);
      continue;
    }

    flushList();

    // Headers
    if (trimmed.startsWith("#### ")) {
      result.push(<div key={i} style={{ fontWeight: 600, fontSize: "0.9em", marginTop: 10, marginBottom: 3, color: "rgba(255,255,255,0.55)" }}>{renderInline(trimmed.slice(5))}</div>);
    } else if (trimmed.startsWith("### ")) {
      result.push(<div key={i} style={{ fontWeight: 600, fontSize: "0.95em", marginTop: 12, marginBottom: 3, color: "rgba(255,255,255,0.65)" }}>{renderInline(trimmed.slice(4))}</div>);
    } else if (trimmed.startsWith("## ")) {
      result.push(<div key={i} style={{ fontWeight: 700, fontSize: "1em", marginTop: 14, marginBottom: 4, color: "rgba(255,255,255,0.75)" }}>{renderInline(trimmed.slice(3))}</div>);
    } else if (trimmed.startsWith("# ")) {
      result.push(<div key={i} style={{ fontWeight: 700, fontSize: "1.1em", marginTop: 16, marginBottom: 4, color: "rgba(255,255,255,0.85)" }}>{renderInline(trimmed.slice(2))}</div>);
    } else {
      result.push(<p key={i} style={{ margin: "3px 0" }}>{renderInline(trimmed)}</p>);
    }
  }
  flushList();
  flushTable();
  return result;
}

export function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[6]) {
      parts.push(<code key={key++} style={{
        fontSize: "0.9em", padding: "1px 4px", borderRadius: 3,
        background: "rgba(255,255,255,0.06)",
      }}>{match[6]}</code>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
