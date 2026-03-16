# ClaudeGambit — Claude Code Plugin Integration Spec

## Overview

ClaudeGambit is a chess puzzle game that runs alongside Claude Code, giving users something fun to do while Claude is thinking. It launches in a separate tmux pane via the `/claudegambit` slash command and automatically pauses/resumes based on Claude Code's lifecycle.

**Core principle:** The game is active while Claude is working. When Claude finishes, the game pauses with a dismissible overlay. The user can press Enter to keep playing in free play mode, or switch back to Claude Code. When the user submits their next prompt, the game resumes automatically regardless.

---

## Plugin Structure

```
claudegambit/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── claudegambit/
│       └── SKILL.md
├── hooks/
│   └── hooks.json
├── scripts/
│   ├── launch.sh
│   ├── resume.sh
│   ├── pause.sh
│   └── setup.sh
├── game/
│   ├── src/
│   │   ├── index.ts          # Game entry point
│   │   ├── board.ts          # Board renderer
│   │   ├── puzzle.ts         # Puzzle loop
│   │   ├── converter.ts      # Sprite half-block converter
│   │   ├── decoder.ts        # PNG sprite sheet loader
│   │   ├── renderer.ts       # ANSI string assembly
│   │   ├── input.ts          # Keyboard input handler
│   │   ├── stats.ts          # Session stats tracker
│   │   ├── difficulty.ts     # Adaptive difficulty system
│   │   ├── review.ts         # Post-puzzle review mode
│   │   └── types.ts
│   ├── data/
│   │   ├── puzzles.json      # 1500 puzzles (500 each mateIn1/2/3)
│   │   └── sprites.json      # Pre-baked ANSI piece data
│   ├── assets/
│   │   └── chess_sprites.png # Source sprite sheet
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## Plugin Manifest

### `.claude-plugin/plugin.json`

```json
{
  "name": "claudegambit",
  "description": "Chess puzzles while Claude thinks. Solve mate-in-1, 2, and 3 puzzles between prompts.",
  "version": "1.0.0",
  "author": {
    "name": "David"
  },
  "homepage": "https://github.com/YOURUSER/claudegambit",
  "repository": "https://github.com/YOURUSER/claudegambit",
  "license": "MIT"
}
```

---

## Skill Definition

### `skills/claudegambit/SKILL.md`

```markdown
---
name: claudegambit
description: Launch ClaudeGambit — solve chess puzzles while Claude thinks. Opens in a tmux pane alongside your session.
---

# ClaudeGambit

When invoked, this skill launches the ClaudeGambit chess puzzle game in a side tmux pane.

## What it does

1. Checks that tmux is available
2. Creates a new tmux pane to the right of the current session
3. Starts the chess puzzle game in paused state
4. The game automatically resumes when you submit prompts (Claude starts thinking)
5. The game automatically pauses when Claude finishes responding

## Usage

The user says `/claudegambit` to start the game.
The user says `/claudegambit stop` to close the game pane.

## Requirements

- tmux must be installed and the Claude Code session must be running inside tmux
- Node.js (already required by Claude Code)

## Launch command

Run this command to start:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/launch.sh
```

To stop:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/launch.sh stop
```
```

---

## Hooks Configuration

### `hooks/hooks.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/resume.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/pause.sh"
          }
        ]
      }
    ]
  }
}
```

**Important:** These hooks fire on every prompt/stop cycle. They must be extremely fast and fail silently if the game isn't running. The scripts check for a PID file before doing anything.

---

## Scripts

### `scripts/launch.sh`

Handles both starting and stopping the game.

```bash
#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/claudegambit.pid"
SIGNAL_FILE="/tmp/claudegambit.signal"

# Stop mode
if [ "$1" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    kill "$(cat $PID_FILE)" 2>/dev/null
    rm -f "$PID_FILE" "$SIGNAL_FILE"
    # Close the tmux pane
    tmux kill-pane -t claudegambit 2>/dev/null
    echo "ClaudeGambit stopped."
  else
    echo "ClaudeGambit is not running."
  fi
  exit 0
fi

# Check if already running
if [ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
  echo "ClaudeGambit is already running."
  exit 0
fi

# Check tmux
if [ -z "$TMUX" ]; then
  echo "ClaudeGambit requires tmux. Start Claude Code inside a tmux session."
  exit 1
fi

# Write initial signal state (paused)
echo "paused" > "$SIGNAL_FILE"

# Create a new tmux pane to the right, 40% width
tmux split-window -h -l 40% -t "$TMUX_PANE" \
  "cd $PLUGIN_DIR/game && node dist/index.js --signal-file $SIGNAL_FILE --pid-file $PID_FILE; rm -f $PID_FILE $SIGNAL_FILE"

# Name the pane for easy targeting
# (tmux doesn't name panes, but we can find it by PID later)

echo "ClaudeGambit launched! Game will activate when you submit your next prompt."
```

### `scripts/resume.sh`

Called by `UserPromptSubmit` hook. Signals the game to resume.

```bash
#!/bin/bash

SIGNAL_FILE="/tmp/claudegambit.signal"
PID_FILE="/tmp/claudegambit.pid"

# Fail silently if game isn't running
[ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null || exit 0

# Signal resume
echo "resume" > "$SIGNAL_FILE"
exit 0
```

### `scripts/pause.sh`

Called by `Stop` hook. Signals the game to pause.

```bash
#!/bin/bash

SIGNAL_FILE="/tmp/claudegambit.signal"
PID_FILE="/tmp/claudegambit.pid"

# Fail silently if game isn't running
[ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null || exit 0

# Signal pause
echo "paused" > "$SIGNAL_FILE"
exit 0
```

### `scripts/setup.sh`

One-time setup script run after plugin installation. Builds the game.

```bash
#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Setting up ClaudeGambit..."

cd "$PLUGIN_DIR/game"

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify puzzles exist
if [ ! -f "data/puzzles.json" ]; then
  echo "Generating puzzle data..."
  node dist/scripts/fetch-puzzles.js
fi

echo "ClaudeGambit ready! Use /claudegambit to start."
```

---

## Signal File Protocol

The game and the hook scripts communicate via a simple signal file at `/tmp/claudegambit.signal`. This avoids the complexity of sockets or IPC.

| Signal File Contents | Meaning |
|---------------------|---------|
| `paused`            | Game should show pause screen |
| `resume`            | Game should resume active play |

The game process polls this file every 200ms. This is cheap (single file read) and avoids any race conditions with more complex IPC.

### Why a signal file instead of Unix signals (SIGUSR1/2)?

- Signal files are cross-platform (works on Windows WSL too)
- No signal handler complexity
- The state is persistent — if the game process restarts, it reads the current state
- Easy to debug (just `cat /tmp/claudegambit.signal`)

---

## Game State Machine

```
                    /claudegambit
                         │
                         ▼
              ┌─────────────────────┐
              │   WELCOME / PAUSED  │
              │  "Waiting for Claude │
              │   to think..."      │
              └──────────┬──────────┘
                         │
              UserPromptSubmit (signal: resume)
                         │
                         ▼
              ┌─────────────────────┐
              │   DIFFICULTY MENU   │◄──── First resume only
              │  Easy/Med/Hard/Adapt│
              └──────────┬──────────┘
                         │
                    Enter to confirm
                         │
                         ▼
              ┌─────────────────────┐
              │    PLAYING PUZZLE   │◄──────────────────────────┐
              │  Board + cursor +   │                            │
              │  move input         │                            │
              └──────────┬──────────┘                            │
                    │    │    │                                   │
          ┌─────────┘    │    └──────────┐                       │
          ▼              ▼               ▼                       │
     ┌─────────┐  ┌───────────┐  ┌──────────────┐               │
     │ SOLVED  │  │  SKIPPED  │  │   PAUSED     │               │
     │ ✓ flash │  │ animation │  │ "Claude done"│               │
     │ +stats  │  │ solution  │  │              │               │
     └────┬────┘  └─────┬─────┘  │  Enter = free│               │
          │             │        │  play resume  │               │
          ▼             ▼        └──┬─────┬──────┘               │
     ┌─────────────────────┐       │     │                      │
     │    REVIEW MODE      │       │     │                      │
     │  ←/→ scrub moves    │       │  Enter (free play)         │
     │  R retry, Enter next│       │     │                      │
     └──────────┬──────────┘       │     ├──────────────────────┘
                │                  │     
       Enter (next puzzle)         │  UserPromptSubmit
                │                  │  (signal: resume)
                └──────────────────┘
```

### Pause behavior details

When a pause signal arrives mid-puzzle:
- The board freezes exactly as-is
- A dismissible overlay appears (see Pause Overlay in UI section below)
- The puzzle timer pauses
- Player's cursor position, selected piece, and hint state are preserved
- **Press Enter → dismiss overlay, resume playing in free play mode**
- On signal resume (next UserPromptSubmit), everything restores exactly as it was

When a pause signal arrives during review mode:
- Same behavior — freeze in place, overlay appears, Enter to dismiss

When a pause signal arrives during difficulty select:
- Freeze the menu, overlay appears, Enter to dismiss

### Free play mode

Free play is not a separate state — it's simply dismissing the pause overlay. The game returns to whatever state it was in before (playing, review, etc.) and continues normally. All features work identically: puzzles, stats, hints, everything.

The only difference: when the next `UserPromptSubmit` signal arrives, the game is already active, so the resume signal is a no-op. The next `Stop` signal will pause again as normal.

Free play also activates from the initial welcome screen. If the user just wants to play chess without waiting for Claude, they press Enter on the welcome screen to go straight to the difficulty menu.

---

## Game Features (Current State)

These are already built. Documenting here for completeness.

### Core
- Half-block ANSI chess board renderer with 16×16 sprites downscaled to 8×8
- 1500 puzzles from Lichess (500 each: mateIn1, mateIn2, mateIn3)
- Arrow key cursor movement with square highlighting
- Enter to select piece, Enter to move, Esc to deselect
- Legal move hints (dots on valid destination squares via chess.js)
- Puzzle validation against Lichess solution
- Opponent auto-play between player moves

### UI
- Info box with box-drawing borders above the board
- "Mate in X" headline in bold cyan
- Puzzle number, rating in dim gray
- "You play as Black/White" with opponent's last move
- Single-line controls bar below the board
- H for escalating hints (highlight source → highlight destination → show move text)

### New Features
- Difficulty menu at startup (Easy/Medium/Hard/Adaptive)
- Board flips when playing as Black (pieces at bottom, inverted arrow keys)
- Stats tracking — streak in header ("🔥 Streak: 5"), session summary on quit
- Adaptive difficulty — shifts up after 3 correct, down after 2 wrong
- Skip animation (S) — plays solution move-by-move with 1s pauses
- Review mode after solving/skipping — ←/→ scrub through moves, R to retry, Enter for next
- Success flash — green border on header box when solved

---

## UI Design & Color System

The UI must feel polished and intentional — not like a terminal hack. Every element has a defined color, weight, and purpose. The goal is a dark-themed chess app aesthetic that feels native to the terminal.

### Color Palette

All colors use 24-bit truecolor ANSI (`\x1b[38;2;R;G;Bm` for FG, `\x1b[48;2;R;G;Bm` for BG).

**Board colors:**

| Element | RGB | Hex | Notes |
|---------|-----|-----|-------|
| Light square | `(234, 235, 200)` | `#EAEBC8` | Warm cream |
| Dark square | `(119, 153, 84)` | `#779954` | Muted green |
| Cursor highlight | `(186, 202, 68)` | `#BACA44` | Yellow-green, high visibility |
| Selected piece square | `(106, 135, 77)` | `#6A874D` | Deeper green, distinct from cursor |
| Legal move dot | `(0, 0, 0)` @ 40% opacity | Composited | 2×2 dot, center of square |
| Capture target dot | `(180, 60, 60)` | `#B43C3C` | Red-tinted dot on enemy pieces |
| Last move highlight | `(170, 162, 58)` | `#AAA23A` | Subtle gold tint on from/to squares |

**UI chrome colors:**

| Element | ANSI Code | Color | Notes |
|---------|-----------|-------|-------|
| Header box border | `\x1b[38;2;100;100;100m` | `#646464` | Dim gray, box-drawing chars |
| "Mate in X" headline | `\x1b[1m\x1b[38;2;80;200;180m` | `#50C8B4` | Bold teal/cyan — the hero text |
| Puzzle number | `\x1b[2m\x1b[38;2;140;140;140m` | `#8C8C8C` | Dim gray — secondary info |
| Rating | `\x1b[2m\x1b[38;2;140;140;140m` | `#8C8C8C` | Dim gray — secondary info |
| "You play as White" | `\x1b[38;2;220;220;220m` | `#DCDCDC` | Normal white |
| "White" / "Black" (the word) | `\x1b[1m\x1b[38;2;255;255;255m` | `#FFFFFF` | Bold white — emphasis |
| Opponent move | `\x1b[1m\x1b[38;2;80;200;180m` | `#50C8B4` | Bold teal — matches headline |
| Streak counter | `\x1b[38;2;255;170;50m` | `#FFAA32` | Warm orange — 🔥 energy |
| Controls bar | `\x1b[2m\x1b[38;2;120;120;120m` | `#787878` | Dim gray — recedes |
| Current square in controls | `\x1b[38;2;220;220;220m` | `#DCDCDC` | Normal white — pops from dim bar |
| Separator dots (·) | `\x1b[2m\x1b[38;2;80;80;80m` | `#505050` | Very dim — barely visible |
| Rank numbers (1-8) | `\x1b[38;2;160;160;160m` | `#A0A0A0` | Medium gray |
| File letters (a-h) | `\x1b[38;2;160;160;160m` | `#A0A0A0` | Medium gray |

**State feedback colors:**

| Element | ANSI Code | Color | Notes |
|---------|-----------|-------|-------|
| Success flash (border) | `\x1b[38;2;80;220;100m` | `#50DC64` | Bright green — header border flashes |
| Wrong move text | `\x1b[38;2;220;80;80m` | `#DC5050` | Soft red — not aggressive |
| "Correct!" text | `\x1b[1m\x1b[38;2;80;220;100m` | `#50DC64` | Bold green |
| Hint highlight (source) | `\x1b[48;2;220;160;50m` | `#DCA032` | Warm orange background |
| Hint highlight (dest) | `\x1b[48;2;100;180;220m` | `#64B4DC` | Soft blue background |
| Hint text | `\x1b[2m\x1b[38;2;180;180;180m` | `#B4B4B4` | Dim — doesn't dominate |
| Timer text | `\x1b[2m\x1b[38;2;140;140;140m` | `#8C8C8C` | Dim gray — informational |

### Layout Structure

The full game UI from top to bottom:

```
┌─────────────────────────────────────────────────┐  ← dim gray border
│  Mate in 3                    🔥 Streak: 5      │  ← bold teal     ← warm orange
│  Puzzle #7  ·  Rating: 1420  ·  ⏱ 0:34         │  ← all dim gray
│                                                  │
│  You play as Black                               │  ← white, "Black" bold
│  Opponent played: Nf3                            │  ← white, "Nf3" bold teal
└─────────────────────────────────────────────────┘  ← dim gray border

   [  1 char gap  ]

8  ┌────────────────────────────────────────────┐
   │                                            │
7  │          (chess board with pieces)          │
   │                                            │
6  │      rendered using half-block sprites      │
   │                                            │
5  │        on alternating square colors         │
   │                                            │
4  │                                            │
   │                                            │
3  │                                            │
   │                                            │
2  │                                            │
   │                                            │
1  │                                            │
   └────────────────────────────────────────────┘
     a     b     c     d     e     f     g     h

   [  1 char gap  ]

  e4  ·  ↑←↓→ Move  ·  Enter Select  ·  Esc Cancel  ·  H Hint  ·  S Skip  ·  Q Quit
  ^^^                                                                              ^^^
  white                          all dim gray                                  dim gray
```

### Header Box Detail

The header box uses box-drawing characters for a clean border:

```
Top:     ╔══════════════════════════════════════════╗
Sides:   ║                                          ║
Bottom:  ╚══════════════════════════════════════════╝
```

Border color: dim gray `(100, 100, 100)`. The border should match the board width exactly — aligning the left edge of the header with the left edge of the board creates visual cohesion.

**Success flash:** When a puzzle is solved, the border characters briefly change color to bright green `(80, 220, 100)` for ~500ms, then revert to dim gray. Only the border changes — the content inside stays the same.

**Adaptive difficulty indicator:** When in adaptive mode, show the current bracket in the header as a subtle label:

```
║  Mate in 2                    🔥 Streak: 3      ║
║  Puzzle #4  ·  Rating: 1350  ·  ⏱ 0:12         ║
║  Difficulty: Medium ▲                            ║  ← "▲" green if trending up, "▼" red if down
```

The difficulty label uses:
- `Medium` in dim white `(180, 180, 180)`
- `▲` in green `(80, 220, 100)` when trending up
- `▼` in red `(220, 80, 80)` when trending down
- No arrow when stable

### Pause Overlay

When Claude finishes and the game pauses, render a centered overlay on top of the current screen. The board stays visible but dimmed behind it.

```
╔══════════════════════════════════════════╗
║                                          ║
║      ♔  Claude finished responding       ║  ← white, "♔" teal
║                                          ║
║      Check your terminal for output      ║  ← dim gray
║                                          ║
║          Press Enter to keep playing     ║  ← bold teal — the CTA
║                                          ║
╚══════════════════════════════════════════╝
```

Border color: teal `(80, 200, 180)` — brighter than the normal header border to grab attention. The overlay is centered both horizontally and vertically within the game pane.

**Dimming the background:** When the overlay is active, re-render the board with all colors shifted toward gray (reduce saturation by ~50%). This makes the overlay pop and signals "game paused" visually.

### Welcome Screen

Shown on first launch before any prompt is submitted:

```
╔══════════════════════════════════════════╗
║                                          ║
║            ♔  ClaudeGambit  ♔            ║  ← bold teal, "♔" white
║                                          ║
║       Chess puzzles while Claude         ║  ← dim white
║              thinks                      ║
║                                          ║
║    Submit a prompt to start playing      ║  ← dim gray
║       or press Enter for free play       ║  ← bold teal — the CTA
║                                          ║
╚══════════════════════════════════════════╝
```

Border color: teal `(80, 200, 180)`.

### Difficulty Menu

Rendered inside a box, arrow-key selectable:

```
╔══════════════════════════════════════════╗
║                                          ║
║            Select Difficulty             ║  ← bold white
║                                          ║
║          ▸ Easy    (800-1200)            ║  ← selected: bold teal + "▸"
║            Medium  (1200-1600)           ║  ← unselected: dim gray
║            Hard    (1600+)               ║  ← unselected: dim gray
║            Adaptive                      ║  ← unselected: dim gray
║                                          ║
║           Enter to confirm               ║  ← dim gray
║                                          ║
╚══════════════════════════════════════════╝
```

The selected option uses:
- `▸` arrow in teal `(80, 200, 180)`
- Option text in bold white `(255, 255, 255)`
- Rating range in dim gray `(140, 140, 140)`

Unselected options use dim gray `(140, 140, 140)` for everything.

### Session Summary (on quit)

Shown when the user presses Q:

```
╔══════════════════════════════════════════╗
║                                          ║
║          ♔  Session Complete  ♔          ║  ← bold teal
║                                          ║
║     Puzzles attempted     12             ║  ← dim label, white number
║     Puzzles solved         10            ║  ← dim label, green number
║     Accuracy              83%            ║  ← dim label, white number
║     Best streak            8             ║  ← dim label, orange number
║     Average solve time    24s            ║  ← dim label, white number
║                                          ║
║         Thanks for playing!              ║  ← dim gray
║                                          ║
╚══════════════════════════════════════════╝
```

Number colors:
- Solved count: green `(80, 220, 100)` 
- Best streak: orange `(255, 170, 50)`
- Other numbers: white `(220, 220, 220)`
- Labels: dim gray `(140, 140, 140)`

### Wrong Move Feedback

When the player makes a wrong move, show a brief inline message below the board (above the controls bar):

```
  ✗ Wrong move — try again                        ← soft red
```

This appears for 2 seconds then fades (reverts to empty line). It does NOT say what the correct move is.

### Review Mode UI

After solving or skipping, the controls bar changes:

```
  Move 2/6  ·  ←→ Scrub  ·  R Retry  ·  Enter Next  ·  Q Quit
  ^^^^^^^^^
  white          all dim gray
```

The board shows the current position in the move sequence. The move counter (`Move 2/6`) updates as the player scrubs. Squares involved in the current move are highlighted with the last-move highlight color (gold tint).

### Typography Rules

| Element | ANSI Style | When to use |
|---------|-----------|-------------|
| `\x1b[1m` Bold | Headlines, key values, CTAs, the player's color, move notation | Only for things the eye should land on first |
| `\x1b[2m` Dim | Secondary info, labels, controls, separators | Anything that supports but shouldn't dominate |
| Normal (no modifier) | Body text, rank/file labels, current square | Default — readable but not demanding |
| `\x1b[0m` Reset | After every styled segment | Always reset to prevent color bleed |

**General rules:**
- Never use more than 2 levels of visual hierarchy in a single line
- Bold teal is reserved for the most important info (mate type, CTAs, move notation)
- Dim gray is the workhorse — use it for everything that isn't the primary focus
- White is the middle ground — readable, present, but not screaming
- Orange is exclusively for streak/achievement — sparingly used for dopamine
- Red and green are exclusively for wrong/right feedback — never decorative
- Always reset `\x1b[0m` at the end of every line to prevent background color bleed into the terminal

### Marketplace Setup

To distribute via Claude Code marketplace, host the plugin on GitHub and add a marketplace manifest.

The user installs with:
```
/plugin marketplace add YOURUSER/claudegambit
```

Then runs the setup:
```
/claudegambit setup
```

Or the `SessionStart` hook can auto-check if `game/dist` exists and run `setup.sh` if not.

### Dependencies

| Dependency | Required By | Notes |
|-----------|-------------|-------|
| tmux | Plugin integration | Must be running inside tmux |
| Node.js | Game runtime | Already required by Claude Code |
| chess.js | Game logic | Installed via npm |
| sharp | Sprite converter | Only needed if rebuilding sprites |

### Pre-built Distribution

To avoid requiring `sharp` at install time, the `data/sprites.json` file should be pre-built and committed to the repo. Users only need `npm install` for `chess.js` and runtime dependencies, not the full build toolchain.

Similarly, `data/puzzles.json` should be committed. The 1500 puzzles are ~2MB — small enough to include in the repo. This avoids requiring users to download the multi-GB Lichess CSV.

---

## Tmux Pane Management

### Pane sizing

The game pane opens at 40% width to the right. At 8×8 sprites per square, the board is ~64 chars wide. A 40% split on a 200-char-wide terminal gives 80 chars — enough for the board plus rank labels.

If the terminal is too narrow (< 140 chars), the script should warn the user and suggest using a wider terminal or full screen.

### Pane focus

The game pane should NOT steal focus from the Claude Code pane. The user continues typing in Claude Code. They switch to the game pane when they want to play (click or tmux shortcut `Ctrl-B →`).

However, since the game activates during Claude's thinking time (when the user isn't typing), this is a natural switch point. The resume script could optionally switch focus to the game pane:

```bash
# Optional: switch focus to game pane on resume
# tmux select-pane -t claudegambit
```

This should be a config option, not default behavior. Some users will prefer to stay in the Claude Code pane and read the streaming output.

### Pane restoration

If the user closes the game pane manually (Ctrl-D or `exit`), the PID file and signal file should be cleaned up. The hooks will fail silently (they check PID file first).

To restart: just run `/claudegambit` again.

---

## Configuration (Future)

A `~/.claudegambit.json` config file for user preferences:

```json
{
  "difficulty": "adaptive",
  "autoFocus": false,
  "panePosition": "right",
  "paneSize": "40%",
  "theme": {
    "lightSquare": [234, 235, 200],
    "darkSquare": [119, 153, 84],
    "highlight": [186, 202, 68],
    "selected": [106, 135, 77]
  }
}
```

This is a v2 feature. For v1, hardcode sensible defaults.

---

## Open Questions

1. **What if the user isn't in tmux?** Options: (a) error with instructions, (b) fall back to a new terminal window via OS-specific commands (iTerm2 AppleScript, `wt` on Windows Terminal, `gnome-terminal` on Linux). Start with (a), expand in v2.

2. **Should hooks be active even when the game isn't running?** Currently, the hook scripts fail silently if no PID file exists. This is correct — zero overhead when the game isn't running. But the hooks still *fire* on every prompt/stop. This is negligible cost (one file existence check) but worth noting.

3. **Multi-session support?** If the user has multiple Claude Code sessions, each would try to launch its own ClaudeGambit. The PID file prevents duplicate launches, but only the first session's hooks would control the game. For v1, this is fine. For v2, use session-specific PID files (`/tmp/claudegambit.$CLAUDE_SESSION_ID.pid`).

4. **What about Claude Code in VS Code?** VS Code's integrated terminal supports tmux, but the UX is different. The game pane might be too small in VS Code's terminal panel. May need a different integration path for VS Code (webview panel?). Punt to v2.