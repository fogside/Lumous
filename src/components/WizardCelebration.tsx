import { useEffect, useState } from "react";

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

let sparkleCounter = 0;

function createTrailSparkles(count = 30): TrailSparkle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: sparkleCounter++,
    size: 6 + Math.random() * 14,
    duration: 900 + Math.random() * 700,
    delay: i * 35 + Math.random() * 60,
    color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
    spread: (Math.random() - 0.5) * 140,
    burstX: (Math.random() - 0.5) * 90,
    burstY: (Math.random() - 0.5) * 90,
  }));
}

type Variant = "bottom" | "top" | "right" | "left";

let lastVariant: Variant | null = null;

function pickVariant(): Variant {
  const variants: Variant[] = ["bottom", "top", "right", "left"];
  const available = variants.filter((v) => v !== lastVariant);
  const picked = available[Math.floor(Math.random() * available.length)];
  lastVariant = picked;
  return picked;
}

interface VariantConfig {
  wizardStyle: React.CSSProperties;
  imgTransform: string;
  wandAnchor: React.CSSProperties;
  animName: string;
  trailAnim: string;
}

function getVariantConfig(variant: Variant): VariantConfig {
  switch (variant) {
    case "bottom":
      return {
        wizardStyle: { bottom: 0, left: "50%" },
        imgTransform: "",
        wandAnchor: { bottom: 290, left: "calc(50% + 80px)" },
        animName: "wiz-bottom",
        trailAnim: "trail-bottom",
      };
    case "top":
      return {
        wizardStyle: { top: 0, left: "50%" },
        imgTransform: "rotate(180deg)",
        wandAnchor: { top: 290, left: "calc(50% - 80px)" },
        animName: "wiz-top",
        trailAnim: "trail-top",
      };
    case "right":
      // Entering from right: head should point LEFT into the board
      // scaleX(-1) first mirrors wand to left side, then rotate(-90deg) puts head left, wand at bottom
      return {
        wizardStyle: { top: "50%", right: 0 },
        imgTransform: "rotate(-90deg) scaleX(-1)",
        wandAnchor: { top: "calc(50% + 80px)", right: 290 },
        animName: "wiz-right",
        trailAnim: "trail-right",
      };
    case "left":
      // Entering from left: head should point RIGHT into the board
      // rotate(90deg) = clockwise = top(head) goes RIGHT
      return {
        wizardStyle: { top: "50%", left: 0 },
        imgTransform: "rotate(90deg) scaleX(-1)",
        wandAnchor: { top: "calc(50% - 80px)", left: 290 },
        animName: "wiz-left",
        trailAnim: "trail-left",
      };
  }
}

export function WizardCelebration({ visible }: { visible: boolean }) {
  // Pick variant and sparkles once on mount (key change = re-mount = new variant)
  const [variant] = useState<Variant>(pickVariant);
  const [sparkles] = useState<TrailSparkle[]>(createTrailSparkles);
  const [show, setShow] = useState(false);
  const [sparklesReady, setSparklesReady] = useState(false);

  const config = getVariantConfig(variant);

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

  const isHorizontal = variant === "left" || variant === "right";
  const wizW = isHorizontal ? 360 : 280;
  const wizH = isHorizontal ? 280 : 360;

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
      {/* Wizard image */}
      <div
        style={{
          position: "absolute",
          ...config.wizardStyle,
          width: wizW,
          height: wizH,
          animation: `${config.animName} 3.2s ease-in-out forwards`,
        }}
      >
        <img
          src="/wizard-gold.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: config.imgTransform,
            filter:
              "drop-shadow(0 0 18px rgba(255,215,0,0.4)) drop-shadow(0 0 40px rgba(255,215,0,0.15))",
          }}
        />
      </div>

      {/* Trail sparkles */}
      {sparklesReady &&
        sparkles.map((s) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              ...config.wandAnchor,
              width: s.size,
              height: s.size,
              animation: `${config.trailAnim} ${s.duration}ms ${s.delay}ms ease-out forwards`,
              opacity: 0,
              ["--spread" as string]: `${s.spread}px`,
            }}
          >
            <svg width={s.size} height={s.size} viewBox="0 0 20 20" fill={s.color}>
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
            </svg>
          </div>
        ))}

      {/* Burst sparkles around wand tip */}
      {sparklesReady &&
        sparkles.slice(0, 12).map((s) => (
          <div
            key={`b-${s.id}`}
            style={{
              position: "absolute",
              ...config.wandAnchor,
              width: s.size * 0.7,
              height: s.size * 0.7,
              animation: `wand-burst ${s.duration * 0.5}ms ${s.delay * 0.4}ms ease-out forwards`,
              opacity: 0,
              ["--bx" as string]: `${s.burstX}px`,
              ["--by" as string]: `${s.burstY}px`,
            }}
          >
            <svg width={s.size * 0.7} height={s.size * 0.7} viewBox="0 0 20 20" fill={s.color}>
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
            </svg>
          </div>
        ))}

      <style>{`
        @keyframes wiz-bottom {
          0%   { transform: translateX(-50%) translateY(100%); opacity: 0; }
          12%  { opacity: 1; }
          25%  { transform: translateX(-50%) translateY(20px); }
          35%  { transform: translateX(-50%) translateY(30px); }
          70%  { opacity: 1; transform: translateX(-50%) translateY(25px); }
          100% { transform: translateX(-50%) translateY(100%); opacity: 0; }
        }
        @keyframes wiz-top {
          0%   { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          12%  { opacity: 1; }
          25%  { transform: translateX(-50%) translateY(-20px); }
          35%  { transform: translateX(-50%) translateY(-30px); }
          70%  { opacity: 1; transform: translateX(-50%) translateY(-25px); }
          100% { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        }
        @keyframes wiz-right {
          0%   { transform: translateY(-50%) translateX(100%); opacity: 0; }
          12%  { opacity: 1; }
          25%  { transform: translateY(-50%) translateX(20px); }
          35%  { transform: translateY(-50%) translateX(30px); }
          70%  { opacity: 1; transform: translateY(-50%) translateX(25px); }
          100% { transform: translateY(-50%) translateX(100%); opacity: 0; }
        }
        @keyframes wiz-left {
          0%   { transform: translateY(-50%) translateX(-100%); opacity: 0; }
          12%  { opacity: 1; }
          25%  { transform: translateY(-50%) translateX(-20px); }
          35%  { transform: translateY(-50%) translateX(-30px); }
          70%  { opacity: 1; transform: translateY(-50%) translateX(-25px); }
          100% { transform: translateY(-50%) translateX(-100%); opacity: 0; }
        }

        @keyframes trail-bottom {
          0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; transform: translate(calc(var(--spread) * 0.08), 5px) scale(1.3); }
          45%  { opacity: 0.9; }
          100% { transform: translate(calc(300px + var(--spread)), -600px) scale(0); opacity: 0; }
        }
        @keyframes trail-top {
          0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; transform: translate(calc(var(--spread) * 0.08), -5px) scale(1.3); }
          45%  { opacity: 0.9; }
          100% { transform: translate(calc(300px + var(--spread)), 600px) scale(0); opacity: 0; }
        }
        @keyframes trail-right {
          0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; transform: translate(-5px, calc(var(--spread) * 0.08)) scale(1.3); }
          45%  { opacity: 0.9; }
          100% { transform: translate(calc(-600px + var(--spread)), calc(-300px + var(--spread))) scale(0); opacity: 0; }
        }
        @keyframes trail-left {
          0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; transform: translate(5px, calc(var(--spread) * 0.08)) scale(1.3); }
          45%  { opacity: 0.9; }
          100% { transform: translate(calc(600px + var(--spread)), calc(-300px + var(--spread))) scale(0); opacity: 0; }
        }

        @keyframes wand-burst {
          0%   { transform: translate(0, 0) scale(0.2); opacity: 0; }
          20%  { opacity: 1; transform: translate(calc(var(--bx) * 0.3), calc(var(--by) * 0.3)) scale(1.4); }
          100% { transform: translate(var(--bx), var(--by)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
