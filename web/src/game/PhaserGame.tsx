import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { GAME_H, MAX_W, MIN_W } from './config';
import { BootScene } from './scenes/BootScene';
import { RunScene } from './scenes/RunScene';

/** game width follows the screen's aspect ratio so sprites are never stretched */
export function computeWidth(): number {
  const w = window.innerWidth || 960;
  const h = window.innerHeight || 540;
  const ideal = Math.round((GAME_H * w) / h);
  return Math.max(MIN_W, Math.min(MAX_W, ideal - (ideal % 2)));
}

export function PhaserGame() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: computeWidth(),
      height: GAME_H,
      backgroundColor: '#7cc4f8',
      pixelArt: true,
      roundPixels: true,
      banner: false,
      audio: { noAudio: true },
      input: { activePointers: 2, keyboard: true, touch: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: false, powerPreference: 'high-performance' },
      scene: [BootScene, RunScene],
    });

    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const w = computeWidth();
        if (w !== game.scale.gameSize.width) game.scale.setGameSize(w, GAME_H);
        else game.scale.refresh();
      }, 80);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.clearTimeout(t);
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="game-host" />;
}
