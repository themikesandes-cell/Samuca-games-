import { useEffect, useState } from 'react';
import atlasJson from '../../public/assets/samuca.json';
import { ASSET_BASE } from '../game/assets';

type Frames = Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
const FRAMES = (atlasJson as { frames: Frames }).frames;
const SHEET = `${ASSET_BASE}samuca.png`;
const SHEET_W = (atlasJson as { meta: { size: { w: number; h: number } } }).meta.size.w;
const SHEET_H = (atlasJson as { meta: { size: { w: number; h: number } } }).meta.size.h;

/** Samuca drawn from the same atlas the game uses, scaled with crisp pixels. */
export function SpriteFrame({ frames, fps = 6, scale = 2, className = '' }: { frames: string[]; fps?: number; scale?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % frames.length), 1000 / fps);
    return () => window.clearInterval(id);
  }, [frames, fps]);
  const f = FRAMES[frames[i % frames.length]]?.frame ?? { x: 0, y: 0, w: 84, h: 72 };
  return (
    <div
      className={`sprite-frame ${className}`}
      aria-hidden
      style={{
        width: f.w * scale,
        height: f.h * scale,
        backgroundImage: `url(${SHEET})`,
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
      }}
    />
  );
}

export function CoinIcon({ size = 14 }: { size?: number }) {
  const s = size / 12;
  return (
    <span
      className="coin-icon"
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${ASSET_BASE}coin.png)`,
        backgroundSize: `${96 * s}px ${12 * s}px`,
      }}
    />
  );
}
