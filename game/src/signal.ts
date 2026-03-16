import { readFileSync, writeFileSync } from 'fs';

export type SignalState = 'paused' | 'resume' | 'none';

export function readSignal(signalFile: string | undefined): SignalState {
  if (!signalFile) return 'none';
  try {
    const content = readFileSync(signalFile, 'utf-8').trim();
    if (content === 'paused' || content === 'resume') return content;
    return 'none';
  } catch {
    return 'none';
  }
}

export function writePidFile(pidFile: string): void {
  writeFileSync(pidFile, String(process.pid));
}
