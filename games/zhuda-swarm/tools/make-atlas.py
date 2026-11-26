# The pictures this script reads are not in this repository (they are in the owner's verification
# repository); its outputs under assets/ are tracked. Kept as the record of how they were made.
# One atlas for everything the field draws (one texture: the 2D renderer can batch it):
# round tokens of the beasts cut from deliverables/*-hd/previews/<id>-views.jpg, 豬大 drawn here,
# gems, shots, rings and a soft shadow. Writes assets/atlas.png and assets/atlas.json.
#   python3 -I tools/make-atlas.py
import json, math, os
from PIL import Image, ImageDraw, ImageFilter
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.join(here, '..', '..', '..')
S = 4  # supersampling
frames, cells = {}, []

def token(id, size, ring):
    src = None
    for s in ('beasts-hd', 'bosses-hd'):
        p = os.path.join(repo, 'deliverables', s, 'previews', f'{id}-views.jpg')
        if os.path.exists(p): src = p
    im = Image.open(src).convert('RGB'); w, h = im.size; cw, ch = w / 6, h / 2
    boss = 'bosses' in src
    side = min(cw, ch) * (0.98 if boss else 0.62); cx, cy = cw / 2, ch * (0.5 if boss else 0.56)
    im = im.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))).resize((size * S, size * S), Image.LANCZOS)
    out = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    mask = Image.new('L', (size * S, size * S), 0); ImageDraw.Draw(mask).ellipse((3 * S, 3 * S, size * S - 3 * S, size * S - 3 * S), fill=255)
    out.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(out); d.ellipse((2 * S, 2 * S, size * S - 2 * S, size * S - 2 * S), outline=ring, width=3 * S)
    d.ellipse((1 * S, 1 * S, size * S - 1 * S, size * S - 1 * S), outline=(20, 16, 12, 255), width=S)
    return out.resize((size, size), Image.LANCZOS)

def draw(size, fn):
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0)); fn(ImageDraw.Draw(im), size * S); return im.resize((size, size), Image.LANCZOS)

def pig(d, n):
    k = n / 96
    for x in (20, 76):  # ears
        d.polygon([((x - 14) * k, 26 * k), ((x + 14) * k, 26 * k), (x * k, 2 * k)], fill=(232, 130, 140, 255), outline=(60, 30, 30, 255))
    d.ellipse((6 * k, 10 * k, 90 * k, 92 * k), fill=(248, 178, 184, 255), outline=(60, 30, 30, 255), width=int(3 * k))
    d.ellipse((30 * k, 48 * k, 66 * k, 74 * k), fill=(236, 140, 150, 255), outline=(60, 30, 30, 255), width=int(2 * k))
    for x in (41, 55): d.ellipse(((x - 3) * k, 57 * k, (x + 3) * k, 65 * k), fill=(110, 50, 60, 255))
    for x in (32, 64): d.ellipse(((x - 5) * k, 32 * k, (x + 5) * k, 44 * k), fill=(40, 26, 26, 255)); d.ellipse(((x - 2) * k, 34 * k, (x + 1) * k, 38 * k), fill=(255, 255, 255, 255))
    d.arc((20 * k, 60 * k, 76 * k, 88 * k), 20, 160, fill=(90, 40, 46, 255), width=int(2 * k))

def gem(color):
    def f(d, n):
        d.polygon([(n / 2, n * 0.06), (n * 0.9, n * 0.42), (n / 2, n * 0.94), (n * 0.1, n * 0.42)], fill=color, outline=(255, 255, 255, 255))
        d.polygon([(n / 2, n * 0.06), (n * 0.66, n * 0.42), (n / 2, n * 0.94), (n * 0.34, n * 0.42)], fill=tuple(min(255, c + 60) for c in color[:3]) + (255,))
    return f

def orb(inner, outer):
    def f(d, n):
        for i in range(12, 0, -1):  # a soft glow outside, a solid bright core
            k = i / 12; r = n / 2 * k
            a = 255 if k <= 0.5 else int(255 * ((1 - k) / 0.5) ** 1.3)
            c = tuple(int(outer[j] + (inner[j] - outer[j]) * min(1, (1 - k) / 0.6)) for j in range(3)) + (a,)
            d.ellipse((n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r), fill=c)
    return f

def ring(color, width):
    def f(d, n):
        d.ellipse((n * 0.04, n * 0.04, n * 0.96, n * 0.96), outline=color, width=int(n * width))
        d.ellipse((n * 0.1, n * 0.1, n * 0.9, n * 0.9), fill=color[:3] + (36,))
    return f

def slash(d, n):
    for i in range(14):
        a = 255 - i * 16
        d.arc((n * 0.06 + i * S, n * 0.06 + i * S, n * 0.94 - i * S, n * 0.94 - i * S), 200, 340, fill=(255, 250, 220, max(0, a)), width=2 * S)

def shadow(d, n):
    for i in range(8, 0, -1): d.ellipse((n / 2 - n / 2 * i / 8, n * 0.3 - 0 + n * 0.2 * (1 - i / 8), n / 2 + n / 2 * i / 8, n * 0.7 + 0 - n * 0.2 * (1 - i / 8)), fill=(0, 0, 0, int(14 * (9 - i))))

def bolt(d, n):
    pts = [(n * 0.5, 0), (n * 0.3, n * 0.4), (n * 0.55, n * 0.42), (n * 0.35, n), (n * 0.75, n * 0.32), (n * 0.5, n * 0.3), (n * 0.7, 0)]
    d.polygon(pts, fill=(255, 245, 150, 255), outline=(255, 255, 255, 255))

RINGS = {'zheng': (200, 80, 60, 255), 'jiuweihu': (220, 220, 240, 255), 'kui': (90, 130, 200, 255), 'bifang': (60, 170, 150, 255), 'taotie': (120, 150, 80, 255), 'qiongqi': (230, 160, 60, 255), 'jiuying': (150, 90, 200, 255)}
items = [('pig', draw(96, pig))]
items += [(k, token(k, 72 if k in ('zheng', 'jiuweihu') else 88 if k != 'taotie' else 112, v)) for k, v in RINGS.items()]
items += [('xingtian', token('xingtian', 220, (255, 200, 60, 255)))]
items += [('gem-s', draw(28, gem((80, 200, 255, 255)))), ('gem-m', draw(34, gem((120, 240, 130, 255)))), ('gem-l', draw(42, gem((255, 120, 200, 255)))), ('coin', draw(32, orb((255, 240, 150), (220, 150, 30)))),
          ('heart', draw(36, orb((255, 180, 190), (230, 50, 70)))), ('shot', draw(36, orb((255, 250, 200), (255, 150, 40)))), ('fire', draw(56, orb((255, 240, 180), (255, 80, 20)))), ('frost', draw(48, orb((230, 250, 255), (80, 160, 255)))),
          ('ring-thunder', draw(256, ring((255, 240, 120, 255), 0.03))), ('ring-vine', draw(256, ring((120, 220, 110, 255), 0.02))), ('slash', draw(256, slash)), ('shadow', draw(96, shadow)), ('bolt', draw(64, bolt)), ('white', Image.new('RGBA', (8, 8), (255, 255, 255, 255)))]
W = 1024; x = y = row = 2
atlas = Image.new('RGBA', (W, 1024), (0, 0, 0, 0))
for name, im in sorted(items, key=lambda t: -t[1].size[1]):
    w, h = im.size
    if x + w + 2 > W: x, y, row = 2, y + row + 2, 0
    atlas.paste(im, (x, y)); frames[name] = [x, y, w, h]; x += w + 2; row = max(row, h)
H = 1 << math.ceil(math.log2(y + row + 2))
atlas.crop((0, 0, W, H)).save(os.path.join(here, '..', 'assets', 'atlas.png'), optimize=True)
json.dump({'size': [W, H], 'frames': frames}, open(os.path.join(here, '..', 'assets', 'atlas.json'), 'w'), indent=1)
print('atlas', W, H, len(frames), 'frames')
