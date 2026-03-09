<p align="center">
  <img src="src-tauri/icons/128x128.png" width="128" height="128" alt="Lumous icon" />
</p>

<h1 align="center">Lumous</h1>

<p align="center">
  <em>A todo board for magicians who make things happen.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?style=flat-square" />
  <img src="https://img.shields.io/badge/built_with-Tauri_v2-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/size-~5MB-green?style=flat-square" />
</p>

---

Lumous is a native macOS desktop app for managing tasks across Kanban boards. Fast, offline-first, and optionally syncs to GitHub.

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

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

That's it. No dependencies, no Homebrew, no account. Data is stored locally in `~/Library/Application Support/com.zenja.todo/`. The app updates itself — click the version number in the sidebar to check.

> **Why not a `.dmg`?** macOS quarantines files downloaded through browsers, which causes unsigned apps to be flagged as "damaged". Installing via `curl` skips Gatekeeper entirely.

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
  <sub><strong>lumous</strong> (Finnish) — magic, enchantment, spell</sub>
</p>
