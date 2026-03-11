---
name: lumous-design
description: Design system and visual guidelines for the Lumous todo app. Use this skill whenever creating or modifying UI components, styling elements, adding visual effects, or making any visual changes to the Lumous app. Also use when the user asks about colors, themes, card styling, animations, or layout decisions. This skill should be consulted proactively for ANY component work — even backend-triggered UI like goal cards, ritual indicators, or new panels.
---

# Lumous Design System

Lumous is a magical, whimsical macOS todo app. The design is refined, minimal, and elegant — never heavy or corporate. Every surface should feel like it breathes.

## Core Principles

1. **Opacity over color** — Create hierarchy through transparency, not hue. Text, borders, and surfaces all use rgba with varying opacity on the board's base color.
2. **Borderless elegance** — Cards and surfaces rely on subtle backgrounds and soft glows, not thick borders or accent stripes.
3. **Theme-aware everything** — All colors flow from `getBoardTheme(boardColor)` tokens. Never hardcode rgba values when a theme token exists.
4. **Inline styles only** — No Tailwind classes. They get stripped/compressed in the Tauri WebView. Every style is an inline `style={{}}` object.
5. **Whimsical restraint** — Sparkles, wisps, and wizard celebrations add joy without overwhelming. Decorative elements are subtle and ephemeral.
6. **Glows, not borders** — Use `filter: drop-shadow(...)` for color emphasis. Never `box-shadow` for colored accents. Drop-shadow follows alpha contours naturally.

## The Cardinal Rule: No Accent Borders

**NEVER use thick colored left/top/bottom borders as visual accents on cards or panels.** This is a common pattern in corporate dashboards (Notion, Linear, Jira) that feels heavy and mechanical in Lumous.

What NOT to do:
```typescript
// WRONG — colored border accent
style={{
  borderLeft: `3px solid ${color}`,
  background: `linear-gradient(135deg, ${theme.surfaceFaint} 0%, ${color}08 100%)`,
}}
```

What to do instead — pick the right approach for the context:

### Option A: Glow orb (for labeled/colored items like cards)
A clipped blur circle that sits behind content, creating a soft colored aura:
```typescript
// Container with overflow clip
<div style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden", pointerEvents: "none", isolation: "isolate" }}>
  <div style={{
    position: "absolute", top: -6, right: -6,
    width: 56, height: 56, borderRadius: "50%",
    background: color,
    opacity: 0.4,
    filter: "blur(18px)",
  }} />
</div>
```

### Option B: Color dot indicator (for named items like goals)
A small glowing dot next to the name — compact, unmistakable:
```typescript
<div style={{
  width: 10, height: 10, borderRadius: 5,
  background: color,
  filter: `drop-shadow(0 0 4px ${color}60)`,
  flexShrink: 0,
}} />
```

### Option C: Thin contextual border (when a boundary is needed)
Use `1px solid` with very low opacity — the border hints, never shouts:
```typescript
style={{
  border: `1px solid ${theme.border}`,        // default
  border: `1px solid ${labelColor}30`,         // with color, 30 = ~19% opacity
  background: theme.surface,
}}
```

### Option D: Subtle gradient fill (for distinguished surfaces)
When a panel needs to feel distinct from its siblings:
```typescript
style={{
  background: `linear-gradient(135deg, ${theme.surface} 50%, ${color}18 100%)`,
  border: `1px solid ${color}30`,
}}
```
Note: the color starts at 50% (half the surface is neutral), and the tint is `18` (~9% opacity). This is gentle.

## Theme Tokens

Always use `getBoardTheme(board.backgroundColor)` and its semantic tokens:

| Token | Purpose | Dark board | Light board |
|-------|---------|------------|-------------|
| `text` | Primary text | white 90% | dark 85% |
| `textSecondary` | Descriptions | white 45% | dark 48% |
| `textTertiary` | Timestamps, hints | white 25% | dark 32% |
| `textFaint` | Empty states | white 10% | dark 14% |
| `border` | Standard borders | white 8% | dark 8% |
| `borderSubtle` | Drop zones, dividers | white 8% | dark 6% |
| `surface` | Card/input backgrounds | white 6-8% | dark 3-5% |
| `surfaceHover` | Active/hovered surfaces | white 10-12% | dark 6-8% |
| `surfaceFaint` | Column backgrounds | white 2-3% | dark 1.5-2% |
| `overlay` | Drag overlays, pickers | white 15-20% | dark 10% |
| `isLight` | Whether board is light-themed | false | true |

## Typography

- **Font stack**: `-apple-system` (system fonts)
- **Sizes**: 11px (labels, timestamps) → 15px (card titles) → 22-28px (board title)
- **Weights**: 400 (muted) → 500 (regular) → 600 (emphasis) → 700 (headings) → 800 (stats)
- **Line height**: 1.5 for body text, default for labels
- **Letter spacing**: `0.08-0.12em` for uppercase labels only

## Border Radius Scale

- `6px` — tiny elements (color pickers, mini buttons)
- `8px` — small UI (icon buttons, tags)
- `10px` — medium elements (sidebar dots, picker panels)
- `12px` — cards, inputs, standard buttons
- `16px` — columns, preview boxes
- `24px` — modals, dialogs

## Spacing

Use px values directly. Common patterns:
- Card padding: `10px 14px`
- Column padding: `10px`
- Modal padding: `36px 40px` to `40px 44px`
- Section gaps: `10-14px`
- Element gaps: `4-8px`

## Animation Guidelines

- **Standard transitions**: `all 0.15s` for interactive elements
- **Hover reveals**: `opacity 0.15s` — elements fade in on parent hover
- **State changes**: `all 0.2s` for drop zones, tab switches
- **Decorative**: sparkles 700-1400ms, wisps 12-28s drift, wizard 3.2s entrance
- **Never animate layout** — no width/height transitions that cause reflow

## Color Application Examples

### Cards with color labels
```
background: gradient from surface to labelColor at 18 opacity
border: 1px solid labelColor at 30 opacity
glow: clipped blur orb at 40% opacity
```

### Stats/indicator panels (heatmaps, goal progress)
```
background: theme.surfaceFaint (very subtle)
no border or 1px solid theme.border
color via content (dots, fills) not container chrome
```

### Interactive elements (buttons, inputs)
```
resting: theme.surface background + theme.border border
hover: theme.surfaceHover background
active/selected: slightly higher opacity or 2px solid theme.text
```

### Destructive actions
```
color: rgba(220,80,80,0.7)
background: rgba(220,80,80,0.06) resting, rgba(220,80,80,0.25) hover
border: rgba(220,80,80,0.15)
```

## Dark Constant: `DARK_INK`

`#0a0e1a` — used for sidebar background, modal backdrops, and as the text base color on light boards. This is defined once in `types.ts`. Never duplicate it as a string literal.

## What Makes Lumous Feel Magical

- **Wisps**: floating particles in the background, palette-matched to board color
- **Sparkles**: burst on cross-column card drags
- **Wizard celebration**: appears when completing a task (moves to "completed")
- **Crescent moon labels**: SVG mask creates a crescent shape for card color indicators
- **Soft surfaces**: everything feels slightly transparent, like frosted glass
- **Board color identity**: each board's entire palette derives from its single background color

## Destructive Action Confirmations

Deleting something substantial (boards, goals) must always show a `ConfirmDialog` before proceeding. The user should never lose meaningful data from a single click.

- **Always confirm**: board deletion, goal deletion
- **Never confirm**: card/task deletion (low cost, easily re-created)
- Use `ConfirmDialog` component with `danger` prop for destructive actions

## State Management: Preventing Infinite Loops

The `useBoard` hook syncs board state between the reducer (local edits) and the parent (sidebar, shadow board). This creates a circular data flow that is easy to break:

```
useBoard reducer → onBoardChanged → refreshBoard → new initialBoard → SET_BOARD → reducer
```

**The rule**: `refreshBoard` always creates a **new object reference** (via spread). If the save effect triggers `onBoardChanged` on every board change — including those from `SET_BOARD` — the cycle never terminates.

**The fix** (`suppressSaveRef`): When the `initialBoard` effect dispatches `SET_BOARD`, it sets `suppressSaveRef.current = true`. The save effect checks this flag and skips if set. User actions (ADD_CARD, MOVE_CARD, etc.) don't set this flag, so they still propagate normally.

**When adding new effects or dispatches to `useBoard`:**
- Never call `onBoardChanged` from effects triggered by `SET_BOARD` or `initialBoard` changes
- If adding a new dispatch (like SPAWN_RITUALS), ensure it returns `state` (same reference) when there's nothing to change — otherwise it will trigger the save effect
- The save effect's `board === lastSetBoardRef.current` check relies on reference equality; `suppressSaveRef` is the backup when that check fails due to React's effect ordering

## Checklist for New Components

Before shipping any visual change:

1. Does it use `getBoardTheme()` tokens (not hardcoded rgba)?
2. Does it work on both light and dark boards?
3. Are there any thick colored borders? (Remove them)
4. Are glows using `filter: drop-shadow` or clipped blur (not `box-shadow`)?
5. Do interactive elements have hover/transition states?
6. Is the border radius from the scale (6/8/10/12/16/24)?
7. Are all styles inline (no Tailwind classes)?
8. Does it feel light and subtle, or heavy and corporate? If heavy, dial back.
9. Do destructive actions on substantial items (boards, goals) show a confirmation dialog?
10. Do new dispatches or effects in `useBoard` avoid triggering the save→refresh→SET_BOARD loop?
