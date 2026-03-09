# Releases

## Unreleased

- **Drag overlay matches card size** — dragged card overlay now preserves the exact width of the original card instead of using a fixed 240px
- **Label glow clip fix** — the blurry label glow in the card corner no longer turns square during hover/drag; uses `isolation: isolate` to keep the clip stable under CSS transforms

---

## v1.2.1 — Dark Board Borders

*2026-03-09*

- **Restored card borders for dark boards** — subtle borders and label-tinted gradient background on dark boards; light boards remain borderless
- **`isLight` flag on BoardTheme** — enables conditional styling per board type

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

## v1.1.1 — Priority Labels

*2026-03-09*

- **Card labels** — 7 color labels (ember, copper, honey, sage, slate, plum, rose) to mark card importance
- **Crescent icon** — hover any card to reveal a moon-shaped color picker in the top-right corner
- **Color glow** — labeled cards get a subtle blurred splash and gradient border tint
- **Label in card modal** — pick or change labels when editing a card
- **Consistent modals** — all dialogs now match the sidebar color (#0c0c14)
- **Card modal** — title field now wraps long text, tighter padding throughout
- **Default board color** — new boards start with olive green
- **dnd-kit links** — updated references to link to the new dnd-kit repo

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

## v1.1.0 — UI Polish

*2026-03-09*

- **Tighter layout** — reduced paddings across board, columns, and cards so content gets more space
- **Completed column** — narrower in full board view, full-size in tabbed mode
- **New cards on top** — new tasks appear at the top of the column
- **Scrollable columns** — cards scroll within columns instead of overflowing
- **Text wrapping** — long card titles wrap correctly instead of overflowing the card
- **Window drag fix** — scrolling inside columns no longer moves the app window
- **Dev isolation** — dev builds use a separate data directory to avoid conflicts with production

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

## v1.0.0 — First Light

*2026-03-09*

The first release of Lumous — a native macOS todo board app.

### What's included

- **Kanban boards** — organize tasks across four columns: Todo, Today, In Progress, Completed
- **Multiple boards** — create as many boards as you need, each with its own color
- **Drag & drop** — move cards between columns with [dnd-kit](https://github.com/clauderic/dnd-kit)
- **Shadow Board** — per-board analytics dashboard with completion and creation heatmaps, daily plots, streaks, and interactive hover tooltips
- **Responsive layout** — adapts from full board (>800px) to tabbed mode (450-800px) to compact Today checklist (<450px)
- **Celebrations** — golden sparkle burst on cross-column drag, wizard animation on task completion
- **Auto-update** — checks for new versions on launch, one-click download and restart
- **Offline-first** — all data stored locally in `~/Library/Application Support/io.github.fogside.lumous/`, no account required
- **GitHub sync** — optional push/pull to a GitHub repo for backup or sharing
- **Frameless dark UI** — custom window chrome, system font stack, warm accent colors
- **Tiny footprint** — ~5MB native binary, instant launch

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

### Platform

- macOS (Apple Silicon)
