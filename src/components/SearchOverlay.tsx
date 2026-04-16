import { useState, useEffect, useRef, useMemo } from "react";
import { Board, DARK_INK, CARD_LABELS } from "../lib/types";

interface SearchResult {
  card: Board["cards"][string];
  boardId: string;
  boardTitle: string;
  boardColor: string;
  columnTitle: string;
  columnId: string;
}

interface Props {
  boards: Record<string, Board>;
  onClose: () => void;
  onNavigate: (boardId: string) => void;
  onOpenCard: (card: Board["cards"][string], boardId: string) => void;
}

export function SearchOverlay({ boards, onClose, onNavigate, onOpenCard }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Build searchable index once
  const allCards = useMemo(() => {
    const results: SearchResult[] = [];
    for (const b of Object.values(boards)) {
      for (const col of b.columns) {
        for (const cardId of col.cardIds) {
          const card = b.cards[cardId];
          if (!card || card.proposed || card.proposedDelete) continue;
          results.push({
            card,
            boardId: b.id,
            boardTitle: b.title,
            boardColor: b.backgroundColor,
            columnTitle: col.title,
            columnId: col.id,
          });
        }
      }
    }
    return results;
  }, [boards]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    return allCards.filter((r) => {
      const haystack = `${r.card.title} ${r.card.description || ""} ${r.boardTitle}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    }).slice(0, 30);
  }, [query, allCards]);

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0); }, [results.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = (r: SearchResult) => {
    onOpenCard(r.card, r.boardId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
      return;
    }
  };

  const labelColor = (label?: string | null) => {
    if (!label) return undefined;
    return CARD_LABELS.find((l) => l.value === label)?.color;
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 80,
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        width: 480, maxHeight: "70vh",
        background: `linear-gradient(180deg, #1a1f2e 0%, ${DARK_INK} 100%)`,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all cards..."
            data-no-drag
            style={{
              flex: 1, background: "transparent", border: "none",
              fontSize: 15, color: "rgba(255,255,255,0.9)", outline: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>esc</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{
          flex: 1, overflowY: "auto", padding: "6px 0",
        }}>
          {query.trim() && results.length === 0 && (
            <div style={{
              textAlign: "center", padding: "24px 16px",
              color: "rgba(255,255,255,0.2)", fontSize: 13,
            }}>
              No cards found
            </div>
          )}

          {!query.trim() && (
            <div style={{
              textAlign: "center", padding: "24px 16px",
              color: "rgba(255,255,255,0.15)", fontSize: 13,
            }}>
              Type to search across all boards
            </div>
          )}

          {results.map((r, i) => {
            const isSelected = i === selectedIndex;
            const isCompleted = !!r.card.completedAt;
            const lc = labelColor(r.card.label);
            return (
              <div
                key={`${r.boardId}-${r.card.id}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                  transition: "background 0.08s",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                {/* Label dot */}
                {lc && (
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: lc, flexShrink: 0,
                  }} />
                )}

                {/* Card info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    color: isCompleted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)",
                    textDecoration: isCompleted ? "line-through" : "none",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {highlightMatch(r.card.title, query)}
                  </div>
                  {r.card.description && (
                    <div style={{
                      fontSize: 11, color: "rgba(255,255,255,0.25)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      marginTop: 1,
                    }}>
                      {r.card.description.slice(0, 80)}
                    </div>
                  )}
                </div>

                {/* Board + column badge */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 3,
                    background: r.boardColor, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 10, color: "rgba(255,255,255,0.25)",
                    whiteSpace: "nowrap",
                  }}>
                    {r.columnTitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Find the first matching term's position for highlighting
  const lower = text.toLowerCase();
  let bestStart = -1;
  let bestLen = 0;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx >= 0 && (bestStart === -1 || t.length > bestLen)) {
      bestStart = idx;
      bestLen = t.length;
    }
  }
  if (bestStart === -1) return text;
  return (
    <>
      {text.slice(0, bestStart)}
      <span style={{ color: "rgba(224,197,90,0.9)", fontWeight: 600 }}>
        {text.slice(bestStart, bestStart + bestLen)}
      </span>
      {text.slice(bestStart + bestLen)}
    </>
  );
}
