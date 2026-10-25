// Central tuning for CORRE, SAMUCA! — every gameplay number lives here.

export const GAME_H = 288;
export const MIN_W = 480;
export const MAX_W = 680;

/** y of Samuca's feet / the running lane */
export const GROUND_Y = 262;
/** fixed horizontal position of Samuca's feet on screen */
export const PLAYER_X = 104;

/** layout of the scenery layers (top y of each layer) */
export const LAYOUT = {
  clouds: 6,
  farBottom: 212,
  midBottom: 214,
  road: 210,
  sidewalk: 236,
  propsBottom: 246,
  busBottom: 238,
};

/** parallax factors relative to the running speed */
export const PARALLAX = {
  clouds: 0.04,
  far: 0.14,
  mid: 0.34,
  road: 0.9,
  ground: 1,
};

export const PHYSICS = {
  step: 1 / 120, // fixed simulation step (s): same feel at 30, 60 or 120 fps
  gravity: 1900,
  jumpVelocity: 548, // ≈ 79 px apex, 0.58 s air time
  jumpCutFactor: 0.55, // keyboard: releasing early cuts the jump
  fastFallGravity: 5200, // pressing slide in the air
  maxFall: 900,
  coyoteTime: 0.09,
  jumpBuffer: 0.13,
};

export const INPUT = {
  holdMs: 190, // touch: shorter = jump, longer = slide
  swipePx: 18,
};

export const SPEED = {
  start: 250,
  max: 560,
  tau: 95, // seconds — speed approaches max with an exponential curve
};

/** hitboxes relative to the feet point (x right, y up => negative is up) */
export const HITBOX = {
  run: { x: -10, y: -54, w: 21, h: 54 },
  jump: { x: -10, y: -52, w: 21, h: 46 },
  slide: { x: -24, y: -38, w: 46, h: 38 },
};

/** overhead obstacles: everything above this height (px above ground) is solid */
export const OVERHEAD_CLEARANCE = 47;

export const SCORE = {
  pxPerPoint: 12,
  coinValue: 5,
};

export const STORAGE_KEYS = {
  best: 'samuca.best',
  music: 'samuca.music',
  sfx: 'samuca.sfx',
};
