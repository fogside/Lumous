# Releases

## v1.8.0 — Wizard Research & Full Board Control

*2026-04-03*

- **Per-card research** — click any card, ask the wizard to research it in the background. Results populate as rendered markdown with "Apply to description" button
- **Wizard labels** — wizard can assign color labels (moon crescents) to cards via chat
- **Wizard rituals** — wizard can make cards recurring (daily, weekdays, custom days)
- **Wizard card moves** — tell the wizard you finished tasks and it moves them to Completed
- **Wizard memories popover** — click "N memories" to see and delete saved preferences
- **Markdown descriptions** — card descriptions render markdown with Edit/Preview toggle, including tables, headers, lists, bold/italic
- **Research spinner** — visible animated ✦ badge on cards during background research
- **Production PATH fix** — wizard now works in installed app (finds claude CLI correctly)

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

---

## v1.7.0 — Wizard Planning Assistant

*2026-04-03*

- **Wizard side panel** — interactive chat panel on the right side of the board, toggled by the wand button. Ask the wizard to plan your day, suggest tasks, or prioritize what to focus on
- **Smart actions** — the wizard automatically decides what to do from your natural language: create new cards, reorder your Today column, add time estimates, and highlight related existing cards
- **Wizard memory** — say "remember that X" and the wizard saves your preferences (e.g., "my meetings take 30min", "I exercise in the morning") across all boards and sessions
- **Time estimates** — cards display time estimate tags (e.g., "30min", "1h") set by the wizard's day plan
- **Proposed cards system** — wizard-suggested cards appear with dashed purple borders and accept/reject buttons. Highlighted cards get a gold glow
- **Lumous MCP server** — Claude Code can read boards and propose cards via MCP tools, following the Pencil.dev pattern
- **Modernized card modal** — redesigned with gradient background, borderless inputs, auto-growing description, and larger fonts
- **Label picker fix** — fixed moon button not responding after same-column card drag

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

---

## v1.6.0 — Completion Log & Shadow Board Polish

*2026-03-12*

- **Completion log** — shadow board now shows a daily log of completed tasks in a tree-branch timeline, grouped by date with Today/Yesterday labels
- **Goal dot on cards** — task cards show a small colored dot matching their assigned goal
- **Wisps on shadow board** — background wisps now render on the shadow board view too
- **Persistent wisps toggle** — sparkle toggle stays visible in the same position across board and shadow board views
- **Responsive shadow board** — at narrow widths, the layout stacks vertically with "Done" log on top and tighter margins

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

---

## v1.5.0 — Custom Date Picker & Hover Effects

*2026-03-11*

- **Custom themed date picker** for goal deadlines (replaces native calendar)
- **Hover effects** on sidebar board list and task cards
- **Wake-up fix** — app no longer unresponsive after waking from sleep
- **New goals** no longer show empty past streak bubbles

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

---

## v1.3.0 — Ambient Wisps & UI Polish

*2026-03-10*

- **Background wisps** — subtle glowing particles drift across dark board backgrounds, color-matched to the board's sparkle theme (gold, ember, or sage); two layers for depth (bright + dim)
- **Wisps toggle** — Sparkles icon in the top-right corner of the board toggles wisps on/off for both the board and sidebar simultaneously
- **Sidebar wisps** — the left panel also gets ambient wisps for a cohesive magical feel
- **Sidebar icons on hover** — shadow board (MoonStar) and delete (Trash2) icons only appear on hover of the active board row; MoonStar crossfades to Moon on hover
- **Drag overlay matches card size** — dragged card overlay preserves the exact width of the original card instead of a fixed 240px
- **Label glow clip fix** — the blurry label glow no longer turns square during hover/drag; uses `isolation: isolate` to keep the clip stable under CSS transforms
- **lucide-react icons** — added icon library for consistent, polished UI icons throughout

### Install

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

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
