# Chess Piece Sprite Converter — SPEC

## Purpose

A CLI tool that converts pixel art chess piece PNGs into pre-baked ANSI terminal art strings using the Unicode half-block technique. The output must look **indistinguishable from a tiny pixel art image** in any modern terminal with truecolor support.

This is the critical visual foundation for a terminal chess puzzle game (a Claude Code plugin). If the output doesn't look great, the project doesn't proceed.

---

## The Half-Block Technique

Modern terminals display characters in a grid. Each cell is roughly twice as tall as it is wide. The trick: use `▄` (U+2584, lower half block) with independent foreground and background colors to encode **two vertical pixels per character cell**.

```
For a 2-pixel-tall column where:
  - top pixel is color A
  - bottom pixel is color B

Output: set BG=A, FG=B, print ▄

Result: the cell shows color A on top, color B on bottom.
```

This effectively doubles vertical resolution. An 8×8 pixel sprite becomes 8 chars wide × 4 rows tall. A 12×12 sprite becomes 12 chars wide × 6 rows tall.

### Color Encoding

Use **24-bit truecolor** ANSI escape sequences (supported by all modern terminals — iTerm2, Kitty, Alacritty, Windows Terminal, Ghostty, WezTerm):

```
ESC[38;2;R;G;Bm   → set foreground to RGB
ESC[48;2;R;G;Bm   → set background to RGB
ESC[0m             → reset all attributes
```

### Transparency Handling

Chess pieces must render on both light and dark board squares. Transparent pixels in the source PNG must be replaced at render time with the square's background color. This means the converter outputs a **template** rather than a final string — transparent pixel positions are marked so the renderer can substitute the correct board square color.

---

## Input

### Sprite Sheet Format

A single PNG file containing all 12 chess pieces arranged in a grid:

```
Row 0: ♔ ♕ ♖ ♗ ♘ ♙  (white pieces)
Row 1: ♚ ♛ ♜ ♝ ♞ ♟  (black pieces)
```

Each piece occupies one cell in the grid. The converter auto-detects cell size from the image dimensions:

- 96×16 PNG → 6 pieces × 2 rows → 16×16 per cell (16px wide, but will be treated as `widthxheight`)

Actually, let's keep it simpler. Support two input modes:

**Mode A — Sprite sheet:** A single PNG with a known layout (2 rows × 6 columns). Cell size is derived: `cell_width = img_width / 6`, `cell_height = img_height / 2`.

**Mode B — Individual files:** 12 separate PNGs named with a convention:
```
white_king.png, white_queen.png, white_rook.png,
white_bishop.png, white_knight.png, white_pawn.png,
black_king.png, black_queen.png, black_rook.png,
black_bishop.png, black_knight.png, black_pawn.png
```

### Supported Sprite Sizes

The tool should accept **any even-height** sprite (since half-block pairs two rows). Recommended sizes:

| Sprite Size | Terminal Footprint | Notes |
|-------------|-------------------|-------|
| 8×8         | 8 chars × 4 rows  | Minimal, retro. Board = 64×32 chars. |
| 10×10       | 10 chars × 5 rows | Slightly more detail. |
| 12×12       | 12 chars × 6 rows | Good balance. Board = 96×48 chars. |
| 16×16       | 16 chars × 8 rows | High detail. Board = 128×64 chars — may be too big. |

The converter **rejects odd-height sprites** with a clear error message. Odd-width is fine.

---

## Output

### Output Format: JSON Lookup Table

The converter outputs a single JSON file containing pre-rendered data for all 12 pieces:

```json
{
  "meta": {
    "sprite_width": 12,
    "sprite_height": 12,
    "terminal_width": 12,
    "terminal_height": 6,
    "generated_at": "2026-03-16T12:00:00Z",
    "source": "chess_sprites_12x12.png"
  },
  "pieces": {
    "white_king": {
      "rows": [
        [
          { "fg": [255, 255, 255], "bg": [200, 200, 200], "char": "▄" },
          { "fg": null, "bg": null, "char": " ", "transparent": true },
          ...
        ],
        ...
      ]
    },
    "white_queen": { ... },
    ...
  }
}
```

Each piece is an array of rows, each row is an array of cells. Each cell contains:

- `fg`: `[R, G, B]` or `null` if both pixels in this column are transparent
- `bg`: `[R, G, B]` or `null`
- `char`: `"▄"`, `"▀"`, `"█"`, or `" "`
- `transparent`: `true` if this cell should use the board square's background color (for either/both of its two pixels)

### Transparency Detail

For each character cell (representing a top pixel and bottom pixel), there are four cases:

| Top Pixel | Bottom Pixel | Rendering |
|-----------|-------------|-----------|
| Opaque A  | Opaque B    | BG=A, FG=B, char=`▄` |
| Opaque A  | Transparent | BG=A, FG=**board**, char=`▄` |
| Transparent | Opaque B  | BG=**board**, FG=B, char=`▄` |
| Transparent | Transparent | BG=**board**, FG=**board**, char=`▄` (or just space) |

The JSON must encode which pixels are transparent so the runtime renderer can inject the board square color. Use a `transparency_mask` per cell:

```json
{
  "fg": [0, 0, 0],
  "bg": [255, 255, 255],
  "char": "▄",
  "t_top": false,
  "t_bottom": false
}
```

Where `t_top` = true means the top pixel (encoded in `bg`) is transparent, and `t_bottom` = true means the bottom pixel (encoded in `fg`) is transparent. The renderer replaces the relevant color with the board square color at runtime.

### Alternative Output: Raw ANSI (for testing)

For quick visual verification, the converter can also output a raw `.ans` file — a plain text file containing the ANSI escape sequences that can be `cat`'d directly into a terminal:

```bash
converter --input sprites.png --output-ansi test_output.ans --bg-color "181,136,99"
cat test_output.ans
```

This renders all 12 pieces on a specified background color for eyeball verification.

---

## Board Renderer (Separate Module)

Not in scope for the converter itself, but the converter's output is designed to feed this. Documenting here for context on how the pieces will be used.

### Board Layout

Each square = piece terminal footprint + 1 char padding on each side.

For a 12×12 sprite (12 chars wide × 6 rows tall), each square is 14 chars wide × 8 rows tall (1 char/row padding). Full board = 112 chars × 64 rows. This is large — consider making padding optional or 0.

For an 8×8 sprite, each square is 8 chars wide × 4 rows tall (no padding needed at this size). Full board = 64 chars × 32 rows. This fits comfortably in most terminals.

### Board Square Colors

Classic chess board palette (customizable):

```
Light square: RGB(240, 217, 181)  — warm cream
Dark square:  RGB(181, 136, 99)   — warm brown
```

The renderer reads the JSON, and for each occupied square, iterates through the piece's rows/cells, substituting transparent pixels with the appropriate square color, then outputs the ANSI string.

### File and Rank Labels

Rendered outside the board grid using standard terminal text:

```
  a  b  c  d  e  f  g  h
  ┌──┬──┬──┬──┬──┬──┬──┬──┐
8 │  │  │  │  │  │  │  │  │
  ├──┼──┼──┼──┼──┼──┼──┼──┤
7 │  │  │  │  │  │  │  │  │
  ...
```

Actually — with the half-block rendering, traditional box-drawing borders would clash. Better to let the alternating square colors define the grid implicitly (like a real chess board), with rank numbers and file letters in plain text along the edges.

---

## CLI Interface

```
chess-sprite-converter [options]

Input (one required):
  --sheet <path>         Sprite sheet PNG (2 rows × 6 cols)
  --dir <path>           Directory of 12 individual PNGs

Output (at least one required):
  --json <path>          Output JSON lookup table
  --ansi <path>          Output raw ANSI file for visual testing
  --preview              Print all pieces directly to terminal

Options:
  --bg <R,G,B>           Background color for ANSI/preview mode
                         (default: 181,136,99 — dark square brown)
  --scale <1|2>          Scale factor (2 = each source pixel becomes
                         2×2 terminal pixels). Default: 1
  --outline <R,G,B>      Optional: add 1px outline around pieces
                         for better contrast on the board
```

### Scale Factor

At `--scale 2`, each source pixel maps to a 2×2 block of terminal pixels. An 8×8 sprite becomes 16 chars × 8 rows. This is useful if the source art is very small and you want more terminal presence, but it doubles the board size.

---

## Implementation

### Language: TypeScript (Node.js)

Rationale: the chess puzzle game will be a Claude Code extension, likely in TypeScript. Keeping the toolchain unified. Use `sharp` for PNG decoding (fast, widely available, no native dependency headaches on most platforms).

### Core Algorithm

```
function convertSprite(pixels: RGBA[][], bgColor?: RGB): string[] {
  const rows: string[] = [];
  
  for (let y = 0; y < height; y += 2) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const topPixel  = pixels[y][x];
      const bottomPixel = pixels[y + 1][x];
      
      const topColor = isTransparent(topPixel) ? bgColor : toRGB(topPixel);
      const bottomColor = isTransparent(bottomPixel) ? bgColor : toRGB(bottomPixel);
      
      // BG = top pixel color, FG = bottom pixel color, char = ▄
      row += `\x1b[48;2;${topColor.r};${topColor.g};${topColor.b}m`;
      row += `\x1b[38;2;${bottomColor.r};${bottomColor.g};${bottomColor.b}m`;
      row += "▄";
    }
    row += "\x1b[0m";  // reset at end of row
    rows.push(row);
  }
  
  return rows;
}
```

### Transparency Detection

A pixel is transparent if its alpha channel is below a threshold (default: 128). Fully transparent = alpha 0. Semi-transparent pixels should be alpha-composited against the board color at render time for smooth edges (important for anti-aliased sprites — but most 8×8 pixel art won't have this).

For v1: treat alpha < 128 as fully transparent, alpha >= 128 as fully opaque. No compositing.

### Edge Cases

- **Non-square sprites**: Allowed. Width and height are independent. Height must be even.
- **Sprites with no transparency**: Works fine — all pixels render as opaque.
- **All-transparent sprite**: Outputs a blank space. Should warn but not error.
- **Non-PNG input**: Reject with error. Only PNG supported (for alpha channel).
- **Palette-indexed PNGs**: `sharp` handles these transparently (converts to RGBA internally).

---

## Verification Checklist

Before proceeding to the chess puzzle game, the converter output must pass these checks:

1. **Cat test**: `cat output.ans` in a truecolor terminal shows clearly recognizable chess pieces with correct colors.
2. **Squint test**: Squint at the terminal from arm's length. Can you instantly tell a knight from a bishop? If not, the sprite art needs revision (not the converter's fault, but blocks the project).
3. **Dark/light square test**: Render each piece on both board colors. Pieces must be clearly visible on both. If a white piece vanishes on a light square, the sprites need outlines or shading.
4. **Full board test**: Render a starting position. The board should feel like a chess board at first glance, not a mess of characters.
5. **Terminal compatibility**: Test in at least iTerm2, Kitty or Alacritty, and VS Code integrated terminal (which is where most Claude Code users will see this).

---

## Open Questions

1. **Where to source sprites?** Options include: draw custom 12×12 pixel art, adapt from open-source pixel art chess sets (many exist on itch.io and OpenGameArt under CC0/CC-BY), or commission a small set. 12 sprites at 8×8 or 12×12 is a very small art task.

2. **Piece outlines**: On a real chess board, white pieces on light squares are visible because of shadows and 3D shading. In pixel art, you typically add a 1px dark outline. Should the converter add this automatically, or should it be baked into the source sprites? **Recommendation: bake into sprites.** The converter should be a dumb pixel-to-ANSI translator, not an image processor.

3. **Terminal width constraints**: A full 8×8 board with 12-char-wide squares is 96 chars. Most terminal windows are 80-120 chars wide. Should we support a compact mode? Or just mandate minimum terminal width?

4. **Selected square highlighting**: The chess puzzle game needs to highlight the square the player is selecting/moving. This is a renderer concern, not a converter concern, but worth noting: the renderer should be able to tint a square's background color (e.g. yellow-green for selected) and re-render the piece on top.

---

## File Structure

```
chess-sprite-converter/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── decoder.ts        # PNG loading, sprite sheet slicing
│   ├── converter.ts      # Core half-block conversion algorithm
│   ├── renderer.ts       # ANSI string assembly, terminal output
│   └── types.ts          # Shared types (Pixel, Piece, SpriteData, etc.)
├── test/
│   ├── fixtures/         # Test sprite PNGs
│   └── converter.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

| Package   | Purpose                           | Size    |
|-----------|-----------------------------------|---------|
| `sharp`   | PNG decoding, pixel data access   | ~7MB    |
| `commander` | CLI argument parsing            | Tiny    |

No other dependencies needed. The core algorithm is pure math on pixel arrays.