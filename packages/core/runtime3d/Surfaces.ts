export interface SurfaceMaterialSpec {
  type: "pbr" | "unlit";
  color?: [number, number, number, number];
  metallic?: number;
  roughness?: number;
  emission?: [number, number, number];
  textures?: {
    albedo?: any;
    normal?: any;
    metallicGloss?: any;
    emission?: any;
  };
  blend?: "opaque" | "alpha" | "additive" | "cutout";
  alphaCutoff?: number;
  doubleSided?: boolean;
  depthWrite?: boolean;
}
/** glTF/Three.js G=roughness,B=metallic -> Laya R=metallic,A=smoothness. Data stays linear. */
export function packMetallicRoughness(rgba: Uint8Array) {
  if (rgba.length % 4) throw Error("RGBA data required");
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 3] = 255 - rgba[i + 1];
  }
  return out;
}
export function createSurfaceTexture(
  width: number,
  height: number,
  pixels: Uint8Array,
  role: "color" | "emission" | "normal" | "data",
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  )
    throw Error("Invalid texture payload");
  const l = (globalThis as any).Laya,
    t = new l.Texture2D(
      width,
      height,
      l.TextureFormat.R8G8B8A8,
      false,
      true,
      role === "color" || role === "emission",
    );
  t.setPixelsData(pixels, false, false);
  return t;
}
export function createSurfaceMaterial(s: SurfaceMaterialSpec) {
  const l = (globalThis as any).Laya;
  if (!["pbr", "unlit"].includes(s.type)) throw Error("Unknown material type");
  if (
    [s.metallic ?? 0, s.roughness ?? 0.5, s.alphaCutoff ?? 0.5].some(
      (v) => !Number.isFinite(v) || v < 0 || v > 1,
    )
  )
    throw Error("Invalid material factors");
  const m =
    s.type === "pbr" ? new l.PBRStandardMaterial() : new l.UnlitMaterial();
  m.albedoColor = new l.Color(...(s.color || [1, 1, 1, 1]));
  if (s.type === "pbr") {
    m.metallic = s.metallic ?? 0;
    m.smoothness = 1 - (s.roughness ?? 0.5);
    if (s.emission) {
      m.enableEmission = true;
      m.emissionColor = new l.Color(...s.emission, 1);
    }
  }
  for (const [key, value] of Object.entries(s.textures || {}))
    m[
      (
        {
          albedo: "albedoTexture",
          normal: "normalTexture",
          metallicGloss: "metallicGlossTexture",
          emission: "emissionTexture",
        } as any
      )[key]
    ] = value?.bitmap || value;
  const blend = s.blend || "opaque",
    Class = s.type === "pbr" ? l.PBRStandardMaterial : l.UnlitMaterial;
  if (blend === "alpha") m.renderMode = Class.RENDERMODE_TRANSPARENT;
  else if (blend === "cutout") {
    m.alphaTest = true;
    m.alphaTestValue = s.alphaCutoff ?? 0.5;
  } else if (blend === "additive") {
    m.renderQueue = 3000;
    m.blend = l.RenderState.BLEND_ENABLE_ALL;
    m.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    m.blendDst = l.RenderState.BLENDPARAM_ONE;
  }
  if (s.doubleSided) m.cull = l.RenderState.CULL_NONE;
  m.depthWrite = s.depthWrite ?? (blend === "opaque" || blend === "cutout");
  return m;
}
/** Detach borrowed texture slots before destroying an owned material. */
export function disposeSurfaceMaterial(m: any) {
  for (const k of [
    "albedoTexture",
    "normalTexture",
    "metallicGlossTexture",
    "emissionTexture",
  ])
    if (k in m) m[k] = null;
  m.destroy();
}
export interface CustomSurfaceShader {
  name: string;
  vertex: string;
  fragment: string;
  attributes?: Record<string, [number, any]>;
  uniforms: Record<string, any>;
  instancing?: boolean;
}
const registeredShaders = new WeakMap<object, Map<string, string>>();
export function createCustomSurfaceMaterial(s: CustomSurfaceShader) {
  const l = (globalThis as any).Laya;
  if (!s.name || !s.vertex || !s.fragment)
    throw Error("Incomplete custom shader");
  let registry = registeredShaders.get(l.Shader3D);
  if (!registry) registeredShaders.set(l.Shader3D, (registry = new Map()));
  const signature = JSON.stringify(s);
  if (l.Shader3D.find(s.name)) {
    if (registry.get(s.name) !== signature)
      throw Error("Shader name has a different contract");
  } else {
    const shader = l.Shader3D.add(s.name, !!s.instancing, false);
    shader.shaderType = l.ShaderFeatureType.D3;
    const sub = new l.SubShader(
      s.attributes || l.SubShader.DefaultAttributeMap,
      s.uniforms,
    );
    shader.addSubShader(sub);
    // Laya injects uniforms declared by the map. Its scanner misses comma-separated
    // GLSL declarations, so remove only the explicit, mapped scalar/vector names.
    // Built-in camera/light declarations and unmapped declarations remain intact.
    const source = (code: string) =>
      code.replace(
        /\buniform\s+((?:(?:lowp|mediump|highp)\s+)?\w+)\s+([^;]+);/g,
        (original, type, names) => {
          const retained = names
            .split(",")
            .map((n: string) => n.trim())
            .filter(
              (n: string) =>
                !Object.prototype.hasOwnProperty.call(s.uniforms, n),
            );
          return retained.length
            ? `uniform ${type} ${retained.join(",")};`
            : "";
        },
      );
    sub.addShaderPass(source(s.vertex), source(s.fragment));
    registry.set(s.name, signature);
  }
  const material = new l.Material();
  material.setShaderName(s.name);
  return material;
}
export interface MeshData {
  positions: Float32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  indices: Uint16Array | Uint32Array;
}
/** Laya 3.4.2 buffer adapter; POSITION/NORMAL/UV, local range uploads and refreshed bounds. */
export class ZhudaDynamicMesh {
  readonly data: MeshData;
  readonly mesh: any;
  readonly vertices: Float32Array;
  readonly node: any;
  private disposed = false;
  constructor(data: MeshData, parent?: any) {
    this.data = data;
    const l = (globalThis as any).Laya,
      n = data.positions.length / 3;
    if (!Number.isInteger(n) || n < 3 || n > 65535)
      throw Error("Mesh requires 3..65535 vertices per chunk");
    if (
      (data.normals && data.normals.length !== n * 3) ||
      (data.uvs && data.uvs.length !== n * 2) ||
      !data.indices.length ||
      data.indices.length % 3 ||
      [...data.indices].some((i) => i >= n)
    )
      throw Error("Invalid mesh attributes or indices");
    this.vertices = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      this.vertices.set(data.positions.subarray(i * 3, i * 3 + 3), i * 8);
      this.vertices.set(
        data.normals?.subarray(i * 3, i * 3 + 3) || [0, 1, 0],
        i * 8 + 3,
      );
      this.vertices.set(
        data.uvs?.subarray(i * 2, i * 2 + 2) || [0, 0],
        i * 8 + 6,
      );
    }
    if (!this.vertices.every(Number.isFinite))
      throw Error("Non-finite mesh data");
    this.mesh = l.PrimitiveMesh._createMesh(
      l.VertexMesh.getVertexDeclaration("POSITION,NORMAL,UV"),
      this.vertices,
      new Uint16Array(data.indices),
    );
    this.node = new l.MeshSprite3D(this.mesh);
    parent?.addChild(this.node);
    this.refreshBounds();
  }
  updateRange(first: number, count: number) {
    if (this.disposed) throw Error("Disposed mesh");
    if (
      !Number.isInteger(first) ||
      !Number.isInteger(count) ||
      first < 0 ||
      count < 1 ||
      (first + count) * 8 > this.vertices.length
    )
      throw Error("Invalid vertex range");
    if (
      !this.vertices
        .subarray(first * 8, (first + count) * 8)
        .every(Number.isFinite)
    )
      throw Error("Non-finite mesh update");
    const bytes = first * 8 * 4,
      length = count * 8 * 4;
    this.mesh._vertexBuffer.setData(this.vertices.buffer, bytes, bytes, length);
    this.refreshBounds();
  }
  setPosition(i: number, x: number, y: number, z: number) {
    if (
      !Number.isInteger(i) ||
      i < 0 ||
      i * 8 >= this.vertices.length ||
      ![x, y, z].every(Number.isFinite)
    )
      throw Error("Invalid vertex");
    this.vertices.set([x, y, z], i * 8);
  }
  refreshBounds() {
    const l = (globalThis as any).Laya,
      min = new l.Vector3(Infinity, Infinity, Infinity),
      max = new l.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < this.vertices.length; i += 8) {
      min.x = Math.min(min.x, this.vertices[i]);
      min.y = Math.min(min.y, this.vertices[i + 1]);
      min.z = Math.min(min.z, this.vertices[i + 2]);
      max.x = Math.max(max.x, this.vertices[i]);
      max.y = Math.max(max.y, this.vertices[i + 1]);
      max.z = Math.max(max.z, this.vertices[i + 2]);
    }
    this.mesh.bounds = new l.Bounds(min, max);
    this.node.meshRenderer.boundsChange = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.node.destroy(true);
    this.mesh.destroy();
  }
}
/** Stable application IDs survive batch reorder. Laya batches shared mesh/material via GPU instancing. */
export class ZhudaInstanceGroup {
  readonly parent: any;
  readonly mesh: any;
  readonly material: any;
  private nodes = new Map<string, any>();
  constructor(parent: any, mesh: any, material: any) {
    this.parent = parent;
    this.mesh = mesh;
    this.material = material;
    material.enableInstancing = true;
  }
  set(id: string, matrix: ArrayLike<number>) {
    if (
      !id ||
      matrix.length !== 16 ||
      !Array.from(matrix).every(Number.isFinite)
    )
      throw Error("Invalid instance");
    const l = (globalThis as any).Laya;
    let node = this.nodes.get(id);
    if (!node) {
      node = new l.MeshSprite3D(this.mesh, id);
      node.meshRenderer.sharedMaterial = this.material;
      this.parent.addChild(node);
      this.nodes.set(id, node);
    }
    node.transform.worldMatrix = new l.Matrix4x4(...Array.from(matrix));
    return node;
  }
  remove(id: string) {
    const node = this.nodes.get(id);
    if (!node) return false;
    node.destroy(true);
    this.nodes.delete(id);
    return true;
  }
  get(id: string) {
    return this.nodes.get(id);
  }
  get size() {
    return this.nodes.size;
  }
  dispose() {
    for (const n of this.nodes.values()) n.destroy(true);
    this.nodes.clear();
  }
}

export interface SurfacePassRequirements {
  depth?: boolean;
  opaqueColor?: boolean;
}
/** Owns this camera's depth/color requests. A rejected budget requires a consumer material fallback.
 * Costs count requested prepasses/copies; actual draw calls depend on scene/shadows/postprocessing. */
export function configureSurfacePasses(
  camera: any,
  requirements: readonly SurfacePassRequirements[],
  maxAdditionalPasses: number,
) {
  if (!Number.isInteger(maxAdditionalPasses) || maxAdditionalPasses < 0)
    throw Error("Invalid additional pass budget");
  const l = (globalThis as any).Laya;
  const depth = requirements.some((r) => r.depth),
    opaqueColor = requirements.some((r) => r.opaqueColor);
  const requestedPasses = Number(depth) + Number(opaqueColor);
  const withinBudget = requestedPasses <= maxAdditionalPasses;
  camera.depthTextureMode =
    withinBudget && depth ? l.DepthTextureMode.Depth : l.DepthTextureMode.None;
  camera.opaquePass = withinBudget && opaqueColor;
  const supported =
    !depth || !!(camera.depthTextureMode & l.DepthTextureMode.Depth);
  if (!supported) {
    camera.depthTextureMode = l.DepthTextureMode.None;
    camera.opaquePass = false;
  }
  return {
    requested: { depth, opaqueColor },
    requestedPasses,
    enabledPasses: withinBudget && supported ? requestedPasses : 0,
    ready: withinBudget && supported,
    reason: !withinBudget ? "budget" : !supported ? "depth-unsupported" : null,
  };
}
