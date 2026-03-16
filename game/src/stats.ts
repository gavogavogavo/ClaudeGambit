import {
  BOLD, DIM, RESET,
  TEAL, GREEN_FG, ORANGE_FG, DIM_GRAY, WHITE_FG, BORDER_GRAY,
} from './colors.js';

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padRight(s: string, width: number): string {
  const vl = visibleLength(s);
  return vl < width ? s + ' '.repeat(width - vl) : s;
}

export class SessionStats {
  streak = 0;
  bestStreak = 0;
  attempted = 0;
  solved = 0;
  hintedPuzzles = 0;
  skippedPuzzles = 0;
  private puzzleStartTime = 0;
  private pausedAt = 0;
  private accumulatedPause = 0;
  private solveTimes: number[] = [];
  private puzzleUsedHint = false;
  private puzzleHadWrong = false;

  startPuzzle(): void {
    this.attempted++;
    this.puzzleStartTime = Date.now();
    this.accumulatedPause = 0;
    this.puzzleUsedHint = false;
    this.puzzleHadWrong = false;
  }

  pauseTimer(): void {
    this.pausedAt = Date.now();
  }

  resumeTimer(): void {
    if (this.pausedAt > 0) {
      this.accumulatedPause += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
  }

  /** Elapsed time for current puzzle in ms, excluding paused time */
  getElapsedMs(): number {
    const now = this.pausedAt > 0 ? this.pausedAt : Date.now();
    return now - this.puzzleStartTime - this.accumulatedPause;
  }

  recordSolve(): void {
    this.solved++;
    this.solveTimes.push(this.getElapsedMs());

    if (!this.puzzleUsedHint && !this.puzzleHadWrong) {
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.streak = 0;
    }
  }

  recordWrong(): void {
    this.puzzleHadWrong = true;
    this.streak = 0;
  }

  recordHint(): void {
    if (!this.puzzleUsedHint) {
      this.puzzleUsedHint = true;
      this.hintedPuzzles++;
    }
    this.streak = 0;
  }

  recordSkip(): void {
    this.skippedPuzzles++;
    this.streak = 0;
  }

  get accuracy(): number {
    return this.attempted > 0 ? Math.round((this.solved / this.attempted) * 100) : 0;
  }

  get avgSolveTimeMs(): number {
    if (this.solveTimes.length === 0) return 0;
    return this.solveTimes.reduce((a, b) => a + b, 0) / this.solveTimes.length;
  }

  formatForHeader(): string {
    if (this.streak > 0) {
      return `${ORANGE_FG}🔥 Streak: ${this.streak}${RESET}`;
    }
    return '';
  }

  formatTimer(): string {
    const elapsed = this.getElapsedMs();
    const secs = Math.floor(elapsed / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${DIM_GRAY}⏱ ${mins}:${s.toString().padStart(2, '0')}${RESET}`;
  }

  printSummary(): void {
    const avgTime = this.avgSolveTimeMs;
    const avgSecs = avgTime > 0 ? `${Math.round(avgTime / 1000)}s` : '-';
    const w = 44;

    function boxLine(content: string): string {
      return `${BORDER_GRAY}║${RESET} ` + padRight(content, w - 2) + ` ${BORDER_GRAY}║${RESET}`;
    }

    function statLine(label: string, value: string): string {
      const padded = label + ' '.repeat(Math.max(1, 24 - label.length));
      return `${DIM_GRAY}${padded}${RESET}${value}`;
    }

    console.log('');
    console.log(`${BORDER_GRAY}╔${'═'.repeat(w)}╗${RESET}`);
    console.log(boxLine(''));
    console.log(boxLine(`     ${WHITE_FG}♔${RESET}  ${BOLD}${TEAL}Session Complete${RESET}  ${WHITE_FG}♔${RESET}`));
    console.log(boxLine(''));
    console.log(boxLine(statLine('  Puzzles attempted', `${WHITE_FG}${this.attempted}${RESET}`)));
    console.log(boxLine(statLine('  Puzzles solved', `${GREEN_FG}${this.solved}${RESET}`)));
    console.log(boxLine(statLine('  Accuracy', `${WHITE_FG}${this.accuracy}%${RESET}`)));
    console.log(boxLine(statLine('  Best streak', `${ORANGE_FG}${this.bestStreak}${RESET}`)));
    console.log(boxLine(statLine('  Avg solve time', `${WHITE_FG}${avgSecs}${RESET}`)));
    console.log(boxLine(''));
    console.log(boxLine(`       ${DIM_GRAY}Thanks for playing!${RESET}`));
    console.log(boxLine(''));
    console.log(`${BORDER_GRAY}╚${'═'.repeat(w)}╝${RESET}`);
    console.log('');
  }
}
