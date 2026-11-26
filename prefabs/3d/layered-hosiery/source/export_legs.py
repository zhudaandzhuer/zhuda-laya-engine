# Builds the legs for the stocking bench with MPFB (MakeHuman for Blender) and writes
# them for the game: a slim adult woman, cut just above the waist, arms removed,
# subdivided once, split into a left and a right leg at the midline.
#
#   blender -b --factory-startup -noaudio \
#     --python-expr "import bpy; bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')" \
#     --python blender/export_legs.py -- <out.json> [waist metres]
#
# Output: { "joints": {...heights in metres...}, "legs": [ {side, positions, normals, indices}, ... ] }
# Positions in metres, y up, the body facing +z (Blender's -y), feet on y = 0.
import bpy, bmesh, json, sys
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_path = argv[0] if argv else "legs.json"
waist = float(argv[1]) if len(argv) > 1 else 1.02

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

macro = {"gender": 0.0, "age": 0.5, "muscle": 0.45, "weight": 0.35, "proportions": 0.85, "height": 0.55,
         "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.6, "caucasian": 0.3, "african": 0.1}}
human = HumanService.create_human(mask_helpers=False, detailed_helpers=True, extra_vertex_groups=True,
                                  feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
bpy.context.view_layer.objects.active = human
human.select_set(True)

# Joint heights (mean of each joint cube) before anything is removed.
def joint(name):
    g = human.vertex_groups.get(name)
    if g is None:
        return None
    pts = [human.matrix_world @ v.co for v in human.data.vertices if any(e.group == g.index for e in v.groups)]
    if not pts:
        return None
    c = sum(pts, Vector()) / len(pts)
    return [round(c.x, 5), round(c.z, 5), round(-c.y, 5)]


# The shape as it is now, baked into the mesh.
TargetService.bake_targets(human)
if human.data.shape_keys:
    human.shape_key_clear()

# Joint places on the shaped body (measured before the shape was baked they are the base mesh's).
joints = {k: joint("joint-" + k) for k in ["l-ankle", "r-ankle", "l-knee", "r-knee", "l-upper-leg", "r-upper-leg", "l-foot-1", "l-foot-2", "r-foot-1", "r-foot-2", "ground"]}

# Keep the body only, below the waist, without the arms and hands.
body = human.vertex_groups["body"].index
bm = bmesh.new()
bm.from_mesh(human.data)
deform = bm.verts.layers.deform.active
drop = []
for v in bm.verts:
    in_body = deform is not None and body in v[deform]
    x, z = v.co.x, v.co.z
    if not in_body or z > waist or (abs(x) > 0.21 and z > 0.3):
        drop.append(v)
bmesh.ops.delete(bm, geom=drop, context="VERTS")
# Loose bits left by the cut (fingertips below the cut, say).
islands = []
seen = set()
for v in bm.verts:
    if v.index in seen:
        continue
    stack, island = [v], []
    while stack:
        a = stack.pop()
        if a.index in seen:
            continue
        seen.add(a.index)
        island.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                stack.append(b)
    islands.append(island)
bm.verts.index_update()
largest = max(islands, key=len)
keep = set(id(v) for v in largest)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if id(v) not in keep], context="VERTS")
bm.to_mesh(human.data)
bm.free()
human.vertex_groups.clear()

# MakeHuman stands with the feet about 44 cm apart. Bring the legs in (ankles 20 cm
# apart) by a horizontal shear that starts just below the crotch, so the thighs keep
# their gap and the soles stay flat.
crotch0 = min((v.co.z for v in human.data.vertices if abs(v.co.x) < 0.01 and v.co.z > 0.5), default=0.75)
ankle = joints["l-ankle"]
k = max(0.0, (abs(ankle[0]) - 0.10) / (crotch0 - ankle[1]))
def shift(z):
    d = max(0.0, crotch0 - z)
    t = min(1.0, d / 0.12)
    return k * d * t * t * (3 - 2 * t)
for v in human.data.vertices:
    side = 1 if v.co.x > 0 else -1
    v.co.x -= side * shift(v.co.z)
for key, j in joints.items():
    if j and key[1] == "-":
        side = 1 if j[0] > 0 else -1
        j[0] = round(j[0] - side * shift(j[1]), 5)

# No anatomy: the crotch is smoothed into a plain rounded form (as under clothes).
bm = bmesh.new()
bm.from_mesh(human.data)
crotch = crotch0
region = [v for v in bm.verts if abs(v.co.x) < 0.075 and crotch - 0.05 < v.co.z < crotch + 0.13]
for _ in range(40):
    bmesh.ops.smooth_vert(bm, verts=region, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(human.data)
bm.free()
joints["crotch"] = [0.0, round(crotch, 5), 0.0]

# Smooth silhouettes: one level of subdivision, applied.
sub = human.modifiers.new("subdiv", "SUBSURF")
sub.levels = 1
sub.render_levels = 1
bpy.ops.object.modifier_apply(modifier=sub.name)

# The stocking's own shape, as a shape key: the skin pushed out 2.3 mm, smoothed over
# the toes (a stocking spans them; it does not go down between them), then kept
# outside the skin.
sock = human.copy()
sock.data = human.data.copy()
bpy.context.collection.objects.link(sock)
toes = sock.vertex_groups.new(name="toes")
for v in sock.data.vertices:
    forward = -v.co.y
    t = min(1.0, max(0.0, (forward - 0.12) / 0.05)) * (1.0 if v.co.z < 0.09 else max(0.0, 1 - (v.co.z - 0.09) / 0.03))
    if t > 0:
        toes.add([v.index], t * t * (3 - 2 * t), "REPLACE")
disp = sock.modifiers.new("lift", "DISPLACE")
disp.direction = "NORMAL"
disp.mid_level = 0.0
disp.strength = 0.0023
smooth = sock.modifiers.new("span", "SMOOTH")
smooth.factor = 1.0
smooth.iterations = 40
smooth.vertex_group = "toes"
wrap = sock.modifiers.new("outside", "SHRINKWRAP")
wrap.target = human
wrap.wrap_method = "NEAREST_SURFACEPOINT"
wrap.wrap_mode = "OUTSIDE"
wrap.offset = 0.0023
# Only over the toes: elsewhere the lift along the normal is exact, and a whole-body
# target would push one foot's stocking against the other foot.
wrap.vertex_group = "toes"
bpy.context.view_layer.objects.active = sock
for m in list(sock.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
human.shape_key_add(name="Basis")
key = human.shape_key_add(name="sock")
for i, v in enumerate(sock.data.vertices):
    key.data[i].co = v.co
bpy.data.objects.remove(sock)
bpy.context.view_layer.objects.active = human

def export_half(sign):
    bm = bmesh.new()
    bm.from_mesh(human.data)
    # Normals of the whole body, before the cut; on the cut they lie in the midline
    # plane, so the two halves (and the stockings over them) meet without a seam.
    bm.normal_update()
    whole = {tuple(round(c, 6) for c in v.co): v.normal.copy() for v in bm.verts}
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(1, 0, 0),
                           clear_outer=sign < 0, clear_inner=sign > 0)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    normal_of = {}
    for v in bm.verts:
        n = whole.get(tuple(round(c, 6) for c in v.co))
        if n is None or abs(v.co.x) < 1e-5:
            bm.normal_update() if n is None else None
            n = (n if n is not None else v.normal).copy()
            if abs(v.co.x) < 1e-5:
                n.x = 0.0
        normal_of[v.index] = n.normalized() if n.length > 0 else Vector((0, 0, 1))
    bm.verts.index_update()
    mw = human.matrix_world
    positions, normals, indices, sockp = [], [], [], []
    sock_layer = bm.verts.layers.shape.get("sock")
    for v in bm.verts:
        p = mw @ v.co
        q = mw @ v[sock_layer] if sock_layer is not None else p
        if (q - p).length < 1e-6 or (q - p).length > 0.03:
            q = p + (mw.to_3x3() @ normal_of[v.index]).normalized() * 0.0023
        sockp += [round(q.x, 5), round(q.z, 5), round(-q.y, 5)]
        n = (mw.to_3x3() @ normal_of[v.index]).normalized()
        positions += [round(p.x, 5), round(p.z, 5), round(-p.y, 5)]
        normals += [round(n.x, 4), round(n.z, 4), round(-n.y, 4)]
    for f in bm.faces:
        indices += [v.index for v in f.verts]
    bm.free()
    return {"side": sign, "positions": positions, "normals": normals, "indices": indices, "sock": sockp}

legs = [export_half(-1), export_half(1)]
with open(out_path, "w") as f:
    json.dump({"source": "MPFB 2.0.18 (MakeHuman base mesh, CC0 output)", "macro": macro, "waist": waist,
               "joints": joints, "legs": legs}, f, separators=(",", ":"))
print("WROTE", out_path, [len(l["positions"]) // 3 for l in legs], "verts", [len(l["indices"]) // 3 for l in legs], "tris")
print("JOINTS", joints)
