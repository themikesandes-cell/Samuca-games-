"""Headless smoke test: loads the game like an iPhone in landscape, plays with real
touch events, and fails on console errors, broken requests or blank screens.

usage: python3 tools/smoke_test.py http://localhost:4173/Samuca-games-/ OUT_DIR
"""
import sys, time
from playwright.sync_api import sync_playwright

URL, OUT = sys.argv[1], sys.argv[2]
errors, bad = [], []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and 'GL Driver Message' not in m.text else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.goto(URL)
    page.wait_for_selector('.btn-play', timeout=15000)
    time.sleep(0.8)
    page.screenshot(path=f'{OUT}/01_title.png')
    page.tap('.btn-play')
    time.sleep(1.2)
    page.screenshot(path=f'{OUT}/02_running.png')

    cx, cy = 600, 200

    def touch(kind, x=cx, y=cy):
        page.evaluate("""([kind,x,y]) => {
            const c = document.querySelector('canvas');
            const t = new Touch({identifier: 1, target: c, clientX: x, clientY: y});
            const ev = new TouchEvent(kind, {touches: kind==='touchend'?[]:[t], changedTouches:[t], targetTouches: kind==='touchend'?[]:[t], bubbles:true, cancelable:true});
            c.dispatchEvent(ev);
        }""", [kind, x, y])

    # quick tap = jump
    touch('touchstart'); time.sleep(0.08); touch('touchend')
    time.sleep(0.15)
    page.screenshot(path=f'{OUT}/03_jump.png')
    time.sleep(0.6)
    # hold = slide
    touch('touchstart'); time.sleep(0.45)
    page.screenshot(path=f'{OUT}/04_slide.png')
    time.sleep(0.3); touch('touchend')
    # let him crash into something
    page.wait_for_selector('.panel.over', timeout=30000)
    time.sleep(0.4)
    page.screenshot(path=f'{OUT}/05_gameover.png')
    page.tap('.panel.over .btn-play')
    time.sleep(1.0)
    page.screenshot(path=f'{OUT}/06_restart.png')
    hud = page.inner_text('.hud')
    # pause
    page.tap('button[aria-label="Pausar"]')
    time.sleep(0.3)
    page.screenshot(path=f'{OUT}/07_pause.png')
    page.tap('.panel .btn-play')
    time.sleep(0.5)
    # portrait notice
    page.set_viewport_size({'width': 390, 'height': 844})
    time.sleep(0.6)
    page.screenshot(path=f'{OUT}/08_portrait.png')
    b.close()

print('HUD after restart:', hud.replace('\n', ' '))
print('console problems:', errors or 'none')
print('failed requests:', bad or 'none')
sys.exit(1 if errors or bad else 0)
