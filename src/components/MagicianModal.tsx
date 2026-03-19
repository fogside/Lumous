import { useState, useEffect, useRef } from "react";
import { Board, DARK_INK, BoardTheme, getBoardTheme } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  board: Board;
  theme: BoardTheme;
  onClose: () => void;
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
    // Also try to find raw JSON object
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    return JSON.parse(jsonStr) as MagicianResponse;
  } catch (e) {
    throw new Error(`Wizard failed: ${e}`);
  }
}

export function MagicianModal({ board, theme, onClose }: Props) {
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

    // Write proposed cards via MCP server (call the same file I/O)
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

      // Highlight existing cards
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

      onClose();
    } catch (e) {
      setError(`Failed to apply: ${e}`);
    }
  };

  const boardTheme = getBoardTheme(board.backgroundColor);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: DARK_INK,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          width: 560,
          maxWidth: "90vw",
          padding: "36px 40px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>{"🧙"}</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.95)", margin: 0 }}>
            Ask the Wizard
          </h2>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, marginBottom: 24 }}>
          Describe what you need to do — the wizard will suggest cards for your board.
        </p>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) handleSubmit();
          }}
          placeholder="e.g. I need to prepare for the team meeting, write tests for the auth module, and plan my weekend trip..."
          data-no-drag
          style={{
            width: "100%",
            minHeight: 100,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 14,
            color: "white",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.6,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          }}
        />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6, marginBottom: 20 }}>
          Tip: Press Fn Fn to dictate · Cmd+Enter to summon
        </p>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(220,80,80,0.1)",
            border: "1px solid rgba(220,80,80,0.2)",
            color: "rgba(220,80,80,0.8)",
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            padding: "16px 0",
            textAlign: "center",
            color: "rgba(180,138,192,0.7)",
            fontSize: 13,
            fontStyle: "italic",
          }}>
            The wizard is thinking...
          </div>
        )}

        {/* Results preview */}
        {result && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Suggestions
            </div>
            {result.suggestions.map((s, i) => (
              <div key={i} style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(180,138,192,0.06)",
                border: "1px dashed rgba(180,138,192,0.2)",
                marginBottom: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 500, flex: 1 }}>
                    {s.title}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}>
                    {s.columnId}
                  </span>
                </div>
                {s.description && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, margin: "4px 0 0 0" }}>
                    {s.description}
                  </p>
                )}
                <p style={{ fontSize: 12, color: "rgba(200,170,220,0.7)", fontStyle: "italic", margin: "4px 0 0 0" }}>
                  {s.reasoning}
                </p>
              </div>
            ))}

            {result.existingCardHighlights && result.existingCardHighlights.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 14, marginBottom: 8 }}>
                  Related existing cards
                </div>
                {result.existingCardHighlights.map((h, i) => (
                  <div key={i} style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(224,197,90,0.06)",
                    border: "1px solid rgba(224,197,90,0.15)",
                    marginBottom: 4,
                    fontSize: 13,
                    color: "rgba(230,210,120,0.8)",
                  }}>
                    <strong>{h.cardTitle}</strong> — {h.reason}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.5)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          {result ? (
            <button
              onClick={handleApply}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                background: "rgba(180,138,192,0.2)",
                border: "1px solid rgba(180,138,192,0.3)",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Apply to board
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 600,
                color: loading || !input.trim() ? "rgba(255,255,255,0.3)" : "white",
                background: loading || !input.trim() ? "rgba(255,255,255,0.05)" : "rgba(180,138,192,0.2)",
                border: "1px solid rgba(180,138,192,0.2)",
                borderRadius: 12,
                cursor: loading || !input.trim() ? "default" : "pointer",
              }}
            >
              Summon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
