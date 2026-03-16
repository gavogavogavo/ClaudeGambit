import { readFileSync } from 'fs';
import path from 'path';
import { Chess } from 'chess.js';
import type { PieceKey, RGBA, RGB } from './types.js';
import {
  parseFEN,
  renderBoardLines,
  prepareSprites,
  type Board,
  type SpriteCache,
  type SquareHighlight,
  type SquareOverlay,
} from './board.js';
import {
  CURSOR_COLOR, SELECTED_COLOR, CORRECT_COLOR, WRONG_COLOR,
  OPPONENT_COLOR, HINT_COLOR,
  BOLD, DIM, RESET, CLR_EOL, HIDE_CURSOR, SHOW_CURSOR, CLEAR_SCREEN, CURSOR_HOME, CLEAR_BELOW,
  TEAL, GREEN_FG, RED_FG, ORANGE_FG, DIM_GRAY, BORDER_GRAY, WHITE_FG, BRIGHT_WHITE,
} from './colors.js';
import { createKeyReader } from './input.js';
import { SessionStats } from './stats.js';
import { readSignal, writePidFile } from './signal.js';
import { showWelcomeScreen, showPauseOverlay } from './overlay.js';
import {
  showDifficultyMenu,
  AdaptiveDifficulty,
  DIFFICULTY_RANGES,
  type Difficulty,
  type DifficultyRange,
} from './menu.js';

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

function loadPuzzles(): Puzzle[] {
  const filePath = path.join(import.meta.dirname, '..', 'data', 'puzzles.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function filterPuzzles(puzzles: Puzzle[], range: DifficultyRange): Puzzle[] {
  return puzzles.filter((p) => p.rating >= range.min && p.rating < range.max);
}

function pickRandom(puzzles: Puzzle[]): Puzzle {
  return puzzles[Math.floor(Math.random() * puzzles.length)];
}

function applyUCIMove(game: Chess, uci: string): string | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    const result = game.move({ from, to, promotion });
    return result ? result.san : null;
  } catch {
    return null;
  }
}

function getMateType(puzzle: Puzzle): string {
  if (puzzle.themes.includes('mateIn1')) return 'Mate in 1';
  if (puzzle.themes.includes('mateIn2')) return 'Mate in 2';
  if (puzzle.themes.includes('mateIn3')) return 'Mate in 3';
  return 'Puzzle';
}

function toAlgebraic(rank: number, file: number): string {
  return String.fromCharCode(97 + file) + (8 - rank);
}

function fromAlgebraic(sq: string): { rank: number; file: number } {
  return { file: sq.charCodeAt(0) - 97, rank: 8 - parseInt(sq[1]) };
}

function getLegalMoveOverlays(game: Chess, rank: number, file: number, board: Board): SquareOverlay[] {
  const sq = toAlgebraic(rank, file);
  try {
    const moves = game.moves({ square: sq as any, verbose: true }) as any[];
    return moves.map((m) => {
      const dest = fromAlgebraic(m.to);
      const isCapture = m.captured !== undefined;
      return { rank: dest.rank, file: dest.file, type: isCapture ? 'capture' as const : 'dot' as const };
    });
  } catch {
    return [];
  }
}

const MOVE_DELAY = 800;
const FLASH_DELAY = 300;
const SOLUTION_DELAY = 1000;
const SUCCESS_FLASH = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uciToCoords(uci: string) {
  return {
    from: fromAlgebraic(uci.slice(0, 2)),
    to: fromAlgebraic(uci.slice(2, 4)),
  };
}

interface PuzzleHeader {
  puzzleNum: number;
  mateType: string;
  rating: number;
  playerColor: string;
  setupSan: string;
  streakText: string;
  difficultyText: string;
  timerText: string;
}

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padRight(s: string, width: number): string {
  const vl = visibleLength(s);
  return vl < width ? s + ' '.repeat(width - vl) : s;
}

function buildHeaderBox(info: PuzzleHeader, innerWidth: number, successFlash = false): string[] {
  const lines: string[] = [];
  const borderColor = successFlash ? GREEN_FG : BORDER_GRAY;
  const borderReset = RESET;
  const top = `${borderColor}╔${'═'.repeat(innerWidth)}╗${borderReset}`;
  const bot = `${borderColor}╚${'═'.repeat(innerWidth)}╝${borderReset}`;

  function boxLine(content: string): string {
    return `${borderColor}║${borderReset} ` + padRight(content, innerWidth - 2) + ` ${borderColor}║${borderReset}`;
  }

  const rightInfo = [info.streakText, info.difficultyText].filter(Boolean).join('  ');

  lines.push(top);
  if (rightInfo) {
    lines.push(boxLine(`${BOLD}${TEAL}${info.mateType}${RESET}  ${rightInfo}`));
  } else {
    lines.push(boxLine(`${BOLD}${TEAL}${info.mateType}${RESET}`));
  }
  const timerPart = info.timerText ? `  ·  ${info.timerText}` : '';
  lines.push(boxLine(`${DIM_GRAY}Puzzle #${info.puzzleNum}  ·  Rating: ${info.rating}${timerPart}${RESET}`));
  lines.push(boxLine(''));
  lines.push(boxLine(`You play as ${BOLD}${info.playerColor}${RESET}`));
  lines.push(boxLine(`Opponent played: ${BOLD}${info.setupSan}${RESET}`));
  lines.push(bot);

  return lines;
}

function drawBoard(
  board: Board,
  cache: SpriteCache,
  headerInfo: PuzzleHeader,
  message: string,
  statusBar: string,
  highlights: SquareHighlight[] = [],
  overlays: SquareOverlay[] = [],
  flipped = false,
  successFlash = false
) {
  const boardLines = renderBoardLines(board, cache, highlights, overlays, flipped);
  const boardWidth = 3 + 8 * cache.renderSize;
  const innerWidth = Math.max(boardWidth, 40);
  const headerLines = buildHeaderBox(headerInfo, innerWidth, successFlash);

  let output = CURSOR_HOME;
  for (const line of headerLines) {
    output += line + `${CLR_EOL}\n`;
  }
  output += `${CLR_EOL}\n`;
  for (const line of boardLines) {
    output += line + `${CLR_EOL}\n`;
  }
  output += `${CLR_EOL}\n`;
  if (message) {
    output += message + `${CLR_EOL}\n`;
  }
  output += statusBar + `${CLR_EOL}\n`;
  output += `${CLR_EOL}\n`;
  output += CLEAR_BELOW;

  process.stdout.write(output);
}

/**
 * Build all board snapshots for a puzzle's solution for review mode.
 */
function buildMoveHistory(puzzle: Puzzle): { boards: Board[]; sans: string[]; moves: string[] } {
  const game = new Chess(puzzle.fen);
  const boards: Board[] = [parseFEN(game.fen())];
  const sans: string[] = [];

  for (const uci of puzzle.moves) {
    const san = applyUCIMove(game, uci);
    sans.push(san ?? uci);
    boards.push(parseFEN(game.fen()));
  }

  return { boards, sans, moves: puzzle.moves };
}

/**
 * Review mode: scrub through puzzle moves with left/right arrows.
 * Returns 'next' for next puzzle, 'retry' to retry, or 'quit'.
 */
async function reviewMode(
  history: { boards: Board[]; sans: string[]; moves: string[] },
  cache: SpriteCache,
  headerInfo: PuzzleHeader,
  readKey: () => Promise<import('./input.js').KeyPress>,
  flipped: boolean,
  startAtEnd: boolean
): Promise<'next' | 'retry' | 'quit'> {
  let pos = startAtEnd ? history.boards.length - 1 : 0;

  function drawReview() {
    const board = history.boards[pos];
    const highlights: SquareHighlight[] = [];

    if (pos > 0) {
      const uci = history.moves[pos - 1];
      const coords = uciToCoords(uci);
      const isPlayerMove = pos % 2 === 0; // moves[0] = opponent setup, moves[1] = player, etc.
      const color = isPlayerMove ? CORRECT_COLOR : OPPONENT_COLOR;
      highlights.push({ rank: coords.from.rank, file: coords.from.file, color });
      highlights.push({ rank: coords.to.rank, file: coords.to.file, color });
    }

    const moveLabel = pos === 0
      ? 'Starting position'
      : `Move ${pos}/${history.sans.length}: ${history.sans[pos - 1]}`;

    const msg = `${moveLabel}`;
    const bar = `${DIM}←→ Browse moves  ·  Enter Next puzzle  ·  R Retry  ·  Q Quit${RESET}`;
    drawBoard(board, cache, headerInfo, msg, bar, highlights, [], flipped);
  }

  drawReview();

  while (true) {
    const key = await readKey();
    if (key.type === 'quit') return 'quit';
    if (key.type === 'enter') return 'next';
    if (key.type === 'retry') return 'retry';
    if (key.type === 'arrow') {
      if (key.direction === 'left' && pos > 0) pos--;
      if (key.direction === 'right' && pos < history.boards.length - 1) pos++;
      drawReview();
    }
  }
}

export async function runPuzzleLoop(
  sprites: Record<PieceKey, RGBA[][]>,
  nativeSize: number,
  renderSize?: number,
  outline = false,
  signalFile?: string,
  pidFile?: string
): Promise<void> {
  // Write PID file if in plugin mode
  if (pidFile) {
    writePidFile(pidFile);
  }

  // Show difficulty menu
  const difficulty = await showDifficultyMenu();
  if (difficulty === null) return;

  const allPuzzles = loadPuzzles();
  const cache = await prepareSprites(sprites, nativeSize, renderSize, outline);
  const stats = new SessionStats();
  const adaptive = difficulty === 'adaptive' ? new AdaptiveDifficulty() : null;

  function getCurrentRange(): DifficultyRange {
    if (adaptive) return adaptive.getRange();
    return DIFFICULTY_RANGES[difficulty as Exclude<Difficulty, 'adaptive'>];
  }

  function getDifficultyText(): string {
    if (adaptive) return `${DIM}Adaptive (${adaptive.getBracketName()})${RESET}`;
    const label = difficulty!.charAt(0).toUpperCase() + difficulty!.slice(1);
    return `${DIM}${label}${RESET}`;
  }

  const { readKey, readKeyWithTimeout, cleanup } = createKeyReader();

  process.stdout.write(HIDE_CURSOR + CLEAR_SCREEN);

  // In plugin mode, show welcome screen first
  if (signalFile) {
    const welcomeResult = await showWelcomeScreen(readKeyWithTimeout, signalFile);
    // Whether 'play' or 'signal_resume', continue to difficulty menu
    process.stdout.write(CLEAR_SCREEN);
  }

  let puzzleNum = 0;

  // Signal-aware input wrapper: checks for pause signals between key reads
  let redrawFn: (() => void) | null = null;
  async function waitForInput(): Promise<import('./input.js').KeyPress> {
    if (!signalFile) return readKey();
    while (true) {
      const key = await readKeyWithTimeout(200);
      if (key) return key;
      const signal = readSignal(signalFile);
      if (signal === 'paused') {
        stats.pauseTimer();
        const result = await showPauseOverlay(readKeyWithTimeout, signalFile);
        stats.resumeTimer();
        process.stdout.write(CLEAR_SCREEN);
        if (redrawFn) redrawFn();
      }
    }
  }

  try {
    gameLoop: while (true) {
      const pool = filterPuzzles(allPuzzles, getCurrentRange());
      if (pool.length === 0) {
        console.log('No puzzles available in this difficulty range.');
        break;
      }

      puzzleNum++;
      const puzzle = pickRandom(pool);
      stats.startPuzzle();

      // Run this puzzle (with retry support)
      let retrying = true;
      while (retrying) {
        retrying = false;
        const game = new Chess(puzzle.fen);

        const playerColor = game.turn() === 'w' ? 'Black' : 'White';
        const playerIsWhite = playerColor === 'White';
        const flipped = !playerIsWhite;

        const setupMove = puzzle.moves[0];
        const setupCoords = uciToCoords(setupMove);

        const headerInfo: PuzzleHeader = {
          puzzleNum,
          mateType: getMateType(puzzle),
          rating: puzzle.rating,
          playerColor,
          setupSan: '...',
          streakText: stats.formatForHeader(),
          difficultyText: getDifficultyText(),
          timerText: '',
        };

        let cursorRank = playerIsWhite ? 6 : 1;
        let cursorFile = flipped ? 4 : 3;
        let selectedSquare: { rank: number; file: number } | null = null;
        let message = '';
        let board = parseFEN(game.fen());
        let moveIndex = 1;
        let hintLevel = 0;
        let puzzleHadWrong = false;

        function getOverlays(): SquareOverlay[] {
          if (selectedSquare) {
            return getLegalMoveOverlays(game, selectedSquare.rank, selectedSquare.file, board);
          }
          const piece = board[cursorRank][cursorFile];
          if (piece) {
            const isWhitePiece = piece.startsWith('white_');
            if ((playerIsWhite && isWhitePiece) || (!playerIsWhite && !isWhitePiece)) {
              return getLegalMoveOverlays(game, cursorRank, cursorFile, board);
            }
          }
          return [];
        }

        function getHintHighlights(): SquareHighlight[] {
          if (hintLevel === 0 || moveIndex >= puzzle.moves.length) return [];
          const expected = puzzle.moves[moveIndex];
          const coords = uciToCoords(expected);
          const hl: SquareHighlight[] = [];
          if (hintLevel >= 1) hl.push({ rank: coords.from.rank, file: coords.from.file, color: HINT_COLOR });
          if (hintLevel >= 2) hl.push({ rank: coords.to.rank, file: coords.to.file, color: HINT_COLOR });
          return hl;
        }

        function getHintMessage(): string {
          if (hintLevel < 3 || moveIndex >= puzzle.moves.length) return '';
          const expected = puzzle.moves[moveIndex];
          return `${DIM}Hint: ${expected.slice(0, 2)} → ${expected.slice(2, 4)}${RESET}`;
        }

        const playBar = `${DIM}↑←↓→ Move  ·  Enter Select  ·  Esc Cancel  ·  H Hint  ·  S Skip  ·  Q Quit${RESET}`;

        function drawActive(msg?: string) {
          headerInfo.timerText = stats.formatTimer();
          headerInfo.streakText = stats.formatForHeader();
          const hintMsg = getHintMessage();
          const fullMsg = msg !== undefined ? msg : message;
          const displayMsg = hintMsg ? (fullMsg ? `${fullMsg}  ${hintMsg}` : hintMsg) : fullMsg;
          const sq = toAlgebraic(cursorRank, cursorFile);
          const bar = `${sq}  ${playBar}`;
          const highlights = [...getHintHighlights(), { rank: cursorRank, file: cursorFile, color: CURSOR_COLOR }];
          if (selectedSquare) {
            highlights.push({ rank: selectedSquare.rank, file: selectedSquare.file, color: SELECTED_COLOR });
          }
          drawBoard(board, cache, headerInfo, displayMsg, bar, highlights, getOverlays(), flipped);
        }

        // Set redraw function for signal-aware input
        redrawFn = () => drawActive();

        // Animate setup move
        drawBoard(board, cache, headerInfo, '', playBar, [], [], flipped);
        await sleep(MOVE_DELAY);

        const setupSan = applyUCIMove(game, setupMove);
        board = parseFEN(game.fen());
        headerInfo.setupSan = setupSan ?? setupMove;
        const setupHL: SquareHighlight[] = [
          { rank: setupCoords.from.rank, file: setupCoords.from.file, color: OPPONENT_COLOR },
          { rank: setupCoords.to.rank, file: setupCoords.to.file, color: OPPONENT_COLOR },
        ];
        message = `Opponent plays: ${BOLD}${setupSan ?? setupMove}${RESET}`;
        drawBoard(board, cache, headerInfo, message, playBar, setupHL, [], flipped);
        await sleep(MOVE_DELAY);

        message = '';
        drawActive();

        // Main play loop
        while (moveIndex < puzzle.moves.length) {
          const expectedMove = puzzle.moves[moveIndex];
          const key = await waitForInput();

          if (key.type === 'quit') break gameLoop;

          if (key.type === 'hint') {
            if (hintLevel < 3) {
              hintLevel++;
              stats.recordHint();
            }
            drawActive();
            continue;
          }

          if (key.type === 'skip') {
            stats.recordSkip();
            if (adaptive) adaptive.recordFail();

            // Animate remaining solution moves
            for (let i = moveIndex; i < puzzle.moves.length; i++) {
              const uci = puzzle.moves[i];
              const coords = uciToCoords(uci);
              const san = applyUCIMove(game, uci);
              board = parseFEN(game.fen());
              const isPlayer = i % 2 === 1;
              const color = isPlayer ? CORRECT_COLOR : OPPONENT_COLOR;
              const hl: SquareHighlight[] = [
                { rank: coords.from.rank, file: coords.from.file, color },
                { rank: coords.to.rank, file: coords.to.file, color },
              ];
              message = `Solution: ${BOLD}${san ?? uci}${RESET}  ${DIM}(${i - moveIndex + 1}/${puzzle.moves.length - moveIndex})${RESET}`;
              drawBoard(board, cache, headerInfo, message, playBar, hl, [], flipped);
              await sleep(SOLUTION_DELAY);
            }

            moveIndex = puzzle.moves.length;

            // Enter review mode
            headerInfo.streakText = stats.formatForHeader();
            const history = buildMoveHistory(puzzle);
            const result = await reviewMode(history, cache, headerInfo, waitForInput, flipped, true);
            if (result === 'quit') break gameLoop;
            if (result === 'retry') { retrying = true; break; }
            break; // next puzzle
          }

          if (key.type === 'arrow') {
            const dir = key.direction;
            if (flipped) {
              if (dir === 'up' && cursorRank < 7) cursorRank++;
              if (dir === 'down' && cursorRank > 0) cursorRank--;
              if (dir === 'left' && cursorFile < 7) cursorFile++;
              if (dir === 'right' && cursorFile > 0) cursorFile--;
            } else {
              if (dir === 'up' && cursorRank > 0) cursorRank--;
              if (dir === 'down' && cursorRank < 7) cursorRank++;
              if (dir === 'left' && cursorFile > 0) cursorFile--;
              if (dir === 'right' && cursorFile < 7) cursorFile++;
            }
            if (selectedSquare) {
              message = `${toAlgebraic(selectedSquare.rank, selectedSquare.file)} → ${toAlgebraic(cursorRank, cursorFile)}`;
            } else {
              message = '';
            }
            drawActive();
            continue;
          }

          if (key.type === 'escape') {
            if (selectedSquare) {
              selectedSquare = null;
              message = 'Selection cancelled.';
              drawActive();
            }
            continue;
          }

          if (key.type === 'enter') {
            if (!selectedSquare) {
              const piece = board[cursorRank][cursorFile];
              if (piece) {
                const isWhitePiece = piece.startsWith('white_');
                if ((playerIsWhite && isWhitePiece) || (!playerIsWhite && !isWhitePiece)) {
                  selectedSquare = { rank: cursorRank, file: cursorFile };
                  message = `Selected ${toAlgebraic(cursorRank, cursorFile)}`;
                  drawActive();
                } else {
                  message = "That's not your piece!";
                  drawActive();
                }
              } else {
                message = 'Empty square.';
                drawActive();
              }
            } else {
              const fromSq = toAlgebraic(selectedSquare.rank, selectedSquare.file);
              const toSq = toAlgebraic(cursorRank, cursorFile);
              let fullUCI = fromSq + toSq;

              const piece = board[selectedSquare.rank][selectedSquare.file];
              const isPawn = piece && (piece === 'white_pawn' || piece === 'black_pawn');
              const isPromoRank = (playerIsWhite && cursorRank === 0) || (!playerIsWhite && cursorRank === 7);
              if (isPawn && isPromoRank) {
                fullUCI += expectedMove.length > 4 ? expectedMove[4] : 'q';
              }

              if (fullUCI === expectedMove) {
                // Correct
                const moveCoords = uciToCoords(fullUCI);
                const san = applyUCIMove(game, fullUCI);
                selectedSquare = null;
                moveIndex++;
                hintLevel = 0;
                board = parseFEN(game.fen());

                const correctHL: SquareHighlight[] = [
                  { rank: moveCoords.from.rank, file: moveCoords.from.file, color: CORRECT_COLOR },
                  { rank: moveCoords.to.rank, file: moveCoords.to.file, color: CORRECT_COLOR },
                ];
                message = `${BOLD}${GREEN_FG}Correct!${RESET} ${san}`;
                drawBoard(board, cache, headerInfo, message, playBar, correctHL, [], flipped);
                await sleep(MOVE_DELAY);

                if (moveIndex >= puzzle.moves.length) {
                  // Puzzle solved!
                  stats.recordSolve();
                  if (adaptive) adaptive.recordSolve();
                  headerInfo.streakText = stats.formatForHeader();

                  // Success flash
                  message = `${BOLD}${GREEN_FG}Puzzle solved!${RESET}`;
                  drawBoard(board, cache, headerInfo, message, playBar, correctHL, [], flipped, true);
                  await sleep(SUCCESS_FLASH);

                  // Enter review mode
                  const history = buildMoveHistory(puzzle);
                  const result = await reviewMode(history, cache, headerInfo, waitForInput, flipped, true);
                  if (result === 'quit') break gameLoop;
                  if (result === 'retry') { retrying = true; break; }
                  break; // next puzzle
                } else {
                  // Opponent response
                  const opMove = puzzle.moves[moveIndex];
                  const opCoords = uciToCoords(opMove);
                  const opSan = applyUCIMove(game, opMove);
                  moveIndex++;
                  board = parseFEN(game.fen());

                  const opHL: SquareHighlight[] = [
                    { rank: opCoords.from.rank, file: opCoords.from.file, color: OPPONENT_COLOR },
                    { rank: opCoords.to.rank, file: opCoords.to.file, color: OPPONENT_COLOR },
                  ];
                  message = `Opponent plays: ${BOLD}${opSan ?? opMove}${RESET}`;
                  drawBoard(board, cache, headerInfo, message, playBar, opHL, [], flipped);
                  await sleep(MOVE_DELAY);

                  if (moveIndex >= puzzle.moves.length) {
                    stats.recordSolve();
                    if (adaptive) adaptive.recordSolve();
                    headerInfo.streakText = stats.formatForHeader();

                    message = `${BOLD}${GREEN_FG}Puzzle solved!${RESET}`;
                    drawBoard(board, cache, headerInfo, message, playBar, opHL, [], flipped, true);
                    await sleep(SUCCESS_FLASH);

                    const history = buildMoveHistory(puzzle);
                    const result = await reviewMode(history, cache, headerInfo, waitForInput, flipped, true);
                    if (result === 'quit') break gameLoop;
                    if (result === 'retry') { retrying = true; break; }
                    break;
                  } else {
                    message = '';
                    drawActive();
                  }
                }
              } else {
                // Wrong
                stats.recordWrong();
                puzzleHadWrong = true;
                const wrongHL: SquareHighlight[] = [
                  { rank: cursorRank, file: cursorFile, color: WRONG_COLOR },
                ];
                message = `${BOLD}${RED_FG}Wrong — try again.${RESET}`;
                drawBoard(board, cache, headerInfo, message, playBar, wrongHL, [], flipped);
                await sleep(FLASH_DELAY);

                selectedSquare = null;
                headerInfo.streakText = stats.formatForHeader();
                drawActive();
              }
            }
          }
        }

        if (retrying) {
          // Reset for retry — stats already recorded
          hintLevel = 0;
        }
      }
    }
  } finally {
    cleanup();
    process.stdout.write(SHOW_CURSOR + '\n');
    stats.printSummary();
  }
}
