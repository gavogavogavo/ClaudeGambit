const ESC = '\x1b';
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const CYAN = `${ESC}[36m`;
const RESET = `${ESC}[0m`;

export class SessionStats {
  streak = 0;
  bestStreak = 0;
  attempted = 0;
  solved = 0;
  hintedPuzzles = 0;
  skippedPuzzles = 0;
  private puzzleStartTime = 0;
  private solveTimes: number[] = [];
  private puzzleUsedHint = false;
  private puzzleHadWrong = false;

  startPuzzle(): void {
    this.attempted++;
    this.puzzleStartTime = Date.now();
    this.puzzleUsedHint = false;
    this.puzzleHadWrong = false;
  }

  recordSolve(): void {
    this.solved++;
    const elapsed = Date.now() - this.puzzleStartTime;
    this.solveTimes.push(elapsed);

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
      return `🔥 Streak: ${this.streak}`;
    }
    return '';
  }

  printSummary(): void {
    const avgTime = this.avgSolveTimeMs;
    const avgSecs = avgTime > 0 ? `${Math.round(avgTime / 1000)}s` : '-';

    console.log('');
    console.log(`${BOLD}${CYAN}Session Summary${RESET}`);
    console.log(`  Puzzles: ${this.attempted} attempted, ${this.solved} solved (${this.accuracy}%)`);
    console.log(`  Best streak: ${this.bestStreak}`);
    console.log(`  Avg solve time: ${avgSecs}`);
    if (this.hintedPuzzles > 0) console.log(`  Hints used: ${this.hintedPuzzles} puzzles`);
    if (this.skippedPuzzles > 0) console.log(`  Skipped: ${this.skippedPuzzles}`);
    console.log('');
  }
}
