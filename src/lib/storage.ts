import { invoke } from "@tauri-apps/api/core";
import { Board, Meta } from "./types";

export async function loadMeta(): Promise<Meta> {
  const json = await invoke<string>("load_meta");
  return JSON.parse(json);
}

export async function saveMeta(meta: Meta): Promise<void> {
  await invoke("save_meta", { data: JSON.stringify(meta, null, 2) });
}

export async function loadBoard(id: string): Promise<Board> {
  const json = await invoke<string>("load_board", { id });
  const board: Board = JSON.parse(json);

  // Migrate: move card.ritual.goalId → card.goalId (schema change)
  let migrated = false;
  for (const card of Object.values(board.cards)) {
    const ritualAny = card.ritual as Record<string, unknown> | undefined;
    if (ritualAny?.goalId && !card.goalId) {
      card.goalId = ritualAny.goalId as string;
      delete ritualAny.goalId;
      migrated = true;
    }
  }
  // Reset stale research: if app was closed during research, mark as error
  for (const card of Object.values(board.cards)) {
    if (card.research?.status === "running") {
      card.research = { ...card.research, status: "error", error: "Interrupted — try again" };
      migrated = true;
    }
  }

  if (migrated) {
    // Persist the migration so it only runs once
    await invoke("save_board", {
      id: board.id,
      data: JSON.stringify(board, null, 2),
    });
  }

  return board;
}

export async function saveBoard(board: Board): Promise<void> {
  await invoke("save_board", {
    id: board.id,
    data: JSON.stringify(board, null, 2),
  });
}

export async function deleteBoardFile(id: string): Promise<void> {
  await invoke("delete_board_file", { id });
}

export async function getDataDir(): Promise<string> {
  return invoke<string>("get_data_dir");
}

export async function gitRun(args: string[]): Promise<string> {
  return invoke<string>("git_run", { args });
}

export async function checkOnline(): Promise<boolean> {
  return invoke<boolean>("check_online");
}

export async function getBoardMtime(id: string): Promise<number> {
  return invoke<number>("get_board_mtime", { id });
}
