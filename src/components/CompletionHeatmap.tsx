interface Props {
  completionLog: string[];
  accentColor: string;
}

function groupByDate(log: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ts of log) {
    const date = ts.slice(0, 10); // YYYY-MM-DD
    counts[date] = (counts[date] || 0) + 1;
  }
  return counts;
}

function getLast12Weeks(): string[] {
  const days: string[] = [];
  const now = new Date();
  // Start from 83 days ago (12 weeks = 84 days, index 0..83)
  for (let i = 83; i >= 0; i--) {
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

export function CompletionHeatmap({ completionLog, accentColor }: Props) {
  const counts = groupByDate(completionLog);
  const days = getLast12Weeks();
  const max = Math.max(...Object.values(counts), 0);

  // Arrange into weeks (columns) x 7 rows
  const weeks: string[][] = [];
  let currentWeek: string[] = [];

  // Pad the first week so it starts on Sunday
  const firstDayOfWeek = new Date(days[0]).getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push("");
  }

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const cellSize = 9;
  const gap = 2;

  // Total completions in the period
  const totalInPeriod = days.reduce((sum, d) => sum + (counts[d] || 0), 0);

  return (
    <div style={{ padding: "4px 0 2px 0" }}>
      <div style={{ display: "flex", gap, alignItems: "flex-start" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} style={{ width: cellSize, height: cellSize }} />;
              }
              const count = counts[day] || 0;
              const intensity = getIntensity(count, max);
              const alpha = intensityToAlpha(intensity);
              return (
                <div
                  key={day}
                  title={count > 0 ? `${day}: ${count} task${count > 1 ? "s" : ""} done` : day}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    backgroundColor: count > 0
                      ? accentColor
                      : "rgba(255,255,255,0.06)",
                    opacity: count > 0 ? alpha : 1,
                    transition: "opacity 0.2s",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 10,
        color: "rgba(255,255,255,0.25)",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
      }}>
        {totalInPeriod} task{totalInPeriod !== 1 ? "s" : ""} done in 12 weeks
      </div>
    </div>
  );
}
