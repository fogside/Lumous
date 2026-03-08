interface Props {
  syncState: "idle" | "syncing" | "success" | "error";
  syncError: string;
  lastSyncedAt: string | null;
  hasRepo: boolean;
  onSync: () => void;
  onOpenSettings: () => void;
}

export function SyncStatus({ syncState, syncError, lastSyncedAt, hasRepo, onSync, onOpenSettings }: Props) {
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Sync button / status */}
      {hasRepo ? (
        <button
          onClick={onSync}
          disabled={syncState === "syncing"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: syncState === "error" ? "rgba(248,113,113,0.7)" : "rgba(255,255,255,0.4)",
            background: "transparent",
            border: "none",
            cursor: syncState === "syncing" ? "default" : "pointer",
            padding: "8px 4px",
            opacity: syncState === "syncing" ? 0.6 : 1,
            fontWeight: 500,
            textAlign: "left",
            width: "100%",
          }}
        >
          <span style={{ fontSize: 14 }}>
            {syncState === "syncing" ? "↻" : syncState === "success" ? "✓" : syncState === "error" ? "✗" : "↑"}
          </span>
          <span>
            {syncState === "syncing"
              ? "Syncing..."
              : syncState === "success"
              ? "Synced"
              : syncState === "error"
              ? "Sync failed"
              : lastSyncedAt
              ? `Synced ${formatTime(lastSyncedAt)}`
              : "Sync now"}
          </span>
        </button>
      ) : (
        <button
          onClick={onOpenSettings}
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.3)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "8px 4px",
            fontWeight: 500,
            textAlign: "left",
            width: "100%",
          }}
        >
          Set up GitHub sync...
        </button>
      )}

      {syncState === "error" && syncError && (
        <p style={{ fontSize: 11, color: "rgba(248,113,113,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }} title={syncError}>
          {syncError}
        </p>
      )}

      {/* Settings gear — only when repo is configured */}
      {hasRepo && (
        <button
          onClick={onOpenSettings}
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.2)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 4px",
            fontWeight: 500,
            textAlign: "left",
          }}
        >
          Sync settings...
        </button>
      )}
    </div>
  );
}
