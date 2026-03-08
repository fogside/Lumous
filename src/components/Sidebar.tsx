import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Board, Meta } from "../lib/types";
import { SyncStatus } from "./SyncStatus";
import { ConfirmDialog } from "./ConfirmDialog";
import { CompletionHeatmap } from "./CompletionHeatmap";

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("input") || target.closest("textarea") || target.closest("[data-no-drag]")) return;
  getCurrentWindow().startDragging();
}

interface Props {
  boards: Record<string, Board>;
  boardOrder: string[];
  activeBoardId: string | null;
  onSelectBoard: (id: string) => void;
  onNewBoard: () => void;
  onRemoveBoard: (id: string) => void;
  onEditBoard: (id: string) => void;
  syncState: "idle" | "syncing" | "success" | "error";
  syncError: string;
  meta: Meta | null;
  hasRepo: boolean;
  onSync: () => void;
  onOpenSyncSettings: () => void;
  collapsed: boolean;
  onToggle: () => void;
  shadowBoardId: string | null;
  onToggleShadowBoard: (id: string | null) => void;
}

export function Sidebar({
  boards,
  boardOrder,
  activeBoardId,
  onSelectBoard,
  onNewBoard,
  onRemoveBoard,
  onEditBoard,
  syncState,
  syncError,
  meta,
  hasRepo,
  onSync,
  onOpenSyncSettings,
  collapsed,
  onToggle,
  shadowBoardId,
  onToggleShadowBoard,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deletingBoard = confirmDelete ? boards[confirmDelete] : null;

  // ─── Collapsed view ───
  if (collapsed) {
    return (
      <div onMouseDown={startWindowDrag} style={{
        width: 72,
        minWidth: 72,
        background: "#0c0c14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 44,
        paddingBottom: 20,
        borderRight: "1px solid rgba(255,255,255,0.05)",
        height: "100%",
        position: "relative",
        zIndex: 10,
        overflow: "hidden",
      }}>
        <button
          onClick={onToggle}
          title="Show sidebar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.3)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            marginBottom: 28,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, flex: 1, overflowY: "auto", width: "100%", paddingTop: 4, paddingBottom: 14 }}>
          {boardOrder.map((id) => {
            const board = boards[id];
            if (!board) return null;
            return (
              <button
                key={id}
                onClick={() => onSelectBoard(id)}
                title={board.title}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  backgroundColor: board.backgroundColor,
                  border: id === activeBoardId ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  transform: id === activeBoardId ? "scale(1.1)" : "scale(1)",
                  opacity: id === activeBoardId ? 1 : 0.7,
                }}
              />
            );
          })}
          <button
            onClick={onNewBoard}
            title="New board"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.4)",
              fontSize: 20,
              fontWeight: 300,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // ─── Expanded view ───
  return (
    <div onMouseDown={startWindowDrag} style={{
      width: 270,
      minWidth: 270,
      background: "#0c0c14",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      position: "relative",
      zIndex: 10,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "44px 24px 24px 24px",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Boards
        </span>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.25)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Board list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {boardOrder.map((id) => {
          const board = boards[id];
          if (!board) return null;
          const isActive = id === activeBoardId;
          const isShadowOpen = shadowBoardId === id;
          const hasLog = (board.completionLog?.length || 0) > 0;
          return (
            <div key={id} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => onSelectBoard(id)}
                  onContextMenu={(e) => { e.preventDefault(); onEditBoard(id); }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    borderRadius: 12,
                    textAlign: "left",
                    background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                    color: isActive ? "white" : "rgba(255,255,255,0.45)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 6,
                      flexShrink: 0,
                      backgroundColor: board.backgroundColor,
                    }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {board.title}
                  </span>
                  {/* Shadow board toggle icon */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleShadowBoard(isShadowOpen ? null : id);
                    }}
                    title="Completion history"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      flexShrink: 0,
                      color: isShadowOpen ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                      transition: "all 0.15s",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="7" width="2" height="6" rx="0.5" fill="currentColor"/>
                      <rect x="4.5" y="4" width="2" height="9" rx="0.5" fill="currentColor"/>
                      <rect x="8" y="5.5" width="2" height="7.5" rx="0.5" fill="currentColor"/>
                      <rect x="11.5" y="2" width="2" height="11" rx="0.5" fill="currentColor" opacity="0.6"/>
                    </svg>
                  </span>
                </button>
                <button
                  onClick={() => setConfirmDelete(id)}
                  title="Delete board"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 18,
                    fontWeight: 300,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 0.15s",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Shadow board — completion heatmap with git-tree connector */}
              {isShadowOpen && (
                <div style={{ display: "flex", paddingLeft: 16, marginTop: -2, marginBottom: 4 }}>
                  {/* Git tree connector */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                    <div style={{
                      width: 1,
                      height: 10,
                      background: "rgba(255,255,255,0.12)",
                    }} />
                    <div style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      border: "1.5px solid rgba(255,255,255,0.2)",
                      background: "#0c0c14",
                      flexShrink: 0,
                    }} />
                    <div style={{
                      width: 1,
                      flex: 1,
                      background: "rgba(255,255,255,0.06)",
                    }} />
                  </div>
                  {/* Heatmap content */}
                  <div style={{
                    flex: 1,
                    padding: "6px 10px 8px 8px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    overflow: "hidden",
                  }}>
                    {hasLog ? (
                      <CompletionHeatmap
                        completionLog={board.completionLog!}
                        accentColor={board.backgroundColor}
                      />
                    ) : (
                      <div style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.15)",
                        fontWeight: 500,
                        padding: "8px 0",
                      }}>
                        No completions yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onNewBoard}
          style={{
            width: "100%",
            textAlign: "left",
            fontSize: 15,
            color: "rgba(255,255,255,0.35)",
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
            fontWeight: 500,
            marginTop: 8,
            transition: "all 0.15s",
          }}
        >
          + New board
        </button>
      </div>

      {/* Wizard watermark — decorative background */}
      <div style={{
        position: "absolute",
        bottom: 44,
        left: "50%",
        transform: "translateX(-50%)",
        width: 340,
        height: 340,
        backgroundImage: "url(/wizard-watermark.png)",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center bottom",
        opacity: 0.18,
        pointerEvents: "none",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 30%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 30%)",
      }} />

      {/* Sync footer — only in expanded view */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px" }}>
        <SyncStatus
          syncState={syncState}
          syncError={syncError}
          lastSyncedAt={meta?.settings.lastSyncedAt || null}
          hasRepo={hasRepo}
          onSync={onSync}
          onOpenSettings={onOpenSyncSettings}
        />
      </div>

      {/* Delete confirmation */}
      {confirmDelete && deletingBoard && (
        <ConfirmDialog
          title="Delete Board"
          message={`Are you sure you want to delete "${deletingBoard.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => onRemoveBoard(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
