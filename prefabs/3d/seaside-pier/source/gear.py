"""What each kind of Zhuda wears, modelled from numbers to fit the game's Zhuda
(public/assets/characters/zhuda.glb: feet at 0, head 0.6..1.05 m, eyes about 0.84 m,
face toward +z, front of the face about z 0.21 at eye height).

    blender -b --factory-startup -P prefabs/3d/seaside-pier/source/gear.py

Writes ../assets/ (or the folder named by SEASIDE_OUT):gear.glb, one node per piece, each with its origin at
the model's origin (the feet) and its geometry where it sits on the model:
  cap      swim cap and goggles   (little Zhuda)   -> head bone
  vest     life jacket            (chubby Zhuda)   -> spine bone
  crown    crown                  (golden Zhuda)   -> head bone
  shades   sunglasses             (swim-ring Zhuda)-> head bone
  snorkel  diving mask and tube   (diver Zhuda)    -> head bone
Game coordinates (x, y, z) are Blender's (x, -z, y), as in tools/scene.py.
"""
import math
import os
import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('SEASIDE_OUT') or os.path.join(HERE, '..', 'assets')
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
coll = bpy.context.scene.collection


def G(x, y, z):
    return Vector((x, -z, y))


MATS = {}


def mat(name, colour, rough=0.5, metal=0.0, emit=None, strength=1.0):
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


CAP = mat('cap-blue', (0.1, 0.45, 0.95), 0.35)
CAP_STRIPE = mat('cap-white', (0.95, 0.95, 0.95), 0.4)
STRAP = mat('strap', (0.08, 0.1, 0.14), 0.6)
LENS = mat('lens', (0.35, 0.85, 1.0), 0.05, emit=(0.2, 0.6, 0.9), strength=0.4)
FRAME_Y = mat('frame-yellow', (1.0, 0.82, 0.1), 0.35)
VEST = mat('vest-orange', (1.0, 0.38, 0.05), 0.45)
REFLECT = mat('vest-reflect', (0.92, 0.92, 0.88), 0.3, emit=(0.5, 0.5, 0.45), strength=0.3)
GOLD = mat('crown-gold', (1.0, 0.76, 0.18), 0.25, 0.9, emit=(1.0, 0.6, 0.1), strength=0.8)
GEM = mat('crown-gem', (0.9, 0.08, 0.2), 0.1, emit=(0.9, 0.05, 0.2), strength=1.2)
DARK = mat('shades-dark', (0.03, 0.03, 0.05), 0.1, 0.3)
PINKFRAME = mat('shades-frame', (1.0, 0.3, 0.6), 0.35)
TUBE = mat('snorkel-tube', (1.0, 0.45, 0.05), 0.4)


def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def cylinder(name, a, b, r, material, segments=12, r2=None):
    a, b = G(*a), G(*b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r, radius2=r if r2 is None else r2, depth=(b - a).length)
    ob = new_obj(name, bm, [material])
    ob.location = (a + b) / 2
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(b - a)
    return ob


def ring(name, centre, radius, tube, material, facing='z', scale=(1, 1, 1), seg=28, rseg=8):
    """A torus in game space; `facing` is the game axis through its hole."""
    bm = bmesh.new()
    rows = []
    for i in range(seg):
        a = i / seg * 6.283
        c = Vector((radius * math.cos(a), radius * math.sin(a), 0))
        n = Vector((math.cos(a), math.sin(a), 0))
        rows.append([bm.verts.new(c + n * tube * math.cos(j / rseg * 6.283) + Vector((0, 0, tube * math.sin(j / rseg * 6.283)))) for j in range(rseg)])
    for i in range(seg):
        for j in range(rseg):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % rseg], rows[i][(j + 1) % rseg]))
    ob = new_obj(name, bm, [material])
    ob.location = G(*centre)
    # Blender's torus lies in its XY plane (hole along Blender Z = game y).
    ob.rotation_euler = {'y': (0, 0, 0), 'z': (math.radians(90), 0, 0), 'x': (0, math.radians(90), 0)}[facing]
    ob.scale = scale
    return ob


def disc(name, centre, radius, material, facing='z', scale=(1, 1, 1), depth=0.012):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=radius, radius2=radius, depth=depth)
    ob = new_obj(name, bm, [material])
    ob.location = G(*centre)
    ob.rotation_euler = {'y': (0, 0, 0), 'z': (math.radians(90), 0, 0), 'x': (0, math.radians(90), 0)}[facing]
    ob.scale = scale
    return ob


def dome(name, centre, radius, material, scale=(1, 1, 1), cut=0.0):
    """The upper part of a sphere (above `cut`, -1..1 of the radius)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=radius)
    gone = [v for v in bm.verts if v.co.z < cut * radius - 1e-6]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    ob = new_obj(name, bm, [material])
    ob.location = G(*centre)
    ob.scale = (scale[0], scale[2], scale[1])
    mod = ob.modifiers.new('solid', 'SOLIDIFY')
    mod.thickness = 0.015
    return ob


def join(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return ob


EYE_Y = 0.84
FACE_Z = 0.205


def goggles(prefix, lens_mat, frame_mat, r=0.062):
    parts = []
    for sx in (-1, 1):
        parts.append(ring(f'{prefix}-rim{sx}', (sx * 0.1, EYE_Y, FACE_Z + 0.02), r, 0.016, frame_mat, 'z'))
        parts.append(disc(f'{prefix}-lens{sx}', (sx * 0.1, EYE_Y, FACE_Z + 0.022), r, lens_mat, 'z'))
    parts.append(cylinder(f'{prefix}-bridge', (-0.04, EYE_Y + 0.01, FACE_Z + 0.03), (0.04, EYE_Y + 0.01, FACE_Z + 0.03), 0.012, frame_mat, 6))
    return parts


# little Zhuda: a blue swim cap with a white stripe, goggles pushed up onto it
cap = [dome('cap-dome', (0, 0.8, -0.03), 0.3, CAP, scale=(1.06, 0.88, 1.0), cut=0.1)]
cap.append(ring('cap-stripe', (0, 0.95, -0.03), 0.24, 0.02, CAP_STRIPE, 'y', scale=(1.06, 1.0, 1.0)))
cap.append(ring('cap-strap', (0, 0.86, -0.03), 0.31, 0.016, STRAP, 'y', scale=(1.04, 1.0, 0.95)))
for sx in (-1, 1):
    cap.append(ring(f'cap-rim{sx}', (sx * 0.1, 0.9, 0.2), 0.058, 0.017, STRAP, 'z'))
    cap.append(disc(f'cap-lens{sx}', (sx * 0.1, 0.9, 0.205), 0.056, LENS, 'z'))
join('cap', cap)

# chubby Zhuda: an orange life jacket with white bands
vest = []
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=0.33, radius2=0.29, depth=0.36)
vob = new_obj('vest-body', bm, [VEST])
vob.location = G(0, 0.38, 0.02)
vob.scale = (1.06, 0.98, 1.0)
mod = vob.modifiers.new('solid', 'SOLIDIFY')
mod.thickness = 0.05
vest.append(vob)
for y in (0.3, 0.44):
    vest.append(ring(f'vest-band{y}', (0, y, 0.02), 0.335 - (y - 0.3) * 0.12, 0.018, REFLECT, 'y', scale=(1.06, 0.98, 1.0)))
vest.append(ring('vest-collar', (0, 0.57, 0.0), 0.24, 0.05, VEST, 'y', scale=(1.05, 1.0, 1.0)))
vest.append(cylinder('vest-zip', (0, 0.22, 0.345), (0, 0.55, 0.3), 0.012, STRAP, 6))
join('vest', vest)

# golden Zhuda: a crown round the orange on its head
crown = [ring('crown-band', (0, 1.0, -0.02), 0.15, 0.03, GOLD, 'y', seg=32)]
for k in range(6):
    a = k / 6 * 6.283
    x, z = 0.15 * math.sin(a), -0.02 + 0.15 * math.cos(a)
    crown.append(cylinder(f'crown-spike{k}', (x, 1.01, z), (x * 1.12, 1.17, z * 1.0 - 0.002), 0.035, GOLD, 8, 0.005))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.022)
    ball = new_obj(f'crown-ball{k}', bm, [GOLD])
    ball.location = G(x * 1.12, 1.175, z)
    crown.append(ball)
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.035)
gem = new_obj('crown-gem', bm, [GEM])
gem.location = G(0, 1.0, 0.16)
crown.append(gem)
join('crown', crown)

# swim-ring Zhuda: big pink sunglasses
shades = []
for sx in (-1, 1):
    shades.append(disc(f'shades-lens{sx}', (sx * 0.11, EYE_Y, FACE_Z + 0.025), 0.075, DARK, 'z', scale=(1.15, 0.85, 1.0), depth=0.02))
    shades.append(ring(f'shades-rim{sx}', (sx * 0.11, EYE_Y, FACE_Z + 0.022), 0.078, 0.014, PINKFRAME, 'z', scale=(1.15, 0.85, 1.0)))
    shades.append(cylinder(f'shades-arm{sx}', (sx * 0.2, EYE_Y + 0.01, FACE_Z), (sx * 0.27, EYE_Y + 0.02, -0.05), 0.011, PINKFRAME, 6))
shades.append(cylinder('shades-bridge', (-0.03, EYE_Y + 0.02, FACE_Z + 0.035), (0.03, EYE_Y + 0.02, FACE_Z + 0.035), 0.012, PINKFRAME, 6))
join('shades', shades)

# diver Zhuda: one wide mask and a snorkel up the side of the head
snorkel = []
snorkel.append(disc('mask-glass', (0, EYE_Y, FACE_Z + 0.03), 0.1, LENS, 'z', scale=(1.75, 0.85, 1.0), depth=0.02))
snorkel.append(ring('mask-frame', (0, EYE_Y, FACE_Z + 0.025), 0.1, 0.022, FRAME_Y, 'z', scale=(1.75, 0.85, 1.0), seg=32))
snorkel.append(ring('mask-strap', (0, EYE_Y + 0.02, -0.02), 0.29, 0.016, STRAP, 'y', scale=(1.04, 1.0, 0.95)))
pts = [(0.25, 0.7, 0.12), (0.3, 0.8, 0.06), (0.31, 0.95, 0.03), (0.3, 1.1, 0.02), (0.28, 1.2, 0.03)]
for i in range(len(pts) - 1):
    snorkel.append(cylinder(f'tube{i}', pts[i], pts[i + 1], 0.028, TUBE, 10))
snorkel.append(cylinder('tube-mouth', (0.25, 0.7, 0.12), (0.06, 0.7, 0.26), 0.025, TUBE, 10))
join('snorkel', snorkel)

bpy.ops.object.select_all(action='SELECT')
path = os.path.join(OUT, 'gear.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
print('EXPORTED', path, os.path.getsize(path), [o.name for o in bpy.context.scene.objects])
