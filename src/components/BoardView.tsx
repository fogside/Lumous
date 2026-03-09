import { useState, useCallback, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Board, Card as CardType, CardLabel, getBoardTheme, BoardTheme } from "../lib/types";
import { Column } from "./Column";
import { CardModal } from "./CardModal";
import { SparkleEffect, SparkleEvent } from "./SparkleEffect";
import { WizardCelebration } from "./WizardCelebration";
import { BackgroundWisps } from "./BackgroundWisps";
import { Sparkles } from "lucide-react";
import type { ViewMode } from "../hooks/useWindowSize";

interface Props {
  board: Board;
  moveCard: (cardId: string, fromCol: string, toCol: string, toIndex: number) => void;
  addCard: (columnId: string, title: string) => void;
  updateCard: (card: CardType) => void;
  deleteCard: (cardId: string, columnId: string) => void;
  onTitleChange?: (title: string) => void;
  mode?: ViewMode;
  showWisps?: boolean;
  onToggleWisps?: () => void;
}

function EditableTitle({ title, onSave, small, theme }: { title: string; onSave: (t: string) => void; small?: boolean; theme: BoardTheme }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(title); }, [title]);
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onSave(trimmed);
    else setValue(title);
    setEditing(false);
  };

  const fontSize = small ? 20 : 28;

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(title); setEditing(false); }
        }}
        onBlur={commit}
        data-no-drag
        style={{
          background: "transparent",
          fontSize,
          fontWeight: 700,
          color: theme.text,
          outline: "none",
          border: "none",
          borderBottom: `2px solid ${theme.textTertiary}`,
          padding: "2px 6px",
          width: "auto",
          minWidth: 100,
          maxWidth: 400,
        }}
        size={Math.max(value.length, 5)}
      />
    );
  }

  return (
    <h1
      data-no-drag
      onClick={() => setEditing(true)}
      style={{
        fontSize,
        fontWeight: 700,
        color: theme.text,
        cursor: "text",
        transition: "color 0.15s",
        margin: 0,
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 6,
      }}
      title="Click to rename"
    >
      {title}
    </h1>
  );
}

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("input") || target.closest("textarea") || target.closest("[data-no-drag]") || target.closest("[data-card]") || target.closest("[data-column-id]")) return;
  getCurrentWindow().startDragging();
}

export function BoardView({ board, moveCard, addCard, updateCard, deleteCard, onTitleChange, mode = "full", showWisps = true, onToggleWisps }: Props) {
  const [editingCard, setEditingCard] = useState<{ card: CardType; columnId: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<{ width: number; height: number } | null>(null);
  const [dragSourceCol, setDragSourceCol] = useState<string | null>(null);
  const [sparkleEvent, setSparkleEvent] = useState<SparkleEvent | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTab, setSelectedTab] = useState("today");

  const theme = getBoardTheme(board.backgroundColor);

  const handleLabelChange = useCallback((cardId: string, label: CardLabel) => {
    const card = board.cards[cardId];
    if (card) updateCard({ ...card, label });
  }, [board.cards, updateCard]);

  const isMedium = mode === "medium";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const findColumnForCard = useCallback(
    (cardId: string) => {
      return board.columns.find((col) => col.cardIds.includes(cardId));
    },
    [board]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = String(event.active.id);
    setActiveId(cardId);
    const col = findColumnForCard(cardId);
    setDragSourceCol(col?.id ?? null);
    const el = (event.active as unknown as { node: { current: HTMLElement | null } }).node?.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setActiveRect({ width: rect.width, height: rect.height });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);

    const fromCol = findColumnForCard(activeCardId);
    if (!fromCol) return;

    const overColumn = board.columns.find((c) => c.id === overId);
    const overCardCol = findColumnForCard(overId);
    const toCol = overColumn || overCardCol;

    if (!toCol || fromCol.id === toCol.id) return;

    const toIndex = overColumn
      ? toCol.cardIds.length
      : toCol.cardIds.indexOf(overId);

    moveCard(activeCardId, fromCol.id, toCol.id, Math.max(0, toIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveRect(null);

    if (!over) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);

    const currentCol = findColumnForCard(activeCardId);
    if (currentCol && dragSourceCol && currentCol.id !== dragSourceCol) {
      const rect = (event.activatorEvent.target as HTMLElement)?.getBoundingClientRect?.();
      const overRect = document.querySelector(`[data-column-id="${currentCol.id}"]`)?.getBoundingClientRect();
      const ref = overRect || rect;
      if (ref) {
        setSparkleEvent({
          x: ref.left + ref.width / 2,
          y: ref.top + 60,
          key: Date.now(),
        });
      }
      if (currentCol.id === "completed") {
        setWizardKey((k) => k + 1);
        setShowWizard(true);
        setTimeout(() => setShowWizard(false), 3000);
      }
    }
    setDragSourceCol(null);

    if (activeCardId === overId) return;

    const col = findColumnForCard(activeCardId);
    if (!col) return;

    const overIndex = col.cardIds.indexOf(overId);
    if (overIndex !== -1) {
      moveCard(activeCardId, col.id, col.id, overIndex);
    }
  };

  const activeCard = activeId ? board.cards[activeId] : null;

  // In medium mode, filter to selected tab only
  const visibleColumns = isMedium
    ? board.columns.filter((c) => c.id === selectedTab)
    : board.columns;

  const headerPad = isMedium ? "32px 20px 12px 20px" : "44px 48px 28px 48px";
  const bodyPad = isMedium ? "0 12px 20px 12px" : "0 20px 20px 20px";

  return (
    <div
      onMouseDown={startWindowDrag}
      className="board-view"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        transition: "background-color 0.3s",
        backgroundColor: board.backgroundColor,
        position: "relative",
      }}
    >
      <BackgroundWisps boardColor={board.backgroundColor} isLight={theme.isLight} visible={showWisps} />

      {/* Wisps toggle — top right corner, always visible */}
      {!theme.isLight && onToggleWisps && (
        <button
          onClick={onToggleWisps}
          title={showWisps ? "Hide wisps" : "Show wisps"}
          data-no-drag
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            zIndex: 2,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: showWisps ? theme.textSecondary : theme.textTertiary,
            opacity: showWisps ? 0.8 : 0.5,
            transition: "all 0.3s",
            padding: 0,
          }}
        >
          <Sparkles size={14} strokeWidth={1.5} />
        </button>
      )}

      {/* Board header */}
      <div onMouseDown={startWindowDrag} style={{ padding: headerPad }}>
        <EditableTitle
          title={board.title}
          onSave={(t) => onTitleChange?.(t)}
          small={isMedium}
          theme={theme}
        />
      </div>

      {/* Tab bar for medium mode */}
      {isMedium && (
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "0 12px 8px 12px",
            overflowX: "auto",
          }}
        >
          {board.columns.map((col) => {
            const isActive = col.id === selectedTab;
            const count = col.cardIds.length;
            return (
              <button
                key={col.id}
                onClick={() => setSelectedTab(col.id)}
                data-no-drag
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? theme.surfaceHover : "transparent",
                  color: isActive ? theme.text : theme.textTertiary,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {col.title}
                {count > 0 && (
                  <span style={{
                    fontSize: 9,
                    opacity: 0.5,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Columns area */}
      <div style={{ flex: 1, overflowX: isMedium ? "hidden" : "auto", padding: bodyPad }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: "flex", gap: 12, height: "100%" }}>
            {visibleColumns.map((column) => {
              const cards = column.cardIds
                .map((id) => board.cards[id])
                .filter(Boolean);
              return (
                <Column
                  key={column.id}
                  column={column}
                  cards={cards}
                  solo={isMedium}
                  onAddCard={(title) => addCard(column.id, title)}
                  onCardClick={(card) => setEditingCard({ card, columnId: column.id })}
                  onLabelChange={handleLabelChange}
                  boardColor={board.backgroundColor}
                  theme={theme}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeCard && (
              <div style={{
                borderRadius: 14,
                padding: "16px 20px",
                background: theme.overlay,
                backdropFilter: "blur(12px)",
                border: `1px solid ${theme.border}`,
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                width: activeRect?.width,
                boxSizing: "border-box",
                overflow: "hidden",
              }}>
                <p style={{ fontSize: 15, color: theme.text, fontWeight: 500, margin: 0 }}>
                  {activeCard.title}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <SparkleEffect event={sparkleEvent} boardColor={board.backgroundColor} />
      <WizardCelebration key={wizardKey} visible={showWizard} boardColor={board.backgroundColor} />

      {editingCard && (
        <CardModal
          card={editingCard.card}
          columnId={editingCard.columnId}
          onSave={updateCard}
          onDelete={deleteCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
