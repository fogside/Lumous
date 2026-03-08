import { useEffect, useState, useMemo } from "react";

interface TrailSparkle {
  id: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  spread: number;
  burstX: number;
  burstY: number;
}

const GOLD_PALETTE = [
  "#FFD700",
  "#FFC125",
  "#EDBA3C",
  "#F5D78E",
  "#FFE4A0",
  "#CD9B3C",
  "#FFEC8B",
  "#FFF8DC",
];

let counter = 0;

function createTrailSparkles(count = 30): TrailSparkle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: counter++,
    size: 6 + Math.random() * 14,
    duration: 900 + Math.random() * 700,
    delay: i * 35 + Math.random() * 60,
    color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
    spread: (Math.random() - 0.5) * 140,
    burstX: (Math.random() - 0.5) * 90,
    burstY: (Math.random() - 0.5) * 90,
  }));
}

export function WizardCelebration({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(false);
  const [sparklesReady, setSparklesReady] = useState(false);
  const sparkles = useMemo(() => (visible ? createTrailSparkles() : []), [visible]);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    setSparklesReady(false);

    const sparkleTimer = setTimeout(() => setSparklesReady(true), 350);
    const hideTimer = setTimeout(() => {
      setShow(false);
      setSparklesReady(false);
    }, 3200);

    return () => {
      clearTimeout(sparkleTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Wizard image — slides up from bottom-center */}
      <div
        className="wizard-celebration-img"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          width: 280,
          height: 360,
          animation: "wizard-rise 3.2s ease-in-out forwards",
        }}
      >
        <img
          src="/wizard-gold.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "bottom",
            filter: "drop-shadow(0 0 18px rgba(255,215,0,0.4)) drop-shadow(0 0 40px rgba(255,215,0,0.15))",
          }}
        />
      </div>

      {/* Trail sparkles: fly from wand tip toward top-right corner */}
      {/* Wand tip position: wizard is 280px wide centered at 50%, image aspect ~675:860 */}
      {/* Wand tip in original image is ~top-right → roughly left:50%+80px, bottom:~290px */}
      {sparklesReady &&
        sparkles.map((s) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              bottom: 290,
              left: "calc(50% + 80px)",
              width: s.size,
              height: s.size,
              animation: `trail-fly ${s.duration}ms ${s.delay}ms ease-out forwards`,
              opacity: 0,
              ["--spread" as string]: `${s.spread}px`,
            }}
          >
            <svg width={s.size} height={s.size} viewBox="0 0 20 20" fill={s.color}>
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
            </svg>
          </div>
        ))}

      {/* Burst sparkles around the wand tip */}
      {sparklesReady &&
        sparkles.slice(0, 12).map((s) => (
          <div
            key={`b-${s.id}`}
            style={{
              position: "absolute",
              bottom: 290,
              left: "calc(50% + 80px)",
              width: s.size * 0.7,
              height: s.size * 0.7,
              animation: `wand-burst ${s.duration * 0.5}ms ${s.delay * 0.4}ms ease-out forwards`,
              opacity: 0,
              ["--bx" as string]: `${s.burstX}px`,
              ["--by" as string]: `${s.burstY}px`,
            }}
          >
            <svg
              width={s.size * 0.7}
              height={s.size * 0.7}
              viewBox="0 0 20 20"
              fill={s.color}
            >
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
            </svg>
          </div>
        ))}

      <style>{`
        @keyframes wizard-rise {
          0% {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          25% {
            transform: translateX(-50%) translateY(20px);
          }
          35% {
            transform: translateX(-50%) translateY(30px);
          }
          70% {
            opacity: 1;
            transform: translateX(-50%) translateY(25px);
          }
          100% {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
        }
        @keyframes trail-fly {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 0;
          }
          12% {
            opacity: 1;
            transform: translate(calc(var(--spread) * 0.08), 5px) scale(1.3);
          }
          45% {
            opacity: 0.9;
          }
          100% {
            transform: translate(
              calc(300px + var(--spread)),
              -600px
            ) scale(0);
            opacity: 0;
          }
        }
        @keyframes wand-burst {
          0% {
            transform: translate(0, 0) scale(0.2);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(calc(var(--bx) * 0.3), calc(var(--by) * 0.3)) scale(1.4);
          }
          100% {
            transform: translate(var(--bx), var(--by)) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
