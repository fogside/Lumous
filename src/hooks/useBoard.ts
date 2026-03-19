import { useReducer, useCallback, useEffect, useRef } from "react";
import { Board, Card, Goal, createCard } from "../lib/types";
import { saveBoard, loadBoard, getBoardMtime } from "../lib/storage";

type Action =
  | { type: "SET_BOARD"; board: Board }
  | { type: "MOVE_CARD"; cardId: string; fromCol: string; toCol: string; toIndex: number }
  | { type: "ADD_CARD"; columnId: string; title: string }
  | { type: "UPDATE_CARD"; card: Card }
  | { type: "DELETE_CARD"; cardId: string; columnId: string }
  | { type: "SPAWN_RITUALS" }
  | { type: "SET_GOALS"; goals: Goal[] }
  | { type: "ACCEPT_PROPOSAL"; cardId: string }
  | { type: "REJECT_PROPOSAL"; cardId: string }
  | { type: "ACCEPT_ALL_PROPOSALS" }
  | { type: "REJECT_ALL_PROPOSALS" }
  | { type: "CLEAR_HIGHLIGHTS" };

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
      let ritualLog = state.ritualLog || [];
      if (toCol === "completed" && fromCol !== "completed" && cards[cardId]) {
        const now = new Date().toISOString();
        cards[cardId] = { ...cards[cardId], completedAt: now };
        completionLog = [...completionLog, now];
        // Log ritual completion
        if (cards[cardId].ritual) {
          ritualLog = [...ritualLog, {
            date: now.slice(0, 10),
            cardId,
            goalId: cards[cardId].goalId,
          }];
        }
      } else if (fromCol === "completed" && toCol !== "completed" && cards[cardId]) {
        cards[cardId] = { ...cards[cardId], completedAt: null };
      }

      return { ...state, columns, cards, completionLog, ritualLog };
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

    case "SPAWN_RITUALS": {
      const today = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay();
      const completedCol = state.columns.find((c) => c.id === "completed");
      if (!completedCol) return state;

      const toRespawn: string[] = [];
      for (const cardId of completedCol.cardIds) {
        const card = state.cards[cardId];
        if (!card?.ritual || !card.completedAt) continue;
        if (card.completedAt.slice(0, 10) === today) continue;
        const { schedule } = card.ritual;
        const matches = schedule === "daily"
          || (Array.isArray(schedule) && schedule.includes(dayOfWeek));
        if (matches) toRespawn.push(cardId);
      }

      // Also check cards in "today" or "in-progress" that are rituals from a
      // past day but not yet completed — leave them where they are (don't dup)
      if (toRespawn.length === 0) return state;

      const columns = state.columns.map((col) => {
        if (col.id === "completed") {
          return { ...col, cardIds: col.cardIds.filter((id) => !toRespawn.includes(id)) };
        }
        if (col.id === "today") {
          return { ...col, cardIds: [...toRespawn, ...col.cardIds] };
        }
        return col;
      });
      const cards = { ...state.cards };
      for (const id of toRespawn) {
        cards[id] = { ...cards[id], completedAt: null };
      }
      return { ...state, columns, cards };
    }

    case "SET_GOALS": {
      return { ...state, goals: action.goals };
    }

    case "ACCEPT_PROPOSAL": {
      const card = state.cards[action.cardId];
      if (!card?.proposed) return state;
      const { proposed: _, proposedReasoning: __, ...rest } = card;
      return { ...state, cards: { ...state.cards, [action.cardId]: rest as Card } };
    }

    case "REJECT_PROPOSAL": {
      const card = state.cards[action.cardId];
      if (!card?.proposed) return state;
      const cards = { ...state.cards };
      delete cards[action.cardId];
      const columns = state.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => id !== action.cardId),
      }));
      return { ...state, cards, columns };
    }

    case "ACCEPT_ALL_PROPOSALS": {
      const cards: Record<string, Card> = {};
      for (const [id, card] of Object.entries(state.cards)) {
        if (card.proposed) {
          const { proposed: _, proposedReasoning: __, ...rest } = card;
          cards[id] = rest as Card;
        } else {
          cards[id] = card;
        }
      }
      return { ...state, cards };
    }

    case "REJECT_ALL_PROPOSALS": {
      const proposedIds = new Set(
        Object.entries(state.cards).filter(([, c]) => c.proposed).map(([id]) => id)
      );
      if (proposedIds.size === 0) return state;
      const cards = { ...state.cards };
      for (const id of proposedIds) delete cards[id];
      const columns = state.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => !proposedIds.has(id)),
      }));
      return { ...state, cards, columns };
    }

    case "CLEAR_HIGHLIGHTS": {
      const cards: Record<string, Card> = {};
      for (const [id, card] of Object.entries(state.cards)) {
        if (card.highlighted) {
          const { highlighted: _, highlightReason: __, ...rest } = card;
          cards[id] = rest as Card;
        } else {
          cards[id] = card;
        }
      }
      return { ...state, cards };
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
  // Flag to suppress save effect when SET_BOARD was just dispatched from initialBoard
  const suppressSaveRef = useRef(false);

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
      suppressSaveRef.current = true;
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
    // Skip if the initialBoard effect just fired in this render cycle
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }

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

  // Spawn rituals on board load and on day change
  const lastSpawnDate = useRef("");
  useEffect(() => {
    if (!board) return;
    const today = new Date().toISOString().slice(0, 10);
    if (lastSpawnDate.current === today && board === lastSetBoardRef.current) return;
    lastSpawnDate.current = today;
    dispatch({ type: "SPAWN_RITUALS" });
  }, [board?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for day change every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastSpawnDate.current !== today) {
        lastSpawnDate.current = today;
        dispatch({ type: "SPAWN_RITUALS" });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Poll for external file changes (e.g., MCP server writing proposed cards)
  const lastMtimeRef = useRef<number>(0);
  useEffect(() => {
    const boardId = initialBoard?.id;
    if (!boardId) return;
    // Initialize mtime
    getBoardMtime(boardId).then((mt) => { lastMtimeRef.current = mt; }).catch(() => {});
    const interval = setInterval(async () => {
      if (dirtyRef.current) return; // don't reload while user has unsaved changes
      try {
        const mt = await getBoardMtime(boardId);
        if (mt > lastMtimeRef.current && lastMtimeRef.current > 0) {
          lastMtimeRef.current = mt;
          const fresh = await loadBoard(boardId);
          suppressSaveRef.current = true;
          lastSetBoardRef.current = fresh;
          dispatch({ type: "SET_BOARD", board: fresh });
          onBoardChanged?.(fresh);
        }
      } catch { /* file may not exist yet */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [initialBoard?.id, onBoardChanged]);

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

  const setGoals = useCallback((goals: Goal[]) => {
    dispatch({ type: "SET_GOALS", goals });
  }, []);

  const acceptProposal = useCallback((cardId: string) => {
    dispatch({ type: "ACCEPT_PROPOSAL", cardId });
  }, []);

  const rejectProposal = useCallback((cardId: string) => {
    dispatch({ type: "REJECT_PROPOSAL", cardId });
  }, []);

  const acceptAllProposals = useCallback(() => {
    dispatch({ type: "ACCEPT_ALL_PROPOSALS" });
  }, []);

  const rejectAllProposals = useCallback(() => {
    dispatch({ type: "REJECT_ALL_PROPOSALS" });
  }, []);

  const clearHighlights = useCallback(() => {
    dispatch({ type: "CLEAR_HIGHLIGHTS" });
  }, []);

  return {
    board, dispatch, moveCard, addCard, updateCard, deleteCard, setGoals,
    acceptProposal, rejectProposal, acceptAllProposals, rejectAllProposals, clearHighlights,
  };
}
