import Phaser from 'phaser';
import { ASSET_BASE, ATLAS, IMAGES, PLAYER_ANIMS, SPRITESHEETS } from '../assets';
import { bridge } from '../events';
import { audio } from '../systems/Audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    void audio.prefetch().catch(() => undefined);
    this.load.setPath(ASSET_BASE);
    for (const [key, file] of Object.entries(IMAGES)) this.load.image(key, file);
    for (const [key, s] of Object.entries(SPRITESHEETS)) {
      this.load.spritesheet(key, s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    this.load.atlas(ATLAS.key, ATLAS.image, ATLAS.json);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => bridge.emit('progress', p));
  }

  create(): void {
    for (const [key, a] of Object.entries(PLAYER_ANIMS)) {
      this.anims.create({
        key,
        frames: a.frames.map((frame) => ({ key: ATLAS.key, frame })),
        frameRate: a.fps,
        repeat: a.repeat,
      });
    }
    this.anims.create({ key: 'coinSpin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'sparkle', frames: this.anims.generateFrameNumbers('sparkle', { start: 0, end: 3 }), frameRate: 18, repeat: 0 });
    this.anims.create({ key: 'pigeons', frames: this.anims.generateFrameNumbers('obs_pigeons', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
    this.scene.start('run');
  }
}
