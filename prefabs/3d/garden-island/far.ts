// What lies beyond the island: other islands on the horizon, steep and
// wooded, standing in the sea's haze.
import { ZhudaDynamicMesh, createSurfaceMaterial, type MeshData } from 'zhuda-laya-engine';
import { fbm, noise } from './land.ts';
import { random } from '../math.ts';

/** Far islands: where (angle, distance), how wide and how high, metres. */
export const FAR: { angle: number; distance: number; radius: number; height: number; seed: number }[] = (() => {
  const r = random(71);
  const out = [];
  for (let i = 0; i < 11; i++) {
    const near = i % 3 === 0;
    out.push({
      angle: (i / 11) * Math.PI * 2 + (r() - 0.5) * 0.35,
      distance: near ? 260 + 90 * r() : 430 + 330 * r(),
      radius: near ? 55 + 40 * r() : 90 + 110 * r(),
      height: near ? 45 + 40 * r() : 90 + 130 * r(),
      seed: 1 + i * 13,
    });
  }
  return out;
})();

export function buildFar(scene: Laya.Scene3D): { dispose(): void } {
  const owned: { dispose(): void }[] = [];
  const material = createSurfaceMaterial({ type: 'pbr', color: [0.36, 0.5, 0.44, 1], roughness: 0.95, metallic: 0 }) as Laya.Material;
  const rock = createSurfaceMaterial({ type: 'pbr', color: [0.55, 0.55, 0.56, 1], roughness: 0.9, metallic: 0 }) as Laya.Material;
  void rock;
  for (const island of FAR) {
    // A dome on a polar grid, pulled into peaks and gullies by noise; its foot goes under the sea.
    const rings = 14,
      spokes = 40;
    const cx = Math.cos(island.angle) * island.distance,
      cz = Math.sin(island.angle) * island.distance;
    const positions: number[] = [],
      indices: number[] = [];
    const heightAt = (a: number, t: number) => {
      const x = Math.cos(a) * t * 3 + island.seed,
        z = Math.sin(a) * t * 3 + island.seed * 0.7;
      const peaks = Math.pow(fbm(x, z), 1.3) * 1.5 + 0.35 * noise(x * 3.1, z * 3.1);
      // steep sides, a broken top
      const dome = Math.pow(Math.max(0, 1 - t * t), 0.55);
      return island.height * dome * (0.35 + peaks) - 3;
    };
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2,
          t = j / rings;
        const wobble = 1 + 0.25 * noise(Math.cos(a) * 2 + island.seed, Math.sin(a) * 2);
        positions.push(cx + Math.cos(a) * t * island.radius * wobble, heightAt(a, t), cz + Math.sin(a) * t * island.radius * wobble);
      }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < spokes; i++) {
        const a = j * spokes + i,
          b = j * spokes + ((i + 1) % spokes),
          c = a + spokes,
          d = b + spokes;
        indices.push(a, b, c, b, d, c, a, c, b, b, c, d);
      }
    // Normals from the faces round each vertex.
    const normals = new Float32Array(positions.length);
    for (let k = 0; k < indices.length; k += 12) {
      for (const [p, q, s] of [
        [indices[k], indices[k + 1], indices[k + 2]],
        [indices[k + 3], indices[k + 4], indices[k + 5]],
      ]) {
        const ux = positions[q * 3] - positions[p * 3],
          uy = positions[q * 3 + 1] - positions[p * 3 + 1],
          uz = positions[q * 3 + 2] - positions[p * 3 + 2];
        const vx = positions[s * 3] - positions[p * 3],
          vy = positions[s * 3 + 1] - positions[p * 3 + 1],
          vz = positions[s * 3 + 2] - positions[p * 3 + 2];
        let nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
        for (const v of [p, q, s]) (normals[v * 3] += nx), (normals[v * 3 + 1] += ny), (normals[v * 3 + 2] += nz);
      }
    }
    for (let v = 0; v < normals.length; v += 3) {
      const l = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
      (normals[v] /= l), (normals[v + 1] /= l), (normals[v + 2] /= l);
    }
    const data: MeshData = { positions: new Float32Array(positions), normals, uvs: new Float32Array((positions.length / 3) * 2), indices: new Uint32Array(indices) };
    const mesh = new ZhudaDynamicMesh(data, scene);
    const r = (mesh.node as Laya.MeshSprite3D).meshRenderer;
    r.sharedMaterial = material;
    r.castShadow = false;
    r.receiveShadow = false;
    owned.push(mesh);
  }
  return {
    dispose() {
      for (const o of owned) o.dispose();
      material.destroy();
      rock.destroy();
    },
  };
}
