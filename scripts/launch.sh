#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/claudegambit.pid"
SIGNAL_FILE="/tmp/claudegambit.signal"
LOCK_FILE="/tmp/claudegambit.lock"

# Stop mode
if [ "$1" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    kill "$(cat $PID_FILE)" 2>/dev/null
    rm -f "$PID_FILE" "$SIGNAL_FILE" "$LOCK_FILE"
    echo "ClaudeGambit stopped."
  else
    echo "ClaudeGambit is not running."
  fi
  exit 0
fi

# Check if already running or already launching
if [ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
  echo "ClaudeGambit is already running."
  exit 0
fi
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 10 ]; then
    echo "ClaudeGambit is already launching."
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi
touch "$LOCK_FILE"

# Write initial signal state (paused)
echo "paused" > "$SIGNAL_FILE"

# Write a launcher script (avoids quoting issues with osascript)
LAUNCHER="/tmp/claudegambit_run.sh"
cat > "$LAUNCHER" << SCRIPT
#!/bin/bash
cd "$PLUGIN_DIR/game" && npx tsx src/index.ts --puzzle --signal-file "$SIGNAL_FILE" --pid-file "$PID_FILE"
rm -f "$PID_FILE" "$SIGNAL_FILE" "$LOCK_FILE" "$LAUNCHER"
SCRIPT
chmod +x "$LAUNCHER"

if [[ "$OSTYPE" == "darwin"* ]]; then
  case "$TERM_PROGRAM" in
    iTerm.app)
      # iTerm2: create new tab in current window
      osascript -e '
        tell application "iTerm"
          tell current window
            create tab with default profile
            tell current session
              write text "bash /tmp/claudegambit_run.sh"
            end tell
          end tell
        end tell'
      ;;
    ghostty)
      # Ghostty: open new window via CLI
      ghostty -e bash /tmp/claudegambit_run.sh &
      ;;
    WezTerm)
      wezterm cli spawn -- bash /tmp/claudegambit_run.sh &
      ;;
    *)
      # VS Code, Cursor, editors, or unknown terminals:
      # Find a running standalone terminal, or fall back to Terminal.app
      if osascript -e 'application "iTerm" is running' 2>/dev/null | grep -q true; then
        osascript -e '
          tell application "iTerm"
            create window with default profile
            tell current session of current window
              write text "bash /tmp/claudegambit_run.sh"
            end tell
          end tell'
      elif pgrep -xq ghostty 2>/dev/null && command -v ghostty &>/dev/null; then
        ghostty -e bash /tmp/claudegambit_run.sh &
      else
        osascript -e 'tell application "Terminal" to do script "bash /tmp/claudegambit_run.sh"'
      fi
      ;;
  esac
elif command -v gnome-terminal &> /dev/null; then
  gnome-terminal --tab -- bash "$LAUNCHER"
elif command -v xterm &> /dev/null; then
  xterm -e bash "$LAUNCHER" &
elif command -v wt.exe &> /dev/null; then
  wt.exe new-tab bash "$LAUNCHER"
else
  echo "Could not open a new terminal tab. Run manually:"
  echo "  bash $LAUNCHER"
  exit 1
fi

echo "ClaudeGambit launched! Game will activate when you submit your next prompt."
