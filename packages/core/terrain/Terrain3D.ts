export type Terrain3DOptions = {
  parent?: any;
  material: any;
  chunkCells?: number;
  maxResidentChunks?: number;
  uvScale?: [number, number];
  /** Optional closed volume, extruded along local -Y. Material is borrowed. */
  solid?: { depth: number; material?: any };
};
import { ZhudaHeightfield, type HeightRegion } from "./Heightfield.ts";
import { ZhudaDynamicMesh } from "../runtime3d/Surfaces.ts";
import {
  inverse4,
  transformPoint,
  normalized,
  type Vec3,
} from "../runtime3d/Math3D.ts";
import type { QueryRay, QueryProvider } from "../runtime3d/SceneQueries.ts";
import { buildTerrainShell, shellTriangleDistance } from "./TerrainShell.ts";
type Chunk = {
  mesh: ZhudaDynamicMesh;
  xs: number[];
  zs: number[];
  dirty?: HeightRegion;
  shell?: ZhudaDynamicMesh;
};
/** Resident heightfield chunks. The supplied material is borrowed; dispose releases only terrain meshes/nodes. */
export class ZhudaTerrain3D {
  readonly field: ZhudaHeightfield;
  readonly options: Terrain3DOptions;
  readonly root: any;
  private chunks = new Map<string, Chunk>();
  private unsubscribe: () => void;
  private disposed = false;
  private stride: 1 | 2 | 4 = 1;
  constructor(field: ZhudaHeightfield, options: Terrain3DOptions) {
    this.field = field;
    this.options = options;
    if (!options.material || options.material.destroyed)
      throw Error("A live terrain material is required");
    if (
      options.solid &&
      (!Number.isFinite(options.solid.depth) ||
        options.solid.depth <= 0 ||
        options.solid.material?.destroyed)
    )
      throw Error("Invalid terrain solid depth/material");
    const size = options.chunkCells ?? 32;
    if (!Number.isInteger(size) || size < 4 || size > 128 || size % 4)
      throw Error("chunkCells must be a multiple of 4 within 4..128");
    if (
      !Number.isInteger(options.maxResidentChunks ?? 64) ||
      (options.maxResidentChunks ?? 64) < 1
    )
      throw Error("Invalid chunk budget");
    if (
      options.uvScale &&
      (!options.uvScale.every(Number.isFinite) || options.uvScale.length !== 2)
    )
      throw Error("Invalid UV scale");
    const l = (globalThis as any).Laya;
    this.root = new l.Sprite3D("ZhudaTerrain");
    options.parent?.addChild(this.root);
    this.unsubscribe = field.onChange((r) => {
      for (const chunk of this.chunks.values()) {
        const expanded = {
          minX: r.minX - 1,
          minZ: r.minZ - 1,
          maxX: r.maxX + 1,
          maxZ: r.maxZ + 1,
        };
        if (
          chunk.xs[0] > expanded.maxX ||
          chunk.xs[chunk.xs.length - 1] < expanded.minX ||
          chunk.zs[0] > expanded.maxZ ||
          chunk.zs[chunk.zs.length - 1] < expanded.minZ
        )
          continue;
        const old = chunk.dirty;
        chunk.dirty = old
          ? {
              minX: Math.min(old.minX, expanded.minX),
              minZ: Math.min(old.minZ, expanded.minZ),
              maxX: Math.max(old.maxX, expanded.maxX),
              maxZ: Math.max(old.maxZ, expanded.maxZ),
            }
          : expanded;
      }
    });
  }
  /** Local x/z bounds; uniform stride avoids neighboring chunks with incompatible edge LODs. */
  setRegion(region: HeightRegion, stride: 1 | 2 | 4 = 1) {
    if (this.disposed) throw Error("Disposed terrain");
    if (
      ![1, 2, 4].includes(stride) ||
      !Object.values(region).every(Number.isFinite) ||
      region.maxX <= region.minX ||
      region.maxZ <= region.minZ
    )
      throw Error("Invalid terrain region/stride");
    const f = this.field,
      size = this.options.chunkCells ?? 32,
      span = size * f.cellSize,
      x0 = Math.max(0, Math.floor((region.minX - f.origin[0]) / span)),
      x1 = Math.min(
        Math.ceil(f.cellsX / size) - 1,
        Math.ceil((region.maxX - f.origin[0]) / span) - 1,
      ),
      z0 = Math.max(0, Math.floor((region.minZ - f.origin[1]) / span)),
      z1 = Math.min(
        Math.ceil(f.cellsZ / size) - 1,
        Math.ceil((region.maxZ - f.origin[1]) / span) - 1,
      );
    if (
      Math.max(0, x1 - x0 + 1) * Math.max(0, z1 - z0 + 1) >
      (this.options.maxResidentChunks ?? 64)
    )
      throw Error("Terrain region exceeds resident chunk budget");
    const required = new Set<string>();
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) required.add(x + ":" + z);
    for (const [key, c] of this.chunks)
      if (!required.has(key) || this.stride !== stride) {
        c.mesh.dispose();
        c.shell?.dispose();
        this.chunks.delete(key);
      }
    this.stride = stride;
    try {
      for (const key of required)
        if (!this.chunks.has(key)) {
          const [x, z] = key.split(":").map(Number),
            axis = (start: number, end: number) => {
              const a = [];
              for (let i = start; i < end; i += stride) a.push(i);
              a.push(end);
              return a;
            },
            xs = axis(x * size, Math.min(f.cellsX, (x + 1) * size)),
            zs = axis(z * size, Math.min(f.cellsZ, (z + 1) * size));
          const n = xs.length * zs.length,
            positions = new Float32Array(n * 3),
            normals = new Float32Array(n * 3),
            uvs = new Float32Array(n * 2),
            indices = new Uint16Array((xs.length - 1) * (zs.length - 1) * 6);
          for (let j = 0; j < zs.length; j++)
            for (let i = 0; i < xs.length; i++) {
              const k = j * xs.length + i,
                p = this.vertex(xs[i], zs[j]);
              positions.set(p.slice(0, 3), k * 3);
              normals.set(p.slice(3, 6), k * 3);
              uvs.set(p.slice(6), k * 2);
            }
          let k = 0;
          for (let j = 0; j < zs.length - 1; j++)
            for (let i = 0; i < xs.length - 1; i++) {
              const a = j * xs.length + i,
                b = a + 1,
                c = a + xs.length,
                d = c + 1;
              indices.set([c, a, d, a, b, d], k);
              k += 6;
            }
          const mesh = new ZhudaDynamicMesh(
            { positions, normals, uvs, indices },
            this.root,
          );
          mesh.node.name = "terrain:" + key;
          mesh.node.meshRenderer.sharedMaterial = this.options.material;
          mesh.node.meshRenderer.receiveShadow = true;
          const chunk: Chunk = { mesh, xs, zs };
          this.chunks.set(key, chunk);
          this.rebuildShell(chunk);
        }
      this.flush();
    } catch (e) {
      this.dispose();
      throw e;
    }
  }
  private vertex(x: number, z: number) {
    const f = this.field,
      n = f.normalAtVertex(x, z),
      px = f.origin[0] + x * f.cellSize,
      pz = f.origin[1] + z * f.cellSize;
    return [
      px,
      f.heightAtVertex(x, z),
      pz,
      n.x,
      n.y,
      n.z,
      px * (this.options.uvScale?.[0] ?? 1),
      pz * (this.options.uvScale?.[1] ?? 1),
    ];
  }
  private rebuildShell(chunk: Chunk) {
    if (!this.options.solid) return;
    const shell = new ZhudaDynamicMesh(
      buildTerrainShell(
        chunk.mesh.vertices,
        chunk.xs,
        chunk.zs,
        this.options.solid.depth,
      ),
      this.root,
    );
    shell.node.name = "terrain-solid";
    shell.node.meshRenderer.sharedMaterial =
      this.options.solid.material ?? this.options.material;
    shell.node.meshRenderer.receiveShadow = true;
    chunk.shell?.dispose();
    chunk.shell = shell;
  }
  flush() {
    if (this.disposed) throw Error("Disposed terrain");
    for (const chunk of this.chunks.values()) {
      const r = chunk.dirty;
      if (!r) continue;
      let first = Infinity,
        last = -1;
      for (let j = 0; j < chunk.zs.length; j++)
        for (let i = 0; i < chunk.xs.length; i++)
          if (
            chunk.xs[i] >= r.minX &&
            chunk.xs[i] <= r.maxX &&
            chunk.zs[j] >= r.minZ &&
            chunk.zs[j] <= r.maxZ
          ) {
            const k = j * chunk.xs.length + i;
            chunk.mesh.vertices.set(
              this.vertex(chunk.xs[i], chunk.zs[j]),
              k * 8,
            );
            first = Math.min(first, k);
            last = Math.max(last, k);
          }
      if (last >= first) {
        chunk.mesh.updateRange(first, last - first + 1);
        this.rebuildShell(chunk);
      }
      chunk.dirty = undefined;
    }
  }
  sampleLocal(x: number, z: number) {
    return this.field.sample(x, z, this.stride);
  }
  private chunkKeyForCell(x: number, z: number) {
    const size = this.options.chunkCells ?? 32;
    return Math.floor(x / size) + ":" + Math.floor(z / size);
  }
  private raycastLocal(ray: QueryRay, maxDistance: number) {
    const accept = (x: number, z: number) =>
      this.chunks.has(this.chunkKeyForCell(x, z));
    let hit = this.field.raycast(ray, maxDistance, this.stride, accept);
    if (!this.options.solid) return hit;
    const depth = this.options.solid.depth,
      bottom = this.field.raycast(
        {
          origin: { ...ray.origin, y: ray.origin.y + depth },
          direction: ray.direction,
        },
        hit?.distance ?? maxDistance,
        this.stride,
        accept,
      );
    if (bottom)
      hit = {
        ...bottom,
        position: { ...bottom.position, y: bottom.position.y - depth },
        normal: {
          x: -bottom.normal.x,
          y: -bottom.normal.y,
          z: -bottom.normal.z,
        },
      };
    for (const chunk of this.chunks.values()) {
      const shell = chunk.shell!;
      const data = shell.data,
        start = (chunk.xs.length - 1) * (chunk.zs.length - 1) * 6;
      for (let i = start; i < data.indices.length; i += 3) {
        const a = data.indices[i],
          t = shellTriangleDistance(
            ray,
            data.positions,
            a,
            data.indices[i + 1],
            data.indices[i + 2],
          );
        if (t === null || t > (hit?.distance ?? maxDistance)) continue;
        const position = {
            x: ray.origin.x + ray.direction.x * t,
            y: ray.origin.y + ray.direction.y * t,
            z: ray.origin.z + ray.direction.z * t,
          },
          f = this.field;
        hit = {
          distance: t,
          position,
          normal: {
            x: data.normals![a * 3],
            y: data.normals![a * 3 + 1],
            z: data.normals![a * 3 + 2],
          },
          cellX: Math.min(
            f.cellsX - 1,
            Math.max(0, Math.floor((position.x - f.origin[0]) / f.cellSize)),
          ),
          cellZ: Math.min(
            f.cellsZ - 1,
            Math.max(0, Math.floor((position.z - f.origin[1]) / f.cellSize)),
          ),
        };
      }
    }
    return hit;
  }
  raycast(ray: QueryRay, maxDistance = Infinity) {
    if (this.disposed) throw Error("Disposed terrain");
    if (
      maxDistance !== Infinity &&
      (!Number.isFinite(maxDistance) || maxDistance < 0)
    )
      throw Error("Invalid terrain ray distance");
    const world = this.root.transform.worldMatrix.elements,
      inv = inverse4(world),
      direction = normalized(ray.direction),
      origin = transformPoint(inv, ray.origin),
      end = transformPoint(inv, {
        x: ray.origin.x + direction.x,
        y: ray.origin.y + direction.y,
        z: ray.origin.z + direction.z,
      });
    const rawDirection = {
        x: end.x - origin.x,
        y: end.y - origin.y,
        z: end.z - origin.z,
      },
      localScale = Math.hypot(rawDirection.x, rawDirection.y, rawDirection.z);
    if (!Number.isFinite(localScale) || localScale < 1e-12) return null;
    const hit = this.raycastLocal(
      {
        origin,
        direction: {
          x: rawDirection.x / localScale,
          y: rawDirection.y / localScale,
          z: rawDirection.z / localScale,
        },
      },
      Number.isFinite(maxDistance) ? maxDistance * localScale : Infinity,
    );
    if (!hit) return null;
    const n = hit.normal,
      normal = normalized({
        x: inv[0] * n.x + inv[1] * n.y + inv[2] * n.z,
        y: inv[4] * n.x + inv[5] * n.y + inv[6] * n.z,
        z: inv[8] * n.x + inv[9] * n.y + inv[10] * n.z,
      });
    const position = transformPoint(world, hit.position);
    return {
      ...hit,
      distance: Math.hypot(
        position.x - ray.origin.x,
        position.y - ray.origin.y,
        position.z - ray.origin.z,
      ),
      position,
      normal,
    };
  }
  queryProvider(entityId: string, layer = 1): QueryProvider {
    return {
      entityId,
      layer,
      raycast: (ray, distance) => {
        const h = this.raycast(ray, distance);
        return h ? { ...h, instanceId: h.cellX + ":" + h.cellZ } : null;
      },
    };
  }
  report() {
    return {
      residentChunks: this.chunks.size,
      renderMeshes:
        this.chunks.size +
        [...this.chunks.values()].filter((c) => c.shell).length,
      solidDepth: this.options.solid?.depth ?? 0,
      stride: this.stride,
      vertices: [...this.chunks.values()].reduce(
        (n, c) =>
          n + c.mesh.vertices.length / 8 + (c.shell?.vertices.length ?? 0) / 8,
        0,
      ),
      estimatedBufferBytes: [...this.chunks.values()].reduce(
        (n, c) =>
          n +
          c.mesh.vertices.byteLength +
          c.mesh.data.indices.byteLength +
          (c.shell
            ? c.shell.vertices.byteLength + c.shell.data.indices.byteLength
            : 0),
        0,
      ),
    };
  }
  /** Diagnostic copy prevents callers from accidentally bypassing edits/dirty propagation. */
  chunkSnapshot(key: string) {
    const c = this.chunks.get(key);
    return c
      ? {
          xs: [...c.xs],
          zs: [...c.zs],
          vertices: new Float32Array(c.mesh.vertices),
          bounds: c.mesh.mesh.bounds,
          shell: c.shell
            ? {
                vertices: new Float32Array(c.shell.vertices),
                indices: new Uint16Array(c.shell.data.indices),
                bounds: c.shell.mesh.bounds,
              }
            : null,
        }
      : null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const c of this.chunks.values()) {
      c.mesh.dispose();
      c.shell?.dispose();
    }
    this.chunks.clear();
    this.root.destroy(true);
  }
}
