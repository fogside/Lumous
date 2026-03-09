import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card as CardType } from "../lib/types";

interface Props {
  card: CardType;
  columnId: string;
  onClick: () => void;
  faded?: boolean;
}

export function Card({ card, onClick, faded }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 10,
        cursor: "grab",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
        opacity: isDragging ? 0.4 : faded ? 0.4 : 1,
        userSelect: "none",
      }}
      data-no-drag
      data-card
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, fontWeight: 500, margin: 0 }}>
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
    </div>
  );
}
