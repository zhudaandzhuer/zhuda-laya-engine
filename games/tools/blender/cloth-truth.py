# A garment of the kit simulated as cloth on the kit's body, beside the same garment moved by its
# skin weights: how far apart they are, clip by clip.
#
#   blender -b -P games/tools/blender/cloth-truth.py -- <parts dir> <out dir> <garment> <pin: top|waist> [body]
#
# The body's regions are collision objects moved by the body's clips. The garment is two objects
# of the same mesh: one moved by its own weights (what the game draws), one with Blender's cloth
# on it, pinned along its top (a T-shirt hangs from the collar and shoulders, a skirt from its
# waistband) so that it follows the skeleton there and falls freely below. Every fourth frame of
# every clip both are written out, and the distance between the same vertex in each is measured.
# Blender keeps one side of the kit's two-sided cloth (see inspect-parts.py): the simulated sheet
# is that one side. The cloth is Blender's cotton preset, not a measured fabric.
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
parts_dir, out_dir, garment, pin_where = os.path.abspath(argv[0]), os.path.abspath(argv[1]), argv[2], argv[3]
body_name = argv[4] if len(argv) > 4 else "body"
os.makedirs(out_dir, exist_ok=True)
EVERY, SETTLE, PIN_BAND = 4, 40, 0.07 if pin_where == "top" else 0.035


def skinned(o):
    return o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(parts_dir, name + ".glb"))
    return [o for o in bpy.data.objects if o not in before]


def use_action(armature, action):
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if action is not None and hasattr(armature.animation_data, "action_slot") and len(action.slots):
        armature.animation_data.action_slot = action.slots[0]


def world_points(obj):
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    m = np.array(ev.matrix_world)
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    co = co.reshape(-1, 3)
    return (co @ m[:3, :3].T + m[:3, 3]).astype(np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
body_objs = import_glb(body_name)
body_arm = next(o for o in body_objs if o.type == "ARMATURE")
for o in body_objs:
    if skinned(o):
        o.modifiers.new("Collision", "COLLISION")
        o.collision.thickness_outer = 0.004
        o.collision.cloth_friction = 15
part_objs = import_glb(garment)
part_arm = next(o for o in part_objs if o.type == "ARMATURE")
worn = next(o for o in part_objs if skinned(o))  # moved by its weights, as in the game

# the same mesh again, as cloth
sim = worn.copy()
sim.data = worn.data.copy()
sim.name = garment + "-cloth"
scene.collection.objects.link(sim)
rest = world_points(worn)
top = float(rest[:, 2].max())
pin = sim.vertex_groups.new(name="pin")
pinned = [i for i, p in enumerate(rest) if p[2] > top - PIN_BAND]
pin.add(pinned, 1.0, "REPLACE")
cloth = sim.modifiers.new("Cloth", "CLOTH")
s = cloth.settings
s.quality = 10
s.mass = 0.3  # each vertex; Blender's cotton preset
s.tension_stiffness = s.compression_stiffness = s.shear_stiffness = 15
s.bending_stiffness = 0.5
s.tension_damping = s.compression_damping = s.shear_damping = 5
s.bending_damping = 0.5
s.air_damping = 1
s.vertex_group_mass = "pin"
cloth.collision_settings.use_collision = True
cloth.collision_settings.distance_min = 0.004
cloth.collision_settings.collision_quality = 4
# CLOTH_SELF=1: the sheet also collides with itself (slower; without it a skirt folds through itself between the legs)
self_collision = os.environ.get("CLOTH_SELF") == "1"
cloth.collision_settings.use_self_collision = self_collision
if self_collision:
    cloth.collision_settings.self_distance_min = 0.004
    cloth.collision_settings.collision_quality = 6

faces = np.array([tuple(p.vertices) for p in worn.data.polygons if len(p.vertices) == 3], dtype=np.int32)
clips = {a.name: a for a in bpy.data.actions}
report = {"blender": bpy.app.version_string, "garment": garment, "vertices": int(len(rest)), "triangles": int(len(faces)),
          "pinned": {"where": pin_where, "vertices": len(pinned), "bandMetres": PIN_BAND}, "everyFrames": EVERY, "settleFrames": SETTLE,
          "cloth": {"quality": s.quality, "vertexMassKg": s.mass, "tension": s.tension_stiffness, "bending": s.bending_stiffness, "collisionDistance": 0.004, "selfCollision": self_collision},
          "clips": {}}
arrays = {"faces": faces, "rest": rest}
free = np.ones(len(rest), dtype=bool)
free[pinned] = False
low = float(rest[:, 2].min())
third = np.minimum(2, ((top - rest[free][:, 2]) / ((top - low) / 3)).astype(int))

for name in sorted(clips):
    action = clips[name]
    f0, f1 = int(math.floor(action.frame_range[0])), int(math.ceil(action.frame_range[1]))
    for arm in (body_arm, part_arm):
        use_action(arm, action)
    start = f0 - SETTLE
    scene.frame_start, scene.frame_end = start, f1
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = start, f1
    scene.frame_set(start)
    frames, cloth_pos, worn_pos, rows = [], [], [], []
    for f in range(start, f1 + 1):  # the cloth is simulated as the frames go by, in order
        scene.frame_set(f)
        if f < f0 or (f - f0) % EVERY:
            continue
        a, b = world_points(sim), world_points(worn)
        d = np.linalg.norm(a - b, axis=1)[free]
        frames.append(f)
        cloth_pos.append(a)
        worn_pos.append(b)
        rows.append(d)
    d = np.concatenate(rows)
    worst = int(np.argmax([r.max() for r in rows]))
    at = int(np.flatnonzero(free)[int(np.argmax(rows[worst]))])
    report["clips"][name] = {
        "frames": frames,
        "distanceMetres": {"median": round(float(np.median(d)), 4), "mean": round(float(d.mean()), 4), "p95": round(float(np.percentile(d, 95)), 4), "max": round(float(d.max()), 4)},
        "worst": {"frame": frames[worst], "vertex": at, "restHeight": round(float(rest[at][2]), 3), "restPosition": [round(float(x), 3) for x in rest[at]]},
        "shareOver2cm": round(float((d > 0.02).mean()), 4), "shareOver5cm": round(float((d > 0.05).mean()), 4),
        # by height of the vertex at rest, thirds of the garment from the top: where the two part
        "byThirdFromTopMedian": [round(float(np.median(np.concatenate([r[third == k] for r in rows]))), 4) for k in range(3)],
    }
    arrays[f"{name}_frames"] = np.array(frames, dtype=np.int32)
    arrays[f"{name}_cloth"] = np.array(cloth_pos, dtype=np.float32)
    arrays[f"{name}_worn"] = np.array(worn_pos, dtype=np.float32)
    print("CLIP", name, json.dumps(report["clips"][name]["distanceMetres"]), "samples", len(frames))

np.savez_compressed(os.path.join(out_dir, f"{garment}.npz"), **arrays)
with open(os.path.join(out_dir, f"{garment}.json"), "w") as f:
    json.dump(report, f, indent=2)

# one picture: the last sample of Walk, the worn garment and the cloth side by side, from the side
try:
    walk = clips.get("Walk")
    if walk:
        for arm in (body_arm, part_arm):
            use_action(arm, walk)
        f0, f1 = int(math.floor(walk.frame_range[0])), int(math.ceil(walk.frame_range[1]))
        cloth.point_cache.frame_start = scene.frame_start = f0 - SETTLE
        for f in range(f0 - SETTLE, f0 + 13):
            scene.frame_set(f)
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.render.resolution_x, scene.render.resolution_y = 900, 1200
        scene.render.image_settings.file_format = "JPEG"
        scene.render.image_settings.quality = 88
        sh = scene.display.shading
        sh.light, sh.color_type, sh.show_cavity, sh.show_backface_culling = "STUDIO", "OBJECT", True, False
        worn.color, sim.color = (0.85, 0.55, 0.2, 1), (0.25, 0.55, 0.9, 1)
        scene.world = scene.world or bpy.data.worlds.new("w")
        scene.world.color = (0.82, 0.84, 0.86)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        scene.collection.objects.link(cam)
        scene.camera = cam
        cam.data.type, cam.data.ortho_scale = "ORTHO", 1.9
        for view, loc, rot in (("front", (0, -6, 0.85), (math.pi / 2, 0, 0)), ("side", (6, 0, 0.85), (math.pi / 2, 0, math.pi / 2))):
            for label, show in (("worn", worn), ("cloth", sim)):
                worn.hide_render, sim.hide_render = show is not worn, show is not sim
                cam.location, cam.rotation_euler = loc, rot
                scene.render.filepath = os.path.join(out_dir, f"{garment}-walk-{label}-{view}.jpg")
                bpy.ops.render.render(write_still=True)
except Exception as error:
    print("PICTURE FAILED", repr(error))
print("DONE", os.path.join(out_dir, f"{garment}.json"))
