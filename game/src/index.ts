#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import path from 'path';
import type { RGB, PieceKey, PieceData, RGBA } from './types.js';
import { convertSprite, scalePixels } from './converter.js';
import { loadSpriteSheet, loadDirectory } from './decoder.js';
import { renderPreview, renderAllAnsi, generateJSON } from './renderer.js';
import { printBoard } from './board.js';
import { runPuzzleLoop } from './puzzle.js';
import { PIECE_ORDER } from './types.js';

function parseRGB(value: string): RGB {
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid RGB color: "${value}". Expected format: R,G,B (0-255)`);
  }
  return parts as unknown as RGB;
}

const program = new Command();

program
  .name('chess-sprite-converter')
  .description('Convert pixel art chess piece PNGs into ANSI terminal art')
  .option('--sheet <path>', 'Sprite sheet PNG (2 rows x 6 cols)')
  .option('--dir <path>', 'Directory of 12 individual PNGs', path.join(import.meta.dirname, '..', 'assets'))
  .option('--json <path>', 'Output JSON lookup table')
  .option('--ansi <path>', 'Output raw ANSI file for visual testing')
  .option('--preview', 'Print all pieces directly to terminal')
  .option('--fen <string>', 'Render a board position from FEN string')
  .option('--puzzle', 'Start interactive puzzle mode')
  .option('--bg <R,G,B>', 'Background color for ANSI/preview mode', '181,136,99')
  .option('--size <n>', 'Target sprite size (nearest-neighbor downscale)', parseInt)
  .option('--render-size <n>', 'Sprite size for board rendering (default: auto-fit 80 cols)', parseInt)
  .option('--scale <n>', 'Scale factor (1 or 2)', parseInt, 1)
  .option('--sheet-order <pieces>', 'Piece order in sprite sheet (comma-separated, e.g. white_pawn,white_bishop,...)')
  .option('--outline', 'Enable piece outlines')
  .option('--signal-file <path>', 'Signal file for pause/resume (plugin mode)')
  .option('--pid-file <path>', 'PID file path (plugin mode)')
  .action(async (opts) => {
    // Validate input (--dir defaults to sprites3, so only error if --sheet is also absent and dir is missing)
    if (!opts.json && !opts.ansi && !opts.preview && !opts.fen && !opts.puzzle) {
      program.error('At least one output required: --json, --ansi, --preview, --fen, or --puzzle');
    }

    const bgColor = parseRGB(opts.bg);
    const targetSize = opts.size as number | undefined;
    const scale = opts.scale as number;

    // Load sprites
    let sprites: Record<string, import('./types.js').RGBA[][]>;
    let cellWidth: number;
    let cellHeight: number;
    let sourceName: string;

    // Parse custom sheet order if provided (strip all whitespace to handle line breaks)
    const sheetOrder = opts.sheetOrder
      ? (opts.sheetOrder as string).replace(/\s+/g, '').split(',') as PieceKey[]
      : undefined;

    if (opts.sheet) {
      sourceName = path.basename(opts.sheet);
      const result = await loadSpriteSheet(opts.sheet, targetSize, sheetOrder);
      sprites = result.sprites;
      cellWidth = result.cellWidth;
      cellHeight = result.cellHeight;
    } else {
      sourceName = path.basename(opts.dir);
      const result = await loadDirectory(opts.dir!, targetSize);
      sprites = result.sprites;
      cellWidth = result.cellWidth;
      cellHeight = result.cellHeight;
    }

    // Apply scale factor
    if (scale > 1) {
      for (const key of PIECE_ORDER) {
        sprites[key] = scalePixels(sprites[key], scale);
      }
      cellWidth *= scale;
      cellHeight *= scale;
    }

    // Convert all pieces
    const convertedPieces: Record<string, PieceData> = {};
    for (const key of PIECE_ORDER) {
      convertedPieces[key] = convertSprite(sprites[key]);
    }
    const pieces = convertedPieces as Record<PieceKey, PieceData>;

    // Output: JSON
    if (opts.json) {
      const json = generateJSON(pieces, {
        spriteWidth: cellWidth,
        spriteHeight: cellHeight,
        source: sourceName,
      });
      writeFileSync(opts.json, JSON.stringify(json, null, 2));
      console.log(`JSON written to ${opts.json}`);
    }

    // Output: ANSI file
    if (opts.ansi) {
      const ansiOutput = renderAllAnsi(pieces, bgColor, cellWidth);
      writeFileSync(opts.ansi, ansiOutput);
      console.log(`ANSI file written to ${opts.ansi}`);
    }

    // Output: Preview
    if (opts.preview) {
      renderPreview(pieces, bgColor, cellWidth);
    }

    // Output: Board from FEN
    if (opts.fen) {
      await printBoard(opts.fen, sprites as Record<PieceKey, RGBA[][]>, cellWidth, {
        renderSize: opts.renderSize as number | undefined,
      });
    }

    // Interactive puzzle mode
    if (opts.puzzle) {
      await runPuzzleLoop(
        sprites as Record<PieceKey, RGBA[][]>,
        cellWidth,
        opts.renderSize as number | undefined,
        opts.outline as boolean,
        opts.signalFile as string | undefined,
        opts.pidFile as string | undefined,
      );
    }
  });

program.parse();
