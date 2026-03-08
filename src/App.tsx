import { useState } from "react";
import { useBoards } from "./hooks/useBoards";
import { useBoard } from "./hooks/useBoard";
import { useSync } from "./hooks/useSync";
import { useWindowSize } from "./hooks/useWindowSize";
import { Sidebar } from "./components/Sidebar";
import { BoardView } from "./components/BoardView";
import { CompactView } from "./components/CompactView";
import { ShadowBoardView } from "./components/ShadowBoardView";
import { BoardSettingsModal } from "./components/BoardSettingsModal";
import { NewBoardModal } from "./components/NewBoardModal";
import { SyncSettingsModal } from "./components/SyncSettingsModal";

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
    updateSettings,
    loading,
  } = useBoards();

  const { board, moveCard, addCard, updateCard, deleteCard } = useBoard(activeBoard);
  const { syncState, syncError, sync, hasRepo } = useSync(meta, updateSettings);
  const { mode } = useWindowSize();

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shadowBoardId, setShadowBoardId] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c14" }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  // Merge active board's live state so sidebar + shadow board see real-time updates
  const allBoards = board && activeBoardId ? { ...boards, [activeBoardId]: board } : boards;

  const editingBoard = editingBoardId ? allBoards[editingBoardId] : null;
  const isCompact = mode === "compact";
  const isMedium = mode === "medium";

  // Force sidebar collapsed in medium mode
  const effectiveCollapsed = isMedium ? true : sidebarCollapsed;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0c0c14" }}>
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
          shadowBoardId={shadowBoardId}
          onToggleShadowBoard={setShadowBoardId}
        />
      )}

      <main style={{ flex: 1, overflow: "hidden" }}>
        {shadowBoardId && allBoards[shadowBoardId] ? (
          <ShadowBoardView
            board={allBoards[shadowBoardId]}
            onClose={() => setShadowBoardId(null)}
          />
        ) : board ? (
          isCompact ? (
            <CompactView
              board={board}
              moveCard={moveCard}
              addCard={addCard}
            />
          ) : (
            <BoardView
              board={board}
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
            />
          )
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 500 }}>No board selected</p>
          </div>
        )}
      </main>

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
