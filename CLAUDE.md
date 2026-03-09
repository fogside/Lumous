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
1. Bump version in `src-tauri/tauri.conf.json`
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
  hooks/
    useBoard.ts              — useReducer for single board state, auto-save
    useBoards.ts             — Meta/board list management, active board
    useSync.ts               — Git sync: add, commit, pull --rebase, push
  lib/
    types.ts                 — Board, Card, Column, Meta, Settings, colors
    storage.ts               — Tauri invoke wrappers for Rust commands
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

### Board Colors
- Two palette groups: Autumn (warm) and Neutral (cool)
- 10 colors each, defined in `types.ts` as `COLOR_GROUPS`
- Board background color applied to main content area with transition

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
- **Celebrations**: gold sparkles on cross-column drag, wizard animation on completion
- **Glows**: use `filter: drop-shadow(...)` (follows alpha contour), never `box-shadow`
- **Image assets**: `public/wizard-gold.png` (celebration), `public/wizard-watermark.png` (sidebar), `src-tauri/icons/` (app icon from `mage.png`/`mage_small.png`)
- **Icons**: generated via Pillow script from `mage.png` (>89px) and `mage_small.png` (≤89px), 18% corner radius

## Common Issues
- **Port 1420 in use**: `lsof -ti :1420 | xargs kill -9`
- **Cargo not found**: `export PATH="$HOME/.cargo/bin:$PATH"`
- **Icon not updating in dev**: Icons only appear in production builds
- **Window not dragging**: Check `core:window:allow-start-dragging` in capabilities
