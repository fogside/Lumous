import { useState, useEffect, useRef } from "react";
import { Card, CardLabel, CARD_LABELS, DARK_INK, Goal, RitualSchedule } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  card: Card;
  columnId: string;
  goals?: Goal[];
  onSave: (card: Card) => void;
  onDelete: (cardId: string, columnId: string) => void;
  onClose: () => void;
}

export function CardModal({ card, columnId, goals, onSave, onDelete, onClose }: Props) {
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

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
    });
    onClose();
  };

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

          {/* Description — auto-grows with content */}
          <div style={{ marginTop: 16 }}>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              ref={(el) => {
                // Set initial height based on content
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
                  onClick={() => setLabel(l.value)}
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
                onClick={() => setRitualEnabled(!ritualEnabled)}
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
                  onClick={() => setGoalId(undefined)}
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
                    onClick={() => setGoalId(g.id)}
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
