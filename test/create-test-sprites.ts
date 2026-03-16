/**
 * Generate a test 12×12 chess sprite sheet (72×24 PNG, 6 cols × 2 rows).
 * Each piece is a simple recognizable shape drawn in pixel art.
 * White pieces are light gray with dark outline, black pieces are dark with lighter outline.
 */
import sharp from 'sharp';

const W = 12; // cell width
const H = 12; // cell height
const COLS = 6;
const ROWS = 2;

type Pixel = [number, number, number, number]; // RGBA

const TRANSPARENT: Pixel = [0, 0, 0, 0];

// Color palettes
const WHITE_FILL: Pixel = [240, 240, 240, 255];
const WHITE_OUTLINE: Pixel = [60, 60, 60, 255];
const WHITE_ACCENT: Pixel = [180, 180, 200, 255];
const BLACK_FILL: Pixel = [50, 50, 50, 255];
const BLACK_OUTLINE: Pixel = [30, 30, 30, 255];
const BLACK_ACCENT: Pixel = [100, 100, 120, 255];

function createGrid(): Pixel[][] {
  const grid: Pixel[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Pixel[] = [];
    for (let x = 0; x < W; x++) {
      row.push([...TRANSPARENT] as Pixel);
    }
    grid.push(row);
  }
  return grid;
}

function setPixel(grid: Pixel[][], x: number, y: number, color: Pixel) {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    grid[y][x] = color;
  }
}

function fillRect(grid: Pixel[][], x1: number, y1: number, x2: number, y2: number, color: Pixel) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(grid, x, y, color);
    }
  }
}

function outlineRect(grid: Pixel[][], x1: number, y1: number, x2: number, y2: number, color: Pixel) {
  for (let x = x1; x <= x2; x++) {
    setPixel(grid, x, y1, color);
    setPixel(grid, x, y2, color);
  }
  for (let y = y1; y <= y2; y++) {
    setPixel(grid, x1, y, color);
    setPixel(grid, x2, y, color);
  }
}

// --- Piece shapes (12×12 pixel art) ---

function drawKing(fill: Pixel, outline: Pixel, accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Cross on top
  setPixel(g, 5, 0, outline); setPixel(g, 6, 0, outline);
  setPixel(g, 4, 1, outline); setPixel(g, 5, 1, accent); setPixel(g, 6, 1, accent); setPixel(g, 7, 1, outline);
  setPixel(g, 5, 2, outline); setPixel(g, 6, 2, outline);
  // Head
  fillRect(g, 3, 3, 8, 5, fill); outlineRect(g, 3, 3, 8, 5, outline);
  // Neck
  fillRect(g, 4, 6, 7, 6, fill); setPixel(g, 4, 6, outline); setPixel(g, 7, 6, outline);
  // Body
  fillRect(g, 2, 7, 9, 9, fill); outlineRect(g, 2, 7, 9, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

function drawQueen(fill: Pixel, outline: Pixel, accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Crown points
  setPixel(g, 2, 0, accent); setPixel(g, 5, 0, accent); setPixel(g, 6, 0, accent); setPixel(g, 9, 0, accent);
  setPixel(g, 2, 1, outline); setPixel(g, 5, 1, outline); setPixel(g, 6, 1, outline); setPixel(g, 9, 1, outline);
  // Crown body
  fillRect(g, 2, 2, 9, 4, fill); outlineRect(g, 2, 2, 9, 4, outline);
  // Neck
  fillRect(g, 4, 5, 7, 5, fill); setPixel(g, 4, 5, outline); setPixel(g, 7, 5, outline);
  // Body
  fillRect(g, 3, 6, 8, 9, fill); outlineRect(g, 3, 6, 8, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

function drawRook(fill: Pixel, outline: Pixel, _accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Battlements
  fillRect(g, 2, 0, 3, 1, fill); outlineRect(g, 2, 0, 3, 1, outline);
  fillRect(g, 5, 0, 6, 1, fill); outlineRect(g, 5, 0, 6, 1, outline);
  fillRect(g, 8, 0, 9, 1, fill); outlineRect(g, 8, 0, 9, 1, outline);
  // Top wall
  fillRect(g, 2, 2, 9, 3, fill); outlineRect(g, 2, 2, 9, 3, outline);
  // Tower body
  fillRect(g, 3, 4, 8, 9, fill); outlineRect(g, 3, 4, 8, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

function drawBishop(fill: Pixel, outline: Pixel, accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Point
  setPixel(g, 5, 0, accent); setPixel(g, 6, 0, accent);
  // Top
  fillRect(g, 4, 1, 7, 2, fill); outlineRect(g, 4, 1, 7, 2, outline);
  // Diagonal slash
  setPixel(g, 6, 3, accent); setPixel(g, 5, 4, accent);
  // Head
  fillRect(g, 3, 3, 8, 6, fill); outlineRect(g, 3, 8, 8, 6, outline);
  outlineRect(g, 3, 3, 8, 6, outline);
  // Neck
  fillRect(g, 4, 7, 7, 7, fill); setPixel(g, 4, 7, outline); setPixel(g, 7, 7, outline);
  // Body
  fillRect(g, 3, 8, 8, 9, fill); outlineRect(g, 3, 8, 8, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

function drawKnight(fill: Pixel, outline: Pixel, accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Ear
  setPixel(g, 3, 0, outline); setPixel(g, 4, 0, outline);
  // Head top
  fillRect(g, 3, 1, 8, 2, fill); outlineRect(g, 3, 1, 8, 2, outline);
  // Eye
  setPixel(g, 7, 2, accent);
  // Snout
  fillRect(g, 2, 3, 5, 4, fill); outlineRect(g, 2, 3, 5, 4, outline);
  // Neck
  fillRect(g, 5, 3, 8, 6, fill); outlineRect(g, 5, 3, 8, 6, outline);
  // Nostril
  setPixel(g, 2, 4, accent);
  // Body
  fillRect(g, 3, 7, 9, 9, fill); outlineRect(g, 3, 7, 9, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

function drawPawn(fill: Pixel, outline: Pixel, _accent: Pixel): Pixel[][] {
  const g = createGrid();
  // Head
  fillRect(g, 4, 2, 7, 4, fill); outlineRect(g, 4, 2, 7, 4, outline);
  // Neck
  fillRect(g, 5, 5, 6, 5, fill); setPixel(g, 5, 5, outline); setPixel(g, 6, 5, outline);
  // Body
  fillRect(g, 3, 6, 8, 9, fill); outlineRect(g, 3, 6, 8, 9, outline);
  // Base
  fillRect(g, 1, 10, 10, 11, fill); outlineRect(g, 1, 10, 10, 11, outline);
  return g;
}

async function main() {
  const drawFns = [drawKing, drawQueen, drawRook, drawBishop, drawKnight, drawPawn];

  // Build full sprite sheet
  const imgWidth = COLS * W;  // 72
  const imgHeight = ROWS * H; // 24
  const buf = Buffer.alloc(imgWidth * imgHeight * 4, 0); // all transparent

  for (let row = 0; row < 2; row++) {
    const isWhite = row === 0;
    const fill = isWhite ? WHITE_FILL : BLACK_FILL;
    const outline = isWhite ? WHITE_OUTLINE : BLACK_OUTLINE;
    const accent = isWhite ? WHITE_ACCENT : BLACK_ACCENT;

    for (let col = 0; col < 6; col++) {
      const piece = drawFns[col](fill, outline, accent);
      const startX = col * W;
      const startY = row * H;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = piece[y][x];
          const i = ((startY + y) * imgWidth + (startX + x)) * 4;
          buf[i] = px[0];
          buf[i + 1] = px[1];
          buf[i + 2] = px[2];
          buf[i + 3] = px[3];
        }
      }
    }
  }

  await sharp(buf, { raw: { width: imgWidth, height: imgHeight, channels: 4 } })
    .png()
    .toFile('test/fixtures/test_sprites_12x12.png');

  console.log(`Created test/fixtures/test_sprites_12x12.png (${imgWidth}×${imgHeight})`);
}

main().catch(console.error);
