export interface Card {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  completedAt: string | null;
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
}

export interface Settings {
  syncRepoUrl: string;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
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

export interface ColorGroup {
  label: string;
  colors: string[];
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    label: "Autumn",
    colors: [
      "#BF5B21", // burnt orange
      "#B8860B", // amber
      "#8B2252", // deep crimson
      "#A0522D", // rust
      "#6B4226", // warm brown
      "#556B2F", // olive
      "#2E6B62", // deep teal
      "#6B3A6B", // plum
      "#8E4A49", // copper rose
      "#8B6914", // golden brown
    ],
  },
  {
    label: "Neutral",
    colors: [
      "#9B6B7B", // dusty rose
      "#6B8E6B", // sage green
      "#7B6B8E", // muted lavender
      "#5B7089", // slate blue
      "#8E8070", // warm stone
      "#5E8A87", // soft teal
      "#876B7E", // dusty mauve
      "#6B7E5E", // moss green
      "#7E7090", // steel lilac
      "#5E7085", // faded denim
    ],
  },
];

export const ALL_COLORS = COLOR_GROUPS.flatMap((g) => g.colors);

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
