#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/claudegambit.pid"
SIGNAL_FILE="/tmp/claudegambit.signal"

# Stop mode
if [ "$1" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    kill "$(cat $PID_FILE)" 2>/dev/null
    rm -f "$PID_FILE" "$SIGNAL_FILE"
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

# Write initial signal state (paused)
echo "paused" > "$SIGNAL_FILE"

# Launch in a new terminal window
GAME_CMD="cd $PLUGIN_DIR/game && npx tsx src/index.ts --puzzle --signal-file $SIGNAL_FILE --pid-file $PID_FILE; rm -f $PID_FILE $SIGNAL_FILE"

if [[ "$OSTYPE" == "darwin"* ]]; then
  osascript -e "tell app \"Terminal\" to do script \"$GAME_CMD\""
elif command -v gnome-terminal &> /dev/null; then
  gnome-terminal -- bash -c "$GAME_CMD"
elif command -v xterm &> /dev/null; then
  xterm -e bash -c "$GAME_CMD" &
elif command -v wt.exe &> /dev/null; then
  wt.exe bash -c "$GAME_CMD"
else
  echo "Could not open a new terminal window. Run manually:"
  echo "  cd $PLUGIN_DIR/game && npx tsx src/index.ts --puzzle"
  exit 1
fi

echo "ClaudeGambit launched! Game will activate when you submit your next prompt."
