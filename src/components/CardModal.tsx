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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="border border-white/10 rounded-3xl w-[500px] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "28px 32px", background: DARK_INK }}
      >
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
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            fontSize: 22,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            outline: "none",
            paddingBottom: 14,
            marginBottom: 20,
            resize: "none",
            lineHeight: 1.4,
            overflow: "hidden",
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          Description
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Add a description..."
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 14,
            color: "rgba(255,255,255,0.8)",
            outline: "none",
            resize: "none",
            lineHeight: 1.6,
          }}
        />

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
            Label
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {CARD_LABELS.map((l) => (
              <button
                key={l.name}
                onClick={() => setLabel(l.value)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: (label || null) === l.value ? "2px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.1)",
                  background: l.value ? l.color : "rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                }}
                title={l.name}
              >
                {!l.value && "×"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Repeat ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: ritualEnabled ? 10 : 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Repeat
            </span>
            <button
              onClick={() => setRitualEnabled(!ritualEnabled)}
              style={{
                width: 34, height: 18, borderRadius: 9, border: "none",
                background: ritualEnabled ? "rgba(124,196,138,0.5)" : "rgba(255,255,255,0.1)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Schedule presets + custom days */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setRitualSchedule("daily")}
                  style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: ritualSchedule === "daily" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                    border: ritualSchedule === "daily" ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    color: ritualSchedule === "daily" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  Every day
                </button>
                <button
                  onClick={() => setRitualSchedule([1, 2, 3, 4, 5])}
                  style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: Array.isArray(ritualSchedule) && ritualSchedule.join() === "1,2,3,4,5" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                    border: Array.isArray(ritualSchedule) && ritualSchedule.join() === "1,2,3,4,5" ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    color: Array.isArray(ritualSchedule) && ritualSchedule.join() === "1,2,3,4,5" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  Weekdays
                </button>
              </div>

              {/* Individual day pills */}
              <div style={{ display: "flex", gap: 4 }}>
                {DAY_NAMES.map((name, i) => {
                  const isActive = ritualSchedule === "daily" || (Array.isArray(ritualSchedule) && ritualSchedule.includes(i));
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        // Switch to custom array mode
                        let current: number[];
                        if (ritualSchedule === "daily") current = [0, 1, 2, 3, 4, 5, 6];
                        else current = [...ritualSchedule];
                        if (current.includes(i)) {
                          current = current.filter((d) => d !== i);
                          if (current.length === 0) current = [i]; // keep at least one
                        } else {
                          current.push(i);
                          current.sort();
                        }
                        if (current.length === 7) setRitualSchedule("daily");
                        else setRitualSchedule(current);
                      }}
                      style={{
                        width: 32, height: 28, borderRadius: 7, fontSize: 10, fontWeight: 700,
                        cursor: "pointer",
                        background: isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                        border: isActive ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                        color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)",
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

        {/* ── Goal (independent from repeat) ── */}
        {goals && goals.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Goal
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setGoalId(undefined)}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: !goalId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: !goalId ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                  color: !goalId ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
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
                    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: goalId === g.id ? `${g.color}25` : "rgba(255,255,255,0.04)",
                    border: goalId === g.id ? `1px solid ${g.color}50` : "1px solid rgba(255,255,255,0.06)",
                    color: goalId === g.id ? g.color : "rgba(255,255,255,0.3)",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: g.color, flexShrink: 0 }} />
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(220,80,80,0.7)",
              background: "rgba(220,80,80,0.06)",
              border: "1px solid rgba(220,80,80,0.15)",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Delete card
          </button>
          <div style={{ display: "flex", gap: 12 }}>
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
            <button
              onClick={handleSave}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                cursor: "pointer",
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
