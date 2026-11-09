"""Generate the neutral Pig showcase GLB used by the slot-symbol example.

This is deliberately an engine fixture rather than game production content. It
is built from simple beveled primitives so the shared model inspector can show
named parts, PBR materials and one real animation without an external asset.
"""

import math
import os
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "assets", "models", "zhuda-showcase-character.glb")


def make_material(name, color, roughness=0.55, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return material


def finish(obj, material, bevel=0.0):
    if material:
        obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    obj.parent = CHARACTER
    return obj


def sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material)


def cube(name, location, dimensions, material, bevel=0.05):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material, bevel)


def cylinder(name, location, radius, depth, material, rotation=(0.0, 0.0, 0.0), bevel=0.03):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material, bevel)


def cone(name, location, radius, depth, material):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=radius, radius2=radius * 0.28, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material, 0.025)


def torus(name, location, major, minor, material, rotation=(math.pi / 2, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material)


for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

CHARACTER = bpy.data.objects.new("PigCharacter", None)
bpy.context.scene.collection.objects.link(CHARACTER)

skin = make_material("Pig Skin", (0.92, 0.25, 0.34), 0.5)
inner_skin = make_material("Inner Ear", (0.55, 0.055, 0.12), 0.58)
shirt = make_material("Cream Shirt", (0.92, 0.84, 0.68), 0.86)
denim = make_material("Blue Denim", (0.035, 0.12, 0.36), 0.72)
cap = make_material("Red Cap", (0.62, 0.025, 0.045), 0.48)
snout = make_material("Snout", (1.0, 0.43, 0.5), 0.4)
nostril = make_material("Nostril", (0.12, 0.008, 0.018), 0.3)
eye_white = make_material("Eye White", (0.98, 0.96, 0.82), 0.23)
pupil = make_material("Pupil", (0.008, 0.004, 0.006), 0.2)
shoe = make_material("Shoes", (0.055, 0.018, 0.015), 0.32)
gold = make_material("Gold Badge", (1.0, 0.45, 0.035), 0.25, 0.4)
backpack = make_material("Teal Backpack", (0.025, 0.24, 0.25), 0.46)
blush = make_material("Cheeks", (1.0, 0.18, 0.3), 0.48)

# Head and facial features.
sphere("Head", (0.0, 0.0, 2.02), (0.78, 0.68, 0.72), skin)
sphere("Ear.L", (-0.63, 0.0, 2.42), (0.29, 0.22, 0.42), skin)
sphere("Ear.R", (0.63, 0.0, 2.42), (0.29, 0.22, 0.42), skin)
sphere("EarInner.L", (-0.63, -0.2, 2.42), (0.15, 0.06, 0.25), inner_skin)
sphere("EarInner.R", (0.63, -0.2, 2.42), (0.15, 0.06, 0.25), inner_skin)
sphere("Eye.L", (-0.25, -0.58, 2.08), (0.17, 0.11, 0.2), eye_white)
sphere("Eye.R", (0.25, -0.58, 2.08), (0.17, 0.11, 0.2), eye_white)
sphere("Pupil.L", (-0.25, -0.69, 2.08), (0.075, 0.04, 0.105), pupil)
sphere("Pupil.R", (0.25, -0.69, 2.08), (0.075, 0.04, 0.105), pupil)
sphere("Snout", (0.0, -0.64, 1.82), (0.3, 0.16, 0.2), snout)
sphere("Nostril.L", (-0.105, -0.78, 1.84), (0.06, 0.025, 0.045), nostril)
sphere("Nostril.R", (0.105, -0.78, 1.84), (0.06, 0.025, 0.045), nostril)
sphere("Mouth", (0.0, -0.7, 1.57), (0.19, 0.035, 0.075), nostril)
sphere("Cheek.L", (-0.45, -0.58, 1.77), (0.13, 0.035, 0.09), blush)
sphere("Cheek.R", (0.45, -0.58, 1.77), (0.13, 0.035, 0.09), blush)

# Clothing and accessories.
sphere("ShirtBody", (0.0, 0.02, 1.05), (0.72, 0.52, 0.83), shirt)
cube("OverallBib", (0.0, -0.48, 1.05), (0.9, 0.18, 0.68), denim, 0.09)
cube("Strap.L", (-0.34, -0.47, 1.37), (0.13, 0.18, 0.7), denim, 0.04)
cube("Strap.R", (0.34, -0.47, 1.37), (0.13, 0.18, 0.7), denim, 0.04)
cylinder("Button.L", (-0.34, -0.6, 1.17), 0.08, 0.06, gold, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.01)
cylinder("Button.R", (0.34, -0.6, 1.17), 0.08, 0.06, gold, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.01)
cone("Badge", (0.0, -0.61, 1.02), 0.15, 0.25, gold)
cone("Cap", (0.0, 0.0, 2.77), 0.46, 0.42, cap)
cube("CapBrim", (0.0, -0.22, 2.62), (0.78, 0.48, 0.12), cap, 0.06)

# Limbs and a curled tail.
cylinder("Arm.L", (-0.74, 0.0, 1.12), 0.16, 0.62, shirt, rotation=(0.0, -0.28, 0.0), bevel=0.04)
cylinder("Arm.R", (0.74, 0.0, 1.12), 0.16, 0.62, shirt, rotation=(0.0, 0.28, 0.0), bevel=0.04)
sphere("Hand.L", (-0.86, -0.02, 0.83), (0.2, 0.17, 0.18), skin)
sphere("Hand.R", (0.86, -0.02, 0.83), (0.2, 0.17, 0.18), skin)
cylinder("Leg.L", (-0.29, 0.0, 0.38), 0.2, 0.52, denim, bevel=0.04)
cylinder("Leg.R", (0.29, 0.0, 0.38), 0.2, 0.52, denim, bevel=0.04)
cube("Shoe.L", (-0.29, -0.18, 0.08), (0.42, 0.7, 0.25), shoe, 0.08)
cube("Shoe.R", (0.29, -0.18, 0.08), (0.42, 0.7, 0.25), shoe, 0.08)
tail = torus("Tail", (0.72, 0.25, 1.16), 0.22, 0.075, skin)
tail.rotation_euler[2] = math.radians(-18)
cube("Backpack", (0.0, 0.46, 1.08), (0.58, 0.26, 0.72), backpack, 0.1)

# A small idle clip is enough to prove animation import without adding game code.
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 40
bpy.context.scene.render.fps = 30
CHARACTER.location = (0.0, 0.0, 0.0)
CHARACTER.keyframe_insert(data_path="location", frame=1)
CHARACTER.location.z = 0.06
CHARACTER.keyframe_insert(data_path="location", frame=20)
CHARACTER.location.z = 0.0
CHARACTER.keyframe_insert(data_path="location", frame=40)
if CHARACTER.animation_data and CHARACTER.animation_data.action:
    CHARACTER.animation_data.action.name = "IdleBounce"
    # Blender 4.x exposes fcurves directly; Blender 5.x stores them in the
    # layered action API. The exported keyframes are valid in either case.
    action = CHARACTER.animation_data.action
    if hasattr(action, "fcurves"):
        for curve in action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "BEZIER"

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
CHARACTER.select_set(True)
bpy.context.view_layer.objects.active = CHARACTER
bpy.ops.export_scene.gltf(
    filepath=OUTPUT,
    export_format="GLB",
    # The children are parented to the selected root; export the complete
    # fixture tree rather than the empty root object alone.
    use_selection=False,
    export_apply=True,
    export_animations=True,
    export_materials="EXPORT",
)
print(f"Generated {OUTPUT}")
