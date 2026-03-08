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
  return JSON.parse(json);
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
