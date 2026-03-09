import { useMemo } from "react";
import { getWizardTheme } from "./WizardCelebration";

interface Wisp {
  id: number;
  x: number;
  y: number;
  size: number;
  driftDuration: number;
  pulseDuration: number;
  delay: number;
  driftX: number;
  driftY: number;
  color: string;
  opacity: number;
}

function createWisps(palette: string[], count: number, opacityRange: [number, number]): Wisp[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 55,
    size: 2 + Math.random() * 3,
    driftDuration: 12000 + Math.random() * 16000,
    pulseDuration: 3000 + Math.random() * 4000,
    delay: -(Math.random() * 20000),
    driftX: (Math.random() - 0.5) * 180,
    driftY: (Math.random() - 0.5) * 100,
    color: palette[Math.floor(Math.random() * palette.length)],
    opacity: opacityRange[0] + Math.random() * (opacityRange[1] - opacityRange[0]),
  }));
}

interface Props {
  boardColor: string;
  isLight: boolean;
  visible: boolean;
}

export function BackgroundWisps({ boardColor, isLight, visible }: Props) {
  if (isLight || !visible) return null;

  const theme = getWizardTheme(boardColor);
  const brightWisps = useMemo(() => createWisps(theme.palette, 24, [0.15, 0.35]), [boardColor]);
  const dimWisps = useMemo(() => createWisps(theme.palette, 18, [0.04, 0.1]), [boardColor]);

  const renderWisp = (w: Wisp, prefix: string) => (
    <div
      key={`${prefix}-${w.id}`}
      style={{
        position: "absolute",
        left: `${w.x}%`,
        top: `${w.y}%`,
        width: w.size,
        height: w.size,
        borderRadius: "50%",
        background: w.color,
        boxShadow: `0 0 ${w.size + 2}px 1px ${w.color}`,
        opacity: 0,
        filter: `blur(${w.size * 0.3}px)`,
        animation: `wisp-drift ${w.driftDuration}ms ${w.delay}ms ease-in-out infinite, wisp-pulse ${w.pulseDuration}ms ${w.delay}ms ease-in-out infinite`,
        ["--dx" as string]: `${w.driftX}px`,
        ["--dy" as string]: `${w.driftY}px`,
        ["--op" as string]: w.opacity,
        ["--op-hi" as string]: Math.min(w.opacity * 1.8, 0.45),
      }}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {dimWisps.map((w) => renderWisp(w, "dim"))}
      {brightWisps.map((w) => renderWisp(w, "bright"))}

      <style>{`
        @keyframes wisp-drift {
          0%   { transform: translate(0, 0); opacity: 0; }
          10%  { opacity: var(--op); }
          50%  { transform: translate(var(--dx), var(--dy)); }
          90%  { opacity: var(--op); }
          100% { transform: translate(0, 0); opacity: 0; }
        }
        @keyframes wisp-pulse {
          0%, 100% { opacity: var(--op); }
          50%      { opacity: var(--op-hi); }
        }
      `}</style>
    </div>
  );
}
