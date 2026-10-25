// Tiny typed event bridge between the Phaser game and the React interface.

export type GameState = 'loading' | 'title' | 'playing' | 'paused' | 'over';

export interface HudData {
  score: number;
  coins: number;
  best: number;
}

export interface OverData extends HudData {
  newRecord: boolean;
}

type Events = {
  state: GameState;
  hud: HudData;
  over: OverData;
  record: number;
  progress: number;
  'cmd:start': void;
  'cmd:pause': void;
  'cmd:resume': void;
  'cmd:title': void;
};

type Handler<T> = (payload: T) => void;

class Bridge {
  private map = new Map<keyof Events, Set<Handler<any>>>();

  on<K extends keyof Events>(ev: K, fn: Handler<Events[K]>): () => void {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }

  emit<K extends keyof Events>(ev: K, ...payload: Events[K] extends void ? [] : [Events[K]]): void {
    this.map.get(ev)?.forEach((fn) => fn(payload[0]));
  }
}

export const bridge = new Bridge();
