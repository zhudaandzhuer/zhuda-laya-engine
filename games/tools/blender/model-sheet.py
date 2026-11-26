# A model's front, side and back in its own colours, and its sizes: a reference sheet from the file.
#   blender -b -P games/tools/blender/model-sheet.py -- <model.glb> <out dir>
# Writes front.jpg, side.jpg, back.jpg and sheet.json (bounding box in metres, bones, clips,
# triangles, the materials' base colours). The pictures are of the rest pose.
import bpy, json, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
path, out_dir = os.path.abspath(argv[0]), os.path.abspath(argv[1])
os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
scene = bpy.context.scene
meshes = [o for o in bpy.data.objects if o.type == "MESH" and (o.parent is not None or any(m.type == "ARMATURE" for m in o.modifiers))]
dg = bpy.context.evaluated_depsgraph_get()
points = []
triangles = 0
for o in meshes:
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    points += [ev.matrix_world @ v.co for v in me.vertices]
    triangles += sum(len(p.vertices) - 2 for p in me.polygons)
    ev.to_mesh_clear()
lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
size = hi - lo
centre = (lo + hi) / 2


def colour(material):
    if not material or not material.use_nodes:
        return None
    for node in material.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            socket = node.inputs["Base Color"]
            return {"factor": [round(c, 3) for c in socket.default_value[:3]], "textured": socket.is_linked,
                    "roughness": round(node.inputs["Roughness"].default_value, 3), "metallic": round(node.inputs["Metallic"].default_value, 3)}
    return None


report = {
    "file": os.path.basename(path), "blender": bpy.app.version_string,
    "boxMetres": {"min": [round(x, 4) for x in lo], "max": [round(x, 4) for x in hi], "widthX": round(size.x, 4), "depthY": round(size.y, 4), "heightZ": round(size.z, 4)},
    "triangles": triangles,
    "meshes": [o.name for o in meshes],
    "bones": sum(len(o.data.bones) for o in bpy.data.objects if o.type == "ARMATURE"),
    "clips": sorted(a.name for a in bpy.data.actions),
    "materials": {m.name: colour(m) for m in bpy.data.materials if m.users},
}
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x, scene.render.resolution_y = 1000, 1200
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 90
sh = scene.display.shading
sh.light, sh.color_type, sh.show_cavity, sh.show_backface_culling = "STUDIO", "TEXTURE", True, False
scene.display.render_aa = "16"
scene.world = scene.world or bpy.data.worlds.new("w")
scene.world.color = (0.82, 0.84, 0.86)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(size.z, size.x * 1.2, size.y * 1.2) * 1.12
far = max(size) * 4 + 2
# glTF's +Z (the front) is Blender's -Y
for view, offset, turn in (("front", Vector((0, -far, 0)), 0), ("side", Vector((far, 0, 0)), math.pi / 2), ("back", Vector((0, far, 0)), math.pi)):
    cam.location = centre + offset
    cam.rotation_euler = (math.pi / 2, 0, turn)
    scene.render.filepath = os.path.join(out_dir, view + ".jpg")
    bpy.ops.render.render(write_still=True)
with open(os.path.join(out_dir, "sheet.json"), "w") as f:
    json.dump(report, f, indent=2)
print("SHEET", json.dumps(report["boxMetres"]), report["triangles"], report["bones"], len(report["clips"]))
