import { useState, useEffect, useRef } from "react";
import { Board, Card, DARK_INK, Meta } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { loadMeta, saveMeta } from "../lib/storage";
import { renderMarkdown } from "../lib/markdown";

// ─── Types ──────────────────────────────────────────────────────

interface WizardResponse {
  text: string;
  newCards?: { title: string; columnId: string; description?: string; reasoning?: string }[];
  dayPlan?: {
    columnId: string;
    order: string[];
    timeEstimates?: Record<string, string>;
  };
  highlights?: { cardId: string; reason: string }[];
  remember?: string[]; // memories to save
}

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "wizard"; response: WizardResponse; applied?: boolean }
  | { role: "system"; text: string };

interface Props {
  board: Board;
  meta: Meta | null;
  onClose: () => void;
  updateCard: (card: Card) => void;
  reorderColumn: (columnId: string, cardIds: string[]) => void;
  setTimeEstimates: (estimates: Record<string, string>) => void;
  reloadFromDisk: () => void;
  updateSettings: (settings: Partial<Meta["settings"]>) => void;
}

// ─── Board serializer ───────────────────────────────────────────

function serializeBoard(board: Board): string {
  const lines: string[] = [`Board: ${board.title}`];
  for (const col of board.columns) {
    lines.push(`\n### ${col.title} (columnId: ${col.id})`);
    if (col.cardIds.length === 0) {
      lines.push("(empty)");
    } else {
      for (const cardId of col.cardIds) {
        const card = board.cards[cardId];
        if (!card || card.proposed) continue;
        let line = `- [${cardId}] ${card.title}`;
        if (card.description) line += ` — ${card.description}`;
        if (card.timeEstimate) line += ` (${card.timeEstimate})`;
        if (card.completedAt) line += ` [completed]`;
        lines.push(line);
      }
    }
  }
  return lines.join("\n");
}

function buildTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => {
    if (m.role === "user") return `User: ${m.text}`;
    if (m.role === "wizard") return `Wizard: ${m.response.text}`;
    return `System: ${m.text}`;
  }).join("\n\n");
}

function buildSystemPrompt(memories: string[]): string {
  const memoryBlock = memories.length > 0
    ? `\n\n## Your memories about this user\nThese are things the user asked you to remember. Use them to personalize your suggestions:\n${memories.map((m) => `- ${m}`).join("\n")}`
    : "";

  return `You are a magical, supportive planning wizard inside a todo board app called Lumous. You help users plan their day, prioritize tasks, and feel less overwhelmed.

You ALWAYS respond with a single JSON object. No markdown, no code fences — just raw JSON.

Response schema:
{
  "text": "Your conversational message (supports **bold**, *italic*, lists with - prefix). Keep it concise — use short paragraphs and bullet points for readability.",
  "newCards": [{"title": "...", "columnId": "todo|today|in-progress", "description": "optional", "reasoning": "optional"}],
  "dayPlan": {"columnId": "today", "order": ["existing-card-id", "NEW_0"], "timeEstimates": {"card-id": "30min"}},
  "highlights": [{"cardId": "existing-card-id", "reason": "why relevant"}],
  "remember": ["preference or rule to save for future sessions"]
}

Rules:
- "text" is ALWAYS required — be warm, concise, supportive. Use markdown formatting for readability
- Keep "text" SHORT — 2-4 sentences max for simple responses. Use bullet points for lists, not prose
- Include "newCards" ONLY when the user mentions tasks not already on the board
- Include "dayPlan" when the user asks about planning, priorities, or what to focus on
- "dayPlan.order" must contain ALL card IDs from that column in priority order
- Use "NEW_0", "NEW_1" to reference new cards in dayPlan.order
- "timeEstimates": realistic values like "10min", "15min", "30min", "45min", "1h", "1.5h", "2h"
- Include "highlights" when existing cards relate to what the user mentioned
- Include "remember" when the user says "remember that...", "I always...", "my X usually takes...", or expresses a recurring preference. Save it as a clear, reusable rule
- Keep card titles concise (3-8 words)
- You can ask clarifying questions — just set "text" with your question
- Be encouraging, not overwhelming. If the user seems stressed, suggest a focused subset${memoryBlock}`;
}

// ─── Component ──────────────────────────────────────────────────

export function WizardPanel({ board, meta, onClose, updateCard, reorderColumn, setTimeEstimates, reloadFromDisk, updateSettings }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const memories = meta?.settings.wizardMemories || [];

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const saveMemories = async (newMemories: string[]) => {
    const existing = memories;
    const merged = [...existing, ...newMemories.filter((m) => !existing.includes(m))];
    updateSettings({ wizardMemories: merged });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "20px";
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const boardState = serializeBoard(board);
      const transcript = buildTranscript([...messages, { role: "user", text: userText }]);

      const userPrompt = `## Current Board State\n${boardState}\n\n## Conversation so far\n${transcript}\n\nRespond with a JSON object. No markdown fences.`;

      const result = await invoke<string>("run_claude", {
        systemPrompt: buildSystemPrompt(memories),
        userPrompt,
      });

      let jsonStr = result.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];

      let response: WizardResponse;
      try {
        response = JSON.parse(jsonStr);
      } catch {
        response = { text: result.trim() };
      }

      // Save memories if any
      if (response.remember?.length) {
        await saveMemories(response.remember);
        setMessages((prev) => [...prev,
          { role: "wizard", response },
          { role: "system", text: `Remembered: ${response.remember!.join("; ")}` },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "wizard", response }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "system", text: `Error: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  const hasActions = (msg: ChatMessage): msg is { role: "wizard"; response: WizardResponse; applied?: boolean } => {
    if (msg.role !== "wizard") return false;
    const r = msg.response;
    return !!(r.newCards?.length || r.dayPlan || r.highlights?.length);
  };

  const applyActions = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (msg.role !== "wizard") return;
    const r = msg.response;

    try {
      const idMap: Record<string, string> = {};

      if (r.newCards?.length) {
        const boardData = JSON.parse(await invoke<string>("load_board", { id: board.id }));

        for (let i = 0; i < r.newCards.length; i++) {
          const nc = r.newCards[i];
          const col = boardData.columns.find((c: { id: string }) => c.id === nc.columnId);
          if (!col) continue;

          const realId = crypto.randomUUID();
          idMap[`NEW_${i}`] = realId;

          boardData.cards[realId] = {
            id: realId,
            title: nc.title,
            description: nc.description || "",
            createdAt: new Date().toISOString(),
            completedAt: null,
            proposed: true,
            proposedReasoning: nc.reasoning || "",
          };
          col.cardIds.unshift(realId);
        }

        if (r.highlights?.length) {
          for (const h of r.highlights) {
            if (boardData.cards[h.cardId]) {
              boardData.cards[h.cardId].highlighted = true;
              boardData.cards[h.cardId].highlightReason = h.reason;
            }
          }
        }

        await invoke("save_board", { id: board.id, data: JSON.stringify(boardData, null, 2) });
        reloadFromDisk();
      } else if (r.highlights?.length) {
        const boardData = JSON.parse(await invoke<string>("load_board", { id: board.id }));
        for (const h of r.highlights) {
          if (boardData.cards[h.cardId]) {
            boardData.cards[h.cardId].highlighted = true;
            boardData.cards[h.cardId].highlightReason = h.reason;
          }
        }
        await invoke("save_board", { id: board.id, data: JSON.stringify(boardData, null, 2) });
        reloadFromDisk();
      }

      if (r.dayPlan) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const mappedOrder = r.dayPlan.order.map((id) => idMap[id] || id);
        reorderColumn(r.dayPlan.columnId, mappedOrder);

        if (r.dayPlan.timeEstimates) {
          const mappedEstimates: Record<string, string> = {};
          for (const [id, est] of Object.entries(r.dayPlan.timeEstimates)) {
            mappedEstimates[idMap[id] || id] = est;
          }
          setTimeEstimates(mappedEstimates);
        }
      }

      setMessages((prev) =>
        prev.map((m, i) => i === msgIndex && m.role === "wizard" ? { ...m, applied: true } : m)
      );
    } catch (e) {
      setMessages((prev) => [...prev, { role: "system", text: `Failed to apply: ${e}` }]);
    }
  };

  return (
    <div style={{
      width: 360,
      minWidth: 360,
      height: "100%",
      background: `linear-gradient(180deg, #141822 0%, ${DARK_INK} 100%)`,
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      zIndex: 5,
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>{"🧙"}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", flex: 1 }}>
          Wizard
        </span>
        {memories.length > 0 && (
          <span title={memories.join("\n")} style={{
            fontSize: 10, color: "rgba(255,255,255,0.15)",
            cursor: "help",
          }}>
            {memories.length} memories
          </span>
        )}
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 6,
            border: "none", background: "transparent",
            color: "rgba(255,255,255,0.2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, padding: 0,
          }}
        >
          {"×"}
        </button>
      </div>

      {/* Chat area */}
      <div ref={chatRef} style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 16px 8px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {messages.length === 0 && !loading && (
          <div style={{
            textAlign: "center",
            padding: "40px 12px",
            color: "rgba(255,255,255,0.15)",
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            Tell me what you need to do today.
            <br />
            I'll help you plan and prioritize.
            {memories.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 11, color: "rgba(180,138,192,0.3)" }}>
                I remember {memories.length} thing{memories.length > 1 ? "s" : ""} about your preferences
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} style={{
                alignSelf: "flex-end",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: "14px 14px 4px 14px",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {msg.text}
              </div>
            );
          }

          if (msg.role === "system") {
            return (
              <div key={i} style={{
                textAlign: "center",
                padding: "6px 12px",
                color: msg.text.startsWith("Remembered") ? "rgba(180,138,192,0.5)" : "rgba(220,120,120,0.7)",
                fontSize: 11,
                fontStyle: "italic",
              }}>
                {msg.text}
              </div>
            );
          }

          // Wizard message
          const r = msg.response;
          const showApply = hasActions(msg) && !msg.applied;
          const actionSummary: string[] = [];
          if (r.newCards?.length) actionSummary.push(`${r.newCards.length} card${r.newCards.length > 1 ? "s" : ""}`);
          if (r.dayPlan) actionSummary.push("day plan");
          if (r.highlights?.length) actionSummary.push(`${r.highlights.length} highlight${r.highlights.length > 1 ? "s" : ""}`);

          return (
            <div key={i} style={{
              alignSelf: "flex-start",
              maxWidth: "95%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              {/* Text response with markdown */}
              <div style={{
                padding: "10px 14px",
                borderRadius: "14px 14px 14px 4px",
                background: "rgba(180,138,192,0.06)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 13,
                lineHeight: 1.55,
              }}>
                {renderMarkdown(r.text)}
              </div>

              {/* New cards */}
              {r.newCards && r.newCards.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  {r.newCards.map((nc, j) => (
                    <div key={j} style={{
                      fontSize: 12,
                      color: "rgba(200,170,220,0.7)",
                      padding: "3px 0",
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                    }}>
                      <span style={{ color: "rgba(200,170,220,0.4)" }}>+</span>
                      <span>{nc.title}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{nc.columnId}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Day plan */}
              {r.dayPlan && (
                <div style={{ padding: "0 4px" }}>
                  {r.dayPlan.order.map((id, j) => {
                    const isNew = id.startsWith("NEW_");
                    const newIdx = isNew ? parseInt(id.split("_")[1]) : -1;
                    const title = isNew && r.newCards?.[newIdx]
                      ? r.newCards[newIdx].title
                      : board.cards[id]?.title || id;
                    const est = r.dayPlan!.timeEstimates?.[id];
                    return (
                      <div key={j} style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        padding: "2px 0",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", width: 14, textAlign: "right", flexShrink: 0 }}>{j + 1}.</span>
                        <span style={{ flex: 1 }}>{title}</span>
                        {est && (
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            padding: "0 5px", borderRadius: 4,
                            background: "rgba(180,138,192,0.1)",
                            color: "rgba(200,170,220,0.6)",
                          }}>{est}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Apply button */}
              {showApply && (
                <button
                  onClick={() => applyActions(i)}
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.85)",
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    borderRadius: 7,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {"✦"} Apply {actionSummary.join(" + ")}
                </button>
              )}
              {msg.applied && (
                <span style={{ fontSize: 11, color: "rgba(100,200,100,0.5)", padding: "2px 4px" }}>
                  Applied
                </span>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{
            alignSelf: "flex-start",
            padding: "10px 14px",
            borderRadius: "14px 14px 14px 4px",
            background: "rgba(180,138,192,0.06)",
            color: "rgba(180,138,192,0.4)",
            fontSize: 13,
            fontStyle: "italic",
          }}>
            <span style={{ animation: "wizard-spin 1s linear infinite", display: "inline-block", marginRight: 6 }}>{"✦"}</span>
            Thinking...
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(0,0,0,0.1)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 12,
          padding: "8px 12px",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) { e.preventDefault(); sendMessage(); }
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="What do you need to do?"
            data-no-drag
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              outline: "none",
              resize: "none",
              lineHeight: 1.5,
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              height: 20,
              maxHeight: 120,
              overflow: "auto",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: "none",
              background: loading || !input.trim() ? "transparent" : "rgba(255,255,255,0.08)",
              color: loading || !input.trim() ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)",
              cursor: loading || !input.trim() ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, padding: 0, flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", marginTop: 4, textAlign: "center" }}>
          Enter to send · Fn Fn to dictate
        </div>
      </div>

      <style>{`
        @keyframes wizard-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
