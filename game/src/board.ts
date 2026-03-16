import type { RGB, PieceKey, PieceData, RGBA } from './types.js';
import { convertSprite, addOutline } from './converter.js';
import { resizePixels } from './decoder.js';
import { PIECE_ORDER } from './types.js';
import { LIGHT_SQUARE, DARK_SQUARE, CAPTURE_CORNER } from './colors.js';

export { LIGHT_SQUARE, DARK_SQUARE } from './colors.js';

const FEN_TO_PIECE: Record<string, PieceKey> = {
  'K': 'white_king', 'Q': 'white_queen', 'R': 'white_rook',
  'B': 'white_bishop', 'N': 'white_knight', 'P': 'white_pawn',
  'k': 'black_king', 'q': 'black_queen', 'r': 'black_rook',
  'b': 'black_bishop', 'n': 'black_knight', 'p': 'black_pawn',
};

export type Board = (PieceKey | null)[][];

export interface SquareHighlight {
  rank: number; // 0=rank8 (top) to 7=rank1 (bottom)
  file: number; // 0=a to 7=h
  color: RGB;
}

export interface SquareOverlay {
  rank: number;
  file: number;
  type: 'dot' | 'capture';
}

export interface SpriteCache {
  pieces: Map<PieceKey, PieceData>;
  renderSize: number;
}

export function parseFEN(fen: string): Board {
  const placement = fen.split(' ')[0];
  const ranks = placement.split('/');
  const board: Board = [];

  for (const rank of ranks) {
    const row: (PieceKey | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) row.push(null);
      } else {
        row.push(FEN_TO_PIECE[ch] ?? null);
      }
    }
    board.push(row);
  }

  return board;
}

function getSquareColor(rank: number, file: number): RGB {
  return (rank + file) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE;
}

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

function bg24(c: RGB): string {
  return `${ESC}[48;2;${c[0]};${c[1]};${c[2]}m`;
}

function fg24(c: RGB): string {
  return `${ESC}[38;2;${c[0]};${c[1]};${c[2]}m`;
}

function darken(c: RGB, factor: number): RGB {
  return [
    Math.round(c[0] * factor),
    Math.round(c[1] * factor),
    Math.round(c[2] * factor),
  ];
}


/**
 * Auto-compute render size to fit board within ~80 chars.
 */
export function autoRenderSize(nativeSize: number): number {
  const targetBoardWidth = 76;
  const maxSquareWidth = Math.floor(targetBoardWidth / 8);
  let size = Math.min(nativeSize, maxSquareWidth);
  if (size % 2 !== 0) size--;
  return Math.max(4, size);
}

/**
 * Pre-resize and convert all 12 sprites into a cache for fast synchronous rendering.
 */
export async function prepareSprites(
  sprites: Record<PieceKey, RGBA[][]>,
  nativeSize: number,
  renderSize?: number,
  outline = false
): Promise<SpriteCache> {
  const size = renderSize ?? autoRenderSize(nativeSize);
  const needsResize = size !== nativeSize;
  const pieces = new Map<PieceKey, PieceData>();

  for (const key of PIECE_ORDER) {
    let pixels = sprites[key];
    if (needsResize) {
      pixels = await resizePixels(pixels, nativeSize, nativeSize, size);
    }
    if (outline) {
      pixels = addOutline(pixels);
    }
    pieces.set(key, convertSprite(pixels));
  }

  return { pieces, renderSize: size };
}

/**
 * Render a board to an array of terminal lines.
 * Synchronous — uses pre-cached sprites.
 */
export function renderBoardLines(
  board: Board,
  cache: SpriteCache,
  highlights: SquareHighlight[] = [],
  overlays: SquareOverlay[] = [],
  flipped = false
): string[] {
  const squareWidth = cache.renderSize;
  const squareHeight = cache.renderSize / 2;
  const labelWidth = 3;

  // Build highlight lookup
  const highlightMap = new Map<string, RGB>();
  for (const h of highlights) {
    highlightMap.set(`${h.rank},${h.file}`, h.color);
  }

  // Build overlay lookup
  const overlayMap = new Map<string, 'dot' | 'capture'>();
  for (const o of overlays) {
    overlayMap.set(`${o.rank},${o.file}`, o.type);
  }

  // Dot geometry: 2×2 pixel dot centered in the square
  const dotX1 = Math.floor(squareWidth / 2) - 1;
  const dotX2 = Math.floor(squareWidth / 2);
  const dotPixelY1 = Math.floor(cache.renderSize / 2) - 1; // always odd for even renderSize
  const dotPixelY2 = Math.floor(cache.renderSize / 2);       // always even
  const dotTermRow1 = Math.floor(dotPixelY1 / 2); // dot is bottom pixel of this row
  const dotTermRow2 = Math.floor(dotPixelY2 / 2); // dot is top pixel of this row

  // Capture corner geometry: triangles in each corner (3 pixels per corner)
  const capW = squareWidth - 1;
  const capH = cache.renderSize - 1;

  const lines: string[] = [];

  for (let ri = 0; ri < 8; ri++) {
    const rank = flipped ? 7 - ri : ri;
    for (let termRow = 0; termRow < squareHeight; termRow++) {
      let line = '';

      if (termRow === Math.floor(squareHeight / 2)) {
        line += `${8 - rank}  `;
      } else {
        line += ' '.repeat(labelWidth);
      }

      for (let fi = 0; fi < 8; fi++) {
        const file = flipped ? 7 - fi : fi;
        const highlight = highlightMap.get(`${rank},${file}`);
        const sqColor = highlight ?? getSquareColor(rank, file);
        const piece = board[rank][file];
        const overlay = overlayMap.get(`${rank},${file}`);

        if (piece && cache.pieces.has(piece)) {
          const pieceData = cache.pieces.get(piece)!;
          const pieceRow = pieceData[termRow];

          for (let x = 0; x < pieceRow.length; x++) {
            const cell = pieceRow[x];
            let topColor: RGB = cell.t_top ? sqColor : cell.bg!;
            let botColor: RGB = cell.t_bottom ? sqColor : cell.fg!;

            // Capture corner markers: override transparent corner pixels
            if (overlay === 'capture') {
              const pixelY_top = termRow * 2;
              const pixelY_bot = termRow * 2 + 1;
              if (isCornerPixel(x, pixelY_top, squareWidth, cache.renderSize) && cell.t_top) {
                topColor = CAPTURE_CORNER;
              }
              if (isCornerPixel(x, pixelY_bot, squareWidth, cache.renderSize) && cell.t_bottom) {
                botColor = CAPTURE_CORNER;
              }
            }

            line += `${ESC}[48;2;${topColor[0]};${topColor[1]};${topColor[2]}m`;
            line += `${ESC}[38;2;${botColor[0]};${botColor[1]};${botColor[2]}m`;
            line += cell.char;
          }
        } else if (overlay === 'dot') {
          // Empty square with move dot
          const dotColor = darken(sqColor, 0.55);
          for (let x = 0; x < squareWidth; x++) {
            const isDotX = x >= dotX1 && x <= dotX2;
            if (isDotX && termRow === dotTermRow1) {
              // Bottom pixel is dot
              line += bg24(sqColor) + fg24(dotColor) + '▄';
            } else if (isDotX && termRow === dotTermRow2) {
              // Top pixel is dot
              line += bg24(dotColor) + fg24(sqColor) + '▄';
            } else {
              line += bg24(sqColor) + ' ';
            }
          }
        } else {
          // Plain empty square
          line += bg24(sqColor) + ' '.repeat(squareWidth);
        }
      }

      line += RESET;
      lines.push(line);
    }
  }

  // File labels
  let fileLabel = ' '.repeat(labelWidth);
  for (let fi = 0; fi < 8; fi++) {
    const file = flipped ? 7 - fi : fi;
    const letter = String.fromCharCode(97 + file);
    const pad = Math.floor(squareWidth / 2);
    fileLabel += ' '.repeat(pad) + letter + ' '.repeat(squareWidth - pad - 1);
  }
  lines.push(fileLabel);

  return lines;
}

/**
 * Check if a pixel is in one of the 4 corner triangles of a square.
 * Each triangle is 3 pixels: the corner pixel + 2 adjacent.
 */
function isCornerPixel(x: number, y: number, w: number, h: number): boolean {
  // Top-left
  if ((x === 0 && y <= 1) || (x === 1 && y === 0)) return true;
  // Top-right
  if ((x === w - 1 && y <= 1) || (x === w - 2 && y === 0)) return true;
  // Bottom-left
  if ((x === 0 && y >= h - 2) || (x === 1 && y === h - 1)) return true;
  // Bottom-right
  if ((x === w - 1 && y >= h - 2) || (x === w - 2 && y === h - 1)) return true;
  return false;
}

// --- Legacy async API (used by --fen mode) ---

interface RenderOptions {
  renderSize?: number;
}

export async function renderBoard(
  fen: string,
  sprites: Record<PieceKey, RGBA[][]>,
  nativeSize: number,
  options: RenderOptions = {}
): Promise<string[]> {
  const cache = await prepareSprites(sprites, nativeSize, options.renderSize);
  const board = parseFEN(fen);
  return renderBoardLines(board, cache);
}

export async function printBoard(
  fen: string,
  sprites: Record<PieceKey, RGBA[][]>,
  nativeSize: number,
  options: RenderOptions = {}
): Promise<void> {
  const lines = await renderBoard(fen, sprites, nativeSize, options);
  for (const line of lines) {
    console.log(line);
  }
}
