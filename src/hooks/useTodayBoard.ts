import { useMemo, useCallback, useEffect, useRef } from "react";
import { Board, Card, CardRef, FocusSession, Meta } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";

export interface AggregatedCard {
  card: Card;
  boardId: string;
  boardTitle: string;
  boardColor: string;
  column: "today" | "in-progress";
}

export interface TodayBoardData {
  allCards: AggregatedCard[];
  unplanned: AggregatedCard[];
  sessions: FocusSession[];
  totalPlannedMin: number;
  totalUnplannedMin: number;
}

function parseMinutes(est?: string): number {
  if (!est) return 15; // default estimate
  const m = est.match(/^(\d+(?:\.\d+)?)\s*(?:min|h|hr)?/);
  if (!m) return 15;
  const val = parseFloat(m[1]);
  if (est.includes("h")) return Math.round(val * 60);
  return Math.round(val);
}

export function useTodayBoard(
  boards: Record<string, Board>,
  meta: Meta | null,
  updateSettings: (settings: Partial<Meta["settings"]>) => void,
  flushSave?: () => Promise<void>,
  refreshBoard?: (board: Board) => void,
) {
  const today = new Date().toISOString().slice(0, 10);
  const sessions = meta?.settings.todaySessions || [];
  const sessionDate = meta?.settings.todayDate || "";

  // Reset sessions if date changed
  const activeSessions = sessionDate === today ? sessions : [];

  // Collect card IDs that are marked completed in sessions (need to include from "completed" column)
  const sessionCompletedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of activeSessions) {
      for (const id of (s.completedCardIds || [])) ids.add(id);
    }
    return ids;
  }, [activeSessions]);

  // Aggregate all today + in-progress cards, plus completed cards still referenced by sessions
  const allCards = useMemo<AggregatedCard[]>(() => {
    const result: AggregatedCard[] = [];
    const seen = new Set<string>();
    for (const board of Object.values(boards)) {
      for (const col of board.columns) {
        if (col.id !== "today" && col.id !== "in-progress" && col.id !== "completed") continue;
        for (const cardId of col.cardIds) {
          if (seen.has(cardId)) continue;
          const card = board.cards[cardId];
          if (!card || card.proposed) continue;
          // Include today/in-progress cards, plus completed cards that are in a session
          if (col.id === "completed" && !sessionCompletedIds.has(cardId)) continue;
          seen.add(cardId);
          result.push({
            card,
            boardId: board.id,
            boardTitle: board.title,
            boardColor: board.backgroundColor,
            column: col.id as "today" | "in-progress",
          });
        }
      }
    }
    return result;
  }, [boards, sessionCompletedIds]);

  // Build card → column map across all boards for sync detection
  const cardColumnMap = useMemo(() => {
    const map = new Map<string, string>(); // cardId → column id
    for (const board of Object.values(boards)) {
      for (const col of board.columns) {
        for (const cardId of col.cardIds) {
          map.set(cardId, col.id);
        }
      }
    }
    return map;
  }, [boards]);

  // Build set of card IDs that are assigned to sessions
  const plannedCardIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of activeSessions) {
      for (const ref of s.cardRefs) set.add(ref.cardId);
    }
    return set;
  }, [activeSessions]);

  // Cards not in any session
  const unplanned = useMemo(
    () => allCards.filter((ac) => !plannedCardIds.has(ac.card.id)),
    [allCards, plannedCardIds],
  );

  // Calculate totals
  const totalPlannedMin = useMemo(() => {
    let total = 0;
    for (const s of activeSessions) {
      for (const ref of s.cardRefs) {
        const ac = allCards.find((a) => a.card.id === ref.cardId);
        if (ac) total += parseMinutes(ac.card.timeEstimate);
      }
    }
    return total;
  }, [activeSessions, allCards]);

  const totalUnplannedMin = useMemo(
    () => unplanned.reduce((sum, ac) => sum + parseMinutes(ac.card.timeEstimate), 0),
    [unplanned],
  );

  // Persist sessions to meta
  const saveSessions = useCallback(
    (newSessions: FocusSession[]) => {
      updateSettings({ todaySessions: newSessions, todayDate: today });
    },
    [updateSettings, today],
  );

  // Auto-sync sessions with source board state:
  // - Remove cards moved to "todo" (no longer a today task)
  // - Auto-mark cards completed on source board
  // - Auto-unmark cards moved back to today/in-progress from completed
  // Runs whenever boards change (cardColumnMap) or sessions change
  const lastSyncHashRef = useRef("");
  useEffect(() => {
    if (activeSessions.length === 0) return;

    // Build a hash of current state to prevent infinite loops
    const stateHash = activeSessions.map((s) =>
      `${s.id}:${s.cardRefs.map((r) => r.cardId).join(",")}:${(s.completedCardIds || []).join(",")}`
    ).join("|") + "||" + [...cardColumnMap.entries()].map(([k, v]) => `${k}=${v}`).join(",");

    if (stateHash === lastSyncHashRef.current) return;

    let changed = false;
    const synced = activeSessions.map((s) => {
      const completed = new Set(s.completedCardIds || []);
      const newCompleted = new Set(completed);
      const newRefs = s.cardRefs.filter((ref) => {
        const col = cardColumnMap.get(ref.cardId);
        if (!col) return true;
        if (col === "todo") {
          changed = true;
          newCompleted.delete(ref.cardId);
          return false;
        }
        if (col === "completed" && !completed.has(ref.cardId)) {
          newCompleted.add(ref.cardId);
          changed = true;
        }
        if ((col === "today" || col === "in-progress") && completed.has(ref.cardId)) {
          newCompleted.delete(ref.cardId);
          changed = true;
        }
        return true;
      });
      if (newRefs.length !== s.cardRefs.length || newCompleted.size !== completed.size) {
        return { ...s, cardRefs: newRefs, completedCardIds: [...newCompleted] };
      }
      return s;
    });

    if (changed) {
      // Update hash BEFORE saving to prevent re-entry
      const newHash = synced.map((s) =>
        `${s.id}:${s.cardRefs.map((r) => r.cardId).join(",")}:${(s.completedCardIds || []).join(",")}`
      ).join("|") + "||" + [...cardColumnMap.entries()].map(([k, v]) => `${k}=${v}`).join(",");
      lastSyncHashRef.current = newHash;
      saveSessions(synced);
    } else {
      lastSyncHashRef.current = stateHash;
    }
  }, [activeSessions, cardColumnMap, saveSessions]);

  const setSessions = useCallback(
    (newSessions: FocusSession[]) => {
      saveSessions(newSessions);
    },
    [saveSessions],
  );

  const moveCardToSession = useCallback(
    (cardRef: CardRef, sessionId: string, insertIndex?: number) => {
      const updated = activeSessions.map((s) => {
        // Remove from any existing session
        const filtered = { ...s, cardRefs: s.cardRefs.filter((r) => r.cardId !== cardRef.cardId) };
        // Add to target session at position
        if (s.id === sessionId) {
          const refs = [...filtered.cardRefs];
          const idx = insertIndex !== undefined ? Math.min(insertIndex, refs.length) : refs.length;
          refs.splice(idx, 0, cardRef);
          return { ...filtered, cardRefs: refs };
        }
        return filtered;
      });
      saveSessions(updated);
    },
    [activeSessions, saveSessions],
  );

  const removeCardFromSession = useCallback(
    (cardId: string) => {
      const updated = activeSessions.map((s) => ({
        ...s,
        cardRefs: s.cardRefs.filter((r) => r.cardId !== cardId),
      }));
      saveSessions(updated);
    },
    [activeSessions, saveSessions],
  );

  const addSession = useCallback(
    (duration: 25 | 50 | 75, timeOfDay: "morning" | "afternoon" | "evening") => {
      const newSession: FocusSession = {
        id: crypto.randomUUID(),
        duration,
        timeOfDay,
        cardRefs: [],
      };
      saveSessions([...activeSessions, newSession]);
    },
    [activeSessions, saveSessions],
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      saveSessions(activeSessions.filter((s) => s.id !== sessionId));
    },
    [activeSessions, saveSessions],
  );

  const reorderCardInSession = useCallback(
    (sessionId: string, cardId: string, direction: "up" | "down") => {
      const updated = activeSessions.map((s) => {
        if (s.id !== sessionId) return s;
        const refs = [...s.cardRefs];
        const idx = refs.findIndex((r) => r.cardId === cardId);
        if (idx === -1) return s;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= refs.length) return s;
        [refs[idx], refs[targetIdx]] = [refs[targetIdx], refs[idx]];
        return { ...s, cardRefs: refs };
      });
      saveSessions(updated);
    },
    [activeSessions, saveSessions],
  );

  // Read fresh sessions from meta to avoid stale closure issues in async callbacks
  const getLatestSessions = useCallback((): FocusSession[] => {
    return meta?.settings.todaySessions || [];
  }, [meta]);

  // Complete a card on source board — keep in session but mark as done
  const completeCard = useCallback(
    async (cardRef: CardRef) => {
      try {
        if (flushSave) await flushSave();
        const boardJson = await invoke<string>("load_board", { id: cardRef.boardId });
        const boardData = JSON.parse(boardJson);
        const card = boardData.cards[cardRef.cardId];
        if (!card || card.completedAt) return;

        for (const col of boardData.columns) {
          col.cardIds = col.cardIds.filter((id: string) => id !== cardRef.cardId);
        }
        const completedCol = boardData.columns.find((c: { id: string }) => c.id === "completed");
        if (completedCol) completedCol.cardIds.unshift(cardRef.cardId);
        const now = new Date().toISOString();
        card.completedAt = now;
        if (!boardData.completionLog) boardData.completionLog = [];
        boardData.completionLog.push(now);
        if (card.ritual) {
          if (!boardData.ritualLog) boardData.ritualLog = [];
          boardData.ritualLog.push({ date: now.slice(0, 10), cardId: cardRef.cardId, goalId: card.goalId });
        }

        await invoke("save_board", { id: cardRef.boardId, data: JSON.stringify(boardData, null, 2) });
        if (refreshBoard) refreshBoard(boardData as Board);

        // Mark as completed in session — read FRESH sessions to avoid stale closure
        const fresh = getLatestSessions();
        const updated = fresh.map((s) => {
          if (s.cardRefs.some((r) => r.cardId === cardRef.cardId)) {
            const completed = new Set(s.completedCardIds || []);
            completed.add(cardRef.cardId);
            return { ...s, completedCardIds: [...completed] };
          }
          return s;
        });
        saveSessions(updated);
      } catch (e) {
        console.error("Failed to complete card:", e);
      }
    },
    [saveSessions, flushSave, refreshBoard, getLatestSessions],
  );

  // Uncomplete a card — move back to "today" on source board, unmark in session
  const uncompleteCard = useCallback(
    async (cardRef: CardRef) => {
      try {
        if (flushSave) await flushSave();
        const boardJson = await invoke<string>("load_board", { id: cardRef.boardId });
        const boardData = JSON.parse(boardJson);
        const card = boardData.cards[cardRef.cardId];
        if (!card) return;

        for (const col of boardData.columns) {
          col.cardIds = col.cardIds.filter((id: string) => id !== cardRef.cardId);
        }
        const todayCol = boardData.columns.find((c: { id: string }) => c.id === "today");
        if (todayCol) todayCol.cardIds.unshift(cardRef.cardId);
        card.completedAt = null;

        await invoke("save_board", { id: cardRef.boardId, data: JSON.stringify(boardData, null, 2) });
        if (refreshBoard) refreshBoard(boardData as Board);

        const fresh = getLatestSessions();
        const updated = fresh.map((s) => {
          if (s.completedCardIds?.includes(cardRef.cardId)) {
            return { ...s, completedCardIds: s.completedCardIds.filter((id) => id !== cardRef.cardId) };
          }
          return s;
        });
        saveSessions(updated);
      } catch (e) {
        console.error("Failed to uncomplete card:", e);
      }
    },
    [saveSessions, flushSave, refreshBoard, getLatestSessions],
  );

  // Start a session — move all cards to "in-progress" on their source boards
  const startSession = useCallback(
    async (sessionId: string) => {
      if (flushSave) await flushSave();
      const fresh = getLatestSessions();
      const session = fresh.find((s) => s.id === sessionId);
      if (!session) return;

      const byBoard = new Map<string, string[]>();
      for (const ref of session.cardRefs) {
        if (session.completedCardIds?.includes(ref.cardId)) continue;
        const list = byBoard.get(ref.boardId) || [];
        list.push(ref.cardId);
        byBoard.set(ref.boardId, list);
      }

      for (const [boardId, cardIds] of byBoard) {
        try {
          const boardJson = await invoke<string>("load_board", { id: boardId });
          const boardData = JSON.parse(boardJson);

          for (const cardId of cardIds) {
            for (const col of boardData.columns) {
              col.cardIds = col.cardIds.filter((id: string) => id !== cardId);
            }
            const ipCol = boardData.columns.find((c: { id: string }) => c.id === "in-progress");
            if (ipCol) ipCol.cardIds.unshift(cardId);
          }

          await invoke("save_board", { id: boardId, data: JSON.stringify(boardData, null, 2) });
          if (refreshBoard) refreshBoard(boardData as Board);
        } catch (e) {
          console.error("Failed to start session cards:", e);
        }
      }

      const freshAfter = getLatestSessions();
      const updated = freshAfter.map((s) =>
        s.id === sessionId ? { ...s, started: true } : s
      );
      saveSessions(updated);
    },
    [saveSessions, flushSave, refreshBoard, getLatestSessions],
  );

  // Check if all cards in a session are completed
  const isSessionComplete = useCallback(
    (session: FocusSession): boolean => {
      if (session.cardRefs.length === 0) return false;
      const completed = new Set(session.completedCardIds || []);
      return session.cardRefs.every((r) => completed.has(r.cardId));
    },
    [],
  );

  return {
    allCards,
    unplanned,
    sessions: activeSessions,
    totalPlannedMin,
    totalUnplannedMin,
    setSessions,
    moveCardToSession,
    removeCardFromSession,
    addSession,
    removeSession,
    completeCard,
    uncompleteCard,
    reorderCardInSession,
    startSession,
    isSessionComplete,
    parseMinutes,
  };
}
