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
  acceptProposal?: (cardId: string) => void;
  rejectProposal?: (cardId: string) => void;
  acceptAllProposals?: () => void;
  rejectAllProposals?: () => void;
  clearHighlights?: () => void;
  onOpenMagician?: () => void;
  onStartResearch?: (card: CardType, context: string) => void;
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

export function BoardView({ board, moveCard, addCard, updateCard, deleteCard, onTitleChange, mode = "full", showWisps = true, acceptProposal, rejectProposal, acceptAllProposals, rejectAllProposals, clearHighlights, onOpenMagician, onStartResearch }: Props) {
  const [editingCard, setEditingCard] = useState<{ card: CardType; columnId: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<{ width: number; height: number } | null>(null);
  const [dragSourceCol, setDragSourceCol] = useState<string | null>(null);
  const [sparkleEvent, setSparkleEvent] = useState<SparkleEvent | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTab, setSelectedTab] = useState("today");

  const theme = getBoardTheme(board.backgroundColor);

  const proposalCount = Object.values(board.cards).filter((c) => c.proposed).length;
  const highlightCount = Object.values(board.cards).filter((c) => c.highlighted).length;
  const hasWizardSuggestions = proposalCount > 0 || highlightCount > 0;

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

      {/* Board header */}
      <div onMouseDown={startWindowDrag} style={{ padding: headerPad, display: "flex", alignItems: "center", gap: 10 }}>
        <EditableTitle
          title={board.title}
          onSave={(t) => onTitleChange?.(t)}
          small={isMedium}
          theme={theme}
        />
        {onOpenMagician && (
          <button
            onClick={onOpenMagician}
            data-no-drag
            title="Ask the Wizard"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: theme.textTertiary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
              flexShrink: 0,
              opacity: 0.6,
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

      {/* Wizard suggestion bar */}
      {hasWizardSuggestions && (
        <div
          data-no-drag
          style={{
            margin: isMedium ? "0 12px 8px 12px" : "0 20px 12px 20px",
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(180,138,192,0.08)",
            border: "1px solid rgba(180,138,192,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>{"🧙"}</span>
          <span style={{ fontSize: 13, color: theme.text, fontWeight: 500, flex: 1 }}>
            {proposalCount > 0 && `${proposalCount} suggestion${proposalCount > 1 ? "s" : ""}`}
            {proposalCount > 0 && highlightCount > 0 && " · "}
            {highlightCount > 0 && `${highlightCount} highlighted`}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {proposalCount > 0 && (
              <>
                <button
                  onClick={acceptAllProposals}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(100,200,100,0.9)",
                    background: "rgba(100,200,100,0.1)",
                    border: "1px solid rgba(100,200,100,0.2)",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Accept all
                </button>
                <button
                  onClick={rejectAllProposals}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: theme.textSecondary,
                    background: "transparent",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Dismiss all
                </button>
              </>
            )}
            {highlightCount > 0 && proposalCount === 0 && (
              <button
                onClick={clearHighlights}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: theme.textSecondary,
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Clear highlights
              </button>
            )}
          </div>
        </div>
      )}

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
              const cards = [...new Set(column.cardIds)]
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
                  goals={board.goals}
                  onAcceptProposal={acceptProposal}
                  onRejectProposal={rejectProposal}
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
          card={board.cards[editingCard.card.id] || editingCard.card}
          columnId={editingCard.columnId}
          goals={board.goals}
          onSave={updateCard}
          onDelete={deleteCard}
          onClose={() => setEditingCard(null)}
          onStartResearch={onStartResearch}
        />
      )}
    </div>
  );
}
