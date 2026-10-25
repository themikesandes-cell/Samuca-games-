import { useCallback, useEffect, useState } from 'react';
import { bridge, GameState, HudData, OverData } from '../game/events';
import { PhaserGame } from '../game/PhaserGame';
import { storage } from '../game/storage';
import { audio } from '../game/systems/Audio';
import { CoinIcon, SpriteFrame } from './SpriteFrame';

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const RUN = Array.from({ length: 10 }, (_, i) => `run_${i}`);
const CHEER = ['cheer_0', 'cheer_1', 'cheer_2', 'cheer_3', 'cheer_4', 'cheer_5'];
const IDLE = ['idle_0', 'idle_1', 'idle_0', 'idle_3'];

function useOrientation() {
  const get = () => isTouch() && window.innerHeight > window.innerWidth;
  const [portrait, setPortrait] = useState(get);
  useEffect(() => {
    const on = () => setPortrait(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return portrait;
}

export function App() {
  const [state, setState] = useState<GameState>('loading');
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<HudData>({ score: 0, coins: 0, best: storage.getBest() });
  const [over, setOver] = useState<OverData | null>(null);
  const [toast, setToast] = useState(false);
  const [music, setMusic] = useState(audio.musicOn);
  const [sfx, setSfx] = useState(audio.sfxOn);
  const portrait = useOrientation();
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const touch = isTouch();

  useEffect(() => {
    const offs = [
      bridge.on('state', (s) => {
        setState(s);
        if (s !== 'over') setOver(null);
        if (s === 'title') setHud((h) => ({ ...h, best: storage.getBest() }));
      }),
      bridge.on('hud', setHud),
      bridge.on('over', setOver),
      bridge.on('progress', setProgress),
      bridge.on('record', () => {
        setToast(true);
        window.setTimeout(() => setToast(false), 2200);
      }),
    ];
    // unlock audio on the very first gesture anywhere (iOS needs it inside the gesture)
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const press = useCallback((fn: () => void) => {
    audio.unlock();
    audio.click();
    fn();
  }, []);

  const toggleMusic = () =>
    press(() => {
      const on = !audio.musicOn;
      audio.setMusic(on);
      setMusic(on);
      if (on && state === 'playing') audio.startMusic();
    });
  const toggleSfx = () =>
    press(() => {
      const on = !audio.sfxOn;
      audio.setSfx(on);
      setSfx(on);
    });

  const showRotate = portrait && !rotateDismissed && state !== 'loading';
  useEffect(() => {
    if (showRotate && state === 'playing') bridge.emit('cmd:pause');
  }, [showRotate, state]);

  return (
    <div className="app">
      <PhaserGame />

      {state === 'loading' && (
        <div className="overlay loading">
          <Logo small />
          <div className="bar">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="blink">CARREGANDO...</p>
        </div>
      )}

      {state === 'title' && (
        <div className="overlay title">
          <Logo />
          <div className="title-row">
            <SpriteFrame frames={RUN} fps={12} scale={2} className="title-hero" />
            <div className="title-menu">
              <button className="btn btn-play" onClick={() => press(() => bridge.emit('cmd:start'))} autoFocus>
                ▶ JOGAR
              </button>
              <div className="howto">
                {touch ? (
                  <>
                    <p><b>TOQUE</b> pular</p>
                    <p><b>SEGURE</b> rasteira</p>
                  </>
                ) : (
                  <>
                    <p><b>ESPAÇO / ↑</b> pular</p>
                    <p><b>↓</b> rasteira</p>
                    <p><b>ENTER</b> jogar · <b>P</b> pausa</p>
                  </>
                )}
              </div>
              {hud.best > 0 && <p className="best-line">RECORDE {hud.best}</p>}
            </div>
          </div>
          <div className="corner-buttons">
            <SoundButtons music={music} sfx={sfx} onMusic={toggleMusic} onSfx={toggleSfx} />
          </div>
        </div>
      )}

      {(state === 'playing' || state === 'paused' || state === 'over') && (
        <div className="hud">
          <div className="hud-left">
            <div className="chip score">
              <span className="lbl">PONTOS</span>
              <span className="val">{hud.score}</span>
            </div>
            <div className="chip coins">
              <CoinIcon size={14} />
              <span className="val">{hud.coins}</span>
            </div>
          </div>
          <div className="hud-right">
            <div className="chip best">
              <span className="lbl">RECORDE</span>
              <span className="val">{hud.best}</span>
            </div>
            {state === 'playing' && (
              <>
                <button className={`icon-btn ${music ? '' : 'off'}`} aria-label={music ? 'Desligar música' : 'Ligar música'} onClick={toggleMusic}>
                  ♪
                </button>
                <button className="icon-btn" aria-label="Pausar" onClick={() => press(() => bridge.emit('cmd:pause'))}>
                  ❚❚
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && state === 'playing' && <div className="toast">NOVO RECORDE!</div>}

      {state === 'paused' && (
        <div className="overlay dim">
          <div className="panel">
            <h2>PAUSA</h2>
            <SpriteFrame frames={IDLE} fps={3} scale={2} />
            <button className="btn btn-play" onClick={() => press(() => bridge.emit('cmd:resume'))} autoFocus>
              ▶ CONTINUAR
            </button>
            <SoundButtons music={music} sfx={sfx} onMusic={toggleMusic} onSfx={toggleSfx} />
            <button className="btn btn-ghost" onClick={() => press(() => bridge.emit('cmd:title'))}>
              MENU
            </button>
          </div>
        </div>
      )}

      {state === 'over' && over && (
        <div className="overlay dim">
          <div className="panel over">
            <h2 className="go">GAME OVER</h2>
            <div className="over-body">
              <SpriteFrame frames={over.newRecord ? CHEER : ['think_0']} fps={6} scale={2} />
              <div className="stats">
                {over.newRecord && <p className="badge">NOVO RECORDE!</p>}
                <p>
                  PONTOS <b>{over.score}</b>
                </p>
                <p>
                  <CoinIcon size={12} /> MOEDAS <b>{over.coins}</b>
                </p>
                <p>
                  RECORDE <b>{over.best}</b>
                </p>
              </div>
            </div>
            <button className="btn btn-play" onClick={() => press(() => bridge.emit('cmd:start'))} autoFocus>
              ↻ JOGAR NOVAMENTE
            </button>
            <button className="btn btn-ghost" onClick={() => press(() => bridge.emit('cmd:title'))}>
              MENU
            </button>
          </div>
        </div>
      )}

      {showRotate && (
        <div className="overlay rotate">
          <div className="phone" aria-hidden>
            <div className="screen" />
          </div>
          <p>GIRE O CELULAR</p>
          <p className="small">O jogo fica melhor na horizontal!</p>
          <button className="btn btn-ghost" onClick={() => setRotateDismissed(true)}>
            JOGAR ASSIM MESMO
          </button>
        </div>
      )}
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <div className="logo-badge">SAMUCA GAMES</div>
      <h1 className="logo-title">
        <span>CORRE,</span> <span className="hl">SAMUCA!</span>
      </h1>
    </div>
  );
}

function SoundButtons({ music, sfx, onMusic, onSfx }: { music: boolean; sfx: boolean; onMusic: () => void; onSfx: () => void }) {
  return (
    <div className="sound-buttons">
      <button className={`toggle ${music ? 'on' : ''}`} onClick={onMusic}>
        MUSICA {music ? 'ON' : 'OFF'}
      </button>
      <button className={`toggle ${sfx ? 'on' : ''}`} onClick={onSfx}>
        SONS {sfx ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
