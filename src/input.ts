export type KeyPress =
  | { type: 'arrow'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'quit' }
  | { type: 'skip' }
  | { type: 'hint' }
  | { type: 'retry' }
  | { type: 'other'; raw: Buffer };

/**
 * Enable raw mode and return a function to wait for individual keypresses.
 * Call cleanup() when done to restore terminal state.
 */
export function createKeyReader(): {
  readKey: () => Promise<KeyPress>;
  cleanup: () => void;
} {
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');

  // Queue of pending key data
  let resolveNext: ((key: KeyPress) => void) | null = null;
  const queue: KeyPress[] = [];

  function parseKey(data: string): KeyPress {
    // Arrow keys: ESC [ A/B/C/D
    if (data === '\x1b[A') return { type: 'arrow', direction: 'up' };
    if (data === '\x1b[B') return { type: 'arrow', direction: 'down' };
    if (data === '\x1b[C') return { type: 'arrow', direction: 'right' };
    if (data === '\x1b[D') return { type: 'arrow', direction: 'left' };

    // Enter
    if (data === '\r' || data === '\n') return { type: 'enter' };

    // Escape (bare, not part of arrow sequence)
    if (data === '\x1b') return { type: 'escape' };

    // Ctrl+C or 'q'
    if (data === '\x03' || data === 'q') return { type: 'quit' };

    // Skip
    if (data === 's') return { type: 'skip' };

    // Hint
    if (data === 'h') return { type: 'hint' };

    // Retry
    if (data === 'r') return { type: 'retry' };

    return { type: 'other', raw: Buffer.from(data) };
  }

  function onData(data: string) {
    const key = parseKey(data);
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(key);
    } else {
      queue.push(key);
    }
  }

  process.stdin.on('data', onData);

  function readKey(): Promise<KeyPress> {
    if (queue.length > 0) {
      return Promise.resolve(queue.shift()!);
    }
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  }

  function cleanup() {
    process.stdin.removeListener('data', onData);
    process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  }

  return { readKey, cleanup };
}
