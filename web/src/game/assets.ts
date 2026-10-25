// Asset manifest. Every image lives in public/assets and can be swapped for new art
// with the same file name; sizes/hitboxes for obstacles are declared below.

export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

export const IMAGES: Record<string, string> = {
  sky: 'sky.png',
  clouds: 'clouds.png',
  far: 'far.png',
  mid: 'mid.png',
  road: 'road.png',
  sidewalk: 'sidewalk.png',
  props: 'props.png',
  bus_a: 'bus_a.png',
  bus_b: 'bus_b.png',
  obs_cone: 'obs_cone.png',
  obs_box: 'obs_box.png',
  obs_box2: 'obs_box2.png',
  obs_barrier: 'obs_barrier.png',
  obs_lixeira: 'obs_lixeira.png',
  obs_hole: 'obs_hole.png',
  obs_sign: 'obs_sign.png',
  obs_beam: 'obs_beam.png',
  obs_awning: 'obs_awning.png',
  dust: 'dust.png',
  pixel: 'pixel.png',
  impact: 'impact.png',
  shadow: 'shadow.png',
  shadow_hazard: 'shadow_hazard.png',
};

export const SPRITESHEETS: Record<string, { file: string; frameWidth: number; frameHeight: number }> = {
  coin: { file: 'coin.png', frameWidth: 12, frameHeight: 12 },
  sparkle: { file: 'sparkle.png', frameWidth: 9, frameHeight: 9 },
  obs_pigeons: { file: 'obs_pigeons.png', frameWidth: 48, frameHeight: 22 },
};

export const ATLAS = { key: 'samuca', image: 'samuca.png', json: 'samuca.json' };

/** Samuca's frames are 84x72 with the feet at (46, 70). */
export const PLAYER_ORIGIN = { x: 46 / 84, y: 70 / 72 };

/** animation name -> [frame prefix, frame count, fps, repeat] */
export const PLAYER_ANIMS: Record<string, { frames: string[]; fps: number; repeat: number }> = {
  idle: { frames: ['idle_0', 'idle_1', 'idle_0', 'idle_2', 'idle_0', 'idle_3'], fps: 3, repeat: -1 },
  run: { frames: Array.from({ length: 10 }, (_, i) => `run_${i}`), fps: 16, repeat: -1 },
  jump: { frames: ['jump_0', 'jump_1', 'jump_2', 'jump_3'], fps: 14, repeat: 0 },
  fall: { frames: ['fall_0', 'fall_1', 'fall_2'], fps: 8, repeat: 0 },
  land: { frames: ['land_0'], fps: 20, repeat: 0 },
  slideIn: { frames: ['slide_0', 'slide_1'], fps: 20, repeat: 0 },
  slide: { frames: ['slide_2', 'slide_3'], fps: 7, repeat: -1 },
  slideOut: { frames: ['slide_4'], fps: 16, repeat: 0 },
  coin: { frames: ['coin_0', 'coin_1', 'coin_2'], fps: 14, repeat: 0 },
  trip: { frames: ['trip_0', 'trip_1', 'trip_2', 'trip_3'], fps: 10, repeat: 0 },
  cheer: { frames: ['cheer_0', 'cheer_1', 'cheer_2', 'cheer_3', 'cheer_4', 'cheer_5'], fps: 6, repeat: -1 },
};

export type ObstacleAction = 'jump' | 'slide';

export interface ObstacleDef {
  key: string;
  action: ObstacleAction;
  w: number;
  h: number;
  /** hitbox relative to the sprite's top-left */
  hit: { x: number; y: number; w: number; h: number };
  /** y of the sprite's bottom edge relative to GROUND_Y (positive = lower) */
  bottom: number;
  /** extra own speed (px/s) on top of the scroll — pigeons fly toward the player */
  ownSpeed?: number;
  animated?: boolean;
  /** draw a soft shadow on the ground under it (overhead obstacles) */
  groundShadow?: boolean;
  minLevel: number;
  weight: number;
}

const OVER = -51; // overhead sprites end 51 px above the ground (solid down to 47 px)

export const OBSTACLES: ObstacleDef[] = [
  { key: 'obs_cone', action: 'jump', w: 18, h: 24, hit: { x: 4, y: 4, w: 10, h: 20 }, bottom: 1, minLevel: 0, weight: 3 },
  { key: 'obs_box', action: 'jump', w: 26, h: 21, hit: { x: 3, y: 3, w: 20, h: 18 }, bottom: 1, minLevel: 0, weight: 3 },
  { key: 'obs_lixeira', action: 'jump', w: 18, h: 30, hit: { x: 2, y: 2, w: 14, h: 28 }, bottom: 1, minLevel: 0, weight: 2 },
  { key: 'obs_hole', action: 'jump', w: 40, h: 10, hit: { x: 9, y: 4, w: 22, h: 6 }, bottom: 4, minLevel: 0.08, weight: 2 },
  { key: 'obs_barrier', action: 'jump', w: 38, h: 28, hit: { x: 3, y: 5, w: 32, h: 23 }, bottom: 1, minLevel: 0.15, weight: 2 },
  { key: 'obs_box2', action: 'jump', w: 26, h: 41, hit: { x: 4, y: 3, w: 18, h: 38 }, bottom: 1, minLevel: 0.25, weight: 2 },
  { key: 'obs_sign', action: 'slide', w: 60, h: 220, hit: { x: 3, y: 0, w: 54, h: 224 }, bottom: OVER, groundShadow: true, minLevel: 0.12, weight: 3 },
  { key: 'obs_awning', action: 'slide', w: 64, h: 220, hit: { x: 2, y: 0, w: 60, h: 224 }, bottom: OVER, groundShadow: true, minLevel: 0.2, weight: 2 },
  { key: 'obs_beam', action: 'slide', w: 76, h: 220, hit: { x: 2, y: 0, w: 72, h: 224 }, bottom: OVER, groundShadow: true, minLevel: 0.3, weight: 2 },
  { key: 'obs_pigeons', action: 'slide', w: 48, h: 22, hit: { x: 4, y: 2, w: 40, h: 24 }, bottom: OVER + 2, ownSpeed: 50, animated: true, groundShadow: true, minLevel: 0.4, weight: 2 },
];
