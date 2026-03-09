import { useEffect } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }: Props) {
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
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c0c14",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          width: 420,
          maxWidth: "90vw",
          padding: "36px 40px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: 12 }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32 }}>
          {message}
        </p>
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
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "white",
              background: danger ? "rgba(220,80,80,0.25)" : "rgba(255,255,255,0.12)",
              border: danger ? "1px solid rgba(220,80,80,0.3)" : "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
