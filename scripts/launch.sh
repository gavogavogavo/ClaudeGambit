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
