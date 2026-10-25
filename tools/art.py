"""Procedural 16-bit pixel art for CORRE, SAMUCA! (São Paulo scenery, props, UI bits).

Everything is drawn at 1x game resolution with hard edges (no anti-aliasing) and
written as PNGs into public/assets, so any file can later be replaced by hand-made art
with the same name and size without touching the game code.
"""
import random, sys, json, math
from PIL import Image, ImageDraw

OUT = sys.argv[1]
R = random.Random(7)

# ------------------------------------------------------------------ helpers
FONT = {
    'A': ["010", "101", "111", "101", "101"], 'B': ["110", "101", "110", "101", "110"],
    'C': ["011", "100", "100", "100", "011"], 'D': ["110", "101", "101", "101", "110"],
    'E': ["111", "100", "110", "100", "111"], 'F': ["111", "100", "110", "100", "100"],
    'G': ["011", "100", "101", "101", "011"], 'H': ["101", "101", "111", "101", "101"],
    'I': ["111", "010", "010", "010", "111"], 'J': ["001", "001", "001", "101", "010"],
    'K': ["101", "101", "110", "101", "101"], 'L': ["100", "100", "100", "100", "111"],
    'M': ["101", "111", "111", "101", "101"], 'N': ["110", "101", "101", "101", "101"],
    'O': ["010", "101", "101", "101", "010"], 'P': ["110", "101", "110", "100", "100"],
    'Q': ["010", "101", "101", "110", "011"], 'R': ["110", "101", "110", "101", "101"],
    'S': ["011", "100", "010", "001", "110"], 'T': ["111", "010", "010", "010", "010"],
    'U': ["101", "101", "101", "101", "111"], 'V': ["101", "101", "101", "101", "010"],
    'W': ["101", "101", "111", "111", "101"], 'X': ["101", "101", "010", "101", "101"],
    'Y': ["101", "101", "010", "010", "010"], 'Z': ["111", "001", "010", "100", "111"],
    ' ': ["000", "000", "000", "000", "000"], '!': ["010", "010", "010", "000", "010"],
    '0': ["111", "101", "101", "101", "111"], '1': ["010", "110", "010", "010", "111"],
    '2': ["110", "001", "010", "100", "111"], '3': ["110", "001", "010", "001", "110"],
    '4': ["101", "101", "111", "001", "001"], '5': ["111", "100", "110", "001", "110"],
    '6': ["011", "100", "111", "101", "111"], '7': ["111", "001", "010", "010", "010"],
    '8': ["111", "101", "111", "101", "111"], '9': ["111", "101", "111", "001", "110"],
    '-': ["000", "000", "111", "000", "000"], '.': ["000", "000", "000", "000", "010"],
    '$': ["011", "110", "010", "011", "110"], '&': ["010", "101", "010", "101", "011"],
}


def text(d, x, y, s, c, scale=1):
    for ch in s.upper():
        g = FONT.get(ch, FONT[' '])
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    d.rectangle([x + i * scale, y + j * scale, x + i * scale + scale - 1, y + j * scale + scale - 1], fill=c)
        x += 4 * scale
    return x


def text_w(s, scale=1):
    return len(s) * 4 * scale - scale


def R_(x, y, w, h):
    return [x, y, x + w - 1, y + h - 1]


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + ((c[3],) if len(c) == 4 else ())


class Tile:
    """Seamless horizontal tile: draw on a wider canvas, fold the overflow back."""

    def __init__(self, w, h, margin=400):
        self.w, self.h, self.m = w, h, margin
        self.img = Image.new('RGBA', (w + margin, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def done(self):
        base = self.img.crop((0, 0, self.w, self.h))
        over = self.img.crop((self.w, 0, self.w + self.m, self.h))
        layer = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        layer.paste(over, (0, 0))
        base.alpha_composite(layer)
        return base


def save(img, name):
    img.save(f'{OUT}/{name}.png')


OUTLINE = (24, 20, 34, 255)

# ------------------------------------------------------------------ sky
def sky():
    W, H = 64, 288
    img = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(img)
    bands = [(0, (46, 108, 214)), (40, (60, 128, 228)), (80, (78, 150, 238)), (118, (98, 172, 246)),
             (150, (122, 192, 250)), (178, (150, 210, 252)), (200, (182, 226, 255)), (222, (210, 238, 255))]
    for k, (y, c) in enumerate(bands):
        y2 = bands[k + 1][0] if k + 1 < len(bands) else H
        d.rectangle([0, y, W - 1, y2 - 1], fill=c + (255,))
        # 2-row checker dither into the next band
        if k + 1 < len(bands):
            nc = bands[k + 1][1] + (255,)
            for x in range(0, W, 2):
                d.point((x, y2 - 2), fill=nc)
                d.point((x + 1, y2 - 1), fill=nc)
    save(img, 'sky')


def cloud(d, x, y, w):
    """Puffy pixel cloud with two shade levels and a flat-ish base."""
    W = (255, 255, 255, 255)
    S1 = (222, 238, 252, 255)
    S2 = (186, 214, 244, 255)
    h = max(10, w // 4)
    puffs = []
    n = max(3, w // 18)
    for i in range(n):
        px = x + int((i + 0.5) * w / n)
        r = R.randint(h // 2 + 2, h)
        if i in (0, n - 1):
            r = int(r * 0.7)
        puffs.append((px, y + h - r // 2, r))
    for px, py, r in puffs:
        d.ellipse([px - r, py - r, px + r, py + r], fill=S2)
    for px, py, r in puffs:
        d.ellipse([px - r + 1, py - r, px + r - 1, py + r - 3], fill=S1)
    for px, py, r in puffs:
        d.ellipse([px - r + 3, py - r + 1, px + r - 4, py + r - 7], fill=W)
    # flat base
    base_y = y + h + 2
    d.rectangle([x - 4, base_y, x + w + 4, base_y + 40], fill=(0, 0, 0, 0))
    d.rectangle([x + 2, base_y - 2, x + w - 2, base_y - 1], fill=S2)


def clouds():
    t = Tile(1200, 120)
    x = 10
    while x < 1200:
        w = R.randint(40, 110)
        y = R.randint(8, 70)
        cloud(t.d, x, y, w)
        x += w + R.randint(70, 180)
    save(t.done(), 'clouds')


# ------------------------------------------------------------------ far skyline
FAR = [(126, 160, 214), (112, 146, 204), (140, 174, 224)]
FAR_WIN = (160, 194, 238)
FAR_DARK = (100, 132, 190)


def far_building(d, x, base, w, h, c, kind='box'):
    top = base - h
    d.rectangle(R_(x, top, w, h), fill=c + (255,))
    if kind == 'spire':  # Banespa-like stepped tower
        d.rectangle(R_(x + 3, top - 8, w - 6, 8), fill=c + (255,))
        d.rectangle(R_(x + 6, top - 16, w - 12, 8), fill=c + (255,))
        d.rectangle(R_(x + w // 2 - 1, top - 30, 2, 14), fill=c + (255,))
    if kind == 'antenna':
        d.rectangle(R_(x + w // 2 - 1, top - 26, 2, 26), fill=FAR_DARK + (255,))
        for k in range(0, 26, 6):
            d.rectangle(R_(x + w // 2 - 1, top - 26 + k, 2, 3), fill=(196, 150, 170, 255))
    if kind == 'cap':
        d.rectangle(R_(x - 1, top - 3, w + 2, 3), fill=FAR_DARK + (255,))
    # windows: vertical light strips
    for wx in range(x + 2, x + w - 2, 3):
        for wy in range(top + 3, base - 2, 4):
            if R.random() < 0.55:
                d.point((wx, wy), fill=FAR_WIN + (255,))
    d.rectangle(R_(x + w - 2, top, 2, h), fill=FAR_DARK + (255,))


def copan_far(d, x, base, c):
    """Copan silhouette: long wavy slab with horizontal brise-soleil lines."""
    w, h = 90, 74
    top = base - h
    pts = []
    for i in range(w + 1):
        pts.append((x + i, top + int(4 * math.sin(i / w * math.pi * 1.6))))
    poly = pts + [(x + w, base), (x, base)]
    d.polygon(poly, fill=c + (255,))
    for yy in range(top + 6, base, 3):
        for i in range(2, w - 2):
            off = int(4 * math.sin(i / w * math.pi * 1.6))
            if top + off < yy:
                d.point((x + i, yy + int(3 * math.sin(i / w * math.pi * 2.2))), fill=FAR_WIN + (255,))


def far():
    W, H = 1280, 170
    t = Tile(W, H)
    base = H
    x = 0
    specials = {260: 'copan', 700: 'spire', 1000: 'antenna', 470: 'antenna'}
    while x < W:
        placed = False
        for sx, kind in specials.items():
            if sx <= x < sx + 30:
                if kind == 'copan':
                    copan_far(t.d, x, base, FAR[0])
                    x += 92
                else:
                    w = 24
                    far_building(t.d, x, base, w, R.randint(90, 115), FAR[1], kind)
                    x += w + 2
                specials.pop(sx)
                placed = True
                break
        if placed:
            continue
        w = R.randint(14, 34)
        h = R.randint(40, 100)
        kind = R.choice(['box', 'box', 'cap', 'box'])
        far_building(t.d, x, base, w, h, R.choice(FAR), kind)
        x += w + R.randint(-4, 3)
    # haze band at the bottom
    img = t.done()
    d = ImageDraw.Draw(img)
    for y in range(H - 14, H):
        for xx in range(0, W):
            if (xx + y) % 2 == 0 and img.getpixel((xx, y))[3]:
                d.point((xx, y), fill=(168, 204, 240, 255))
    save(img, 'far')


# ------------------------------------------------------------------ mid city (the identity layer)
GLASS = [((86, 150, 196), (140, 200, 236)), ((64, 120, 150), (110, 176, 200)), ((98, 120, 170), (150, 176, 220))]
WALLS = [(230, 206, 160), (214, 178, 138), (196, 110, 84), (226, 224, 214), (240, 186, 96), (150, 186, 140),
         (232, 150, 150), (120, 168, 200)]


def tower(d, x, base, w, h, palette=None, roof='flat'):
    top = base - h
    body, refl = palette or R.choice(GLASS)
    dark = shade(body, 0.7)
    d.rectangle(R_(x, top, w, h), fill=OUTLINE)
    d.rectangle(R_(x + 1, top + 1, w - 2, h - 1), fill=body + (255,))
    # curtain wall grid
    for yy in range(top + 4, base - 3, 5):
        d.rectangle(R_(x + 1, yy, w - 2, 1), fill=dark + (255,))
    for xx in range(x + 4, x + w - 2, 6):
        d.rectangle(R_(xx, top + 1, 1, h - 1), fill=dark + (255,))
    # sky reflection: lighter panels along a diagonal band
    ph = 0
    for cy, yy in enumerate(range(top + 1, base - 3, 5)):
        for cx, xx in enumerate(range(x + 1, x + w - 2, 6)):
            if (cx + cy) % 9 in (0, 1):
                d.rectangle(R_(xx + 1 if cx else xx, yy + (1 if cy else 0), 5 if cx else 3, 3), fill=refl + (255,))
    d.rectangle(R_(x + w - 3, top + 1, 2, h - 1), fill=dark + (255,))
    if roof == 'antenna':
        d.rectangle(R_(x + w // 2 - 1, top - 18, 2, 18), fill=OUTLINE)
        d.rectangle(R_(x + w // 2 - 1, top - 20, 2, 2), fill=(240, 60, 60, 255))
    elif roof == 'heli':
        d.rectangle(R_(x + 2, top - 3, w - 4, 3), fill=OUTLINE)
        d.ellipse(R_(x + w // 2 - 5, top - 3, 10, 3), fill=(250, 210, 70, 255))
    elif roof == 'crown':
        d.rectangle(R_(x - 1, top - 2, w + 2, 3), fill=OUTLINE)
        d.rectangle(R_(x + 3, top - 7, w - 6, 5), fill=OUTLINE)
        d.rectangle(R_(x + 4, top - 6, w - 8, 3), fill=shade(body, 1.15) + (255,))


def block(d, x, base, w, h, wall=None, rows=None):
    """Older concrete/residential building with punched windows and balconies."""
    top = base - h
    wall = wall or R.choice(WALLS)
    dark = shade(wall, 0.75)
    light = shade(wall, 1.12)
    d.rectangle(R_(x, top, w, h), fill=OUTLINE)
    d.rectangle(R_(x + 1, top + 1, w - 2, h - 1), fill=wall + (255,))
    d.rectangle(R_(x + 1, top + 1, w - 2, 2), fill=light + (255,))
    d.rectangle(R_(x + w - 3, top + 1, 2, h - 1), fill=dark + (255,))
    win = (70, 110, 150, 255)
    winl = (150, 200, 236, 255)
    for yy in range(top + 6, base - 12, 9):
        for xx in range(x + 4, x + w - 7, 7):
            d.rectangle(R_(xx, yy, 4, 5), fill=OUTLINE)
            d.rectangle(R_(xx + 1, yy + 1, 2, 3), fill=win)
            d.point((xx + 1, yy + 1), fill=winl)
            if R.random() < 0.18:  # laundry / plant on the sill
                d.rectangle(R_(xx, yy + 5, 4, 1), fill=R.choice([(80, 170, 90, 255), (240, 90, 90, 255), (250, 220, 90, 255)]))
        d.rectangle(R_(x + 1, yy + 7, w - 3, 1), fill=dark + (255,))
    # water tank on the roof (very SP)
    if w > 22 and R.random() < 0.8:
        tx = x + R.randint(3, w - 14)
        d.rectangle(R_(tx, top - 7, 10, 7), fill=OUTLINE)
        d.rectangle(R_(tx + 1, top - 6, 8, 6), fill=(90, 150, 200, 255))
        d.rectangle(R_(tx + 1, top - 6, 8, 1), fill=(150, 200, 236, 255))


def masp(d, x, base):
    """MASP: concrete box held by two red frames, with the free span (vão livre) below."""
    w, h_box, lift = 150, 34, 36
    red, redd = (222, 40, 40, 255), (160, 24, 30, 255)
    box_top = base - lift - h_box
    # glass box
    d.rectangle(R_(x + 6, box_top, w - 12, h_box), fill=OUTLINE)
    d.rectangle(R_(x + 7, box_top + 1, w - 14, h_box - 2), fill=(62, 74, 88, 255))
    for xx in range(x + 9, x + w - 9, 5):
        d.rectangle(R_(xx, box_top + 2, 1, h_box - 4), fill=(46, 54, 66, 255))
    for k in range(0, w - 16, 23):
        d.rectangle(R_(x + 10 + k, box_top + 4, 6, 3), fill=(120, 150, 180, 255))
    d.rectangle(R_(x + 7, box_top + h_box - 5, w - 14, 3), fill=(140, 140, 146, 255))
    # red frames
    for fx in (x, x + w - 8):
        d.rectangle(R_(fx, box_top - 8, 8, lift + h_box + 8), fill=OUTLINE)
        d.rectangle(R_(fx + 1, box_top - 7, 6, lift + h_box + 7), fill=red)
        d.rectangle(R_(fx + 5, box_top - 7, 2, lift + h_box + 7), fill=redd)
    d.rectangle(R_(x, box_top - 8, w, 8), fill=OUTLINE)
    d.rectangle(R_(x + 1, box_top - 7, w - 2, 6), fill=red)
    d.rectangle(R_(x + 1, box_top - 3, w - 2, 2), fill=redd)
    # floor of the vão livre + people silhouettes
    d.rectangle(R_(x + 8, base - 3, w - 16, 3), fill=(170, 166, 160, 255))
    for k in range(5):
        px = x + 20 + k * 24 + R.randint(-4, 4)
        col = R.choice([(240, 90, 90), (90, 120, 220), (250, 200, 80), (80, 170, 120)])
        d.rectangle(R_(px, base - 11, 3, 8), fill=col + (255,))
        d.rectangle(R_(px, base - 14, 3, 3), fill=(120, 80, 60, 255))
    text(d, x + w // 2 - text_w('MASP') // 2, box_top + 9, 'MASP', (230, 230, 230, 255))
    return w


def copan(d, x, base):
    """Edifício Copan close-up: wavy white slab with strong horizontal brise-soleils."""
    w, h = 170, 176
    top = base - h
    wall = (236, 232, 222, 255)
    sh = (196, 192, 186, 255)
    wave = lambda i: int(6 * math.sin(i / w * math.pi * 1.7))
    for i in range(w):
        o = wave(i)
        d.rectangle([x + i, top + o, x + i, base - 1], fill=OUTLINE)
    for i in range(1, w - 1):
        o = wave(i)
        d.rectangle([x + i, top + o + 1, x + i, base - 1], fill=(120, 150, 180, 255))
    for yy in range(top + 6, base - 4, 4):
        for i in range(1, w - 1):
            o = wave(i) + int(3 * math.sin(i / w * math.pi * 2.4))
            y0 = yy + o // 2
            if y0 > top + wave(i) + 1 and y0 < base - 2:
                d.point((x + i, y0), fill=wall)
                d.point((x + i, y0 + 1), fill=wall if i % 9 else sh)
                d.point((x + i, y0 + 2), fill=sh)
    # ground floor galleries
    d.rectangle(R_(x, base - 14, w, 14), fill=OUTLINE)
    d.rectangle(R_(x + 1, base - 13, w - 2, 13), fill=(214, 206, 190, 255))
    for xx in range(x + 4, x + w - 8, 12):
        d.rectangle(R_(xx, base - 11, 8, 11), fill=(58, 70, 86, 255))
    text(d, x + 8, base - 22, 'COPAN', (60, 60, 70, 255))
    return w


def italia(d, x, base):
    """Edifício Itália-like tall slab."""
    w, h = 40, 186
    tower(d, x, base, w, h, ((150, 140, 128), (196, 188, 176)), roof='crown')
    return w


def graffiti_wall(d, x, base, w, h, seed):
    rr = random.Random(seed)
    top = base - h
    d.rectangle(R_(x, top, w, h), fill=OUTLINE)
    d.rectangle(R_(x + 1, top + 1, w - 2, h - 1), fill=(200, 196, 188, 255))
    cols = [(255, 72, 120), (60, 210, 240), (255, 210, 40), (120, 230, 90), (170, 90, 255), (255, 140, 40)]
    # background drips/blobs
    for _ in range(w // 8):
        c = rr.choice(cols)
        cx, cy = rr.randint(x + 2, x + w - 3), rr.randint(top + 4, base - 4)
        r = rr.randint(4, 10)
        d.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=shade(c, 0.85) + (255,))
        for k in range(rr.randint(0, 2)):
            dx = cx + rr.randint(-r, r)
            d.rectangle(R_(dx, cy, 1, rr.randint(3, 9)), fill=shade(c, 0.85) + (255,))
    return cols


def bubble_word(d, x, y, word, fill, out=OUTLINE, scale=3):
    for ox, oy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (1, -1), (-1, 1), (2, 2), (1, 2), (2, 1)]:
        text(d, x + ox, y + oy, word, out, scale)
    text(d, x, y, word, fill, scale)
    text(d, x, y, word, fill, scale)


def shop(d, x, base, w, h, name, awning):
    top = base - h
    wall = R.choice(WALLS)
    d.rectangle(R_(x, top, w, h), fill=OUTLINE)
    d.rectangle(R_(x + 1, top + 1, w - 2, h - 1), fill=wall + (255,))
    # upper floor windows
    for xx in range(x + 5, x + w - 8, 10):
        d.rectangle(R_(xx, top + 5, 6, 8), fill=OUTLINE)
        d.rectangle(R_(xx + 1, top + 6, 4, 6), fill=(110, 160, 210, 255))
    # sign board
    sw = text_w(name) + 8
    sx = x + (w - sw) // 2
    d.rectangle(R_(sx, top + 17, sw, 9), fill=OUTLINE)
    d.rectangle(R_(sx + 1, top + 18, sw - 2, 7), fill=(250, 244, 226, 255))
    text(d, sx + 4, top + 19, name, (200, 40, 40, 255))
    # striped awning
    ay = top + 28
    for i in range(x + 2, x + w - 2):
        c = awning[(i // 4) % 2]
        d.rectangle([i, ay, i, ay + 5], fill=c + (255,))
        if (i - x) % 8 < 4:
            d.point((i, ay + 6), fill=c + (255,))
    d.rectangle(R_(x + 2, ay - 1, w - 4, 1), fill=OUTLINE)
    # storefront
    d.rectangle(R_(x + 4, ay + 7, w - 8, base - ay - 7), fill=(50, 54, 70, 255))
    for xx in range(x + 6, x + w - 8, 7):
        d.rectangle(R_(xx, ay + 9, 5, base - ay - 11), fill=(96, 120, 150, 255))
        d.point((xx + 1, ay + 10), fill=(180, 210, 236, 255))


def ipe(d, x, base, h=58, color=((255, 214, 40), (230, 170, 20), (255, 240, 130))):
    trunk = (110, 72, 48, 255)
    d.rectangle(R_(x - 1, base - h // 2, 3, h // 2), fill=trunk)
    d.line([x, base - h // 2 + 6, x - 8, base - h + 16], fill=trunk, width=2)
    d.line([x, base - h // 2 + 4, x + 9, base - h + 14], fill=trunk, width=2)
    blobs = [(x - 10, base - h + 12, 11), (x + 9, base - h + 12, 11), (x, base - h + 6, 13), (x - 4, base - h + 18, 9), (x + 6, base - h + 19, 9)]
    for bx, by, r in blobs:
        d.ellipse([bx - r, by - r, bx + r, by + r], fill=OUTLINE)
    for bx, by, r in blobs:
        d.ellipse([bx - r + 1, by - r + 1, bx + r - 1, by + r - 1], fill=color[1] + (255,))
    for bx, by, r in blobs:
        d.ellipse([bx - r + 2, by - r + 1, bx + r - 3, by + r - 4], fill=color[0] + (255,))
    for _ in range(26):
        bx, by, r = R.choice(blobs)
        d.point((bx + R.randint(-r + 3, r - 3), by + R.randint(-r + 3, r - 5)), fill=color[2] + (255,))


def green_tree(d, x, base, h=50):
    ipe(d, x, base, h, ((88, 186, 82), (52, 140, 66), (150, 220, 110)))


def mid():
    W, H = 2400, 200
    t = Tile(W, H, 500)
    d = t.d
    base = H
    # ---- Trecho 1: Avenida Paulista (towers, MASP, antennas, ipês)
    x = 0
    tower(d, x, base, 34, 150, roof='antenna'); x += 36
    block(d, x, base, 30, 96); x += 30
    tower(d, x, base, 44, 170, roof='heli'); x += 46
    w = masp(d, x + 6, base); ipe(d, x + 2, base, 60); x += w + 14
    tower(d, x, base, 38, 138, roof='crown'); x += 38
    block(d, x, base, 28, 110, (226, 224, 214)); x += 30
    tower(d, x, base, 50, 182, roof='antenna'); x += 52
    shop(d, x, base, 64, 64, 'BANCO', ((40, 90, 200), (240, 240, 240))); x += 66
    tower(d, x, base, 36, 128); x += 38
    ipe(d, x - 6, base, 56)
    # ---- Trecho 2: Centro (Copan, Itália, prédios antigos, grafite)
    x = 640
    block(d, x, base, 34, 120); x += 34
    w = italia(d, x, base); x += w + 2
    block(d, x, base, 26, 90, (214, 178, 138)); x += 28
    w = copan(d, x, base); x += w + 4
    block(d, x, base, 32, 104, (240, 186, 96)); x += 32
    shop(d, x, base, 70, 62, 'PADARIA', ((220, 50, 50), (250, 240, 220))); x += 70
    gw = 120
    cols = graffiti_wall(d, x, base, gw, 60, 3)
    bubble_word(d, x + 10, base - 46, 'SAMUCA', (255, 214, 40), scale=4)
    text(d, x + 14, base - 16, 'SP', (60, 210, 240, 255), 2)
    x += gw
    block(d, x, base, 30, 132, (196, 110, 84)); x += 32
    green_tree(d, x - 2, base, 48)
    block(d, x, base, 34, 98, (150, 186, 140)); x += 34
    # ---- Trecho 3: Vila Madalena (casinhas coloridas, Beco do Batman vibe)
    x = 1460
    houses = [(240, 120, 150), (90, 190, 210), (250, 200, 60), (150, 110, 220), (110, 200, 120), (250, 150, 70)]
    for k in range(4):
        hw = R.randint(40, 56)
        hh = R.randint(46, 66)
        c = houses[k % len(houses)]
        block(d, x, base, hw, hh, c)
        x += hw + 2
    shop(d, x, base, 64, 58, 'LANCHES', ((250, 180, 40), (220, 60, 40))); x += 66
    graffiti_wall(d, x, base, 150, 54, 9)
    # cartoon face mural
    fx = x + 34
    d.ellipse([fx - 16, base - 48, fx + 16, base - 14], fill=OUTLINE)
    d.ellipse([fx - 15, base - 47, fx + 15, base - 15], fill=(255, 150, 60, 255))
    d.rectangle(R_(fx - 8, base - 38, 4, 5), fill=OUTLINE); d.rectangle(R_(fx + 5, base - 38, 4, 5), fill=OUTLINE)
    d.arc([fx - 9, base - 34, fx + 9, base - 20], 20, 160, fill=OUTLINE, width=2)
    bubble_word(d, x + 62, base - 44, 'VILA', (60, 210, 240), scale=3)
    bubble_word(d, x + 62, base - 24, 'ARTE', (255, 72, 120), scale=3)
    x += 152
    for k in range(3):
        hw = R.randint(42, 54)
        block(d, x, base, hw, R.randint(50, 70), houses[(k + 3) % len(houses)])
        x += hw + 2
    ipe(d, x - 10, base, 58, ((255, 120, 180), (220, 70, 140), (255, 190, 220)))  # ipê rosa
    shop(d, x, base, 62, 60, 'SORVETE', ((255, 120, 180), (250, 250, 250))); x += 64
    # ---- transition back to Paulista (towers)
    while x < W:
        if R.random() < 0.6:
            w = R.randint(32, 46); tower(d, x, base, w, R.randint(120, 175), roof=R.choice(['flat', 'antenna', 'crown', 'heli']))
        else:
            w = R.randint(26, 36); block(d, x, base, w, R.randint(80, 120))
        x += w + 2
    save(t.done(), 'mid')


# ------------------------------------------------------------------ road + sidewalk
def road():
    W, H = 256, 26
    img = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(img)
    d.rectangle(R_(0, 0, W, H), fill=(78, 80, 92, 255))
    d.rectangle(R_(0, 0, W, 2), fill=(150, 150, 150, 255))  # far curb
    d.rectangle(R_(0, 2, W, 1), fill=(56, 58, 68, 255))
    d.rectangle(R_(0, 15, W, 11), fill=(150, 64, 60, 255))  # bus lane (faixa exclusiva)
    d.rectangle(R_(0, 15, W, 1), fill=(250, 250, 250, 255))
    for xx in range(0, W, 32):
        d.rectangle(R_(xx, 8, 16, 2), fill=(250, 250, 250, 255))
    for k in range(70):
        d.point((R.randrange(W), R.randrange(4, 14)), fill=(92, 94, 106, 255))
        d.point((R.randrange(W), R.randrange(17, 26)), fill=(168, 80, 74, 255))
    text(d, 40, 19, 'ONIBUS', (240, 210, 200, 255))
    text(d, 168, 19, 'ONIBUS', (240, 210, 200, 255))
    save(img, 'road')


def sidewalk():
    """Black & white mosaic sidewalk inspired by the paulistana 'calçada'."""
    W, H = 256, 52
    img = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(img)
    light, lt2, dark = (226, 222, 212, 255), (206, 202, 192, 255), (70, 70, 78, 255)
    d.rectangle(R_(0, 0, W, H), fill=light)
    d.rectangle(R_(0, 0, W, 4), fill=(172, 170, 166, 255))  # curb stone
    d.rectangle(R_(0, 4, W, 1), fill=(120, 118, 116, 255))
    # stylised wave mosaic in the back half (props lane)
    for xx in range(W):
        y = 9 + int(3 * math.sin(xx / W * math.pi * 4))
        d.point((xx, y), fill=dark); d.point((xx, y + 1), fill=dark)
    # main running lane: subtle square cobble pattern
    for y in range(16, H, 6):
        for xx in range((y // 6) % 2 * 4, W, 8):
            d.rectangle(R_(xx, y, 7, 5), fill=lt2)
            d.rectangle(R_(xx + 1, y + 1, 5, 3), fill=light)
    # occasional dark tile clusters (mosaic)
    for k in range(10):
        xx, y = R.randrange(0, W - 4), R.randrange(18, H - 4)
        d.rectangle(R_(xx, y, 3, 3), fill=(176, 172, 164, 255))
    d.rectangle(R_(0, 14, W, 1), fill=(190, 186, 176, 255))
    save(img, 'sidewalk')


# ------------------------------------------------------------------ props on the back of the sidewalk
def lamp(d, x, base):
    pole = (60, 70, 86, 255)
    d.rectangle(R_(x - 1, base - 92, 3, 92), fill=OUTLINE)
    d.rectangle(R_(x, base - 91, 1, 91), fill=pole)
    d.rectangle(R_(x - 3, base - 6, 7, 6), fill=OUTLINE)
    d.rectangle(R_(x, base - 92, 14, 2), fill=OUTLINE)
    d.rectangle(R_(x + 9, base - 91, 9, 4), fill=OUTLINE)
    d.rectangle(R_(x + 10, base - 88, 7, 1), fill=(255, 240, 170, 255))


def traffic_light(d, x, base):
    d.rectangle(R_(x - 1, base - 66, 3, 66), fill=OUTLINE)
    d.rectangle(R_(x - 4, base - 84, 9, 22), fill=OUTLINE)
    for k, c in enumerate([(240, 60, 50), (250, 200, 50), (70, 220, 100)]):
        d.rectangle(R_(x - 2, base - 82 + k * 7, 5, 5), fill=shade(c, 0.45) + (255,))
    d.rectangle(R_(x - 2, base - 68, 5, 5), fill=(70, 220, 100, 255))
    # street sign (blue SP plate)
    d.rectangle(R_(x + 2, base - 60, 30, 9), fill=OUTLINE)
    d.rectangle(R_(x + 3, base - 59, 28, 7), fill=(30, 80, 170, 255))
    text(d, x + 5, base - 58, 'AV PTA', (255, 255, 255, 255))


def bus_stop(d, x, base):
    d.rectangle(R_(x, base - 40, 44, 3), fill=OUTLINE)
    d.rectangle(R_(x + 1, base - 39, 42, 1), fill=(240, 130, 40, 255))
    for px in (x + 2, x + 40):
        d.rectangle(R_(px, base - 38, 2, 38), fill=OUTLINE)
    d.rectangle(R_(x + 6, base - 34, 30, 24), fill=(150, 200, 230, 255))
    d.rectangle(R_(x + 6, base - 34, 30, 24), outline=OUTLINE)
    text(d, x + 9, base - 30, 'BUS', (30, 80, 170, 255))
    d.rectangle(R_(x + 6, base - 12, 30, 3), fill=OUTLINE)


def banca(d, x, base):
    """Newsstand (banca de jornal)."""
    w, h = 54, 42
    d.rectangle(R_(x, base - h, w, h), fill=OUTLINE)
    d.rectangle(R_(x + 1, base - h + 1, w - 2, h - 1), fill=(40, 120, 80, 255))
    d.rectangle(R_(x - 2, base - h - 4, w + 4, 5), fill=OUTLINE)
    d.rectangle(R_(x - 1, base - h - 3, w + 2, 3), fill=(60, 160, 100, 255))
    text(d, x + 7, base - h + 4, 'BANCA', (255, 230, 90, 255))
    for k in range(6):
        c = R.choice([(240, 80, 80), (250, 210, 60), (80, 160, 240), (240, 240, 240), (240, 120, 200)])
        d.rectangle(R_(x + 4 + k * 8, base - h + 13, 6, 9), fill=c + (255,))
        d.rectangle(R_(x + 4 + k * 8, base - h + 24, 6, 9), fill=R.choice([(250, 160, 60), (120, 220, 140), (200, 200, 255)]) + (255,))


def props():
    W, H = 1600, 110
    t = Tile(W, H)
    d = t.d
    base = H
    x = 30
    seq = ['lamp', 'tree', 'banca', 'lamp', 'light', 'tree', 'stop', 'lamp', 'ipe', 'lamp', 'tree', 'light', 'lamp', 'banca', 'tree', 'stop', 'lamp', 'ipe']
    for kind in seq:
        if x > W - 20:
            break
        if kind == 'lamp':
            lamp(d, x, base); x += R.randint(70, 100)
        elif kind == 'tree':
            green_tree(d, x, base, 62); x += R.randint(60, 90)
        elif kind == 'ipe':
            ipe(d, x, base, 64); x += R.randint(60, 90)
        elif kind == 'banca':
            banca(d, x, base); x += 54 + R.randint(40, 70)
        elif kind == 'light':
            traffic_light(d, x, base); x += R.randint(70, 90)
        elif kind == 'stop':
            bus_stop(d, x, base); x += 44 + R.randint(40, 70)
    save(t.done(), 'props')


# ------------------------------------------------------------------ bus
def bus(name, body, stripe):
    W, H = 150, 46
    img = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W - 1, H - 8], radius=5, fill=OUTLINE)
    d.rounded_rectangle([1, 1, W - 2, H - 9], radius=4, fill=body + (255,))
    d.rectangle(R_(1, 24, W - 2, 6), fill=stripe + (255,))
    d.rectangle(R_(1, 3, W - 2, 2), fill=shade(body, 1.15) + (255,))
    # windows (bus goes left: driver on the left)
    d.rectangle(R_(4, 7, 16, 15), fill=OUTLINE)
    d.rectangle(R_(5, 8, 14, 13), fill=(120, 180, 230, 255))
    for k in range(7):
        wx = 24 + k * 17
        if k == 1:
            d.rectangle(R_(wx, 7, 12, 31), fill=OUTLINE)  # door
            d.rectangle(R_(wx + 1, 8, 10, 29), fill=(90, 140, 190, 255))
            continue
        d.rectangle(R_(wx, 7, 14, 13), fill=OUTLINE)
        d.rectangle(R_(wx + 1, 8, 12, 11), fill=(120, 180, 230, 255))
        d.point((wx + 2, 9), fill=(220, 240, 255, 255))
        if R.random() < 0.6:  # passenger heads
            d.ellipse([wx + 4, 12, wx + 9, 18], fill=R.choice([(120, 80, 60), (60, 40, 30), (200, 150, 110)]) + (255,))
    # destination display
    d.rectangle(R_(4, 2, 40, 4), fill=(30, 30, 30, 255))
    text(d, 6, 1, 'PAULISTA', (255, 170, 40, 255))
    # wheels
    for wx in (24, 118):
        d.ellipse([wx - 9, H - 18, wx + 9, H - 1], fill=OUTLINE)
        d.ellipse([wx - 5, H - 14, wx + 5, H - 5], fill=(170, 170, 176, 255))
        d.ellipse([wx - 2, H - 11, wx + 2, H - 8], fill=(90, 90, 96, 255))
    d.rectangle(R_(1, H - 12, 3, 3), fill=(255, 230, 120, 255))  # headlight
    save(img, name)


# ------------------------------------------------------------------ obstacles (front lane)
def cone():
    W, H = 18, 24
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    o, w = (248, 112, 32, 255), (250, 250, 250, 255)
    d.rectangle(R_(0, H - 4, W, 4), fill=OUTLINE)
    d.rectangle(R_(1, H - 3, W - 2, 2), fill=(206, 80, 20, 255))
    d.polygon([(W // 2 - 2, 0), (W // 2 + 1, 0), (W - 3, H - 4), (2, H - 4)], fill=OUTLINE)
    d.polygon([(W // 2 - 1, 1), (W // 2, 1), (W - 4, H - 5), (3, H - 5)], fill=o)
    d.rectangle(R_(5, 9, 8, 3), fill=w)
    d.rectangle(R_(4, 15, 10, 2), fill=w)
    d.line([(W // 2 + 1, 2), (W - 5, H - 6)], fill=(200, 80, 20, 255))
    d.point((W // 2 - 1, 3), fill=(255, 190, 120, 255))
    save(img, 'obs_cone')


def boxes(name, stack):
    W = 26
    H = 20 * stack + 1
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    for k in range(stack):
        y = H - 20 * (k + 1) - 1
        x = 0 if k == 0 else 2
        bw = W if k == 0 else W - 4
        d.rectangle(R_(x, y, bw, 21), fill=OUTLINE)
        d.rectangle(R_(x + 1, y + 1, bw - 2, 19), fill=(214, 160, 98, 255))
        d.rectangle(R_(x + 1, y + 1, bw - 2, 3), fill=(236, 190, 128, 255))
        d.rectangle(R_(x + bw // 2 - 2, y + 1, 4, 19), fill=(196, 170, 120, 255))  # tape
        d.rectangle(R_(x + bw - 4, y + 4, 2, 16), fill=(178, 126, 74, 255))
        d.rectangle(R_(x + 4, y + 10, 5, 4), fill=(140, 96, 60, 255))  # stamp
    save(img, name)


def barrier():
    W, H = 38, 28
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    for lx in (3, W - 6):
        d.rectangle(R_(lx, 6, 3, H - 6), fill=OUTLINE)
        d.rectangle(R_(lx - 2, H - 3, 7, 3), fill=OUTLINE)
    for by in (4, 15):
        d.rectangle(R_(0, by, W, 8), fill=OUTLINE)
        for i in range(1, W - 1):
            c = (250, 250, 250, 255) if ((i + by) // 5) % 2 else (240, 70, 40, 255)
            d.rectangle([i, by + 1, i, by + 6], fill=c)
    d.ellipse([W // 2 - 3, 0, W // 2 + 3, 5], fill=OUTLINE)
    d.ellipse([W // 2 - 2, 1, W // 2 + 2, 4], fill=(255, 190, 40, 255))
    save(img, 'obs_barrier')


def lixeira():
    """The orange street bin of São Paulo."""
    W, H = 18, 30
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    d.rectangle(R_(7, 10, 4, H - 10), fill=OUTLINE)
    d.rectangle(R_(8, 10, 2, H - 10), fill=(90, 90, 100, 255))
    d.rectangle(R_(4, H - 3, 10, 3), fill=OUTLINE)
    d.rectangle(R_(0, 0, W, 18), fill=OUTLINE)
    d.rectangle(R_(1, 1, W - 2, 16), fill=(248, 128, 30, 255))
    d.rectangle(R_(1, 1, W - 2, 3), fill=(255, 176, 90, 255))
    d.rectangle(R_(3, 5, W - 6, 2), fill=(60, 30, 20, 255))
    d.rectangle(R_(W - 4, 4, 2, 12), fill=(210, 96, 20, 255))
    save(img, 'obs_lixeira')


def hole():
    """Open manhole / buraco: drawn flush with the sidewalk."""
    W, H = 40, 10
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    d.ellipse([0, 0, W - 1, H - 1], fill=(120, 116, 110, 255))
    d.ellipse([2, 1, W - 3, H - 2], fill=OUTLINE)
    d.ellipse([5, 2, W - 6, H - 3], fill=(10, 8, 14, 255))
    d.line([(6, 3), (W - 8, 3)], fill=(60, 56, 60, 255))
    # rubble bits
    for (rx, ry) in [(1, 7), (W - 4, 6), (8, 8), (W - 10, 8)]:
        d.rectangle(R_(rx, ry, 3, 2), fill=(150, 140, 128, 255))
    save(img, 'obs_hole')


def plank_sign():
    """Hanging road-works sign suspended by thick cables from above (pass under it)."""
    W, H = 60, 220
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    for cx in (9, W - 11):
        d.rectangle(R_(cx, 0, 3, H - 30), fill=OUTLINE)
        d.rectangle(R_(cx + 1, 0, 1, H - 30), fill=(110, 110, 124, 255))
    y = H - 32
    d.rectangle(R_(0, y, W, 32), fill=OUTLINE)
    for i in range(1, W - 1):  # hazard border
        for yy in (y + 1, y + 2, y + 28, y + 29, y + 30):
            d.point((i, yy), fill=(255, 210, 40, 255) if ((i + yy) // 4) % 2 else (24, 20, 34, 255))
    d.rectangle(R_(1, y + 3, W - 2, 25), fill=(255, 210, 40, 255))
    d.rectangle(R_(1, y + 3, W - 2, 2), fill=(255, 238, 140, 255))
    text(d, (W - text_w('CUIDADO')) // 2, y + 7, 'CUIDADO', OUTLINE)
    text(d, (W - text_w('OBRAS')) // 2, y + 16, 'OBRAS', (200, 40, 30, 255))
    d.rectangle(R_(1, y + 26, W - 2, 2), fill=(210, 150, 20, 255))
    save(img, 'obs_sign')


def beam():
    """Construction beam (viga) hanging from crane chains, with hazard stripes."""
    W, H = 76, 220
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    for cx in (14, W - 16):
        for yy in range(0, H - 22, 5):
            d.rectangle(R_(cx - 2, yy, 5, 4), fill=OUTLINE)
            d.rectangle(R_(cx - 1, yy + 1, 3, 2), fill=(150, 150, 164, 255))
    y = H - 22
    d.rectangle(R_(0, y, W, 22), fill=OUTLINE)
    d.rectangle(R_(1, y + 1, W - 2, 4), fill=(150, 156, 168, 255))
    for i in range(1, W - 1):
        c = (255, 200, 30, 255) if ((i + 100) // 6) % 2 else (40, 36, 44, 255)
        d.rectangle([i, y + 6, i, y + 15], fill=c)
    d.rectangle(R_(1, y + 16, W - 2, 5), fill=(110, 116, 128, 255))
    d.rectangle(R_(1, y + 1, W - 2, 1), fill=(200, 206, 216, 255))
    save(img, 'obs_beam')


def awning():
    """Low shop awning (toldo) on a frame that hangs from above."""
    W, H = 64, 220
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    for px in (2, W - 6):
        d.rectangle(R_(px, 0, 4, H - 26), fill=OUTLINE)
        d.rectangle(R_(px + 1, 0, 1, H - 26), fill=(120, 120, 134, 255))
    y = H - 28
    d.polygon([(0, y), (W - 1, y), (W - 1, y + 20), (0, y + 20)], fill=OUTLINE)
    for i in range(1, W - 1):
        c = (40, 170, 90, 255) if (i // 6) % 2 else (250, 250, 240, 255)
        d.rectangle([i, y + 1, i, y + 18], fill=c)
    # scalloped edge
    for i in range(0, W, 8):
        d.ellipse([i, y + 16, i + 7, y + 27], fill=OUTLINE)
        d.ellipse([i + 1, y + 16, i + 6, y + 25], fill=(40, 170, 90, 255) if (i // 8) % 2 else (250, 250, 240, 255))
    d.rectangle(R_(0, y + 14, W, 3), fill=(0, 0, 0, 0))
    d.rectangle(R_(0, y + 14, W, 1), fill=OUTLINE)
    for i in range(1, W - 1):
        c = (40, 170, 90, 255) if (i // 6) % 2 else (250, 250, 240, 255)
        d.rectangle([i, y + 15, i, y + 16], fill=c)
    save(img, 'obs_awning')


def pigeons():
    """Flock of 3 pigeons, 2 animation frames side by side (flying at head height)."""
    FW, H = 48, 22
    img = Image.new('RGBA', (FW * 2, H)); d = ImageDraw.Draw(img)
    body, wing, wingd = (150, 150, 168, 255), (186, 186, 200, 255), (110, 110, 126, 255)
    pos = [(6, 9), (22, 3), (34, 12)]
    for f in range(2):
        ox = f * FW
        for (bx, by) in pos:
            x, y = ox + bx, by
            d.rectangle(R_(x, y + 2, 9, 4), fill=OUTLINE)
            d.rectangle(R_(x + 1, y + 3, 7, 2), fill=body)
            d.rectangle(R_(x - 2, y + 1, 4, 4), fill=OUTLINE)
            d.rectangle(R_(x - 1, y + 2, 2, 2), fill=(90, 150, 130, 255))
            d.point((x - 3, y + 3), fill=(240, 160, 60, 255))
            d.point((x - 1, y + 2), fill=(240, 60, 40, 255))
            if f == 0:
                d.polygon([(x + 2, y + 2), (x + 7, y + 2), (x + 9, y - 3), (x + 5, y - 2)], fill=OUTLINE)
                d.polygon([(x + 3, y + 2), (x + 6, y + 2), (x + 8, y - 2)], fill=wing)
            else:
                d.polygon([(x + 2, y + 5), (x + 7, y + 5), (x + 9, y + 10), (x + 5, y + 9)], fill=OUTLINE)
                d.polygon([(x + 3, y + 5), (x + 6, y + 5), (x + 8, y + 9)], fill=wingd)
            d.rectangle(R_(x + 9, y + 3, 3, 2), fill=OUTLINE)
    save(img, 'obs_pigeons')


# ------------------------------------------------------------------ coin + fx
def coin():
    """8-frame spinning gold coin (12x12 each) with a 'S' stamp."""
    N, S = 8, 12
    img = Image.new('RGBA', (N * S, S)); d = ImageDraw.Draw(img)
    gold, gl, gd, gdd = (255, 206, 40, 255), (255, 244, 160, 255), (220, 150, 20, 255), (150, 90, 10, 255)
    widths = [12, 10, 7, 3, 2, 3, 7, 10]
    for f, w in enumerate(widths):
        x0 = f * S + (S - w) // 2
        if w <= 3:
            d.rectangle(R_(f * S + S // 2 - 1, 0, 2, S), fill=gdd)
            d.rectangle(R_(f * S + S // 2 - 1, 1, 1, S - 2), fill=gd)
            continue
        d.ellipse([x0, 0, x0 + w - 1, S - 1], fill=gdd)
        d.ellipse([x0 + 1, 1, x0 + w - 2, S - 2], fill=gold)
        d.ellipse([x0 + 2, 2, x0 + w - 3, S - 3], fill=gd if f >= 5 else gold)
        if w >= 10:
            d.rectangle(R_(f * S + 5, 3, 2, 6), fill=gd)
            d.rectangle(R_(f * S + 4, 3, 4, 1), fill=gd)
            d.rectangle(R_(f * S + 4, 8, 4, 1), fill=gd)
        d.point((x0 + 2, 3), fill=gl); d.point((x0 + 2, 4), fill=gl); d.point((x0 + 3, 2), fill=gl)
    save(img, 'coin')


def fx():
    # sparkle 4 frames 9x9
    img = Image.new('RGBA', (36, 9)); d = ImageDraw.Draw(img)
    for f, r in enumerate([1, 3, 4, 2]):
        cx = f * 9 + 4
        c = (255, 255, 220, 255)
        d.rectangle(R_(cx - r, 4, 2 * r + 1, 1), fill=c)
        d.rectangle(R_(cx, 4 - r, 1, 2 * r + 1), fill=c)
        if r >= 3:
            d.point((cx - 1, 3), fill=(255, 220, 80, 255)); d.point((cx + 1, 5), fill=(255, 220, 80, 255))
    save(img, 'sparkle')
    # dust puff 3x3 / pixel particle
    img = Image.new('RGBA', (4, 4)); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 3, 3], fill=(236, 230, 214, 255)); d.rectangle([0, 3, 3, 3], fill=(200, 194, 180, 255))
    save(img, 'dust')
    img = Image.new('RGBA', (2, 2), (255, 255, 255, 255))
    save(img, 'pixel')
    # impact star
    img = Image.new('RGBA', (24, 24)); d = ImageDraw.Draw(img)
    pts = []
    for k in range(16):
        r = 11 if k % 2 == 0 else 5
        a = k / 16 * math.pi * 2
        pts.append((12 + r * math.cos(a), 12 + r * math.sin(a)))
    d.polygon(pts, fill=OUTLINE)
    pts2 = [(12 + (p[0] - 12) * 0.78, 12 + (p[1] - 12) * 0.78) for p in pts]
    d.polygon(pts2, fill=(255, 240, 120, 255))
    d.ellipse([9, 9, 15, 15], fill=(255, 255, 255, 255))
    save(img, 'impact')
    # player shadow
    img = Image.new('RGBA', (30, 6)); d = ImageDraw.Draw(img)
    d.ellipse([0, 0, 29, 5], fill=(40, 40, 60, 90))
    save(img, 'shadow')
    img = Image.new('RGBA', (40, 8)); d = ImageDraw.Draw(img)
    d.ellipse([0, 0, 39, 7], fill=(30, 26, 50, 120))
    d.ellipse([4, 1, 35, 6], fill=(30, 26, 50, 170))
    save(img, 'shadow_hazard')


if __name__ == '__main__':
    sky(); clouds(); far(); mid(); road(); sidewalk(); props()
    bus('bus_a', (40, 140, 90), (250, 210, 40))
    bus('bus_b', (40, 110, 200), (240, 240, 240))
    cone(); boxes('obs_box', 1); boxes('obs_box2', 2); barrier(); lixeira(); hole()
    plank_sign(); beam(); awning(); pigeons(); coin(); fx()
    print('ok')
