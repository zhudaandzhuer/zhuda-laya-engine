"""The seaside of "Zhuer: Fish Them Out!", modelled from numbers (no downloads).

    blender -b --factory-startup -P prefabs/3d/seaside-pier/source/scene.py

Writes ../assets/ (or the folder named by SEASIDE_OUT):
  shore.glb  the beach, the sea bed, rocks and two palm trees (one node `shore`)
  dock.glb   the wooden pier and the rescue raft moored beside it (nodes `dock`, `raft`)
  props.glb  one node per prop, each on its own origin: `pole` (bamboo, 1 m along +Y),
             `ring` (a swim ring, 0.62 m across, lying flat), `jelly` (a jellyfish)

Coordinates: the game's (x, y, z) is Blender's (x, -z, y): y up, the camera looks
from +z. Every place below is written in game coordinates through G().
The numbers here and in ../seaside-pier.ts must agree (dock top, raft, beach line).
"""
import math
import os
import random
import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('SEASIDE_OUT') or os.path.join(HERE, '..', 'assets')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(20261117)
bpy.ops.wm.read_factory_settings(use_empty=True)
coll = bpy.context.scene.collection


def G(x, y, z):
    """Game coordinates to Blender's."""
    return Vector((x, -z, y))


MATS = {}


def mat(name, colour, rough=0.8, metal=0.0, emit=None, strength=1.0):
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
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


SAND = mat('sand', (0.86, 0.74, 0.52), 0.95)
SAND_WET = mat('sand-wet', (0.62, 0.52, 0.36), 0.7)
BED = mat('sea-bed', (0.78, 0.7, 0.5), 0.95)
ROCK = [mat('rock-a', (0.46, 0.44, 0.42), 0.9), mat('rock-b', (0.38, 0.37, 0.36), 0.9)]
PLANK = [mat('plank-a', (0.62, 0.42, 0.24), 0.8), mat('plank-b', (0.55, 0.36, 0.2), 0.8), mat('plank-c', (0.68, 0.48, 0.28), 0.8)]
POST = mat('post', (0.36, 0.24, 0.14), 0.85)
ROPE = mat('rope', (0.8, 0.7, 0.5), 0.95)
RAFT = mat('raft-orange', (0.98, 0.42, 0.08), 0.45)
RAFT_FLOOR = mat('raft-floor', (0.36, 0.5, 0.62), 0.7)
WHITE = mat('ring-white', (0.95, 0.95, 0.93), 0.45)
RED = mat('ring-red', (0.92, 0.12, 0.1), 0.45)
TRUNK = mat('palm-trunk', (0.55, 0.4, 0.26), 0.9)
LEAF = [mat('palm-leaf-a', (0.2, 0.55, 0.18), 0.7), mat('palm-leaf-b', (0.28, 0.62, 0.2), 0.7)]
BAMBOO = mat('bamboo', (0.55, 0.7, 0.26), 0.55)
BAMBOO_NODE = mat('bamboo-node', (0.42, 0.55, 0.18), 0.6)
JELLY = mat('jelly', (0.95, 0.55, 0.85), 0.25, emit=(1.0, 0.45, 0.85), strength=0.6)
JELLY_IN = mat('jelly-in', (1.0, 0.85, 0.95), 0.3, emit=(1.0, 0.8, 0.95), strength=0.4)
FLAG = mat('flag', (0.96, 0.84, 0.2), 0.6)


def new_obj(name, bm, material_list=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for m in material_list or []:
        me.materials.append(m)
    return ob


def smooth(ob, angle=40):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(angle))
    except AttributeError:
        pass


def box(name, center, size, material, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[2], v.co.z * size[1]))
    ob = new_obj(name, bm, [material])
    ob.location = G(*center)
    if bevel > 0:
        mod = ob.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
    return ob


def cylinder(name, a, b, r, material, segments=10, r2=None):
    """A tapered cylinder from game point a to game point b."""
    a, b = G(*a), G(*b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r, radius2=r if r2 is None else r2, depth=(b - a).length)
    ob = new_obj(name, bm, [material])
    ob.location = (a + b) / 2
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(b - a)
    smooth(ob)
    return ob


def apply_all():
    bpy.ops.object.select_all(action='SELECT')
    for ob in bpy.context.scene.objects:
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def join(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def export(path, names):
    bpy.ops.object.select_all(action='DESELECT')
    for n in names:
        bpy.data.objects[n].select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True)
    print('EXPORTED', path, os.path.getsize(path))


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


# --- the shore: land on the left, a sandy bed sloping down under the sea ----------------
# Where the beach meets the water (y = 0): the line x = SHORE(z).
def shore_x(z):
    return -8.2 + 0.9 * math.sin(z * 0.35) + 0.25 * math.sin(z * 1.3 + 1)


def ground_y(x, z):
    """Height of the sand and the sea bed (game coordinates)."""
    d = x - shore_x(z)  # metres out to sea (negative: on land)
    if d < 0:
        return min(0.55, -d * 0.16) + 0.04 * math.sin(x * 1.7) * math.sin(z * 1.3)
    return -min(1.6, d * 0.32) - 0.08 * math.sin(x * 0.9 + z * 0.6)


def build_shore():
    bm = bmesh.new()
    nx, nz = 90, 60
    x0, x1, z0, z1 = -22.0, 24.0, -26.0, 12.0
    verts = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            z = z0 + (z1 - z0) * j / nz
            row.append(bm.verts.new(G(x, ground_y(x, z), z)))
        verts.append(row)
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            cx = sum(v.co.x for v in f.verts) / 4
            cz = -sum(v.co.y for v in f.verts) / 4
            d = cx - shore_x(cz)
            f.material_index = 0
    ob = new_obj('shore', bm, [SAND, SAND_WET, BED])
    smooth(ob, 60)
    parts = [ob]
    # rocks along the beach and in the shallows
    for k, (x, z, s) in enumerate([(-9.5, -3.5, 0.6), (-8.6, -4.6, 0.35), (-10.5, 5.5, 0.7), (-7.6, 6.4, 0.4),
                                   (-12.0, -1.0, 0.5), (9.5, -9.0, 0.9), (-6.6, -7.2, 0.45)]):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        for v in bm.verts:
            n = 0.75 + 0.25 * rnd.random()
            v.co = Vector((v.co.x * n * 1.2, v.co.y * n, v.co.z * n * 0.7))
        r = new_obj(f'rock{k}', bm, [ROCK[k % 2]])
        r.location = G(x, ground_y(x, z) + s * 0.15, z)
        r.scale = (s, s, s)
        r.rotation_euler = (0, 0, rnd.random() * 6.28)
        smooth(r, 30)
        parts.append(r)
    # palm trees on the sand
    for k, (x, z, h, lean) in enumerate([(-12.5, -5.5, 4.2, 0.35), (-13.5, 1.5, 3.6, 0.25), (-11.0, 7.5, 3.2, 0.4)]):
        base = (x, ground_y(x, z) - 0.1, z)
        pts = []
        for i in range(8):
            t = i / 7
            pts.append((x + lean * h * t * t, base[1] + h * t, z - 0.2 * t))
        for i in range(7):
            parts.append(cylinder(f'trunk{k}-{i}', pts[i], pts[i + 1], 0.19 - 0.08 * i / 7, TRUNK, 8, 0.19 - 0.08 * (i + 1) / 7))
        top = pts[-1]
        for f in range(8):
            ang = f / 8 * 6.283 + k
            bm = bmesh.new()
            seg = 8
            L = 1.9 + 0.3 * rnd.random()
            prev = None
            for s in range(seg + 1):
                t = s / seg
                w = 0.32 * math.sin(math.pi * min(1, t * 1.15)) + 0.02
                dx, dz = math.cos(ang), math.sin(ang)
                droop = -1.3 * t * t + 0.35 * t
                c = (top[0] + dx * L * t, top[1] + droop, top[2] + dz * L * t)
                px, pz = -dz, dx
                l = bm.verts.new(G(c[0] + px * w, c[1] - 0.05 * w, c[2] + pz * w))
                m = bm.verts.new(G(c[0], c[1] + 0.06 * (1 - t), c[2]))
                rgt = bm.verts.new(G(c[0] - px * w, c[1] - 0.05 * w, c[2] - pz * w))
                if prev:
                    bm.faces.new((prev[0], prev[1], m, l))
                    bm.faces.new((prev[1], prev[2], rgt, m))
                prev = (l, m, rgt)
            leaf = new_obj(f'leaf{k}-{f}', bm, [LEAF[f % 2]])
            smooth(leaf, 80)
            mod = leaf.modifiers.new('solid', 'SOLIDIFY')
            mod.thickness = 0.02
            parts.append(leaf)
    return join('shore', parts)


# --- the pier and the rescue raft ----------------------------------------------------------
DOCK = {'x0': -12.0, 'x1': -3.6, 'z0': 0.0, 'z1': 1.9, 'top': 0.55}
RAFT_AT = (-4.3, 0.0, 3.35)


def build_dock():
    parts = []
    x = DOCK['x0']
    k = 0
    while x < DOCK['x1']:
        w = 0.24
        cz = (DOCK['z0'] + DOCK['z1']) / 2
        parts.append(box(f'plank{k}', (x + w / 2, DOCK['top'] - 0.04 + 0.01 * rnd.random(), cz + 0.03 * (rnd.random() - 0.5)),
                         (w - 0.025, 0.07, DOCK['z1'] - DOCK['z0'] + 0.1 * rnd.random()), PLANK[k % 3], 0.012))
        x += w
        k += 1
    # beams under the planks
    for z in (DOCK['z0'] + 0.15, DOCK['z1'] - 0.15):
        parts.append(box(f'beam{z}', ((DOCK['x0'] + DOCK['x1']) / 2, DOCK['top'] - 0.14, z), (DOCK['x1'] - DOCK['x0'], 0.12, 0.12), POST))
    # posts into the sea bed, a rope between the outer ones
    posts = []
    for px in (DOCK['x1'] - 0.12, DOCK['x1'] - 2.6, DOCK['x1'] - 5.1, DOCK['x1'] - 7.6):
        for pz in (DOCK['z0'] + 0.05, DOCK['z1'] - 0.05):
            top = DOCK['top'] + (0.45 if px > DOCK['x1'] - 0.2 else 0.12)
            parts.append(cylinder(f'post{px}{pz}', (px, -1.6, pz), (px, top, pz), 0.1, POST, 10))
            posts.append((px, top, pz))
    # a life ring hung on the end post facing the camera
    ring = make_ring('dock-ring', 0.28, 0.07)
    ring.location = G(DOCK['x1'] - 0.12, DOCK['top'] + 0.12, DOCK['z1'] + 0.08)
    ring.rotation_euler = (math.radians(90), 0, 0)
    parts.append(ring)
    # a rope from the end post to the raft
    parts.append(cylinder('mooring', (DOCK['x1'] - 0.12, DOCK['top'] + 0.35, DOCK['z1'] - 0.05), (RAFT_AT[0] + 0.2, 0.32, RAFT_AT[2] - 0.75), 0.025, ROPE, 6))
    dock = join('dock', parts)

    # The raft: an orange tube round a dark floor, lying on the water.
    raft_parts = []
    bm = bmesh.new()
    ax, az, tube = 1.15, 0.8, 0.2
    seg, ring_seg = 40, 12
    rings = []
    for i in range(seg):
        a = i / seg * 6.283
        c = Vector((ax * math.cos(a), az * math.sin(a), 0))
        n = Vector((math.cos(a) / ax, math.sin(a) / az, 0)).normalized()
        row = []
        for j in range(ring_seg):
            b = j / ring_seg * 6.283
            p = c + n * tube * math.cos(b) + Vector((0, 0, tube * math.sin(b)))
            row.append(bm.verts.new(p))
        rings.append(row)
    for i in range(seg):
        for j in range(ring_seg):
            bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % ring_seg], rings[i][(j + 1) % ring_seg]))
    tube_ob = new_obj('raft-tube', bm, [RAFT])
    smooth(tube_ob, 80)
    raft_parts.append(tube_ob)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=40, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * ax, v.co.y * az, -0.08))
    raft_parts.append(new_obj('raft-floor', bm, [RAFT_FLOOR]))
    # a white rope looped round the tube
    for i in range(10):
        a0, a1 = i / 10 * 6.283, (i + 0.5) / 10 * 6.283
        p0 = (RAFT_AT[0] + ax * 1.17 * math.cos(a0), 0.24, RAFT_AT[2] - az * 1.22 * math.sin(a0))
        p1 = (RAFT_AT[0] + ax * 1.17 * math.cos(a1), 0.16, RAFT_AT[2] - az * 1.22 * math.sin(a1))
        raft_parts.append(cylinder(f'raft-rope{i}', p0, p1, 0.018, WHITE, 5))
    # a little yellow flag so the raft reads as the place to bring them
    raft_parts.append(cylinder('flagpole', (RAFT_AT[0] - 0.9, 0.2, RAFT_AT[2] - 0.35), (RAFT_AT[0] - 0.9, 1.35, RAFT_AT[2] - 0.35), 0.02, POST, 6))
    bm = bmesh.new()
    a = bm.verts.new(G(RAFT_AT[0] - 0.9, 1.33, RAFT_AT[2] - 0.35))
    b = bm.verts.new(G(RAFT_AT[0] - 0.9, 1.0, RAFT_AT[2] - 0.35))
    c = bm.verts.new(G(RAFT_AT[0] - 0.35, 1.17, RAFT_AT[2] - 0.3))
    bm.faces.new((a, b, c))
    fl = new_obj('flag', bm, [FLAG])
    mod = fl.modifiers.new('solid', 'SOLIDIFY')
    mod.thickness = 0.015
    raft_parts.append(fl)
    tube_ob.location = G(*RAFT_AT) + Vector((0, 0, 0.12))
    raft_parts[1].location = G(*RAFT_AT) + Vector((0, 0, 0.12))
    raft = join('raft', raft_parts)
    # the raft's origin at its own middle on the water, so the game can bob it
    bpy.context.scene.cursor.location = G(*RAFT_AT)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return dock, raft


def make_ring(name, radius, tube, stripes=8):
    bm = bmesh.new()
    seg, ring_seg = 32, 10
    rows = []
    for i in range(seg):
        a = i / seg * 6.283
        c = Vector((radius * math.cos(a), radius * math.sin(a), 0))
        n = Vector((math.cos(a), math.sin(a), 0))
        rows.append([bm.verts.new(c + n * tube * math.cos(j / ring_seg * 6.283) + Vector((0, 0, tube * math.sin(j / ring_seg * 6.283)))) for j in range(ring_seg)])
    for i in range(seg):
        for j in range(ring_seg):
            f = bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % ring_seg], rows[i][(j + 1) % ring_seg]))
            f.material_index = (i * stripes // seg) % 2
    ob = new_obj(name, bm, [RED, WHITE])
    smooth(ob, 80)
    return ob


def build_props():
    names = []
    # bamboo: 1 m along +Y from its origin, slightly thinner at the tip, a node ring every 0.2 m
    bm_parts = [cylinder('pole-shaft', (0, 0, 0), (0, 1, 0), 0.045, BAMBOO, 10, 0.03)]
    for i in range(1, 5):
        y = i * 0.2
        r = 0.045 - 0.015 * y + 0.008
        bm_parts.append(cylinder(f'pole-node{i}', (0, y - 0.012, 0), (0, y + 0.012, 0), r, BAMBOO_NODE, 10))
    pole = join('pole', bm_parts)
    # its origin at the butt, so the game can scale it from there to the tip
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    names.append(pole.name)
    # a swim ring lying flat at its origin
    ring = make_ring('ring', 0.31, 0.11)
    names.append(ring.name)
    # a jellyfish: a bell, a lighter inside and four wavy arms, 0.5 m across
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.25)
    for v in list(bm.verts):
        if v.co.z < -0.02:
            v.co.z = -0.02 + (v.co.z + 0.02) * 0.15
        else:
            v.co.z *= 0.85
    bell = new_obj('jelly-bell', bm, [JELLY])
    smooth(bell, 80)
    bell.location = (0, 0, 0.12)
    parts = [bell]
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=7, radius=0.13)
    inner = new_obj('jelly-in', bm, [JELLY_IN])
    inner.location = (0, 0, 0.13)
    inner.scale = (1, 1, 0.6)
    parts.append(inner)
    for k in range(5):
        a = k / 5 * 6.283
        pts = []
        for s in range(6):
            t = s / 5
            pts.append((0.12 * math.cos(a) + 0.05 * math.sin(t * 9 + k), 0.1 - 0.5 * t, -0.12 * math.sin(a) + 0.05 * math.cos(t * 9 + k)))
        for s in range(5):
            parts.append(cylinder(f'jelly-arm{k}-{s}', pts[s], pts[s + 1], 0.022 - 0.003 * s, JELLY, 6, 0.022 - 0.003 * (s + 1)))
    jelly = join('jelly', parts)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    names.append(jelly.name)
    return names


clear()
shore = build_shore()
export(os.path.join(OUT, 'shore.glb'), [shore.name])
clear()
dock, raft = build_dock()
export(os.path.join(OUT, 'dock.glb'), [dock.name, raft.name])
clear()
props = build_props()
export(os.path.join(OUT, 'props.glb'), props)
