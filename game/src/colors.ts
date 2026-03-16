import type { RGB } from './types.js';

const ESC = '\x1b';

// Board colors
export const LIGHT_SQUARE: RGB = [234, 235, 200];
export const DARK_SQUARE: RGB = [119, 153, 84];
export const CURSOR_COLOR: RGB = [186, 202, 68];
export const SELECTED_COLOR: RGB = [106, 135, 77];
export const CORRECT_COLOR: RGB = [100, 194, 100];
export const WRONG_COLOR: RGB = [220, 80, 80];
export const OPPONENT_COLOR: RGB = [170, 162, 58];
export const HINT_COLOR: RGB = [220, 160, 50];
export const CAPTURE_CORNER: RGB = [180, 60, 60];

// ANSI style helpers
export const BOLD = `${ESC}[1m`;
export const DIM = `${ESC}[2m`;
export const RESET = `${ESC}[0m`;
export const CLR_EOL = `${ESC}[K`;
export const HIDE_CURSOR = `${ESC}[?25l`;
export const SHOW_CURSOR = `${ESC}[?25h`;
export const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
export const CURSOR_HOME = `${ESC}[H`;
export const CLEAR_BELOW = `${ESC}[J`;

// UI chrome colors (truecolor)
export const TEAL = `${ESC}[38;2;80;200;180m`;
export const GREEN_FG = `${ESC}[38;2;80;220;100m`;
export const RED_FG = `${ESC}[38;2;220;80;80m`;
export const ORANGE_FG = `${ESC}[38;2;255;170;50m`;
export const DIM_GRAY = `${ESC}[2m${ESC}[38;2;140;140;140m`;
export const MED_GRAY = `${ESC}[38;2;160;160;160m`;
export const BORDER_GRAY = `${ESC}[38;2;100;100;100m`;
export const WHITE_FG = `${ESC}[38;2;220;220;220m`;
export const BRIGHT_WHITE = `${ESC}[1m${ESC}[38;2;255;255;255m`;
