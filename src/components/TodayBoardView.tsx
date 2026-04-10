import { useState, useCallback, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Board, Card, Meta, DARK_INK, FocusSession, CardRef } from "../lib/types";
import { useTodayBoard, AggregatedCard } from "../hooks/useTodayBoard";
import { WizardCelebration } from "./WizardCelebration";
import { BackgroundWisps } from "./BackgroundWisps";

interface Props {
  boards: Record<string, Board>;
  meta: Meta | null;
  updateSettings: (settings: Partial<Meta["settings"]>) => void;
  flushSave: () => Promise<void>;
  onNavigateToCard: (boardId: string, cardId: string) => void;
  onOpenCard?: (card: Card, boardId: string) => void;
  onToggleWizard?: () => void;
  showWisps?: boolean;
  refreshBoard?: (board: Board) => void;
  setBoardIfMatch?: (board: Board) => void;
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

const TIME_OF_DAY_LABELS: Record<string, { title: string; color: string; emoji: string }> = {
  morning: { title: "Morning", color: "rgba(224,197,90,0.5)", emoji: "☀️" },
  afternoon: { title: "After Lunch", color: "rgba(220,160,90,0.4)", emoji: "🍵" },
  evening: { title: "Evening", color: "rgba(180,138,192,0.4)", emoji: "🌙" },
};

const DURATION_COLORS: Record<number, string> = {
  25: "rgba(85,107,47,0.55)",    // olive green (#556B2F)
  50: "rgba(75,60,140,0.55)",    // deep indigo
  75: "rgba(142,74,73,0.55)",    // copper rose (#8E4A49)
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
          ? "rgba(85,107,47,0.08)"
          : hasSelected ? "rgba(180,138,192,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isComplete ? "rgba(85,107,47,0.25)" : hasSelected ? "rgba(180,138,192,0.15)" : "rgba(255,255,255,0.04)"}`,
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
          <span style={{ fontSize: 12, color: "rgba(140,170,80,0.9)" }}>{"✓"}</span>
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
            <span style={{ color: "rgba(140,170,80,0.8)" }}>Session complete!</span>
          ) : (
            <>
              {doneCount > 0 && <span style={{ color: "rgba(140,170,80,0.6)" }}>{doneCount}/{cards.length} done · </span>}
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
              border: "none", background: "rgba(85,107,47,0.2)",
              color: "rgba(140,170,80,0.9)", cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Start
          </button>
        )}
        {session.started && !isComplete && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(140,170,80,0.5)" }}>In progress</span>
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
                  width: 16, height: 16, borderRadius: 5, background: "rgba(85,107,47,0.35)",
                  border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 10, color: "rgba(140,170,80,0.9)",
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
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(140,170,80,0.6)"; e.currentTarget.style.background = "rgba(85,107,47,0.15)"; }}
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
                background: isDone ? "transparent" : "rgba(180,138,192,0.1)",
                color: isDone ? "rgba(200,170,220,0.2)" : "rgba(200,170,220,0.7)", flexShrink: 0,
              }}>{ac.card.timeEstimate}</span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
              background: isDone ? "transparent" : `${ac.boardColor}20`, color: isDone ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)",
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

export function TodayBoardView({ boards, meta, updateSettings, flushSave, onNavigateToCard, onOpenCard, onToggleWizard, showWisps = true, refreshBoard, setBoardIfMatch }: Props) {
  const {
    allCards, unplanned, sessions, totalPlannedMin, totalUnplannedMin,
    setSessions, moveCardToSession, removeCardFromSession, addSession, removeSession,
    completeCard, uncompleteCard, reorderCardInSession, startSession, isSessionComplete, parseMinutes,
  } = useTodayBoard(boards, meta, updateSettings, flushSave, refreshBoard, setBoardIfMatch);

  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  // Trigger wizard celebration when a session completes
  const completedCount = sessions.filter((s) => isSessionComplete(s)).length;
  const prevCompletedRef = useRef(completedCount);
  useEffect(() => {
    if (completedCount > prevCompletedRef.current) {
      setWizardKey((k) => k + 1);
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 3000);
      prevCompletedRef.current = completedCount;
      return () => clearTimeout(t);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount]);

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
        background: `linear-gradient(135deg, ${DARK_INK} 0%, #1e1a2e 35%, #2a2440 65%, #302848 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative glows */}
      <div style={{
        position: "absolute",
        top: -80,
        right: -40,
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,138,192,0.12) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: 60,
        right: 120,
        width: 250,
        height: 250,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(224,197,90,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: -100,
        left: "30%",
        width: 350,
        height: 350,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(110,90,160,0.06) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: "35%",
        left: -40,
        width: 280,
        height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(224,197,90,0.06) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: "60%",
        right: "15%",
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(210,180,70,0.05) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: 120,
        left: "45%",
        width: 180,
        height: 180,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(230,200,100,0.04) 0%, transparent 55%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: 60,
        right: "20%",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(85,107,47,0.06) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      <BackgroundWisps boardColor="#2B3A55" isLight={false} visible={showWisps} />

      {/* Header — matches BoardView pattern: title + wand on one line */}
      <div onMouseDown={startWindowDrag} style={{ padding: "44px 48px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            {"⚡"} Today
          </h1>
          {onToggleWizard && (
            <button
              onClick={onToggleWizard}
              data-no-drag
              title="Ask the Wizard"
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: "none", background: "transparent",
                color: "rgba(224,197,90,0.35)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", flexShrink: 0,
              }}
              className="wand-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
                <path d="M17.8 11.8L19 13" /><path d="M15 9h.01" />
                <path d="M17.8 6.2L19 5" /><path d="M3 21l9-9" />
                <path d="M12.2 6.2L11 5" />
              </svg>
            </button>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(224,197,90,0.35)", fontWeight: 500 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.2)", display: "flex", gap: 16 }}>
          <span>{totalCards} task{totalCards !== 1 ? "s" : ""}</span>
          <span>{formatTime(totalMin)} total</span>
          {totalPlannedMin > 0 && <span style={{ color: "rgba(224,197,90,0.3)" }}>{formatTime(totalPlannedMin)} planned</span>}
          {sessions.length > 0 && <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>}
        </div>
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
                <span style={{ fontSize: 13 }}>{info.emoji}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: info.color,
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

      <WizardCelebration key={wizardKey} visible={showCelebration} boardColor="#2B3A55" />

      <style>{`
        @keyframes wizard-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .move-btn { opacity: 0; pointer-events: none; }
        div:hover > .move-btn { opacity: 1; pointer-events: auto; }
      `}</style>
    </div>
  );
}
