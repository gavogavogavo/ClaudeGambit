export type KeyPress =
  | { type: 'arrow'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'quit' }
  | { type: 'skip' }
  | { type: 'hint' }
  | { type: 'retry' }
  | { type: 'other'; raw: Buffer };

export function createKeyReader(): {
  readKey: () => Promise<KeyPress>;
  readKeyWithTimeout: (ms: number) => Promise<KeyPress | null>;
  cleanup: () => void;
} {
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');

  let resolveNext: ((key: KeyPress) => void) | null = null;
  const queue: KeyPress[] = [];

  function parseKey(data: string): KeyPress {
    if (data === '\x1b[A') return { type: 'arrow', direction: 'up' };
    if (data === '\x1b[B') return { type: 'arrow', direction: 'down' };
    if (data === '\x1b[C') return { type: 'arrow', direction: 'right' };
    if (data === '\x1b[D') return { type: 'arrow', direction: 'left' };
    if (data === '\r' || data === '\n') return { type: 'enter' };
    if (data === '\x1b') return { type: 'escape' };
    if (data === '\x03' || data === 'q') return { type: 'quit' };
    if (data === 's') return { type: 'skip' };
    if (data === 'h') return { type: 'hint' };
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

  function readKeyWithTimeout(ms: number): Promise<KeyPress | null> {
    if (queue.length > 0) {
      return Promise.resolve(queue.shift()!);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (resolveNext === wrappedResolve) {
          resolveNext = null;
        }
        resolve(null);
      }, ms);

      function wrappedResolve(key: KeyPress) {
        clearTimeout(timer);
        resolve(key);
      }

      resolveNext = wrappedResolve;
    });
  }

  function cleanup() {
    process.stdin.removeListener('data', onData);
    process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  }

  return { readKey, readKeyWithTimeout, cleanup };
}
