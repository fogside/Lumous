import { useState, useCallback, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Board, Card as CardType } from "../lib/types";
import { useBoard } from "../hooks/useBoard";
import { Column } from "./Column";
import { CardModal } from "./CardModal";

interface Props {
  initialBoard: Board;
  onTitleChange?: (title: string) => void;
}

function EditableTitle({ title, onSave }: { title: string; onSave: (t: string) => void }) {
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
          fontSize: 28,
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          outline: "none",
          border: "none",
          borderBottom: "2px solid rgba(255,255,255,0.25)",
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
        fontSize: 28,
        fontWeight: 700,
        color: "rgba(255,255,255,0.9)",
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

// Start window drag on non-interactive areas (no preventDefault — Tauri needs the native event)
function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("input") || target.closest("textarea") || target.closest("[data-no-drag]") || target.closest("[data-card]")) return;
  getCurrentWindow().startDragging();
}

export function BoardView({ initialBoard, onTitleChange }: Props) {
  const { board, moveCard, addCard, updateCard, deleteCard } = useBoard(initialBoard);
  const [editingCard, setEditingCard] = useState<{ card: CardType; columnId: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findColumnForCard = useCallback(
    (cardId: string) => {
      if (!board) return null;
      return board.columns.find((col) => col.cardIds.includes(cardId));
    },
    [board]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!board) return;
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

    if (!board || !over) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);

    if (activeCardId === overId) return;

    const col = findColumnForCard(activeCardId);
    if (!col) return;

    const overIndex = col.cardIds.indexOf(overId);
    if (overIndex !== -1) {
      moveCard(activeCardId, col.id, col.id, overIndex);
    }
  };

  if (!board) return null;

  const activeCard = activeId ? board.cards[activeId] : null;

  return (
    <div
      onMouseDown={startWindowDrag}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        transition: "background-color 0.3s",
        backgroundColor: board.backgroundColor,
      }}
    >
      {/* Board header — draggable (outside DndContext, so always works) */}
      <div onMouseDown={startWindowDrag} style={{ padding: "44px 48px 28px 48px" }}>
        <EditableTitle
          title={board.title}
          onSave={(t) => onTitleChange?.(t)}
        />
      </div>

      {/* Columns area */}
      <div style={{ flex: 1, overflowX: "auto", padding: "0 40px 40px 40px" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: "flex", gap: 20, height: "100%" }}>
            {board.columns.map((column) => {
              const cards = column.cardIds
                .map((id) => board.cards[id])
                .filter(Boolean);
              return (
                <Column
                  key={column.id}
                  column={column}
                  cards={cards}
                  onAddCard={(title) => addCard(column.id, title)}
                  onCardClick={(card) => setEditingCard({ card, columnId: column.id })}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeCard && (
              <div style={{
                borderRadius: 14,
                padding: "16px 20px",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                width: 240,
              }}>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", fontWeight: 500, margin: 0 }}>
                  {activeCard.title}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit modal */}
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
