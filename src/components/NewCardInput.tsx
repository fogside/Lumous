import { useState, useRef } from "react";
import { BoardTheme } from "../lib/types";

interface Props {
  onAdd: (title: string) => void;
  theme: BoardTheme;
}

export function NewCardInput({ onAdd, theme }: Props) {
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
          color: theme.textTertiary,
          padding: "12px 16px",
          borderRadius: 12,
          background: "transparent",
          border: `1px dashed ${theme.borderSubtle}`,
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
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "14px 18px",
        fontSize: 14,
        color: theme.text,
        outline: "none",
        fontWeight: 500,
      }}
    />
  );
}
