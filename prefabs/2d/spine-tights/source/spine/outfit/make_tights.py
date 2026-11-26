# The tights and their tears for the outfit rig, from photos of real nylon (../../blender/nylon-*.png:
# sheer black 20-denier hosiery over a white card, made with gpt-image-2.6). On a white card a
# pixel's brightness is how much light the nylon lets through (its transmission T).
#
# - tights.png: black nylon over the legs. Its density is the swatch's, thicker where the leg turns
#   away from us (light crosses more nylon at a slant: T ** (1 / facing ** 0.6)), with a soft sheen down
#   the front of each leg.
# - sites.json: five tear sites a leg (thigh to shin), where the game pulls and tears.
# - tear_K_small.png / tear_K_large.png: what the leg looks like there once torn: the bare photo seen
#   through the tights whose transmission is multiplied by the torn photo's own relative to intact
#   nylon (the hole lets everything through, the rolled lip less, the ladders more). Outside the tear
#   that factor is 1, so a patch looks exactly like the tights it lies on.
import json, sys
import numpy as np
from PIL import Image, ImageFilter

here = sys.argv[1]
src = f"{here}/../../blender"
legs = np.asarray(Image.open(f"{src}/legs-bare.png").convert("RGB")).astype(np.float32) / 255
H, W, _ = legs.shape
body_a = np.asarray(Image.open(f"{here}/parts/body.png"))[..., 3].astype(np.float32) / 255

# Where the legs are (skin, below the shorts), and how squarely each point faces us (per-row runs).
lum = legs @ np.array([0.3, 0.6, 0.1], np.float32)
warm = legs[..., 0] - legs[..., 2]
skin = (body_a > 0.5) & (warm > 0.03) & (lum > 0.3)
skin[: int(H * 0.205)] = False
skin[int(H * 0.95):] = False
facing = np.zeros((H, W), np.float32)
legs_x = {}
for y in range(H):
    xs = np.where(skin[y])[0]
    if len(xs) < 4:
        continue
    runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
    runs = [r for r in runs if len(r) > 6]
    for r in runs:
        mid, half = (r[0] + r[-1]) / 2, max(1, (r[-1] - r[0]) / 2)
        t = (r - mid) / half
        facing[y, r] = np.sqrt(np.clip(1 - t * t, 0, 1))
    if len(runs) == 2:
        legs_x[y] = [(int(r[0]), int(r[-1])) for r in runs]
mask = Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
mask = np.asarray(mask).astype(np.float32) / 255
facing = np.asarray(Image.fromarray((facing * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0))).astype(np.float32) / 255

# The swatch: its transmission, and its fine variation (mostly finer than a pixel on the leg).
sw = np.asarray(Image.open(f"{src}/nylon-swatch.png").convert("L")).astype(np.float32) / 255
paper = np.percentile(sw, 99.5)
T0 = float(np.median(sw) / paper)
print("swatch transmission", round(T0, 3))
grain = np.asarray(Image.fromarray((sw / paper * 255).clip(0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS)).astype(np.float32) / 255
grain = grain / grain.mean()
tile = np.tile(grain, (H // 256 + 1, W // 256 + 1))[:H, :W]
T_face = np.clip(T0 * (0.9 + 0.1 * tile), 0.02, 1.0)
T = T_face ** (1.0 / np.maximum(facing, 0.12) ** 0.6)
a = (1 - T) * mask
# LayaAir blends in linear light: a sheer black over skin there comes out lighter than the same alpha
# blended in display values (as the patches, which are opaque, are baked). The alpha is raised so the
# result matches: 1 - a' = (1 - a) ** 2.2.
a_draw = a  # (an alpha raised for linear blending, 1 - (1 - a) ** 2.2, overshot in LayaAir: left as it is)

# Nylon's colour: near black, a soft sheen down the front where the photo is lit.
sheen = 0.14 * facing ** 6 * (0.5 + lum)
col = np.stack([0.012 + sheen, 0.011 + sheen, 0.014 + sheen * 1.05], axis=-1)
tights = np.concatenate([col, a_draw[..., None]], axis=-1)
Image.fromarray((tights.clip(0, 1) * 255).astype(np.uint8), "RGBA").save(f"{here}/parts/tights.png")

# Tear sites: five a leg, at the middle of each leg's run.
sites = []
for side, k in (("L", 0), ("R", 1)):
    # Below the skirt's hem (its middle hangs to 0.37 of the picture): above the knee to the lower shin.
    for name, yf in (("thigh", 0.40), ("lowthigh", 0.445), ("knee", 0.5), ("calf", 0.59), ("shin", 0.69)):
        y = int(H * yf)
        while y not in legs_x:
            y += 1
        x0, x1 = legs_x[y][k]
        sites.append({"name": f"{side}_{name}", "x": (x0 + x1) / 2, "y": y, "w": x1 - x0})

# The torn photos, relative to intact nylon: > 1 where the tear lets more light through.
def relative(path):
    im = np.asarray(Image.open(path).convert("L")).astype(np.float32) / 255
    paper = np.percentile(im, 99.8)
    t = im / paper
    base = np.median(t[np.abs(t - np.median(t)) < 0.15])
    return np.clip(t / base, 0.0, 1.0 / max(base, 1e-3)), base


parts = []
for stage, path, hole in (("small", f"{src}/nylon-tear-small.png", 0.5), ("large", f"{src}/nylon-tear-large.png", 0.7)):
    rel, base = relative(path)
    n = rel.shape[0]
    hole_px = n * (0.36 if stage == "small" else 0.5)  # the hole's width in the photo
    for s in sites:
        scale = hole * s["w"] / hole_px
        size = int(round(n * scale))
        r = np.asarray(Image.fromarray(rel.astype(np.float32), "F").resize((size, size), Image.BILINEAR))
        x0, y0 = int(round(s["x"] - size / 2)), int(round(s["y"] - size / 2))
        ys, xs = slice(max(0, y0), min(H, y0 + size)), slice(max(0, x0), min(W, x0 + size))
        rr = r[ys.start - y0: ys.stop - y0, xs.start - x0: xs.stop - x0]
        # Two decals over the tights, both clear outside the tear (so no seam, however it is blended):
        # the bare leg where the knit has opened (how far toward the open card it is), and more nylon
        # where it is denser than intact (the rolled lip, bunched yarn).
        hh, ww = rr.shape
        yy, xx = np.mgrid[0:hh, 0:ww]
        edge = np.clip(np.minimum(np.minimum(xx, ww - 1 - xx), np.minimum(yy, hh - 1 - yy)) / (0.12 * size), 0, 1)
        leg = mask[ys, xs] * edge
        opened = np.clip((rr - 1.0) / (1.0 / base - 1.0), 0, 1) ** 0.8 * leg
        denser = np.clip(1.0 - rr, 0, 1) * leg
        skin_img = np.concatenate([legs[ys, xs], opened[..., None]], axis=-1)
        rim_img = np.concatenate([col[ys, xs] * 0.7, denser[..., None]], axis=-1)
        for kind, img in (("tear", skin_img), ("lip", rim_img)):
            name = f"{kind}_{s['name']}_{stage}"
            Image.fromarray((img.clip(0, 1) * 255).astype(np.uint8), "RGBA").save(f"{here}/parts/{name}.png")
            parts.append({"name": name, "file": f"{name}.png", "x": xs.start, "y": ys.start, "w": ww, "h": hh})
json.dump(sites, open(f"{here}/sites.json", "w"), indent=1)

man = json.load(open(f"{here}/parts/manifest.json"))
names = [p["name"] for p in man["parts"]]
keep = [p for p in man["parts"] if not p["name"].startswith(("tear_", "lip_")) and p["name"] != "tights"]
# Back to front: skirt_back, body, tights, tears, skirt.
order = [p for p in keep if p["name"] in ("skirt_back", "body")]
order.append({"name": "tights", "file": "tights.png", "x": 0, "y": 0, "w": W, "h": H})
order += parts
order += [p for p in keep if p["name"] == "skirt"]
man["parts"] = order
json.dump(man, open(f"{here}/parts/manifest.json", "w"), indent=1)

# Previews: the tights at rest, and every large tear at once.
def comp(with_tears):
    out = legs.copy()
    out = out * (1 - a[..., None]) + col * a[..., None]
    if with_tears:
        for p in parts:
            if p["name"].endswith("_large") and p["name"].startswith("tear_"):
                im = np.asarray(Image.open(f"{here}/parts/{p['file']}")).astype(np.float32) / 255
                sl = (slice(p["y"], p["y"] + p["h"]), slice(p["x"], p["x"] + p["w"]))
                out[sl] = out[sl] * (1 - im[..., 3:]) + im[..., :3] * im[..., 3:]
    return Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))
Image.fromarray(np.hstack([np.asarray(comp(False)), np.asarray(comp(True))])).resize((W, H // 2)).save(f"{here}/tights_preview.png")
print("sites", len(sites), "patches", len(parts))
