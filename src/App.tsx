import { useState, useCallback, useMemo } from "react";
import { DARK_INK, isLightBoard, getBoardTheme, TODAY_BOARD_ID } from "./lib/types";
import { Sparkles } from "lucide-react";
import { useBoards } from "./hooks/useBoards";
import { useBoard } from "./hooks/useBoard";
import { useSync } from "./hooks/useSync";
import { saveBoard } from "./lib/storage";
import { useWindowSize } from "./hooks/useWindowSize";
import { useCardResearch } from "./hooks/useCardResearch";
import { Board } from "./lib/types";
import { Sidebar } from "./components/Sidebar";
import { BoardView } from "./components/BoardView";
import { CompactView } from "./components/CompactView";
import { ShadowBoardView } from "./components/ShadowBoardView";
import { BoardSettingsModal } from "./components/BoardSettingsModal";
import { NewBoardModal } from "./components/NewBoardModal";
import { SyncSettingsModal } from "./components/SyncSettingsModal";
import { WizardPanel } from "./components/WizardPanel";
import { TodayBoardView } from "./components/TodayBoardView";
import { CardModal } from "./components/CardModal";

export default function App() {
  const {
    meta,
    boards,
    activeBoardId,
    setActiveBoardId,
    activeBoard,
    addBoard,
    removeBoard,
    updateBoardMeta,
    refreshBoard,
    updateSettings,
    loading,
  } = useBoards();

  // Sync live board changes back to the boards record so sidebar/shadow board stay current
  // and switching back to a board shows its latest state
  const handleBoardChanged = useCallback((board: Board) => {
    refreshBoard(board);
  }, [refreshBoard]);

  const {
    board, moveCard, addCard, updateCard, deleteCard, setGoals,
    acceptProposal, rejectProposal, acceptAllProposals, rejectAllProposals, clearHighlights,
    reorderColumn, setTimeEstimates, flushSave, forceResave, reloadFromDisk, setBoardIfMatch,
  } = useBoard(activeBoard, handleBoardChanged);
  const { syncState, syncError, sync, hasRepo } = useSync(meta, updateSettings, reloadFromDisk, flushSave, forceResave);
  const { mode } = useWindowSize();

  const getCard = useCallback((id: string) => board?.cards[id], [board]);
  const getMemories = useCallback(() => meta?.settings.wizardMemories || [], [meta]);
  const { startResearch } = useCardResearch(updateCard, getCard, getMemories);

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shadowBoardId, setShadowBoardId] = useState<string | null>(null);
  const [showWisps, setShowWisps] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [todayEditingCard, setTodayEditingCard] = useState<{ card: Board["cards"][string]; boardId: string } | null>(null);

  // ALWAYS merge reducer's live board state into boards record.
  // The reducer has the freshest card/column data for whichever board it holds
  // (even after switching to Today Board — the effect hasn't flushed yet).
  // useMemo: only recompute when board or boards actually change, not on unrelated App state changes
  // NOTE: must be before any early returns to satisfy Rules of Hooks
  const reducerBoardId = board?.id;
  const allBoards = useMemo(() => {
    return reducerBoardId && boards[reducerBoardId]
      ? { ...boards, [reducerBoardId]: { ...board, title: boards[reducerBoardId].title, backgroundColor: boards[reducerBoardId].backgroundColor } }
      : boards;
  }, [boards, board, reducerBoardId]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: DARK_INK }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  const editingBoard = editingBoardId ? allBoards[editingBoardId] : null;
  const isCompact = mode === "compact";
  const isMedium = mode === "medium";

  // Force sidebar collapsed in medium mode
  const effectiveCollapsed = isMedium ? true : sidebarCollapsed;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: DARK_INK }}>
      {/* Hide sidebar entirely in compact mode */}
      {!isCompact && (
        <Sidebar
          boards={allBoards}
          boardOrder={meta?.boardOrder || []}
          activeBoardId={activeBoardId}
          onSelectBoard={(id) => { setActiveBoardId(id); setShadowBoardId(null); }}
          onNewBoard={() => setShowNewBoard(true)}
          onRemoveBoard={removeBoard}
          onEditBoard={setEditingBoardId}
          syncState={syncState}
          syncError={syncError}
          meta={meta}
          hasRepo={hasRepo}
          onSync={sync}
          onOpenSyncSettings={() => setShowSyncSettings(true)}
          collapsed={effectiveCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          hideToggle={isMedium}
          shadowBoardId={shadowBoardId}
          onToggleShadowBoard={setShadowBoardId}
          showWisps={showWisps}
        />
      )}

      <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {activeBoardId === TODAY_BOARD_ID ? (
          <TodayBoardView
            boards={allBoards}
            meta={meta}
            updateSettings={updateSettings}
            flushSave={flushSave}
            onNavigateToCard={(boardId) => {
              setActiveBoardId(boardId);
            }}
            onOpenCard={(card, boardId) => {
              setTodayEditingCard({ card, boardId });
            }}
            onToggleWizard={() => setShowWizard((v) => !v)}
            showWisps={showWisps}
            refreshBoard={refreshBoard}
            setBoardIfMatch={setBoardIfMatch}
          />
        ) : shadowBoardId && allBoards[shadowBoardId] ? (
          <ShadowBoardView
            board={allBoards[shadowBoardId]}
            onClose={() => setShadowBoardId(null)}
            onUpdateBoard={(updatedBoard: Board) => {
              refreshBoard(updatedBoard);
              saveBoard(updatedBoard).catch(console.error);
              // Sync goals + cards back to active board reducer
              if (shadowBoardId === activeBoardId) {
                setGoals(updatedBoard.goals || []);
                // Sync card changes (e.g., cleared goalId on goal deletion)
                for (const [id, card] of Object.entries(updatedBoard.cards)) {
                  if (board && board.cards[id] !== card) {
                    updateCard(card);
                  }
                }
              }
            }}
            showWisps={showWisps}
          />
        ) : board ? (
          isCompact ? (
            <CompactView
              board={activeBoardId ? allBoards[activeBoardId] || board : board}
              moveCard={moveCard}
              addCard={addCard}
              updateCard={updateCard}
            />
          ) : (
            <BoardView
              board={activeBoardId ? allBoards[activeBoardId] || board : board}
              moveCard={moveCard}
              addCard={addCard}
              updateCard={updateCard}
              deleteCard={deleteCard}
              onTitleChange={(title) => {
                if (activeBoardId) {
                  updateBoardMeta(activeBoardId, { title });
                }
              }}
              mode={mode}
              showWisps={showWisps}
              acceptProposal={acceptProposal}
              rejectProposal={rejectProposal}
              acceptAllProposals={acceptAllProposals}
              rejectAllProposals={rejectAllProposals}
              clearHighlights={clearHighlights}
              onOpenMagician={() => setShowWizard((v) => !v)}
              onStartResearch={startResearch}
            />
          )
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 500 }}>No board selected</p>
          </div>
        )}

        {/* Wisps toggle — always top-right of content area */}
        {(() => {
          const isTodayActive = activeBoardId === TODAY_BOARD_ID;
          const visibleBoard = shadowBoardId && allBoards[shadowBoardId]
            ? allBoards[shadowBoardId]
            : board && activeBoardId ? (allBoards[activeBoardId] || board) : null;
          if (!visibleBoard && !isTodayActive) return null;
          if (visibleBoard && isLightBoard(visibleBoard.backgroundColor)) return null;
          const t = visibleBoard ? getBoardTheme(visibleBoard.backgroundColor) : getBoardTheme("#2B3A55");
          return (
            <button
              onClick={() => setShowWisps(!showWisps)}
              title={showWisps ? "Hide wisps" : "Show wisps"}
              data-no-drag
              style={{
                position: "absolute",
                top: 12,
                right: 14,
                zIndex: 2,
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: showWisps ? t.textSecondary : t.textTertiary,
                opacity: showWisps ? 0.8 : 0.5,
                transition: "all 0.3s",
                padding: 0,
              }}
            >
              <Sparkles size={14} strokeWidth={1.5} />
            </button>
          );
        })()}
      </main>

      {showWizard && (board || activeBoardId === TODAY_BOARD_ID) && !isCompact && (
        <WizardPanel
          board={activeBoardId === TODAY_BOARD_ID ? null : (activeBoardId ? allBoards[activeBoardId] || board : board)}
          boards={allBoards}
          meta={meta}
          isTodayBoard={activeBoardId === TODAY_BOARD_ID}
          onClose={() => setShowWizard(false)}
          updateCard={updateCard}
          reorderColumn={reorderColumn}
          setTimeEstimates={setTimeEstimates}
          reloadFromDisk={reloadFromDisk}
          updateSettings={updateSettings}
          startResearch={startResearch}
          moveCard={moveCard}
          flushSave={flushSave}
        />
      )}

      {editingBoard && (
        <BoardSettingsModal
          title={editingBoard.title}
          backgroundColor={editingBoard.backgroundColor}
          onSave={(title, color) => {
            updateBoardMeta(editingBoardId!, { title, backgroundColor: color });
          }}
          onClose={() => setEditingBoardId(null)}
        />
      )}

      {showNewBoard && (
        <NewBoardModal
          onSave={(title, color) => addBoard(title, color)}
          onClose={() => setShowNewBoard(false)}
        />
      )}

      {showSyncSettings && meta && (
        <SyncSettingsModal
          settings={meta.settings}
          onSave={updateSettings}
          onClose={() => setShowSyncSettings(false)}
        />
      )}

      {todayEditingCard && (
        <CardModal
          card={allBoards[todayEditingCard.boardId]?.cards[todayEditingCard.card.id] || todayEditingCard.card}
          columnId="today"
          goals={allBoards[todayEditingCard.boardId]?.goals}
          onSave={async (updatedCard) => {
            try {
              await flushSave(); // prevent stale useBoard auto-save from overwriting
              const { invoke } = await import("@tauri-apps/api/core");
              const boardJson = await invoke<string>("load_board", { id: todayEditingCard.boardId });
              const boardData = JSON.parse(boardJson);
              boardData.cards[updatedCard.id] = updatedCard;
              await invoke("save_board", { id: todayEditingCard.boardId, data: JSON.stringify(boardData, null, 2) });
              // Refresh the boards record so Today Board shows updated data
              refreshBoard(boardData);
            } catch (e) { console.error(e); }
          }}
          onDelete={async (cardId, columnId) => {
            try {
              await flushSave();
              const { invoke } = await import("@tauri-apps/api/core");
              const boardJson = await invoke<string>("load_board", { id: todayEditingCard.boardId });
              const boardData = JSON.parse(boardJson);
              delete boardData.cards[cardId];
              for (const col of boardData.columns) {
                col.cardIds = col.cardIds.filter((id: string) => id !== cardId);
              }
              await invoke("save_board", { id: todayEditingCard.boardId, data: JSON.stringify(boardData, null, 2) });
              refreshBoard(boardData);
            } catch (e) { console.error(e); }
          }}
          onClose={() => setTodayEditingCard(null)}
          onStartResearch={(card, context) => startResearch(card, context, todayEditingCard.boardId)}
        />
      )}

    </div>
  );
}
