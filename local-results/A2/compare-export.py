# What changed between a kit-written part and the same part after a trip through Blender.
# python3 local-results/A2/compare-export.py <original.glb> <blender-export.glb>
import json, struct, sys

def load(path):
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[12:16])[0]
    return json.loads(data[20:20 + n]), len(data)

def summary(path):
    doc, size = load(path)
    acc = doc["accessors"]
    prims = [p for m in doc["meshes"] for p in m["primitives"]]
    skin = doc["skins"][0] if doc.get("skins") else None
    nodes = doc["nodes"]
    mesh_nodes = [i for i, n in enumerate(nodes) if "mesh" in n]
    parents = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    pos = acc[prims[0]["attributes"]["POSITION"]]
    return {
        "bytes": size, "generator": doc["asset"].get("generator"),
        "nodes": len(nodes), "sceneRoots": [nodes[i].get("name") for i in doc["scenes"][doc.get("scene", 0)]["nodes"]],
        "meshNode": [(nodes[i].get("name"), "parent=" + str(nodes[parents[i]].get("name")) if i in parents else "root") for i in mesh_nodes],
        "primitives": len(prims),
        "vertices": sum(acc[p["attributes"]["POSITION"]]["count"] for p in prims),
        "triangles": sum(acc[p["indices"]]["count"] // 3 for p in prims),
        "attributes": sorted(prims[0]["attributes"].keys()),
        "positionMin": [round(x, 4) for x in pos["min"]], "positionMax": [round(x, 4) for x in pos["max"]],
        "joints": len(skin["joints"]) if skin else 0,
        "jointNames": [nodes[j].get("name") for j in skin["joints"]] if skin else [],
        "skeletonRoot": nodes[skin["skeleton"]].get("name") if skin and "skeleton" in skin else None,
        "materials": [{k: m.get(k) for k in ("name", "doubleSided", "alphaMode")} | {"pbr": m.get("pbrMetallicRoughness")} for m in doc.get("materials", [])],
        "animations": len(doc.get("animations", [])),
    }

a, b = summary(sys.argv[1]), summary(sys.argv[2])
for key in a:
    if key == "jointNames":
        same_set, same_order = set(a[key]) == set(b[key]), a[key] == b[key]
        print(f"jointNames: same set {same_set}, same order {same_order}")
        if not same_set:
            print("   only in original:", sorted(set(a[key]) - set(b[key])), "only in export:", sorted(set(b[key]) - set(a[key])))
        continue
    mark = "  " if a[key] == b[key] else "!="
    print(f"{mark} {key}:\n      original {a[key]}\n      blender  {b[key]}")
