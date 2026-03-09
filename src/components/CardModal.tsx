import { useState, useEffect, useRef } from "react";
import { Card, CardLabel, CARD_LABELS, DARK_INK } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  card: Card;
  columnId: string;
  onSave: (card: Card) => void;
  onDelete: (cardId: string, columnId: string) => void;
  onClose: () => void;
}

export function CardModal({ card, columnId, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [label, setLabel] = useState<CardLabel | undefined>(card.label);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

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
    onSave({ ...card, title: title.trim(), description: description.trim(), label: label || undefined });
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
