---
name: claudegambit
description: Launch ClaudeGambit — solve chess puzzles while Claude thinks. Opens in a separate terminal window.
---

# ClaudeGambit

When invoked, this skill launches the ClaudeGambit chess puzzle game in a separate terminal window.

## What it does

1. Opens a new terminal window with the chess puzzle game
2. The game automatically resumes when you submit prompts (Claude starts thinking)
3. The game automatically pauses when Claude finishes responding

## Usage

The user says `/claudegambit` to start the game.
The user says `/claudegambit stop` to close the game.

## Requirements

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
