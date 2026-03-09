import { useReducer, useCallback, useEffect, useRef } from "react";
import { Board, Card, createCard } from "../lib/types";
import { saveBoard } from "../lib/storage";

type Action =
  | { type: "SET_BOARD"; board: Board }
  | { type: "MOVE_CARD"; cardId: string; fromCol: string; toCol: string; toIndex: number }
  | { type: "ADD_CARD"; columnId: string; title: string }
  | { type: "UPDATE_CARD"; card: Card }
  | { type: "DELETE_CARD"; cardId: string; columnId: string };

function boardReducer(state: Board | null, action: Action): Board | null {
  if (action.type === "SET_BOARD") return action.board;
  if (!state) return state;

  switch (action.type) {
    case "MOVE_CARD": {
      const { cardId, fromCol, toCol, toIndex } = action;
      const columns = state.columns.map((col) => {
        if (fromCol === toCol && col.id === fromCol) {
          // Same-column reorder
          const ids = col.cardIds.filter((id) => id !== cardId);
          ids.splice(toIndex, 0, cardId);
          return { ...col, cardIds: ids };
        }
        if (col.id === fromCol) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === toCol) {
          const ids = col.cardIds.filter((id) => id !== cardId);
          ids.splice(toIndex, 0, cardId);
          return { ...col, cardIds: ids };
        }
        return col;
      });

      const cards = { ...state.cards };
      let completionLog = state.completionLog || [];
      if (toCol === "completed" && fromCol !== "completed" && cards[cardId]) {
        const now = new Date().toISOString();
        cards[cardId] = { ...cards[cardId], completedAt: now };
        completionLog = [...completionLog, now];
      } else if (fromCol === "completed" && toCol !== "completed" && cards[cardId]) {
        cards[cardId] = { ...cards[cardId], completedAt: null };
      }

      return { ...state, columns, cards, completionLog };
    }

    case "ADD_CARD": {
      const card = createCard(action.title);
      const columns = state.columns.map((col) => {
        if (col.id === action.columnId) {
          return { ...col, cardIds: [card.id, ...col.cardIds] };
        }
        return col;
      });
      return {
        ...state,
        columns,
        cards: { ...state.cards, [card.id]: card },
      };
    }

    case "UPDATE_CARD": {
      return {
        ...state,
        cards: { ...state.cards, [action.card.id]: action.card },
      };
    }

    case "DELETE_CARD": {
      const columns = state.columns.map((col) => {
        if (col.id === action.columnId) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== action.cardId) };
        }
        return col;
      });
      const cards = { ...state.cards };
      delete cards[action.cardId];
      return { ...state, columns, cards };
    }

    default:
      return state;
  }
}

export function useBoard(
  initialBoard: Board | null,
  onBoardChanged?: (board: Board) => void,
) {
  const [board, dispatch] = useReducer(boardReducer, initialBoard);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const boardRef = useRef<Board | null>(null);
  const prevBoardIdRef = useRef<string | null>(initialBoard?.id || null);
  const dirtyRef = useRef(false);

  // Always keep ref in sync with latest reducer state
  boardRef.current = board;

  // When the board being edited changes (switch boards), flush save the previous one
  useEffect(() => {
    const newId = initialBoard?.id || null;
    const prevId = prevBoardIdRef.current;

    if (newId !== prevId) {
      // Flush save the previous board before switching
      clearTimeout(saveTimeout.current);
      if (dirtyRef.current && boardRef.current) {
        saveBoard(boardRef.current).catch(console.error);
      }
      dirtyRef.current = false;
      prevBoardIdRef.current = newId;
    }

    if (initialBoard) {
      lastSetBoardRef.current = initialBoard;
      dispatch({ type: "SET_BOARD", board: initialBoard });
    }
  }, [initialBoard]);

  // Track the last board we set from initialBoard to skip save on external updates
  const lastSetBoardRef = useRef<Board | null>(initialBoard);

  // Auto-save on changes (debounced) + sync back to parent
  useEffect(() => {
    if (!board) return;
    // Skip when board was just set from initialBoard (external update, not user action)
    if (board === lastSetBoardRef.current) return;

    dirtyRef.current = true;

    // Notify parent of live changes (for sidebar, shadow board, etc.)
    onBoardChanged?.(board);

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveBoard(board).catch(console.error);
      dirtyRef.current = false;
    }, 500);
    return () => clearTimeout(saveTimeout.current);
  }, [board, onBoardChanged]);

  const moveCard = useCallback(
    (cardId: string, fromCol: string, toCol: string, toIndex: number) => {
      dispatch({ type: "MOVE_CARD", cardId, fromCol, toCol, toIndex });
    },
    []
  );

  const addCard = useCallback((columnId: string, title: string) => {
    dispatch({ type: "ADD_CARD", columnId, title });
  }, []);

  const updateCard = useCallback((card: Card) => {
    dispatch({ type: "UPDATE_CARD", card });
  }, []);

  const deleteCard = useCallback((cardId: string, columnId: string) => {
    dispatch({ type: "DELETE_CARD", cardId, columnId });
  }, []);

  return { board, dispatch, moveCard, addCard, updateCard, deleteCard };
}
