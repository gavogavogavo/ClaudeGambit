import type { KeyPress } from './input.js';
import { readSignal } from './signal.js';
import {
  BOLD, DIM, RESET, CLR_EOL, CLEAR_SCREEN, CURSOR_HOME, CLEAR_BELOW,
  TEAL, DIM_GRAY, WHITE_FG, BRIGHT_WHITE,
} from './colors.js';

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padCenter(s: string, width: number): string {
  const vl = visibleLength(s);
  const pad = Math.max(0, width - vl);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + s + ' '.repeat(pad - left);
}

function renderBox(lines: string[], innerWidth: number): string {
  const top = `${TEAL}╔${'═'.repeat(innerWidth)}╗${RESET}`;
  const bot = `${TEAL}╚${'═'.repeat(innerWidth)}╝${RESET}`;

  function boxLine(content: string): string {
    const vl = visibleLength(content);
    const pad = Math.max(0, innerWidth - 2 - vl);
    return `${TEAL}║${RESET} ${content}${' '.repeat(pad)} ${TEAL}║${RESET}`;
  }

  const result = [top];
  for (const line of lines) {
    result.push(boxLine(line));
  }
  result.push(bot);
  return result.map((l) => l + CLR_EOL).join('\n');
}

/**
 * Show welcome screen. Waits for Enter or resume signal.
 */
export async function showWelcomeScreen(
  readKeyWithTimeout: (ms: number) => Promise<KeyPress | null>,
  signalFile?: string
): Promise<'play' | 'signal_resume'> {
  const w = 44;
  const content = [
    '',
    padCenter(`${WHITE_FG}♔${RESET}  ${BOLD}${TEAL}ClaudeGambit${RESET}  ${WHITE_FG}♔${RESET}`, w - 2),
    '',
    padCenter(`${DIM_GRAY}Chess puzzles while Claude${RESET}`, w - 2),
    padCenter(`${DIM_GRAY}thinks${RESET}`, w - 2),
    '',
    padCenter(`${DIM_GRAY}Submit a prompt to start playing${RESET}`, w - 2),
    padCenter(`${BOLD}${TEAL}or press Enter for free play${RESET}`, w - 2),
    '',
  ];

  process.stdout.write(CLEAR_SCREEN);
  process.stdout.write(CURSOR_HOME + renderBox(content, w));

  while (true) {
    const key = await readKeyWithTimeout(200);
    if (key) {
      if (key.type === 'enter') return 'play';
      if (key.type === 'quit') return 'play'; // Let the game loop handle quit
    }
    // Check signal
    if (signalFile) {
      const signal = readSignal(signalFile);
      if (signal === 'resume') return 'signal_resume';
    }
  }
}

/**
 * Show pause overlay. Waits for Enter or resume signal.
 */
export async function showPauseOverlay(
  readKeyWithTimeout: (ms: number) => Promise<KeyPress | null>,
  signalFile?: string
): Promise<'dismiss' | 'signal_resume'> {
  const w = 44;
  const content = [
    '',
    padCenter(`${WHITE_FG}♔${RESET}  ${BOLD}${TEAL}Claude finished responding${RESET}`, w - 2),
    '',
    padCenter(`${DIM_GRAY}Check your terminal for output${RESET}`, w - 2),
    '',
    padCenter(`${BOLD}${TEAL}Press Enter to keep playing${RESET}`, w - 2),
    '',
  ];

  process.stdout.write(CLEAR_SCREEN);
  process.stdout.write(CURSOR_HOME + renderBox(content, w));

  while (true) {
    const key = await readKeyWithTimeout(200);
    if (key) {
      if (key.type === 'enter') return 'dismiss';
      if (key.type === 'quit') return 'dismiss';
    }
    if (signalFile) {
      const signal = readSignal(signalFile);
      if (signal === 'resume') return 'signal_resume';
    }
  }
}
