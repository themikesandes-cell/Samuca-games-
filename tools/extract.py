"""Extract Samuca frames from the AI sprite sheet into a clean pixel-art atlas.

Steps: background key -> connected blobs -> drop ground shadow -> head-anchored
alignment -> area downscale -> alpha threshold -> shared palette -> atlas + JSON.
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
OUT_DIR = sys.argv[2]
SCALE = 2.5          # source px per game px
FW, FH = 84, 72      # uniform frame size (game px)
BASE_Y = 70          # feet baseline inside frame

BG = np.array([139, 202, 253])
SHADOW = np.array([22, 66, 147])

img = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
H, W, _ = img.shape
dist = np.sqrt(((img - BG) ** 2).sum(-1))
mask = dist > 45
mask = ndimage.binary_closing(mask, iterations=2)
lab, n = ndimage.label(mask)
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(mask, lab, range(1, n + 1))

blobs = []
for i, (s, sz) in enumerate(zip(objs, sizes)):
    if sz < 3000:
        continue
    blobs.append(dict(id=i + 1, y0=s[0].start, y1=s[0].stop, x0=s[1].start, x1=s[1].stop))
# rows by vertical centre
rows_y = [93, 266, 450, 625, 780, 935]
rows = [[] for _ in rows_y]
for b in blobs:
    cy = (b['y0'] + b['y1']) / 2
    r = int(np.argmin([abs(cy - y) for y in rows_y]))
    rows[r].append(b)
for r in rows:
    r.sort(key=lambda b: b['x0'])
print('per row', [len(r) for r in rows])


def cut(b, pad=6):
    y0, y1 = max(0, b['y0'] - pad), min(H, b['y1'] + pad)
    x0, x1 = max(0, b['x0'] - pad), min(W, b['x1'] + pad)
    rgb = img[y0:y1, x0:x1].copy()
    m = (lab[y0:y1, x0:x1] == b['id'])
    filled = ndimage.binary_fill_holes(m)
    holes, nh = ndimage.label(filled & ~m)
    if nh:
        hs = ndimage.sum(holes > 0, holes, range(1, nh + 1))
        for j, hsz in enumerate(hs):
            if hsz < 120:
                m |= holes == (j + 1)
    # remove ground shadow band (bottom rows, shadow coloured)
    hh = m.shape[0]
    rows_with = np.where(m.any(1))[0]
    bottom = rows_with.max()
    band = np.zeros_like(m)
    band[max(0, bottom - 8):bottom + 1] = True
    sd = np.sqrt(((rgb - SHADOW) ** 2).sum(-1))
    m &= ~(band & (sd < 62))
    # keep only the biggest component
    l2, n2 = ndimage.label(m)
    if n2 > 1:
        s2 = ndimage.sum(m, l2, range(1, n2 + 1))
        m = l2 == (int(np.argmax(s2)) + 1)
    return rgb, m


def downscale(rgb, m):
    h, w = m.shape
    nw, nh = max(1, round(w / SCALE)), max(1, round(h / SCALE))
    a = m.astype(float)
    pre = rgb * a[..., None]
    pre_i = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8))
    a_i = Image.fromarray((a * 255).astype(np.uint8))
    pre_s = np.asarray(pre_i.resize((nw, nh), Image.BOX)).astype(float)
    a_s = np.asarray(a_i.resize((nw, nh), Image.BOX)).astype(float) / 255
    out_a = a_s >= 0.45
    col = np.zeros_like(pre_s)
    nz = a_s > 0
    col[nz] = pre_s[nz] / a_s[nz][..., None]
    return np.clip(col, 0, 255), out_a


def head_cx(m):
    ys = np.where(m.any(1))[0]
    top, bot = ys.min(), ys.max()
    cut_y = top + int((bot - top) * 0.42)
    xs = np.where(m[top:cut_y].any(0))[0]
    return (xs.min() + xs.max()) / 2


def place(col, a, anchor='head', dy=0):
    frame = np.zeros((FH, FW, 4), np.uint8)
    ys = np.where(a.any(1))[0]
    xs = np.where(a.any(0))[0]
    bot = ys.max()
    if anchor == 'head':
        cx = head_cx(a)
        ox = int(round(FW / 2 + 4 - cx))
    else:
        cx = (xs.min() + xs.max()) / 2
        ox = int(round(FW / 2 - cx))
    oy = BASE_Y - bot + dy
    h, w = a.shape
    for y in range(h):
        fy = y + oy
        if not 0 <= fy < FH:
            continue
        for x in range(w):
            fx = x + ox
            if a[y, x] and 0 <= fx < FW:
                frame[fy, fx, :3] = col[y, x]
                frame[fy, fx, 3] = 255
    return frame


# animation spec: name -> list of (row, idx, anchor, dy)
SPEC = {
    'idle':    [(0, 0, 'box', 0), (0, 1, 'box', 0), (0, 0, 'box', 0), (0, 6, 'box', 0)],
    'run':     [(1, i, 'head', 0) for i in range(10)],
    'jump':    [(2, 1, 'head', 0), (2, 2, 'head', 0), (2, 3, 'head', 0), (2, 4, 'head', 0)],
    'fall':    [(2, 4, 'head', 0), (2, 3, 'head', 0), (2, 6, 'head', 0)],
    'land':    [(2, 5, 'head', 0)],
    'slide':   [(3, 2, 'box', 0), (3, 3, 'box', 0), (3, 4, 'box', 0), (3, 5, 'box', 0), (3, 6, 'box', 0)],
    'coin':    [(2, 2, 'head', 0), (2, 3, 'head', 0), (2, 2, 'head', 0)],
    'trip':    [(4, 0, 'box', 0), (4, 1, 'box', 0), (4, 2, 'box', 0), (4, 3, 'box', 0)],
    'cheer':   [(5, 0, 'box', 0), (5, 1, 'box', 0), (5, 2, 'box', 0), (5, 0, 'box', 0), (5, 1, 'box', 0), (5, 6, 'box', 0)],
    'think':   [(5, 3, 'box', 0)],
    'hips':    [(5, 6, 'box', 0)],
}

cache = {}
frames = []  # (name, rgba)
for anim, lst in SPEC.items():
    for k, (r, i, anchor, dy) in enumerate(lst):
        key = (r, i, anchor, dy)
        if key not in cache:
            rgb, m = cut(rows[r][i])
            col, a = downscale(rgb, m)
            cache[key] = place(col, a, anchor, dy)
        frames.append((f'{anim}_{k}', cache[key]))

# shared palette quantisation
stack = np.concatenate([f[1].reshape(-1, 4) for f in frames])
opaque = stack[stack[:, 3] > 0][:, :3]
pal_img = Image.fromarray(opaque.reshape(1, -1, 3).astype(np.uint8)).quantize(colors=40, method=Image.MAXCOVERAGE if False else Image.MEDIANCUT)
palette = np.array(pal_img.getpalette()[:40 * 3]).reshape(-1, 3)


def quant(fr):
    out = fr.copy()
    op = fr[..., 3] > 0
    px = fr[op][:, :3].astype(int)
    d = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(-1)
    out[op, :3] = palette[d.argmin(1)]
    # drop light-blue halo pixels on the silhouette edge
    edge = op & ~ndimage.binary_erosion(op)
    bgd = np.sqrt(((out[..., :3].astype(int) - BG) ** 2).sum(-1))
    kill = (edge & (bgd < 95)) | (op & (bgd < 70))
    out[kill] = 0
    # strip leftover 1-2px shadow lines along the baseline
    for y in range(BASE_Y, BASE_Y - 4, -1):
        for x in range(FW):
            if out[y, x, 3] and (y == 0 or out[y - 1, x, 3] == 0 or y >= BASE_Y - 1):
                r, g, b = [int(v) for v in out[y, x, :3]]
                if b > r + 45 and b > g + 15 and not (r > 150 and g > 150):
                    above = out[y - 1, x, 3] if y > 0 else 0
                    if not above or y >= BASE_Y - 1:
                        out[y, x] = 0
    op2 = out[..., 3] > 0
    l3, n3 = ndimage.label(op2)
    if n3 > 1:
        s3 = ndimage.sum(op2, l3, range(1, n3 + 1))
        for j, sz in enumerate(s3):
            if sz < 6:
                out[l3 == j + 1] = 0
    return out


cols = 8
rows_n = (len(frames) + cols - 1) // cols
atlas = np.zeros((rows_n * FH, cols * FW, 4), np.uint8)
meta = {'frames': {}, 'meta': {'image': 'samuca.png', 'size': {'w': cols * FW, 'h': rows_n * FH}, 'scale': '1'}}
for k, (name, fr) in enumerate(frames):
    q = quant(fr)
    cx, cy = (k % cols) * FW, (k // cols) * FH
    atlas[cy:cy + FH, cx:cx + FW] = q
    meta['frames'][name] = {
        'frame': {'x': cx, 'y': cy, 'w': FW, 'h': FH},
        'rotated': False, 'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': FW, 'h': FH},
        'sourceSize': {'w': FW, 'h': FH},
    }
Image.fromarray(atlas).save(f'{OUT_DIR}/samuca.png')
json.dump(meta, open(f'{OUT_DIR}/samuca.json', 'w'), indent=1)
anims = {a: len(l) for a, l in SPEC.items()}
json.dump(anims, open(f'{OUT_DIR}/samuca_anims.json', 'w'))
print('frames', len(frames), 'atlas', atlas.shape)
