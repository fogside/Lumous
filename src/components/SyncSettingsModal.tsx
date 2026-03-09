import { useState, useEffect } from "react";
import { Meta } from "../lib/types";

interface Props {
  settings: Meta["settings"];
  onSave: (settings: Partial<Meta["settings"]>) => void;
  onClose: () => void;
}

export function SyncSettingsModal({ settings, onSave, onClose }: Props) {
  const [repoUrl, setRepoUrl] = useState(settings.syncRepoUrl);
  const [interval, setInterval] = useState(String(settings.syncIntervalMinutes));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c0c14",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          width: 520,
          maxWidth: "90vw",
          padding: "40px 44px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: 8 }}>
          GitHub Sync
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, marginBottom: 32 }}>
          Sync your boards to a private GitHub repository so they're backed up and accessible across devices.
        </p>

        {/* Repository URL */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          Repository URL
        </div>
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://TOKEN@github.com/user/repo.git"
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 14,
            color: "white",
            outline: "none",
            fontFamily: "SF Mono, Menlo, monospace",
            marginBottom: 8,
          }}
        />
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, marginBottom: 28 }}>
          Create a <span style={{ color: "rgba(255,255,255,0.4)" }}>Personal Access Token</span> on GitHub with repo permissions, then use the format above.
        </p>

        {/* Auto-sync interval */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          Auto-sync interval
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            min="1"
            max="60"
            style={{
              width: 80,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: "white",
              outline: "none",
              textAlign: "center",
            }}
          />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>minutes</span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.5)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                syncRepoUrl: repoUrl.trim(),
                syncIntervalMinutes: Math.max(1, parseInt(interval) || 5),
              });
              onClose();
            }}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "white",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
