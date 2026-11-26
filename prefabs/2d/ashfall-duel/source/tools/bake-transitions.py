"""Bake registered in-between cels from the game's two painted atlases.

Requires Python, Pillow, NumPy, OpenCV and Node. Run from the project root.
The app loads the resulting WebP sheets without any optical-flow runtime.

prefabs copy (2d/ashfall-duel/source/tools/): the original lived in the game's scripts/
and wrote src/motion-cels.json. Only three things changed, so it runs inside the module:
ROOT is the module folder (parents[2]), the key poses are read from ./motion.ts, and the
result is written as motion-cels.ts (the same JSON inside `export const CELS = ...;`).
"""

import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "assets/art"
SCALE = 0.78
W, H = 380, 352
ORIGIN = np.array([178, 335], np.float32)
GRID = np.dstack(np.meshgrid(np.arange(W), np.arange(H))).astype(np.float32)
# Endpoints come from the original lossless-alpha source cels.
CLIPS = {
    "knight": [
        (0, 1, 6),
        (0, 2, 11),
        (2, 3, 7),
        (3, 4, 13),
        (0, 4, 7),
        (4, 5, 7),
        (5, 6, 7),
        (0, 6, 7),
        (4, 6, 5),
        (0, 7, 9),
    ],
    "warden": [
        (0, 1, 6),
        (0, 2, 7),
        (2, 3, 10),
        (0, 3, 10),
        (0, 4, 6),
        (4, 5, 5),
        (5, 6, 8),
        (0, 5, 7),
        (6, 7, 11),
    ],
}
SHOULDERS = {
    "knight": [
        (189, 178),
        (591, 183),
        (991, 164),
        (1373, 151),
        (199, 682),
        (648, 721),
        (1022, 695),
        (1321, 710),
    ],
    "warden": [
        (247, 101),
        (682, 101),
        (1092, 122),
        (1560, 113),
        (253, 553),
        (683, 555),
        (1163, 554),
        (1510, 620),
    ],
}

# Opposite gauntlet and elbow track the arm which is occluded in several poses.
FAR_ARM = {
    "knight": [
        (283, 240, 212, 216),
        (685, 241, 608, 224),
        (898, 143, 874, 174),
        (1315, 87, 1273, 126),
        (310, 774, 225, 713),
        (776, 750, 702, 733),
        (1134, 805, 1054, 746),
        (1419, 756, 1352, 744),
    ],
    "warden": [
        (187, 153, 240, 175),
        (632, 158, 688, 179),
        (1155, 52, 1222, 71),
        (1694, 211, 1675, 168),
        (267, 641, 325, 591),
        (780, 628, 780, 577),
        (1259, 569, 1234, 612),
        (1518, 758, 1559, 693),
    ],
}


# Camera-facing arm plates, forearms and torso exposed behind them, traced in
# the local key-cel rectangle. Separating depth layers avoids pulling the visor
# through the gauntlets when the hands cross the body.
ARM_LAYERS = {
    0: [
        [
            (120, 88),
            (128, 71),
            (145, 64),
            (162, 68),
            (174, 81),
            (174, 101),
            (184, 117),
            (186, 135),
            (178, 151),
            (151, 150),
            (137, 134),
            (127, 112),
        ],
        [
            (154, 132),
            (166, 118),
            (181, 118),
            (191, 129),
            (224, 144),
            (243, 139),
            (255, 124),
            (269, 126),
            (270, 139),
            (254, 152),
            (250, 170),
            (231, 184),
            (220, 192),
            (206, 181),
            (201, 174),
            (178, 172),
            (157, 159),
            (150, 146),
        ],
        [
            (106, 81),
            (143, 66),
            (181, 73),
            (195, 95),
            (193, 138),
            (189, 175),
            (168, 193),
            (116, 184),
            (99, 148),
        ],
    ],
    2: [
        [
            (139, 77),
            (161, 62),
            (181, 61),
            (204, 70),
            (217, 85),
            (214, 110),
            (201, 124),
            (181, 127),
            (149, 118),
            (136, 104),
        ],
        [
            (67, 38),
            (87, 40),
            (109, 51),
            (128, 64),
            (149, 73),
            (157, 88),
            (155, 103),
            (144, 115),
            (111, 99),
            (100, 88),
            (101, 101),
            (89, 109),
            (57, 114),
            (45, 105),
            (42, 92),
            (48, 75),
            (63, 65),
        ],
        [
            (116, 75),
            (147, 64),
            (177, 58),
            (201, 72),
            (213, 100),
            (200, 140),
            (187, 168),
            (126, 175),
            (102, 137),
        ],
    ],
    3: [
        [
            (146, 100),
            (164, 88),
            (186, 90),
            (205, 97),
            (221, 116),
            (222, 136),
            (210, 151),
            (188, 154),
            (168, 137),
            (146, 120),
            (130, 111),
        ],
        [
            (65, 74),
            (84, 48),
            (100, 32),
            (120, 23),
            (141, 19),
            (153, 7),
            (164, 7),
            (168, 19),
            (159, 29),
            (181, 41),
            (198, 49),
            (194, 65),
            (166, 56),
            (158, 55),
            (161, 66),
            (180, 83),
            (194, 92),
            (195, 108),
            (179, 118),
            (159, 103),
            (135, 82),
            (119, 68),
            (104, 59),
            (99, 65),
            (101, 76),
            (123, 86),
            (147, 103),
            (138, 116),
            (112, 111),
            (80, 104),
            (67, 91),
        ],
        [
            (116, 97),
            (161, 78),
            (188, 91),
            (216, 116),
            (216, 152),
            (191, 188),
            (132, 186),
            (110, 148),
        ],
    ],
    4: [
        [
            (155, 72),
            (170, 55),
            (190, 51),
            (205, 60),
            (212, 77),
            (224, 95),
            (228, 105),
            (221, 123),
            (207, 131),
            (187, 114),
            (172, 107),
            (155, 89),
        ],
        [
            (202, 110),
            (213, 101),
            (226, 102),
            (239, 116),
            (259, 132),
            (280, 148),
            (292, 153),
            (303, 147),
            (317, 148),
            (317, 162),
            (306, 173),
            (297, 191),
            (281, 199),
            (262, 193),
            (254, 179),
            (235, 168),
            (219, 164),
            (204, 145),
            (195, 128),
        ],
        [
            (129, 93),
            (158, 65),
            (177, 48),
            (198, 58),
            (208, 83),
            (208, 109),
            (188, 140),
            (172, 172),
            (121, 170),
            (114, 138),
        ],
    ],
}


def remap(image, coords):
    return cv2.remap(
        image, coords.astype(np.float32), None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT
    )


def guide_map(target, source):
    """Inverse moving-least-squares similarity at a 3 px grid, including local rotation."""
    samples = GRID[::3, ::3]
    relative = target - samples[:, :, None, :]
    weights = (9.0 + (relative**2).sum(axis=3)) ** -1.65
    weights /= weights.sum(axis=2, keepdims=True)
    ta, sa = weights @ target, weights @ source
    td, sd = target - ta[:, :, None, :], source - sa[:, :, None, :]
    denominator = np.maximum((weights * (td * td).sum(axis=3)).sum(axis=2), 0.001)
    re = (weights * (td * sd).sum(axis=3)).sum(axis=2) / denominator
    im = (weights * (td[..., 0] * sd[..., 1] - td[..., 1] * sd[..., 0])).sum(axis=2) / denominator
    delta = samples - ta
    real = np.stack(
        (re * delta[..., 0] - im * delta[..., 1], im * delta[..., 0] + re * delta[..., 1]), axis=2
    )
    displacement = sa + real - samples
    # The map is sampled at 0,3,6...; keep those pixel centres when expanding it.
    return GRID + cv2.remap(
        displacement.astype(np.float32),
        GRID / 3,
        None,
        cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def actor_sources(name, frames):
    atlas = np.asarray(Image.open(ART / f"{name}.webp").convert("RGBA")).copy()
    result = []
    for i, frame in enumerate(frames):
        l, top, r, bottom = frame["box"]
        origin = np.asarray(frame["origin"], np.float32)
        cut = np.zeros_like(atlas)
        cut[top:bottom, l:r] = atlas[top:bottom, l:r]
        cut = cut.astype(np.float32) / 255
        cut[:, :, :3] *= cut[:, :, 3:]
        image = remap(cut, (GRID - ORIGIN) / SCALE + origin)
        pins = np.asarray(frame["pins"], np.float32)
        shoulder = np.asarray(SHOULDERS[name][i], np.float32)
        # Give helmets, feet and cuirasses an area, so translating the wrist cannot
        # collapse an adjacent plate to a single point.
        far_hand, far_elbow = np.asarray(FAR_ARM[name][i], np.float32).reshape(2, 2)
        near_palm = pins[2] + 0.20 * (pins[8] - pins[2])
        guides = np.vstack(
            (
                pins,
                shoulder,
                far_hand,
                far_elbow,
                near_palm,
                (far_hand + far_elbow) / 2,
                pins[0] + [-16, -10],
                pins[0] + [16, -8],
                pins[1] + [-17, 3],
                pins[1] + [17, 3],
                pins[3] + [12, 0],
                pins[4] + [12, 0],
                (shoulder + pins[8]) / 2,
                (pins[8] + pins[2]) / 2,
            )
        )
        result.append((image, ((guides - origin) * SCALE + ORIGIN).astype(np.float32)))
    return result


def knight_layers(frame, image, index):
    l, top, _, _ = frame["box"]
    masks = []
    for polygon in ARM_LAYERS[index]:
        points = (np.array(polygon) + [l, top] - frame["origin"]) * SCALE + ORIGIN
        mask = np.zeros((H, W), np.uint8)
        cv2.fillPoly(mask, [np.round(points * 16).astype(np.int32)], 255, cv2.LINE_AA, 4)
        masks.append(mask.astype(np.float32) / 255)
    upper, fore, torso = masks
    cut = np.maximum(upper, fore)
    body_alpha = image[:, :, 3] * (1 - cut * (1 - torso))
    hidden = (cut > 0.08).astype(np.uint8) * 255
    rgb = np.uint8(np.clip(image[:, :, :3] / np.maximum(image[:, :, 3:], 0.001) * 255, 0, 255))
    repaired = cv2.inpaint(rgb, hidden, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255
    body = np.dstack((repaired * body_alpha[:, :, None], body_alpha))
    return body, image * upper[:, :, None], image * fore[:, :, None]


def rigid_layer(image, source_a, source_b, target_a, target_b, upper):
    """Rotate a plate around its joint without magnifying foreshortened armor."""
    u, v = source_b - source_a, target_b - target_a
    size = np.clip(np.linalg.norm(v) / max(1, np.linalg.norm(u)), 0.92, 1.08)
    angle = (np.arctan2(u[1], u[0]) - np.arctan2(v[1], v[0]) + np.pi) % (2 * np.pi) - np.pi
    if upper:
        angle = np.clip(angle, -0.65, 0.65)
    re, im = np.cos(angle) / size, np.sin(angle) / size
    d = GRID - target_a
    return remap(
        image,
        source_a
        + np.dstack((re * d[:, :, 0] - im * d[:, :, 1], im * d[:, :, 0] + re * d[:, :, 1])),
    )


def plated_arm(left, right, parts_a, parts_b, count):
    _, pa = left
    _, pb = right
    torso_ids = [0, 1, 3, 4, 5, 6, 7, 9, 10, 15, 16, 17, 18, 19, 20]
    body_a, body_b = (parts_a[0], pa[torso_ids]), (parts_b[0], pb[torso_ids])
    arm_a, arm_b = pa[2] - pa[8], pb[2] - pb[8]
    angle_a, angle_b = np.arctan2(arm_a[1], arm_a[0]), np.arctan2(arm_b[1], arm_b[0])
    turn = (angle_b - angle_a + np.pi) % (2 * np.pi) - np.pi
    for step, body in enumerate(warped_frames(body_a, body_b, count), 1):
        t = step / count
        hand, shoulder = pa[2] * (1 - t) + pb[2] * t, pa[10] * (1 - t) + pb[10] * t
        angle = angle_a + t * turn
        length = np.linalg.norm(arm_a) * (1 - t) + np.linalg.norm(arm_b) * t
        elbow = hand - length * np.array([np.cos(angle), np.sin(angle)], np.float32)
        for layer, joint, end, start_at, end_at in [
            (1, 10, 8, shoulder, elbow),
            (2, 2, 8, hand, elbow),
        ]:
            a = rigid_layer(parts_a[layer], pa[joint], pa[end], start_at, end_at, layer == 1)
            b = rigid_layer(parts_b[layer], pb[joint], pb[end], start_at, end_at, layer == 1)
            # One coherent gauntlet crosses the face. Transition the fine plate
            # details only while both endpoints are registered to the same bone.
            blend = np.clip((t - 0.34) / 0.32, 0, 1)
            blend = blend * blend * (3 - 2 * blend)
            armor = fuse(a, b, blend)
            body = armor + body * (1 - armor[:, :, 3:])
        yield body


def match_image(rgba):
    grey = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return np.uint8(np.clip((grey + 0.13 * rgba[:, :, 3]) * 255, 0, 255))


def signed_distance(alpha):
    inside = (alpha >= 0.46).astype(np.uint8)
    d = cv2.distanceTransform(inside, cv2.DIST_L2, 3) - cv2.distanceTransform(
        1 - inside, cv2.DIST_L2, 3
    )
    return np.clip(d, -13, 13)


def warped_frames(left, right, count):
    a, pa = left
    b, pb = right
    mid = (pa + pb) / 2
    ma, mb = guide_map(mid, pa), guide_map(mid, pb)
    ag, bg = match_image(remap(a, ma)), match_image(remap(b, mb))
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    ab, ba = dis.calc(ag, bg, None), dis.calc(bg, ag, None)
    ab = np.clip(ab, -15, 15)
    ba = np.clip(ba, -15, 15)
    for step in range(1, count):
        t = step / count
        target = guide_map(pa * (1 - t) + pb * t, mid)
        # Compose inverse maps, sampling the painted colors only once.
        ca = remap(ma, target - t * remap(ab, target))
        cb = remap(mb, target - (1 - t) * remap(ba, target))
        aw, bw = remap(a, ca), remap(b, cb)
        yield fuse(aw, bw, t)


def fuse(aw, bw, t):
    if t == 0:
        return aw
    if t == 1:
        return bw
    combined = aw * (1 - t) + bw * t
    color = combined[:, :, :3] / np.maximum(combined[:, :, 3:], 1e-5)
    contour = signed_distance(aw[:, :, 3]) * (1 - t) + signed_distance(bw[:, :, 3]) * t
    alpha = np.clip(contour + 0.5, 0, 1)
    edge = min(1, 4 * t, 4 * (1 - t))
    alpha = combined[:, :, 3] * (1 - edge) + edge * alpha
    alpha[combined[:, :, 3] < 0.045] = 0
    return np.dstack((color * alpha[:, :, None], alpha))


def cut_tile(rgba):
    alpha = rgba[:, :, 3].copy()
    color = rgba[:, :, :3] / np.maximum(alpha[:, :, None], 1e-5)
    solid = (alpha > 0.13).astype(np.uint8)
    number, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
    if number > 1:
        body = (labels == (1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
        alpha *= cv2.dilate(body, np.ones((7, 7), np.uint8))
    tile = Image.fromarray(np.uint8(np.clip(np.dstack((color, alpha)) * 255, 0, 255)))
    x, y, r, h = tile.getchannel("A").getbbox()
    return tile.crop((x, y, r, h)), [int(ORIGIN[0]) - x, int(ORIGIN[1]) - y]


def pack(name, frames):
    sources = actor_sources(name, frames)
    layers = (
        {i: knight_layers(frames[i], sources[i][0], i) for i in ARM_LAYERS}
        if name == "knight"
        else {}
    )
    tiles, edges = [], {}
    for a, b, count in CLIPS[name]:
        edge = f"{a}-{b}"
        edges[edge] = [None] * (count - 1)
        if (a, b) in [(0, 2), (3, 4)] and layers:
            strip = plated_arm(sources[a], sources[b], layers[a], layers[b], count)
        else:
            strip = warped_frames(sources[a], sources[b], count)
        for i, rgba in enumerate(strip):
            tile, pivot = cut_tile(rgba)
            tiles.append((tile, pivot, edge, i))
    pages, used, shelves = [], [], []
    for tile, pivot, edge, i in sorted(tiles, key=lambda v: -v[0].height):
        w, h = tile.size
        space = next((s for s in shelves if s[3] >= h + 2 and s[1] + w + 2 <= 2048), None)
        if space is None:
            page = next((p for p, height in enumerate(used) if height + h + 2 <= 2048), None)
            if page is None:
                page = len(pages)
                pages.append(Image.new("RGBA", (2048, 2048)))
                used.append(0)
            space = [page, 0, used[page], h + 2]
            shelves.append(space)
            used[page] += h + 2
        page, x, y, _ = space
        pages[page].paste(tile, (x + 1, y + 1))
        edges[edge][i] = [page, x + 1, y + 1, w, h, *pivot]
        space[1] += w + 2
    names = []
    for i, page in enumerate(pages):
        path = ART / f"{name}-motion-{i}.webp"
        page.crop((0, 0, 2048, used[i])).save(path, "WEBP", quality=88, method=5, alpha_quality=95)
        names.append("art/" + path.name)
    return {"pages": names, "edges": edges}


if __name__ == "__main__":
    cv2.setNumThreads(2)
    export = "import {KNIGHT, WARDEN} from './motion.ts'; console.log(JSON.stringify({knight:KNIGHT,warden:WARDEN}))"
    frames = json.loads(
        subprocess.check_output(["node", "--input-type=module", "-e", export], cwd=ROOT)
    )
    result = {"scale": SCALE}
    for name in CLIPS:
        result[name] = pack(name, frames[name])
        print(name, result[name]["pages"], flush=True)
    cels = ROOT / "motion-cels.ts"
    head = cels.read_text(encoding="utf8").split("export const CELS = ")[0]
    cels.write_text(
        head + "export const CELS = " + json.dumps(result, separators=(",", ":")) + ";\n",
        encoding="utf8",
    )
