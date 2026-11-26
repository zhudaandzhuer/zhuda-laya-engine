# Opens kit-written .glb parts in Blender and says what Blender makes of them.
#
#   blender -b -P games/tools/blender/inspect-parts.py -- <parts dir> <out dir> [body] [part ...]
#
# For each file: what was imported (armature, bones, meshes, groups, colours, actions), whether
# every vertex is weighted, whether stored normals agree with the faces, whether the faces of a
# mesh are turned one way. Then, with the body and the parts in one scene on the body's clips:
# how far the bones and the skin move, and how far each part's surface stays from the body's.
# Then pictures from the front and the side, and each part exported again untouched.
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
parts_dir, out_dir = os.path.abspath(argv[0]), os.path.abspath(argv[1])
body_name = argv[2] if len(argv) > 2 else "body"
part_names = argv[3:] if len(argv) > 3 else ["tee", "trousers", "skirt", "straw-hat", "pack"]
os.makedirs(out_dir, exist_ok=True)
report = {"blender": bpy.app.version_string, "files": {}, "clips": {}, "pictures": [], "exports": {}}


def empty_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(parts_dir, name + ".glb"))
    return [o for o in bpy.data.objects if o not in before]


def skinned(o):
    # the importer also adds an icosphere it draws bones with; the model is what an armature moves
    return o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)


def file_triangles(name):
    # triangles as the file states them, to compare with what Blender keeps
    import struct
    with open(os.path.join(parts_dir, name + ".glb"), "rb") as f:
        data = f.read()
    doc = json.loads(data[20:20 + struct.unpack("<I", data[12:16])[0]])
    out = {}
    for node in doc["nodes"]:
        if "mesh" in node:
            mesh = doc["meshes"][node["mesh"]]
            out[node.get("name", mesh.get("name"))] = sum(doc["accessors"][p["indices"]]["count"] // 3 for p in mesh["primitives"])
    return out


def describe(objects):
    info = {"objects": {}, "armatures": [], "meshes": []}
    for o in objects:
        info["objects"][o.type] = info["objects"].get(o.type, 0) + 1
    for o in objects:
        if o.type == "ARMATURE":
            info["armatures"].append({
                "name": o.name, "bones": len(o.data.bones),
                "roots": [b.name for b in o.data.bones if b.parent is None],
                "names": [b.name for b in o.data.bones],
            })
        if not skinned(o):
            if o.type == "MESH":
                info["helpers"] = info.get("helpers", []) + [o.name]
            continue
        me = o.data
        groups = [g.name for g in o.vertex_groups]
        unweighted = low_total = 0
        most = 0
        for v in me.vertices:
            total = sum(g.weight for g in v.groups)
            most = max(most, sum(1 for g in v.groups if g.weight > 0))
            if total <= 1e-6:
                unweighted += 1
            elif abs(total - 1) > 1e-3:
                low_total += 1
        # stored normals against the faces they sit on
        against = 0
        corner = me.corner_normals
        for poly in me.polygons:
            for li in poly.loop_indices:
                if corner[li].vector.dot(poly.normal) < 0:
                    against += 1
                    break
        # are the faces turned one way? ask Blender to make them consistent and count what it turns
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        was = [f.normal.copy() for f in bm.faces]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        turned = sum(1 for f, n in zip(bm.faces, was) if f.normal.dot(n) < 0)
        turned = min(turned, len(was) - turned)  # "outside" of an open sheet is a coin toss
        open_edges = sum(1 for e in bm.edges if len(e.link_faces) == 1)
        many_edges = sum(1 for e in bm.edges if len(e.link_faces) > 2)
        loose = sum(1 for v in bm.verts if not v.link_faces)
        bm.free()
        mods = [m for m in o.modifiers if m.type == "ARMATURE"]
        info["meshes"].append({
            "name": o.name, "vertices": len(me.vertices), "faces": len(me.polygons),
            "triangles": sum(len(p.vertices) - 2 for p in me.polygons),
            "vertexGroups": len(groups), "armatureModifier": bool(mods and mods[0].object),
            "parent": o.parent.name if o.parent else None,
            "unweightedVertices": unweighted, "weightsNotSummingToOne": low_total, "mostInfluences": most,
            "colourAttributes": [c.name for c in me.color_attributes], "uvLayers": [u.name for u in me.uv_layers],
            "materials": [m.name if m else None for m in me.materials],
            "facesWithStoredNormalAgainstFace": against, "facesBlenderWouldTurn": turned,
            "openEdges": open_edges, "edgesWithMoreThanTwoFaces": many_edges, "looseVertices": loose,
        })
    info["actions"] = [{"name": a.name, "frames": [a.frame_range[0], a.frame_range[1]]} for a in bpy.data.actions]
    return info


def use_action(armature, action):
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if action is not None and hasattr(armature.animation_data, "action_slot") and len(action.slots):
        armature.animation_data.action_slot = action.slots[0]


def world_mesh(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    m = ev.matrix_world
    verts = [m @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return verts, polys


# 1. each file on its own
for name in [body_name] + part_names:
    empty_scene()
    report["files"][name] = describe(import_glb(name))
    in_file = file_triangles(name)
    for m in report["files"][name]["meshes"]:
        m["trianglesInFile"] = in_file.get(m["name"])

# 2. body and parts in one scene, on the body's clips
empty_scene()
scene = bpy.context.scene
body_objs = import_glb(body_name)
body_arm = next(o for o in body_objs if o.type == "ARMATURE")
body_meshes = [o for o in body_objs if skinned(o)]
parts = {}
for name in part_names:
    objs = import_glb(name)
    parts[name] = {"arm": next(o for o in objs if o.type == "ARMATURE"), "meshes": [o for o in objs if skinned(o)]}
actions = {a.name: a for a in bpy.data.actions}
report["sceneFps"] = scene.render.fps


def pose(action, frame):
    for arm in [body_arm] + [p["arm"] for p in parts.values()]:
        use_action(arm, action)
    scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return bpy.context.evaluated_depsgraph_get()


def body_surface(depsgraph):
    verts, polys = [], []
    for o in body_meshes:
        v, p = world_mesh(o, depsgraph)
        base = len(verts)
        verts += v
        polys += [tuple(i + base for i in poly) for poly in p]
    return verts, BVHTree.FromPolygons(verts, polys)


def gaps(depsgraph, tree):
    out = {}
    for name, p in parts.items():
        d = []
        for o in p["meshes"]:
            v, _ = world_mesh(o, depsgraph)
            for co in v:
                hit = tree.find_nearest(co)
                if hit[0] is None:
                    continue
                side = (co - hit[0]).dot(hit[1])
                d.append(math.copysign(hit[3], side) if abs(side) > 1e-9 else 0.0)
        d.sort()
        d = sorted(abs(x) for x in d)  # the body is ten open shells: a side is not defined, a distance is
        out[name] = {"min": d[0], "median": d[len(d) // 2], "p95": d[int(len(d) * 0.95)], "max": d[-1], "n": len(d)}
    return out


rest = pose(None, 0)
for arm in [body_arm] + [p["arm"] for p in parts.values()]:
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
bpy.context.view_layer.update()
rest = bpy.context.evaluated_depsgraph_get()
rest_bones = {pb.name: (body_arm.matrix_world @ pb.head).copy() for pb in body_arm.pose.bones}
rest_body, rest_tree = body_surface(rest)
report["rest"] = {"gapMetres": gaps(rest, rest_tree)}
lo = Vector((min(v.x for v in rest_body), min(v.y for v in rest_body), min(v.z for v in rest_body)))
hi = Vector((max(v.x for v in rest_body), max(v.y for v in rest_body), max(v.z for v in rest_body)))
report["rest"]["bodyBoxMetres"] = {"min": list(lo), "max": list(hi)}

for clip, action in actions.items():
    f0, f1 = action.frame_range
    frames = sorted({int(round(f0 + (f1 - f0) * k / 8)) for k in range(9)})
    bone_move = skin_move = 0.0
    part_move = {n: 0.0 for n in parts}
    worst = {n: {"medianLow": 1e9, "medianHigh": -1e9, "p95Low": 1e9, "p95High": -1e9} for n in parts}
    first = None
    for f in frames:
        dg = pose(action, f)
        bones = {pb.name: body_arm.matrix_world @ pb.head for pb in body_arm.pose.bones}
        bone_move = max(bone_move, max((bones[n] - rest_bones[n]).length for n in bones))
        verts, tree = body_surface(dg)
        skin_move = max(skin_move, max((a - b).length for a, b in zip(verts, rest_body)))
        for name, p in parts.items():
            now = [co for o in p["meshes"] for co in world_mesh(o, dg)[0]]
            if first is None:
                first = {}
            if name not in first:
                first[name] = now
            part_move[name] = max(part_move[name], max((a - b).length for a, b in zip(now, first[name])))
        for name, g in gaps(dg, tree).items():
            w = worst[name]
            w["medianLow"] = min(w["medianLow"], g["median"])
            w["medianHigh"] = max(w["medianHigh"], g["median"])
            w["p95Low"] = min(w["p95Low"], g["p95"])
            w["p95High"] = max(w["p95High"], g["p95"])
    report["clips"][clip] = {"frames": frames, "farthestBoneFromRestMetres": bone_move, "farthestSkinVertexFromRestMetres": skin_move,
                             "partFarthestFromFirstFrameMetres": part_move, "partGapMetres": worst}

# 3. pictures
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x, scene.render.resolution_y = 900, 1200
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
scene.render.film_transparent = False
sh = scene.display.shading
sh.light, sh.color_type = "STUDIO", "VERTEX"
sh.show_cavity, sh.show_backface_culling, sh.show_object_outline = True, True, False
scene.display.render_aa = "16"
if scene.world is None:
    scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.82, 0.84, 0.86)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type, cam.data.ortho_scale = "ORTHO", (hi.z - lo.z) * 1.12
mid = (lo.z + hi.z) / 2
views = {"front": ((0, -6, mid), (math.pi / 2, 0, 0)), "side": ((6, 0, mid), (math.pi / 2, 0, math.pi / 2)),
         "back": ((0, 6, mid), (math.pi / 2, 0, math.pi))}


def show(names):
    for name, p in parts.items():
        for o in p["meshes"]:
            o.hide_render = name not in names


def shoot(label, names, action, frame):
    show(names)
    pose(action, frame)
    if action is None:
        for arm in [body_arm] + [p["arm"] for p in parts.values()]:
            for pb in arm.pose.bones:
                pb.matrix_basis.identity()
    for view, (loc, rot) in views.items():
        cam.location, cam.rotation_euler = loc, rot
        path = os.path.join(out_dir, f"{label}-{view}.jpg")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        report["pictures"].append(os.path.basename(path))


walk = actions.get("Walk")
outfit_a = [n for n in part_names if n != "skirt"]
outfit_b = [n for n in part_names if n in ("tee", "skirt")]
try:
    shoot("body-rest", [], None, 0)
    shoot("outfit-a-rest", outfit_a, None, 0)
    shoot("outfit-b-rest", outfit_b, None, 0)
    if walk:
        f = int(round(walk.frame_range[0] + (walk.frame_range[1] - walk.frame_range[0]) * 0.25))
        shoot("outfit-a-walk", outfit_a, walk, f)
        shoot("outfit-b-walk", outfit_b, walk, f)
except Exception as error:  # a machine with no display may not draw; the numbers above still stand
    report["pictureError"] = repr(error)

# 4. each part out again, untouched, with the exporter's own settings
for name in part_names:
    empty_scene()
    import_glb(name)
    path = os.path.join(out_dir, f"{name}.blender-export.glb")
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")
        report["exports"][name] = {"file": os.path.basename(path), "bytes": os.path.getsize(path)}
    except Exception as error:
        report["exports"][name] = {"error": repr(error)}

with open(os.path.join(out_dir, "blender-report.json"), "w") as f:
    json.dump(report, f, indent=2)
print("REPORT", os.path.join(out_dir, "blender-report.json"))
