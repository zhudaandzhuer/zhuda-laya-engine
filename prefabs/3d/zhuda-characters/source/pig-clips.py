"""Zhuda for the sky island: no lantern, ear and tail tips for spring bones, and
the clips this toy needs (being picked up, dangling, falling, landing, ...).

The pig, its skeleton and its weights come from the film
(films/ancient-city/blender/pig/rig.py, saved as zhuda-rigged.blend). This
opens that file without saving it, takes the lantern and its pole off, adds
`ear.L.tip`, `ear.R.tip` and `tail.tip` (bones that deform nothing: they mark
where a spring chain ends), replaces every clip and writes the model:

    blender -b ../../films/ancient-city/blender/pig/zhuda-rigged.blend -P tools/pig-clips.py -- public/assets/characters/zhuda.glb
    ... -- <out.glb> --pose struggle:0.25 --pose fall:0.5     (also posed stills, to look at)

The ears and the tail are left at rest in every clip: the game swings them with
the engine's spring bones, so they lag behind whatever the body does.

Axes as rig.py: every bone points up (+Z), the pig faces -Y; a positive pitch
tips a bone's top forward and swings what hangs below it (a leg, an arm) back.
"""
import math
import os
import sys
import bmesh
import bpy
from mathutils import Euler, Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not args or not args[0].endswith('.glb'):
    raise SystemExit('usage: blender -b zhuda-rigged.blend -P tools/pig-clips.py -- <out.glb> [--pose clip:BEAT ...]')
out = os.path.abspath(args[0])
stills = [(a.split(':')[0], float(a.split(':')[1])) for i, a in enumerate(args[1:]) if args[i] == '--pose']

FPS = 63
BEAT = 30  # frames, as the film's clips
rig = bpy.data.objects['zhuda-rig']
pig = bpy.data.objects['zhuda']
scene = bpy.context.scene
rad = math.radians

# -- the lantern and its pole off ------------------------------------------------
prop = {i for i, m in enumerate(pig.data.materials) if m and m.name.split('.')[0] in ('pole', 'lantern-paper', 'lantern-cap')}
bm = bmesh.new()
bm.from_mesh(pig.data)
gone = [f for f in bm.faces if f.material_index in prop]
bmesh.ops.delete(bm, geom=gone, context='FACES')
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
bm.to_mesh(pig.data)
bm.free()
for index in sorted(prop, reverse=True):
    pig.data.materials.pop(index=index)
print('LANTERN OFF', len(gone), 'faces; materials', [m.name for m in pig.data.materials])

# -- tips for the spring chains ---------------------------------------------------
TIPS = {
    'ear.L.tip': ((0.335, -0.03, 0.80), 'ear.L'),
    'ear.R.tip': ((-0.335, -0.03, 0.80), 'ear.R'),
    'tail.tip': ((0.0, 0.36, 0.17), 'tail'),
}
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for name, (head, parent) in TIPS.items():
    bone = rig.data.edit_bones.new(name)
    bone.head = Vector(head)
    bone.tail = Vector(head) + Vector((0, 0, 0.04))
    bone.parent = rig.data.edit_bones[parent]
    bone.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')


def pose(values):
    for bone in rig.pose.bones:
        bone.rotation_mode = 'XYZ'
        px, ty, rz = values.get(bone.name, (0, 0, 0))
        bone.rotation_euler = Euler((rad(px), rad(ty), rad(rz)))
        bone.location = Vector(values.get('loc', {}).get(bone.name, (0, 0, 0)))


ease = lambda u: 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, u)))


def blend(a, b, u):
    out = {}
    for key in set(a) | set(b):
        if key == 'loc':
            names = set(a.get('loc', {})) | set(b.get('loc', {}))
            out['loc'] = {n: tuple(p + (q - p) * u for p, q in zip(a.get('loc', {}).get(n, (0, 0, 0)), b.get('loc', {}).get(n, (0, 0, 0)))) for n in names}
        else:
            out[key] = tuple(p + (q - p) * u for p, q in zip(a.get(key, (0, 0, 0)), b.get(key, (0, 0, 0))))
    return out


def idle(t):
    """8 beats, loops. Breathes, looks about, shifts its weight."""
    a = 2 * math.pi * t / 8
    return {
        'hips': (0, 0, 1.5 * math.sin(a)),
        'spine': (1.5 * math.sin(2 * a), 0, -1.2 * math.sin(a)),
        'head': (2 * math.sin(2 * a - 0.6), 14 * math.sin(a) * abs(math.sin(a)), -2 * math.sin(a)),
        'arm.L': (3 * math.sin(2 * a), 0, 2), 'arm.R': (3 * math.sin(2 * a + 0.4), 0, -2),
        'loc': {'hips': (0, 0.005 * math.sin(2 * a), 0)},
    }


def walk(t):
    """1 beat, loops: the film's walk, both arms swinging now there is no lantern."""
    step = 2 * math.pi * t
    swing = math.sin(step)
    bob = abs(math.sin(step))
    return {
        'leg.L': (30 * swing, 0, 0), 'leg.R': (-30 * swing, 0, 0),
        'hips': (2, 5 * swing, 4.5 * swing),
        'spine': (3 + 1.5 * bob, -3 * swing, -2.5 * swing),
        'head': (-2 + 2.5 * bob, -2 * swing, -3.5 * math.sin(step - 0.5)),
        'arm.L': (-24 * swing, 0, 0), 'arm.R': (24 * swing, 0, 0),
        'loc': {'hips': (0, 0.012 * bob, 0)},
    }


def struggle(t):
    """1 beat, loops. Held up by the scruff: the legs run in the air, the arms flail, the head shakes."""
    s = 2 * math.pi * t
    return {
        'hips': (6 * math.sin(2 * s), 7 * math.sin(s), 5 * math.sin(s + 0.8)),
        'spine': (-4 + 4 * math.sin(2 * s + 0.6), -9 * math.sin(s), -4 * math.sin(s + 1.1)),
        'head': (14 + 6 * math.sin(2 * s + 1.2), 16 * math.sin(s + 0.4), 5 * math.sin(2 * s)),
        'leg.L': (-10 + 48 * math.sin(2 * s), 0, 8), 'leg.R': (-10 - 48 * math.sin(2 * s), 0, -8),
        'arm.L': (-70 - 55 * math.sin(2 * s + 0.5), 0, 35 + 12 * math.cos(2 * s)),
        'arm.R': (-70 + 55 * math.sin(2 * s + 0.5), 0, -35 - 12 * math.cos(2 * s)),
    }


def dangle(t):
    """4 beats, loops. Given up for now: hangs limp, sways, the feet swing a little."""
    a = 2 * math.pi * t / 4
    return {
        'hips': (-4, 0, 3 * math.sin(a)),
        'spine': (6, 0, -2 * math.sin(a)),
        'head': (18 + 3 * math.sin(2 * a), 6 * math.sin(a - 0.5), 0),
        'leg.L': (-8 + 10 * math.sin(a), 0, 4), 'leg.R': (-8 + 10 * math.sin(a + 0.9), 0, -4),
        'arm.L': (-12 + 6 * math.sin(a + 0.3), 0, 10), 'arm.R': (-12 + 6 * math.sin(a + 1.2), 0, -10),
    }


def fall(t):
    """1 beat, loops. Arms up and wide, legs spread and paddling, looking down at the ground."""
    s = 2 * math.pi * t
    return {
        'hips': (-6, 4 * math.sin(s), 0),
        'spine': (-6, -4 * math.sin(s), 0),
        'head': (16, 5 * math.sin(s), 0),
        'arm.L': (-35 + 14 * math.sin(2 * s), 0, 58 + 10 * math.sin(2 * s)),
        'arm.R': (-35 + 14 * math.sin(2 * s + 1.4), 0, -58 - 10 * math.sin(2 * s + 1.4)),
        'leg.L': (-24 + 26 * math.sin(2 * s), 0, 20), 'leg.R': (-24 - 26 * math.sin(2 * s), 0, -20),
    }


CROUCH = {'hips': (-14, 0, 0), 'spine': (18, 0, 0), 'head': (-10, 0, 0), 'leg.L': (-40, 0, 10), 'leg.R': (-40, 0, -10),
          'arm.L': (-50, 0, 45), 'arm.R': (-50, 0, -45), 'loc': {'hips': (0, -0.07, 0), 'leg.L': (0, 0, 0.06), 'leg.R': (0, 0, 0.06)}}


def land(t):
    """2 beats. Lands in a crouch with the arms out for balance, wobbles and stands up."""
    if t < 0.25:
        return blend(fall(0), CROUCH, ease(t / 0.25))
    wobble = math.sin(2 * math.pi * (t - 0.25) * 1.5) * math.exp(-2 * (t - 0.25))
    out = blend(CROUCH, idle(0), ease((t - 0.25) / 1.6))
    out['spine'] = tuple(v + d for v, d in zip(out['spine'], (0, 0, 6 * wobble)))
    out['head'] = tuple(v + d for v, d in zip(out['head'], (0, 0, -8 * wobble)))
    return out


def cheer(t):
    """1 beat, loops. A hop with both arms up."""
    s = 2 * math.pi * t
    up = max(0, math.sin(s)) ** 0.8
    return {
        'hips': (-4 * up, 0, 0),
        'spine': (-6 * up, 0, 0),
        'head': (-14 * up, 0, 4 * math.sin(s)),
        'arm.L': (-40 * up, 0, 25 + 35 * up), 'arm.R': (-40 * up, 0, -25 - 35 * up),
        'leg.L': (-14 * up, 0, 6 * up), 'leg.R': (-14 * up, 0, -6 * up),
        'loc': {'hips': (0, 0.16 * up, 0)},
    }


def shake(t):
    """3 beats. Shakes the water off from head to tail, faster then dying away."""
    a = min(1, t / 0.4) * math.exp(-max(0, t - 1.6) * 2.2)
    s = 2 * math.pi * t * 3.2
    return blend(idle(0), {
        'hips': (2, 14 * a * math.sin(s - 1.0), 0),
        'spine': (6, -26 * a * math.sin(s - 0.5), 0),
        'head': (4, 34 * a * math.sin(s), 3 * a * math.sin(2 * s)),
        'arm.L': (0, 0, 22 * a * abs(math.sin(s))), 'arm.R': (0, 0, -22 * a * abs(math.sin(s))),
        'leg.L': (0, 0, 4), 'leg.R': (0, 0, -4),
    }, 1)


def dizzy(t):
    """4 beats, loops. Sees stars after a long fall: the head and body circle, out of step."""
    a = 2 * math.pi * t / 2
    return {
        'hips': (5 * math.sin(a), 0, 5 * math.cos(a)),
        'spine': (6 * math.sin(a + 0.7), 0, 7 * math.cos(a + 0.7)),
        'head': (10 * math.sin(a + 1.4) + 6, 8 * math.sin(a / 2), 12 * math.cos(a + 1.4)),
        'arm.L': (-8, 0, 18 + 10 * math.sin(a)), 'arm.R': (-8, 0, -18 - 10 * math.sin(a + 0.5)),
        'leg.L': (0, 0, 5), 'leg.R': (0, 0, -5),
        'loc': {'hips': (0, -0.02 + 0.01 * math.sin(2 * a), 0)},
    }


CLIPS = {
    'Idle': (idle, 8),
    'Walk': (walk, 1),
    'Struggle': (struggle, 1),
    'Dangle': (dangle, 4),
    'Fall': (fall, 1),
    'Land': (land, 2),
    'Cheer': (cheer, 1),
    'Shake': (shake, 3),
    'Dizzy': (dizzy, 4),
}
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
for name, (fn, beats) in CLIPS.items():
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    frames = beats * BEAT
    for frame in range(0, frames + 1, 2 if frames > 60 else 1):
        pose(fn(frame / BEAT))
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_euler', frame=frame)
            bone.keyframe_insert('location', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    rig.animation_data.action = None
print('CLIPS', {name: round(beats * BEAT / FPS, 3) for name, (fn, beats) in CLIPS.items()})

for clip, beat in stills:
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    pose(CLIPS[clip.capitalize()][0](beat))
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    posed = bpy.data.objects.new('posed', bpy.data.meshes.new_from_object(pig.evaluated_get(deps)))
    scene.collection.objects.link(posed)
    bpy.ops.object.select_all(action='DESELECT')
    posed.select_set(True)
    bpy.context.view_layer.objects.active = posed
    bpy.ops.export_scene.gltf(filepath=out[:-4] + f'-pose-{clip.lower()}-{beat}.glb', export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=85)
    bpy.data.objects.remove(posed)
for track in rig.animation_data.nla_tracks:
    track.mute = False
pose({})

bpy.ops.object.select_all(action='DESELECT')
pig.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_tangents=True,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=3,
                          export_image_format='JPEG', export_jpeg_quality=90, export_skins=True, export_def_bones=False)
print('EXPORTED', out)
