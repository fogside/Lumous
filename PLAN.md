# Todo Board App — Tauri v2 + React + TypeScript

## Context
Build a native macOS desktop todo app with a Trello-like board UI. Must be fast, work offline, and sync to GitHub. The app should feel beautiful and joyful to use.

## Tech Stack
- **Tauri v2** (Rust backend, system WebView) — ~5MB binary, native performance
- **React + TypeScript** — UI layer
- **@dnd-kit** — drag-and-drop between columns
- **Tailwind CSS** — styling
- **Local JSON files** — one per board, stored in `~/Library/Application Support/com.zenja.todo/`
- **Git CLI** — GitHub sync via shell commands from Tauri

## Data Model

**`meta.json`** — board list + settings:
```json
{
  "boardOrder": ["uuid1", "uuid2"],
  "settings": { "syncRepoUrl": "", "syncIntervalMinutes": 5, "lastSyncedAt": null }
}
```

**`boards/{id}.json`** — one per board:
```json
{
  "id": "uuid",
  "title": "Work Tasks",
  "backgroundColor": "#1e293b",
  "columns": [
    { "id": "todo", "title": "Todo", "cardIds": ["card-1"] },
    { "id": "today", "title": "Today", "cardIds": [] },
    { "id": "in-progress", "title": "In Progress", "cardIds": [] },
    { "id": "completed", "title": "Completed", "cardIds": [] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Design the API", "description": "", "createdAt": "...", "completedAt": null }
  }
}
```

Four fixed columns per board. Cards stored in flat map, columns reference by ID.

## File Structure
```
src/
  main.tsx, App.tsx, index.css
  components/  Sidebar, BoardView, Column, Card, CardModal, NewCardInput, BoardSettingsModal, SyncStatus
  hooks/       useBoard.ts, useBoards.ts, useSync.ts
  lib/         storage.ts (Tauri invoke wrappers), types.ts
src-tauri/
  src/         main.rs, lib.rs (Tauri commands: file I/O + git)
  capabilities/default.json
```

## Implementation Phases

### Phase 1: Project Setup
1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Scaffold: `npm create tauri-app@latest . -- --template react-ts`
3. Install deps: `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` + `tailwindcss @tailwindcss/vite`
4. Configure Tailwind via Vite plugin
5. Configure Tauri permissions: `fs`, `shell:allow-execute`

### Phase 2: Board UI with Drag-and-Drop
1. Define types in `types.ts`
2. Build `BoardView` → `Column` → `Card` component hierarchy
3. Wire `@dnd-kit`: `DndContext` in BoardView, `useDroppable` in Column, `useSortable` in Card
4. Implement `onDragEnd` to move cards between columns
5. Add `NewCardInput` (inline text input at column bottom)
6. Add `CardModal` for editing title/description
7. State via `useReducer` in `useBoard.ts`

### Phase 3: Local Persistence
1. Rust Tauri commands in `lib.rs`: `load_meta`, `save_meta`, `load_board`, `save_board`, `delete_board_file`, `get_data_dir`
2. TypeScript wrappers in `storage.ts`
3. Load on mount, save on change (debounced 500ms)

### Phase 4: Multiple Boards + Sidebar
1. `Sidebar.tsx` — board list with colored dots, click to switch, "+" to add
2. `BoardSettingsModal` — edit title + pick background color (8-10 presets)
3. Board background color applied to main content area
4. Board reordering in sidebar via drag-and-drop

### Phase 5: GitHub Sync
1. Rust commands for git: `git_init`, `git_clone`, `git_pull`, `git_push`, `git_status`, `check_online`
2. `useSync.ts` — sync flow: `add -A` → `commit` → `pull --rebase` → `push`
3. Conflict strategy: last-write-wins (`git pull -X ours`)
4. Auto-sync via `setInterval` every N minutes (only when online)
5. `SyncStatus` component in sidebar footer + manual sync button
6. Settings UI for repo URL and interval

### Phase 6: Polish
1. Completed column: `opacity-60` + `saturate-50` filter
2. Card hover: subtle lift/shadow
3. Drag overlay: floating card effect via `@dnd-kit DragOverlay`
4. Board switch: 150ms opacity fade transition
5. Empty column state: dotted border + "No tasks" text
6. Window: custom titlebar or transparent decorations
7. System font stack (`-apple-system`)

## Key Decisions
- **No external state library** — `useReducer` is sufficient for board state
- **No UUID library** — `crypto.randomUUID()` works in WebView
- **Git assumed installed** — check on startup, show error if missing
- **PAT in repo URL** — acceptable for MVP single-user app
- **Debounced saves** — 500ms to avoid excessive writes

## Verification
1. `npm run tauri dev` — hot-reload development
2. Test drag-and-drop cards between all 4 columns
3. Kill and restart app — verify data persists
4. Create multiple boards, switch between them
5. Set up a test GitHub repo, configure sync, verify push/pull works
6. Disconnect network, verify app works fully offline
7. `npm run tauri build` — verify .dmg output ~5-8MB
