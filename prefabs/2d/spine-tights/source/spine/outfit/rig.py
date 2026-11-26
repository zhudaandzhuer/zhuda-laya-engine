"""outfit -- 沈知微's pleated skirt over her legs (the stocking-tear-2d game), as a Spine 4.2 rig.

Canvas = the legs photo (1024 x 1536), parts from make_parts.py. The skirt is one weighted mesh driven
by nine parallel chains fanning from the waistband to the hem (W.sheet), each with Spine physics, so it
swings, flutters and settles by itself. Each chain also has a two-bone IK on its lower bones toward a
`grab_N` bone (mix 0 at rest): the game grabs the chain nearest the finger, sets that IK's mix to 1 and
moves its target with the finger; the physics of the other chains carries the rest of the skirt.
The back of the skirt (its dark lining) hangs behind the legs and shows where the front is lifted.
"""
import json, math
from pathlib import Path
import numpy as np
from spinekit import weights as W

SITES = json.load(open(Path(__file__).with_name("sites.json")))

NAME = "outfit"

WAIST_Y, BAND_Y = 61, 101          # top of the waistband, bottom of it (pleats start)
TOP_X = (313, 710)                 # pleats' start, left to right, at BAND_Y
HEM_X = (160, 863)                 # hem corners
HEM_SIDE_Y, HEM_MID_Y = 478, 565   # the hem is lower in the middle (the skirt is round)
CHAINS = 9
LINKS = 3


def hem_y(t):
    return HEM_SIDE_Y + (HEM_MID_Y - HEM_SIDE_Y) * math.sin(math.pi * t)


def build(rig):
    rig.frame(0, 0, 1024, 1536)
    rig.set_origin(512, 1536)
    rig.bone("root", at=(512, 1536))
    rig.bone("waist", "root", at=(511, 80), rot=0)

    chains = []
    for i in range(CHAINS):
        t = i / (CHAINS - 1)
        x0 = TOP_X[0] + (TOP_X[1] - TOP_X[0]) * t
        x1 = HEM_X[0] + (HEM_X[1] - HEM_X[0]) * t
        y1 = hem_y(t)
        pts = [(x0 + (x1 - x0) * k / LINKS, BAND_Y + (y1 - BAND_Y) * k / LINKS) for k in range(LINKS + 1)]
        chains.append(rig.chain(f"pleat{i}_", "waist", pts, inherit_first="noRotationOrReflection"))
        rig.bone(f"grab{i}", "root", at=pts[-1], rot=0)

    # The tights: a mesh, each tear site's pull bone carrying the nylon round it (a soft bump of it,
    # about a leg's width across); the tear patches ride on the same bones.
    for s in SITES:
        rig.bone(f"pull_{s['name']}", "root", at=(s["x"], s["y"]), rot=0)

    def tights_weights(rig_, sx, sy):
        out, total = {}, np.zeros_like(sx, dtype=np.float64)
        for s in SITES:
            # Narrow across the leg (the far side hardly moves: the nylon thins, the leg is not bared), longer along it.
            g = np.exp(-(((sx - s["x"]) / (0.3 * s["w"])) ** 2 + ((sy - s["y"]) / (0.5 * s["w"])) ** 2) / 2)
            out[f"pull_{s['name']}"] = g
            total += g
        out["root"] = np.clip(1.0 - total, 0.0, 1.0) + 1e-3
        return out

    rig.part("skirt_back", "waist")
    rig.part("body", "root")
    rig.part("tights", "root", mesh=dict(step=20, margin=2), weights=tights_weights)
    # A tear: the bare leg where the knit opened (slot tear_*), then its rolled lip (slot lip_*).
    for kind in ("tear", "lip"):
        for s in SITES:
            for stage in ("small", "large"):
                rig.part(f"{kind}_{s['name']}_{stage}", f"pull_{s['name']}", slot=f"{kind}_{s['name']}", active=False)
    rig.part("skirt", "waist", mesh=dict(cols=18, rows=16, margin=3), weights=W.sheet(chains, blend=0.55, root="waist", root_blend=0.35))

    for i, c in enumerate(chains):
        rig.ik(f"grab{i}_ik", c[-2:], f"grab{i}", bend_positive=(i < CHAINS // 2), mix=0)
    for c in chains:
        rig.physics_chain(c, inertia=(0.45, 0.8), strength=(150, 90), damping=(0.86, 0.9))

    mid = chains[CHAINS // 2]
    rig.stress("sway_left", pose={b: {"rot": -8} for c in chains for b in c})
    rig.stress("sway_right", pose={b: {"rot": 8} for c in chains for b in c})
    rig.stress("lift_middle", pose={mid[1]: {"rot": 70}, mid[2]: {"rot": 60}})
    rig.stress("flare", pose={c[0]: {"rot": -10 + 20 * i / (CHAINS - 1)} for i, c in enumerate(chains)})

    knee = next(s for s in SITES if s["name"] == "L_knee")
    rig.stress("pull_knee_out", pose={"pull_L_knee": {"x": -0.6 * knee["w"], "y": 6}})
    rig.stress("tears_small", slots={f"{k}_{s['name']}": f"{k}_{s['name']}_small" for s in SITES[::2] for k in ("tear", "lip")})
    rig.stress("tears_large", slots={f"{k}_{s['name']}": f"{k}_{s['name']}_large" for s in SITES[1::2] for k in ("tear", "lip")})

    a = rig.animation("idle", duration=4.0, loop=True)
    for i, c in enumerate(chains):
        a.sway(c, 0.8, period=4, lag=0.1, grow=1.25, phase=i * 0.04)

    rig.contract(title="outfit", animations={"idle": {"loop": True, "track": 0, "role": "base"}})
