import { useEffect, useState } from "react";
import { getWizardTheme } from "./WizardCelebration";

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  color: string;
}

let counter = 0;

function createSparkles(x: number, y: number, palette: string[], count = 20): Sparkle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * 360;
    return {
      id: counter++,
      x,
      y,
      size: 5 + Math.random() * 10,
      angle,
      distance: 40 + Math.random() * 100,
      duration: 700 + Math.random() * 700,
      delay: Math.random() * 250,
      color: palette[Math.floor(Math.random() * palette.length)],
    };
  });
}

export interface SparkleEvent {
  x: number;
  y: number;
  key: number;
}

export function SparkleEffect({ event, boardColor }: { event: SparkleEvent | null; boardColor?: string }) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    if (!event) return;
    const palette = getWizardTheme(boardColor || "#556B2F").palette;
    const newSparkles = createSparkles(event.x, event.y, palette);
    setSparkles(newSparkles);
    const timer = setTimeout(() => setSparkles([]), 1700);
    return () => clearTimeout(timer);
  }, [event]);

  if (sparkles.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {sparkles.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * s.distance;
        const ty = Math.sin(rad) * s.distance;
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              pointerEvents: "none",
              animation: `sparkle-fly ${s.duration}ms ${s.delay}ms ease-out forwards`,
              ["--tx" as string]: `${tx}px`,
              ["--ty" as string]: `${ty}px`,
            }}
          >
            {/* 4-pointed star shape */}
            <svg
              width={s.size}
              height={s.size}
              viewBox="0 0 20 20"
              fill={s.color}
            >
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
            </svg>
          </div>
        );
      })}
      <style>{`
        @keyframes sparkle-fly {
          0% {
            transform: translate(0, 0) scale(0.3) rotate(0deg);
            opacity: 0;
          }
          15% {
            transform: translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)) scale(1.2) rotate(30deg);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0) rotate(200deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
