import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import type { RGBA, PieceKey, SpriteMap } from './types.js';
import { PIECE_ORDER } from './types.js';

/**
 * Convert a sharp raw buffer into a 2D RGBA pixel array.
 */
function bufferToPixels(data: Buffer, width: number, height: number): RGBA[][] {
  const pixels: RGBA[][] = [];
  for (let y = 0; y < height; y++) {
    const row: RGBA[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
    }
    pixels.push(row);
  }
  return pixels;
}

/**
 * Resize a raw RGBA pixel grid using nearest-neighbor interpolation.
 * Used for the --size flag to downscale sprites before conversion.
 */
export async function resizePixels(
  pixels: RGBA[][],
  srcWidth: number,
  srcHeight: number,
  targetSize: number
): Promise<RGBA[][]> {
  // Build a raw RGBA buffer from the pixel grid
  const buf = Buffer.alloc(srcWidth * srcHeight * 4);
  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const i = (y * srcWidth + x) * 4;
      buf[i] = pixels[y][x][0];
      buf[i + 1] = pixels[y][x][1];
      buf[i + 2] = pixels[y][x][2];
      buf[i + 3] = pixels[y][x][3];
    }
  }

  const resized = await sharp(buf, {
    raw: { width: srcWidth, height: srcHeight, channels: 4 },
  })
    .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer();

  return bufferToPixels(resized, targetSize, targetSize);
}

/**
 * Auto-detect sprite sheet layout from image dimensions.
 * - If width/height ratio suggests 12 cols × 1 row (width = 12 * height), use 12×1
 * - Otherwise assume 6 cols × 2 rows
 */
function detectLayout(width: number, height: number): { cols: number; rows: number } {
  const ratio = width / height;
  // 12×1 layout: ratio ≈ 12 (e.g. 336×28 = 12.0)
  // 6×2 layout: ratio ≈ 3 (e.g. 96×32 = 3.0)
  if (ratio > 6) {
    return { cols: 12, rows: 1 };
  }
  return { cols: 6, rows: 2 };
}

/**
 * Load a sprite sheet PNG.
 * Auto-detects layout: 6 cols × 2 rows or 12 cols × 1 row.
 * Optionally accepts a custom piece order array (12 PieceKeys in sheet order).
 * Optionally resize each piece to targetSize × targetSize using nearest-neighbor.
 */
export async function loadSpriteSheet(
  filePath: string,
  targetSize?: number,
  sheetOrder?: PieceKey[]
): Promise<{ sprites: SpriteMap; cellWidth: number; cellHeight: number }> {
  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const layout = detectLayout(width, height);
  const cellWidth = Math.floor(width / layout.cols);
  const cellHeight = Math.floor(height / layout.rows);

  if (cellHeight % 2 !== 0) {
    throw new Error(
      `Sprite cell height must be even. Got ${cellHeight} (image ${width}×${height}, ` +
      `${layout.rows} rows → ${cellHeight}px per cell)`
    );
  }

  const order = sheetOrder ?? PIECE_ORDER;
  if (order.length !== 12) {
    throw new Error(`Sheet order must have exactly 12 entries, got ${order.length}`);
  }

  console.log(`Detected ${layout.cols}×${layout.rows} layout, ${cellWidth}×${cellHeight}px per piece`);

  const data = await image.raw().toBuffer();
  const fullPixels = bufferToPixels(data, width, height);

  const sprites: Partial<SpriteMap> = {};
  let pieceIndex = 0;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const key = order[pieceIndex++];
      const startY = row * cellHeight;
      const startX = col * cellWidth;

      let piecePixels: RGBA[][] = [];
      for (let y = 0; y < cellHeight; y++) {
        const pieceRow: RGBA[] = [];
        for (let x = 0; x < cellWidth; x++) {
          pieceRow.push(fullPixels[startY + y][startX + x]);
        }
        piecePixels.push(pieceRow);
      }

      if (targetSize && (targetSize !== cellWidth || targetSize !== cellHeight)) {
        piecePixels = await resizePixels(piecePixels, cellWidth, cellHeight, targetSize);
      }

      sprites[key] = piecePixels;
    }
  }

  const finalWidth = targetSize ?? cellWidth;
  const finalHeight = targetSize ?? cellHeight;

  return {
    sprites: sprites as SpriteMap,
    cellWidth: finalWidth,
    cellHeight: finalHeight,
  };
}

/**
 * Find a piece file in a directory, supporting multiple naming conventions:
 *   white_king.png, king-white-16x16.png, king_white.png, white-king.png, etc.
 */
function findPieceFile(dirPath: string, key: PieceKey): string {
  // Try exact match first
  const exact = path.join(dirPath, `${key}.png`);
  if (fs.existsSync(exact)) return exact;

  // Parse key into color + piece
  const [color, piece] = key.split('_') as [string, string];

  // Scan directory for a file containing both the color and piece name
  const files = fs.readdirSync(dirPath);
  const match = files.find((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith('.png') && lower.includes(color) && lower.includes(piece);
  });

  if (match) return path.join(dirPath, match);

  throw new Error(
    `Could not find PNG for "${key}" in ${dirPath}. ` +
    `Expected a file containing "${color}" and "${piece}" in the name.`
  );
}

/**
 * Load 12 individual piece PNGs from a directory.
 */
export async function loadDirectory(
  dirPath: string,
  targetSize?: number
): Promise<{ sprites: SpriteMap; cellWidth: number; cellHeight: number }> {
  const sprites: Partial<SpriteMap> = {};
  let cellWidth = 0;
  let cellHeight = 0;

  for (const key of PIECE_ORDER) {
    const filePath = findPieceFile(dirPath, key);
    const image = sharp(filePath).ensureAlpha();
    const metadata = await image.metadata();
    const w = metadata.width!;
    const h = metadata.height!;

    if (cellWidth === 0) {
      cellWidth = w;
      cellHeight = h;
    }

    if (h % 2 !== 0) {
      throw new Error(`Sprite height must be even. ${key}.png is ${w}×${h}`);
    }

    const data = await image.raw().toBuffer();
    let piecePixels = bufferToPixels(data, w, h);

    if (targetSize && (targetSize !== w || targetSize !== h)) {
      piecePixels = await resizePixels(piecePixels, w, h, targetSize);
    }

    sprites[key] = piecePixels;
  }

  const finalWidth = targetSize ?? cellWidth;
  const finalHeight = targetSize ?? cellHeight;

  return {
    sprites: sprites as SpriteMap,
    cellWidth: finalWidth,
    cellHeight: finalHeight,
  };
}
