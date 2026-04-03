import { useState, useEffect, useRef } from "react";
import { Board, Card, CARD_LABELS, DARK_INK, Meta } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { loadMeta, saveMeta } from "../lib/storage";
import { renderMarkdown } from "../lib/markdown";

const PANEL_WIDTH = 360;

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
  research?: { cardId: string; context: string }[];
  labels?: { cardId: string; label: string }[];
  rituals?: { cardId: string; schedule: "daily" | number[] | null }[];
  moveCards?: { cardId: string; toColumn: string }[];
  remember?: string[];
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
  startResearch: (card: Card, context: string) => void;
  moveCard: (cardId: string, fromCol: string, toCol: string, toIndex: number) => void;
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
  "text": "Your conversational message (supports **bold**, *italic*, lists with - prefix). Keep it concise.",
  "newCards": [{"title": "...", "columnId": "todo|today|in-progress", "description": "optional", "reasoning": "optional"}],
  "dayPlan": {"columnId": "today", "order": ["existing-card-id", "NEW_0"], "timeEstimates": {"card-id": "30min"}},
  "highlights": [{"cardId": "existing-card-id", "reason": "why relevant"}],
  "research": [{"cardId": "existing-card-id", "context": "what to research about this card"}],
  "labels": [{"cardId": "existing-card-id", "label": "ember|honey|sage|slate|plum|rose|copper|ultramarine"}],
  "rituals": [{"cardId": "existing-card-id", "schedule": "daily or [0,1,2,3,4,5] (0=Sun..6=Sat) or null to remove"}],
  "moveCards": [{"cardId": "existing-card-id", "toColumn": "todo|today|in-progress|completed"}],
  "remember": ["preference or rule to save for future sessions"]
}

Rules:
- "text" is ALWAYS required — be warm, concise, supportive. Use markdown formatting for readability
- Keep "text" SHORT — 2-4 sentences max for simple responses. Use bullet points for lists, not prose
- NEVER create new cards for tasks that already exist in Todo, Today, or In Progress columns — instead use "highlights" to point them out, or "moveCards" to reprioritize them. Only create new cards for genuinely new tasks not on the board
- Include "dayPlan" when the user asks about planning, priorities, or what to focus on
- "dayPlan.order" must contain ALL card IDs from that column in priority order
- Use "NEW_0", "NEW_1" to reference new cards in dayPlan.order
- "timeEstimates": realistic values like "10min", "15min", "30min", "45min", "1h", "1.5h", "2h"
- Include "highlights" when existing cards relate to what the user mentioned
- Include "research" when the user asks to research a specific card or topic that matches an existing card. This triggers a deep background research job on that card — the results will appear in the card's description. Use the card's ID and provide a clear research context
- Include "labels" to assign color labels to cards. Available labels: ember (red-orange), honey (yellow), sage (green), slate (blue), plum (purple), rose (pink), copper (warm brown), ultramarine (deep purple). Use null to remove a label. Apply labels when the user asks to categorize, color-code, or tag cards
- Include "moveCards" to move cards between columns. Use when the user says they completed a task, started working on something, or wants to reprioritize. Columns: "todo", "today", "in-progress", "completed". Moving to "completed" marks the task as done
- Include "rituals" to make cards recurring. Use "daily" for every day, a number array for specific days (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat), e.g. [1,2,3,4,5] for weekdays. Use null to remove a recurring schedule. When completed, ritual cards automatically respawn in the Today column on their next scheduled day
- Include "remember" when the user says "remember that...", "I always...", "my X usually takes...", or expresses a recurring preference
- Keep card titles concise (3-8 words)
- You can ask clarifying questions — just set "text" with your question
- Be encouraging, not overwhelming. If the user seems stressed, suggest a focused subset${memoryBlock}`;
}

// ─── Component ──────────────────────────────────────────────────

export function WizardPanel({ board, meta, onClose, updateCard, reorderColumn, setTimeEstimates, reloadFromDisk, updateSettings, startResearch, moveCard }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const memories = meta?.settings.wizardMemories || [];
  const [showMemories, setShowMemories] = useState(false);

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
    // Read fresh from meta to avoid stale closure when multiple remember responses arrive
    try {
      const freshMeta = await loadMeta();
      const existing = freshMeta.settings.wizardMemories || [];
      const merged = [...existing, ...newMemories.filter((m) => !existing.includes(m))];
      updateSettings({ wizardMemories: merged });
    } catch {
      // Fallback to prop-based memories
      const merged = [...memories, ...newMemories.filter((m) => !memories.includes(m))];
      updateSettings({ wizardMemories: merged });
    }
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
    return !!(r.newCards?.length || r.dayPlan || r.highlights?.length || r.research?.length || r.labels?.length || r.rituals?.length || r.moveCards?.length);
  };

  const applyActions = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (msg.role !== "wizard") return;
    const r = msg.response;

    try {
      // Apply ALL actions atomically via one disk write + one reload
      // This prevents polling from wiping in-flight reducer changes
      const boardData = JSON.parse(await invoke<string>("load_board", { id: board.id }));
      const idMap: Record<string, string> = {};

      // Step 1: Create new cards
      if (r.newCards?.length) {
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
      }

      // Step 2: Highlights
      if (r.highlights?.length) {
        for (const h of r.highlights) {
          if (boardData.cards[h.cardId]) {
            boardData.cards[h.cardId].highlighted = true;
            boardData.cards[h.cardId].highlightReason = h.reason;
          }
        }
      }

      // Step 3: Day plan (reorder + time estimates)
      if (r.dayPlan) {
        const col = boardData.columns.find((c: { id: string }) => c.id === r.dayPlan!.columnId);
        if (col) {
          const mappedOrder = r.dayPlan.order.map((id: string) => idMap[id] || id);
          const validIds = mappedOrder.filter((id: string) => boardData.cards[id]);
          const remaining = col.cardIds.filter((id: string) => !validIds.includes(id));
          col.cardIds = [...validIds, ...remaining];
        }
        if (r.dayPlan.timeEstimates) {
          for (const [id, est] of Object.entries(r.dayPlan.timeEstimates)) {
            const realId = idMap[id] || id;
            if (boardData.cards[realId]) {
              boardData.cards[realId].timeEstimate = est;
            }
          }
        }
      }

      // Step 4: Labels
      if (r.labels?.length) {
        for (const lbl of r.labels) {
          if (boardData.cards[lbl.cardId]) {
            const labelValue = lbl.label === "null" || !lbl.label ? null : lbl.label;
            boardData.cards[lbl.cardId].label = labelValue;
          }
        }
      }

      // Step 5: Rituals
      if (r.rituals?.length) {
        for (const rit of r.rituals) {
          if (boardData.cards[rit.cardId]) {
            boardData.cards[rit.cardId].ritual = rit.schedule ? { schedule: rit.schedule } : undefined;
          }
        }
      }

      // Step 6: Move cards between columns
      if (r.moveCards?.length) {
        for (const mv of r.moveCards) {
          const fromCol = boardData.columns.find((c: { id: string; cardIds: string[] }) => c.cardIds.includes(mv.cardId));
          const toCol = boardData.columns.find((c: { id: string }) => c.id === mv.toColumn);
          if (fromCol && toCol && fromCol.id !== toCol.id) {
            fromCol.cardIds = fromCol.cardIds.filter((id: string) => id !== mv.cardId);
            toCol.cardIds.unshift(mv.cardId);
            // Set completedAt when moving to completed
            if (mv.toColumn === "completed" && boardData.cards[mv.cardId]) {
              boardData.cards[mv.cardId].completedAt = new Date().toISOString();
            } else if (fromCol.id === "completed" && boardData.cards[mv.cardId]) {
              boardData.cards[mv.cardId].completedAt = null;
            }
          }
        }
      }

      // One atomic write + one reload
      await invoke("save_board", { id: board.id, data: JSON.stringify(boardData, null, 2) });
      reloadFromDisk();

      // Step 7: Trigger background research using the just-written board data
      // (not the stale board prop, which doesn't have newly created cards)
      if (r.research?.length) {
        for (const job of r.research) {
          const realId = idMap[job.cardId] || job.cardId;
          const card = boardData.cards[realId];
          if (card) startResearch(card as Card, job.context);
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
      width: PANEL_WIDTH,
      minWidth: PANEL_WIDTH,
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
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMemories(!showMemories)}
              style={{
                fontSize: 10, color: showMemories ? "rgba(180,138,192,0.6)" : "rgba(255,255,255,0.18)",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                padding: "2px 6px",
                borderRadius: 4,
                transition: "all 0.15s",
              }}
            >
              {memories.length} memories
            </button>
            {showMemories && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 6,
                width: 280,
                maxHeight: 300,
                overflowY: "auto",
                background: `linear-gradient(180deg, #1a1f2e 0%, ${DARK_INK} 100%)`,
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5)",
                zIndex: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Wizard Memories
                </div>
                {memories.map((m, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: i < memories.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                      {m}
                    </span>
                    <button
                      onClick={() => {
                        const updated = memories.filter((_, j) => j !== i);
                        updateSettings({ wizardMemories: updated });
                      }}
                      title="Forget this"
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: "none", background: "transparent",
                        color: "rgba(255,255,255,0.12)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, padding: 0, flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(220,80,80,0.6)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.12)"; }}
                    >
                      {"×"}
                    </button>
                  </div>
                ))}
                {memories.length === 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    No memories yet
                  </div>
                )}
              </div>
            )}
          </div>
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

          // Resolve card ID → title, checking both board state and newCards from this response
          const resolveTitle = (id: string): string => {
            if (id.startsWith("NEW_") && r.newCards) {
              const idx = parseInt(id.split("_")[1]);
              if (r.newCards[idx]) return r.newCards[idx].title;
            }
            if (board.cards[id]) return board.cards[id].title;
            // Try partial match — Claude sometimes returns truncated IDs
            const match = Object.entries(board.cards).find(([k]) => k.startsWith(id) || id.startsWith(k));
            if (match) return match[1].title;
            return id.slice(0, 8) + "…";
          };

          const actionSummary: string[] = [];
          if (r.newCards?.length) actionSummary.push(`${r.newCards.length} card${r.newCards.length > 1 ? "s" : ""}`);
          if (r.dayPlan) actionSummary.push("day plan");
          if (r.highlights?.length) actionSummary.push(`${r.highlights.length} highlight${r.highlights.length > 1 ? "s" : ""}`);
          if (r.research?.length) actionSummary.push(`${r.research.length} research`);
          if (r.labels?.length) actionSummary.push(`${r.labels.length} label${r.labels.length > 1 ? "s" : ""}`);
          if (r.rituals?.length) actionSummary.push(`${r.rituals.length} ritual${r.rituals.length > 1 ? "s" : ""}`);
          if (r.moveCards?.length) actionSummary.push(`${r.moveCards.length} move${r.moveCards.length > 1 ? "s" : ""}`);

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
                    const title = resolveTitle(id);
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

              {/* Label assignments */}
              {r.labels && r.labels.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  {r.labels.map((lbl, j) => {
                    const cardTitle = resolveTitle(lbl.cardId);
                    return (
                      <div key={j} style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        padding: "3px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: 4,
                          background: CARD_LABELS.find((l) => l.value === lbl.label)?.color || "rgba(255,255,255,0.2)",
                          flexShrink: 0,
                        }} />
                        <span>{cardTitle} → {lbl.label || "none"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ritual assignments */}
              {r.rituals && r.rituals.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  {r.rituals.map((rit, j) => {
                    const cardTitle = resolveTitle(rit.cardId);
                    const scheduleLabel = !rit.schedule ? "removed"
                      : rit.schedule === "daily" ? "daily"
                      : Array.isArray(rit.schedule) && rit.schedule.join(",") === "1,2,3,4,5" ? "weekdays"
                      : Array.isArray(rit.schedule) ? rit.schedule.map((d) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")
                      : String(rit.schedule);
                    return (
                      <div key={j} style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        padding: "3px 0",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>{"↻"}</span>
                        <span>{cardTitle} → {scheduleLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Card moves */}
              {r.moveCards && r.moveCards.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  {r.moveCards.map((mv, j) => {
                    const cardTitle = resolveTitle(mv.cardId);
                    const colName = board.columns.find((c) => c.id === mv.toColumn)?.title || mv.toColumn;
                    return (
                      <div key={j} style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        padding: "3px 0",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>{"→"}</span>
                        <span>{cardTitle} → {colName}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Research jobs */}
              {r.research && r.research.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  {r.research.map((job, j) => {
                    const cardTitle = resolveTitle(job.cardId);
                    return (
                      <div key={j} style={{
                        fontSize: 12,
                        color: "rgba(200,170,220,0.7)",
                        padding: "3px 0",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}>
                        <span style={{ color: "rgba(200,170,220,0.4)" }}>{"✦"}</span>
                        <span>Research: <strong>{cardTitle}</strong></span>
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
