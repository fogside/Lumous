import { useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Board, Card, Meta, DARK_INK, FocusSession, CardRef } from "../lib/types";
import { useTodayBoard, AggregatedCard } from "../hooks/useTodayBoard";

interface Props {
  boards: Record<string, Board>;
  meta: Meta | null;
  updateSettings: (settings: Partial<Meta["settings"]>) => void;
  flushSave: () => Promise<void>;
  onNavigateToCard: (boardId: string, cardId: string) => void;
  onOpenCard?: (card: Card, boardId: string) => void;
}

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("[data-no-drag]") || target.closest("[draggable]")) return;
  getCurrentWindow().startDragging();
}

function formatTime(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const TIME_OF_DAY_LABELS: Record<string, { title: string }> = {
  morning: { title: "Morning" },
  afternoon: { title: "After Lunch" },
  evening: { title: "Evening" },
};

const DURATION_COLORS: Record<number, string> = {
  25: "rgba(124,196,138,0.4)",   // sage green
  50: "rgba(122,180,204,0.4)",   // slate blue
  75: "rgba(180,138,192,0.4)",   // plum purple
};

// Selected card state for click-to-assign (instead of HTML5 DnD which doesn't work in WKWebView)
interface SelectedCard {
  cardId: string;
  boardId: string;
}

function SessionCard({
  session,
  cards,
  selectedCard,
  onComplete,
  onUncomplete,
  onOpenCard,
  onRemoveSession,
  onAssignSelected,
  onSelectCard,
  onReorderCard,
  onStartSession,
  isComplete,
  parseMinutes,
}: {
  session: FocusSession;
  cards: AggregatedCard[];
  selectedCard: SelectedCard | null;
  onComplete: (ref: CardRef) => void;
  onUncomplete: (ref: CardRef) => void;
  onOpenCard: (ac: AggregatedCard) => void;
  onRemoveSession: (sessionId: string) => void;
  onAssignSelected: (sessionId: string) => void;
  onSelectCard: (ac: AggregatedCard) => void;
  onReorderCard: (sessionId: string, cardId: string, direction: "up" | "down") => void;
  onStartSession: (sessionId: string) => void;
  isComplete: boolean;
  parseMinutes: (est?: string) => number;
}) {
  const completedIds = new Set(session.completedCardIds || []);
  const doneCount = cards.filter((ac) => completedIds.has(ac.card.id)).length;
  const totalMin = cards.reduce((sum, ac) => sum + parseMinutes(ac.card.timeEstimate), 0);
  const hasSelected = selectedCard && !cards.some((ac) => ac.card.id === selectedCard.cardId);

  return (
    <div
      onClick={() => { if (hasSelected) onAssignSelected(session.id); }}
      style={{
        borderRadius: 14,
        background: isComplete
          ? "rgba(100,200,100,0.04)"
          : hasSelected ? "rgba(180,138,192,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isComplete ? "rgba(100,200,100,0.12)" : hasSelected ? "rgba(180,138,192,0.15)" : "rgba(255,255,255,0.04)"}`,
        padding: "14px 16px",
        marginBottom: 10,
        transition: "all 0.15s",
        minHeight: 50,
        cursor: hasSelected ? "pointer" : "default",
      }}
    >
      {/* Session header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {isComplete ? (
          <span style={{ fontSize: 12, color: "rgba(100,200,100,0.7)" }}>{"✓"}</span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            background: DURATION_COLORS[session.duration] || "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.85)",
          }}>
            {session.duration}min
          </span>
        )}
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", flex: 1 }}>
          {isComplete ? (
            <span style={{ color: "rgba(100,200,100,0.6)" }}>Session complete!</span>
          ) : (
            <>
              {doneCount > 0 && <span style={{ color: "rgba(100,200,100,0.5)" }}>{doneCount}/{cards.length} done · </span>}
              {formatTime(totalMin)}
              {totalMin > session.duration && (
                <span style={{ color: "rgba(220,80,80,0.6)", marginLeft: 4 }}>
                  ({formatTime(totalMin - session.duration)} over)
                </span>
              )}
            </>
          )}
        </span>
        {/* Start session button */}
        {!isComplete && !session.started && cards.length > 0 && (
          <button
            onClick={() => onStartSession(session.id)}
            data-no-drag
            style={{
              fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 5,
              border: "none", background: "rgba(124,196,138,0.12)",
              color: "rgba(124,196,138,0.8)", cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Start
          </button>
        )}
        {session.started && !isComplete && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(124,196,138,0.4)" }}>In progress</span>
        )}
        <button
          onClick={() => onRemoveSession(session.id)}
          data-no-drag
          style={{
            width: 20, height: 20, borderRadius: 5,
            border: "none", background: "transparent",
            color: "rgba(255,255,255,0.1)", cursor: "pointer",
            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(220,80,80,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.1)"; }}
        >
          {"×"}
        </button>
      </div>

      {/* Card list */}
      {hasSelected && cards.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 12, color: "rgba(180,138,192,0.4)", textAlign: "center" }}>
          Click to add selected task here
        </div>
      )}

      {cards.map((ac, cardIdx) => {
        const isDone = completedIds.has(ac.card.id);
        const isSelected = selectedCard?.cardId === ac.card.id;
        return (
          <div
            key={ac.card.id}
            data-no-drag
            onClick={(e) => { e.stopPropagation(); if (!isDone) onOpenCard(ac); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 8,
              cursor: isDone ? "default" : "pointer",
              opacity: isDone ? 0.5 : 1,
              transition: "all 0.15s",
              background: isSelected ? "rgba(180,138,192,0.1)" : "transparent",
              border: isSelected ? "1px solid rgba(180,138,192,0.2)" : "1px solid transparent",
            }}
            onMouseEnter={(e) => { if (!isDone && !isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
          >
            {isDone ? (
              <button
                onClick={(e) => { e.stopPropagation(); onUncomplete({ boardId: ac.boardId, cardId: ac.card.id }); }}
                data-no-drag title="Undo completion"
                style={{
                  width: 16, height: 16, borderRadius: 5, background: "rgba(100,200,100,0.2)",
                  border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 10, color: "rgba(100,200,100,0.8)",
                  cursor: "pointer", padding: 0,
                }}
              >{"✓"}</button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete({ boardId: ac.boardId, cardId: ac.card.id }); }}
                data-no-drag title="Complete"
                style={{
                  width: 16, height: 16, borderRadius: 5,
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  background: "transparent", cursor: "pointer",
                  flexShrink: 0, padding: 0, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(100,200,100,0.5)"; e.currentTarget.style.background = "rgba(100,200,100,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "transparent"; }}
              />
            )}
            <span style={{
              flex: 1, fontSize: 13, lineHeight: 1.4,
              color: isDone ? "rgba(255,255,255,0.35)" : isSelected ? "rgba(200,170,220,0.9)" : "rgba(255,255,255,0.8)",
              textDecoration: isDone ? "line-through" : "none",
            }}>
              {ac.card.title}
            </span>
            {/* Reorder + move buttons */}
            {!isDone && (
              <span className="move-btn" style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                {cardIdx > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReorderCard(session.id, ac.card.id, "up"); }}
                    data-no-drag title="Move up"
                    style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: "none", background: "transparent",
                      color: "rgba(255,255,255,0.15)", cursor: "pointer",
                      padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.15)"; }}
                  >{"▲"}</button>
                )}
                {cardIdx < cards.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReorderCard(session.id, ac.card.id, "down"); }}
                    data-no-drag title="Move down"
                    style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: "none", background: "transparent",
                      color: "rgba(255,255,255,0.15)", cursor: "pointer",
                      padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.15)"; }}
                  >{"▼"}</button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectCard(ac); }}
                  data-no-drag
                  title={isSelected ? "Cancel move" : "Move to another session"}
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: "none", background: isSelected ? "rgba(180,138,192,0.2)" : "transparent",
                    color: isSelected ? "rgba(200,170,220,0.8)" : "rgba(255,255,255,0.15)",
                    cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.color = "rgba(255,255,255,0.15)"; }}
                >{"↔"}</button>
              </span>
            )}
            {ac.card.timeEstimate && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5,
                background: "rgba(180,138,192,0.1)", color: isDone ? "rgba(200,170,220,0.3)" : "rgba(200,170,220,0.7)", flexShrink: 0,
              }}>{ac.card.timeEstimate}</span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
              background: `${ac.boardColor}20`, color: "rgba(255,255,255,0.3)",
              flexShrink: 0, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{ac.boardTitle}</span>
          </div>
        );
      })}

      {cards.length === 0 && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.1)", textAlign: "center", padding: "8px 0" }}>
          Drag tasks here
        </div>
      )}
    </div>
  );
}

export function TodayBoardView({ boards, meta, updateSettings, flushSave, onNavigateToCard, onOpenCard }: Props) {
  const {
    allCards, unplanned, sessions, totalPlannedMin, totalUnplannedMin,
    setSessions, moveCardToSession, removeCardFromSession, addSession, removeSession,
    completeCard, uncompleteCard, reorderCardInSession, startSession, isSessionComplete, parseMinutes,
  } = useTodayBoard(boards, meta, updateSettings, flushSave);

  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showPlanInput, setShowPlanInput] = useState(false);
  const [planPrompt, setPlanPrompt] = useState("");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);

  const planMyDay = async (customPrompt?: string) => {
    if (planning || allCards.length === 0) return;
    setPlanning(true);
    setPlanError(null);

    try {
      const memories = meta?.settings.wizardMemories || [];
      const memoryBlock = memories.length > 0
        ? `\n\nUser preferences and rules:\n${memories.map((m) => `- ${m}`).join("\n")}`
        : "";

      const cardList = allCards.map((ac) => {
        const est = ac.card.timeEstimate || "15min";
        const labels = [ac.card.label, ac.boardTitle].filter(Boolean).join(", ");
        return `- [${ac.card.id}] "${ac.card.title}" (${est}) from board "${ac.boardTitle}"${ac.card.label ? ` [label: ${ac.card.label}]` : ""}${ac.card.goalId ? " [has goal]" : ""}${ac.card.ritual ? " [recurring]" : ""}`;
      }).join("\n");

      const systemPrompt = `You are a focus session planner. Given a list of tasks with time estimates, create an optimal day plan grouped into focus sessions (25, 50, or 75 minutes each).

Rules for session planning:
- Sessions can be 25, 50, or 75 minutes only (focus mode durations)
- Start the day with shorter sessions (25min) for admin/quick tasks
- Group similar short tasks (admin, emails, quick chores) into 25min sessions
- Group deep work (coding, writing, research) into 50-75min sessions
- Mix task types within sessions when possible (e.g., exercise + reading, not two coding tasks)
- Put physically active tasks (exercise, walks) in morning
- Put heavy thinking tasks in morning or early afternoon
- Put lighter tasks (reading, journaling, planning) in evening
- Each card can only appear in ONE session
- Total session time should not exceed the sum of card estimates
- ALL cards must be assigned to a session — no unplanned cards left

You MUST respond with ONLY a valid JSON array of sessions. No text, no markdown, no explanation — just the JSON array:
[{"duration": 25|50|75, "timeOfDay": "morning"|"afternoon"|"evening", "cardIds": ["id1", "id2"]}]${memoryBlock}`;

      const customBlock = customPrompt ? `\n\nUser's instructions: ${customPrompt}` : "";
      const userPrompt = `Plan these ${allCards.length} tasks into focus sessions:\n\n${cardList}${customBlock}\n\nFirst, add time estimates to any cards missing them. Then create sessions. Respond with ONLY the JSON array.`;

      const result = await invoke<string>("run_claude", {
        systemPrompt,
        userPrompt,
      });

      // Parse JSON
      let jsonStr = result.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrMatch) jsonStr = arrMatch[0];

      const planned: { duration: number; timeOfDay: string; cardIds: string[] }[] = JSON.parse(jsonStr);

      // Convert to FocusSession objects
      const newSessions: FocusSession[] = planned.map((p) => ({
        id: crypto.randomUUID(),
        duration: ([25, 50, 75].includes(p.duration) ? p.duration : 25) as 25 | 50 | 75,
        timeOfDay: (["morning", "afternoon", "evening"].includes(p.timeOfDay) ? p.timeOfDay : "morning") as "morning" | "afternoon" | "evening",
        cardRefs: p.cardIds
          .map((cid) => {
            const ac = allCards.find((a) => a.card.id === cid);
            return ac ? { boardId: ac.boardId, cardId: cid } : null;
          })
          .filter(Boolean) as CardRef[],
      }));

      setSessions(newSessions);
    } catch (e) {
      setPlanError(String(e));
    } finally {
      setPlanning(false);
    }
  };

  const handleSelectCard = useCallback((ac: AggregatedCard) => {
    setSelectedCard((prev) =>
      prev?.cardId === ac.card.id ? null : { cardId: ac.card.id, boardId: ac.boardId }
    );
  }, []);

  const handleAssignToSession = useCallback((sessionId: string) => {
    if (!selectedCard) return;
    moveCardToSession({ boardId: selectedCard.boardId, cardId: selectedCard.cardId }, sessionId);
    setSelectedCard(null);
  }, [selectedCard, moveCardToSession]);

  const handleOpenCard = useCallback((ac: AggregatedCard) => {
    if (onOpenCard) {
      onOpenCard(ac.card, ac.boardId);
    }
  }, [onOpenCard]);

  const resolveSessionCards = useCallback(
    (session: FocusSession): AggregatedCard[] => {
      return session.cardRefs
        .map((ref) => allCards.find((ac) => ac.card.id === ref.cardId))
        .filter(Boolean) as AggregatedCard[];
    },
    [allCards],
  );

  const handleUnassignSelected = useCallback(() => {
    if (!selectedCard) return;
    removeCardFromSession(selectedCard.cardId);
    setSelectedCard(null);
  }, [selectedCard, removeCardFromSession]);

  const totalCards = allCards.length;
  const totalMin = totalPlannedMin + totalUnplannedMin;

  const mornings = sessions.filter((s) => s.timeOfDay === "morning");
  const afternoons = sessions.filter((s) => s.timeOfDay === "afternoon");
  const evenings = sessions.filter((s) => s.timeOfDay === "evening");

  return (
    <div
      onMouseDown={startWindowDrag}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: DARK_INK,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div onMouseDown={startWindowDrag} style={{ padding: "44px 48px 20px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
              <path d="M17.8 11.8L19 13" /><path d="M15 9h.01" />
              <path d="M17.8 6.2L19 5" /><path d="M3 21l9-9" />
              <path d="M12.2 6.2L11 5" />
            </svg>
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            Today
          </h1>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", display: "flex", gap: 16 }}>
            <span>{totalCards} task{totalCards !== 1 ? "s" : ""}</span>
            <span>{formatTime(totalMin)} total</span>
            {totalPlannedMin > 0 && <span>{formatTime(totalPlannedMin)} planned</span>}
          </span>
          <div style={{ flex: 1 }} />
          {totalCards > 0 && !showPlanInput && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => planMyDay()}
                disabled={planning}
                data-no-drag
                style={{
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  background: planning ? "rgba(180,138,192,0.08)" : "rgba(180,138,192,0.15)",
                  color: planning ? "rgba(180,138,192,0.4)" : "rgba(200,170,220,0.9)",
                  cursor: planning ? "default" : "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {planning ? (
                  <>
                    <span style={{ animation: "wizard-spin 1s linear infinite", display: "inline-block" }}>{"✦"}</span>
                    Planning...
                  </>
                ) : (
                  <>{"✦"} Plan my day</>
                )}
              </button>
              {!planning && (
                <button
                  onClick={() => setShowPlanInput(true)}
                  data-no-drag
                  title="Plan with custom instructions"
                  style={{
                    padding: "7px 10px",
                    fontSize: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.2)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {"✎"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Custom plan prompt */}
        {showPlanInput && (
          <div data-no-drag style={{ padding: "0 48px", marginBottom: 12 }}>
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 10, padding: "10px 12px",
            }}>
              <textarea
                value={planPrompt}
                onChange={(e) => setPlanPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) { e.preventDefault(); planMyDay(planPrompt); setShowPlanInput(false); setPlanPrompt(""); }
                  if (e.key === "Escape") { setShowPlanInput(false); setPlanPrompt(""); }
                }}
                placeholder="e.g., Put exercise first, keep afternoon light, I have a meeting at 2pm..."
                autoFocus
                rows={2}
                style={{
                  flex: 1, background: "transparent", border: "none", padding: 0,
                  fontSize: 13, color: "rgba(255,255,255,0.8)", outline: "none",
                  resize: "none", lineHeight: 1.5,
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                }}
              />
              <button
                onClick={() => { planMyDay(planPrompt); setShowPlanInput(false); setPlanPrompt(""); }}
                disabled={planning}
                data-no-drag
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7,
                  border: "none", background: "rgba(180,138,192,0.15)",
                  color: "rgba(200,170,220,0.9)", cursor: "pointer", flexShrink: 0,
                }}
              >
                {"✦"} Plan
              </button>
              <button
                onClick={() => { setShowPlanInput(false); setPlanPrompt(""); }}
                data-no-drag
                style={{
                  padding: "6px 10px", fontSize: 12, borderRadius: 7,
                  border: "none", background: "transparent",
                  color: "rgba(255,255,255,0.2)", cursor: "pointer", flexShrink: 0,
                }}
              >
                {"×"}
              </button>
            </div>
          </div>
        )}

        {planError && (
          <div style={{ padding: "0 48px", marginBottom: 8, fontSize: 12, color: "rgba(220,120,120,0.7)" }}>{planError}</div>
        )}
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 40px 40px 40px" }}>
        {totalCards === 0 && (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "rgba(255,255,255,0.12)",
            fontSize: 14,
            lineHeight: 1.8,
          }}>
            No tasks for today yet.
            <br />
            Move cards to "Today" on your boards to see them here.
          </div>
        )}

        {/* Time-of-day sections */}
        {[
          { key: "morning", items: mornings },
          { key: "afternoon", items: afternoons },
          { key: "evening", items: evenings },
        ].map(({ key, items }) => {
          const info = TIME_OF_DAY_LABELS[key];
          return (
            <div key={key} style={{ marginBottom: 24 }}>
              {/* Section header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>{"✦"}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  {info.title}
                </span>
                <div style={{ flex: 1 }} />
                {/* Add session buttons */}
                {[25, 50, 75].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => addSession(dur as 25 | 50 | 75, key as "morning" | "afternoon" | "evening")}
                    data-no-drag
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "3px 8px", borderRadius: 5,
                      background: "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.12)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "transparent"; }}
                    title={`Add ${dur}min session`}
                  >
                    +{dur}
                  </button>
                ))}
              </div>

              {/* Sessions */}
              {items.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  cards={resolveSessionCards(session)}
                  selectedCard={selectedCard}
                  onComplete={completeCard}
                  onUncomplete={uncompleteCard}
                  onOpenCard={handleOpenCard}
                  onRemoveSession={removeSession}
                  onAssignSelected={() => handleAssignToSession(session.id)}
                  onSelectCard={handleSelectCard}
                  onReorderCard={reorderCardInSession}
                  onStartSession={startSession}
                  isComplete={isSessionComplete(session)}
                  parseMinutes={parseMinutes}
                />
              ))}

              {items.length === 0 && (
                <div style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px dashed rgba(255,255,255,0.04)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.08)",
                  textAlign: "center",
                }}>
                  No sessions yet — click +25, +50, or +75 to add
                </div>
              )}
            </div>
          );
        })}

        {/* Unplanned section */}
        {/* Selected card indicator bar */}
        {selectedCard && (
          <div style={{
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(180,138,192,0.08)",
            border: "1px solid rgba(180,138,192,0.15)",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "rgba(200,170,220,0.8)",
          }}>
            <span>{"✦"}</span>
            <span style={{ flex: 1 }}>
              Click a session to move <strong>{allCards.find((a) => a.card.id === selectedCard.cardId)?.card.title}</strong> there
            </span>
            <button
              onClick={() => setSelectedCard(null)}
              style={{
                fontSize: 11, padding: "3px 8px", borderRadius: 5,
                border: "none", background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.4)", cursor: "pointer",
              }}
            >Cancel</button>
          </div>
        )}

        {(unplanned.length > 0 || sessions.length > 0) && (
          <div
            onClick={selectedCard ? handleUnassignSelected : undefined}
            style={{
              marginTop: 8,
              padding: "8px 0",
              borderRadius: 12,
              cursor: selectedCard ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>Unplanned</span>
              <span style={{ fontWeight: 500, fontSize: 11, color: "rgba(255,255,255,0.12)" }}>
                {unplanned.length} task{unplanned.length !== 1 ? "s" : ""} · {formatTime(totalUnplannedMin)}
              </span>
            </div>

            {unplanned.map((ac) => {
              const isSelected = selectedCard?.cardId === ac.card.id;
              return (
              <div
                key={ac.card.id}
                data-no-drag
                onClick={(e) => { e.stopPropagation(); handleSelectCard(ac); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 8,
                  marginBottom: 2,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: isSelected ? "rgba(180,138,192,0.1)" : "transparent",
                  border: isSelected ? "1px solid rgba(180,138,192,0.2)" : "1px solid transparent",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); completeCard({ boardId: ac.boardId, cardId: ac.card.id }); }}
                  data-no-drag
                  style={{
                    width: 16, height: 16, borderRadius: 5,
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    background: "transparent", cursor: "pointer",
                    flexShrink: 0, padding: 0,
                  }}
                  title="Complete"
                />
                <span style={{ flex: 1, fontSize: 13, color: isSelected ? "rgba(200,170,220,0.9)" : "rgba(255,255,255,0.6)" }}>
                  {ac.card.title}
                </span>
                {ac.card.timeEstimate && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px",
                    borderRadius: 5, background: "rgba(180,138,192,0.08)",
                    color: "rgba(200,170,220,0.5)", flexShrink: 0,
                  }}>
                    {ac.card.timeEstimate}
                  </span>
                )}
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: `${ac.boardColor}15`, color: "rgba(255,255,255,0.2)",
                  flexShrink: 0, maxWidth: 80, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {ac.boardTitle}
                </span>
              </div>
            ); })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes wizard-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .move-btn { opacity: 0; }
        div:hover > .move-btn { opacity: 1; }
      `}</style>
    </div>
  );
}
