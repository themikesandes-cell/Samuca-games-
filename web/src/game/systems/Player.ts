import Phaser from 'phaser';
import { ATLAS, PLAYER_ORIGIN } from '../assets';
import { GROUND_Y, HITBOX, PHYSICS, PLAYER_X } from '../config';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Pose = 'run' | 'jump' | 'fall' | 'slide' | 'dead' | 'idle';

/**
 * Samuca: deterministic platformer physics stepped at a fixed rate by the scene.
 * Height is measured in px above the ground (up = positive).
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  height = 0;
  vy = 0;
  onGround = true;
  sliding = false;
  dead = false;

  private slideWanted = false;
  private slideTime = 0;
  private coyote = 0;
  private buffer = 0;
  private jumpTime = 0;
  private canCut = false;
  private pendingCut = false;
  private landTimer = 0;
  private slideOutTimer = 0;
  private pose: Pose = 'idle';

  /** set by the scene: return false when an overhead obstacle prevents standing up */
  canStand: () => boolean = () => true;
  onJump: () => void = () => {};
  onLand: (impact: number) => void = () => {};
  onSlide: () => void = () => {};

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(PLAYER_X, GROUND_Y + 1, 'shadow').setOrigin(0.5, 0.5).setDepth(19);
    this.sprite = scene.add
      .sprite(PLAYER_X, GROUND_Y, ATLAS.key, 'idle_0')
      .setOrigin(PLAYER_ORIGIN.x, PLAYER_ORIGIN.y)
      .setDepth(20);
  }

  reset(): void {
    this.height = 0;
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideWanted = false;
    this.dead = false;
    this.coyote = 0;
    this.buffer = 0;
    this.pendingCut = false;
    this.landTimer = 0;
    this.slideOutTimer = 0;
    this.pose = 'idle';
    this.sprite.setAngle(0);
    this.sprite.setPosition(PLAYER_X, GROUND_Y);
    this.play('run');
    this.pose = 'run';
  }

  // ------------------------------------------------------------------ input
  /** keyboard or tap: request a jump (buffered). `variable` = may be cut short on release */
  pressJump(variable: boolean): void {
    if (this.dead) return;
    this.buffer = PHYSICS.jumpBuffer;
    this.canCut = variable;
  }

  releaseJump(): void {
    if (this.canCut && this.vy > 0) this.pendingCut = true;
  }

  setSlide(on: boolean): void {
    if (this.dead) return;
    this.slideWanted = on;
  }

  // ------------------------------------------------------------------ simulation
  step(dt: number): void {
    if (this.dead) {
      if (!this.onGround) {
        this.vy -= PHYSICS.gravity * dt;
        this.height += this.vy * dt;
        if (this.height <= 0) {
          this.height = 0;
          this.vy = 0;
          this.onGround = true;
        }
      }
      return;
    }

    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.onGround ? PHYSICS.coyoteTime : Math.max(0, this.coyote - dt);

    // start a jump (buffer + coyote time)
    if (this.buffer > 0 && this.coyote > 0) {
      this.buffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.vy = PHYSICS.jumpVelocity;
      this.jumpTime = 0;
      this.pendingCut = false;
      if (this.sliding) this.sliding = false;
      this.onJump();
    }

    if (!this.onGround) {
      this.jumpTime += dt;
      // variable jump height (keyboard): cut, but never below a useful minimum hop
      if (this.pendingCut && this.jumpTime >= 0.1) {
        if (this.vy > 0) this.vy *= PHYSICS.jumpCutFactor;
        this.pendingCut = false;
      }
      const g = this.slideWanted ? PHYSICS.fastFallGravity : PHYSICS.gravity;
      this.vy = Math.max(-PHYSICS.maxFall, this.vy - g * dt);
      this.height += this.vy * dt;
      if (this.height <= 0) {
        const impact = -this.vy;
        this.height = 0;
        this.vy = 0;
        this.onGround = true;
        this.landTimer = 0.07;
        this.onLand(impact);
      }
    }

    // slide state
    if (this.onGround) {
      if (this.slideWanted && !this.sliding) {
        this.sliding = true;
        this.slideTime = 0;
        this.onSlide();
      } else if (this.sliding) {
        this.slideTime += dt;
        const minDone = this.slideTime >= 0.22;
        if (!this.slideWanted && minDone && this.canStand()) {
          this.sliding = false;
          this.slideOutTimer = 0.07;
        }
      }
    } else if (this.sliding) {
      this.sliding = false;
    }

    this.landTimer = Math.max(0, this.landTimer - dt);
    this.slideOutTimer = Math.max(0, this.slideOutTimer - dt);
  }

  /** current hitbox in screen space */
  hitbox(): Box {
    const hb = this.sliding ? HITBOX.slide : this.onGround ? HITBOX.run : HITBOX.jump;
    const footY = GROUND_Y - this.height;
    return { x: PLAYER_X + hb.x, y: footY + hb.y, w: hb.w, h: hb.h };
  }

  /** hitbox Samuca would have standing up (to know if he can leave the slide) */
  standingBox(): Box {
    const hb = HITBOX.run;
    return { x: PLAYER_X + hb.x, y: GROUND_Y + hb.y, w: hb.w, h: hb.h };
  }

  // ------------------------------------------------------------------ visuals
  render(speedFactor: number): void {
    const footY = GROUND_Y - this.height;
    this.sprite.setPosition(PLAYER_X, Math.round(footY));
    const s = Math.max(0.45, 1 - this.height / 140);
    this.shadow.setScale(s, 1).setAlpha(0.35 + 0.65 * s);

    if (this.dead) return;
    let pose: Pose;
    if (!this.onGround) pose = this.vy > 0 ? 'jump' : 'fall';
    else if (this.sliding) pose = 'slide';
    else pose = 'run';

    if (pose !== this.pose) {
      const prev = this.pose;
      this.pose = pose;
      if (pose === 'jump') this.play('jump');
      else if (pose === 'fall') this.play('fall');
      else if (pose === 'slide') {
        this.play('slideIn');
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (this.pose === 'slide') this.play('slide');
        });
      } else if (pose === 'run') {
        if (prev === 'fall' || prev === 'jump') this.play('land');
        else if (prev === 'slide') this.play('slideOut');
        else this.play('run');
      }
    }
    if (pose === 'run') {
      const cur = this.sprite.anims.currentAnim?.key;
      if ((cur === 'land' && this.landTimer <= 0) || (cur === 'slideOut' && this.slideOutTimer <= 0)) this.play('run');
      if (this.sprite.anims.currentAnim?.key === 'run') this.sprite.anims.timeScale = Phaser.Math.Clamp(speedFactor, 0.8, 1.7);
    } else {
      this.sprite.anims.timeScale = 1;
    }
  }

  die(): void {
    this.dead = true;
    this.sliding = false;
    this.pose = 'dead';
    this.sprite.anims.timeScale = 1;
    this.play('trip');
    if (this.height > 0 && this.vy > 0) this.vy *= 0.3;
  }

  idle(anim: 'idle' | 'run' | 'cheer' = 'run'): void {
    this.pose = 'idle';
    this.height = 0;
    this.vy = 0;
    this.onGround = true;
    this.sprite.setPosition(PLAYER_X, GROUND_Y);
    this.play(anim);
  }

  private play(key: string): void {
    this.sprite.anims.play(key, true);
  }
}
