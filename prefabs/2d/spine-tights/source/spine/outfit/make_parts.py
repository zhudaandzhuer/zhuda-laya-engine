# Parts for the outfit rig, from the two generated images (../../blender/legs-bare.png, skirt.png).
# Canvas = the legs photo (1024 x 1536). Back to front: bg, skirt_back, body, skirt.
import json, sys
import numpy as np
from PIL import Image, ImageFilter

here = sys.argv[1]
legs = np.asarray(Image.open(f"{here}/../../blender/legs-bare.png").convert("RGB")).astype(np.float32)
H, W, _ = legs.shape
bgcol = np.median(np.concatenate([legs[:, :100], legs[:, -100:]], axis=1), axis=1)  # per row
diff = np.abs(legs - bgcol[:, None, :]).sum(axis=2)
fig = diff > 26
# Below the ankles only the shoes (dark) and skin (warm) are figure: the floor's shadow and its sheen are not.
lum = legs @ np.array([0.3, 0.6, 0.1], np.float32)
warm = legs[..., 0] - legs[..., 2]
low = np.arange(H)[:, None] > int(H * 0.83)
fig &= ~low | (lum < 55) | ((warm > 14) & (lum > 80))
fig[:, :150] = False
fig[:, -150:] = False
# Keep the figure's big connected region (drop floor specks) by row-run filtering and a small blur.
m = Image.fromarray((fig * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(7))
fig = np.asarray(m) > 127
# Only what is joined to the figure (flood from the waist): floor reflections are separate islands.
from collections import deque
keep = np.zeros_like(fig)
seed = (200, W // 2)
q = deque([seed]); keep[seed] = fig[seed]
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = y + dy, x + dx
        if 0 <= yy < H and 0 <= xx < W and fig[yy, xx] and not keep[yy, xx]:
            keep[yy, xx] = True
            q.append((yy, xx))
fig = keep
rows = np.where(fig.any(axis=1))[0]
print("figure rows", rows[0], rows[-1])
alpha = Image.fromarray((fig * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
body = Image.fromarray(legs.astype(np.uint8)).convert("RGBA"); body.putalpha(alpha)
body.save(f"{here}/parts/body.png")
bg = np.repeat(bgcol[:, None, :], W, axis=1).astype(np.uint8)
# The background is drawn by the game (not part of the rig): kept beside the parts.
Image.fromarray(bg).save(f"{here}/bg.png")

sk = Image.open(f"{here}/../../public/assets/art/skirt.png").convert("RGBA")
sw = 737
sh = round(sk.height * sw / sk.width)
sk = sk.resize((sw, sh), Image.LANCZOS)
sx, sy = (W - sw) // 2, 61
sk.save(f"{here}/parts/skirt.png")
# The back of the skirt, seen inside when the front is lifted: the same cloth darker, its lining.
a = np.asarray(sk).astype(np.float32)
a[..., :3] *= 0.32
back = Image.fromarray(a.astype(np.uint8), "RGBA")
back.save(f"{here}/parts/skirt_back.png")
man = {"canvas": [W, H], "parts": [
    {"name": "skirt_back", "file": "skirt_back.png", "x": sx, "y": sy, "w": sw, "h": sh},
    {"name": "body", "file": "body.png", "x": 0, "y": 0, "w": W, "h": H},
    {"name": "skirt", "file": "skirt.png", "x": sx, "y": sy, "w": sw, "h": sh},
]}
json.dump(man, open(f"{here}/parts/manifest.json", "w"), indent=1)
comp = Image.fromarray(bg).convert("RGBA")
for p in man["parts"]:
    comp.alpha_composite(Image.open(f"{here}/parts/{p['file']}"), (p["x"], p["y"]))
comp.convert("RGB").save(f"{here}/parts/keyart.png")
print("skirt at", sx, sy, sw, sh)
