# Lumous — Development Guide

## What is this?
A native macOS todo board app built with Tauri v2 + React + TypeScript. Trello-like boards with drag-and-drop cards, multiple boards, and GitHub sync. The app should feel magical, whimsical, and joyful to use.

## Tech Stack
- **Tauri v2** — Rust backend, system WebView, ~5MB binary
- **React 19 + TypeScript** — UI layer, inline styles (not Tailwind classes)
- **@dnd-kit** — drag-and-drop cards between columns
- **Vite** — build tool
- **Local JSON** — one file per board in `~/Library/Application Support/io.github.fogside.lumous/`
- **Git CLI** — GitHub sync via Tauri shell commands

## Prerequisites
- **Node 20+** — use `nvm use 20` (`.nvmrc` in repo)
- **Rust** — `$HOME/.cargo/bin` must be in PATH
- **macOS** — primary target platform

## Dev Commands
```bash
# Start dev (always set PATH first)
export PATH="$HOME/.cargo/bin:$PATH"
source ~/.nvm/nvm.sh && nvm use 20
npm run tauri dev

# Type check
npx tsc --noEmit

# Production build
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/WandDo.key)" npm run tauri build
```

## Releasing
1. Bump version in **both** `src-tauri/tauri.conf.json` and `package.json` (must match — the in-app version display reads from `tauri.conf.json` via Vite define)
2. Update `RELEASES.md` with changelog
3. Build with signing: `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/WandDo.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npm run tauri build`
4. Create `/tmp/latest.json` with new version, signature (from `.sig` file), download URL, and pub_date
5. Upload to GitHub release:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z — Title" --notes-file RELEASES.md
   gh release upload vX.Y.Z src-tauri/target/release/bundle/macos/Lumous.app.tar.gz /tmp/latest.json --clobber
   ```
6. No DMG — unsigned app triggers macOS Gatekeeper. Users install via `curl | tar` (see README)
7. Auto-updater reads `latest.json` from the latest GitHub release endpoint

## Project Structure
```
src/
  App.tsx                    — Root layout: sidebar + board + modals
  main.tsx, index.css
  components/
    BoardView.tsx            — Main board: columns, DndContext, window dragging
    Sidebar.tsx              — Board list (collapsed/expanded), sync status
    Column.tsx               — Single column with cards + add input
    Card.tsx                 — Draggable card (data-card, data-no-drag attrs)
    CardModal.tsx            — Edit card title/description
    NewCardInput.tsx         — Inline card creation at top of column
    NewBoardModal.tsx        — Create board with color picker
    BoardSettingsModal.tsx   — Edit board title + color
    SyncSettingsModal.tsx    — GitHub repo URL + sync interval
    SyncStatus.tsx           — Sync state indicator
    ConfirmDialog.tsx        — Reusable confirmation dialog
    SparkleEffect.tsx        — Gold sparkle burst on cross-column drag
    WizardCelebration.tsx    — Wizard animation on task completion
    SearchOverlay.tsx        — Global search (⌘K) across all boards
    ErrorBoundary.tsx        — React error boundary with recovery UI
  hooks/
    useBoard.ts              — useReducer for single board state, auto-save
    useBoards.ts             — Meta/board list management, active board
    useSync.ts               — Git sync: add, commit, pull --rebase, push
  lib/
    types.ts                 — Board, Card, Column, Meta, Settings, colors
    storage.ts               — Tauri invoke wrappers for Rust commands
    logger.ts                — Logging to disk (logger.error/warn/info) + global error handlers
src-tauri/
  src/lib.rs                 — Rust commands: file I/O, git operations
  capabilities/default.json  — Tauri permissions (window, shell)
  tauri.conf.json            — App config, window settings, bundle
  icons/                     — App icons (all sizes, .icns, .ico)
```

## Key Patterns

### Styling
All components use **inline styles**, not Tailwind utility classes. This was a deliberate choice — Tailwind classes were being stripped/compressed causing spacing issues.

### Window Dragging
- Uses `getCurrentWindow().startDragging()` from `@tauri-apps/api/window`
- **Do NOT call `e.preventDefault()`** before `startDragging()` — Tauri needs the native event
- Cards have `data-card` + `data-no-drag` attributes to exclude them from window dragging
- Requires `core:window:allow-start-dragging` permission in capabilities
- `titleBarStyle: "Overlay"` with `hiddenTitle: true` for frameless look

### Drag and Drop (@dnd-kit)
- `DndContext` wraps columns area in `BoardView.tsx`
- `PointerSensor` with `distance: 3` activation constraint
- `closestCenter` collision detection (forgiving drop targets)
- Cards use `useSortable`, columns use `useDroppable`
- Columns have `data-column-id` attribute for sparkle positioning
- Moving to "Completed" column auto-sets `completedAt` timestamp

### Data Persistence
- `meta.json` — board order + sync settings
- `boards/{id}.json` — one per board
- Auto-save on state changes, debounced 500ms
- First launch auto-creates "My Board"

### Board Colors & Themes
- Two palette groups: Autumn (10 dark/rich) and Neutral (10 pastels + cool)
- Colors defined as `BoardColor` objects (`hex` + `name`) in `COLOR_GROUPS`
- **Light boards**: pastels (Peach, Organza, Heavenly White, Rob Roy, Old Brass, Pilk, Locust) auto-switch to dark text via `isLightBoard()` + `getBoardTheme()`
- **`DARK_INK`** (`#0a0e1a`): single constant for sidebar bg, modal bg, light-board text base — change once, updates everywhere
- **`BoardTheme`**: semantic color tokens (text, textSecondary, border, surface, etc.) returned by `getBoardTheme()`, threaded through all board-facing components
- Default first board color: Olive `#556B2F`

### GitHub Sync
- Git operations via `std::process::Command` in Rust
- Flow: `add -A` → `commit` → `pull --rebase -X ours` → `push`
- Auto-sync via `setInterval`, manual sync button in sidebar
- PAT token embedded in repo URL (single-user app)

## Style Guide
- **Dark UI** with warm accent colors, wizard/magical theme
- **Inline styles only** — no Tailwind classes (they get stripped)
- **System font**: `-apple-system` stack
- **Generous spacing**, subtle shadows, smooth transitions
- **Completed cards**: faded opacity + completion date shown
- **Sidebar**: collapsible (72px dots mode vs 270px expanded)
- **New cards**: prepend to top of column, not bottom
- **Celebrations**: sparkles on cross-column drag + wizard on completion, both colored per board theme (gold/ember/sage)
- **Sparkle colors**: `SparkleEffect` uses `getWizardTheme()` from `WizardCelebration.tsx` to match wizard palette
- **Cards**: borderless with clipped label glow (glow wrapped in `overflow: hidden` container)
- **Label picker**: vertical portal in full view, inline horizontal in medium/solo view (`solo` prop)
- **Glows**: use `filter: drop-shadow(...)` (follows alpha contour), never `box-shadow`
- **Image assets**: `public/wizard-gold.png` (celebration), `public/wizard-watermark.png` (sidebar), `src-tauri/icons/` (app icon from `mage.png`/`mage_small.png`)
- **Icons**: generated via Pillow script from `mage.png` (>89px) and `mage_small.png` (≤89px), 18% corner radius

## Wizard Action System

The wizard (`WizardPanel.tsx`) sends structured JSON responses that `applyActions` executes atomically:

### WizardResponse actions
| Action | Effect |
|--------|--------|
| `newCards` | Creates proposed cards (`proposed: true`) — user accepts/rejects individually |
| `highlights` | Marks cards with `highlighted: true` + `highlightReason` — visual cue only |
| `dayPlan` | Reorders one column (`columnId` + `order[]`). Only reorders cards already in that column — never cross-pollinate |
| `labels` | Sets `card.label` (color label) |
| `rituals` | Sets `card.ritual.schedule` for recurring tasks |
| `moveCards` | Moves cards between columns (directly, no confirmation needed) |
| `removeCards` | Marks cards with `proposedDelete: true` — user must approve via "Delete / Keep" buttons |
| `sessions` | Creates focus sessions in meta.json |
| `remember` | Saves wizard memories to meta.settings.wizardMemories |

### Proposal lifecycle
- **Proposed new cards** (`proposed: true`): dashed purple border, ✓ / ✗ buttons. Accept = keep card (clear flag). Reject = delete card.
- **Proposed deletions** (`proposedDelete: true`): dashed red border, strikethrough title, "Delete / Keep" buttons. Accept = actually delete. Reject = clear flag (keep card).
- **MOVE_CARD reducer**: always clears ALL wizard transient flags (`proposed`, `highlighted`, `proposedDelete`, etc.) — manual drag is implicit acceptance.
- **`strip_wizard_transient` (Rust)**: strips `proposed` cards entirely + clears `highlighted`, `proposedDelete`, `proposedDeleteReason` before git sync.
- **applyActions is atomic**: one `save_board` + one `reloadFromDisk()` per wizard message. Never dispatch partial updates.

### Critical: dayPlan safety
`dayPlan.order` must only reference cards already in the target column. `applyActions` enforces this:
```js
const colIdSet = new Set(col.cardIds);
const validIds = [...new Set(mappedOrder.filter(id => boardData.cards[id] && colIdSet.has(id)))];
```
Cards from other columns accidentally included in `order[]` are silently ignored. Without this guard, cards would appear in two columns simultaneously, breaking @dnd-kit layout.

## Cross-Board Sync & allBoards Pattern

The app maintains two parallel sources of truth:
1. **`useBoard` reducer** (`board`) — live, in-memory state for the active board. Always the freshest data.
2. **`useBoards` state** (`boards`) — record of all boards loaded from disk. Used by Sidebar, Today Board, etc.

**The merge** (in `App.tsx`):
```js
const allBoards = useMemo(() => {
  return reducerBoardId && boards[reducerBoardId]
    ? { ...boards, [reducerBoardId]: { ...board, title: boards[reducerBoardId].title, backgroundColor: boards[reducerBoardId].backgroundColor } }
    : boards;
}, [boards, board, reducerBoardId]);
```
Always use `allBoards` when you need any board's current state. `boards` alone may be stale for the active board.

**`isStaleReturn` guard** in `useBoard.ts`: prevents the `initialBoard` effect from overwriting the reducer with a stale board when switching Board A → Today Board → Board A. Only fires `SET_BOARD` when `initialBoard !== lastSetBoardRef.current`.

**`setBoardIfMatch`**: Today Board operations (completeCard, uncompleteCard, startSession) call this after writing to disk. It updates the useBoard reducer directly if the board ID matches, avoiding a full `reloadFromDisk`.

**`refreshBoard`**: called via `onBoardChanged` in the auto-save effect (wrapped in `startTransition`). Updates `boards` record so sidebar stays current. Non-urgent — never blocks user input.

## Performance Patterns

- **`startTransition`** wraps all background board updates: file poll `SET_BOARD`, `onBoardChanged` in auto-save. Tells React these updates are lower priority than user input (typing, dragging).
- **`useMemo` for `allBoards`** in `App.tsx`: only recomputes when `board` or `boards` change, not on every App render (e.g., toggling wizard, collapsing sidebar).
- **No `React.memo` currently** on Card/Column — if render performance becomes an issue, add `React.memo` + `useCallback` for all card/column callbacks in BoardView.

## @dnd-kit Pitfalls

- **Duplicate card IDs in `col.cardIds`** cause React duplicate-key warnings AND @dnd-kit layout corruption (cards overlap, huge gaps, broken scroll). Guard against this:
  - `dayPlan` reorder: only include IDs that exist in the column (`colIdSet.has(id)`)
  - `moveCards`: filter before unshift (`toCol.cardIds = toCol.cardIds.filter(id => id !== realId)`)
  - BoardView render: `[...new Set(column.cardIds)]` as safety net
- **Changing `items` during drag**: @dnd-kit handles this if you follow the `onDragOver` → immediate `MOVE_CARD` → `onDragEnd` final-position pattern (already implemented)
- **Card height changes during session**: if proposed cards (with extra buttons/text) are accepted mid-session, @dnd-kit may have stale measurements. Generally resolves on next drag.

## Logging & Error Handling

### Crash Log
All uncaught JS errors, unhandled promise rejections, and drag-and-drop failures are logged to `app.log` in the data directory:
- **Production**: `~/Library/Application Support/io.github.fogside.lumous/app.log`
- **Dev**: `~/Library/Application Support/io.github.fogside.lumous-dev/app.log`

Each entry has a timestamp and level: `[2026-04-16 12:34:56.789] [ERROR] Uncaught: ...`

The log auto-caps at ~500KB by trimming old entries. Use `read_log` Rust command or `readLog()` from `storage.ts` to read it programmatically.

### How it works
- **`src/lib/logger.ts`**: `logger.error/warn/info(msg)` writes to disk via the Rust `write_log` command. `installGlobalErrorHandlers()` is called once at startup in `main.tsx` to catch `window.error` and `unhandledrejection`.
- **`src/components/ErrorBoundary.tsx`**: React class component wrapping `<App />`. On crash, shows a recovery screen with error details (collapsible) + "Reload app" button instead of a black screen. Logs the error + component stack to disk.
- **Drag-and-drop**: `handleDragOver` and `handleDragEnd` in `BoardView.tsx` are wrapped in try/catch — a drag crash logs the error and cleans up state (clears activeId, activeRect, dragSourceCol) so the app doesn't freeze.

### Using the logger
```typescript
import { logger } from "../lib/logger";

// Logs to app.log with timestamp + prints to console
logger.error("Something broke: " + error.message);
logger.warn("Unexpected state in reducer");
logger.info("Board loaded: " + boardId);
```

### Wizard & Research Errors
- **Wizard**: On Claude API failure, the error is shown as a prominent red card in the chat with a "Retry" button. The user's typed message is restored to the input field so they don't lose it.
- **Research**: Errors are stored in `card.research.error` and shown on the card with a "Retry" button. The original `context` string is preserved in `card.research.context`.
- Both translate raw errors into human-readable messages (auth, timeout, overloaded, CLI not found).

## Common Issues
- **Port 1420 in use**: `lsof -ti :1420 | xargs kill -9`
- **Cargo not found**: `export PATH="$HOME/.cargo/bin:$PATH"`
- **Icon not updating in dev**: Icons only appear in production builds
- **Window not dragging**: Check `core:window:allow-start-dragging` in capabilities
- **App crashes / black screen**: Check `app.log` in the data dir (see Logging section above)
