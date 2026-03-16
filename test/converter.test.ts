import { describe, it, expect } from 'vitest';
import { convertSprite, scalePixels } from '../src/converter.js';
import type { RGBA } from '../src/types.js';

function makePixel(r: number, g: number, b: number, a = 255): RGBA {
  return [r, g, b, a];
}

describe('convertSprite', () => {
  it('converts two opaque rows into one cell row', () => {
    const pixels: RGBA[][] = [
      [makePixel(255, 0, 0)],    // top pixel: red
      [makePixel(0, 0, 255)],    // bottom pixel: blue
    ];
    const result = convertSprite(pixels);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);

    const cell = result[0][0];
    expect(cell.bg).toEqual([255, 0, 0]);  // top → bg
    expect(cell.fg).toEqual([0, 0, 255]);  // bottom → fg
    expect(cell.char).toBe('▄');
    expect(cell.t_top).toBe(false);
    expect(cell.t_bottom).toBe(false);
  });

  it('marks top pixel as transparent when alpha < 128', () => {
    const pixels: RGBA[][] = [
      [makePixel(255, 0, 0, 0)],     // transparent
      [makePixel(0, 255, 0, 255)],   // opaque green
    ];
    const result = convertSprite(pixels);
    const cell = result[0][0];
    expect(cell.t_top).toBe(true);
    expect(cell.bg).toBeNull();
    expect(cell.t_bottom).toBe(false);
    expect(cell.fg).toEqual([0, 255, 0]);
  });

  it('marks bottom pixel as transparent', () => {
    const pixels: RGBA[][] = [
      [makePixel(0, 255, 0, 200)],  // opaque
      [makePixel(0, 0, 0, 50)],     // transparent
    ];
    const result = convertSprite(pixels);
    const cell = result[0][0];
    expect(cell.t_top).toBe(false);
    expect(cell.t_bottom).toBe(true);
    expect(cell.fg).toBeNull();
  });

  it('marks both pixels as transparent', () => {
    const pixels: RGBA[][] = [
      [makePixel(0, 0, 0, 0)],
      [makePixel(0, 0, 0, 0)],
    ];
    const result = convertSprite(pixels);
    const cell = result[0][0];
    expect(cell.t_top).toBe(true);
    expect(cell.t_bottom).toBe(true);
    expect(cell.bg).toBeNull();
    expect(cell.fg).toBeNull();
  });

  it('converts a 4x4 sprite into 2 rows of 4 cells', () => {
    const red = makePixel(255, 0, 0);
    const blue = makePixel(0, 0, 255);
    const pixels: RGBA[][] = [
      [red, red, red, red],
      [blue, blue, blue, blue],
      [red, red, red, red],
      [blue, blue, blue, blue],
    ];
    const result = convertSprite(pixels);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(4);
    expect(result[1]).toHaveLength(4);
  });

  it('throws on odd-height sprite', () => {
    const pixels: RGBA[][] = [
      [makePixel(255, 0, 0)],
      [makePixel(0, 0, 255)],
      [makePixel(0, 255, 0)],
    ];
    expect(() => convertSprite(pixels)).toThrow('Sprite height must be even');
  });

  it('treats alpha=127 as transparent and alpha=128 as opaque', () => {
    const pixels: RGBA[][] = [
      [makePixel(100, 100, 100, 127)],  // transparent (< 128)
      [makePixel(200, 200, 200, 128)],  // opaque (>= 128)
    ];
    const result = convertSprite(pixels);
    const cell = result[0][0];
    expect(cell.t_top).toBe(true);
    expect(cell.t_bottom).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(convertSprite([])).toEqual([]);
  });
});

describe('scalePixels', () => {
  it('returns original at scale 1', () => {
    const pixels: RGBA[][] = [[makePixel(255, 0, 0)]];
    expect(scalePixels(pixels, 1)).toEqual(pixels);
  });

  it('doubles a 2x2 grid at scale 2', () => {
    const r = makePixel(255, 0, 0);
    const g = makePixel(0, 255, 0);
    const b = makePixel(0, 0, 255);
    const w = makePixel(255, 255, 255);
    const pixels: RGBA[][] = [
      [r, g],
      [b, w],
    ];
    const scaled = scalePixels(pixels, 2);
    expect(scaled).toHaveLength(4);
    expect(scaled[0]).toHaveLength(4);
    // Top-left 2x2 block should all be red
    expect(scaled[0][0]).toEqual(r);
    expect(scaled[0][1]).toEqual(r);
    expect(scaled[1][0]).toEqual(r);
    expect(scaled[1][1]).toEqual(r);
    // Top-right 2x2 block should all be green
    expect(scaled[0][2]).toEqual(g);
    expect(scaled[0][3]).toEqual(g);
  });
});
