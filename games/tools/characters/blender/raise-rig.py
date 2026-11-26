"""Raises a rigged, animated character toward the bar of the route `high-quality-character`:

  1. twist bones on the limbs named, with the skin's weights shared out along the limb and the
     bones keyed in every clip from what the limb's own joints do (no constraint is left behind);
  2. the hair, cloth and tail chains named are swung by a spring, clip by clip, and the result is
     written into the clips as keys (a loop is run until it repeats, and closes on itself);
  3. every clip is written dense, at the frame rate given, with a whole number of frames.

    blender -b --factory-startup -noaudio --python games/tools/characters/blender/raise-rig.py -- \
        in.glb out.glb config.json [--report report.json] [--stills dir]

config.json (lengths in metres, times in seconds):

    { "fps": 30,
      "twist": [ { "name": "foreTwistL", "bone": "foreL", "next": "handL", "kind": "follow", "share": 0.5 },
                 { "name": "armTwistL",  "bone": "armL",  "next": "foreL", "kind": "counter", "share": 0.5 } ],
      "chains": [ { "bones": ["hair1", "hair2"], "hz": 1.6, "damping": 0.35, "limit": 40,
                    "wind": 3, "windSeconds": 2.4 } ],
      "loops": ["Idle", "Walk", "Run"],
      "probe": { "bone": "foreL", "next": "handL", "degrees": 120 } }

A twist bone lies on the limb (from `bone`'s joint to `next`'s joint). `follow` sits on the far half
and takes `share` of the turn `next` makes about the limb (a hand turned at the wrist); `counter`
sits on the near half and undoes `share` of the turn `bone` itself makes about the limb (an arm
turned at the shoulder). Where the bone's axes are does not matter: the limb's direction is used.

A chain rests on what the clip already does with it (the clip's pose is the spring's rest shape)
and has no gravity by default: it lags, overshoots and settles round the animated pose. `hz` is how
many times a second it would swing if let go (1 to 2 long hair, 2 to 4 a ribbon or a hem, more is
stiffer), `damping` how fast the swing dies (0.2 keeps swinging, 0.5 settles in a swing or two, 1
never overshoots), `limit` the most degrees a bone leaves the clip's pose. `wind` is a slow push to
and fro in metres a second a second, so that a chain is alive while the body is still; it rests
about `wind` / (2 pi hz)^2 metres off, and in a loop it goes round a whole number of times.

What swings is a point at the far end of each bone: toward the next bone of the chain, or the
bone's own child (a tip bone), or the middle of the skin it carries, or straight on from its parent.
Where the bone's own axes point does not matter. A chain with none of these says where it hangs:
`"toward": [0, -1, 0]` (the file's axes, y up), for a panel of cloth with no skin in this file.

`probe` turns `next` about the limb by `degrees` and measures how thin the skin gets where the two
bones meet, before and after the twist bones: the narrowest ring's radius over its radius at rest.

Blender 5.x. The frame rate is set BEFORE the file is read: the importer places keys by the
scene's rate, and a clip read at 24 and written at 30 comes out shorter and no longer closes.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) < 3:
    raise SystemExit('usage: blender -b --python raise-rig.py -- in.glb out.glb config.json [--report file] [--stills dir]')
source, target, config_path = (os.path.abspath(a) for a in args[:3])
flag = lambda name: os.path.abspath(args[args.index(name) + 1]) if name in args else None
report_path, stills = flag('--report'), flag('--stills')
config = json.load(open(config_path, encoding='utf8'))
FPS = int(config.get('fps', 30))
SUBSTEPS = 4
report = {'fps': FPS, 'twist': [], 'chains': [], 'clips': {}, 'probe': None}

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
scene = bpy.context.scene
scene.render.fps = FPS
scene.render.fps_base = 1
bpy.ops.import_scene.gltf(filepath=source)
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
skins = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
anim = rig.animation_data
actions = [s.action for t in anim.nla_tracks for s in t.strips] if anim else []
if anim and anim.action and anim.action not in actions:
    actions.append(anim.action)
for track in anim.nla_tracks:
    track.mute = True  # one clip at a time, as the active action


def curves(action):
    if hasattr(action, 'fcurves') and not hasattr(action, 'layers'):
        return action.fcurves
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if bag:
                    out.append(bag.fcurves)
    return out[0] if out else []


def play(action):
    anim.action = action
    if hasattr(anim, 'action_slot') and anim.action_slot is None and action.slots:
        anim.action_slot = action.slots[0]


# --- 3 (first, the others build on it): whole frames -------------------------------------------
lengths = {}
for action in actions:
    start, end = action.frame_range
    frames = max(1, round(end - start))
    if abs((end - start) - frames) > 1e-4 or abs(start) > 1e-4:
        scale = frames / (end - start)
        for fc in curves(action):
            for key in fc.keyframe_points:
                key.co.x = (key.co.x - start) * scale
                key.handle_left.x = (key.handle_left.x - start) * scale
                key.handle_right.x = (key.handle_right.x - start) * scale
            fc.update()
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0, frames
    lengths[action.name] = frames
    report['clips'][action.name] = {'frames': frames, 'seconds': round(frames / FPS, 4), 'was': round((end - start) / FPS, 4)}

rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
head = {b.name: b.head_local.copy() for b in rig.data.bones}


def limb(entry):
    """The limb's joint, its direction in the armature and in the bone's own axes, and its length."""
    a, b = head[entry['bone']], head[entry['next']]
    along = b - a
    return a, along.normalized(), (rest[entry['bone']].to_quaternion().inverted() @ along).normalized(), along.length


def twist_about(q, axis):
    """The part of a turn that is about an axis (swing-twist)."""
    v = Vector((q.x, q.y, q.z))
    p = axis * v.dot(axis)
    t = Quaternion((q.w, p.x, p.y, p.z))
    return t.normalized() if t.magnitude > 1e-9 else Quaternion()


def smooth(x, a, b):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def thinnest(entry):
    """Over rings along the limb near `next`'s joint: the smallest mean distance from the limb, posed over at rest."""
    origin, along, _, length = limb(entry)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    pose = rig.pose.bones[entry['bone']].matrix @ rest[entry['bone']].inverted()
    rings = {}
    for obj in skins:
        groups = {g.name: g.index for g in obj.vertex_groups}
        wanted = {groups[n] for n in (entry['bone'], entry['next'], entry.get('name', '')) if n in groups}
        if not wanted:
            continue
        to_rig = rig.matrix_world.inverted() @ obj.matrix_world
        posed = obj.evaluated_get(depsgraph).to_mesh()
        for v in obj.data.vertices:
            if not any(g.group in wanted for g in v.groups):
                continue
            at = to_rig @ v.co
            u = (at - origin).dot(along) / length
            if not 0.7 <= u <= 1.15:
                continue
            flat = at - origin - along * (at - origin).dot(along)
            now = pose.inverted() @ (to_rig @ posed.vertices[v.index].co)
            now_flat = now - origin - along * (now - origin).dot(along)
            ring = rings.setdefault(round(u / 0.03), [0.0, 0.0])
            ring[0] += flat.length
            ring[1] += now_flat.length
        obj.evaluated_get(depsgraph).to_mesh_clear()
    ratios = [posed / before for before, posed in rings.values() if before > 1e-6]
    return round(min(ratios), 3) if ratios else None


def still(name, entry):
    if not stills:
        return
    os.makedirs(stills, exist_ok=True)
    origin, along, _, length = limb(entry)
    middle = rig.matrix_world @ (origin + along * length * 0.8)
    camera = bpy.data.objects.get('probe-camera') or bpy.data.objects.new('probe-camera', bpy.data.cameras.new('probe-camera'))
    if camera.name not in scene.collection.objects:
        scene.collection.objects.link(camera)
    camera.location = middle + Vector((0.25, -0.75, 0.1))
    camera.rotation_euler = (middle - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = 60
    scene.camera = camera
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.82, 0.66, 0.58)
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 720, 720
    scene.render.filepath = os.path.join(stills, name + '.png')
    bpy.ops.render.render(write_still=True)


def turn_probe(entry, degrees):
    _, _, axis_local, _ = limb(entry)
    # The turn is about the limb, given in `next`'s own axes.
    axis_next = (rest[entry['next']].to_quaternion().inverted() @ (rest[entry['bone']].to_quaternion() @ axis_local)).normalized()
    rig.pose.bones[entry['next']].rotation_mode = 'QUATERNION'
    rig.pose.bones[entry['next']].rotation_quaternion = Quaternion(axis_next, math.radians(degrees))
    bpy.context.view_layer.update()


probe = config.get('probe')
if probe:
    anim.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    turn_probe(probe, probe['degrees'])
    report['probe'] = {'bone': probe['bone'], 'next': probe['next'], 'degrees': probe['degrees'], 'thinnestBefore': thinnest(probe)}
    still('probe-before', probe)
    rig.pose.bones[probe['next']].rotation_quaternion = Quaternion()

# --- 1: twist bones ----------------------------------------------------------------------------
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for entry in config.get('twist', []):
    origin, along, _, length = limb(entry)
    bone = rig.data.edit_bones[entry['bone']]
    new = rig.data.edit_bones.new(entry['name'])
    start = origin + along * length * (0.5 if entry['kind'] == 'follow' else 0.0)
    new.head = start
    new.tail = start + (bone.tail - bone.head)  # the same axes as the bone it hangs on
    new.roll = bone.roll
    new.parent = bone
    new.use_deform = True
bpy.ops.object.mode_set(mode='OBJECT')
for entry in config.get('twist', []):
    origin, along, _, length = limb(entry)
    moved = 0
    for obj in skins:
        if entry['bone'] not in obj.vertex_groups:
            continue
        own = obj.vertex_groups[entry['bone']]
        group = obj.vertex_groups.get(entry['name']) or obj.vertex_groups.new(name=entry['name'])
        to_rig = rig.matrix_world.inverted() @ obj.matrix_world
        for v in obj.data.vertices:
            weight = next((g.weight for g in v.groups if g.group == own.index), 0)
            if weight <= 0:
                continue
            u = (to_rig @ v.co - origin).dot(along) / length
            share = smooth(u, 0.3, 0.9) if entry['kind'] == 'follow' else 1 - smooth(u, 0.1, 0.6)
            if share <= 0.001:
                continue
            group.add([v.index], weight * share, 'REPLACE')
            own.add([v.index], weight * (1 - share), 'REPLACE')
            moved += 1
    report['twist'].append({'name': entry['name'], 'bone': entry['bone'], 'kind': entry['kind'], 'share': entry['share'], 'verticesShared': moved})
rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
head = {b.name: b.head_local.copy() for b in rig.data.bones}
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'


def twist_now(entry):
    """The twist bone's turn for the pose the rig is in now."""
    _, _, axis, _ = limb(entry)
    bone, nxt = rig.pose.bones[entry['bone']], rig.pose.bones[entry['next']]
    if entry['kind'] == 'follow':
        posed = bone.matrix.to_quaternion().inverted() @ nxt.matrix.to_quaternion()
        at_rest = rest[entry['bone']].to_quaternion().inverted() @ rest[entry['next']].to_quaternion()
        turn = twist_about(posed @ at_rest.inverted(), axis)
        return Quaternion().slerp(turn, entry['share'])
    turn = twist_about(bone.matrix_basis.to_quaternion(), axis)
    return Quaternion().slerp(turn.inverted(), entry['share'])


if probe:
    turn_probe(probe, probe['degrees'])
    for entry in config.get('twist', []):
        rig.pose.bones[entry['name']].rotation_quaternion = twist_now(entry)
    bpy.context.view_layer.update()
    report['probe']['thinnestAfter'] = thinnest({**probe, 'name': next((e['name'] for e in config.get('twist', []) if e['bone'] == probe['bone'] and e['kind'] == 'follow'), '')})
    still('probe-after', probe)
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)

# --- 2: the chains, clip by clip -----------------------------------------------------------------
chains = config.get('chains', [])
chain_bones = [name for chain in chains for name in chain['bones']]
loops = set(config.get('loops', []))


def simulate(chain, frames, sampled, looping, seconds):
    """Keys for one chain over one clip: for every frame, the turn of each of its bones in its own axes."""
    names = chain['bones']
    omega = 2 * math.pi * chain.get('hz', 1.6)
    spring, damper = omega * omega, 2 * chain.get('damping', 0.35) * omega
    limit = math.radians(chain.get('limit', 45))
    gravity = Vector((0, 0, -9.81 * chain.get('gravity', 0)))
    wind = chain.get('wind', 0)
    # A loop's wind goes round a whole number of times, or the loop could not close.
    period = chain.get('windSeconds', 2.4)
    if looping and wind:
        period = seconds / max(1, round(seconds / period))
    dt = 1 / (FPS * SUBSTEPS)
    local = [rest[rig.data.bones[n].parent.name].inverted() @ rest[n] for n in names]

    def far_end(i, name):
        bone = rig.data.bones[name]
        if 'toward' in chain:
            x, y, z = chain['toward']
            reach = Vector((x, -z, y)).normalized() * bone.length
        elif i + 1 < len(names):
            reach = head[names[i + 1]] - head[name]
        elif bone.children:
            reach = bone.children[0].head_local - bone.head_local
        else:
            carried = [rig.matrix_world.inverted() @ obj.matrix_world @ v.co for obj in skins if name in obj.vertex_groups
                       for v in obj.data.vertices if any(g.group == obj.vertex_groups[name].index and g.weight > 0.5 for g in v.groups)]
            reach = sum(carried, Vector()) / len(carried) - head[name] if carried else (head[name] - head[bone.parent.name]).normalized() * bone.length
        if reach.length < 1e-4:
            reach = rest[name].to_quaternion() @ Vector((0, bone.length, 0))
        return rest[name].to_quaternion().inverted() @ reach  # in the bone's own axes

    ends = [far_end(i, n) for i, n in enumerate(names)]
    lengths_ = [e.length for e in ends]
    state = None  # per bone: tip, its speed
    before = None  # per bone: (joint, wanted tip) at the frame before

    def step(frame, clock, keep):
        nonlocal state, before
        parent = sampled[frame]['parent'][names[0]]
        now, out = [], []
        for i, name in enumerate(names):
            wanted = parent @ local[i] @ sampled[frame]['basis'][name]
            joint = wanted.translation.copy()
            tip = wanted @ ends[i]
            if state is None or len(state) <= i:
                state = (state or []) + [[tip.copy(), Vector()]]
                before = (before or []) + [(joint.copy(), tip.copy())]
            for s in range(1, SUBSTEPS + 1):
                k = s / SUBSTEPS
                j = before[i][0].lerp(joint, k)
                w = before[i][1].lerp(tip, k)
                p, speed = state[i]
                t = clock + (s - SUBSTEPS) * dt
                push = Vector((math.sin(2 * math.pi * t / period + i * 0.7), 0.35 * math.sin(4 * math.pi * t / period + 1.3), 0)) * wind if wind else Vector()
                speed = speed + ((w - p) * spring - speed * damper + gravity + push) * dt
                new = p + speed * dt
                arm = new - j
                arm = arm.normalized() * lengths_[i] if arm.length > 1e-9 else (w - j)
                want = (w - j).normalized()
                angle = want.angle(arm.normalized(), 0)
                if angle > limit:
                    arm = (want.rotation_difference(arm.normalized()).slerp(Quaternion(), 1 - limit / angle) @ want) * lengths_[i]
                state[i] = [j + arm, (j + arm - p) / dt]
            now.append((joint.copy(), tip.copy()))
            turned = (state[i][0] - joint).normalized()
            rotation = (tip - joint).normalized().rotation_difference(turned) @ wanted.to_quaternion()
            solved = Matrix.LocRotScale(joint, rotation, None)
            if keep:
                out.append(((parent @ local[i]).inverted() @ solved).to_quaternion())
            parent = solved
        before = now
        return out

    if not looping:
        for _ in range(FPS):  # held on the first frame until it hangs still
            step(0, 0, False)
        return [step(f, f / FPS, True) for f in range(frames + 1)], 0.0
    # Round after round, frame 0 following the last frame, until a round begins as the one before did.
    passes, keys, gap = 0, None, 180.0
    while passes < 40:
        earlier = keys
        keys = [step(f, f / FPS, True) for f in range(frames)]
        passes += 1
        if earlier:
            gap = max(math.degrees(a.rotation_difference(b).angle) for a, b in zip(keys[0], earlier[0]))
            if passes >= 3 and gap < 0.05:
                break
    return keys + [keys[0]], gap


for action in actions:
    frames = lengths[action.name]
    play(action)
    sampled = []
    twists = []
    for f in range(frames + 1):
        scene.frame_set(f)
        sampled.append({
            'parent': {chain['bones'][0]: rig.pose.bones[chain['bones'][0]].parent.matrix.copy() for chain in chains},
            'basis': {n: rig.pose.bones[n].matrix_basis.copy() for n in chain_bones},
        })
        twists.append([twist_now(entry) for entry in config.get('twist', [])])
    looping = action.name in loops
    clip = report['clips'][action.name]
    clip['loop'] = looping
    solved = {}
    for chain in chains:
        keys, gap = simulate(chain, frames, sampled, looping, frames / FPS)
        clip.setdefault('roundsApart', {})['+'.join(chain['bones'])] = round(gap, 4)
        for i, name in enumerate(chain['bones']):
            solved[name] = [frame[i] for frame in keys]
    for i, entry in enumerate(config.get('twist', [])):
        solved[entry['name']] = [frame[i] for frame in twists]
    # What the clip had on these bones goes; every frame gets a key.
    fcurves = curves(action)
    for fc in [fc for fc in fcurves if any(fc.data_path == f'pose.bones["{n}"].rotation_quaternion' for n in chain_bones)]:
        fcurves.remove(fc)
    for name, turns in solved.items():
        bone = rig.pose.bones[name]
        last = None
        for f, q in enumerate(turns):
            if last is not None and last.dot(q) < 0:
                q = -q  # the shorter way round, whatever plays it
            bone.rotation_quaternion = q
            bone.keyframe_insert('rotation_quaternion', frame=f, group=name)
            last = q.copy()
    for fc in curves(action):
        for key in fc.keyframe_points:
            key.interpolation = 'LINEAR'
report['chains'] = [{'bones': c['bones'], 'hz': c.get('hz', 1.6), 'damping': c.get('damping', 0.35), 'limit': c.get('limit', 45), 'gravity': c.get('gravity', 0), 'wind': c.get('wind', 0)} for c in chains]

# --- out ---------------------------------------------------------------------------------------
anim.action = None
for track in anim.nla_tracks:
    track.mute = False
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
camera = bpy.data.objects.get('probe-camera')
if camera:
    bpy.data.objects.remove(camera)
bpy.ops.export_scene.gltf(
    filepath=target, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=False,
    export_optimize_animation_keep_anim_armature=True, export_anim_slide_to_zero=True, export_yup=True)
if report_path:
    json.dump(report, open(report_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('RAISED', json.dumps(report, ensure_ascii=False))
