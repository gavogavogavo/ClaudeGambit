/** RGBA pixel: [red, green, blue, alpha] each 0-255 */
export type RGBA = [number, number, number, number];

/** RGB color: [red, green, blue] each 0-255 */
export type RGB = [number, number, number];

/** The 12 chess piece identifiers */
export type PieceKey =
  | 'white_king' | 'white_queen' | 'white_rook'
  | 'white_bishop' | 'white_knight' | 'white_pawn'
  | 'black_king' | 'black_queen' | 'black_rook'
  | 'black_bishop' | 'black_knight' | 'black_pawn';

/** Piece layout order in sprite sheet: top row (white), bottom row (black) */
export const PIECE_ORDER: PieceKey[] = [
  'white_king', 'white_queen', 'white_rook',
  'white_bishop', 'white_knight', 'white_pawn',
  'black_king', 'black_queen', 'black_rook',
  'black_bishop', 'black_knight', 'black_pawn',
];

/** A single character cell in the half-block output */
export interface Cell {
  /** Foreground color (bottom pixel). null if bottom pixel transparent */
  fg: RGB | null;
  /** Background color (top pixel). null if top pixel transparent */
  bg: RGB | null;
  /** The character to render (always ▄) */
  char: string;
  /** Whether the top pixel (bg) is transparent */
  t_top: boolean;
  /** Whether the bottom pixel (fg) is transparent */
  t_bottom: boolean;
}

/** Converted piece: array of rows, each row is array of cells */
export type PieceData = Cell[][];

/** All 12 pieces as raw RGBA pixel grids */
export type SpriteMap = Record<PieceKey, RGBA[][]>;

/** JSON output structure */
export interface OutputJSON {
  meta: {
    sprite_width: number;
    sprite_height: number;
    terminal_width: number;
    terminal_height: number;
    generated_at: string;
    source: string;
  };
  pieces: Record<PieceKey, PieceData>;
}
