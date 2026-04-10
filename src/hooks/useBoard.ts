import { useReducer, useCallback, useEffect, useRef, startTransition } from "react";
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
  | { type: "CLEAR_HIGHLIGHTS" }
  | { type: "REORDER_COLUMN"; columnId: string; cardIds: string[] }
  | { type: "SET_TIME_ESTIMATES"; estimates: Record<string, string> };

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

      // Clear wizard transient flags on any manual move — dragging a card is implicit acceptance/dismissal
      if (cards[cardId]) {
        const { proposed: _p, proposedReasoning: _pr, highlighted: _h, highlightReason: _hr, proposedDelete: _pd, proposedDeleteReason: _pdr, ...cleanCard } = cards[cardId];
        cards[cardId] = cleanCard as typeof cards[typeof cardId];
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
      // Remove from ALL columns — card may have been moved by the wizard since the modal opened,
      // so relying on columnId would leave an orphan card ID in the actual column
      const columns = state.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => id !== action.cardId),
      }));
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
        if (!cards[id]) continue; // card was deleted but ID still in completed column
        cards[id] = { ...cards[id], completedAt: null };
      }
      return { ...state, columns, cards };
    }

    case "SET_GOALS": {
      return { ...state, goals: action.goals };
    }

    case "ACCEPT_PROPOSAL": {
      const card = state.cards[action.cardId];
      if (!card) return state;
      if (card.proposedDelete) {
        // Accept deletion: remove card + remove from all columns
        const cards = { ...state.cards };
        delete cards[action.cardId];
        const columns = state.columns.map((col) => ({
          ...col,
          cardIds: col.cardIds.filter((id) => id !== action.cardId),
        }));
        return { ...state, cards, columns };
      }
      if (!card.proposed) return state;
      // Accept new card: clear proposed flag
      const { proposed: _, proposedReasoning: __, ...rest } = card;
      return { ...state, cards: { ...state.cards, [action.cardId]: rest as Card } };
    }

    case "REJECT_PROPOSAL": {
      const card = state.cards[action.cardId];
      if (!card) return state;
      if (card.proposedDelete) {
        // Reject deletion: keep the card, just clear the proposedDelete flag
        const { proposedDelete: _, proposedDeleteReason: __, ...rest } = card;
        return { ...state, cards: { ...state.cards, [action.cardId]: rest as Card } };
      }
      if (!card.proposed) return state;
      // Reject new card: delete it
      const cards = { ...state.cards };
      delete cards[action.cardId];
      const columns = state.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => id !== action.cardId),
      }));
      return { ...state, cards, columns };
    }

    case "ACCEPT_ALL_PROPOSALS": {
      const cards: Record<string, Card> = { ...state.cards };
      const deleteIds = new Set<string>();
      for (const [id, card] of Object.entries(cards)) {
        if (card.proposedDelete) {
          delete cards[id];
          deleteIds.add(id);
        } else if (card.proposed) {
          const { proposed: _, proposedReasoning: __, ...rest } = card;
          cards[id] = rest as Card;
        }
      }
      if (deleteIds.size === 0) return { ...state, cards };
      const columns = state.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => !deleteIds.has(id)),
      }));
      return { ...state, cards, columns };
    }

    case "REJECT_ALL_PROPOSALS": {
      const proposedIds = new Set(
        Object.entries(state.cards).filter(([, c]) => c.proposed).map(([id]) => id)
      );
      const cards = { ...state.cards };
      // Delete proposed-new cards
      for (const id of proposedIds) delete cards[id];
      // Clear proposedDelete flag from pending-deletion cards
      for (const [id, card] of Object.entries(cards)) {
        if (card.proposedDelete) {
          const { proposedDelete: _, proposedDeleteReason: __, ...rest } = card;
          cards[id] = rest as Card;
        }
      }
      if (proposedIds.size === 0 && !Object.values(state.cards).some((c) => c.proposedDelete)) return state;
      const columns = proposedIds.size > 0
        ? state.columns.map((col) => ({ ...col, cardIds: col.cardIds.filter((id) => !proposedIds.has(id)) }))
        : state.columns;
      return { ...state, cards, columns };
    }

    case "REORDER_COLUMN": {
      const { columnId, cardIds } = action;
      // Only keep IDs that actually exist in cards
      const validIds = cardIds.filter((id) => state.cards[id]);
      const columns = state.columns.map((col) => {
        if (col.id !== columnId) return col;
        // Preserve any cards in the column that weren't in the new order
        const remaining = col.cardIds.filter((id) => !validIds.includes(id));
        return { ...col, cardIds: [...validIds, ...remaining] };
      });
      return { ...state, columns };
    }

    case "SET_TIME_ESTIMATES": {
      const cards = { ...state.cards };
      for (const [id, estimate] of Object.entries(action.estimates)) {
        if (cards[id]) {
          cards[id] = { ...cards[id], timeEstimate: estimate };
        }
      }
      return { ...state, cards };
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
  const savingPromiseRef = useRef<Promise<void> | null>(null); // track in-flight saves
  // Flag to suppress save effect when SET_BOARD was just dispatched from initialBoard
  const suppressSaveRef = useRef(false);

  // Always keep ref in sync with latest reducer state
  boardRef.current = board;

  // When the board being edited changes (switch boards), flush save the previous one
  useEffect(() => {
    const newId = initialBoard?.id || null;
    const prevId = prevBoardIdRef.current;

    if (newId !== prevId) {
      // Flush save the previous board before switching — tracked so flushSave can await it
      clearTimeout(saveTimeout.current);
      if (boardRef.current) {
        // Push the reducer's latest state to the boards record IMMEDIATELY
        // so the next view (e.g., Today Board) sees up-to-date data
        onBoardChanged?.(boardRef.current);

        if (dirtyRef.current) {
          const b = boardRef.current;
          savingPromiseRef.current = (async () => {
            try {
              await saveBoard(b);
              if (b.id) lastMtimeRef.current = await getBoardMtime(b.id);
            } catch (e) { console.error(e); }
            savingPromiseRef.current = null;
          })();
        }
      }
      dirtyRef.current = false;
      prevBoardIdRef.current = newId;
    }

    if (initialBoard) {
      // When switching back to the same board, only update if initialBoard
      // is a genuinely new version (different reference from what we last set).
      // This prevents stale boards record from overwriting fresh reducer state
      // when switching Board A → Today Board → Board A, while still allowing
      // external updates (refreshBoard, MCP, sync) to flow through.
      const isSameBoard = boardRef.current?.id === initialBoard.id;
      const isStaleReturn = isSameBoard && initialBoard === lastSetBoardRef.current;
      if (!isStaleReturn) {
        suppressSaveRef.current = true;
        lastSetBoardRef.current = initialBoard;
        dispatch({ type: "SET_BOARD", board: initialBoard });
      }
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
    // startTransition: sidebar refresh is non-urgent and shouldn't block input
    startTransition(() => { onBoardChanged?.(board); });

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      savingPromiseRef.current = (async () => {
        try {
          await saveBoard(board);
          if (board.id) {
            try {
              lastMtimeRef.current = await getBoardMtime(board.id);
            } catch { /* ignore */ }
          }
        } catch (e) {
          console.error(e);
        }
        dirtyRef.current = false;
        savingPromiseRef.current = null;
      })();
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
          // Use startTransition so background file-change reloads don't block user input
          startTransition(() => {
            dispatch({ type: "SET_BOARD", board: fresh });
            onBoardChanged?.(fresh);
          });
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

  const reorderColumn = useCallback((columnId: string, cardIds: string[]) => {
    dispatch({ type: "REORDER_COLUMN", columnId, cardIds });
  }, []);

  const setTimeEstimates = useCallback((estimates: Record<string, string>) => {
    dispatch({ type: "SET_TIME_ESTIMATES", estimates });
  }, []);

  // Flush any pending debounced save immediately (call before sync or disk reads)
  // Also awaits any in-flight save from board switching
  const flushSave = useCallback(async () => {
    // Wait for any in-flight board-switch save to complete first
    if (savingPromiseRef.current) {
      await savingPromiseRef.current;
    }
    clearTimeout(saveTimeout.current);
    if (dirtyRef.current && boardRef.current) {
      try {
        await saveBoard(boardRef.current);
        if (boardRef.current.id) {
          lastMtimeRef.current = await getBoardMtime(boardRef.current.id);
        }
      } catch (e) {
        console.error(e);
      }
      dirtyRef.current = false;
    }
  }, []);

  // Force-write current board state to disk unconditionally (used after sync strips transient data)
  const forceResave = useCallback(async () => {
    if (!boardRef.current) return;
    try {
      await saveBoard(boardRef.current);
      if (boardRef.current.id) {
        lastMtimeRef.current = await getBoardMtime(boardRef.current.id);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Force reload board from disk (e.g., after MagicianModal writes proposed cards)
  // Flushes any pending saves first to avoid losing in-flight reducer changes
  const reloadFromDisk = useCallback(async () => {
    const boardId = initialBoard?.id;
    if (!boardId) return;
    try {
      // Wait for any in-flight save then flush pending
      if (savingPromiseRef.current) await savingPromiseRef.current;
      if (dirtyRef.current && boardRef.current) {
        clearTimeout(saveTimeout.current);
        await saveBoard(boardRef.current);
        dirtyRef.current = false;
      }
      const fresh = await loadBoard(boardId);
      suppressSaveRef.current = true;
      lastSetBoardRef.current = fresh;
      dispatch({ type: "SET_BOARD", board: fresh });
      onBoardChanged?.(fresh);
      const mt = await getBoardMtime(boardId);
      lastMtimeRef.current = mt;
    } catch { /* ignore */ }
  }, [initialBoard?.id, onBoardChanged]);

  // Update the reducer's board directly (for cross-board operations like Today Board completing cards)
  const setBoardIfMatch = useCallback((updatedBoard: Board) => {
    if (boardRef.current?.id === updatedBoard.id) {
      suppressSaveRef.current = true;
      lastSetBoardRef.current = updatedBoard;
      dispatch({ type: "SET_BOARD", board: updatedBoard });
    }
  }, []);

  return {
    board, dispatch, moveCard, addCard, updateCard, deleteCard, setGoals,
    acceptProposal, rejectProposal, acceptAllProposals, rejectAllProposals, clearHighlights,
    reorderColumn, setTimeEstimates, flushSave, forceResave, reloadFromDisk, setBoardIfMatch,
  };
}
