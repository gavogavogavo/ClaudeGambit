import type { RGBA, RGB, Cell, PieceData } from './types.js';

const ALPHA_THRESHOLD = 128;

function isTransparent(pixel: RGBA): boolean {
  return pixel[3] < ALPHA_THRESHOLD;
}

function toRGB(pixel: RGBA): RGB {
  return [pixel[0], pixel[1], pixel[2]];
}

/**
 * Convert a 2D RGBA pixel grid into half-block Cell data.
 * Pairs rows vertically: top pixel → bg, bottom pixel → fg, char = ▄.
 * Throws if height is odd.
 */
export function convertSprite(pixels: RGBA[][]): PieceData {
  const height = pixels.length;
  if (height === 0) return [];
  const width = pixels[0].length;
  if (height % 2 !== 0) {
    throw new Error(`Sprite height must be even, got ${height}`);
  }

  const rows: Cell[][] = [];

  for (let y = 0; y < height; y += 2) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      const topPixel = pixels[y][x];
      const bottomPixel = pixels[y + 1][x];
      const topTransparent = isTransparent(topPixel);
      const bottomTransparent = isTransparent(bottomPixel);

      row.push({
        bg: topTransparent ? null : toRGB(topPixel),
        fg: bottomTransparent ? null : toRGB(bottomPixel),
        char: '▄',
        t_top: topTransparent,
        t_bottom: bottomTransparent,
      });
    }
    rows.push(row);
  }

  return rows;
}

const DARK_OUTLINE: RGBA = [40, 40, 40, 255];
const LIGHT_OUTLINE: RGBA = [220, 220, 220, 255];

/**
 * Add a 1px outline around opaque pixels in a sprite.
 * Any transparent pixel that is 4-directionally adjacent to an opaque pixel
 * gets filled with the outline color.
 */
export function addOutline(pixels: RGBA[][], light = false): RGBA[][] {
  const outlineColor = light ? LIGHT_OUTLINE : DARK_OUTLINE;
  const height = pixels.length;
  if (height === 0) return pixels;
  const width = pixels[0].length;

  // Deep copy
  const result: RGBA[][] = pixels.map((row) => row.map((p) => [...p] as RGBA));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isTransparent(pixels[y][x])) continue;

      // Check 4 neighbors for any opaque pixel
      const hasOpaqueNeighbor =
        (y > 0 && !isTransparent(pixels[y - 1][x])) ||
        (y < height - 1 && !isTransparent(pixels[y + 1][x])) ||
        (x > 0 && !isTransparent(pixels[y][x - 1])) ||
        (x < width - 1 && !isTransparent(pixels[y][x + 1]));

      if (hasOpaqueNeighbor) {
        result[y][x] = outlineColor;
      }
    }
  }

  return result;
}

/**
 * Apply scale factor: each source pixel becomes scale×scale terminal pixels.
 * Scaling happens on the RGBA grid before conversion.
 */
export function scalePixels(pixels: RGBA[][], scale: number): RGBA[][] {
  if (scale === 1) return pixels;
  const height = pixels.length;
  const width = pixels[0].length;
  const scaled: RGBA[][] = [];

  for (let y = 0; y < height; y++) {
    const row: RGBA[] = [];
    for (let x = 0; x < width; x++) {
      for (let sx = 0; sx < scale; sx++) {
        row.push([...pixels[y][x]] as RGBA);
      }
    }
    for (let sy = 0; sy < scale; sy++) {
      scaled.push([...row]);
    }
  }

  return scaled;
}
