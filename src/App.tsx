import { useState } from "react";
import { useBoards } from "./hooks/useBoards";
import { useSync } from "./hooks/useSync";
import { Sidebar } from "./components/Sidebar";
import { BoardView } from "./components/BoardView";
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

  const { syncState, syncError, sync, hasRepo } = useSync(meta, updateSettings);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c14" }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  const editingBoard = editingBoardId ? boards[editingBoardId] : null;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0c0c14" }}>
      <Sidebar
        boards={boards}
        boardOrder={meta?.boardOrder || []}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onNewBoard={() => setShowNewBoard(true)}
        onRemoveBoard={removeBoard}
        onEditBoard={setEditingBoardId}
        syncState={syncState}
        syncError={syncError}
        meta={meta}
        hasRepo={hasRepo}
        onSync={sync}
        onOpenSyncSettings={() => setShowSyncSettings(true)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main style={{ flex: 1, overflow: "hidden" }}>
        {activeBoard ? (
          <BoardView
            key={activeBoardId}
            initialBoard={activeBoard}
            onTitleChange={(title) => {
              if (activeBoardId) {
                updateBoardMeta(activeBoardId, { title });
              }
            }}
          />
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
