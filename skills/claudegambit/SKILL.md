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
