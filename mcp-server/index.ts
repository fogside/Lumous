#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";

// ─── Data directory ─────────────────────────────────────────────
// Lumous stores data in ~/Library/Application Support/io.github.fogside.lumous/
// In dev mode it uses the -dev suffix
const DATA_DIR_PROD = join(
  homedir(),
  "Library/Application Support/io.github.fogside.lumous"
);
const DATA_DIR_DEV = join(
  homedir(),
  "Library/Application Support/io.github.fogside.lumous-dev"
);

function getDataDir(): string {
  // Prefer dev directory if it exists (user is likely developing)
  if (existsSync(join(DATA_DIR_DEV, "meta.json"))) return DATA_DIR_DEV;
  if (existsSync(join(DATA_DIR_PROD, "meta.json"))) return DATA_DIR_PROD;
  return DATA_DIR_PROD;
}

// ─── Types (matching Lumous app types) ──────────────────────────
interface Card {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  completedAt: string | null;
  label?: string;
  goalId?: string;
  ritual?: { schedule: string | number[] };
  proposed?: boolean;
  proposedReasoning?: string;
  highlighted?: boolean;
  highlightReason?: string;
}

interface Column {
  id: string;
  title: string;
  cardIds: string[];
}

interface Board {
  id: string;
  title: string;
  backgroundColor: string;
  columns: Column[];
  cards: Record<string, Card>;
  goals?: Array<{ id: string; name: string; color: string }>;
}

interface Meta {
  boardOrder: string[];
  settings: Record<string, unknown>;
}

// ─── File I/O helpers ───────────────────────────────────────────
function loadMeta(): Meta {
  const path = join(getDataDir(), "meta.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadBoard(id: string): Board {
  const path = join(getDataDir(), "boards", `${id}.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveBoard(board: Board): void {
  const path = join(getDataDir(), "boards", `${board.id}.json`);
  writeFileSync(path, JSON.stringify(board, null, 2));
}

function formatBoard(board: Board): string {
  const lines: string[] = [`## Board: ${board.title}`];

  for (const col of board.columns) {
    lines.push(`\n### ${col.title} (id: ${col.id})`);
    if (col.cardIds.length === 0) {
      lines.push("(empty)");
    } else {
      for (const cardId of col.cardIds) {
        const card = board.cards[cardId];
        if (!card) continue;
        const parts = [`- [${card.id}] ${card.title}`];
        if (card.description) parts.push(`  Description: ${card.description}`);
        if (card.label) parts.push(`  Label: ${card.label}`);
        if (card.completedAt) parts.push(`  Completed: ${card.completedAt}`);
        if (card.proposed) parts.push(`  (PROPOSED — not yet accepted)`);
        if (card.highlighted) parts.push(`  (HIGHLIGHTED)`);
        lines.push(parts.join("\n"));
      }
    }
  }

  if (board.goals && board.goals.length > 0) {
    lines.push("\n### Goals");
    for (const goal of board.goals) {
      lines.push(`- ${goal.name} (${goal.color})`);
    }
  }

  return lines.join("\n");
}

// ─── MCP Server ─────────────────────────────────────────────────
const server = new McpServer({
  name: "lumous",
  version: "1.0.0",
});

// Tool: list_boards
server.tool(
  "list_boards",
  "List all boards in Lumous with their basic info",
  {},
  async () => {
    const meta = loadMeta();
    const boards = meta.boardOrder.map((id) => {
      try {
        const board = loadBoard(id);
        const cardCount = Object.keys(board.cards).length;
        const columnSummary = board.columns
          .map((c) => `${c.title}: ${c.cardIds.length}`)
          .join(", ");
        return `- **${board.title}** (id: ${board.id})\n  Cards: ${cardCount} | ${columnSummary}`;
      } catch {
        return `- (board ${id} — failed to load)`;
      }
    });

    return {
      content: [
        {
          type: "text" as const,
          text: boards.length > 0
            ? `# Lumous Boards\n\n${boards.join("\n")}`
            : "No boards found.",
        },
      ],
    };
  }
);

// Tool: read_board
server.tool(
  "read_board",
  "Read a board's full state including all columns and cards",
  { boardId: z.string().describe("The board ID to read") },
  async ({ boardId }) => {
    try {
      const board = loadBoard(boardId);
      return {
        content: [{ type: "text" as const, text: formatBoard(board) }],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Could not load board ${boardId}. ${e}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: propose_cards
server.tool(
  "propose_cards",
  "Suggest new cards to add to a board. Cards appear as proposals that the user can accept or reject in the Lumous UI.",
  {
    boardId: z.string().describe("The board ID to add proposals to"),
    cards: z
      .array(
        z.object({
          title: z.string().describe("Card title (concise, actionable)"),
          columnId: z
            .string()
            .describe("Target column ID: todo, today, in-progress, or completed"),
          description: z
            .string()
            .optional()
            .describe("Optional card description"),
          reasoning: z
            .string()
            .describe("Brief explanation of why this card is suggested"),
        })
      )
      .describe("Array of card proposals"),
  },
  async ({ boardId, cards: proposals }) => {
    try {
      const board = loadBoard(boardId);
      const addedIds: string[] = [];

      for (const proposal of proposals) {
        const col = board.columns.find((c) => c.id === proposal.columnId);
        if (!col) continue;

        const card: Card = {
          id: randomUUID(),
          title: proposal.title,
          description: proposal.description || "",
          createdAt: new Date().toISOString(),
          completedAt: null,
          proposed: true,
          proposedReasoning: proposal.reasoning,
        };

        board.cards[card.id] = card;
        col.cardIds.unshift(card.id); // prepend to top of column
        addedIds.push(card.id);
      }

      saveBoard(board);

      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${addedIds.length} proposed card(s) to board "${board.title}". The user will see them in Lumous and can accept or reject each one.\n\nProposed cards:\n${proposals.map((p: { title: string; columnId: string }, i: number) => `- "${p.title}" → ${p.columnId} (${addedIds[i]})`).join("\n")}`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${e}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: highlight_cards
server.tool(
  "highlight_cards",
  "Highlight existing cards that are related to what the user mentioned. Highlighted cards get a visual glow in the Lumous UI.",
  {
    boardId: z.string().describe("The board ID"),
    cardIds: z
      .array(z.string())
      .describe("IDs of existing cards to highlight"),
    reason: z
      .string()
      .optional()
      .describe("Reason for highlighting (shown to user)"),
  },
  async ({ boardId, cardIds, reason }) => {
    try {
      const board = loadBoard(boardId);
      let highlighted = 0;

      for (const cardId of cardIds) {
        const card = board.cards[cardId];
        if (card) {
          card.highlighted = true;
          if (reason) card.highlightReason = reason;
          highlighted++;
        }
      }

      saveBoard(board);

      return {
        content: [
          {
            type: "text" as const,
            text: `Highlighted ${highlighted} card(s) on board "${board.title}".${reason ? ` Reason: "${reason}"` : ""}`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${e}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: clear_proposals
server.tool(
  "clear_proposals",
  "Remove all proposed cards and highlights from a board",
  { boardId: z.string().describe("The board ID to clear") },
  async ({ boardId }) => {
    try {
      const board = loadBoard(boardId);
      let removed = 0;
      let cleared = 0;

      // Remove proposed cards
      const proposedIds = Object.entries(board.cards)
        .filter(([, c]) => c.proposed)
        .map(([id]) => id);

      for (const id of proposedIds) {
        delete board.cards[id];
        removed++;
      }
      for (const col of board.columns) {
        col.cardIds = col.cardIds.filter((id) => !proposedIds.includes(id));
      }

      // Clear highlights
      for (const card of Object.values(board.cards)) {
        if (card.highlighted) {
          delete card.highlighted;
          delete card.highlightReason;
          cleared++;
        }
      }

      saveBoard(board);

      return {
        content: [
          {
            type: "text" as const,
            text: `Cleared board "${board.title}": removed ${removed} proposed card(s), cleared ${cleared} highlight(s).`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${e}` },
        ],
        isError: true,
      };
    }
  }
);

// ─── Start server ───────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
