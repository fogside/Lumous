import { useState, useRef } from "react";

interface Props {
  onAdd: (title: string) => void;
}

export function NewCardInput({ onAdd }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        style={{
          width: "100%",
          textAlign: "left",
          fontSize: 13,
          color: "rgba(255,255,255,0.25)",
          padding: "12px 16px",
          borderRadius: 12,
          background: "transparent",
          border: "1px dashed rgba(255,255,255,0.08)",
          cursor: "pointer",
          fontWeight: 500,
          transition: "all 0.15s",
        }}
      >
        + Add card
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSubmit();
        if (e.key === "Escape") {
          setIsOpen(false);
          setValue("");
        }
      }}
      onBlur={() => {
        if (!value.trim()) {
          setIsOpen(false);
        }
      }}
      autoFocus
      placeholder="Card title..."
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "14px 18px",
        fontSize: 14,
        color: "white",
        outline: "none",
        fontWeight: 500,
      }}
    />
  );
}
