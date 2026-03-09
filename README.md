<p align="center">
  <img src="src-tauri/icons/128x128.png" width="128" height="128" alt="Lumm icon" />
</p>

<h1 align="center">Lumm</h1>

<p align="center">
  <em>lumm (Estonian) — magic, spell, enchantment</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?style=flat-square" />
  <img src="https://img.shields.io/badge/built_with-Tauri_v2-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/size-~5MB-green?style=flat-square" />
</p>

---

Lumm is a native macOS desktop app for managing tasks across Kanban boards. Fast, offline-first, and optionally syncs to GitHub.

### Features

- **Boards with personality** — multiple boards, each with its own color and vibe
- **Drag & drop** — move cards between columns with a flick of the wrist
- **Four columns** — Todo, Today, In Progress, Completed
- **Shadow Board** — per-board analytics dashboard with completion/creation heatmaps, daily plots, streaks, and interactive hover tooltips
- **Responsive layout** — full board (>800px), tabbed medium mode (450-800px), compact Today checklist (<450px)
- **Celebrations** — golden sparkles on drag, wizard celebration when completing tasks
- **Auto-update** — checks for new versions on launch, one-click update from within the app
- **Offline-first** — works without internet, always
- **GitHub sync** — optional push/pull to a repo with one click
- **Tiny footprint** — ~5MB native binary, instant launch
- **Frameless beauty** — custom dark UI, no system chrome

### Install

Download the latest `.dmg` from [Releases](https://github.com/fogside/Lumm/releases), open it, and drag **Lumm** to your Applications folder. No dependencies required — everything is bundled.

> **Note:** On first launch, macOS may show a security warning. Go to **System Settings → Privacy & Security** and click "Open Anyway".

Data is stored locally in `~/Library/Application Support/com.zenja.todo/`. GitHub sync is optional — the app works fully offline out of the box.

### Stack

Tauri v2 (Rust) · React · TypeScript · @dnd-kit

### Development

```bash
# Prerequisites: Node 20+, Rust
nvm use 20
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
# → outputs .dmg in src-tauri/target/release/bundle/dmg/
```

---

<p align="center">
  <sub>Built with focus and a little bit of magic.</sub>
</p>
