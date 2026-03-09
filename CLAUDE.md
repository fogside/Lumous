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

# Production build (generates .dmg)
npm run tauri build
```

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

## Common Issues
- **Port 1420 in use**: `lsof -ti :1420 | xargs kill -9`
- **Cargo not found**: `export PATH="$HOME/.cargo/bin:$PATH"`
- **Icon not updating in dev**: Icons only appear in production builds (`.dmg`)
- **Window not dragging**: Check `core:window:allow-start-dragging` in capabilities

## Visual Effects & Animations

### Sparkle Effect (`SparkleEffect.tsx`)
Gold 4-pointed star particles burst when dragging cards between columns. Triggered in `BoardView.handleDragEnd` when source and destination columns differ.

### Wizard Celebration (`WizardCelebration.tsx`)
Golden wizard appears when a task is moved to the Completed column. Randomly picks one of 4 entry positions (bottom, top, left, right) — never the same twice in a row. Sparkles stream from the wand tip diagonally across the board.

### Adding a New Celebration Image
1. **Create transparent PNG**: Place the image in `public/`. Use Python Pillow to extract the subject from a source image with background removal (see `wizard-gold.png` as example — extracted from the app icon by detecting olive-green background pixels via R/G ratio and making them transparent).
2. **Use `drop-shadow` for glow** — never `box-shadow` or radial-gradient divs, as those render as rectangles. `filter: drop-shadow(...)` follows the image's alpha contour.
3. **Rotation + flip for side entries**: The image enters head-first from each edge:
   - Bottom: no transform needed
   - Top: `rotate(180deg)` (upside down)
   - Right: `rotate(-90deg) scaleX(-1)` — head points left, wand flipped to correct side
   - Left: `rotate(90deg) scaleX(-1)` — head points right, wand flipped to correct side
4. **Sparkle anchors**: Position `wandAnchor` CSS to match where the wand tip lands after rotation. Use `top: calc(50% ± offset)` relative to the container. Test each variant visually.
5. **Image source files**: `public/wizard-gold.png` (celebration), `public/wizard-watermark.png` (sidebar watermark), `src-tauri/icons/` (app icon).

## Design Philosophy
- Minimalist, dark UI with warm accent colors
- Whimsical, magical vibe — wizard-themed
- Generous spacing, system font stack (`-apple-system`)
- Completed cards: faded opacity + completion date
- Sidebar: collapsible (72px dots vs 270px full)
