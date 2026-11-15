/**
 * A cloth that is drawn: a `ZhudaClothSolver` and the `ZhudaDynamicMesh` it
 * moves. The solver's particles are in the world's space, and so are its
 * pins and the bodies it is kept out of: the mesh's node stays at the
 * origin, unturned, under a parent that is too.
 *
 * It has no timer. Each frame it is given the delta of a layer of the
 * engine's clock (`update(seconds)`, or `updateFrom(session.layers)`): a
 * paused layer hands it zero and it stands still.
 */
import {
  ZhudaClothSolver,
  type ZhudaClothOptions,
  type ZhudaClothShape,
} from '../simulation/Cloth.ts';
import type { ZhudaLayeredClock } from './Clocks.ts';
import { ZhudaDynamicMesh } from './Surfaces.ts';

export interface ZhudaClothMeshOptions extends ZhudaClothOptions {
  /**
   * Gives the mesh a colour a vertex and writes how far the weave is
   * stretched at each place to its alpha, for a lit surface's hook to read
   * (`s.vertexColor.a`): `true`, or `{ scale }`, by which the stretch (a
   * share of the rest length: 0.05 is five per cent) is multiplied before
   * it is clamped to 0..1 (default 1). Red, green and blue stay white.
   */
  strain?: boolean | { scale?: number };
}

const SOLVER_ONLY = ['strain'];

export class ZhudaCloth {
  readonly solver: ZhudaClothSolver;
  readonly mesh: ZhudaDynamicMesh;
  /** The mesh's node: give its renderer a material. */
  readonly node: any;
  private readonly strainScale: number | null;
  private readonly normals: Float32Array;
  private disposed = false;

  constructor(shape: ZhudaClothShape, parent: any, options: ZhudaClothMeshOptions = {}) {
    if (options === null || typeof options !== 'object') throw Error('Invalid cloth options');
    const { strain } = options;
    if (
      strain !== undefined &&
      typeof strain !== 'boolean' &&
      !(
        strain !== null &&
        typeof strain === 'object' &&
        Object.keys(strain).every((key) => key === 'scale') &&
        (strain.scale === undefined ||
          (Number.isFinite(strain.scale) && strain.scale > 0 && strain.scale <= 1000))
      )
    )
      throw Error('Invalid strain: true, false or { scale } (more than 0, at most 1000)');
    this.strainScale = strain ? (strain === true ? 1 : (strain.scale ?? 1)) : null;
    const solverOptions = Object.fromEntries(
      Object.entries(options).filter(([key]) => !SOLVER_ONLY.includes(key)),
    );
    this.solver = new ZhudaClothSolver(shape, solverOptions);
    const vertices = shape.particleOf.length;
    this.normals = new Float32Array(this.solver.count * 3);
    const positions = new Float32Array(vertices * 3);
    for (let v = 0; v < vertices; v++)
      positions.set(
        shape.particles.subarray(shape.particleOf[v] * 3, shape.particleOf[v] * 3 + 3),
        v * 3,
      );
    const colors = this.strainScale === null ? undefined : new Float32Array(vertices * 4).fill(1);
    if (colors) for (let v = 0; v < vertices; v++) colors[v * 4 + 3] = 0;
    try {
      this.mesh = new ZhudaDynamicMesh(
        {
          positions,
          normals: new Float32Array(vertices * 3),
          uvs: shape.uvs,
          indices: shape.indices,
          ...(colors ? { colors } : {}),
        },
        parent,
      );
    } catch (error) {
      this.solver.dispose();
      throw error;
    }
    this.node = this.mesh.node;
    this.refresh();
  }

  /**
   * Takes a delta in seconds, runs the whole steps it holds and, if any
   * ran, moves the mesh. Zero changes nothing.
   */
  update(deltaSeconds: number): { steps: number; dropped: number } {
    if (this.disposed) throw Error('Disposed cloth');
    const result = this.solver.advance(deltaSeconds);
    if (result.steps) this.refresh();
    return result;
  }

  /** The same, with the delta a layer of the engine's clock has for this frame (default `world`). */
  updateFrom(layers: ZhudaLayeredClock, layer = 'world'): { steps: number; dropped: number } {
    const delta = layers?.scaledDeltas?.get(layer);
    if (delta === undefined) throw Error(`Unknown time layer: ${layer}`);
    return this.update(delta);
  }

  /**
   * Writes where the particles are to the mesh, with their normals (and
   * the stretch): after a pin was moved or the cloth reset while no step
   * ran. `update` does it by itself.
   */
  refresh() {
    if (this.disposed) throw Error('Disposed cloth');
    const { shape, positions, count } = this.solver,
      { particleOf, indices } = shape,
      normals = this.normals,
      { vertices, stride, offsets } = this.mesh;
    // A particle's normal: its triangles' own, each weighing as its area. The front of a
    // triangle is the side it is wound clockwise on, as LayaAir draws it.
    normals.fill(0);
    for (let t = 0; t < indices.length; t += 3) {
      const a = particleOf[indices[t]] * 3,
        b = particleOf[indices[t + 1]] * 3,
        c = particleOf[indices[t + 2]] * 3;
      const ux = positions[b] - positions[a],
        uy = positions[b + 1] - positions[a + 1],
        uz = positions[b + 2] - positions[a + 2],
        vx = positions[c] - positions[a],
        vy = positions[c + 1] - positions[a + 1],
        vz = positions[c + 2] - positions[a + 2];
      const nx = uz * vy - uy * vz,
        ny = ux * vz - uz * vx,
        nz = uy * vx - ux * vy;
      normals[a] += nx;
      normals[a + 1] += ny;
      normals[a + 2] += nz;
      normals[b] += nx;
      normals[b + 1] += ny;
      normals[b + 2] += nz;
      normals[c] += nx;
      normals[c + 1] += ny;
      normals[c + 2] += nz;
    }
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      const size = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (size > 1e-12) {
        normals[k] /= size;
        normals[k + 1] /= size;
        normals[k + 2] /= size;
      } else {
        normals[k] = 0;
        normals[k + 1] = 1;
        normals[k + 2] = 0;
      }
    }
    const scale = this.strainScale;
    if (scale !== null) this.solver.measureStrain();
    const strain = this.solver.strain;
    for (let v = 0; v < particleOf.length; v++) {
      const k = particleOf[v] * 3,
        at = v * stride;
      vertices[at] = positions[k];
      vertices[at + 1] = positions[k + 1];
      vertices[at + 2] = positions[k + 2];
      vertices[at + offsets.normal] = normals[k];
      vertices[at + offsets.normal + 1] = normals[k + 1];
      vertices[at + offsets.normal + 2] = normals[k + 2];
      if (scale !== null && offsets.color !== null)
        vertices[at + offsets.color + 3] = Math.min(1, Math.max(0, strain[particleOf[v]] * scale));
    }
    this.mesh.updateRange(0, particleOf.length);
  }

  /** Destroys the mesh and its node; the material is its owner's. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.solver.dispose();
    this.mesh.dispose();
  }
}
