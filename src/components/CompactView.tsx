import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Board, Card, CardLabel, CARD_LABELS, BoardTheme, getBoardTheme, DARK_INK } from "../lib/types";

interface Props {
  board: Board;
  moveCard: (cardId: string, fromCol: string, toCol: string, toIndex: number) => void;
  addCard: (columnId: string, title: string) => void;
  updateCard: (card: Card) => void;
}

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "button") return;
  if (target.closest("button") || target.closest("input")) return;
  getCurrentWindow().startDragging();
}

function CompactLabelBar({ current, theme, onChange }: {
  current: CardLabel | undefined;
  theme: BoardTheme;
  onChange: (label: CardLabel) => void;
}) {
  return (
    <div style={{
      display: "flex",
      gap: 3,
      padding: "2px 0 4px 30px",
    }}>
      {CARD_LABELS.map((l) => (
        <button
          key={l.name}
          onClick={(e) => { e.stopPropagation(); onChange(l.value); }}
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            border: (current || null) === l.value ? `2px solid ${theme.text}` : "none",
            background: l.value ? l.color : theme.surface,
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: theme.textSecondary,
            opacity: (current || null) === l.value ? 1 : 0.6,
            transition: "opacity 0.1s",
          }}
          title={l.name}
        >
          {!l.value && "×"}
        </button>
      ))}
    </div>
  );
}

function CompactCard({
  card,
  onComplete,
  onLabelChange,
  theme,
}: {
  card: Card;
  onComplete: () => void;
  onLabelChange: (label: CardLabel) => void;
  theme: BoardTheme;
}) {
  const [checked, setChecked] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const labelColor = CARD_LABELS.find((l) => l.value === card.label)?.color;

  const handleCheck = () => {
    setChecked(true);
    setTimeout(onComplete, 350);
  };

  return (
    <div
      style={{
        padding: "6px 0",
        borderBottom: `1px solid ${theme.borderSubtle}`,
        opacity: checked ? 0.3 : 1,
        transition: "opacity 0.3s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "4px 0",
        }}
      >
        <button
          onClick={handleCheck}
          style={{
            width: 20,
            height: 20,
            minWidth: 20,
            borderRadius: 6,
            border: checked
              ? "2px solid #CD9B3C"
              : `2px solid ${theme.textTertiary}`,
            background: checked ? "#CD9B3C" : "transparent",
            cursor: "pointer",
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          {checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke={DARK_INK}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <span
          onClick={() => setShowLabels(!showLabels)}
          style={{
            flex: 1,
            fontSize: 14,
            color: checked ? theme.textTertiary : theme.text,
            lineHeight: 1.4,
            fontWeight: 500,
            textDecoration: checked ? "line-through" : "none",
            transition: "all 0.3s",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            cursor: "pointer",
          }}
        >
          {card.title}
        </span>
        {card.label && labelColor && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 3,
            background: labelColor,
            flexShrink: 0,
            marginTop: 5,
          }} />
        )}
      </div>
      {showLabels && (
        <CompactLabelBar
          current={card.label}
          theme={theme}
          onChange={(label) => { onLabelChange(label); setShowLabels(false); }}
        />
      )}
    </div>
  );
}

export function CompactView({ board, moveCard, addCard, updateCard }: Props) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = getBoardTheme(board.backgroundColor);

  const todayCol = board.columns.find((c) => c.id === "today");
  const todayCards = todayCol
    ? todayCol.cardIds.map((id) => board.cards[id]).filter(Boolean)
    : [];

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    addCard("today", trimmed);
    setInputValue("");
  };

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      onMouseDown={startWindowDrag}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: board.backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Compact header */}
      <div
        style={{
          padding: "32px 16px 8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 4,
            backgroundColor: board.backgroundColor,
            border: `1px solid ${theme.textTertiary}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: theme.textSecondary,
          }}
        >
          Today
        </span>
        <span
          style={{
            fontSize: 11,
            color: theme.textTertiary,
            fontWeight: 600,
            marginLeft: "auto",
          }}
        >
          {todayCards.length}
        </span>
      </div>

      {/* Add input */}
      <div style={{ padding: "8px 16px" }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="+ Add task"
          data-no-drag
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${theme.borderSubtle}`,
            background: theme.surface,
            color: theme.text,
            fontSize: 13,
            fontWeight: 500,
            outline: "none",
          }}
        />
      </div>

      {/* Task list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 16px 16px 16px",
        }}
      >
        {todayCards.map((card) => (
          <CompactCard
            key={card.id}
            card={card}
            onComplete={() => moveCard(card.id, "today", "completed", 0)}
            onLabelChange={(label) => updateCard({ ...card, label })}
            theme={theme}
          />
        ))}
        {todayCards.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: theme.textFaint,
              fontSize: 12,
              padding: "32px 0",
              fontWeight: 500,
            }}
          >
            No tasks for today
          </div>
        )}
      </div>
    </div>
  );
}
