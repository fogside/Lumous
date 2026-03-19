import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Column as ColumnType, Card as CardType, CardLabel, BoardTheme, Goal } from "../lib/types";
import { Card } from "./Card";
import { NewCardInput } from "./NewCardInput";

interface Props {
  column: ColumnType;
  cards: CardType[];
  onAddCard: (title: string) => void;
  onCardClick: (card: CardType) => void;
  onLabelChange: (cardId: string, label: CardLabel) => void;
  solo?: boolean;
  boardColor?: string;
  theme: BoardTheme;
  goals?: Goal[];
  onAcceptProposal?: (cardId: string) => void;
  onRejectProposal?: (cardId: string) => void;
}

export function Column({ column, cards, onAddCard, onCardClick, onLabelChange, solo, boardColor, theme, goals, onAcceptProposal, onRejectProposal }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const isCompleted = column.id === "completed";
  const shrink = isCompleted && !solo;

  return (
    <div
      data-column-id={column.id}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: shrink ? "0.5 1 0" : "1 1 0",
        minWidth: shrink ? 160 : 200,
        minHeight: 0,
        opacity: shrink ? 0.45 : 1,
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
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.textSecondary }}>
          {column.title}
        </span>
        <span style={{ fontSize: 11, color: theme.textTertiary, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            borderRadius: 16,
            padding: 10,
            transition: "all 0.2s",
            background: isOver ? theme.surfaceHover : theme.surfaceFaint,
            outline: isOver ? `1px solid ${theme.border}` : "none",
          }}
        >
          {/* Add card at top */}
          <div style={{ marginBottom: 12 }}>
            <NewCardInput onAdd={onAddCard} theme={theme} />
          </div>

          {/* Cards */}
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              columnId={column.id}
              onClick={() => onCardClick(card)}
              onLabelChange={onLabelChange}
              faded={isCompleted}
              boardColor={boardColor}
              theme={theme}
              solo={solo}
              goals={goals}
              onAcceptProposal={onAcceptProposal}
              onRejectProposal={onRejectProposal}
            />
          ))}

          {cards.length === 0 && (
            <div style={{ textAlign: "center", color: theme.textFaint, fontSize: 12, padding: "32px 0", fontWeight: 500 }}>
              No tasks yet
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
