import { useState, useEffect, useRef } from "react";
import { Card, CardLabel, CARD_LABELS, DARK_INK, Goal, RitualSchedule } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { renderMarkdown } from "../lib/markdown";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  card: Card;
  columnId: string;
  goals?: Goal[];
  onSave: (card: Card) => void;
  onDelete: (cardId: string, columnId: string) => void;
  onClose: () => void;
  onStartResearch?: (card: Card, context: string) => void;
}

export function CardModal({ card, columnId, goals, onSave, onDelete, onClose, onStartResearch }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [label, setLabel] = useState<CardLabel | undefined>(card.label);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Goal state (independent)
  const [goalId, setGoalId] = useState<string | undefined>(card.goalId);

  // Ritual state
  const [ritualEnabled, setRitualEnabled] = useState(!!card.ritual);
  const [ritualSchedule, setRitualSchedule] = useState<RitualSchedule>(
    card.ritual?.schedule || "daily"
  );

  // Track which fields the user has manually edited (don't overwrite those from prop updates)
  const userEditedRef = useRef<Set<string>>(new Set());
  const cardIdRef = useRef(card.id);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  // Sync from card prop when external changes arrive (e.g., wizard sets label/ritual/timeEstimate)
  // but don't overwrite fields the user is actively editing
  useEffect(() => {
    if (card.id !== cardIdRef.current) {
      // Different card entirely — reset everything
      cardIdRef.current = card.id;
      userEditedRef.current.clear();
      setTitle(card.title);
      setDescription(card.description);
      setLabel(card.label);
      setGoalId(card.goalId);
      setRitualEnabled(!!card.ritual);
      setRitualSchedule(card.ritual?.schedule || "daily");
      return;
    }
    // Same card, external update — sync fields the user hasn't touched
    if (!userEditedRef.current.has("label")) setLabel(card.label);
    if (!userEditedRef.current.has("goalId")) setGoalId(card.goalId);
    if (!userEditedRef.current.has("ritual")) {
      setRitualEnabled(!!card.ritual);
      setRitualSchedule(card.ritual?.schedule || "daily");
    }
  }, [card]);

  const [researchContext, setResearchContext] = useState("");
  const [showResearchInput, setShowResearchInput] = useState(false);
  const hasMarkdown = /[*#\-`|]/.test(card.description);
  const [descPreview, setDescPreview] = useState(hasMarkdown && card.description.trim().length > 0);
  const [readingMode, setReadingMode] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (readingMode) { setReadingMode(false); return; }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, readingMode]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...card,
      title: title.trim(),
      description: description.trim(),
      label: label || undefined,
      goalId: goalId || undefined,
      ritual: ritualEnabled
        ? { schedule: ritualSchedule }
        : undefined,
      research: researchCleared ? undefined : card.research, // clear only after user applied to description
    });
    onClose();
  };

  const handleStartResearch = () => {
    if (!onStartResearch) return;
    onStartResearch(card, researchContext || card.title);
    setShowResearchInput(false);
    setResearchContext("");
  };

  const [researchCleared, setResearchCleared] = useState(false);

  const handleApplyResearch = () => {
    if (!card.research?.result) return;
    const sep = description.trim() ? "\n\n---\n\n" : "";
    setDescription(description.trim() + sep + card.research.result);
    setDescPreview(true);
    setResearchCleared(true); // hide research section after applying
  };

  return (
    <div
      data-no-drag
      onMouseDown={(e) => e.stopPropagation()}
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
          width: 540,
          maxWidth: "92vw",
          maxHeight: "78vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title — the hero input */}
        <div style={{ padding: "24px 26px 0 26px" }}>
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
            placeholder="Card title..."
            rows={Math.max(1, Math.ceil(title.length / 30))}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              fontSize: 22,
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
              outline: "none",
              resize: "none",
              lineHeight: 1.4,
              overflow: "hidden",
              padding: 0,
            }}
          />
        </div>

        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 26px 20px 26px" }}>

          {/* Description — edit / preview / expand toggle */}
          <div style={{ marginTop: 16 }}>
            {description.trim() && (
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {/[*#\-`|]/.test(description) && (
                  <>
                    <button
                      onClick={() => setDescPreview(false)}
                      style={{
                        padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: !descPreview ? "rgba(255,255,255,0.08)" : "transparent",
                        border: "none", color: !descPreview ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >Edit</button>
                    <button
                      onClick={() => setDescPreview(true)}
                      style={{
                        padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: descPreview ? "rgba(255,255,255,0.08)" : "transparent",
                        border: "none", color: descPreview ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >Preview</button>
                  </>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setReadingMode(true)}
                  title="Reading mode"
                  style={{
                    padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                    background: "transparent", border: "none",
                    color: "rgba(255,255,255,0.2)", cursor: "pointer",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6" /><path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" /><path d="M3 21l7-7" />
                  </svg>
                </button>
              </div>
            )}

            {descPreview && description.trim() ? (
              <div
                style={{
                  minHeight: 80,
                  maxHeight: 300,
                  overflowY: "auto",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.6,
                  userSelect: "text",
                }}
              >
                {renderMarkdown(description)}
              </div>
            ) : (
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = Math.max(el.scrollHeight, 80) + "px";
                  }
                }}
                placeholder="Add a description..."
                style={{
                  width: "100%",
                  minHeight: 80,
                  maxHeight: 240,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 15,
                  color: "rgba(255,255,255,0.75)",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.6,
                  transition: "border-color 0.15s",
                  overflow: "auto",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
              />
            )}
          </div>

          {/* Label */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Label
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {CARD_LABELS.map((l) => (
                <button
                  key={l.name}
                  onClick={() => { userEditedRef.current.add("label"); setLabel(l.value); }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: (label || null) === l.value ? "2px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: l.value ? l.color : "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.35)",
                    transition: "all 0.15s",
                  }}
                  title={l.name}
                >
                  {!l.value && "×"}
                </button>
              ))}
            </div>
          </div>

          {/* Repeat */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: ritualEnabled ? 10 : 0,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Repeat
              </span>
              <button
                onClick={() => { userEditedRef.current.add("ritual"); setRitualEnabled(!ritualEnabled); }}
                style={{
                  width: 34, height: 18, borderRadius: 9, border: "none",
                  background: ritualEnabled ? "rgba(124,196,138,0.45)" : "rgba(255,255,255,0.08)",
                  cursor: "pointer", position: "relative", transition: "background 0.2s",
                  padding: 0,
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 7,
                  background: ritualEnabled ? "#7cc48a" : "rgba(255,255,255,0.3)",
                  position: "absolute", top: 2,
                  left: ritualEnabled ? 18 : 2,
                  transition: "all 0.2s",
                }} />
              </button>
            </div>

            {ritualEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    onClick={() => setRitualSchedule("daily")}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: ritualSchedule === "daily" ? "rgba(255,255,255,0.1)" : "transparent",
                      border: "none",
                      color: ritualSchedule === "daily" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                      transition: "all 0.15s",
                    }}
                  >
                    Every day
                  </button>
                  <button
                    onClick={() => setRitualSchedule([1, 2, 3, 4, 5])}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: Array.isArray(ritualSchedule) && ritualSchedule.join() === "1,2,3,4,5" ? "rgba(255,255,255,0.1)" : "transparent",
                      border: "none",
                      color: Array.isArray(ritualSchedule) && ritualSchedule.join() === "1,2,3,4,5" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                      transition: "all 0.15s",
                    }}
                  >
                    Weekdays
                  </button>
                </div>

                <div style={{ display: "flex", gap: 3 }}>
                  {DAY_NAMES.map((name, i) => {
                    const isActive = ritualSchedule === "daily" || (Array.isArray(ritualSchedule) && ritualSchedule.includes(i));
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          let current: number[];
                          if (ritualSchedule === "daily") current = [0, 1, 2, 3, 4, 5, 6];
                          else current = [...ritualSchedule];
                          if (current.includes(i)) {
                            current = current.filter((d) => d !== i);
                            if (current.length === 0) current = [i];
                          } else {
                            current.push(i);
                            current.sort();
                          }
                          if (current.length === 7) setRitualSchedule("daily");
                          else setRitualSchedule(current);
                        }}
                        style={{
                          width: 36, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 700,
                          cursor: "pointer",
                          background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                          border: "none",
                          color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                          transition: "all 0.15s",
                          padding: 0,
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Goal */}
          {goals && goals.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Goal
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button
                  onClick={() => { userEditedRef.current.add("goalId"); setGoalId(undefined); }}
                  style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    background: !goalId ? "rgba(255,255,255,0.1)" : "transparent",
                    border: "none",
                    color: !goalId ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.25)",
                    transition: "all 0.15s",
                  }}
                >
                  None
                </button>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { userEditedRef.current.add("goalId"); setGoalId(g.id); }}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer",
                      background: goalId === g.id ? `${g.color}20` : "transparent",
                      border: "none",
                      color: goalId === g.id ? g.color : "rgba(255,255,255,0.25)",
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: g.color, flexShrink: 0 }} />
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Research */}
          {onStartResearch && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {"🧙"} Research
                </span>
                {card.research?.status === "running" && (
                  <span style={{ fontSize: 11, color: "rgba(180,138,192,0.5)", fontStyle: "italic" }}>
                    <span style={{ animation: "wizard-spin 1s linear infinite", display: "inline-block", marginRight: 4 }}>{"✦"}</span>
                    Researching...
                  </span>
                )}
              </div>

              {/* Research results */}
              {card.research?.status === "done" && card.research.result && !researchCleared && (
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(180,138,192,0.04)",
                  border: "1px solid rgba(180,138,192,0.08)",
                  marginBottom: 10,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.55,
                  maxHeight: 240,
                  overflowY: "auto",
                }}>
                  {renderMarkdown(card.research.result)}
                </div>
              )}

              {/* Error */}
              {card.research?.status === "error" && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(220,80,80,0.06)",
                  color: "rgba(220,120,120,0.7)",
                  fontSize: 12,
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}>
                  {card.research.error || "Research failed"}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.research?.status === "done" && !researchCleared && (
                  <>
                    <button
                      onClick={handleApplyResearch}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: "rgba(180,138,192,0.1)", border: "none",
                        color: "rgba(200,170,220,0.8)", cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      Apply to description
                    </button>
                    <button
                      onClick={() => setShowResearchInput(true)}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                        background: "transparent", border: "none",
                        color: "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      Refine
                    </button>
                  </>
                )}

                {(card.research?.status === "error" || (!card.research && !showResearchInput)) && (
                  <button
                    onClick={() => setShowResearchInput(true)}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: "rgba(180,138,192,0.08)", border: "none",
                      color: "rgba(200,170,220,0.6)", cursor: "pointer", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {"✦"} {card.research?.status === "error" ? "Retry" : "Start research"}
                  </button>
                )}
              </div>

              {/* Research context input */}
              {showResearchInput && card.research?.status !== "running" && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={researchContext}
                    onChange={(e) => setResearchContext(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey) { e.preventDefault(); handleStartResearch(); }
                    }}
                    placeholder={`What should I research about "${card.title}"?`}
                    rows={2}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.75)",
                      outline: "none",
                      resize: "none",
                      lineHeight: 1.5,
                      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button
                      onClick={handleStartResearch}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: "rgba(180,138,192,0.12)", border: "none",
                        color: "rgba(200,170,220,0.8)", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {"🧙"} Research
                    </button>
                    <button
                      onClick={() => { setShowResearchInput(false); setResearchContext(""); }}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                        background: "transparent", border: "none",
                        color: "rgba(255,255,255,0.25)", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div style={{
          padding: "14px 26px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,0,0,0.15)",
        }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(220,80,80,0.5)",
              background: "transparent",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Delete
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.35)",
                background: "transparent",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Reading mode — fullscreen description view */}
      {readingMode && (
        <div
          onClick={() => setReadingMode(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "6vh",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: `linear-gradient(180deg, #141822 0%, ${DARK_INK} 100%)`,
              borderRadius: 16,
              width: 720,
              maxWidth: "92vw",
              maxHeight: "86vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "24px 32px 16px 32px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}>
              <h2 style={{
                fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.95)",
                margin: 0, flex: 1, lineHeight: 1.3,
              }}>
                {title}
              </h2>
              <button
                onClick={() => setReadingMode(false)}
                title="Close reading mode (Esc)"
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: "none", background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.3)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, padding: 0, flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6" /><path d="M20 10h-6V4" />
                  <path d="M14 10l7-7" /><path d="M3 21l7-7" />
                </svg>
              </button>
            </div>

            {/* Content — scrollable, rendered markdown or editable */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 32px 32px 32px",
            }}>
              {descPreview ? (
                <div style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.7,
                  userSelect: "text",
                }}>
                  {renderMarkdown(description)}
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: "calc(86vh - 160px)",
                    background: "transparent",
                    border: "none",
                    fontSize: 15,
                    color: "rgba(255,255,255,0.8)",
                    outline: "none",
                    resize: "none",
                    lineHeight: 1.7,
                    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                />
              )}
            </div>

            {/* Footer with edit toggle */}
            <div style={{
              padding: "12px 32px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <button
                onClick={() => setDescPreview(false)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: !descPreview ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none", color: !descPreview ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                  cursor: "pointer",
                }}
              >Edit</button>
              <button
                onClick={() => setDescPreview(true)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: descPreview ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none", color: descPreview ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                  cursor: "pointer",
                }}
              >Read</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
                Esc to close
              </span>
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

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Card"
          message={`Are you sure you want to delete "${card.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { onDelete(card.id, columnId); onClose(); }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
