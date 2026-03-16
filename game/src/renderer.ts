import type { RGB, Cell, PieceData, PieceKey, OutputJSON } from './types.js';
import { PIECE_ORDER } from './types.js';

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

function fg24(r: number, g: number, b: number): string {
  return `${ESC}[38;2;${r};${g};${b}m`;
}

function bg24(r: number, g: number, b: number): string {
  return `${ESC}[48;2;${r};${g};${b}m`;
}

/**
 * Render a single piece's Cell[][] into ANSI strings, substituting
 * the board square color for transparent pixels.
 */
export function renderPieceAnsi(piece: PieceData, boardColor: RGB): string[] {
  const lines: string[] = [];

  for (const row of piece) {
    let line = '';
    for (const cell of row) {
      const bgColor: RGB = cell.t_top ? boardColor : cell.bg!;
      const fgColor: RGB = cell.t_bottom ? boardColor : cell.fg!;

      line += bg24(bgColor[0], bgColor[1], bgColor[2]);
      line += fg24(fgColor[0], fgColor[1], fgColor[2]);
      line += cell.char;
    }
    line += RESET;
    lines.push(line);
  }

  return lines;
}

/**
 * Render a piece label (e.g. "white_king") centered to a given width.
 */
function centerLabel(label: string, width: number): string {
  const pad = Math.max(0, width - label.length);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + label + ' '.repeat(pad - left);
}

/**
 * Print all 12 pieces to the terminal in a 6×2 grid with labels.
 */
export function renderPreview(
  pieces: Record<PieceKey, PieceData>,
  boardColor: RGB,
  cellWidth: number
): void {
  const gap = 2; // chars between pieces

  // Render in two rows: white pieces, then black pieces
  for (let rowGroup = 0; rowGroup < 2; rowGroup++) {
    const pieceKeys = PIECE_ORDER.slice(rowGroup * 6, (rowGroup + 1) * 6);
    const rendered = pieceKeys.map((key) => renderPieceAnsi(pieces[key], boardColor));

    // Print labels
    const labels = pieceKeys.map((k) => {
      const name = k.replace('white_', 'W ').replace('black_', 'B ');
      return centerLabel(name, cellWidth);
    });
    console.log(labels.join(' '.repeat(gap)));

    // Print piece rows side by side
    const numRows = rendered[0].length;
    for (let r = 0; r < numRows; r++) {
      const line = rendered.map((p) => p[r]).join(' '.repeat(gap));
      console.log(line);
    }
    console.log(); // blank line between rows
  }
}

/**
 * Render all pieces on a given background into a single ANSI string for .ans file output.
 */
export function renderAllAnsi(
  pieces: Record<PieceKey, PieceData>,
  boardColor: RGB,
  cellWidth: number
): string {
  const lines: string[] = [];
  const gap = 2;

  for (let rowGroup = 0; rowGroup < 2; rowGroup++) {
    const pieceKeys = PIECE_ORDER.slice(rowGroup * 6, (rowGroup + 1) * 6);
    const rendered = pieceKeys.map((key) => renderPieceAnsi(pieces[key], boardColor));

    const labels = pieceKeys.map((k) => {
      const name = k.replace('white_', 'W ').replace('black_', 'B ');
      return centerLabel(name, cellWidth);
    });
    lines.push(labels.join(' '.repeat(gap)));

    const numRows = rendered[0].length;
    for (let r = 0; r < numRows; r++) {
      lines.push(rendered.map((p) => p[r]).join(' '.repeat(gap)));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate the JSON output structure.
 */
export function generateJSON(
  pieces: Record<PieceKey, PieceData>,
  meta: {
    spriteWidth: number;
    spriteHeight: number;
    source: string;
  }
): OutputJSON {
  return {
    meta: {
      sprite_width: meta.spriteWidth,
      sprite_height: meta.spriteHeight,
      terminal_width: meta.spriteWidth,
      terminal_height: meta.spriteHeight / 2,
      generated_at: new Date().toISOString(),
      source: meta.source,
    },
    pieces,
  };
}
