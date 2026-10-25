import { OBSTACLES, ObstacleAction, ObstacleDef } from '../assets';
import { GROUND_Y, PHYSICS } from '../config';
import type { Box } from './Player';

/**
 * Procedural level generator. It always knows the *next* pattern before placing the
 * current one, so the gap between them is computed from the actions involved
 * (jump→slide needs more room than jump→jump) and the current speed. That keeps every
 * sequence possible, while the random extra spacing shrinks with difficulty.
 */

export interface PlacedObstacle {
  def: ObstacleDef;
  x: number; // left edge (screen px)
}

export interface PlacedCoin {
  x: number; // centre
  y: number; // centre
}

interface Pattern {
  items: { def: ObstacleDef; dx: number }[];
  width: number;
  first: ObstacleAction;
  last: ObstacleAction;
  firstOwnSpeed: number;
}

const AIR_TIME = (2 * PHYSICS.jumpVelocity) / PHYSICS.gravity;
const T_APEX = PHYSICS.jumpVelocity / PHYSICS.gravity;

/** minimum seconds between the end of one obstacle and the start of the next */
const SAFE_TIME: Record<ObstacleAction, Record<ObstacleAction, number>> = {
  jump: { jump: 0.62, slide: 0.82 },
  slide: { jump: 0.52, slide: 0.36 },
};

const byKey = (k: string) => OBSTACLES.find((o) => o.key === k)!;
const LOW_SMALL = ['obs_cone', 'obs_box', 'obs_lixeira'].map(byKey);

export class Spawner {
  private rng: () => number;
  private next: Pattern | null = null;
  distToNext = 0;
  spawned = 0;

  constructor(seed = Date.now()) {
    let s = seed >>> 0 || 1;
    this.rng = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  reset(): void {
    this.next = null;
    this.distToNext = 0;
    this.spawned = 0;
  }

  /** difficulty 0..1 from seconds of running */
  static level(t: number): number {
    return Math.min(1, Math.max(0, (t - 6) / 150));
  }

  private pick<T extends { weight: number }>(list: T[]): T {
    const total = list.reduce((a, b) => a + b.weight, 0);
    let r = this.rng() * total;
    for (const it of list) {
      r -= it.weight;
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  }

  private makePattern(t: number, speed: number): Pattern {
    const level = Spawner.level(t);
    const tutorial = t < 14;
    let pool = OBSTACLES.filter((o) => o.minLevel <= level);
    if (tutorial) pool = pool.filter((o) => o.action === 'jump' && o.key !== 'obs_box2');
    // overhead obstacles only after the player had time to learn jumping
    if (t < 16) pool = pool.filter((o) => o.action === 'jump');

    const r = this.rng();
    // two small obstacles cleared by one jump
    if (!tutorial && level > 0.3 && r < 0.18) {
      const a = LOW_SMALL[Math.floor(this.rng() * LOW_SMALL.length)];
      const b = LOW_SMALL[Math.floor(this.rng() * LOW_SMALL.length)];
      const span = speed * 0.42 * 0.75 - 22; // horizontal room while above 30 px
      const gap = Math.max(4, Math.min(14, span - a.w - b.w));
      if (a.w + gap + b.w <= span) {
        return { items: [{ def: a, dx: 0 }, { def: b, dx: a.w + gap }], width: a.w + gap + b.w, first: 'jump', last: 'jump', firstOwnSpeed: 0 };
      }
    }
    // tunnel: two overhead obstacles in a row (keep sliding)
    if (!tutorial && level > 0.45 && r > 0.88) {
      const tops = OBSTACLES.filter((o) => o.action === 'slide' && !o.ownSpeed);
      const a = tops[Math.floor(this.rng() * tops.length)];
      const b = tops[Math.floor(this.rng() * tops.length)];
      const gap = 18 + Math.floor(this.rng() * 18);
      return { items: [{ def: a, dx: 0 }, { def: b, dx: a.w + gap }], width: a.w + gap + b.w, first: 'slide', last: 'slide', firstOwnSpeed: 0 };
    }
    const def = this.pick(pool);
    return { items: [{ def, dx: 0 }], width: def.w, first: def.action, last: def.action, firstOwnSpeed: def.ownSpeed ?? 0 };
  }

  /**
   * Called when distToNext <= 0. Returns what to create, positioned from `spawnX`.
   */
  spawn(t: number, speed: number, spawnX: number): { obstacles: PlacedObstacle[]; coins: PlacedCoin[] } {
    const cur = this.next ?? this.makePattern(t, speed);
    const nxt = this.makePattern(t, speed);
    this.next = nxt;
    this.spawned++;

    const obstacles: PlacedObstacle[] = cur.items.map((it) => ({ def: it.def, x: spawnX + it.dx }));

    // gap until the next pattern
    const level = Spawner.level(t);
    const tutorial = t < 14;
    const v = speed * 1.04;
    const safe = SAFE_TIME[cur.last][nxt.first];
    const extraBase = tutorial ? 1.5 : 1.05 - 0.85 * level;
    const extraRand = this.rng() * (tutorial ? 0.8 : 0.7 - 0.4 * level);
    const approach = v + nxt.firstOwnSpeed; // pigeons close the distance faster
    const gap = safe * approach + (extraBase + extraRand) * approach;
    this.distToNext = cur.width + gap;

    // ---- coins
    const coins: PlacedCoin[] = [];
    const boxes = obstacles.map((o) => obstacleHitbox(o.def, o.x));
    const tryAdd = (x: number, y: number) => {
      const cb = { x: x - 7, y: y - 7, w: 14, h: 14 };
      if (boxes.some((b) => overlap(cb, inflate(b, 4)))) return;
      coins.push({ x, y });
    };

    const single = cur.items.length === 1 ? cur.items[0].def : null;
    const roll = this.rng();
    if (single && single.action === 'jump' && roll < 0.5) {
      // arc that follows the real jump trajectory: teaches when to jump
      const cx = spawnX + single.w / 2;
      for (let k = -3; k <= 3; k++) {
        const tt = T_APEX + k * 0.075;
        const h = PHYSICS.jumpVelocity * tt - 0.5 * PHYSICS.gravity * tt * tt;
        tryAdd(cx + speed * (tt - T_APEX), GROUND_Y - h - 28);
      }
    } else if (cur.first === 'slide' && !cur.firstOwnSpeed && roll < 0.55) {
      const n = Math.max(3, Math.round(cur.width / 18));
      for (let k = 0; k < n; k++) tryAdd(spawnX + 8 + (k * (cur.width - 16)) / Math.max(1, n - 1), GROUND_Y - 14);
    }
    // coins in the free gap after the pattern
    const free0 = spawnX + cur.width + 60;
    const free1 = spawnX + this.distToNext - 70;
    if (free1 - free0 > 90 && this.rng() < 0.55) {
      const n = Math.min(6, Math.floor((free1 - free0) / 20));
      const high = this.rng() < 0.3 && t > 8;
      const start = free0 + (free1 - free0 - (n - 1) * 20) / 2;
      for (let k = 0; k < n; k++) {
        const y = high ? GROUND_Y - 62 - Math.round(Math.sin((k / Math.max(1, n - 1)) * Math.PI) * 10) : GROUND_Y - 24;
        tryAdd(start + k * 20, y);
      }
    }
    return { obstacles, coins };
  }
}

export function obstacleHitbox(def: ObstacleDef, x: number): Box {
  const top = GROUND_Y + def.bottom - def.h;
  return { x: x + def.hit.x, y: top + def.hit.y, w: def.hit.w, h: def.hit.h };
}

export function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function inflate(b: Box, m: number): Box {
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m };
}

export { AIR_TIME };
