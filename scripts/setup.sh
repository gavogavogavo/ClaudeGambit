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
