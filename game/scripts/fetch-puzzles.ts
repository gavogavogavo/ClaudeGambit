/**
 * Downloads the Lichess puzzle database, filters for mateIn1/2/3,
 * takes 500 of each, and saves as data/puzzles.json.
 *
 * Lichess CSV columns:
 * PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Usage: npx tsx scripts/fetch-puzzles.ts
 */

import { writeFileSync } from 'fs';
import path from 'path';
import { decompress } from 'fzstd';

const PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const OUTPUT = path.join(import.meta.dirname, '..', 'data', 'puzzles.json');
const TARGET_THEMES = ['mateIn1', 'mateIn2', 'mateIn3'] as const;
const PER_THEME = 500;

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

function parseLine(line: string): Puzzle | null {
  const parts = line.split(',');
  if (parts.length < 8) return null;

  const id = parts[0];
  const fen = parts[1];
  const moves = parts[2].split(' ');
  const rating = parseInt(parts[3], 10);
  const themes = parts[7].split(' ');

  if (!id || !fen || isNaN(rating)) return null;

  return { id, fen, moves, rating, themes };
}

const NEWLINE = 10; // '\n'

/**
 * Iterate lines from a Uint8Array without converting the entire buffer to a string.
 */
function* iterLines(data: Uint8Array): Generator<string> {
  const decoder = new TextDecoder();
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === NEWLINE) {
      if (i > start) {
        yield decoder.decode(data.subarray(start, i));
      }
      start = i + 1;
    }
  }
  if (start < data.length) {
    yield decoder.decode(data.subarray(start));
  }
}

async function main() {
  console.log('Downloading Lichess puzzle database...');
  console.log('(This is ~300MB compressed, may take a few minutes)');

  const response = await fetch(PUZZLE_URL);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  console.log('Downloading and buffering compressed data...');
  const compressed = new Uint8Array(await response.arrayBuffer());

  console.log(`Downloaded ${(compressed.length / 1024 / 1024).toFixed(1)}MB compressed. Decompressing...`);
  const decompressed = decompress(compressed);
  console.log(`Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(1)}MB. Filtering puzzles...`);

  const counts: Record<string, number> = {
    mateIn1: 0,
    mateIn2: 0,
    mateIn3: 0,
  };
  const puzzles: Puzzle[] = [];
  let lineNum = 0;

  for (const line of iterLines(decompressed)) {
    lineNum++;
    if (lineNum === 1) continue; // skip header

    const allFull = TARGET_THEMES.every((t) => counts[t] >= PER_THEME);
    if (allFull) break;

    const puzzle = parseLine(line);
    if (!puzzle) continue;

    for (const theme of TARGET_THEMES) {
      if (puzzle.themes.includes(theme) && counts[theme] < PER_THEME) {
        counts[theme]++;
        puzzles.push(puzzle);
        break;
      }
    }

    if (lineNum % 500000 === 0) {
      console.log(
        `  Processed ${lineNum.toLocaleString()} lines... ` +
        `mateIn1: ${counts.mateIn1}, mateIn2: ${counts.mateIn2}, mateIn3: ${counts.mateIn3}`
      );
    }
  }

  console.log(`\nCollected ${puzzles.length} puzzles:`);
  for (const theme of TARGET_THEMES) {
    console.log(`  ${theme}: ${counts[theme]}`);
  }

  writeFileSync(OUTPUT, JSON.stringify(puzzles, null, 2));
  console.log(`\nSaved to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
