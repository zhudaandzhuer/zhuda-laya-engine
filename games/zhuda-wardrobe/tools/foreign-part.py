# A garment from another source, to check that the wardrobe wears what its own kit did not make.
# This script shares no code with the kit. It works as an artist in a modelling program would:
# copy the body's surface where the garment goes, push it out, carry the body's weights over, give
# it a texture; and it writes the file the way such programs commonly do, which differs from the
# kit's files in every way that matters to binding:
#   - an "Armature" node above the joints, turned 90 degrees and scaled 0.01 (the mesh is in centimetres, z up);
#   - joints turned in the rest pose so that their y axis points along the bone;
#   - only the joints the garment needs, in another order (by name);
#   - a texture with UVs instead of vertex colours; the mesh node under the armature.
#   python3 -I tools/foreign-part.py        (writes assets/parts/knit.glb; then npm run parts)
import io, json, math, os, struct
import numpy as np
from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
parts = os.path.join(here, '..', 'assets', 'parts')
raw = open(os.path.join(parts, 'body.glb'), 'rb').read()
n = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + n])
blob = raw[20 + n + 8:]
TYPES = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def accessor(i):
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
    code, size = TYPES[a['componentType']]; w = WIDTH[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(blob, dtype=np.dtype('<' + code), count=a['count'] * w, offset=start).reshape(a['count'], w).copy()

# ---- the body's skeleton: names, parents, rest positions (the kit's joints are not turned) ----
skin = doc['skins'][0]
names = [doc['nodes'][i]['name'] for i in skin['joints']]
node_of = {doc['nodes'][i]['name']: i for i in skin['joints']}
parent = {}
for i in skin['joints']:
    for c in doc['nodes'][i].get('children', []):
        parent[doc['nodes'][c]['name']] = doc['nodes'][i]['name']
def rest(name):
    p = np.array(doc['nodes'][node_of[name]].get('translation', [0, 0, 0]), dtype=float)
    return p + rest(parent[name]) if name in parent else p
REST = {name: rest(name) for name in names}

# ---- the surface the garment is taken from: torso, shoulders and upper arms, welded ----
P, N, J, W, I = [], [], [], [], []
base = 0
for node in doc['nodes']:
    if node.get('name') not in ('region-torso', 'region-shoulders', 'region-upperArms'): continue
    prim = doc['meshes'][node['mesh']]['primitives'][0]; at = prim['attributes']
    p = accessor(at['POSITION']); P.append(p); N.append(accessor(at['NORMAL'])); J.append(accessor(at['JOINTS_0'])); W.append(accessor(at['WEIGHTS_0']))
    I.append(accessor(prim['indices']).reshape(-1) + base); base += len(p)
P, N, J, W, I = np.vstack(P), np.vstack(N), np.vstack(J), np.vstack(W), np.concatenate(I)
key = {}; remap = np.zeros(len(P), dtype=int); keep = []
for v, p in enumerate(P):
    k = tuple(np.round(p * 20000).astype(int))
    if k not in key: key[k] = len(keep); keep.append(v)
    remap[v] = key[k]
normal = np.zeros((len(keep), 3))
for v in range(len(P)): normal[remap[v]] += N[v]
normal /= np.maximum(1e-9, np.linalg.norm(normal, axis=1, keepdims=True))
P, J, W, I = P[keep], J[keep], W[keep], remap[I]
I = I.reshape(-1, 3); I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 0] != I[:, 2])]
I = I[(P[I][:, :, 1] < 1.34).all(axis=1)]    # a boat neck: cut below the base of the neck, as a pattern would be
P = P + normal * 0.016                      # pushed out: thicker than the kit's tee, thinner than its robe
N = normal

# ---- UVs round the body, and a knitted texture ----
u = np.arctan2(P[:, 0], P[:, 2]) / (2 * math.pi) + 0.5
v = (P[:, 1] - P[:, 1].min()) / (P[:, 1].max() - P[:, 1].min())
UV = np.stack([u * 3, 1 - v], axis=1)       # three repeats round the body
extra_P, extra_N, extra_J, extra_W, extra_UV = [], [], [], [], []
for t in range(len(I)):                      # a triangle across the seam gets its own vertices one turn on
    tri = I[t]; us = u[tri]
    if us.max() - us.min() > 0.5:
        for c in range(3):
            if us[c] < 0.5:
                extra_P.append(P[tri[c]]); extra_N.append(N[tri[c]]); extra_J.append(J[tri[c]]); extra_W.append(W[tri[c]]); extra_UV.append(UV[tri[c]] + [3, 0])
                I[t, c] = len(P) + len(extra_P) - 1
if extra_P:
    P, N, J, W, UV = np.vstack([P, extra_P]), np.vstack([N, extra_N]), np.vstack([J, extra_J]), np.vstack([W, extra_W]), np.vstack([UV, extra_UV])
img = Image.new('RGB', (256, 256), (198, 92, 62)); d = ImageDraw.Draw(img)
for y in range(0, 256, 32):
    d.rectangle([0, y, 255, y + 9], fill=(238, 226, 200)); d.rectangle([0, y + 14, 255, y + 17], fill=(64, 78, 110))
for x in range(0, 256, 8):
    d.line([x, 0, x, 255], fill=(150, 64, 44), width=1)
png = io.BytesIO(); img.save(png, format='PNG', optimize=True); png = png.getvalue()

# ---- the skeleton as a modelling program would write it ----
used = set()
for row_j, row_w in zip(J, W):
    for j, w in zip(row_j, row_w):
        if w > 0:
            name = names[int(j)]
            while name is not None and name not in used: used.add(name); name = parent.get(name)
order = sorted(used)                         # another order than the body's
index = {name: i for i, name in enumerate(order)}
children = {name: [c for c in order if parent.get(c) == name] for name in order}
def bone_frame(name):
    """y along the bone (towards its first child), as bones are oriented in such programs."""
    kids = children[name]
    if not kids: return bone_frame(parent[name]) if name in parent and parent[name] in used else np.eye(3)
    y = REST[kids[0]] - REST[name]
    if np.linalg.norm(y) < 1e-6: return np.eye(3)
    y = y / np.linalg.norm(y)
    ref = np.array([0, 0, 1.0]) if abs(y[2]) < 0.9 else np.array([1.0, 0, 0])
    x = np.cross(y, ref); x /= np.linalg.norm(x); z = np.cross(x, y)
    return np.stack([x, y, z], axis=1)
def mat(rotation=np.eye(3), translation=(0, 0, 0), scale=1.0):
    m = np.eye(4); m[:3, :3] = rotation * scale; m[:3, 3] = translation; return m
c, s = math.cos(math.pi / 2), math.sin(math.pi / 2)
ARM_R = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])   # the armature turned 90 degrees about x
ARM = mat(ARM_R, (0, 0, 0), 0.01)                      # and scaled to centimetres
ARM_INV = np.linalg.inv(ARM)
G = {name: ARM_INV @ mat(bone_frame(name), REST[name]) for name in order}   # joints in the armature's space (cm; a rigid chain)
for name in order: G[name][:3, :3] /= np.cbrt(abs(np.linalg.det(G[name][:3, :3])))  # rotation only: the centimetres are in the translations
def quat(R):
    t = np.trace(R)
    if t > 0:
        k = math.sqrt(t + 1) * 2; return [(R[2, 1] - R[1, 2]) / k, (R[0, 2] - R[2, 0]) / k, (R[1, 0] - R[0, 1]) / k, k / 4]
    i = int(np.argmax(np.diag(R))); j, l = (i + 1) % 3, (i + 2) % 3
    k = math.sqrt(1 + R[i, i] - R[j, j] - R[l, l]) * 2
    q = [0, 0, 0, 0]; q[i] = k / 4; q[j] = (R[j, i] + R[i, j]) / k; q[l] = (R[l, i] + R[i, l]) / k; q[3] = (R[l, j] - R[j, l]) / k
    return q
nodes = [{'name': 'Armature', 'rotation': quat(ARM_R), 'scale': [0.01, 0.01, 0.01], 'children': [1]}, {'name': 'Knit', 'mesh': 0, 'skin': 0}]
first = len(nodes)
for name in order:
    local = (np.linalg.inv(G[parent[name]]) @ G[name]) if name in parent and parent[name] in used else G[name]
    nodes.append({'name': name, 'translation': [float(x) for x in local[:3, 3]], 'rotation': [float(x) for x in quat(local[:3, :3])]})
for name in order:
    kids = [first + index[c] for c in children[name]]
    if kids: nodes[first + index[name]]['children'] = kids
roots = [name for name in order if parent.get(name) not in used]
nodes[0]['children'] += [first + index[r] for r in roots]
IBM = np.stack([np.linalg.inv(G[name]) for name in order])      # mesh (armature space) to joint
Pa = (ARM_INV[:3, :3] @ P.T).T                                   # vertices in the armature's space: centimetres, turned
Na = (ARM_R.T @ N.T).T
Jn = np.array([[index[names[int(j)]] if w > 0 else 0 for j, w in zip(rj, rw)] for rj, rw in zip(J, W)], dtype=np.uint8)

# ---- write the .glb ----
chunks, views, accessors = [], [], []
def view(data, target=None):
    offset = sum(len(c) for c in chunks); chunks.append(data + b'\0' * ((4 - len(data) % 4) % 4))
    views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), **({'target': target} if target else {})}); return len(views) - 1
def acc(array, ctype, kind, target=34962, bounds=False):
    a = {'bufferView': view(np.ascontiguousarray(array).tobytes(), target), 'componentType': ctype, 'count': len(array), 'type': kind}
    if bounds: a['min'] = [float(x) for x in array.min(axis=0)]; a['max'] = [float(x) for x in array.max(axis=0)]
    accessors.append(a); return len(accessors) - 1
prim = {'attributes': {'POSITION': acc(Pa.astype('<f4'), 5126, 'VEC3', bounds=True), 'NORMAL': acc(Na.astype('<f4'), 5126, 'VEC3'), 'TEXCOORD_0': acc(UV.astype('<f4'), 5126, 'VEC2'), 'JOINTS_0': acc(Jn, 5121, 'VEC4'), 'WEIGHTS_0': acc(W.astype('<f4'), 5126, 'VEC4')},
        'indices': acc(I.reshape(-1).astype('<u4'), 5125, 'SCALAR', 34963), 'material': 0}
ibm = acc(np.stack([m.T.reshape(16) for m in IBM]).astype('<f4'), 5126, 'MAT4', None)
image = view(png)
out = {
    'asset': {'version': '2.0', 'generator': 'zhuda-wardrobe tools/foreign-part.py (written as modelling programs commonly export)'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': [{'name': 'Knit', 'primitives': [prim]}],
    'skins': [{'name': 'Armature', 'joints': [first + i for i in range(len(order))], 'skeleton': first + index[roots[0]], 'inverseBindMatrices': ibm}],
    'materials': [{'name': 'knit', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.85}}],
    'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'wrapS': 10497, 'wrapT': 10497, 'magFilter': 9729, 'minFilter': 9987}],
    'images': [{'bufferView': image, 'mimeType': 'image/png'}],
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(c) for c in chunks)}],
}
body = json.dumps(out, separators=(',', ':')).encode(); body += b' ' * ((4 - len(body) % 4) % 4)
binary = b''.join(chunks)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(body) + 8 + len(binary)) + struct.pack('<II', len(body), 0x4E4F534A) + body + struct.pack('<II', len(binary), 0x004E4942) + binary
open(os.path.join(parts, 'knit.glb'), 'wb').write(glb)
print(f'knit.glb: {len(I)} triangles, {len(P)} vertices, {len(order)} of {len(names)} joints ({", ".join(order)}), {len(glb) / 1e6:.2f} MB')
