<p align="center">
  <img src="src-tauri/icons/128x128.png" width="128" height="128" alt="WandDo icon" />
</p>

<h1 align="center">WandDo</h1>

<p align="center">
  <em>A todo list for magicians who make things happen.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?style=flat-square" />
  <img src="https://img.shields.io/badge/built_with-Tauri_v2-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/size-~5MB-green?style=flat-square" />
</p>

---

Wave your wand. Organize your quests. Ship your spells.

WandDo is a native macOS desktop app for managing tasks across beautiful Kanban boards. Fast, offline-first, and syncs to GitHub when you're ready to share your magic with the world.

### Features

- **Boards with personality** — multiple boards, each with its own color and vibe
- **Drag & drop** — move cards between columns with a flick of the wrist
- **Four columns** — Todo, Today, In Progress, Completed
- **Shadow Board** — per-board analytics dashboard with completion/creation heatmaps, daily plots, streaks, and interactive hover tooltips
- **Responsive layout** — full board (>800px), tabbed medium mode (450-800px), compact Today checklist (<450px)
- **Celebrations** — golden sparkles on drag, wizard celebration when completing tasks
- **Offline-first** — works without internet, always
- **GitHub sync** — push your boards to a repo with one click
- **Tiny footprint** — ~5MB native binary, instant launch
- **Frameless beauty** — custom dark UI, no system chrome

### Stack

Tauri v2 (Rust) · React · TypeScript · @dnd-kit

### Getting Started

```bash
# Prerequisites: Node 20+, Rust
nvm use 20
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
# → outputs .dmg in src-tauri/target/release/bundle/
```

---

<p align="center">
  <sub>Built with focus and a little bit of magic.</sub>
</p>
