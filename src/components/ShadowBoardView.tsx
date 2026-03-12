import { useState, useRef, useMemo, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Board, Goal, Card, RitualLogEntry, CARD_LABELS, getBoardTheme, isLightBoard, BoardTheme } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { BackgroundWisps } from "./BackgroundWisps";
import { useWindowSize } from "../hooks/useWindowSize";

interface Props {
  board: Board;
  onClose: () => void;
  onUpdateBoard?: (board: Board) => void;
  showWisps?: boolean;
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

// ─── Goal stats computation ───

interface GoalDayData {
  date: string;
  isScheduled: boolean;
  isCompleted: boolean;
  isToday: boolean;
}

function computeGoalStats(
  goalId: string,
  ritualLog: RitualLogEntry[],
  cards: Record<string, Card>,
  goalCreatedAt?: string,
  numPastDays: number = 90,
) {
  const ritualCards = Object.values(cards).filter((c) => c.goalId === goalId && c.ritual);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Clamp to goal creation date — don't show days before the goal existed
  const createdDate = goalCreatedAt ? goalCreatedAt.slice(0, 10) : null;
  let effectiveDays = numPastDays;
  if (createdDate) {
    const createdMs = new Date(createdDate + "T12:00:00").getTime();
    const daysSinceCreation = Math.ceil((today.getTime() - createdMs) / (1000 * 60 * 60 * 24)) + 1;
    effectiveDays = Math.min(numPastDays, Math.max(1, daysSinceCreation));
  }

  const days: GoalDayData[] = [];

  for (let i = effectiveDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const isScheduled = ritualCards.some((card) => {
      if (!card.ritual) return false;
      if (card.ritual.schedule === "daily") return true;
      return Array.isArray(card.ritual.schedule) && card.ritual.schedule.includes(dayOfWeek);
    });
    const isCompleted = ritualLog.some((entry) => entry.date === dateStr && entry.goalId === goalId);
    days.push({ date: dateStr, isScheduled, isCompleted, isToday: dateStr === todayStr });
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let scheduledDays = 0;
  let completedDays = 0;

  for (const day of days) {
    if (!day.isScheduled) continue;
    scheduledDays++;
    if (day.isCompleted) {
      completedDays++;
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].isScheduled) continue;
    if (days[i].isCompleted) currentStreak++;
    else break;
  }

  const completionRate = scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : 0;
  return { days, currentStreak, bestStreak, completionRate, scheduledDays, completedDays };
}

// ─── Goal streak strip (wraps to multiple rows) ───

function GoalStreakStrip({ days, color, theme }: {
  days: GoalDayData[];
  color: string;
  theme: ReturnType<typeof getBoardTheme>;
}) {
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const handleHover = (e: React.MouseEvent, date: string, status: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ label: `${formatDate(date)}${status ? " — " + status : ""}`, x: rect.left + rect.width / 2, y: rect.top });
  };

  // Group into weeks
  const weeks: GoalDayData[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div style={{ position: "relative" }}
      onMouseLeave={() => setHover(null)}
    >
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>{hover.label}</Tooltip>
      )}
      {/* flexWrap lets it flow to multiple rows naturally */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", gap: 2 }}>
            {week.map((day) => {
              if (!day.isScheduled) {
                return (
                  <div
                    key={day.date}
                    onMouseEnter={(e) => handleHover(e, day.date, "")}
                    style={{
                      width: 4, height: 4, borderRadius: 2,
                      background: theme.borderSubtle,
                      margin: "2.5px 0.5px",
                      cursor: "default",
                    }}
                  />
                );
              }
              if (day.isCompleted) {
                return (
                  <div
                    key={day.date}
                    onMouseEnter={(e) => handleHover(e, day.date, "Done")}
                    style={{
                      width: 9, height: 9, borderRadius: 5,
                      background: color,
                      filter: `drop-shadow(0 0 3px ${color}80)`,
                      outline: day.isToday ? `2px solid ${theme.text}` : "none",
                      outlineOffset: 1,
                      cursor: "default",
                    }}
                  />
                );
              }
              return (
                <div
                  key={day.date}
                  onMouseEnter={(e) => handleHover(e, day.date, "Missed")}
                  style={{
                    width: 9, height: 9, borderRadius: 5,
                    border: `1.5px solid ${color}40`,
                    background: "transparent",
                    boxSizing: "border-box",
                    outline: day.isToday ? `2px solid ${theme.text}` : "none",
                    outlineOffset: 1,
                    cursor: "default",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Goal card ───

function formatDeadlineLabel(deadline: string): string {
  const now = new Date();
  const dl = new Date(deadline + "T12:00:00");
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Past deadline";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "1 day left";
  if (diffDays < 7) return `${diffDays} days left`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks left`;
  return `${Math.ceil(diffDays / 30)} months left`;
}

function DeadlineTimeline({ goal, theme }: {
  goal: Goal;
  theme: ReturnType<typeof getBoardTheme>;
}) {
  if (!goal.deadline) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const startStr = goal.createdAt?.slice(0, 10) || todayStr;
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(goal.deadline + "T12:00:00");
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const progress = Math.min(1, Math.max(0, elapsedDays / totalDays));
  const isPast = goal.deadline < todayStr;

  const deadlineFormatted = new Date(goal.deadline + "T12:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: end.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: theme.surface, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress * 100}%`,
          borderRadius: 3,
          background: isPast ? "rgba(220,80,80,0.5)" : `${goal.color}60`,
        }} />
        {!isPast && progress > 0 && progress < 1 && (
          <div style={{
            position: "absolute", left: `${progress * 100}%`, top: -1, bottom: -1,
            width: 2, borderRadius: 1,
            background: theme.text,
            transform: "translateX(-1px)",
          }} />
        )}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 4,
        fontSize: 10, fontWeight: 600, color: theme.textTertiary,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>{isPast ? "Past deadline" : formatDeadlineLabel(goal.deadline)}</span>
        <span style={{ color: isPast ? "rgba(220,80,80,0.6)" : theme.textTertiary }}>
          {deadlineFormatted}
        </span>
      </div>
    </div>
  );
}

function GoalCard({ goal, stats, cardCount, ritualCount, theme, onDelete }: {
  goal: Goal;
  stats: ReturnType<typeof computeGoalStats>;
  cardCount: number;
  ritualCount: number;
  theme: ReturnType<typeof getBoardTheme>;
  onDelete: () => void;
}) {
  const hasRituals = ritualCount > 0;
  const hasCards = cardCount > 0;

  return (
    <div
      className="goal-card"
      style={{
        padding: "14px 18px",
        borderRadius: 12,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        position: "relative",
        overflow: "hidden",
        transition: "none",
      }}
    >
      {/* Glow */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        overflow: "hidden", pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: -20, right: -20,
          width: 100, height: 100,
          background: `radial-gradient(circle, ${goal.color}40 0%, transparent 70%)`,
        }} />
      </div>

      {/* Delete button */}
      <button
        className="goal-delete-btn"
        onClick={onDelete}
        data-no-drag
        style={{
          position: "absolute", top: 8, right: 8,
          width: 18, height: 18, borderRadius: 5,
          background: "transparent", border: "none",
          color: theme.textTertiary, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, padding: 0,
          opacity: 0, transition: "opacity 0.15s",
        }}
      >
        ×
      </button>

      {/* Header: color dot + name + streak flame (padded right to avoid delete btn overlap) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 22 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5,
          background: goal.color,
          filter: `drop-shadow(0 0 4px ${goal.color}60)`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text, flex: 1 }}>
          {goal.name}
        </span>

        {hasRituals && stats.currentStreak > 0 && (
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 16, fontWeight: 800, color: goal.color,
            fontVariantNumeric: "tabular-nums",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={goal.color} stroke="none" style={{ opacity: 0.9 }}>
              <path d="M12 23c-3.866 0-7-2.686-7-6 0-2.418 1.613-4.16 2.5-5l1.5 2c.322-.905.5-2 .5-3 0-1.5-.5-3.5-2-5 2.033.506 4 2.5 5 4.5C13 9 13 7.5 12 5c3 1.5 6 5 6 9.5 0 4.171-2.686 8.5-6 8.5z"/>
            </svg>
            {stats.currentStreak}
          </span>
        )}
      </div>

      {/* Why */}
      {goal.why && (
        <div style={{
          fontSize: 12, color: theme.textSecondary, marginTop: 6,
          lineHeight: 1.5, fontStyle: "italic",
        }}>
          {goal.why}
        </div>
      )}

      {hasRituals && (
        <div style={{ marginTop: 10 }}>
          <GoalStreakStrip days={stats.days} color={goal.color} theme={theme} />

          <div style={{
            display: "flex", gap: 16, marginTop: 10, fontSize: 11,
            color: theme.textTertiary, fontWeight: 500, fontVariantNumeric: "tabular-nums",
          }}>
            <span>
              <span style={{ fontWeight: 700, color: theme.textSecondary }}>{stats.completionRate}%</span> rate
            </span>
            <span>
              <span style={{ fontWeight: 700, color: theme.textSecondary }}>{stats.bestStreak}</span> best streak
            </span>
            <span>
              <span style={{ fontWeight: 700, color: theme.textSecondary }}>{stats.completedDays}</span>/{stats.scheduledDays} days
            </span>
          </div>
        </div>
      )}

      {/* Deadline timeline */}
      <DeadlineTimeline goal={goal} theme={theme} />

      {/* Card count */}
      {hasCards && (
        <div style={{
          fontSize: 11, color: theme.textTertiary, fontWeight: 500,
          marginTop: hasRituals || goal.deadline ? 6 : 10, fontVariantNumeric: "tabular-nums",
        }}>
          {cardCount} card{cardCount !== 1 ? "s" : ""}
          {ritualCount > 0 && ` · ${ritualCount} ritual${ritualCount !== 1 ? "s" : ""}`}
        </div>
      )}

      {!hasCards && !goal.why && !goal.deadline && (
        <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 6 }}>
          Assign cards to this goal from card settings
        </div>
      )}
    </div>
  );
}

// ─── Date Picker ───

function DatePicker({ value, onChange, theme }: {
  value: string; // YYYY-MM-DD or ""
  onChange: (date: string) => void;
  theme: ReturnType<typeof getBoardTheme>;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const selected = value || null;

  // View month — start from selected date or today
  const initial = selected ? new Date(selected + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const pick = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const displayLabel = selected
    ? new Date(selected + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Pick a date";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        data-no-drag
        style={{
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 6, padding: "3px 10px",
          fontSize: 12, fontWeight: 500,
          color: selected ? theme.text : theme.textTertiary,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
      </button>

      {open && (
        <div
          data-no-drag
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4,
            zIndex: 50, width: 240,
            background: theme.isLight ? "rgba(255,255,255,0.95)" : "rgba(12,14,26,0.95)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: "12px 14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* Month/year nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={prev} data-no-drag className="dp-nav" style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: theme.textSecondary, fontSize: 14, padding: "2px 6px", borderRadius: 4,
            }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={next} data-no-drag className="dp-nav" style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: theme.textSecondary, fontSize: 14, padding: "2px 6px", borderRadius: 4,
            }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
            {DAYS.map((d) => (
              <div key={d} style={{
                fontSize: 9, fontWeight: 700, color: theme.textTertiary,
                textAlign: "center", padding: "2px 0",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {/* Empty cells for offset */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const m = String(viewMonth + 1).padStart(2, "0");
              const d = String(day).padStart(2, "0");
              const dateStr = `${viewYear}-${m}-${d}`;
              const isSelected = dateStr === selected;
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              return (
                <button
                  key={day}
                  onClick={() => pick(day)}
                  data-no-drag
                  className="dp-day"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: isSelected || isToday ? 700 : 500,
                    background: isSelected ? theme.text : "transparent",
                    color: isSelected
                      ? (theme.isLight ? "white" : "#0a0e1a")
                      : isPast
                        ? theme.textTertiary
                        : theme.text,
                    border: isToday && !isSelected ? `1px solid ${theme.textTertiary}` : "none",
                    cursor: "pointer", padding: 0,
                    margin: "0 auto",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button
              onClick={() => { onChange(todayStr); setOpen(false); }}
              data-no-drag
              className="dp-today-btn"
              style={{
                background: "transparent", border: "none",
                color: theme.textTertiary, fontSize: 10, fontWeight: 600,
                cursor: "pointer", padding: "2px 8px",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}
            >
              Today
            </button>
          </div>

          <style>{`
            .dp-day { transition: background 0.1s; }
            .dp-day:hover { background: ${theme.surfaceHover} !important; }
            .dp-nav:hover { background: ${theme.surface} !important; }
            .dp-today-btn:hover { color: ${theme.text} !important; }
          `}</style>
        </div>
      )}
    </div>
  );
}

// ─── Add Goal form ───

const GOAL_COLORS = CARD_LABELS.filter((l) => l.value).map((l) => l.color);

function AddGoalForm({ theme, onAdd, onCancel }: {
  theme: ReturnType<typeof getBoardTheme>;
  onAdd: (name: string, color: string, why?: string, deadline?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (name.trim()) onAdd(name.trim(), color, why.trim() || undefined, deadline || undefined);
  };

  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: 12,
      background: theme.surfaceFaint,
      border: `1px solid ${theme.border}`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Goal name..."
        data-no-drag
        style={{
          background: "transparent", border: "none",
          borderBottom: `1px solid ${theme.border}`,
          fontSize: 14, fontWeight: 600, color: theme.text,
          outline: "none", padding: "4px 0",
        }}
      />
      <input
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Why is this important to you? (optional)"
        data-no-drag
        style={{
          background: "transparent", border: "none",
          borderBottom: `1px solid ${theme.border}`,
          fontSize: 12, fontWeight: 400, color: theme.textSecondary,
          outline: "none", padding: "4px 0", fontStyle: "italic",
        }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: theme.textTertiary, whiteSpace: "nowrap" }}>
          Target date
        </span>
        <DatePicker value={deadline} onChange={setDeadline} theme={theme} />
        {deadline && (
          <button
            onClick={() => setDeadline("")}
            data-no-drag
            style={{
              background: "transparent", border: "none",
              color: theme.textTertiary, cursor: "pointer",
              fontSize: 12, padding: "2px 4px",
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {GOAL_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            data-no-drag
            style={{
              width: 18, height: 18, borderRadius: 6,
              background: c, cursor: "pointer", padding: 0,
              border: c === color ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
              transition: "all 0.15s",
            }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={onCancel}
          data-no-drag
          style={{
            padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: "transparent", border: `1px solid ${theme.border}`,
            color: theme.textSecondary, cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          data-no-drag
          style={{
            padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: theme.surfaceHover, border: `1px solid ${theme.border}`,
            color: theme.text, cursor: "pointer",
            opacity: name.trim() ? 1 : 0.4,
          }}
        >
          Create
        </button>
      </div>
    </div>
  );
}

// ─── Main ───

// ─── Completion Log ───

function CompletionLog({ cards, theme }: { cards: Record<string, Card>; theme: BoardTheme }) {
  // Group completed cards by date, most recent first
  const dayGroups = useMemo(() => {
    const completed = Object.values(cards).filter((c) => c.completedAt);
    const groups: Record<string, { date: string; cards: Card[] }> = {};
    for (const card of completed) {
      const dateStr = card.completedAt!.slice(0, 10);
      if (!groups[dateStr]) groups[dateStr] = { date: dateStr, cards: [] };
      groups[dateStr].cards.push(card);
    }
    // Sort by date descending, limit to 30 days
    return Object.values(groups)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [cards]);

  if (dayGroups.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: theme.textFaint, fontWeight: 500 }}>
          No completed tasks yet
        </span>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {dayGroups.map((group, gi) => (
        <div key={group.date} style={{ display: "flex", gap: 0 }}>
          {/* Tree trunk + branch */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 24,
            flexShrink: 0,
          }}>
            {/* Top connector */}
            <div style={{
              width: 1,
              height: 8,
              background: gi === 0 ? "transparent" : theme.border,
            }} />
            {/* Node dot */}
            <div style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              border: `1.5px solid ${theme.textTertiary}`,
              background: gi === 0 ? theme.textTertiary : "transparent",
              flexShrink: 0,
            }} />
            {/* Bottom connector */}
            <div style={{
              width: 1,
              flex: 1,
              background: gi === dayGroups.length - 1 ? "transparent" : theme.border,
            }} />
          </div>

          {/* Day content */}
          <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: gi === 0 ? theme.textSecondary : theme.textTertiary,
              marginBottom: 6,
              marginTop: -1,
            }}>
              {formatDate(group.date)}
            </div>
            {group.cards.map((card) => (
              <div key={card.id} style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                marginBottom: 3,
              }}>
                <span style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: theme.textTertiary,
                  flexShrink: 0,
                  marginTop: 6,
                  alignSelf: "flex-start",
                }} />
                <span style={{
                  fontSize: 13,
                  color: gi === 0 ? theme.text : theme.textSecondary,
                  lineHeight: 1.5,
                  opacity: gi === 0 ? 0.85 : 0.6,
                }}>
                  {card.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button" || tag === "a" || tag === "select") return;
  if (target.closest("button") || target.closest("[data-no-drag]")) return;
  getCurrentWindow().startDragging();
}

export function ShadowBoardView({ board, onClose, onUpdateBoard, showWisps = true }: Props) {
  const theme = getBoardTheme(board.backgroundColor);
  const { mode } = useWindowSize();
  const isNarrow = mode !== "full"; // medium or compact
  const [addingGoal, setAddingGoal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);

  // Optimistic goals: use ref to avoid re-render cycles from useEffect syncing
  const optimisticGoalsRef = useRef<Goal[] | null>(null);
  const goals = optimisticGoalsRef.current ?? board.goals ?? [];

  // Clear optimistic state once board.goals catches up (same IDs)
  if (optimisticGoalsRef.current && board.goals) {
    const boardIds = board.goals.map((g) => g.id).join(",");
    const optIds = optimisticGoalsRef.current.map((g) => g.id).join(",");
    if (boardIds === optIds) optimisticGoalsRef.current = null;
  }

  // Stable goal data — only recompute when card-goal assignments actually change
  const cardGoalKey = useMemo(() => {
    return Object.values(board.cards)
      .filter((c) => c.goalId)
      .map((c) => `${c.id}:${c.goalId}:${c.ritual ? "r" : ""}:${c.completedAt ? "d" : ""}`)
      .sort()
      .join("|");
  }, [board.cards]);

  const ritualLogLength = board.ritualLog?.length ?? 0;

  const goalData = useMemo(() => {
    const cards = board.cards;
    const ritualLog = board.ritualLog || [];
    return goals.map((goal) => {
      const allCards = Object.values(cards).filter((c) => c.goalId === goal.id);
      const rituals = allCards.filter((c) => c.ritual);
      const stats = computeGoalStats(goal.id, ritualLog, cards, goal.createdAt);
      return { goal, stats, cardCount: allCards.length, ritualCount: rituals.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, cardGoalKey, ritualLogLength]);

  const pushBoardUpdate = (updatedGoals: Goal[], clearedGoalId?: string) => {
    optimisticGoalsRef.current = updatedGoals;
    // Build updated board: new goals + optionally clear goalId from related cards
    let updatedCards = board.cards;
    if (clearedGoalId) {
      updatedCards = { ...board.cards };
      for (const [id, card] of Object.entries(updatedCards)) {
        if (card.goalId === clearedGoalId) {
          updatedCards[id] = { ...card, goalId: undefined };
        }
      }
    }
    onUpdateBoard?.({ ...board, goals: updatedGoals, cards: updatedCards });
  };

  const handleAddGoal = (name: string, color: string, why?: string, deadline?: string) => {
    const newGoal: Goal = {
      id: crypto.randomUUID(), name, color, why, deadline,
      createdAt: new Date().toISOString(),
    };
    pushBoardUpdate([...goals, newGoal]);
    setAddingGoal(false);
  };

  const handleConfirmDeleteGoal = () => {
    if (!deletingGoal) return;
    const goalId = deletingGoal.id;
    pushBoardUpdate(goals.filter((g) => g.id !== goalId), goalId);
    setDeletingGoal(null);
  };

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
        position: "relative",
      }}
    >
      <BackgroundWisps boardColor={board.backgroundColor} isLight={isLightBoard(board.backgroundColor)} visible={showWisps} />

      {/* Header */}
      <div onMouseDown={startWindowDrag} style={{
        padding: isNarrow ? "36px 16px 0 16px" : "36px 36px 0 36px",
        display: "flex", alignItems: "center", gap: isNarrow ? 8 : 12, flexShrink: 0,
      }}>
        <button onClick={onClose} data-no-drag style={{
          width: 30, height: 30, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: theme.surface, border: `1px solid ${theme.border}`,
          color: theme.textSecondary, cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ fontSize: isNarrow ? 18 : 22, fontWeight: 700, color: theme.text, margin: 0 }}>
          {board.title}
        </h1>
        {!isNarrow && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: theme.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            Shadow Board
          </span>
        )}
      </div>

      {/* Content — goals + completion log side by side (or stacked when narrow) */}
      <div style={{
        flex: 1,
        padding: isNarrow ? "8px 10px 14px 10px" : "18px 36px 28px 36px",
        minHeight: 0,
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        gap: isNarrow ? 8 : 20,
        overflow: isNarrow ? "auto" : "hidden",
      }}>
        {/* Completion log — 1/3 (or on top when narrow) */}
        <div style={{
          flex: isNarrow ? "none" : 1,
          minHeight: 0,
          overflowY: isNarrow ? "visible" : "auto",
          order: isNarrow ? -1 : 1,
        }}>
          <div style={{
            padding: isNarrow ? "10px 12px" : "16px 20px",
            borderRadius: isNarrow ? 10 : 12,
            background: theme.surfaceFaint,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: isNarrow ? 8 : 12,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: theme.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Done
              </span>
            </div>
            <CompletionLog cards={board.cards} theme={theme} />
          </div>
        </div>

        {/* Goals section — 2/3 (or below when narrow) */}
        <div style={{
          flex: isNarrow ? "none" : 2,
          minHeight: 0,
          overflowY: isNarrow ? "visible" : "auto",
          order: isNarrow ? 0 : 0,
        }}>
          <div style={{
            padding: isNarrow ? "10px 12px" : "16px 20px",
            borderRadius: isNarrow ? 10 : 12,
            background: theme.surfaceFaint,
            display: "flex", flexDirection: "column", gap: isNarrow ? 8 : 10,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 2,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: theme.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Goals
              </span>
            </div>

            {goalData.map(({ goal, stats, cardCount, ritualCount }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                stats={stats}
                cardCount={cardCount}
                ritualCount={ritualCount}
                theme={theme}
                onDelete={() => setDeletingGoal(goal)}
              />
            ))}

            {addingGoal && (
              <AddGoalForm
                theme={theme}
                onAdd={handleAddGoal}
                onCancel={() => setAddingGoal(false)}
              />
            )}

            {!addingGoal && onUpdateBoard && (
              <button
                onClick={() => setAddingGoal(true)}
                data-no-drag
                style={{
                  padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: "transparent", border: `1px dashed ${theme.border}`,
                  color: theme.textTertiary, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                + Add goal
              </button>
            )}
          </div>
        </div>
      </div>

      {deletingGoal && (
        <ConfirmDialog
          title="Delete Goal"
          message={`Delete "${deletingGoal.name}"? Cards assigned to this goal will be unlinked.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDeleteGoal}
          onClose={() => setDeletingGoal(null)}
        />
      )}

      <style>{`
        .goal-card:hover .goal-delete-btn { opacity: 1 !important; }
        .goal-card:hover .goal-delete-btn:hover { color: rgba(220,80,80,0.7) !important; }
      `}</style>
    </div>
  );
}
