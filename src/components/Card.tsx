import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card as CardType, CardLabel, CARD_LABELS } from "../lib/types";

interface Props {
  card: CardType;
  columnId: string;
  onClick: () => void;
  onLabelChange: (cardId: string, label: CardLabel) => void;
  faded?: boolean;
}

function LabelPicker({ current, onChange, onClose }: { current: CardLabel | undefined; onChange: (l: CardLabel) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        background: "#0c0c14",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: 6,
        display: "flex",
        gap: 4,
        zIndex: 20,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {CARD_LABELS.map((l) => (
        <button
          key={l.name}
          onClick={(e) => { e.stopPropagation(); onChange(l.value); onClose(); }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: (current || null) === l.value ? "2px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.1)",
            background: l.value ? l.color : "rgba(255,255,255,0.06)",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
          }}
          title={l.name}
        >
          {!l.value && "×"}
        </button>
      ))}
    </div>
  );
}

export function Card({ card, onClick, onLabelChange, faded }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const labelColor = CARD_LABELS.find((l) => l.value === card.label)?.color;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 8,
        cursor: "grab",
        background: card.label && labelColor
          ? `linear-gradient(135deg, rgba(255,255,255,0.08) 50%, ${labelColor}18 100%)`
          : "rgba(255,255,255,0.08)",
        border: card.label && labelColor
          ? `1px solid ${labelColor}30`
          : "1px solid rgba(255,255,255,0.08)",
        opacity: isDragging ? 0.4 : faded ? 0.4 : 1,
        overflow: "visible",
        userSelect: "none",
        position: "relative",
      }}
      data-no-drag
      data-card
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {/* Blurred color splash for label */}
      {card.label && labelColor && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: labelColor,
          opacity: 0.4,
          filter: "blur(18px)",
          pointerEvents: "none",
        }} />
      )}

      {/* Crescent label button */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          width: 20,
          height: 20,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          transition: "opacity 0.15s",
        }}
        className={`card-label-btn${card.label ? " has-label" : ""}`}
        data-no-drag
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <mask id={`moon-${card.id}`}>
            <circle cx="10" cy="10" r="8" fill="white" />
            <circle cx="14" cy="9" r="6.5" fill="black" />
          </mask>
          <circle cx="10" cy="10" r="8" fill={card.label ? labelColor : "rgba(255,255,255,0.2)"} mask={`url(#moon-${card.id})`} />
        </svg>
      </button>

      {showPicker && (
        <LabelPicker
          current={card.label}
          onChange={(label) => onLabelChange(card.id, label)}
          onClose={() => setShowPicker(false)}
        />
      )}

      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, fontWeight: 500, margin: 0, paddingRight: 18, overflowWrap: "break-word", wordBreak: "break-word" }}>
        {card.title}
      </p>
      {card.description && (
        <p style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.35)",
          marginTop: 8,
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {card.description}
        </p>
      )}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8, display: "block", fontWeight: 400 }}>
        {faded && card.completedAt
          ? `Done ${new Date(card.completedAt).toLocaleDateString()}`
          : new Date(card.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        }
      </span>

      <style>{`
        [data-card] .card-label-btn { opacity: 0; }
        [data-card]:hover .card-label-btn { opacity: 0.5; }
        [data-card] .card-label-btn.has-label { opacity: 0.8; }
        [data-card]:hover .card-label-btn.has-label { opacity: 1; }
      `}</style>
    </div>
  );
}
