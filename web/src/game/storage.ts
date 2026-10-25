import { STORAGE_KEYS } from './config';

// localStorage can throw (Safari private mode, blocked storage): never let it break the game.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

let memoryBest = 0;

export const storage = {
  getBest(): number {
    const v = Number(read(STORAGE_KEYS.best));
    return Number.isFinite(v) && v > memoryBest ? Math.floor(v) : memoryBest;
  },
  setBest(v: number): void {
    memoryBest = Math.max(memoryBest, Math.floor(v));
    write(STORAGE_KEYS.best, String(memoryBest));
  },
  getFlag(key: 'music' | 'sfx', fallback = true): boolean {
    const v = read(STORAGE_KEYS[key]);
    return v === null ? fallback : v === '1';
  },
  setFlag(key: 'music' | 'sfx', on: boolean): void {
    write(STORAGE_KEYS[key], on ? '1' : '0');
  },
};
