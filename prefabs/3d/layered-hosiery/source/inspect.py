# Creates an MPFB human headless and prints what it is made of (for planning the cut).
import bpy, sys
from bl_ext.user_default.mpfb.services.humanservice import HumanService
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
macro = {"gender": 0.0, "age": 0.5, "muscle": 0.45, "weight": 0.35, "proportions": 0.8, "height": 0.55,
         "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.6, "caucasian": 0.3, "african": 0.1}}
human = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
print("OBJ", human.name, len(human.data.vertices), "verts", len(human.data.polygons), "faces")
print("GROUPS", [g.name for g in human.vertex_groups])
zs = [v.co.z for v in human.data.vertices]
print("Z range", min(zs), max(zs))
print("SHAPEKEYS", [k.name for k in (human.data.shape_keys.key_blocks if human.data.shape_keys else [])][:30])
print("MODIFIERS", [m.type + ":" + m.name for m in human.modifiers])
