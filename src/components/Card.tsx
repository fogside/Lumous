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
  onAcceptProposal?: (cardId: string) => void;
  onRejectProposal?: (cardId: string) => void;
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

// Wizard theme color for proposed cards
const WIZARD_PURPLE = "#b48ac0";
const WIZARD_GOLD = "#e0c55a";

export function Card({ card, onClick, onLabelChange, faded, boardColor, theme, solo, goals, onAcceptProposal, onRejectProposal }: Props) {
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
  const isProposed = !!card.proposed;
  const isHighlighted = !!card.highlighted;

  // Compute border style
  const borderStyle = isProposed
    ? `2px dashed ${WIZARD_PURPLE}50`
    : isHighlighted
      ? `1px solid ${WIZARD_GOLD}40`
      : theme.isLight
        ? "none"
        : card.label && labelColor
          ? `1px solid ${labelColor}30`
          : `1px solid ${theme.border}`;

  // Compute background
  const bgStyle = isProposed
    ? `linear-gradient(135deg, ${theme.surface} 60%, ${WIZARD_PURPLE}10 100%)`
    : isHighlighted
      ? `linear-gradient(135deg, ${theme.surface} 60%, ${WIZARD_GOLD}12 100%)`
      : !theme.isLight && card.label && labelColor
        ? `linear-gradient(135deg, ${theme.surface} 50%, ${labelColor}18 100%)`
        : theme.surface;

  return (
    <div
      ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: [transition, "opacity 0.15s"].filter(Boolean).join(", "),
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 8,
        cursor: isProposed ? "default" : "grab",
        background: bgStyle,
        border: borderStyle,
        opacity: isDragging ? 0.4 : faded ? 0.4 : isProposed ? 0.85 : 1,
        overflow: "visible",
        userSelect: "none",
        position: "relative",
      }}
      data-no-drag
      data-card
      {...(isProposed ? {} : attributes)}
      {...(isProposed ? {} : listeners)}
      onClick={isProposed ? undefined : onClick}
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

      {/* Highlighted card glow */}
      {isHighlighted && (
        <div style={{
          position: "absolute",
          inset: -1,
          borderRadius: "inherit",
          pointerEvents: "none",
          filter: `drop-shadow(0 0 8px ${WIZARD_GOLD}30)`,
          animation: "wizard-pulse 2s ease-in-out infinite",
        }} />
      )}

      {/* Proposed card: accept/reject buttons */}
      {isProposed && (
        <div style={{
          position: "absolute",
          top: 5,
          right: 5,
          display: "flex",
          gap: 4,
          zIndex: 2,
        }}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAcceptProposal?.(card.id); }}
            title="Accept suggestion"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "none",
              background: "rgba(100,200,100,0.15)",
              color: "rgba(100,200,100,0.8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              padding: 0,
              transition: "all 0.15s",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRejectProposal?.(card.id); }}
            title="Dismiss suggestion"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "none",
              background: "rgba(220,80,80,0.1)",
              color: "rgba(220,80,80,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              padding: 0,
              transition: "all 0.15s",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Crescent label button — hidden on proposed cards */}
      {!isProposed && (
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
      )}

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
      {/* Wizard reasoning / highlight reason */}
      {isProposed && card.proposedReasoning && (
        <p style={{
          fontSize: 12,
          color: theme.isLight ? "rgba(120,70,140,0.85)" : "rgba(200,170,220,0.85)",
          marginTop: 6,
          lineHeight: 1.4,
          fontStyle: "italic",
          margin: "6px 0 0 0",
        }}>
          {card.proposedReasoning}
        </p>
      )}
      {isHighlighted && card.highlightReason && (
        <p style={{
          fontSize: 12,
          color: theme.isLight ? "rgba(140,110,30,0.85)" : "rgba(230,210,120,0.85)",
          marginTop: 6,
          lineHeight: 1.4,
          fontStyle: "italic",
          margin: "6px 0 0 0",
        }}>
          {card.highlightReason}
        </p>
      )}

      <span style={{ fontSize: 11, color: theme.textTertiary, marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontWeight: 400 }}>
        {card.research?.status === "running" && (
          <span style={{ animation: "wizard-spin 1s linear infinite", display: "inline-block", fontSize: 11, color: "rgba(180,138,192,0.6)" }}>{"✦"}</span>
        )}
        {card.research?.status === "done" && (
          <span style={{ fontSize: 11, color: "rgba(180,138,192,0.5)" }}>{"✦"}</span>
        )}
        {card.timeEstimate && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 5,
            background: theme.isLight ? "rgba(120,70,140,0.1)" : "rgba(180,138,192,0.12)",
            color: theme.isLight ? "rgba(120,70,140,0.75)" : "rgba(200,170,220,0.8)",
            letterSpacing: "0.02em",
          }}>
            {card.timeEstimate}
          </span>
        )}
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
        @keyframes wizard-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes wizard-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
