#!/bin/bash

SIGNAL_FILE="/tmp/claudegambit.signal"
PID_FILE="/tmp/claudegambit.pid"

# Fail silently if game isn't running
[ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null || exit 0

echo "paused" > "$SIGNAL_FILE"
exit 0
