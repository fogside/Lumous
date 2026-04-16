import { useCallback, useRef } from "react";
import { Card } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";

function buildSystemPrompt(memories: string[]): string {
  const memoryBlock = memories.length > 0
    ? `\n\nYou know these things about the user (use them to personalize your research):\n${memories.map((m) => `- ${m}`).join("\n")}`
    : "";

  return `You are a helpful research assistant inside a todo app called Lumous. The user has a task and wants you to research it thoroughly.

Return practical, actionable findings in markdown format. Structure your response:

- **Brief overview** (2-3 sentences summarizing what you found)
- **Key findings** organized with ## headers and bullet points
- **Specific recommendations** — names, prices, links, steps, comparisons as appropriate
- **Summary** — what the user should do next

Keep it concise but comprehensive (200-500 words). Use **bold** for emphasis, bullet lists for options, and clear headers for sections.

If previous research results are provided, build on them — refine, expand, or pivot based on the user's new context. Don't repeat what's already there.${memoryBlock}`;
}

function buildResearchPrompt(
  title: string,
  description: string,
  context: string,
  previousResult?: string,
): string {
  let prompt = `## Task to research\n**${title}**`;
  if (description) prompt += `\n\nExisting description:\n${description}`;
  if (context) prompt += `\n\nAdditional context from user:\n${context}`;
  if (previousResult) prompt += `\n\n## Previous research results\n${previousResult}\n\n(The user wants to refine or expand on this research.)`;
  prompt += "\n\nResearch this and return your findings in markdown.";
  return prompt;
}

// Write card research state directly to disk (for when the card's board isn't the active reducer board)
async function updateCardOnDisk(boardId: string, cardId: string, research: Card["research"]): Promise<void> {
  try {
    const boardJson = await invoke<string>("load_board", { id: boardId });
    const boardData = JSON.parse(boardJson);
    if (boardData.cards[cardId]) {
      boardData.cards[cardId].research = research;
      await invoke("save_board", { id: boardId, data: JSON.stringify(boardData, null, 2) });
    }
  } catch (e) {
    console.error("Failed to update card research on disk:", e);
  }
}

export function useCardResearch(
  updateCard: (card: Card) => void,
  getCard: (id: string) => Card | undefined,
  getMemories: () => string[],
) {
  const activeJobs = useRef<Set<string>>(new Set());

  const startResearch = useCallback(
    (card: Card, context: string, boardId?: string) => {
      if (activeJobs.current.has(card.id)) return;
      activeJobs.current.add(card.id);

      const research: Card["research"] = {
        status: "running",
        context,
        startedAt: new Date().toISOString(),
      };

      // Try reducer first, fall back to disk write
      const current = getCard(card.id);
      if (current) {
        updateCard({ ...card, research });
      } else if (boardId) {
        updateCardOnDisk(boardId, card.id, research);
      }

      const userPrompt = buildResearchPrompt(
        card.title,
        card.description,
        context,
        card.research?.result,
      );

      invoke<string>("run_claude", {
        systemPrompt: buildSystemPrompt(getMemories()),
        userPrompt,
      })
        .then((result) => {
          const doneResearch: Card["research"] = {
            status: "done",
            context,
            result: result.trim(),
            startedAt: research.startedAt,
          };
          const latest = getCard(card.id);
          if (latest) {
            updateCard({ ...latest, research: doneResearch });
          } else if (boardId) {
            updateCardOnDisk(boardId, card.id, doneResearch);
          }
        })
        .catch((err) => {
          const errStr = String(err);
          const friendly = errStr.includes("not found") || errStr.includes("ENOENT")
            ? "Claude CLI not found — make sure `claude` is installed"
            : errStr.includes("overloaded") ? "Claude is overloaded — try again in a moment"
            : errStr.includes("401") || errStr.includes("authentication") ? "Authentication error — run `claude login`"
            : errStr.includes("timeout") ? "Request timed out — try again"
            : errStr;
          const errResearch: Card["research"] = {
            status: "error",
            context,
            error: friendly,
            startedAt: research.startedAt,
          };
          const latest = getCard(card.id);
          if (latest) {
            updateCard({ ...latest, research: errResearch });
          } else if (boardId) {
            updateCardOnDisk(boardId, card.id, errResearch);
          }
        })
        .finally(() => {
          activeJobs.current.delete(card.id);
        });
    },
    [updateCard, getCard, getMemories],
  );

  const isResearching = useCallback(
    (cardId: string) => activeJobs.current.has(cardId),
    [],
  );

  return { startResearch, isResearching };
}
