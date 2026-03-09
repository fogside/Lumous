import { useState, useEffect } from "react";
import { COLOR_GROUPS } from "../lib/types";

interface Props {
  title: string;
  backgroundColor: string;
  onSave: (title: string, color: string) => void;
  onClose: () => void;
}

export function BoardSettingsModal({ title: initialTitle, backgroundColor, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState(backgroundColor);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#0c0c14] border border-white/10 rounded-3xl w-[560px] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "40px 44px" }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: 32 }}>
          Board Settings
        </h2>

        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          Title
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(title.trim() || initialTitle, color);
              onClose();
            }
          }}
          autoFocus
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 15,
            color: "white",
            outline: "none",
            marginBottom: 28,
          }}
        />

        <div
          style={{
            backgroundColor: color,
            borderRadius: 16,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            transition: "background-color 0.2s",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 500 }}>
            {title.trim() || initialTitle}
          </span>
        </div>

        {COLOR_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>
              {group.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {group.colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    backgroundColor: c,
                    aspectRatio: "2 / 1",
                    borderRadius: 12,
                    border: color === c ? "2px solid white" : "2px solid transparent",
                    outline: color === c ? "2px solid rgba(255,255,255,0.3)" : "none",
                    outlineOffset: 2,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    transform: color === c ? "scale(1.05)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 36 }}>
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
              onSave(title.trim() || initialTitle, color);
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
