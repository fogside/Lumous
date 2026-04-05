export type CardLabel = "ember" | "honey" | "sage" | "slate" | "plum" | "rose" | "copper" | "ultramarine" | null;

export const CARD_LABELS: { value: CardLabel; color: string; name: string }[] = [
  { value: null, color: "transparent", name: "None" },
  { value: "ember", color: "#e8836a", name: "Ember" },
  { value: "copper", color: "#dba06a", name: "Copper" },
  { value: "honey", color: "#e0c55a", name: "Honey" },
  { value: "sage", color: "#7cc48a", name: "Sage" },
  { value: "slate", color: "#7ab4cc", name: "Slate" },
  { value: "plum", color: "#b48ac0", name: "Plum" },
  { value: "rose", color: "#d88a9a", name: "Rose" },
  { value: "ultramarine", color: "#8a6de8", name: "Ultramarine" },
];

export type RitualSchedule = "daily" | number[]; // number[] = days of week (0=Sun … 6=Sat)

export interface RitualLogEntry {
  date: string;   // YYYY-MM-DD
  cardId: string;
  goalId?: string;
}

export interface Goal {
  id: string;
  name: string;
  color: string; // hex color
  why?: string;  // optional motivation — "why is this goal important?"
  deadline?: string; // YYYY-MM-DD target completion date
  createdAt?: string; // ISO timestamp
}

export interface Card {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  completedAt: string | null;
  label?: CardLabel;
  goalId?: string;  // independent goal assignment
  ritual?: {
    schedule: RitualSchedule;
  };
  timeEstimate?: string;  // e.g. "15min", "1h", "2h"
  // Wizard research (background per-card research)
  research?: {
    status: "running" | "done" | "error";
    context?: string;
    result?: string;
    error?: string;
    startedAt?: string;
  };
  // Wizard proposal fields (set by MCP server)
  proposed?: boolean;
  proposedReasoning?: string;
  highlighted?: boolean;
  highlightReason?: string;
}

export interface Column {
  id: string;
  title: string;
  cardIds: string[];
}

export interface Board {
  id: string;
  title: string;
  backgroundColor: string;
  columns: Column[];
  cards: Record<string, Card>;
  completionLog?: string[]; // ISO timestamps of each task completion
  goals?: Goal[];
  ritualLog?: RitualLogEntry[];
}

export interface CardRef {
  boardId: string;
  cardId: string;
}

export interface FocusSession {
  id: string;
  title?: string;
  duration: 25 | 50 | 75;
  timeOfDay: "morning" | "afternoon" | "evening";
  cardRefs: CardRef[];
  completedCardIds?: string[];  // cards completed within this session
  started?: boolean;
}

export const TODAY_BOARD_ID = "today-board";

export interface Settings {
  syncRepoUrl: string;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
  wizardMemories?: string[];
  todaySessions?: FocusSession[];
  todayDate?: string;  // YYYY-MM-DD — sessions reset when date changes
}

export interface Meta {
  boardOrder: string[];
  settings: Settings;
}

export const COLUMN_IDS = ["todo", "today", "in-progress", "completed"] as const;

export const DEFAULT_COLUMNS: Column[] = [
  { id: "todo", title: "Todo", cardIds: [] },
  { id: "today", title: "Today", cardIds: [] },
  { id: "in-progress", title: "In Progress", cardIds: [] },
  { id: "completed", title: "Completed", cardIds: [] },
];

export interface BoardColor {
  hex: string;
  name: string;
}

export interface ColorGroup {
  label: string;
  colors: BoardColor[];
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    label: "Autumn",
    colors: [
      { hex: "#556B2F", name: "Olive" },
      { hex: "#4A6741", name: "Forest" },
      { hex: "#3B6E4F", name: "Evergreen" },
      { hex: "#2E6B62", name: "Deep Teal" },
      { hex: "#3A5F6B", name: "Spruce" },
      { hex: "#2B3A55", name: "Navy" },
      { hex: "#8E4A49", name: "Copper Rose" },
      { hex: "#A0522D", name: "Rust" },
      { hex: "#6B4226", name: "Warm Brown" },
      { hex: "#6B3A6B", name: "Plum" },
    ],
  },
  {
    label: "Neutral",
    colors: [
      { hex: "#A9AE92", name: "Locust" },
      { hex: "#F5C79F", name: "Vibrant Peach" },
      { hex: "#F4E0CB", name: "Organza" },
      { hex: "#F3F2EC", name: "Heavenly White" },
      { hex: "#E7C277", name: "Rob Roy" },
      { hex: "#7B6B8E", name: "Muted Lavender" },
      { hex: "#5E8A87", name: "Soft Teal" },
      { hex: "#DFABA2", name: "Pilk" },
      { hex: "#5E7085", name: "Faded Denim" },
      { hex: "#A29969", name: "Old Brass" },
    ],
  },
];

export const ALL_COLORS = COLOR_GROUPS.flatMap((g) => g.colors.map((c) => c.hex));

// ── Board theme (light vs dark) ──────────────────────────────────
export const DARK_INK = "#0a0e1a"; // very dark navy blue — sidebar, modals, light-board text

const LIGHT_BOARDS = new Set(["#A9AE92", "#F5C79F", "#F4E0CB", "#F3F2EC", "#E7C277", "#A29969", "#DFABA2"]);

export function isLightBoard(color: string): boolean {
  return LIGHT_BOARDS.has(color);
}

export interface BoardTheme {
  isLight: boolean;     // light board flag
  text: string;         // primary text
  textSecondary: string; // descriptions, muted
  textTertiary: string;  // timestamps, counts, hints
  textFaint: string;     // empty states, very subtle
  border: string;        // card/element borders
  borderSubtle: string;  // very subtle borders (dashed, drop zones)
  surface: string;       // card backgrounds, input backgrounds
  surfaceHover: string;  // drop zone hover, active tab
  surfaceFaint: string;  // very subtle background (column resting state)
  overlay: string;       // drag overlay, picker backgrounds
}

export function getBoardTheme(boardColor: string): BoardTheme {
  if (isLightBoard(boardColor)) {
    return {
      isLight: true,
      text: "rgba(15,25,60,0.75)",
      textSecondary: "rgba(15,25,60,0.48)",
      textTertiary: "rgba(15,25,60,0.32)",
      textFaint: "rgba(15,25,60,0.14)",
      border: "rgba(15,25,60,0.12)",
      borderSubtle: "rgba(15,25,60,0.08)",
      surface: "rgba(15,25,60,0.06)",
      surfaceHover: "rgba(15,25,60,0.1)",
      surfaceFaint: "rgba(15,25,60,0.03)",
      overlay: "rgba(15,25,60,0.15)",
    };
  }
  return {
    isLight: false,
    text: "rgba(255,255,255,0.9)",
    textSecondary: "rgba(255,255,255,0.35)",
    textTertiary: "rgba(255,255,255,0.25)",
    textFaint: "rgba(255,255,255,0.1)",
    border: "rgba(255,255,255,0.08)",
    borderSubtle: "rgba(255,255,255,0.08)",
    surface: "rgba(255,255,255,0.08)",
    surfaceHover: "rgba(255,255,255,0.12)",
    surfaceFaint: "rgba(255,255,255,0.02)",
    overlay: "rgba(255,255,255,0.2)",
  };
}

export function createBoard(title: string, color?: string): Board {
  return {
    id: crypto.randomUUID(),
    title,
    backgroundColor: color || ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)],
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c, cardIds: [] })),
    cards: {},
  };
}

export function createCard(title: string): Card {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}
