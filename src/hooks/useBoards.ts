import { useState, useEffect, useCallback } from "react";
import { Board, Meta, createBoard } from "../lib/types";
import { loadMeta, saveMeta, loadBoard, saveBoard, deleteBoardFile } from "../lib/storage";

export function useBoards() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load meta and all boards on mount
  useEffect(() => {
    (async () => {
      try {
        const m = await loadMeta();
        setMeta(m);

        const loaded: Record<string, Board> = {};
        for (const id of m.boardOrder) {
          try {
            loaded[id] = await loadBoard(id);
          } catch {
            // Board file missing, skip
          }
        }
        setBoards(loaded);

        // Auto-select first board or create a default one
        if (m.boardOrder.length > 0 && loaded[m.boardOrder[0]]) {
          setActiveBoardId(m.boardOrder[0]);
        } else if (m.boardOrder.length === 0) {
          const board = createBoard("My Board");
          loaded[board.id] = board;
          const newMeta = { ...m, boardOrder: [board.id] };
          await saveBoard(board);
          await saveMeta(newMeta);
          setMeta(newMeta);
          setBoards(loaded);
          setActiveBoardId(board.id);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addBoard = useCallback(
    async (title: string, color?: string) => {
      if (!meta) return;
      const board = createBoard(title, color);
      await saveBoard(board);
      const newMeta = { ...meta, boardOrder: [...meta.boardOrder, board.id] };
      await saveMeta(newMeta);
      setMeta(newMeta);
      setBoards((prev) => ({ ...prev, [board.id]: board }));
      setActiveBoardId(board.id);
    },
    [meta]
  );

  const removeBoard = useCallback(
    async (id: string) => {
      if (!meta) return;
      await deleteBoardFile(id).catch(() => {});
      const newOrder = meta.boardOrder.filter((bid) => bid !== id);
      const newMeta = { ...meta, boardOrder: newOrder };
      await saveMeta(newMeta);
      setMeta(newMeta);
      setBoards((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeBoardId === id) {
        setActiveBoardId(newOrder[0] || null);
      }
    },
    [meta, activeBoardId]
  );

  const updateBoardMeta = useCallback(
    async (id: string, updates: Partial<Pick<Board, "title" | "backgroundColor">>) => {
      setBoards((prev) => {
        const board = prev[id];
        if (!board) return prev;
        const updated = { ...board, ...updates };
        saveBoard(updated).catch(console.error);
        return { ...prev, [id]: updated };
      });
    },
    []
  );

  const refreshBoard = useCallback((board: Board) => {
    setBoards((prev) => ({ ...prev, [board.id]: board }));
  }, []);

  const updateSettings = useCallback(
    async (settings: Partial<Meta["settings"]>) => {
      if (!meta) return;
      const newMeta = { ...meta, settings: { ...meta.settings, ...settings } };
      await saveMeta(newMeta);
      setMeta(newMeta);
    },
    [meta]
  );

  return {
    meta,
    boards,
    activeBoardId,
    setActiveBoardId,
    activeBoard: activeBoardId ? boards[activeBoardId] || null : null,
    addBoard,
    removeBoard,
    updateBoardMeta,
    refreshBoard,
    updateSettings,
    loading,
  };
}
