import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Column as ColumnType, Card as CardType } from "../lib/types";
import { Card } from "./Card";
import { NewCardInput } from "./NewCardInput";

interface Props {
  column: ColumnType;
  cards: CardType[];
  onAddCard: (title: string) => void;
  onCardClick: (card: CardType) => void;
}

export function Column({ column, cards, onAddCard, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const isCompleted = column.id === "completed";

  return (
    <div
      data-column-id={column.id}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0",
        minWidth: 200,
        opacity: isCompleted ? 0.45 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {/* Column header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 8px 12px 8px",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>
          {column.title}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            flex: 1,
            borderRadius: 20,
            padding: 14,
            minHeight: 140,
            transition: "all 0.2s",
            background: isOver ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
            outline: isOver ? "1px solid rgba(255,255,255,0.12)" : "none",
          }}
        >
          {/* Add card at top */}
          <div style={{ marginBottom: 12 }}>
            <NewCardInput onAdd={onAddCard} />
          </div>

          {/* Cards */}
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              columnId={column.id}
              onClick={() => onCardClick(card)}
              faded={isCompleted}
            />
          ))}

          {cards.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.1)", fontSize: 12, padding: "32px 0", fontWeight: 500 }}>
              No tasks yet
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
