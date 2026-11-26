"""The windmill cottage and the island's props, modelled from numbers.

    blender -b --factory-startup -P source/props.py      (from prefabs/3d/sky-island)

Writes assets/house.glb (nodes `house` and `sails`; the sails turn
about their own local Z in the game, which is Blender's -Y) and
assets/props.glb (one node per prop, each standing on its own
origin: crate, fence, cart, barrel, bench, sign, lamp, bucket, haybale, mailbox).
Windows and the lamp use the material `glow`, which the game lights at dusk.
Blender units are metres, z up; the cottage's front looks along -Y (the game's +Z).
"""
import math
import os
import random
import bmesh
import bpy
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
coll = bpy.context.scene.collection

MATS = {}


def mat(name, colour, rough=0.8, metal=0.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*colour, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1.0
    MATS[name] = m
    return m


STONE = [mat('stone-a', (0.5, 0.48, 0.44), 0.9), mat('stone-b', (0.42, 0.41, 0.38), 0.9), mat('stone-c', (0.58, 0.55, 0.5), 0.9)]
PLASTER = mat('plaster', (0.86, 0.8, 0.68), 0.92)
TIMBER = mat('timber', (0.24, 0.14, 0.08), 0.75)
WOOD = [mat('wood-a', (0.5, 0.33, 0.19), 0.8), mat('wood-b', (0.42, 0.27, 0.15), 0.8), mat('wood-c', (0.58, 0.4, 0.24), 0.8)]
TILE = [mat('tile-a', (0.62, 0.17, 0.09), 0.7), mat('tile-b', (0.7, 0.24, 0.12), 0.7), mat('tile-c', (0.52, 0.14, 0.08), 0.7)]
GLOW = mat('glow', (0.9, 0.75, 0.45), 0.3, emit=(1.0, 0.62, 0.25))
IRON = mat('iron', (0.12, 0.12, 0.13), 0.5, 0.8)
SAIL = mat('sail-cloth', (0.86, 0.82, 0.72), 0.95)
HAY = mat('hay', (0.78, 0.62, 0.3), 0.95)
BLUE = mat('sign-blue', (0.16, 0.3, 0.55), 0.6)
RED = mat('mail-red', (0.7, 0.12, 0.1), 0.5)
WATER_WOOD = mat('bucket', (0.45, 0.3, 0.17), 0.7)

parts = []


def box(size, at, m, rot=(0, 0, 0), bevel=0.02, seg=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('b', 'BEVEL')
        mod.width = bevel
        mod.segments = seg
        mod.limit_method = 'NONE'
        bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(m)
    parts.append(o)
    return o


def cyl(r, depth, at, m, rot=(0, 0, 0), verts=16, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=depth, location=at, rotation=rot)
    o = bpy.context.active_object
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    parts.append(o)
    return o


def beam(a, b, t, m):
    """A square timber from a to b. Its transform stays on the object; joining keeps it."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = box((t, t, d.length), (0, 0, 0), m, bevel=0.012)
    o.matrix_world = Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    return o


def join(name, objs=None):
    objs = objs if objs is not None else parts[:]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    for p in objs:
        if p in parts:
            parts.remove(p)
    return o


def origin_to(o, point):
    """Moves the object's origin to point (world) without moving its mesh."""
    off = Vector(point) - o.location
    o.data.transform(Matrix.Translation(-off))
    o.location = Vector(point)


# ================================ the cottage ================================
W, D = 3.2, 2.6          # walls, outside
PLINTH = 0.38
EAVE = 2.25
RIDGE = EAVE + 1.45
# stone plinth: a core and stones round it
box((W + 0.16, D + 0.16, PLINTH), (0, 0, PLINTH / 2), STONE[0], bevel=0.03)
for side in range(4):
    length = W + 0.2 if side % 2 == 0 else D + 0.2
    x = -length / 2
    while x < length / 2 - 0.05:
        w = rnd.uniform(0.22, 0.42)
        for row in range(2):
            h = PLINTH / 2 - 0.01
            cx, cz = x + w / 2, h / 2 + row * (h + 0.01)
            if side == 0:
                at = (cx, -(D + 0.2) / 2, cz)
            elif side == 2:
                at = (-cx, (D + 0.2) / 2, cz)
            elif side == 1:
                at = ((W + 0.2) / 2, cx, cz)
            else:
                at = (-(W + 0.2) / 2, -cx, cz)
            size = (w - 0.02, 0.07, h) if side % 2 == 0 else (0.07, w - 0.02, h)
            box(size, at, rnd.choice(STONE), rot=(0, 0, rnd.uniform(-0.03, 0.03)), bevel=0.025)
        x += w + rnd.uniform(-0.04, 0.06) * 0.2
# walls
box((W, D, EAVE - PLINTH), (0, 0, (EAVE + PLINTH) / 2), PLASTER, bevel=0.01)
# gables on the sides: the roof's ridge runs along Y (front to back)
bm = bmesh.new()
for sy in (-1, 1):
    y = sy * D / 2
    a = bm.verts.new((-W / 2, y, EAVE))
    b = bm.verts.new((W / 2, y, EAVE))
    c = bm.verts.new((0, y, RIDGE))
    f = bm.faces.new((a, b, c))
    if sy > 0:
        f.normal_flip()
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.04)
gm = bpy.data.meshes.new('gables')
bm.to_mesh(gm)
bm.free()
g = bpy.data.objects.new('gables', gm)
coll.objects.link(g)
g.data.materials.append(PLASTER)
parts.append(g)
# timber frame on the front and back
for sy in (-1, 1):
    y = sy * (D / 2 + 0.035)
    for x in (-W / 2 + 0.06, -0.55, 0.55, W / 2 - 0.06):
        beam((x, y, PLINTH), (x, y, EAVE), 0.11, TIMBER)
    beam((-W / 2, y, EAVE - 0.05), (W / 2, y, EAVE - 0.05), 0.12, TIMBER)
    beam((-W / 2, y, 1.32), (-0.55, y, 1.32), 0.09, TIMBER)
    beam((0.55, y, 1.32), (W / 2, y, 1.32), 0.09, TIMBER)
    beam((-W / 2 + 0.06, y, PLINTH + 0.05), (-0.55, y, 1.32), 0.08, TIMBER)
    beam((W / 2 - 0.06, y, PLINTH + 0.05), (0.55, y, 1.32), 0.08, TIMBER)
for sx in (-1, 1):
    x = sx * (W / 2 + 0.035)
    for y in (-D / 2 + 0.06, 0, D / 2 - 0.06):
        beam((x, y, PLINTH), (x, y, EAVE), 0.11, TIMBER)
    beam((x, -D / 2, EAVE - 0.05), (x, D / 2, EAVE - 0.05), 0.12, TIMBER)
for sy in (-1, 1):
    y = sy * (D / 2 + 0.06)
    beam((-W / 2 + 0.06, y, EAVE - 0.05), (0, y, RIDGE - 0.08), 0.1, TIMBER)
    beam((W / 2 - 0.06, y, EAVE - 0.05), (0, y, RIDGE - 0.08), 0.1, TIMBER)
    beam((-0.5, y, EAVE), (-0.5, y, EAVE + 0.95), 0.08, TIMBER)
    beam((0.5, y, EAVE), (0.5, y, EAVE + 0.95), 0.08, TIMBER)
# door (front, middle) with a stone step
box((0.82, 0.08, 1.55), (0, -D / 2 - 0.03, PLINTH + 0.78), TIMBER, bevel=0.02)
for i in range(5):
    box((0.15, 0.05, 1.45), (-0.32 + i * 0.16, -D / 2 - 0.08, PLINTH + 0.75), WOOD[i % 3], bevel=0.012)
box((0.08, 0.03, 0.08), (0.24, -D / 2 - 0.12, PLINTH + 0.8), IRON, bevel=0.01)
box((1.1, 0.4, 0.14), (0, -D / 2 - 0.3, 0.07), STONE[2], bevel=0.04)
box((1.0, 0.35, 0.14), (0, -D / 2 - 0.3, 0.2), STONE[0], bevel=0.04)
# a little roof over the door
for sx in (-1, 1):
    box((0.62, 0.62, 0.05), (sx * 0.26, -D / 2 - 0.3, PLINTH + 1.78), TILE[0], rot=(0, sx * 0.55, 0), bevel=0.015)
beam((-0.55, -D / 2 - 0.55, PLINTH + 1.6), (-0.55, -D / 2 - 0.05, PLINTH + 1.6), 0.07, TIMBER)
beam((0.55, -D / 2 - 0.55, PLINTH + 1.6), (0.55, -D / 2 - 0.05, PLINTH + 1.6), 0.07, TIMBER)


def window(at, facing):
    """A window: glowing glass, a frame, a cross, a sill and two shutters. facing: 'front'|'side'."""
    x, y, z = at
    w, h = 0.62, 0.72
    if facing == 'front':
        box((w, 0.06, h), (x, y - 0.01, z), GLOW, bevel=0)
        for dx in (-w / 2, w / 2):
            box((0.07, 0.1, h + 0.1), (x + dx, y - 0.04, z), TIMBER, bevel=0.01)
        for dz in (-h / 2, h / 2):
            box((w + 0.12, 0.1, 0.07), (x, y - 0.04, z + dz), TIMBER, bevel=0.01)
        box((0.04, 0.08, h), (x, y - 0.05, z), TIMBER, bevel=0)
        box((w, 0.08, 0.04), (x, y - 0.05, z), TIMBER, bevel=0)
        box((w + 0.22, 0.18, 0.06), (x, y - 0.1, z - h / 2 - 0.06), WOOD[1], bevel=0.015)
        for s in (-1, 1):
            box((0.3, 0.04, h + 0.04), (x + s * (w / 2 + 0.2), y - 0.05, z), BLUE, rot=(0, 0, s * 0.25), bevel=0.012)
        # flower box
        box((w + 0.1, 0.16, 0.14), (x, y - 0.14, z - h / 2 - 0.15), WOOD[0], bevel=0.015)
        for k in range(7):
            colour = rnd.choice([mat('flower-red', (0.85, 0.15, 0.2), 0.6), mat('flower-yellow', (0.95, 0.8, 0.2), 0.6), mat('flower-white', (0.95, 0.95, 0.92), 0.6)])
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.04, 0.06), location=(x - w / 2 + 0.05 + k * (w / 6.5), y - 0.14 + rnd.uniform(-0.04, 0.04), z - h / 2 - 0.05 + rnd.uniform(0, 0.04)))
            o = bpy.context.active_object
            o.data.materials.append(colour)
            parts.append(o)
    else:
        sx = 1 if x > 0 else -1
        box((0.06, w, h), (x + sx * 0.01, y, z), GLOW, bevel=0)
        for dy in (-w / 2, w / 2):
            box((0.1, 0.07, h + 0.1), (x + sx * 0.04, y + dy, z), TIMBER, bevel=0.01)
        for dz in (-h / 2, h / 2):
            box((0.1, w + 0.12, 0.07), (x + sx * 0.04, y, z + dz), TIMBER, bevel=0.01)
        box((0.08, 0.04, h), (x + sx * 0.05, y, z), TIMBER, bevel=0)
        box((0.18, w + 0.22, 0.06), (x + sx * 0.1, y, z - h / 2 - 0.06), WOOD[1], bevel=0.015)


window((-1.05, -D / 2, 1.45), 'front')
window((1.05, -D / 2, 1.45), 'front')
window((W / 2, 0.55, 1.45), 'side')
window((-W / 2, -0.55, 1.45), 'side')
window((0, -D / 2 - 0.02, EAVE + 0.5), 'front')
# the roof: ridge along Y; tiles in overlapping rows on each slope
OVER = 0.32
slope_len = math.hypot(W / 2 + OVER, (RIDGE - EAVE) * (W / 2 + OVER) / (W / 2))
pitch = math.atan2(RIDGE - EAVE, W / 2)
rows = 8
for sx in (-1, 1):
    for r in range(rows):
        t = (r + 0.5) / rows
        # from the eave (t=0) to the ridge (t=1)
        dist = (1 - t) * slope_len
        cx = sx * (dist * math.cos(pitch) - 0.0) * 1.0
        cz = RIDGE + 0.12 - dist * math.sin(pitch)
        y = -D / 2 - OVER
        while y < D / 2 + OVER - 0.05:
            tw = rnd.uniform(0.26, 0.32)
            box((slope_len / rows + 0.1, tw - 0.02, 0.045), (cx, y + tw / 2, cz + 0.01 * rnd.random()), rnd.choice(TILE),
                rot=(rnd.uniform(-0.02, 0.02), sx * pitch, rnd.uniform(-0.02, 0.02)), bevel=0.012)
            y += tw
# ridge cap
cyl(0.09, D + 2 * OVER + 0.05, (0, 0, RIDGE + 0.13), TILE[2], rot=(math.pi / 2, 0, 0), verts=10)
# chimney
box((0.5, 0.5, 1.7), (0.85, 0.55, RIDGE - 0.1), STONE[1], bevel=0.03)
box((0.62, 0.62, 0.1), (0.85, 0.55, RIDGE + 0.78), STONE[2], bevel=0.02)
house = join('house')
origin_to(house, (0, 0, 0))

# ============================= the windmill tower =============================
TX, TY = -1.55, 0.75
TH = 5.6
bm = bmesh.new()
sides = 8
ring = lambda r, z: [bm.verts.new((TX + r * math.cos(2 * math.pi * (i + 0.5) / sides), TY + r * math.sin(2 * math.pi * (i + 0.5) / sides), z)) for i in range(sides)]
r0, r1 = ring(0.95, 0.0), ring(0.66, TH)
for i in range(sides):
    j = (i + 1) % sides
    bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
tm = bpy.data.meshes.new('tower')
bm.to_mesh(tm)
bm.free()
tower = bpy.data.objects.new('tower', tm)
coll.objects.link(tower)
tower.data.materials.append(STONE[2])
parts.append(tower)
# stone courses (rings of blocks) to give the tower texture
for k in range(14):
    z = 0.2 + k * (TH - 0.3) / 14
    r = 0.95 - (0.95 - 0.66) * z / TH + 0.03
    n = 14
    for i in range(n):
        a = 2 * math.pi * (i + 0.5 * (k % 2)) / n
        box((0.06, 2 * math.pi * r / n - 0.04, 0.33), (TX + r * math.cos(a), TY + r * math.sin(a), z), rnd.choice(STONE), rot=(0, 0, a), bevel=0.02)
# a door and windows on the tower
box((0.08, 0.5, 1.0), (TX - 0.92, TY, 0.5), TIMBER, bevel=0.015)
for z, a in ((2.4, -math.pi / 2 - 0.4), (3.9, math.pi)):
    r = 0.95 - (0.95 - 0.66) * z / TH + 0.05
    box((0.08, 0.32, 0.46), (TX + r * math.cos(a), TY + r * math.sin(a), z), GLOW, rot=(0, 0, a), bevel=0)
    box((0.1, 0.42, 0.56), (TX + (r + 0.01) * math.cos(a), TY + (r + 0.01) * math.sin(a), z), TIMBER, rot=(0, 0, a), bevel=0.01)
# the cap: a wooden cone with a gallery ring
cyl(0.85, 0.12, (TX, TY, TH + 0.06), TIMBER, verts=16)
cyl(0.82, 1.3, (TX, TY, TH + 0.78), WOOD[1], verts=16, r2=0.06)
for i in range(16):
    a = 2 * math.pi * i / 16
    beam((TX + 0.8 * math.cos(a), TY + 0.8 * math.sin(a), TH + 0.12), (TX + 0.1 * math.cos(a), TY + 0.1 * math.sin(a), TH + 1.38), 0.05, TIMBER)
cyl(0.05, 0.4, (TX, TY, TH + 1.5), IRON, verts=8)
# the shaft sticking out to the front
HUB = Vector((TX, TY - 1.0, TH + 0.45))
cyl(0.1, 1.1, (TX, TY - 0.5, TH + 0.45), TIMBER, rot=(math.pi / 2, 0, 0), verts=12)
tower_obj = join('tower')
origin_to(tower_obj, (0, 0, 0))

# the sails: four lattice blades round the hub, in the XZ plane at y = HUB.y
sails_parts = []
cyl(0.2, 0.25, tuple(HUB), TIMBER, rot=(math.pi / 2, 0, 0), verts=12)
sails_parts.append(parts[-1])
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    d = Vector((math.cos(a), 0, math.sin(a)))
    side = Vector((-math.sin(a), 0, math.cos(a)))
    start, end = HUB + d * 0.15, HUB + d * 3.0
    sails_parts.append(beam(start, end, 0.09, TIMBER))
    for s in range(9):
        p = HUB + d * (0.75 + s * 0.28)
        sails_parts.append(beam(p - side * 0.04, p + side * 0.62, 0.035, WOOD[2]))
    for off in (0.32, 0.62):
        sails_parts.append(beam(HUB + d * 0.7 + side * off, HUB + d * 3.0 + side * off, 0.035, WOOD[2]))
    # the cloth, a little behind the lattice
    bm = bmesh.new()
    corners = [HUB + d * 0.75 + side * 0.05, HUB + d * 2.95 + side * 0.05, HUB + d * 2.95 + side * 0.6, HUB + d * 0.75 + side * 0.6]
    vs = [bm.verts.new(c + Vector((0, 0.04, 0))) for c in corners]
    bm.faces.new(vs)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
    cm = bpy.data.meshes.new('cloth')
    bm.to_mesh(cm)
    bm.free()
    cloth = bpy.data.objects.new('cloth', cm)
    coll.objects.link(cloth)
    cloth.data.materials.append(SAIL)
    sails_parts.append(cloth)
for p in sails_parts:
    if p in parts:
        parts.remove(p)
sails = join('sails', sails_parts)
origin_to(sails, HUB)
house = join('house', [house, tower_obj])
origin_to(house, (0, 0, 0))
bpy.ops.object.select_all(action='DESELECT')
for o in (house, sails):
    o.select_set(True)
for o in (house, sails):
    for poly in o.data.polygons:
        poly.use_smooth = False
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'house.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
print('HOUSE', len(house.data.polygons), 'faces; sails', len(sails.data.polygons), 'hub', tuple(round(v, 3) for v in HUB))
for o in (house, sails):
    o.hide_set(True)
    o.select_set(False)

# ================================== props ==================================
props = []


def finish(name, at=(0, 0, 0)):
    o = join(name)
    origin_to(o, (0, 0, 0))
    o.location = Vector(at)
    props.append(o)
    return o


X = 0.0  # spread the props apart while building; the game places them


def plank_box(size, at, colour_cycle=WOOD):
    sx, sy, sz = size
    box((sx - 0.04, sy - 0.04, sz - 0.04), at, colour_cycle[1], bevel=0.01)
    n = 4
    for i in range(n):
        z = at[2] - sz / 2 + (i + 0.5) * sz / n
        for s in (-1, 1):
            box((sx, 0.03, sz / n - 0.015), (at[0], at[1] + s * sy / 2, z), rnd.choice(colour_cycle), bevel=0.006)
            box((0.03, sy, sz / n - 0.015), (at[0] + s * sx / 2, at[1], z), rnd.choice(colour_cycle), bevel=0.006)
    for s in (-1, 1):
        for t in (-1, 1):
            box((0.06, 0.06, sz + 0.02), (at[0] + s * sx / 2, at[1] + t * sy / 2, at[2]), TIMBER, bevel=0.01)
    box((sx + 0.02, sy + 0.02, 0.03), (at[0], at[1], at[2] + sz / 2), WOOD[2], bevel=0.008)


plank_box((0.62, 0.62, 0.62), (0, 0, 0.31))
finish('crate', (X, 0, 0)); X += 2
# fence: two posts, two rails, 2 m
for x in (-1.0, 1.0):
    box((0.1, 0.1, 0.95), (x, 0, 0.47), WOOD[0], rot=(0, 0, rnd.uniform(-0.1, 0.1)), bevel=0.02)
    cyl(0.07, 0.06, (x, 0, 0.97), WOOD[2], verts=8)
for z in (0.42, 0.78):
    box((2.15, 0.06, 0.1), (0, 0.06, z + rnd.uniform(-0.02, 0.02)), WOOD[1], rot=(rnd.uniform(-0.03, 0.03), 0, rnd.uniform(-0.01, 0.01)), bevel=0.012)
finish('fence', (X, 0, 0)); X += 3
# cart: a box on two wheels, with hay
plank_box((1.2, 0.8, 0.4), (0, 0, 0.62))
for s in (-1, 1):
    w = cyl(0.36, 0.07, (0, s * 0.48, 0.36), WOOD[2], rot=(math.pi / 2, 0, 0), verts=20)
    cyl(0.38, 0.05, (0, s * 0.48, 0.36), IRON, rot=(math.pi / 2, 0, 0), verts=20)
    for k in range(6):
        a = k * math.pi / 6
        beam((0.3 * math.cos(a), s * 0.5, 0.36 + 0.3 * math.sin(a)), (-0.3 * math.cos(a), s * 0.5, 0.36 - 0.3 * math.sin(a)), 0.035, WOOD[1])
cyl(0.05, 1.1, (0, 0, 0.36), TIMBER, rot=(math.pi / 2, 0, 0), verts=8)
beam((0.6, -0.3, 0.55), (1.6, -0.25, 0.25), 0.06, WOOD[0])
beam((0.6, 0.3, 0.55), (1.6, 0.25, 0.25), 0.06, WOOD[0])
for k in range(10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=rnd.uniform(0.18, 0.26), location=(rnd.uniform(-0.4, 0.4), rnd.uniform(-0.25, 0.25), 0.85 + rnd.uniform(0, 0.1)))
    o = bpy.context.active_object
    o.scale = (1, 1, 0.6)
    o.data.materials.append(HAY)
    parts.append(o)
finish('cart', (X, 0, 0)); X += 3
# barrel: staves round a lathe, two iron bands
bm = bmesh.new()
prof = [(0.24, 0.0), (0.28, 0.2), (0.3, 0.38), (0.28, 0.56), (0.24, 0.76)]
seg = 18
rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)] for r, z in prof]
for a, b in zip(rings, rings[1:]):
    for i in range(seg):
        bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
bm.faces.new(rings[-1])
bm.faces.new(list(reversed(rings[0])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mb = bpy.data.meshes.new('barrel')
bm.to_mesh(mb)
bm.free()
o = bpy.data.objects.new('barrel', mb)
coll.objects.link(o)
o.data.materials.append(WOOD[0])
for poly in o.data.polygons:
    poly.use_smooth = True
parts.append(o)
for z, r in ((0.12, 0.265), (0.64, 0.265)):
    cyl(r, 0.04, (0, 0, z), IRON, verts=24)
finish('barrel', (X, 0, 0)); X += 2
# bench
box((1.3, 0.36, 0.06), (0, 0, 0.45), WOOD[2], bevel=0.015)
for x in (-0.5, 0.5):
    box((0.08, 0.32, 0.44), (x, 0, 0.22), WOOD[1], bevel=0.015)
box((1.3, 0.05, 0.22), (0, 0.17, 0.75), WOOD[0], rot=(-0.15, 0, 0), bevel=0.012)
for x in (-0.5, 0.5):
    box((0.06, 0.05, 0.38), (x, 0.17, 0.62), WOOD[1], rot=(-0.15, 0, 0), bevel=0.01)
finish('bench', (X, 0, 0)); X += 2
# sign: a post with a blue board
box((0.09, 0.09, 1.5), (0, 0, 0.75), WOOD[1], bevel=0.015)
box((0.75, 0.05, 0.42), (0, -0.07, 1.2), BLUE, bevel=0.02)
box((0.8, 0.06, 0.05), (0, -0.07, 1.43), WOOD[2], bevel=0.01)
box((0.8, 0.06, 0.05), (0, -0.07, 0.97), WOOD[2], bevel=0.01)
finish('sign', (X, 0, 0)); X += 2
# lamp post with a glowing lantern
box((0.1, 0.1, 1.9), (0, 0, 0.95), TIMBER, bevel=0.015)
beam((0, 0, 1.85), (0.38, 0, 1.85), 0.06, TIMBER)
box((0.2, 0.2, 0.28), (0.38, 0, 1.6), GLOW, bevel=0.02)
box((0.26, 0.26, 0.05), (0.38, 0, 1.76), IRON, bevel=0.01)
box((0.24, 0.24, 0.04), (0.38, 0, 1.44), IRON, bevel=0.01)
for s in (-1, 1):
    for t in (-1, 1):
        box((0.02, 0.02, 0.3), (0.38 + s * 0.1, t * 0.1, 1.6), IRON, bevel=0)
finish('lamp', (X, 0, 0)); X += 2
# bucket
cyl(0.16, 0.3, (0, 0, 0.15), WATER_WOOD, verts=16, r2=0.19)
cyl(0.195, 0.03, (0, 0, 0.27), IRON, verts=16)
finish('bucket', (X, 0, 0)); X += 2
# hay bale
box((0.9, 0.5, 0.45), (0, 0, 0.225), HAY, bevel=0.06, seg=3)
for x in (-0.25, 0.25):
    box((0.02, 0.52, 0.47), (x, 0, 0.225), mat('twine', (0.5, 0.38, 0.2), 0.9), bevel=0)
finish('haybale', (X, 0, 0)); X += 2
# mailbox
box((0.07, 0.07, 1.05), (0, 0, 0.52), WOOD[1], bevel=0.012)
box((0.24, 0.42, 0.24), (0, 0, 1.12), RED, bevel=0.06, seg=3)
box((0.03, 0.1, 0.16), (0.13, 0.12, 1.24), mat('flag-yellow', (0.95, 0.78, 0.15), 0.5), bevel=0.005)
finish('mailbox', (X, 0, 0)); X += 2
bpy.ops.object.select_all(action='DESELECT')
for o in props:
    o.select_set(True)
    for poly in o.data.polygons:
        if o.name not in ('barrel',):
            poly.use_smooth = False
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'props.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
print('PROPS', [(o.name, len(o.data.polygons)) for o in props])
