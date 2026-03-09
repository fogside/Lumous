# Releases

## v1.0.0 — First Light

*2026-03-09*

The first release of Lumous — a native macOS todo board app.

### What's included

- **Kanban boards** — organize tasks across four columns: Todo, Today, In Progress, Completed
- **Multiple boards** — create as many boards as you need, each with its own color
- **Drag & drop** — move cards between columns with @dnd-kit
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
