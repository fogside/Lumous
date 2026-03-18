import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card as CardType, CardLabel, CARD_LABELS, BoardTheme, Goal } from "../lib/types";

interface Props {
  card: CardType;
  columnId: string;
  onClick: () => void;
  onLabelChange: (cardId: string, label: CardLabel) => void;
  faded?: boolean;
  boardColor?: string;
  theme: BoardTheme;
  solo?: boolean;
  goals?: Goal[];
}

function LabelPicker({ anchor, current, boardColor, theme, onChange, onClose }: { anchor: DOMRect; current: CardLabel | undefined; boardColor?: string; theme: BoardTheme; onChange: (l: CardLabel) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pickerWidth = 32;
  const fitsRight = anchor.right + 6 + pickerWidth < window.innerWidth;
  const fitsLeft = anchor.left - 6 - pickerWidth > 0;
  const horizontal = !fitsRight && !fitsLeft;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const position: React.CSSProperties = horizontal
    ? { top: anchor.top - 32, left: anchor.left }
    : fitsRight
      ? { top: anchor.top, left: anchor.right + 6 }
      : { top: anchor.top, left: anchor.left - 6 - pickerWidth };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        ...position,
        background: boardColor ? `${boardColor}dd` : "rgba(12,12,20,0.9)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: 6,
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        gap: 4,
        zIndex: 9999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
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
            border: (current || null) === l.value ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
            background: l.value ? l.color : theme.surface,
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: theme.textSecondary,
          }}
          title={l.name}
        >
          {!l.value && "×"}
        </button>
      ))}
    </div>,
    document.body
  );
}

export function Card({ card, onClick, onLabelChange, faded, boardColor, theme, solo, goals }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const labelColor = CARD_LABELS.find((l) => l.value === card.label)?.color;
  const goalColor = card.goalId && goals ? goals.find((g) => g.id === card.goalId)?.color : undefined;

  return (
    <div
      ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: [transition, "opacity 0.15s"].filter(Boolean).join(", "),
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 8,
        cursor: "grab",
        background: !theme.isLight && card.label && labelColor
          ? `linear-gradient(135deg, ${theme.surface} 50%, ${labelColor}18 100%)`
          : theme.surface,
        border: theme.isLight
          ? "none"
          : card.label && labelColor
            ? `1px solid ${labelColor}30`
            : `1px solid ${theme.border}`,
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
      {/* Clipped glow container — isolation forces own compositing layer
         so overflow:hidden+borderRadius clip survives parent transform */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
        pointerEvents: "none",
        isolation: "isolate",
      }}>
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: labelColor || "transparent",
          opacity: card.label ? 0.4 : 0,
          filter: "blur(18px)",
          transition: "opacity 0.15s",
        }} />
      </div>

      {/* Crescent label button */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!showPicker && cardRef.current) {
            setPickerAnchor(cardRef.current.getBoundingClientRect());
          }
          setShowPicker(!showPicker);
        }}
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
          <circle cx="10" cy="10" r="8" fill={card.label ? labelColor : theme.textTertiary} mask={`url(#moon-${card.id})`} />
        </svg>
      </button>

      {showPicker && !solo && pickerAnchor && (
        <LabelPicker
          anchor={pickerAnchor}
          current={card.label}
          boardColor={boardColor}
          theme={theme}
          onChange={(label) => onLabelChange(card.id, label)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showPicker && solo && (
        <div style={{
          display: "flex",
          gap: 4,
          marginBottom: 8,
          flexWrap: "wrap",
        }}>
          {CARD_LABELS.map((l) => (
            <button
              key={l.name}
              onClick={(e) => { e.stopPropagation(); onLabelChange(card.id, l.value); setShowPicker(false); }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: (card.label || null) === l.value ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
                background: l.value ? l.color : theme.surface,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: theme.textSecondary,
              }}
              title={l.name}
              data-no-drag
            >
              {!l.value && "×"}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 15, color: theme.text, lineHeight: 1.5, fontWeight: 500, margin: 0, paddingRight: 18, overflowWrap: "break-word", wordBreak: "break-word" }}>
        {card.title}
      </p>
      {card.description && (
        <p style={{
          fontSize: 13,
          color: theme.textSecondary,
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
      <span style={{ fontSize: 11, color: theme.textTertiary, marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontWeight: 400 }}>
        {goalColor && (
          <span style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: goalColor,
            flexShrink: 0,
            opacity: 0.85,
          }} />
        )}
        {card.ritual && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
            <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        )}
        {faded && card.completedAt
          ? `Done ${new Date(card.completedAt).toLocaleDateString()}`
          : new Date(card.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        }
      </span>

      <style>{`
        [data-card] { transition: background 0.15s; }
        [data-card]:hover { background: ${theme.surfaceHover} !important; }
        [data-card] .card-label-btn { opacity: 0; }
        [data-card]:hover .card-label-btn { opacity: 0.5; }
        [data-card] .card-label-btn.has-label { opacity: 0.8; }
        [data-card]:hover .card-label-btn.has-label { opacity: 1; }
      `}</style>
    </div>
  );
}
