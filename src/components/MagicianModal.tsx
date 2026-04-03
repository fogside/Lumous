import { useState, useEffect, useRef } from "react";
import { Board, DARK_INK, BoardTheme, getBoardTheme } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  board: Board;
  theme: BoardTheme;
  onClose: () => void;
  onApplied: () => void; // triggers immediate board reload after writing to disk
}

// Serialize board state compactly for the AI prompt
function serializeBoard(board: Board): string {
  const lines: string[] = [`Board: ${board.title}`];
  for (const col of board.columns) {
    lines.push(`\n### ${col.title} (id: ${col.id})`);
    if (col.cardIds.length === 0) {
      lines.push("(empty)");
    } else {
      for (const cardId of col.cardIds) {
        const card = board.cards[cardId];
        if (!card || card.proposed) continue;
        const parts = [`- ${card.title}`];
        if (card.description) parts.push(` — ${card.description}`);
        lines.push(parts.join(""));
      }
    }
  }
  return lines.join("\n");
}

interface Suggestion {
  title: string;
  columnId: string;
  description?: string;
  reasoning: string;
}

interface MagicianResponse {
  suggestions: Suggestion[];
  existingCardHighlights?: { cardTitle: string; reason: string }[];
}

async function runMagician(board: Board, userInput: string): Promise<MagicianResponse> {
  const boardContext = serializeBoard(board);

  const systemPrompt = `You are a magical task planning wizard for a todo board app. Given the user's current board and their message, suggest new cards to add.

Rules:
- Suggest 1-5 concise, actionable cards
- Place each in the best column: todo, today, in-progress
- If existing cards already cover what the user mentions, note them in existingCardHighlights
- Keep titles short (3-8 words)
- Add descriptions only when helpful
- Respond ONLY with valid JSON matching the schema`;

  const userPrompt = `## Current Board State
${boardContext}

## User's thoughts:
${userInput}

Respond with JSON: {"suggestions": [{"title": "...", "columnId": "todo|today|in-progress", "description": "optional", "reasoning": "why this card"}], "existingCardHighlights": [{"cardTitle": "existing card name", "reason": "why it's relevant"}]}`;

  try {
    const result = await invoke<string>("run_claude", {
      systemPrompt,
      userPrompt,
    });

    // Parse JSON from response (might be wrapped in markdown code blocks)
    let jsonStr = result.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    return JSON.parse(jsonStr) as MagicianResponse;
  } catch (e) {
    throw new Error(`Wizard failed: ${e}`);
  }
}

const COLUMN_LABELS: Record<string, string> = {
  "todo": "Todo",
  "today": "Today",
  "in-progress": "In Progress",
};

export function MagicianModal({ board, theme, onClose, onApplied }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MagicianResponse | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await runMagician(board, input.trim());
      setResult(resp);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;

    try {
      const boardData = JSON.parse(await invoke<string>("load_board", { id: board.id }));

      for (const s of result.suggestions) {
        const col = boardData.columns.find((c: { id: string }) => c.id === s.columnId);
        if (!col) continue;
        const card = {
          id: crypto.randomUUID(),
          title: s.title,
          description: s.description || "",
          createdAt: new Date().toISOString(),
          completedAt: null,
          proposed: true,
          proposedReasoning: s.reasoning,
        };
        boardData.cards[card.id] = card;
        col.cardIds.unshift(card.id);
      }

      if (result.existingCardHighlights) {
        for (const h of result.existingCardHighlights) {
          const match = Object.values(boardData.cards as Record<string, { title: string; highlighted?: boolean; highlightReason?: string }>).find(
            (c) => c.title.toLowerCase().includes(h.cardTitle.toLowerCase()) ||
                   h.cardTitle.toLowerCase().includes(c.title.toLowerCase())
          );
          if (match) {
            match.highlighted = true;
            match.highlightReason = h.reason;
          }
        }
      }

      await invoke("save_board", {
        id: board.id,
        data: JSON.stringify(boardData, null, 2),
      });

      onApplied(); // trigger immediate board reload
      onClose();
    } catch (e) {
      setError(`Failed to apply: ${e}`);
    }
  };

  const hasInput = input.trim().length > 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: `linear-gradient(180deg, #141822 0%, ${DARK_INK} 100%)`,
          borderRadius: 18,
          width: 580,
          maxWidth: "92vw",
          maxHeight: "75vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5), 0 0 100px rgba(140,100,180,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with wizard */}
        <div style={{
          padding: "22px 26px 0 26px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 24 }}>{"🧙"}</span>
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "-0.01em",
          }}>
            Ask the Wizard
          </span>
        </div>

        {/* Input area */}
        <div style={{ padding: "0 26px" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) handleSubmit();
            }}
            placeholder="What do you need to do?"
            data-no-drag
            rows={4}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: 16,
              color: "rgba(255,255,255,0.9)",
              outline: "none",
              resize: "none",
              lineHeight: 1.65,
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
            }}
          />
        </div>

        {/* Divider + hint row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 26px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.16)", fontWeight: 400 }}>
            {loading ? "The wizard is thinking..." : "Fn Fn to dictate"}
          </span>
          <button
            onClick={handleSubmit}
            disabled={loading || !hasInput}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 600,
              color: loading || !hasInput ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.85)",
              background: loading || !hasInput ? "transparent" : "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 7,
              cursor: loading || !hasInput ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ animation: "wizard-spin 1s linear infinite", display: "inline-block" }}>{"✦"}</span>
                Summoning
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {"✦"} Summon
                <kbd style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.22)",
                  fontFamily: "-apple-system",
                  fontWeight: 500,
                }}>{"⌘↵"}</kbd>
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 26px",
            background: "rgba(220,80,80,0.06)",
            color: "rgba(220,120,120,0.8)",
            fontSize: 13,
            lineHeight: 1.5,
            borderTop: "1px solid rgba(220,80,80,0.08)",
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.04)",
            overflowY: "auto",
            flex: 1,
          }}>
            {/* Section header */}
            <div style={{
              padding: "14px 26px 6px 26px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.22)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              {"🧙"} Wizard suggests
            </div>

            {result.suggestions.map((s, i) => (
              <div key={i} style={{
                padding: "14px 26px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{
                    fontSize: 15,
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 500,
                    flex: 1,
                    lineHeight: 1.4,
                  }}>
                    {s.title}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.22)",
                    fontWeight: 500,
                    flexShrink: 0,
                  }}>
                    {COLUMN_LABELS[s.columnId] || s.columnId}
                  </span>
                </div>
                {s.description && (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "5px 0 0 0", lineHeight: 1.45 }}>
                    {s.description}
                  </p>
                )}
                <p style={{ fontSize: 12, color: "rgba(180,160,210,0.5)", margin: "5px 0 0 0", lineHeight: 1.4 }}>
                  {s.reasoning}
                </p>
              </div>
            ))}

            {result.existingCardHighlights && result.existingCardHighlights.length > 0 && (
              <div style={{ padding: "12px 26px 8px 26px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Already on your board
                </div>
                {result.existingCardHighlights.map((h, i) => (
                  <p key={i} style={{
                    fontSize: 13,
                    color: "rgba(224,200,120,0.6)",
                    margin: "0 0 5px 0",
                    lineHeight: 1.45,
                  }}>
                    {h.cardTitle} <span style={{ color: "rgba(255,255,255,0.12)" }}>—</span> {h.reason}
                  </p>
                ))}
              </div>
            )}

            {/* Apply bar */}
            <div style={{
              padding: "14px 26px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0,0,0,0.15)",
            }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
                {result.suggestions.length} card{result.suggestions.length !== 1 ? "s" : ""} suggested
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.35)",
                    background: "transparent",
                    border: "none",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
                <button
                  onClick={handleApply}
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    background: "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 7,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {"🧙"} Add to board
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes wizard-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
