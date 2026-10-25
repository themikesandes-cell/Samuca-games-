import Phaser from 'phaser';
import { ObstacleDef } from '../assets';
import { GAME_H, GROUND_Y, INPUT, LAYOUT, PARALLAX, PHYSICS, PLAYER_X, SCORE, SPEED } from '../config';
import { bridge, GameState } from '../events';
import { storage } from '../storage';
import { audio } from '../systems/Audio';
import { Box, Player } from '../systems/Player';
import { inflate, obstacleHitbox, overlap, Spawner } from '../systems/Spawner';

interface Obstacle {
  def: ObstacleDef;
  x: number;
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Image;
}

interface Coin {
  x: number;
  y: number;
  spr: Phaser.GameObjects.Sprite;
}

interface Bus {
  x: number;
  img: Phaser.GameObjects.Image;
}

export class RunScene extends Phaser.Scene {
  private state: GameState = 'title';
  private player!: Player;
  private spawner = new Spawner();

  private layers: { ts: Phaser.GameObjects.TileSprite; factor: number; drift?: number }[] = [];
  private sky!: Phaser.GameObjects.TileSprite;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private buses: Bus[] = [];

  private speed = 0;
  private scroll = 0;
  private cloudDrift = 0;
  private runTime = 0;
  private distance = 0;
  private coinCount = 0;
  private best = 0;
  private bestAtStart = 0;
  private recordAnnounced = false;
  private lastHud = '';
  private acc = 0;
  private busTimer = 3;
  private dustTimer = 0;
  private sparkleTimer = 0;
  private inputLockUntil = 0;

  // touch gesture state
  private touchId: number | null = null;
  private touchStart = 0;
  private touchY = 0;
  private touchSliding = false;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private keySlide = false;

  // debug autopilot (?bot=1[&warp=4]) — plays with touch-like latency to prove patterns are fair
  private bot = new URLSearchParams(window.location.search).has('bot');
  private warp = Math.max(1, Number(new URLSearchParams(window.location.search).get('warp')) || 1);
  private botQueue: { at: number; fn: () => void }[] = [];
  private botBusy = new Set<Obstacle>();

  constructor() {
    super('run');
  }

  create(): void {
    this.best = storage.getBest();
    this.buildLayers();
    this.player = new Player(this);
    this.player.onJump = () => audio.jump();
    this.player.onSlide = () => {
      audio.slide();
      this.dustBurst(PLAYER_X + 14, GROUND_Y, 5, 1);
    };
    this.player.onLand = (impact) => {
      if (impact > 300) {
        audio.land();
        this.dustBurst(PLAYER_X, GROUND_Y, 6, 0);
      }
    };
    this.player.canStand = () => {
      const sb = this.player.standingBox();
      return !this.obstacles.some((o) => o.def.action === 'slide' && overlap(sb, obstacleHitbox(o.def, o.x)));
    };

    this.setupInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    const offs = [
      bridge.on('cmd:start', () => this.startRun()),
      bridge.on('cmd:pause', () => this.pause()),
      bridge.on('cmd:resume', () => this.resume()),
      bridge.on('cmd:title', () => this.toTitle()),
    ];
    const onVis = () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause();
        audio.suspend();
      } else if (this.state !== 'paused') {
        audio.resume();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      document.removeEventListener('visibilitychange', onVis);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.toTitle();
  }

  // ------------------------------------------------------------------ scenery
  private buildLayers(): void {
    const W = this.scale.width;
    this.sky = this.add.tileSprite(0, 0, W, GAME_H, 'sky').setOrigin(0).setDepth(0);
    const add = (key: string, y: number, h: number, factor: number, depth: number, drift = 0) => {
      const ts = this.add.tileSprite(0, y, W, h, key).setOrigin(0).setDepth(depth);
      this.layers.push({ ts, factor, drift });
      return ts;
    };
    add('clouds', LAYOUT.clouds, 120, PARALLAX.clouds, 1, 6);
    add('far', LAYOUT.farBottom - 170, 170, PARALLAX.far, 2);
    add('mid', LAYOUT.midBottom - 200, 200, PARALLAX.mid, 3);
    add('road', LAYOUT.road, 26, PARALLAX.road, 4);
    add('sidewalk', LAYOUT.sidewalk, GAME_H - LAYOUT.sidewalk, PARALLAX.ground, 6);
    add('props', LAYOUT.propsBottom - 110, 110, PARALLAX.ground, 7);
  }

  private onResize(size: Phaser.Structs.Size): void {
    const W = size.width;
    this.sky.setSize(W, GAME_H);
    for (const l of this.layers) l.ts.setSize(W, l.ts.height);
    this.cameras.main.setSize(W, GAME_H);
  }

  private updateLayers(dt: number): void {
    this.cloudDrift += dt;
    for (const l of this.layers) {
      const off = this.scroll * l.factor + (l.drift ?? 0) * this.cloudDrift;
      l.ts.tilePositionX = Math.floor(off);
    }
  }

  // ------------------------------------------------------------------ input
  private setupInput(): void {
    this.input.addPointer(1);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      audio.unlock();
      if (this.state !== 'playing' || this.time.now < this.inputLockUntil) return;
      if (this.touchId !== null) return;
      this.touchId = p.id;
      this.touchStart = this.time.now;
      this.touchY = p.y;
      this.touchSliding = false;
      this.holdTimer?.remove();
      this.holdTimer = this.time.delayedCall(INPUT.holdMs, () => {
        if (this.touchId === p.id && !this.touchSliding) {
          this.touchSliding = true;
          this.player.setSlide(true);
        }
      });
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.touchId !== p.id || this.state !== 'playing') return;
      const dy = p.y - this.touchY;
      const scale = this.scale.displayScale.y || 1;
      const px = INPUT.swipePx * scale;
      if (!this.touchSliding && dy > px) {
        // swipe down = instant slide
        this.holdTimer?.remove();
        this.touchSliding = true;
        this.player.setSlide(true);
      } else if (!this.touchSliding && dy < -px && this.time.now - this.touchStart < INPUT.holdMs) {
        // swipe up = instant jump
        this.holdTimer?.remove();
        this.touchId = -1;
        this.player.pressJump(false);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (this.touchId === -1) {
        this.touchId = null;
        return;
      }
      if (this.touchId !== p.id) return;
      this.touchId = null;
      this.holdTimer?.remove();
      this.holdTimer = null;
      if (this.state !== 'playing') return;
      if (this.touchSliding) {
        this.player.setSlide(this.keySlide);
      } else if (this.time.now - this.touchStart < INPUT.holdMs + 40) {
        this.player.pressJump(false);
      }
      this.touchSliding = false;
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.addCapture('SPACE,UP,DOWN,W,S');
    kb.on('keydown', (e: KeyboardEvent) => {
      audio.unlock();
      const k = e.code;
      if (k === 'Enter' || k === 'NumpadEnter') {
        if (this.state === 'title' || this.state === 'over') bridge.emit('cmd:start');
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (k === 'KeyP' || k === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (this.state !== 'playing' || e.repeat) return;
      if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') this.player.pressJump(true);
      if (k === 'ArrowDown' || k === 'KeyS') {
        this.keySlide = true;
        this.player.setSlide(true);
      }
    });
    kb.on('keyup', (e: KeyboardEvent) => {
      const k = e.code;
      if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') this.player.releaseJump();
      if (k === 'ArrowDown' || k === 'KeyS') {
        this.keySlide = false;
        if (!this.touchSliding) this.player.setSlide(false);
      }
    });
  }

  // ------------------------------------------------------------------ state changes
  private setState(s: GameState): void {
    this.state = s;
    bridge.emit('state', s);
  }

  private clearWorld(): void {
    this.obstacles.forEach((o) => {
      o.img.destroy();
      o.shadow?.destroy();
    });
    this.coins.forEach((c) => c.spr.destroy());
    this.obstacles = [];
    this.coins = [];
  }

  private toTitle(): void {
    this.time.paused = false;
    this.clearWorld();
    this.anims.resumeAll();
    this.tweens.resumeAll();
    this.speed = 120;
    this.player.reset();
    this.player.idle('run');
    this.player.sprite.setVisible(false); // the big animated Samuca lives in the title menu
    this.player.shadow.setVisible(false);
    this.best = storage.getBest();
    audio.stopMusic();
    this.setState('title');
  }

  private startRun(): void {
    audio.unlock();
    this.time.paused = false;
    this.clearWorld();
    this.anims.resumeAll();
    this.tweens.resumeAll();
    this.cameras.main.resetFX();
    this.spawner.reset();
    this.spawner.distToNext = SPEED.start * 2.4; // first obstacle after ~2.4 s
    this.player.reset();
    this.player.sprite.setVisible(true);
    this.player.shadow.setVisible(true);
    this.speed = SPEED.start;
    this.runTime = 0;
    this.distance = 0;
    this.coinCount = 0;
    this.acc = 0;
    this.best = storage.getBest();
    this.bestAtStart = this.best;
    this.recordAnnounced = false;
    this.lastHud = '';
    this.touchId = null;
    this.touchSliding = false;
    this.keySlide = false;
    this.botQueue = [];
    this.botBusy.clear();
    this.inputLockUntil = this.time.now + 220; // the tap on JOGAR must not jump
    audio.stopMusic();
    if (audio.musicOn) audio.startMusic();
    this.setState('playing');
    this.emitHud(true);
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.anims.pauseAll();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.player.setSlide(false);
    this.touchId = null;
    audio.stopMusic();
    this.setState('paused');
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.anims.resumeAll();
    this.tweens.resumeAll();
    this.time.paused = false;
    this.acc = 0;
    this.inputLockUntil = this.time.now + 200;
    audio.unlock();
    if (audio.musicOn) audio.startMusic();
    this.setState('playing');
  }

  private gameOver(hit: Box): void {
    if (this.bot) {
      const near = this.obstacles.map((o) => `${o.def.key}@${Math.round(o.x)}`).join(',');
      console.log(`BOT_OVER t=${this.runTime.toFixed(1)} speed=${Math.round(this.speed)} slide=${this.player.sliding} h=${Math.round(this.player.height)} ${near}`);
    }
    this.player.die();
    this.speed = 0;
    audio.hit();
    audio.stopMusic();
    audio.gameOver();
    this.cameras.main.shake(200, 0.012);
    this.cameras.main.flash(90, 255, 255, 255);
    const ix = Phaser.Math.Clamp(hit.x, PLAYER_X - 6, PLAYER_X + 24);
    const pb = this.player.hitbox();
    const iy = Phaser.Math.Clamp(hit.y + hit.h / 2, pb.y + 4, pb.y + pb.h - 4);
    const star = this.add.image(ix, iy, 'impact').setDepth(30).setScale(0.4);
    this.tweens.add({ targets: star, scale: 1.2, alpha: 0, angle: 45, duration: 380, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    this.dustBurst(ix, iy, 10, 2);

    const score = this.currentScore();
    const newRecord = score > this.bestAtStart && this.bestAtStart > 0;
    if (score > this.bestAtStart) storage.setBest(score);
    this.best = Math.max(this.best, score);
    this.setState('over');
    this.time.delayedCall(950, () => {
      if (this.state === 'over') bridge.emit('over', { score, coins: this.coinCount, best: this.best, newRecord });
    });
  }

  // ------------------------------------------------------------------ main loop
  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);

    if (this.state === 'paused') return;

    if (this.state === 'title') {
      this.scroll += this.speed * dt;
      this.updateLayers(dt);
      this.updateBuses(dt);
      return;
    }

    if (this.state === 'playing') {
      this.acc += dt * this.warp;
      const step = PHYSICS.step;
      let n = 0;
      while (this.acc >= step && n < 16 * this.warp && this.state === 'playing') {
        this.fixedStep(step);
        this.acc -= step;
        n++;
      }
      this.runDust(dt);
      this.sparkleCoins(dt);
      this.emitHud(false);
    } else if (this.state === 'over') {
      this.player.step(dt); // let Samuca finish falling
      this.acc = 0;
    }

    this.updateLayers(dt);
    this.updateBuses(dt);
    this.player.render(this.speed / SPEED.start);
    for (const o of this.obstacles) {
      o.img.x = Math.round(o.x);
      if (o.shadow) o.shadow.x = Math.round(o.x + o.def.w / 2);
    }
    for (const c of this.coins) c.spr.setPosition(Math.round(c.x), Math.round(c.y));
  }

  private fixedStep(dt: number): void {
    this.runTime += dt;
    this.speed = SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-this.runTime / SPEED.tau));
    const move = this.speed * dt;
    this.scroll += move;
    this.distance += move;

    if (this.bot) this.botThink();
    this.player.step(dt);

    // spawn
    this.spawner.distToNext -= move;
    if (this.spawner.distToNext <= 0) {
      const spawnX = this.scale.width + 24;
      const { obstacles, coins } = this.spawner.spawn(this.runTime, this.speed, spawnX);
      obstacles.forEach((o) => this.addObstacle(o.def, o.x));
      coins.forEach((c) => this.addCoin(c.x, c.y));
    }

    // move world
    for (const o of this.obstacles) o.x -= move + (o.def.ownSpeed ?? 0) * dt;
    for (const c of this.coins) c.x -= move;
    this.obstacles = this.obstacles.filter((o) => {
      if (o.x + o.def.w < -40) {
        o.img.destroy();
        o.shadow?.destroy();
        return false;
      }
      return true;
    });
    this.coins = this.coins.filter((c) => {
      if (c.x < -20) {
        c.spr.destroy();
        return false;
      }
      return true;
    });

    // collisions
    const pb = this.player.hitbox();
    for (const o of this.obstacles) {
      const hb = obstacleHitbox(o.def, o.x);
      if (overlap(pb, hb)) {
        this.gameOver(hb);
        return;
      }
    }
    const grab = inflate(pb, 3);
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (overlap(grab, { x: c.x - 5, y: c.y - 5, w: 10, h: 10 })) {
        this.collectCoin(c);
        this.coins.splice(i, 1);
      }
    }

    // live record
    const score = this.currentScore();
    if (!this.recordAnnounced && this.bestAtStart > 0 && score > this.bestAtStart) {
      this.recordAnnounced = true;
      audio.record();
      bridge.emit('record', score);
    }
  }

  private botThink(): void {
    const now = this.runTime;
    this.botQueue = this.botQueue.filter((a) => {
      if (a.at <= now) {
        a.fn();
        return false;
      }
      return true;
    });
    const v = this.speed;
    for (const o of this.obstacles) {
      if (this.botBusy.has(o)) continue;
      const hb = obstacleHitbox(o.def, o.x);
      const rel = v + (o.def.ownSpeed ?? 0);
      const front = PLAYER_X + 11;
      const tArrive = (hb.x - front) / rel;
      if (tArrive < -0.5) continue;
      if (o.def.action === 'jump') {
        // a tap is ~90 ms long: decide so the apex lands over the obstacle centre
        const tCenter = (hb.x + hb.w / 2 - PLAYER_X) / rel;
        if (tCenter <= 0.288 + 0.09) {
          this.botBusy.add(o);
          this.botQueue.push({ at: now + 0.09, fn: () => this.player.pressJump(false) });
        }
      } else if (tArrive <= 0.19 + 0.12) {
        this.botBusy.add(o);
        this.botQueue.push({ at: now + 0.19, fn: () => this.player.setSlide(true) });
        const tLeave = (hb.x + hb.w - (PLAYER_X - 24)) / rel;
        this.botQueue.push({ at: now + tLeave + 0.02, fn: () => this.player.setSlide(false) });
      }
      break;
    }
  }

  private currentScore(): number {
    return Math.floor(this.distance / SCORE.pxPerPoint) + this.coinCount * SCORE.coinValue;
  }

  private emitHud(force: boolean): void {
    const score = this.currentScore();
    const best = Math.max(this.best, score);
    const key = `${score}|${this.coinCount}|${best}`;
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    bridge.emit('hud', { score, coins: this.coinCount, best });
  }

  // ------------------------------------------------------------------ objects
  private addObstacle(def: ObstacleDef, x: number): void {
    const top = GROUND_Y + def.bottom - def.h;
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (def.animated) {
      const s = this.add.sprite(Math.round(x), top, def.key, 0).setOrigin(0, 0);
      s.play('pigeons');
      img = s;
    } else {
      img = this.add.image(Math.round(x), top, def.key).setOrigin(0, 0);
    }
    img.setDepth(def.action === 'slide' ? 21 : 18);
    let shadow: Phaser.GameObjects.Image | undefined;
    if (def.groundShadow) {
      shadow = this.add
        .image(Math.round(x + def.w / 2), GROUND_Y + 1, 'shadow_hazard')
        .setDepth(9)
        .setScale((def.w + 8) / 40, 1.25);
    }
    this.obstacles.push({ def, x, img, shadow });
  }

  private addCoin(x: number, y: number): void {
    const spr = this.add.sprite(Math.round(x), Math.round(y), 'coin', 0).setDepth(17);
    spr.play({ key: 'coinSpin', startFrame: Math.floor(Math.random() * 8) });
    this.coins.push({ x, y, spr });
  }

  private collectCoin(c: Coin): void {
    this.coinCount++;
    audio.coin();
    const sp = this.add.sprite(Math.round(c.x), Math.round(c.y), 'sparkle', 0).setDepth(23).setScale(2);
    sp.play('sparkle');
    sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
    c.spr.stop();
    this.tweens.add({
      targets: c.spr,
      y: c.y - 14,
      scaleX: 0.2,
      scaleY: 1.4,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => c.spr.destroy(),
    });
  }

  private sparkleCoins(dt: number): void {
    this.sparkleTimer -= dt;
    if (this.sparkleTimer > 0 || this.coins.length === 0) return;
    this.sparkleTimer = 0.35;
    const c = this.coins[Math.floor(Math.random() * this.coins.length)];
    const sp = this.add.sprite(Math.round(c.x + 3), Math.round(c.y - 4), 'sparkle', 0).setDepth(18).setAlpha(0.9);
    sp.play('sparkle');
    const follow = () => sp.setX(Math.round(c.x + 3));
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
      sp.destroy();
    });
  }

  private updateBuses(dt: number): void {
    if (this.speed > 0) this.busTimer -= dt;
    if (this.busTimer <= 0) {
      this.busTimer = 7 + Math.random() * 9;
      const key = Math.random() < 0.5 ? 'bus_a' : 'bus_b';
      const img = this.add.image(this.scale.width + 10, LAYOUT.busBottom, key).setOrigin(0, 1).setDepth(5);
      this.buses.push({ x: this.scale.width + 10, img });
    }
    const v = this.speed * PARALLAX.road + (this.speed > 0 ? 70 : 0);
    this.buses = this.buses.filter((b) => {
      b.x -= v * dt;
      b.img.x = Math.round(b.x);
      if (b.x < -170) {
        b.img.destroy();
        return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------------ particles
  private runDust(dt: number): void {
    if (!this.player.onGround || this.player.dead || this.speed <= 0) return;
    this.dustTimer -= dt;
    if (this.dustTimer > 0) return;
    this.dustTimer = this.player.sliding ? 0.05 : 0.14;
    const x = PLAYER_X - 8 + (this.player.sliding ? 18 : 0);
    this.dustBurst(x, GROUND_Y - 1, 1, this.player.sliding ? 1 : 0);
  }

  /** style 0 = puff behind feet, 1 = slide spray, 2 = impact */
  private dustBurst(x: number, y: number, n: number, style: number): void {
    for (let i = 0; i < n; i++) {
      const key = style === 2 ? 'pixel' : 'dust';
      const p = this.add.image(Math.round(x), Math.round(y), key).setDepth(22).setAlpha(0.95);
      if (style === 2) p.setTint(Phaser.Display.Color.GetColor(255, 220 + Math.floor(Math.random() * 35), 120));
      const ang = style === 2 ? Math.random() * Math.PI * 2 : Math.PI + (Math.random() - 0.5) * 1.2;
      const dist = style === 2 ? 14 + Math.random() * 16 : 6 + Math.random() * 10;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist - (style === 2 ? 0 : 10),
        y: y - Math.abs(Math.sin(ang)) * (style === 2 ? dist : 6) - (style === 2 ? 0 : 2),
        alpha: 0,
        scale: style === 2 ? 1 : 0.5,
        duration: 260 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
