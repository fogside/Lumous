import { useState, useCallback } from "react";
import { DARK_INK, isLightBoard, getBoardTheme } from "./lib/types";
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
    reorderColumn, setTimeEstimates, flushSave, forceResave, reloadFromDisk,
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

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: DARK_INK }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  // Merge: metadata (title, color) from boards record, card/column state from useBoard reducer
  const allBoards = board && activeBoardId && boards[activeBoardId]
    ? { ...boards, [activeBoardId]: { ...board, title: boards[activeBoardId].title, backgroundColor: boards[activeBoardId].backgroundColor } }
    : boards;

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
        {shadowBoardId && allBoards[shadowBoardId] ? (
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
          const visibleBoard = shadowBoardId && allBoards[shadowBoardId]
            ? allBoards[shadowBoardId]
            : board && activeBoardId ? (allBoards[activeBoardId] || board) : null;
          if (!visibleBoard || isLightBoard(visibleBoard.backgroundColor)) return null;
          const t = getBoardTheme(visibleBoard.backgroundColor);
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

      {showWizard && board && !isCompact && (
        <WizardPanel
          board={activeBoardId ? allBoards[activeBoardId] || board : board}
          meta={meta}
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

    </div>
  );
}
