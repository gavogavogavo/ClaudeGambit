import { createKeyReader } from './input.js';
import {
  BOLD, DIM, RESET, HIDE_CURSOR, CLEAR_SCREEN, CLR_EOL, CURSOR_HOME,
  TEAL, DIM_GRAY, BRIGHT_WHITE, BORDER_GRAY,
} from './colors.js';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export interface DifficultyRange {
  min: number;
  max: number;
}

export const DIFFICULTY_RANGES: Record<Exclude<Difficulty, 'adaptive'>, DifficultyRange> = {
  easy: { min: 0, max: 1200 },
  medium: { min: 1200, max: 1600 },
  hard: { min: 1600, max: 9999 },
};

const OPTIONS: { label: string; desc: string; value: Difficulty }[] = [
  { label: 'Easy', desc: '800-1200', value: 'easy' },
  { label: 'Medium', desc: '1200-1600', value: 'medium' },
  { label: 'Hard', desc: '1600+', value: 'hard' },
  { label: 'Adaptive', desc: 'Auto-adjusts', value: 'adaptive' },
];

function renderMenu(selected: number, innerWidth: number): string {
  const top = '╔' + '═'.repeat(innerWidth) + '╗';
  const bot = '╚' + '═'.repeat(innerWidth) + '╝';

  function boxLine(content: string): string {
    const vl = content.replace(/\x1b\[[0-9;]*m/g, '').length;
    const pad = Math.max(0, innerWidth - 2 - vl);
    return '║ ' + content + ' '.repeat(pad) + ' ║';
  }

  const lines: string[] = [];
  lines.push(top);
  lines.push(boxLine(`${BOLD}${TEAL}ClaudeGambit${RESET}`));
  lines.push(boxLine(''));
  lines.push(boxLine(`${DIM}Select difficulty:${RESET}`));
  lines.push(boxLine(''));

  for (let i = 0; i < OPTIONS.length; i++) {
    const opt = OPTIONS[i];
    const arrow = i === selected ? `${BOLD}> ` : '  ';
    const label = i === selected
      ? `${arrow}${opt.label}${RESET}  ${DIM}(${opt.desc})${RESET}`
      : `${arrow}${DIM}${opt.label}  (${opt.desc})${RESET}`;
    lines.push(boxLine(label));
  }

  lines.push(boxLine(''));
  lines.push(boxLine(`${DIM}↑↓ Select  ·  Enter Confirm  ·  Q Quit${RESET}`));
  lines.push(bot);

  return lines.map((l) => l + CLR_EOL).join('\n');
}

/**
 * Show an interactive difficulty selection menu.
 * Returns the chosen difficulty, or null if the user quits.
 */
export async function showDifficultyMenu(): Promise<Difficulty | null> {
  const { readKey, cleanup } = createKeyReader();
  let selected = 1; // Default to Medium

  process.stdout.write(HIDE_CURSOR + CLEAR_SCREEN);
  process.stdout.write(CURSOR_HOME + renderMenu(selected, 40));

  try {
    while (true) {
      const key = await readKey();

      if (key.type === 'quit') return null;

      if (key.type === 'arrow') {
        if (key.direction === 'up' && selected > 0) selected--;
        if (key.direction === 'down' && selected < OPTIONS.length - 1) selected++;
        process.stdout.write(CURSOR_HOME + renderMenu(selected, 40));
      }

      if (key.type === 'enter') {
        return OPTIONS[selected].value;
      }
    }
  } finally {
    cleanup();
  }
}

/**
 * Adaptive difficulty tracker.
 */
export class AdaptiveDifficulty {
  private currentBracket: Exclude<Difficulty, 'adaptive'> = 'medium';
  private consecutiveCorrect = 0;
  private consecutiveWrong = 0;

  getRange(): DifficultyRange {
    return DIFFICULTY_RANGES[this.currentBracket];
  }

  getBracketName(): string {
    return this.currentBracket.charAt(0).toUpperCase() + this.currentBracket.slice(1);
  }

  recordSolve(): void {
    this.consecutiveCorrect++;
    this.consecutiveWrong = 0;
    if (this.consecutiveCorrect >= 3) {
      this.shiftUp();
      this.consecutiveCorrect = 0;
    }
  }

  recordFail(): void {
    this.consecutiveWrong++;
    this.consecutiveCorrect = 0;
    if (this.consecutiveWrong >= 2) {
      this.shiftDown();
      this.consecutiveWrong = 0;
    }
  }

  private shiftUp(): void {
    if (this.currentBracket === 'easy') this.currentBracket = 'medium';
    else if (this.currentBracket === 'medium') this.currentBracket = 'hard';
  }

  private shiftDown(): void {
    if (this.currentBracket === 'hard') this.currentBracket = 'medium';
    else if (this.currentBracket === 'medium') this.currentBracket = 'easy';
  }
}
