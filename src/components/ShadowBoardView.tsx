import { useState, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Board } from "../lib/types";

interface Props {
  board: Board;
  onClose: () => void;
}

// ─── Utilities ───

function groupByDate(timestamps: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const date = ts.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }
  return counts;
}

function getLastNWeeks(n: number): string[] {
  const days: string[] = [];
  const total = n * 7;
  const now = new Date();
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getIntensity(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function intensityToAlpha(intensity: number): number {
  switch (intensity) {
    case 0: return 0.06;
    case 1: return 0.25;
    case 2: return 0.45;
    case 3: return 0.65;
    case 4: return 0.9;
    default: return 0.06;
  }
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Demo data ───

function generateDemoData(): { completionLog: string[]; creationTimestamps: string[] } {
  const completionLog: string[] = [];
  const creationTimestamps: string[] = [];
  const now = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const baseChance = isWeekday ? 0.7 : 0.25;
    if (Math.random() < baseChance) {
      const count = Math.floor(Math.random() * 4) + 1;
      for (let c = 0; c < count; c++) {
        const ts = new Date(d);
        ts.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
        completionLog.push(ts.toISOString());
      }
    }
    if (Math.random() < baseChance * 1.1) {
      const count = Math.floor(Math.random() * 5) + 1;
      for (let c = 0; c < count; c++) {
        const ts = new Date(d);
        ts.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
        creationTimestamps.push(ts.toISOString());
      }
    }
  }
  return { completionLog, creationTimestamps };
}

// ─── Tooltip ───

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", left: x, top: y - 36,
      transform: "translateX(-50%)",
      padding: "4px 10px", borderRadius: 6,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
      fontVariantNumeric: "tabular-nums",
    }}>
      {children}
    </div>
  );
}

// ─── HeatmapGrid (fills available space) ───

function HeatmapGrid({ counts, days, color }: {
  counts: Record<string, number>;
  days: string[];
  color: string;
}) {
  const [hover, setHover] = useState<{ day: string; x: number; y: number } | null>(null);
  const max = Math.max(...Object.values(counts), 0);
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  const firstDayOfWeek = new Date(days[0]).getDay();
  for (let i = 0; i < firstDayOfWeek; i++) currentWeek.push("");
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push("");
    weeks.push(currentWeek);
  }

  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== "");
    if (!firstDay) return;
    const month = new Date(firstDay).getMonth();
    if (month !== lastMonth) { monthLabels.push({ weekIndex: wi, label: MONTH_NAMES[month] }); lastMonth = month; }
  });

  const gap = 3;
  const hoverCount = hover ? (counts[hover.day] || 0) : 0;
  const hoverFormatted = hover
    ? new Date(hover.day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}
      onMouseLeave={() => setHover(null)}
    >
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          {hoverFormatted} — <span style={{ color }}>{hoverCount}</span> task{hoverCount !== 1 ? "s" : ""}
        </Tooltip>
      )}
      {/* Month labels */}
      <div style={{ display: "flex", paddingLeft: 32, marginBottom: 4, gap }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find((m) => m.weekIndex === wi);
          return (
            <div key={wi} style={{
              flex: 1, fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600,
              whiteSpace: "nowrap", overflow: "visible",
            }}>
              {ml?.label || ""}
            </div>
          );
        })}
      </div>
      {/* Grid with day labels */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap, width: 32, flexShrink: 0 }}>
          {DAY_LABELS.map((l, i) => (
            <div key={i} style={{
              flex: 1, fontSize: 11, color: "rgba(255,255,255,0.2)",
              fontWeight: 600, display: "flex", alignItems: "center",
            }}>{l}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", gap, minWidth: 0 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} style={{ flex: 1, borderRadius: 3 }} />;
                const count = counts[day] || 0;
                const intensity = getIntensity(count, max);
                const alpha = intensityToAlpha(intensity);
                const isHovered = hover?.day === day;
                return (
                  <div
                    key={day}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHover({ day, x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    style={{
                      flex: 1, borderRadius: 3,
                      backgroundColor: count > 0 ? color : "rgba(255,255,255,0.06)",
                      opacity: count > 0 ? alpha : 1,
                      cursor: "default",
                      outline: isHovered ? `2px solid rgba(255,255,255,0.5)` : "none",
                      outlineOffset: -1,
                      transition: "outline 0.1s",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DailyPlot (SVG area chart) ───

function DailyPlot({ counts, days, color, label, total }: {
  counts: Record<string, number>;
  days: string[];
  color: string;
  label: string;
  total: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const values = days.map((d) => counts[d] || 0);
  const max = Math.max(...values, 1);

  // 3-day rolling average
  const smoothed = values.map((_, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(values.length - 1, i + 1);
    let sum = 0, count = 0;
    for (let j = start; j <= end; j++) { sum += values[j]; count++; }
    return sum / count;
  });

  const w = 400;
  const h = 140;
  const padTop = 6;
  const padBot = 28;
  const plotH = h - padTop - padBot;

  const pointCoords = smoothed.map((v, i) => ({
    x: (i / (smoothed.length - 1)) * w,
    y: padTop + plotH - (v / max) * plotH,
  }));

  const linePath = `M${pointCoords.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const areaPath = `${linePath} L${w},${padTop + plotH} L0,${padTop + plotH} Z`;

  // Month tick labels
  const monthTicks: { x: number; label: string }[] = [];
  let prevMonth = -1;
  days.forEach((d, i) => {
    const month = new Date(d).getMonth();
    if (month !== prevMonth) {
      monthTicks.push({ x: (i / (days.length - 1)) * w, label: MONTH_NAMES[month] });
      prevMonth = month;
    }
  });

  const activeDays = values.filter((v) => v > 0).length;
  const avg = activeDays > 0 ? (total / activeDays).toFixed(1) : "0";

  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (days.length - 1));
    const clamped = Math.max(0, Math.min(days.length - 1, idx));
    setHoverIdx(clamped);
    // Convert SVG coord to screen coord for the DOM tooltip
    const screenX = rect.left + (pointCoords[clamped].x / w) * rect.width;
    const screenY = rect.top + (pointCoords[clamped].y / h) * rect.height;
    setTooltipPos({ x: screenX, y: screenY });
  };

  const hoverDay = hoverIdx !== null ? days[hoverIdx] : null;
  const hoverVal = hoverIdx !== null ? values[hoverIdx] : 0;
  const hoverCoord = hoverIdx !== null ? pointCoords[hoverIdx] : null;
  const hoverFormatted = hoverDay
    ? new Date(hoverDay).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
          {total} total
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
          {avg} avg/active day
        </span>
      </div>
      {tooltipPos && hoverIdx !== null && (
        <Tooltip x={tooltipPos.x} y={tooltipPos.y}>
          {hoverFormatted} — <span style={{ color }}>{hoverVal}</span>
        </Tooltip>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setHoverIdx(null); setTooltipPos(null); }}
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((r) => (
            <line key={r}
              x1={0} y1={padTop + plotH * (1 - r)} x2={w} y2={padTop + plotH * (1 - r)}
              stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"
            />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill={`url(#grad-${label})`} />
          {/* Line */}
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" opacity="0.7" />
          {/* Hover crosshair + dot */}
          {hoverCoord && (
            <>
              <line
                x1={hoverCoord.x} y1={padTop} x2={hoverCoord.x} y2={padTop + plotH}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3"
              />
              <circle
                cx={hoverCoord.x} cy={hoverCoord.y} r="5"
                fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="2"
              />
            </>
          )}
          {/* Month labels — tilted */}
          {monthTicks.map((t, i) => (
            <text key={i} x={0} y={0}
              transform={`translate(${t.x + 4}, ${h - 4}) rotate(-40)`}
              fill="rgba(255,255,255,0.2)" fontSize="12" fontWeight="600"
              textAnchor="start"
            >{t.label}</text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── Main ───

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("[data-no-drag]")) return;
  getCurrentWindow().startDragging();
}

function computeStreaks(counts: Record<string, number>, days: string[]) {
  let bestStreak = 0, cur = 0, streak = 0;
  for (const day of days) {
    if ((counts[day] || 0) > 0) { cur++; bestStreak = Math.max(bestStreak, cur); }
    else cur = 0;
  }
  for (let i = days.length - 1; i >= 0; i--) {
    if ((counts[days[i]] || 0) > 0) streak++;
    else break;
  }
  const activeDays = days.filter((d) => (counts[d] || 0) > 0).length;
  const maxDay = Math.max(...days.map((d) => counts[d] || 0), 0);
  return { bestStreak, streak, activeDays, maxDay };
}

function Indicators({ items }: { items: { value: string | number; label: string }[] }) {
  return (
    <div style={{
      display: "flex", gap: 16, marginTop: 10, fontSize: 12,
      color: "rgba(255,255,255,0.25)", fontWeight: 500, fontVariantNumeric: "tabular-nums",
      flexShrink: 0,
    }}>
      {items.map((item, i) => (
        <span key={i}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{item.value}</span>
          {" "}{item.label}
        </span>
      ))}
    </div>
  );
}

export function ShadowBoardView({ board, onClose }: Props) {
  const numWeeks = 13;
  const days = getLastNWeeks(numWeeks);

  const hasRealData = (board.completionLog?.length || 0) > 0 ||
    Object.values(board.cards).some((c) => c.completedAt);

  const [showDemo] = useState(!hasRealData);
  const [demoData] = useState(() => generateDemoData());

  const completionTimestamps = showDemo ? demoData.completionLog : (board.completionLog || []);
  const creationTimestamps = showDemo
    ? demoData.creationTimestamps
    : Object.values(board.cards).map((c) => c.createdAt);

  const completionCounts = groupByDate(completionTimestamps);
  const creationCounts = groupByDate(creationTimestamps);

  const periodCompletions = completionTimestamps.filter((ts) => days.includes(ts.slice(0, 10)));
  const periodCreations = creationTimestamps.filter((ts) => days.includes(ts.slice(0, 10)));

  const compStats = computeStreaks(completionCounts, days);
  const createStats = computeStreaks(creationCounts, days);

  return (
    <div
      onMouseDown={startWindowDrag}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: board.backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div onMouseDown={startWindowDrag} style={{
        padding: "36px 36px 0 36px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button onClick={onClose} data-no-drag style={{
          width: 30, height: 30, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0 }}>
          {board.title}
        </h1>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.2)",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Shadow Board
        </span>
        {showDemo && (
          <span style={{
            marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.2)",
            fontWeight: 500, padding: "3px 8px", borderRadius: 5,
            background: "rgba(255,255,255,0.05)",
          }}>
            Sample data
          </span>
        )}
      </div>

      {/* 2x2 grid */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "3fr 2fr",
        gridTemplateRows: "1fr 1fr",
        gap: 14,
        padding: "18px 36px 28px 36px",
        minHeight: 0,
      }}>
        {/* Top-left: Completion heatmap */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#CD9B3C", opacity: 0.85 }}>
              Tasks Completed
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {periodCompletions.length} in {numWeeks}w
            </span>
          </div>
          <HeatmapGrid counts={completionCounts} days={days} color="#CD9B3C" />
          <Indicators items={[
            { value: compStats.streak, label: "streak" },
            { value: compStats.bestStreak, label: "best" },
            { value: compStats.activeDays, label: "active days" },
            { value: compStats.maxDay, label: "max/day" },
          ]} />
        </div>

        {/* Top-right: Completion daily plot */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: 0,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#CD9B3C",
            marginBottom: 4, opacity: 0.85, flexShrink: 0,
          }}>
            Completed / Day
          </div>
          <DailyPlot
            counts={completionCounts}
            days={days}
            color="#CD9B3C"
            label="completed"
            total={periodCompletions.length}
          />
        </div>

        {/* Bottom-left: Creation heatmap */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#6B8E6B", opacity: 0.85 }}>
              Tasks Created
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {periodCreations.length} in {numWeeks}w
            </span>
          </div>
          <HeatmapGrid counts={creationCounts} days={days} color="#6B8E6B" />
          <Indicators items={[
            { value: createStats.activeDays, label: "active days" },
            { value: createStats.maxDay, label: "max/day" },
            { value: periodCreations.length > 0
              ? (periodCreations.length / Math.max(createStats.activeDays, 1)).toFixed(1)
              : "0", label: "avg/day" },
          ]} />
        </div>

        {/* Bottom-right: Creation daily plot */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: 0,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#6B8E6B",
            marginBottom: 4, opacity: 0.85, flexShrink: 0,
          }}>
            Created / Day
          </div>
          <DailyPlot
            counts={creationCounts}
            days={days}
            color="#6B8E6B"
            label="created"
            total={periodCreations.length}
          />
        </div>
      </div>
    </div>
  );
}
