# Chess Sprite Converter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool that converts pixel art chess piece PNGs into pre-baked ANSI terminal art using the Unicode half-block technique.

**Architecture:** Sharp decodes PNGs into raw RGBA pixel arrays. The converter pairs rows (top/bottom) and emits half-block characters with truecolor ANSI escapes, tracking transparency for runtime board-color substitution. Output is JSON (for game runtime) or raw ANSI (for visual testing). A `--size` flag downscales sprites via nearest-neighbor before conversion.

**Tech Stack:** TypeScript, Node.js, sharp (PNG decode + resize), commander (CLI)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Shared types: Pixel, RGB, PieceKey, SpriteData, Cell, PieceData |
| `src/converter.ts` | Core half-block algorithm: RGBA[][] → Cell[][] with transparency masks |
| `src/decoder.ts` | PNG loading via sharp, sprite sheet slicing, individual file loading, --size resize |
| `src/renderer.ts` | ANSI string assembly from Cell[][], JSON output generation, terminal preview |
| `src/index.ts` | CLI entry point with commander |
| `test/converter.test.ts` | Unit tests for core algorithm |
| `test/decoder.test.ts` | Unit tests for PNG loading/slicing |
| `test/fixtures/` | Test sprite PNGs (generated programmatically in tests) |

---

## Chunk 1: Project Setup + Core Algorithm

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize project**

```bash
cd /Users/davidryan/Projects/claudeChess
npm init -y
npm install sharp commander
npm install -D typescript @types/node @types/sharp vitest
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Add scripts to package.json**

Add `"type": "module"` and scripts:
```json
"scripts": {
  "build": "tsc",
  "start": "node --loader ts-node/esm src/index.ts",
  "test": "vitest run"
}
```

- [ ] **Step 4: Commit**

```bash
git init && git add package.json tsconfig.json package-lock.json
git commit -m "chore: initialize project with sharp, commander, typescript, vitest"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

Key types: `RGBA` (4-tuple), `RGB` (3-tuple), `PieceKey` (union of 12 piece names), `Cell` (fg, bg, char, t_top, t_bottom), `PieceData` (rows of Cells), `SpriteMap` (Record<PieceKey, RGBA[][]>), `OutputJSON` (meta + pieces).

- [ ] **Step 2: Commit**

---

### Task 3: Core converter — TDD

**Files:**
- Create: `src/converter.ts`
- Create: `test/converter.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
1. **Two opaque rows** → correct BG/FG colors, char=▄, no transparency
2. **Top transparent, bottom opaque** → t_top=true, t_bottom=false
3. **Both transparent** → both t_top and t_bottom true
4. **4×4 sprite** → produces 2 rows of 4 cells each
5. **Odd-height sprite** → throws error
6. **Alpha threshold** → alpha=127 is transparent, alpha=128 is opaque

- [ ] **Step 2: Run tests, verify they fail**

```bash
npx vitest run test/converter.test.ts
```

- [ ] **Step 3: Implement converter**

`convertSprite(pixels: RGBA[][], width: number, height: number): Cell[][]`

Loop y by 2, x by 1. For each cell, read top pixel (y) and bottom pixel (y+1). Set t_top/t_bottom based on alpha < 128. Store opaque colors in fg/bg. All cells use char=▄.

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

---

### Task 4: Decoder — TDD

**Files:**
- Create: `src/decoder.ts`
- Create: `test/decoder.test.ts`

- [ ] **Step 1: Write failing tests**

Use sharp to programmatically create test PNGs in fixtures:
1. **loadSpriteSheet** — create a 24×8 PNG (6cols × 2rows of 4×4 cells), verify it returns 12 pieces with correct pixel data
2. **loadIndividualFiles** — create 12 small PNGs in a temp dir, verify loading
3. **resizeSprite** — create an 8×8 sprite, resize to 4×4 with nearest-neighbor, verify pixel values preserved (no interpolation blending)
4. **Odd-height after resize rejection**

- [ ] **Step 2: Run tests, verify fail**
- [ ] **Step 3: Implement decoder**

`loadSpriteSheet(path, targetSize?)` — sharp decode, optional resize, slice into 12 RGBA[][] arrays.
`loadDirectory(dir, targetSize?)` — load 12 named PNGs.
Resize uses `sharp.resize(size, size, { kernel: 'nearest' })`.

- [ ] **Step 4: Run tests, verify pass**
- [ ] **Step 5: Commit**

---

## Chunk 2: Renderer + CLI

### Task 5: Renderer

**Files:**
- Create: `src/renderer.ts`

- [ ] **Step 1: Write failing tests for ANSI rendering**

Test: given a Cell[][] and a board background color, produce correct ANSI escape sequences. Verify:
1. Opaque cell → `\x1b[48;2;R;G;Bm\x1b[38;2;R;G;Bm▄`
2. Transparent top → bg uses board color
3. Transparent bottom → fg uses board color
4. Row ends with `\x1b[0m`
5. Full-transparent cell → space character with board bg

- [ ] **Step 2: Implement renderer functions**

- `renderPieceAnsi(piece: Cell[][], bgColor: RGB): string[]` — returns array of ANSI strings (one per row)
- `renderPreview(pieces: Record<PieceKey, Cell[][]>, bgColor: RGB): void` — prints all 12 pieces to terminal
- `generateJSON(pieces, meta): OutputJSON` — builds the JSON lookup table
- `renderAllAnsi(pieces, bgColor): string` — full ANSI output for .ans file

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

---

### Task 6: CLI entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement CLI with commander**

Options:
```
--sheet <path>       Sprite sheet PNG
--dir <path>         Directory of individual PNGs
--json <path>        Output JSON file
--ansi <path>        Output ANSI file
--preview            Print pieces to terminal
--bg <R,G,B>         Background color (default: 181,136,99)
--size <n>           Target sprite size (nearest-neighbor downscale)
--scale <1|2>        Scale factor (default: 1)
--outline <R,G,B>    Outline color (optional)
```

Validation: require --sheet or --dir, require at least one output (--json, --ansi, or --preview).

- [ ] **Step 2: Wire up: decode → convert → render/output**
- [ ] **Step 3: Add bin entry to package.json**
- [ ] **Step 4: Manual test with --preview**
- [ ] **Step 5: Commit**

---

### Task 7: Visual verification

- [ ] **Step 1: Obtain or create test sprite sheet**
- [ ] **Step 2: Run preview mode on dark square color**

```bash
npx tsx src/index.ts --sheet sprites.png --preview --bg 181,136,99
```

- [ ] **Step 3: Run preview on light square color**

```bash
npx tsx src/index.ts --sheet sprites.png --preview --bg 240,217,181
```

- [ ] **Step 4: Generate JSON output**
- [ ] **Step 5: Final commit**
