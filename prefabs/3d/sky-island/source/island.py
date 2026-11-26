"""The floating island: its top, cliffs and rocky underside, with a baked colour map,
and the height of its top for the game (one source for both).

    blender -b --factory-startup -P source/island.py -- [--size 2048] [--samples 4]

Writes assets/island.glb and island-data.ts (run from prefabs/3d/sky-island;
moved here from games/zhuda-sky-island/tools, only the output paths changed).
Places are in game coordinates (x right, y up, z toward the first camera);
Blender works with z up, so a game point (x, y, z) is Blender (x, -z, y).
"""
import json
import math
import os
import sys
import bmesh
import bpy
from mathutils import Vector, noise

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda name, default: args[args.index(name) + 1] if name in args else default
SIZE = int(opt('--size', 2048))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'assets')
os.makedirs(OUT, exist_ok=True)

# -- the plan (game coordinates, metres) ----------------------------------------
RADIUS = 7.2
HOUSE = {'center': (2.3, -1.7), 'half': (2.1, 1.9), 'height': 0.32}
TREE = {'center': (-3.1, -2.7), 'radius': 2.0, 'height': 0.3}
POND = {'center': (-2.0, 1.5), 'radii': (1.75, 1.3), 'bottom': -0.55, 'water': -0.1}
PATH = [(0.7, 7.4), (0.8, 4.6), (1.3, 2.4), (2.0, 0.9), (2.3, 0.25)]
PATH_HALF = 0.5


def smooth(a, b, v):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def rim(theta):
    """The island's edge, as a radius at an angle."""
    return RADIUS * (1 + 0.11 * math.sin(3 * theta + 1.0) + 0.07 * math.sin(5 * theta + 2.3) + 0.035 * math.sin(9 * theta + 0.4) + 0.02 * math.sin(14 * theta + 1.7))


def path_distance(x, z):
    best = 1e9
    for (ax, az), (bx, bz) in zip(PATH, PATH[1:]):
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
        best = min(best, math.hypot(x - ax - t * dx, z - az - t * dz))
    return best


def pond_r(x, z):
    """< 1 inside the pond: the ellipse distance, with a wobbly shore."""
    cx, cz = POND['center']
    rx, rz = POND['radii']
    a = math.atan2(z - cz, x - cx)
    wobble = 1 + 0.08 * math.sin(3 * a + 0.5) + 0.05 * math.sin(5 * a + 1.9)
    return math.hypot((x - cx) / rx, (z - cz) / rz) / wobble


def height(x, z):
    """Height of the top; the rim rolls over into the cliff."""
    r = math.hypot(x, z)
    R = rim(math.atan2(z, x))
    h = 0.07 * noise.noise(Vector((x * 0.35, z * 0.35, 0.5))) + 0.05 * noise.noise(Vector((x * 0.9, z * 0.9, 3.1)))
    # a rise toward the back
    h += 0.22 * smooth(2.0, -5.0, z)
    hx, hz = HOUSE['center']
    pad = max(abs(x - hx) / HOUSE['half'][0], abs(z - hz) / HOUSE['half'][1])
    house_w = smooth(1.35, 1.0, pad)
    tx, tz = TREE['center']
    h += TREE['height'] * smooth(TREE['radius'], 0.0, math.hypot(x - tx, z - tz))
    h = h * (1 - house_w) + HOUSE['height'] * house_w
    p = pond_r(x, z)
    if p < 1.25:
        bowl = POND['bottom'] * (1 - smooth(0.0, 1.0, p) ** 1.6)
        h = h * smooth(0.85, 1.25, p) + min(bowl, POND['water'] - 0.06 + 0.1 * smooth(0.9, 1.2, p)) * (1 - smooth(0.85, 1.25, p))
    h -= 0.035 * smooth(PATH_HALF, PATH_HALF * 0.4, path_distance(x, z)) * (1 - house_w)
    h -= 0.45 * smooth(R - 0.9, R, r) ** 1.5
    return h


def ground_colour(x, z, h):
    """Display colour of the top before grass: turf, a worn path, the pond's mud and shore."""
    turf = (0.22, 0.33, 0.12)
    soil = (0.36, 0.25, 0.15)
    mud = (0.2, 0.16, 0.11)
    sand = (0.55, 0.47, 0.33)
    n = 0.5 + 0.5 * noise.noise(Vector((x * 1.7, z * 1.7, 7.0)))
    c = [turf[i] * (0.8 + 0.4 * n) for i in range(3)]
    w = smooth(PATH_HALF, PATH_HALF * 0.55, path_distance(x, z))
    c = [c[i] * (1 - w) + soil[i] * (0.85 + 0.3 * n) * w for i in range(3)]
    p = pond_r(x, z)
    s = smooth(1.3, 1.0, p)
    c = [c[i] * (1 - s) + sand[i] * (0.9 + 0.2 * n) * s for i in range(3)]
    m = smooth(1.0, 0.8, p)
    c = [c[i] * (1 - m) + mud[i] * m for i in range(3)]
    return c


# -- the mesh: a polar grid for the top, rings down the cliff and underside -------
SEG = 200
TOP_RINGS = 46
SIDE = [  # (depth below the rim, radius factor, kind)
    (0.0, 1.0, 'lip'), (0.08, 1.015, 'lip'), (0.22, 1.012, 'earth'), (0.42, 0.995, 'earth'), (0.62, 1.004, 'earth'),
    (0.85, 0.985, 'earth'), (1.08, 0.975, 'earth'), (1.32, 0.958, 'rock'), (1.6, 0.93, 'rock'), (1.95, 0.885, 'rock'),
    (2.35, 0.82, 'rock'), (2.8, 0.74, 'rock'), (3.3, 0.64, 'rock'), (3.85, 0.53, 'rock'), (4.45, 0.41, 'rock'),
    (5.1, 0.29, 'rock'), (5.8, 0.18, 'rock'), (6.5, 0.09, 'rock'), (7.1, 0.035, 'rock'),
]
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
col = bm.loops.layers.color.new('Col')
verts, colours = [], []
centre = bm.verts.new((0, 0, height(0, 0)))
colours_of = {centre.index: ground_colour(0, 0, height(0, 0))}
rings = []
for k in range(1, TOP_RINGS + 1):
    u = k / TOP_RINGS
    ring = []
    for i in range(SEG):
        theta = 2 * math.pi * i / SEG
        r = rim(theta) * u
        x, z = r * math.cos(theta), r * math.sin(theta)
        h = height(x, z)
        v = bm.verts.new((x, -z, h))
        ring.append((v, ground_colour(x, z, h)))
    rings.append(ring)
rim_heights = [rings[-1][i][0].co.z for i in range(SEG)]
strata = [(0.6, 0.42, 0.26), (0.7, 0.52, 0.32), (0.52, 0.35, 0.22), (0.78, 0.6, 0.4), (0.58, 0.44, 0.3)]
rock = (0.56, 0.53, 0.49)
for depth, factor, kind in SIDE[1:]:
    ring = []
    for i in range(SEG):
        theta = 2 * math.pi * i / SEG
        R = rim(theta) * factor
        x, z = R * math.cos(theta), R * math.sin(theta)
        y = rim_heights[i] - depth
        # lumps: bigger further down; a few deep folds run down the cliff
        lump = noise.noise(Vector((x * 0.45, z * 0.45, y * 0.6))) * (0.12 + 0.5 * min(1, depth / 3)) + 0.25 * noise.noise(Vector((x * 1.3, z * 1.3, y * 0.9))) * min(1, depth / 2)
        fold = 0.18 * max(0.0, math.sin(7 * theta + 2 * noise.noise(Vector((x * 0.2, z * 0.2, 1.0))))) ** 6 * min(1, depth / 1.2)
        s = max(0.05, 1 + (lump - fold) / max(0.4, R))
        x, z = x * s, z * s
        y += 0.15 * noise.noise(Vector((x * 0.6, z * 0.6, 9.0))) * min(1, depth)
        n = 0.5 + 0.5 * noise.noise(Vector((x * 2.2, z * 2.2, y * 2.2)))
        if kind == 'lip':
            c = [0.2 * (0.85 + 0.3 * n), 0.3 * (0.85 + 0.3 * n), 0.11]
        elif kind == 'earth':
            band = strata[int((depth * 7 + 0.4 * noise.noise(Vector((x * 0.3, z * 0.3, 2.0)))) % len(strata))]
            c = [band[j] * (0.85 + 0.3 * n) for j in range(3)]
        else:
            t = smooth(1.2, 2.0, depth)
            band = strata[int(depth * 5) % len(strata)]
            c = [(band[j] * (1 - t) + rock[j] * t) * (0.75 + 0.45 * n) for j in range(3)]
        v = bm.verts.new((x, -z, y))
        ring.append((v, c))
    rings.append(ring)
bottom = bm.verts.new((0.1, 0.05, rim_heights[0] - 7.4))
bm.verts.ensure_lookup_table()


def face(vs, cs):
    f = bm.faces.new(vs)
    for loop in f.loops:
        c = cs[vs.index(loop.vert)]
        loop[col] = (*c, 1)
    f.smooth = True


c0 = ground_colour(0, 0, height(0, 0))
for i in range(SEG):
    j = (i + 1) % SEG
    face([centre, rings[0][i][0], rings[0][j][0]][::-1], [c0, rings[0][i][1], rings[0][j][1]][::-1])
for a, b in zip(rings, rings[1:]):
    for i in range(SEG):
        j = (i + 1) % SEG
        vs = [a[i][0], b[i][0], b[j][0], a[j][0]]
        cs = [a[i][1], b[i][1], b[j][1], a[j][1]]
        face(vs[::-1], cs[::-1])
last = rings[-1]
for i in range(SEG):
    j = (i + 1) % SEG
    face([last[i][0], bottom, last[j][0]][::-1], [last[i][1], rock, last[j][1]][::-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh = bpy.data.meshes.new('island')
bm.to_mesh(mesh)
bm.free()
island = bpy.data.objects.new('island', mesh)
bpy.context.scene.collection.objects.link(island)

# -- hanging rocks and roots under the island ----------------------------------------
def rock_blob(name, at, size, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=at)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        p = v.co
        d = 1 + 0.35 * noise.noise(p * 1.3 + Vector((seed, 0, 0))) + 0.15 * noise.noise(p * 3 + Vector((0, seed, 0)))
        v.co = Vector((p.x * size[0], p.y * size[1], p.z * size[2])) * d
    o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            p = o.data.vertices[o.data.loops[li].vertex_index].co
            n = 0.5 + 0.5 * noise.noise(p * 2.5 + Vector((seed, seed, 0)))
            top = smooth(0.1, 0.6, p.z / max(0.01, size[2]))
            c = [(rock[j] * (1 - top) + (0.24, 0.3, 0.14)[j] * top) * (0.7 + 0.5 * n) for j in range(3)]
            o.data.color_attributes['Col'].data[li].color = (*c, 1)
    bpy.ops.object.shade_smooth()
    return o


floaters = [
    rock_blob('float-a', (-8.6, 3.0, -2.2), (0.75, 0.6, 0.55), 1.0),
    rock_blob('float-b', (8.2, -4.4, -3.4), (0.5, 0.45, 0.4), 2.0),
    rock_blob('float-c', (5.5, 7.5, -1.2), (0.35, 0.3, 0.28), 3.0),
]
# roots: thin bent tubes hanging from the cliff
roots = []
for k in range(14):
    theta = 2 * math.pi * (k + 0.3 * math.sin(k * 3.1)) / 14
    R = rim(theta) * 0.99
    x0, z0 = R * math.cos(theta), R * math.sin(theta)
    i = int(theta / (2 * math.pi) * SEG) % SEG
    y0 = rim_heights[i] - 0.25 - 0.4 * (k % 3)
    length = 0.8 + 0.9 * ((k * 7) % 5) / 4
    curve = bpy.data.curves.new(f'root{k}', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.018 + 0.012 * (k % 2)
    curve.bevel_resolution = 2
    sp = curve.splines.new('BEZIER')
    sp.bezier_points.add(2)
    out = Vector((math.cos(theta), -math.sin(theta), 0))
    pts = [Vector((x0, -z0, y0)) - out * 0.05, Vector((x0, -z0, y0)) + out * 0.12 + Vector((0, 0, -length * 0.5)), Vector((x0, -z0, y0)) + out * 0.05 + Vector((0.1 * math.sin(k), 0.1 * math.cos(k), -length))]
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.bezier_points[-1].radius = 0.2
    o = bpy.data.objects.new(f'root{k}', curve)
    bpy.context.scene.collection.objects.link(o)
    roots.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in roots:
    o.select_set(True)
bpy.context.view_layer.objects.active = roots[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
root_obj = bpy.context.active_object
root_obj.name = 'roots'
root_obj.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
for d in root_obj.data.color_attributes['Col'].data:
    d.color = (0.24, 0.16, 0.1, 1)
# join everything under the island into one object (one material, one bake)
bpy.ops.object.select_all(action='DESELECT')
for o in [root_obj, island]:
    o.select_set(True)
bpy.context.view_layer.objects.active = island
bpy.ops.object.join()

# -- bake the colours (with fine grain) into one map ---------------------------------
def bake(obj, name, size):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    image = bpy.data.images.new(name, size, size)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    grain = nt.nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 60
    grain.inputs['Detail'].default_value = 8
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['To Min'].default_value = 0.78
    ramp.inputs['To Max'].default_value = 1.18
    nt.links.new(grain.outputs['Fac'], ramp.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    nt.links.new(attr.outputs['Color'], mix.inputs[6])
    nt.links.new(ramp.outputs['Result'], mix.inputs[7])
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(mix.outputs[2], emit.inputs['Color'])
    out = nt.nodes['Material Output']
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.nodes.active = tex
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.device = 'CPU'
    scene.render.bake.margin = 6
    bpy.ops.object.bake(type='EMIT')
    # now the exported material: the baked map as the colour, rough soil
    for node in list(nt.nodes):
        if node not in (bsdf, out, tex):
            nt.nodes.remove(node)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.92
    image.filepath_raw = os.path.join(OUT, name + '.png')
    image.file_format = 'PNG'
    image.save()
    return mat


bake(island, 'island-ground', SIZE)
bpy.ops.object.select_all(action='DESELECT')
for o in floaters:
    o.select_set(True)
bpy.context.view_layer.objects.active = floaters[0]
bpy.ops.object.join()
floaters[0].name = 'floaters'
bake(floaters[0], 'island-floaters', 512)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'island.glb'), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='JPEG', export_jpeg_quality=90, export_attributes=False)
for name in ('island-ground', 'island-floaters'):
    os.remove(os.path.join(OUT, name + '.png'))

# -- the top's heights for the game: 0.2 m grid, null off the island ---------------------
STEP = 0.2
N = int(2 * (RADIUS * 1.25) / STEP) + 1
X0 = -(N - 1) * STEP / 2
heights = []
for zi in range(N):
    for xi in range(N):
        x, z = X0 + xi * STEP, X0 + zi * STEP
        heights.append(round(height(x, z), 3) if math.hypot(x, z) <= rim(math.atan2(z, x)) - 0.05 else None)
rim_samples = [round(rim(2 * math.pi * i / 128), 3) for i in range(128)]
with open(os.path.join(ROOT, 'island-data.ts'), 'w') as f:
    f.write('// Written by source/island.py: the island top\'s heights (the same function that shaped the mesh). Do not edit.\n')
    f.write('export const island = ' + json.dumps({
        'step': STEP, 'count': N, 'origin': X0, 'heights': heights, 'rim': rim_samples,
        'house': HOUSE, 'tree': TREE, 'pond': POND, 'path': PATH, 'pathHalf': PATH_HALF,
    }, separators=(',', ':')) + ' as const;\n')
print('ISLAND', os.path.join(OUT, 'island.glb'), 'grid', N, 'faces', len(island.data.polygons))
