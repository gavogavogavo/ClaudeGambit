# ClaudeGambit Plugin Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ClaudeGambit from a standalone CLI tool into a Claude Code plugin that launches in a tmux pane and auto-pauses/resumes based on Claude's lifecycle.

**Architecture:** The game code moves into a `game/` subdirectory. A signal file protocol (`/tmp/claudegambit.signal`) lets shell hook scripts communicate pause/resume state to the running Node process. The game polls the signal file every 200ms. Plugin metadata (manifest, skill, hooks) lives at the repo root. The game adds a welcome screen, pause overlay, and UI color polish per the spec.

**Tech Stack:** TypeScript, Node.js, chess.js, sharp, tmux, bash scripts, Claude Code plugin system

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `.claude-plugin/plugin.json` | Create | Plugin manifest |
| `skills/claudegambit/SKILL.md` | Create | Skill definition for `/claudegambit` slash command |
| `hooks/hooks.json` | Create | Hook config for UserPromptSubmit and Stop events |
| `scripts/launch.sh` | Create | Launch/stop game in tmux pane |
| `scripts/resume.sh` | Create | Signal game to resume (called by hook) |
| `scripts/pause.sh` | Create | Signal game to pause (called by hook) |
| `scripts/setup.sh` | Create | One-time setup: npm install, build |
| `game/src/signal.ts` | Create | Signal file polling and state management |
| `game/src/overlay.ts` | Create | Welcome screen and pause overlay rendering |
| `game/src/colors.ts` | Create | Centralized color palette constants from spec |
| `game/src/puzzle.ts` | Modify (from `src/puzzle.ts`) | Add signal-aware pause/resume, welcome flow |
| `game/src/index.ts` | Modify (from `src/index.ts`) | Add `--signal-file` and `--pid-file` CLI flags |
| `game/src/input.ts` | Modify (from `src/input.ts`) | Non-blocking key read for signal polling |
| `game/src/stats.ts` | Modify (from `src/stats.ts`) | Boxed session summary per spec UI |
| `game/src/menu.ts` | Modify (from `src/menu.ts`) | Updated colors per spec palette |
| `game/src/board.ts` | Modify (from `src/board.ts`) | Use centralized colors |
| `game/package.json` | Move from root | Game-specific package.json |
| `game/tsconfig.json` | Move from root | Game-specific tsconfig |
| `game/data/puzzles.json` | Move from `data/` | Puzzle data |
| `game/assets/` | Move from `sprites3/` | Sprite PNGs |

---

## Chunk 1: Directory Restructure + Plugin Scaffolding

### Task 1: Move game code into `game/` subdirectory

**Files:**
- Move: `src/` → `game/src/`
- Move: `package.json` → `game/package.json`
- Move: `tsconfig.json` → `game/tsconfig.json`
- Move: `data/` → `game/data/`
- Move: `sprites3/` → `game/assets/`
- Move: `test/` → `game/test/`
- Move: `scripts/fetch-puzzles.ts` → `game/scripts/fetch-puzzles.ts`
- Modify: `game/src/index.ts` — update `--dir` default path to `assets`
- Modify: `game/src/puzzle.ts` — update puzzles.json path
- Modify: `game/src/decoder.ts` — no changes needed (paths are passed in)
- Modify: `game/package.json` — update scripts to use `game/` relative paths

- [ ] **Step 1: Create game directory and move files**

```bash
mkdir -p game
mv src game/src
mv package.json game/package.json
mv package-lock.json game/package-lock.json
mv tsconfig.json game/tsconfig.json
mv data game/data
mv sprites3 game/assets
mv test game/test
mkdir -p game/scripts
mv scripts/fetch-puzzles.ts game/scripts/fetch-puzzles.ts
```

- [ ] **Step 2: Update `game/src/index.ts` default sprite path**

Change the `--dir` default from `'sprites3'` to `path.join(import.meta.dirname, '..', 'assets')`.

- [ ] **Step 3: Update `game/src/puzzle.ts` puzzles.json path**

The `loadPuzzles()` function uses `path.join(import.meta.dirname, '..', 'data', 'puzzles.json')`. This already works since the relative structure is preserved within `game/`.

Verify it still resolves correctly — the file is now at `game/data/puzzles.json` and `puzzle.ts` is at `game/src/puzzle.ts`, so `../data/puzzles.json` is correct. No change needed.

- [ ] **Step 4: Verify build and run**

```bash
cd game && npm install && npx tsc --noEmit
npx tsx src/index.ts --preview
npx tsx src/index.ts --puzzle
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move game code into game/ subdirectory"
```

---

### Task 2: Create plugin manifest and skill

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `skills/claudegambit/SKILL.md`

- [ ] **Step 1: Create plugin manifest**

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "claudegambit",
  "description": "Chess puzzles while Claude thinks. Solve mate-in-1, 2, and 3 puzzles between prompts.",
  "version": "1.0.0",
  "author": {
    "name": "David"
  },
  "repository": "https://github.com/gavogavogavo/ClaudeGambit",
  "license": "MIT"
}
```

- [ ] **Step 2: Create skill definition**

Create `skills/claudegambit/SKILL.md`:

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

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/ skills/
git commit -m "feat: add plugin manifest and skill definition"
```

---

### Task 3: Create hooks configuration

**Files:**
- Create: `hooks/hooks.json`

- [ ] **Step 1: Create hooks config**

Create `hooks/hooks.json`:

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

- [ ] **Step 2: Commit**

```bash
git add hooks/
git commit -m "feat: add hook config for pause/resume signals"
```

---

### Task 4: Create shell scripts

**Files:**
- Create: `scripts/launch.sh`
- Create: `scripts/resume.sh`
- Create: `scripts/pause.sh`
- Create: `scripts/setup.sh`

- [ ] **Step 1: Create launch.sh**

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
  "cd $PLUGIN_DIR/game && npx tsx src/index.ts --puzzle --signal-file $SIGNAL_FILE --pid-file $PID_FILE; rm -f $PID_FILE $SIGNAL_FILE"

echo "ClaudeGambit launched! Game will activate when you submit your next prompt."
```

- [ ] **Step 2: Create resume.sh**

```bash
#!/bin/bash

SIGNAL_FILE="/tmp/claudegambit.signal"
PID_FILE="/tmp/claudegambit.pid"

# Fail silently if game isn't running
[ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null || exit 0

echo "resume" > "$SIGNAL_FILE"
exit 0
```

- [ ] **Step 3: Create pause.sh**

```bash
#!/bin/bash

SIGNAL_FILE="/tmp/claudegambit.signal"
PID_FILE="/tmp/claudegambit.pid"

# Fail silently if game isn't running
[ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null || exit 0

echo "paused" > "$SIGNAL_FILE"
exit 0
```

- [ ] **Step 4: Create setup.sh**

```bash
#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Setting up ClaudeGambit..."

cd "$PLUGIN_DIR/game"

npm install

npx tsc --noEmit && echo "TypeScript OK"

if [ ! -f "data/puzzles.json" ]; then
  echo "Generating puzzle data..."
  npx tsx scripts/fetch-puzzles.ts
fi

echo "ClaudeGambit ready! Use /claudegambit to start."
```

- [ ] **Step 5: Make scripts executable**

```bash
chmod +x scripts/launch.sh scripts/resume.sh scripts/pause.sh scripts/setup.sh
```

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: add shell scripts for tmux launch/pause/resume"
```

---

## Chunk 2: Signal Protocol + Pause/Resume

### Task 5: Create signal file module

**Files:**
- Create: `game/src/signal.ts`

- [ ] **Step 1: Create signal.ts**

```typescript
import { readFileSync, writeFileSync } from 'fs';

export type SignalState = 'paused' | 'resume' | 'none';

/**
 * Reads the current signal state from the signal file.
 * Returns 'none' if no file exists or the file can't be read.
 */
export function readSignal(signalFile: string | undefined): SignalState {
  if (!signalFile) return 'none';
  try {
    const content = readFileSync(signalFile, 'utf-8').trim();
    if (content === 'paused' || content === 'resume') return content;
    return 'none';
  } catch {
    return 'none';
  }
}

/**
 * Write PID file for the current process.
 */
export function writePidFile(pidFile: string): void {
  writeFileSync(pidFile, String(process.pid));
}

/**
 * Poll signal file at an interval. Calls onPause/onResume when state changes.
 * Returns a stop function.
 */
export function startSignalPoller(
  signalFile: string,
  onPause: () => void,
  onResume: () => void,
  intervalMs = 200
): () => void {
  let lastState: SignalState = 'none';

  const timer = setInterval(() => {
    const state = readSignal(signalFile);
    if (state !== lastState) {
      lastState = state;
      if (state === 'paused') onPause();
      if (state === 'resume') onResume();
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
```

- [ ] **Step 2: Commit**

```bash
git add game/src/signal.ts
git commit -m "feat: add signal file protocol for pause/resume"
```

---

### Task 6: Create color palette module

**Files:**
- Create: `game/src/colors.ts`

- [ ] **Step 1: Create colors.ts with all spec colors**

```typescript
import type { RGB } from './types.js';

const ESC = '\x1b';

// Board colors
export const LIGHT_SQUARE: RGB = [234, 235, 200];
export const DARK_SQUARE: RGB = [119, 153, 84];
export const CURSOR_COLOR: RGB = [186, 202, 68];
export const SELECTED_COLOR: RGB = [106, 135, 77];
export const CORRECT_COLOR: RGB = [100, 194, 100];
export const WRONG_COLOR: RGB = [220, 80, 80];
export const OPPONENT_COLOR: RGB = [170, 162, 58];
export const HINT_COLOR: RGB = [220, 160, 50];
export const CAPTURE_CORNER: RGB = [180, 60, 60];

// ANSI style helpers
export const BOLD = `${ESC}[1m`;
export const DIM = `${ESC}[2m`;
export const RESET = `${ESC}[0m`;
export const CLR_EOL = `${ESC}[K`;
export const HIDE_CURSOR = `${ESC}[?25l`;
export const SHOW_CURSOR = `${ESC}[?25h`;
export const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
export const CURSOR_HOME = `${ESC}[H`;
export const CLEAR_BELOW = `${ESC}[J`;

// UI chrome colors (truecolor)
export const TEAL = `${ESC}[38;2;80;200;180m`;
export const GREEN_FG = `${ESC}[38;2;80;220;100m`;
export const RED_FG = `${ESC}[38;2;220;80;80m`;
export const ORANGE_FG = `${ESC}[38;2;255;170;50m`;
export const DIM_GRAY = `${ESC}[2m${ESC}[38;2;140;140;140m`;
export const MED_GRAY = `${ESC}[38;2;160;160;160m`;
export const BORDER_GRAY = `${ESC}[38;2;100;100;100m`;
export const WHITE_FG = `${ESC}[38;2;220;220;220m`;
export const BRIGHT_WHITE = `${ESC}[1m${ESC}[38;2;255;255;255m`;
```

- [ ] **Step 2: Update board.ts to import from colors.ts**

Replace the hardcoded color constants in `game/src/board.ts` with imports from `colors.ts`. Remove the exports of `LIGHT_SQUARE`, `DARK_SQUARE`, `CURSOR_COLOR`, `SELECTED_COLOR`, `CAPTURE_CORNER` from board.ts and import them from `colors.ts` instead.

- [ ] **Step 3: Update puzzle.ts to import from colors.ts**

Replace all hardcoded ANSI escape code constants and RGB colors in `game/src/puzzle.ts` with imports from `colors.ts`. Remove duplicate definitions of `BOLD`, `DIM`, `CYAN`, `GREEN`, `RED`, `RESET`, `CLR_EOL`, `CORRECT_COLOR`, `WRONG_COLOR`, `OPPONENT_COLOR`, `HINT_COLOR`, etc.

- [ ] **Step 4: Update menu.ts to import from colors.ts**

Replace hardcoded ANSI constants in `game/src/menu.ts` with imports from `colors.ts`.

- [ ] **Step 5: Update stats.ts to import from colors.ts**

Replace hardcoded ANSI constants in `game/src/stats.ts` with imports from `colors.ts`.

- [ ] **Step 6: Verify build**

```bash
cd game && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add game/src/colors.ts game/src/board.ts game/src/puzzle.ts game/src/menu.ts game/src/stats.ts
git commit -m "refactor: centralize color palette into colors.ts"
```

---

### Task 7: Create overlay module (welcome screen + pause overlay)

**Files:**
- Create: `game/src/overlay.ts`

- [ ] **Step 1: Create overlay.ts**

Implements two overlays:

1. **Welcome screen** — shown on first launch before any signal arrives:
```
╔══════════════════════════════════════════╗
║            ♔  ClaudeGambit  ♔            ║
║       Chess puzzles while Claude         ║
║              thinks                      ║
║    Submit a prompt to start playing      ║
║       or press Enter for free play       ║
╚══════════════════════════════════════════╝
```

2. **Pause overlay** — shown when Claude finishes responding:
```
╔══════════════════════════════════════════╗
║      ♔  Claude finished responding       ║
║      Check your terminal for output      ║
║          Press Enter to keep playing     ║
╚══════════════════════════════════════════╝
```

Both use the `TEAL` border color from colors.ts. The overlay is rendered centered on screen. Both return when Enter is pressed or a resume signal arrives.

The module exports:
- `showWelcomeScreen(readKey, signalFile): Promise<'play' | 'signal_resume'>`
- `showPauseOverlay(readKey, signalFile): Promise<'dismiss' | 'signal_resume'>`

Both functions poll the signal file while waiting for keypresses, so a resume signal can wake them up.

- [ ] **Step 2: Commit**

```bash
git add game/src/overlay.ts
git commit -m "feat: add welcome screen and pause overlay"
```

---

### Task 8: Add signal-aware pause/resume to puzzle loop

**Files:**
- Modify: `game/src/puzzle.ts`
- Modify: `game/src/index.ts`
- Modify: `game/src/input.ts`

- [ ] **Step 1: Update input.ts — add non-blocking key check**

Add a `hasKey()` method to the key reader that returns `true` if a key is queued, without blocking. This is needed for the signal polling loop — the game needs to check both keypresses and signal file changes.

Also add a `readKeyWithTimeout(ms)` method that resolves with the key or `null` after timeout. This enables the game loop to poll the signal file between key waits.

- [ ] **Step 2: Update index.ts — add signal/pid CLI flags**

Add `--signal-file <path>` and `--pid-file <path>` options to the commander config. Pass them through to `runPuzzleLoop()`.

- [ ] **Step 3: Update puzzle.ts — integrate signal protocol**

Major changes to `runPuzzleLoop`:

1. Accept `signalFile?: string` and `pidFile?: string` parameters.
2. If `pidFile` is provided, write PID file on startup.
3. If `signalFile` is provided:
   - Show welcome screen first (waits for Enter or resume signal).
   - During puzzle play, check signal file between key reads (using `readKeyWithTimeout`).
   - When pause signal detected mid-puzzle: freeze state, show pause overlay, wait for Enter or resume signal.
   - Pause the puzzle timer during pause.
4. If no signal file (standalone mode), skip welcome/pause logic — behave exactly as before.

The key architectural change: replace `await readKey()` calls with a wrapper that also polls the signal file:

```typescript
async function waitForInput(): Promise<KeyPress> {
  while (true) {
    const key = await readKeyWithTimeout(200);
    if (key) return key;
    // Check signal
    if (signalFile) {
      const signal = readSignal(signalFile);
      if (signal === 'paused' && !isPaused) {
        isPaused = true;
        pauseTimer();
        const result = await showPauseOverlay(readKey, signalFile);
        isPaused = false;
        resumeTimer();
        redrawCurrentState(); // Restore the game screen
      }
    }
  }
}
```

- [ ] **Step 4: Verify build and standalone mode still works**

```bash
cd game && npx tsc --noEmit
npx tsx src/index.ts --puzzle  # No signal file — should work as before
```

- [ ] **Step 5: Test signal mode manually**

```bash
# Terminal 1: Start game with signal file
echo "paused" > /tmp/test_signal
npx tsx src/index.ts --puzzle --signal-file /tmp/test_signal --pid-file /tmp/test_pid

# Terminal 2: Toggle signals
echo "resume" > /tmp/test_signal   # Game should resume
echo "paused" > /tmp/test_signal   # Game should pause
```

- [ ] **Step 6: Commit**

```bash
git add game/src/input.ts game/src/index.ts game/src/puzzle.ts
git commit -m "feat: add signal-aware pause/resume to puzzle loop"
```

---

## Chunk 3: UI Polish + Session Summary

### Task 9: Update stats.ts — boxed session summary

**Files:**
- Modify: `game/src/stats.ts`

- [ ] **Step 1: Add timer pause/resume support**

Add `pauseTimer()` and `resumeTimer()` methods to `SessionStats`. These store the elapsed time when paused and resume from there, so pause time doesn't count toward solve time.

- [ ] **Step 2: Replace `printSummary()` with boxed output**

Replace the plain-text summary with a box-drawn summary per the spec:
```
╔══════════════════════════════════════════╗
║          ♔  Session Complete  ♔          ║
║     Puzzles attempted     12             ║
║     Puzzles solved         10            ║
║     Accuracy              83%            ║
║     Best streak            8             ║
║     Average solve time    24s            ║
║         Thanks for playing!              ║
╚══════════════════════════════════════════╝
```

Use colors from `colors.ts`: solved count in green, best streak in orange, labels in dim gray.

- [ ] **Step 3: Commit**

```bash
git add game/src/stats.ts
git commit -m "feat: boxed session summary with colored stats"
```

---

### Task 10: Update menu.ts — spec colors

**Files:**
- Modify: `game/src/menu.ts`

- [ ] **Step 1: Update menu to use spec color palette**

- Use `TEAL` for the border and selected option arrow (`▸`)
- Use `BRIGHT_WHITE` for selected option text
- Use `DIM_GRAY` for unselected options and instructions
- Use `BORDER_GRAY` for the border (or `TEAL` per spec)

- [ ] **Step 2: Commit**

```bash
git add game/src/menu.ts
git commit -m "feat: update difficulty menu with spec color palette"
```

---

### Task 11: Update header box — spec colors and timer

**Files:**
- Modify: `game/src/puzzle.ts`

- [ ] **Step 1: Add timer display to header**

Add a live timer showing elapsed time for the current puzzle: `⏱ 0:34`

The timer shows in the header box's second line alongside puzzle number and rating:
```
║  Puzzle #7  ·  Rating: 1420  ·  ⏱ 0:34         ║
```

Use `DIM_GRAY` for the timer text.

- [ ] **Step 2: Update header box border to use BORDER_GRAY**

Change the header box border characters to use `BORDER_GRAY` color by default (dim gray `100,100,100`).

- [ ] **Step 3: Update streak display to use ORANGE_FG**

The streak counter `🔥 Streak: 5` should use `ORANGE_FG` color.

- [ ] **Step 4: Verify build**

```bash
cd game && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add game/src/puzzle.ts
git commit -m "feat: add timer display and spec colors to header"
```

---

### Task 12: Final integration test and cleanup

**Files:**
- Modify: `game/test/converter.test.ts` — fix import paths if needed
- Create: `README.md` at repo root

- [ ] **Step 1: Run tests**

```bash
cd game && npx vitest run
```

Fix any import path issues from the directory restructure.

- [ ] **Step 2: Test full plugin flow manually**

```bash
# In tmux:
bash scripts/launch.sh
# Verify game launches in side pane
# Verify pause/resume with signal files
bash scripts/launch.sh stop
# Verify pane closes
```

- [ ] **Step 3: Test standalone mode**

```bash
cd game && npx tsx src/index.ts --puzzle
# Should work exactly as before without signal files
```

- [ ] **Step 4: Create root README.md**

Brief README with:
- What ClaudeGambit is
- How to install as a Claude Code plugin
- How to run standalone
- Screenshot placeholder

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: complete plugin integration with tmux launch, signals, and UI polish"
git push
```
