"""A full, rounded tree for the island: a trunk with branches and a crown of
lumpy leaf clusters, its colours baked into one map.

    blender -b --factory-startup -P source/tree.py       (from prefabs/3d/sky-island)

Writes assets/tree.glb with two nodes, `trunk` and `canopy`
(the crown sways about its own origin, where the trunk meets it).
Blender units are metres, z up.
"""
import math
import os
import random
import bpy
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
rnd = random.Random(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
coll = bpy.context.scene.collection


def tube(points, radii, name, seg=10):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 1.0
    curve.bevel_resolution = 3
    curve.resolution_u = 8
    sp = curve.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p, r in zip(sp.bezier_points, points, radii):
        bp.co = Vector(p)
        bp.radius = r
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, curve)
    coll.objects.link(o)
    return o


# -- trunk, branches and root flare ------------------------------------------------
parts = [tube([(0, 0, -0.2), (0.05, 0.02, 1.0), (0.18, -0.05, 2.2), (0.12, 0.08, 3.3)], [0.36, 0.25, 0.2, 0.14], 'trunk0')]
tips = []
for k in range(6):
    a = k * 2 * math.pi / 6 + rnd.uniform(-0.3, 0.3)
    z0 = 1.9 + 0.25 * k
    length = rnd.uniform(1.3, 2.0)
    d = Vector((math.cos(a), math.sin(a), 0))
    p0 = Vector((0.12, 0.0, z0))
    p1 = p0 + d * length * 0.5 + Vector((0, 0, length * 0.45))
    p2 = p0 + d * length + Vector((0, 0, length * 0.75))
    parts.append(tube([p0, p1, p2], [0.12, 0.08, 0.04], f'branch{k}'))
    tips.append(p2)
for k in range(5):
    a = k * 2 * math.pi / 5 + 0.4
    d = Vector((math.cos(a), math.sin(a), 0))
    parts.append(tube([d * 0.05 + Vector((0, 0, 0.45)), d * 0.45 + Vector((0, 0, 0.05)), d * 0.8 + Vector((0, 0, -0.12))], [0.16, 0.09, 0.03], f'root{k}'))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
trunk = bpy.context.active_object
trunk.name = 'trunk'
# bark: ridges along the trunk
trunk.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
for poly in trunk.data.polygons:
    for li in poly.loop_indices:
        p = trunk.data.vertices[trunk.data.loops[li].vertex_index].co
        n = 0.5 + 0.5 * noise.noise(Vector((p.x * 9, p.y * 9, p.z * 1.5)))
        c = (0.26 * (0.7 + 0.5 * n), 0.17 * (0.7 + 0.5 * n), 0.1 * (0.75 + 0.4 * n))
        trunk.data.color_attributes['Col'].data[li].color = (*c, 1)

# -- the crown: lumpy clusters in a rounded mass, more round the branch tips ----------
CROWN = Vector((0.15, 0.0, 4.4))
blobs = []
for i in range(46):
    # spread over a squashed sphere, a little denser near its surface
    while True:
        p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
        if p.length <= 1:
            break
    p = Vector((p.x * 2.3, p.y * 2.3, p.z * 1.45)) * (0.55 + 0.45 * p.length)
    blobs.append((CROWN + p, rnd.uniform(0.62, 1.0)))
for tip in tips:
    blobs.append((tip + Vector((0, 0, 0.35)), rnd.uniform(0.75, 1.0)))
blobs.append((CROWN + Vector((0, 0, 1.4)), 1.2))
objs = []
for i, (c, r) in enumerate(blobs):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=c)
    o = bpy.context.active_object
    seed = Vector((i * 3.1, i * 1.7, 0))
    for v in o.data.vertices:
        d = v.co.normalized()
        w = c + v.co
        big = noise.noise(w * 0.9 + seed) * 0.16
        bump = noise.noise(w * 6.0 + seed) * 0.11 + noise.noise(w * 13.0 + seed) * 0.05
        v.co = v.co + d * (big + bump) * r - Vector((0, 0, max(0, -d.z) * 0.18 * r))
    # colour while the cluster is still alone: light where it faces up and out, dark underneath and in its folds
    o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    hgt = (c.z - 2.6) / 4.2
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index]
            d = v.co.normalized()
            fold = (v.co.length / r - 0.85) * 2.5
            light = max(0.0, min(1.0, 0.45 + 0.4 * d.z + 0.25 * hgt + 0.35 * fold))
            fine = 0.5 + 0.5 * noise.noise((c + v.co) * 8.0)
            warm = 0.5 + 0.5 * noise.noise((c + v.co) * 0.7 + Vector((5, 1, 2)))
            col = (0.08 + 0.2 * light + 0.06 * warm, 0.2 + 0.3 * light + 0.03 * warm, 0.05 + 0.06 * light)
            col = tuple(x * (0.82 + 0.36 * fine) for x in col)
            o.data.color_attributes['Col'].data[li].color = (*col, 1)
    objs.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
canopy = bpy.context.active_object
canopy.name = 'canopy'
bpy.ops.object.shade_smooth()
# mesh in world coordinates, origin at the world's
canopy.data.transform(__import__('mathutils').Matrix.Translation(canopy.location))
canopy.location = Vector((0, 0, 0))
top = max(v.co.z for v in canopy.data.vertices)


def bake(obj, name, size, rough):
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
    out = nt.nodes['Material Output']
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(attr.outputs['Color'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.nodes.active = tex
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.render.bake.margin = 4
    bpy.ops.object.bake(type='EMIT')
    for node in list(nt.nodes):
        if node not in (bsdf, out, tex):
            nt.nodes.remove(node)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = rough
    image.filepath_raw = os.path.join(OUT, name + '.png')
    image.file_format = 'PNG'
    image.save()


bake(trunk, 'tree-bark', 512, 0.9)
bake(canopy, 'tree-leaves', 1024, 0.75)
# the crown sways about where the trunk enters it
pivot = Vector((0.12, 0.08, 3.1))
canopy.data.transform(__import__('mathutils').Matrix.Translation(-pivot))
canopy.location = pivot
bpy.ops.object.select_all(action='DESELECT')
trunk.select_set(True)
canopy.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'tree.glb'), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='JPEG', export_jpeg_quality=90, export_attributes=False)
for name in ('tree-bark', 'tree-leaves'):
    os.remove(os.path.join(OUT, name + '.png'))
print('TREE', len(trunk.data.polygons), len(canopy.data.polygons), 'top', round(top, 2))
