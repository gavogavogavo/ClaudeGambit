# ClaudeGambit

Chess puzzles in your terminal. Solve mate-in-1, mate-in-2, and mate-in-3 puzzles with pixel art pieces rendered using the Unicode half-block technique.

Built as a Claude Code plugin — play chess puzzles while Claude thinks.

## Features

- Half-block ANSI chess board with 8x8 pixel art sprites
- 1500 puzzles from Lichess (500 each: mateIn1, mateIn2, mateIn3)
- Keyboard-driven: arrow keys, Enter to select/move, Esc to cancel
- Legal move highlighting with dots and capture markers
- Escalating hint system (H key)
- Difficulty selector: Easy, Medium, Hard, Adaptive
- Board flips when playing as Black
- Session stats: streak tracking, accuracy, solve time
- Post-solve review mode: scrub through moves with arrow keys
- Skip animation: watch the solution play out move by move

## Install as Claude Code Plugin

Requires tmux. Inside a tmux session:

```bash
claude plugin add gavogavogavo/ClaudeGambit
```

Then run the setup:

```bash
/claudegambit setup
```

The game launches in a separate terminal window and auto-pauses/resumes with Claude's thinking cycle.

## Run Standalone

```bash
cd game
npm install
npx tsx src/index.ts --puzzle
```

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor |
| Enter | Select piece / confirm move |
| Esc | Cancel selection |
| H | Hint (escalating) |
| S | Skip (animates solution) |
| R | Retry puzzle |
| Q | Quit |

## CLI Options

```
--puzzle              Start puzzle mode
--preview             Preview all sprites
--fen <string>        Render a board position
--render-size <n>     Sprite size for board (default: auto)
--outline             Enable piece outlines
--signal-file <path>  Signal file for plugin pause/resume
--pid-file <path>     PID file for plugin mode
```
