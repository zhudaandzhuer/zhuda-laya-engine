// The island's solid things, made from numbers with the engine's geometry kit:
// the ground and its colours, the sea, trees, bamboo, bushes, stones, the path,
// lantern posts and the terrace. Everything of one surface is merged into a few meshes.
import {
  ZhudaDynamicMesh,
  createSurfaceMaterial,
  createSurfaceTexture,
  createZhudaBoxMesh,
  createZhudaCurveTubeMesh,
  createZhudaExtrudeMesh,
  createZhudaIsosurfaceMesh,
  createZhudaLatheMesh,
  createZhudaRodMesh,
  createZhudaSdfField,
  createZhudaTorusMesh,
  mergeZhudaMeshes,
  transformZhudaMesh,
  zhudaMarkFoliage,
  type MeshData,
  type ZhudaSdfShape,
} from 'zhuda-laya-engine';
import {
  BUSHES,
  CULMS,
  HALF,
  LANTERNS,
  PATH,
  PATH2,
  POND,
  ROCKS,
  SEA_Y,
  STEPS,
  STEP_TOP,
  TERRACE,
  TREES,
  WATER_Y,
  coverAt,
  fbm,
  groundAt,
  heightAt,
  insideBy,
  noise,
  petalsAt,
  pondDistance,
  type TreeKind,
  type XZ,
} from './land.ts';
import { clamp, lerp, random, type V3 } from '../math.ts';

type RGB = [number, number, number];
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export interface Built {
  /** Materials that glow by night (lantern paper, terrace lamps). */
  glows: Laya.Material[];
  /** Where each lamp's light sits, and how far it reaches. */
  lamps: { at: V3; range: number }[];
  dispose(): void;
}

export function buildIsland(scene: Laya.Scene3D): Built {
  const owned: { dispose(): void }[] = [];
  const materials: Laya.Material[] = [];
  const surface = (color: RGB, roughness = 0.85, extra: Record<string, unknown> = {}) => {
    const m = createSurfaceMaterial({ type: 'pbr', color: [color[0], color[1], color[2], 1], roughness, metallic: 0, ...extra }) as Laya.Material;
    materials.push(m);
    return m;
  };
  const add = (parts: MeshData[], material: Laya.Material, cast = true, foliage = false) => {
    for (const data of mergeZhudaMeshes(parts)) {
      const mesh = new ZhudaDynamicMesh(data, scene);
      const r = (mesh.node as Laya.MeshSprite3D).meshRenderer;
      r.sharedMaterial = material;
      r.castShadow = cast;
      r.receiveShadow = true;
      owned.push(mesh);
      if (foliage) owned.push(zhudaMarkFoliage(mesh.node));
    }
  };
  const at = (data: MeshData, x: number, y: number, z: number, yawDeg = 0, scale = 1, pitchDeg = 0, rollDeg = 0) =>
    transformZhudaMesh(data, { position: [x, y, z], yawDeg, pitchDeg, rollDeg, scale });
  const rand = random(101);

  // ---- the ground: a grid of heights, coloured by a baked map ------------------
  {
    const N = 176,
      step = (HALF * 2) / N;
    const positions = new Float32Array((N + 1) * (N + 1) * 3),
      normals = new Float32Array((N + 1) * (N + 1) * 3),
      uvs = new Float32Array((N + 1) * (N + 1) * 2);
    const hs = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) hs[j * (N + 1) + i] = heightAt(-HALF + i * step, -HALF + j * step);
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const k = j * (N + 1) + i;
        positions.set([-HALF + i * step, hs[k], -HALF + j * step], k * 3);
        const hx = hs[j * (N + 1) + Math.min(N, i + 1)] - hs[j * (N + 1) + Math.max(0, i - 1)],
          hz = hs[Math.min(N, j + 1) * (N + 1) + i] - hs[Math.max(0, j - 1) * (N + 1) + i];
        const l = Math.hypot(hx, 2 * step, hz);
        normals.set([-hx / l, (2 * step) / l, -hz / l], k * 3);
        uvs.set([i / N, j / N], k * 2);
      }
    const indices = new Uint32Array(N * N * 6);
    let o = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i,
          b = a + 1,
          c = a + N + 1,
          d = c + 1;
        indices.set([a, b, c, b, d, c], o);
        o += 6;
      }
    const T = 512;
    const pixels = new Uint8Array(T * T * 4);
    const grassA: RGB = [0.30, 0.47, 0.20],
      grassB: RGB = [0.40, 0.56, 0.24],
      sand: RGB = [0.86, 0.78, 0.6],
      wet: RGB = [0.62, 0.55, 0.42],
      path: RGB = [0.5, 0.46, 0.38],
      bank: RGB = [0.36, 0.31, 0.23],
      bed: RGB = [0.3, 0.4, 0.38],
      stone: RGB = [0.52, 0.52, 0.54],
      petal: RGB = [0.9, 0.62, 0.72];
    for (let j = 0; j < T; j++)
      for (let i = 0; i < T; i++) {
        const x = -HALF + ((i + 0.5) / T) * HALF * 2,
          z = -HALF + ((j + 0.5) / T) * HALF * 2;
        const cover = coverAt(x, z);
        let c: RGB;
        if (cover === 'grass') {
          c = mixc(grassA, grassB, fbm(x * 0.12, z * 0.12));
          const p = petalsAt(x, z);
          if (p > 0 && noise(x * 2.3, z * 2.3) < p * 0.55) c = mixc(c, petal, 0.55);
        } else if (cover === 'sand' || cover === 'sea') c = mixc(wet, sand, clamp(insideBy(x, z) / 3 + 0.2, 0, 1));
        else if (cover === 'path') c = path;
        else if (cover === 'bank') c = bank;
        else if (cover === 'bed') c = mixc(bank, bed, clamp(1.6 - pondDistance(x, z), 0.3, 1));
        else c = stone;
        const shade = 0.92 + 0.16 * noise(x * 1.7, z * 1.7);
        const q = (j * T + i) * 4;
        pixels[q] = clamp(c[0] * shade, 0, 1) * 255;
        pixels[q + 1] = clamp(c[1] * shade, 0, 1) * 255;
        pixels[q + 2] = clamp(c[2] * shade, 0, 1) * 255;
        pixels[q + 3] = 255;
      }
    const texture = createSurfaceTexture(T, T, pixels, 'color', { mipmap: true, anisoLevel: 4 });
    owned.push({ dispose: () => texture.destroy() });
    const material = createSurfaceMaterial({ type: 'pbr', color: [1, 1, 1, 1], roughness: 0.95, metallic: 0, textures: { albedo: texture } }) as Laya.Material;
    materials.push(material);
    add([{ positions, normals, uvs, indices }], material, false);
  }

  // ---- crowns: lumps joined into one soft body, four shapes ---------------------
  const lumps = (seed: number, count: number, squash: number, cell: number, rough = 0.09): MeshData => {
    const r = random(seed);
    const shapes: ZhudaSdfShape[] = [{ kind: 'ellipsoid', center: [0, 0, 0], radii: [0.62, 0.5 * squash, 0.62] }];
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2,
        up = (r() - 0.35) * 0.9 * squash,
        d = 0.35 + 0.3 * r();
      const s = 0.3 + 0.2 * r();
      shapes.push({ kind: 'ellipsoid', center: [Math.cos(a) * d, up * 0.5, Math.sin(a) * d], radii: [s, s * (0.75 + 0.2 * r()) * squash, s], blend: 0.08 });
    }
    const field = createZhudaSdfField(shapes);
    // Roughened like a mass of leaves: small bumps over the lumps.
    const bumps = (x: number, y: number, z: number) => noise(x * 7 + y * 3.1, z * 7 - y * 2.3) + noise(y * 8 + 5, x * 5 + z * 6) - 1;
    return createZhudaIsosurfaceMesh({ distance: (x, y, z) => field.distance(x, y, z) - rough * bumps(x, y, z), min: [-1.3, -1.1, -1.3], max: [1.3, 1.1, 1.3], cellSize: cell });
  };
  const crowns = [lumps(1, 9, 1, 0.08), lumps(2, 10, 0.9, 0.08), lumps(3, 8, 1.1, 0.08), lumps(4, 11, 0.85, 0.08)];
  const bushShapes = [lumps(7, 6, 0.8, 0.16), lumps(8, 7, 0.7, 0.16)];

  const crownColour: Record<TreeKind, RGB> = { pink: [0.95, 0.56, 0.7], rose: [0.86, 0.36, 0.55], violet: [0.6, 0.45, 0.82], green: [0.36, 0.55, 0.27] };
  const crownParts: Record<TreeKind, MeshData[]> = { pink: [], rose: [], violet: [], green: [] };
  const wood: MeshData[] = [];
  for (const t of TREES) {
    const y = groundAt(t.x, t.z) ?? 0;
    const top: V3 = [t.x + t.lean * t.height * 0.5, y + t.height, t.z + Math.cos(t.turn) * t.lean * t.height * 0.3];
    wood.push(
      createZhudaCurveTubeMesh({
        points: [
          [t.x, y - 0.3, t.z],
          [t.x + t.lean * 0.6, y + t.height * 0.45, t.z - t.lean * 0.3],
          [top[0], top[1] - t.crown * 0.35, top[2]],
        ],
        radius: 0.13 + t.crown * 0.045,
        tubularSegments: 8,
        radialSegments: 7,
      }),
    );
    for (let b = 0; b < 3; b++) {
      const a = (t.turn / 57.3 + (b * Math.PI * 2) / 3) % (Math.PI * 2);
      wood.push(createZhudaRodMesh([top[0], top[1] - t.crown * 0.75, top[2]], [top[0] + Math.cos(a) * t.crown * 0.55, top[1] - t.crown * 0.1, top[2] + Math.sin(a) * t.crown * 0.55], 0.06 + t.crown * 0.015, 5));
    }
    crownParts[t.kind].push(at(crowns[t.shape], top[0], top[1], top[2], t.turn, t.crown));
    // Two smaller lumps beside the main one, so no two crowns have the same outline.
    for (let k = 0; k < 2; k++) {
      const a = t.turn / 57.3 + 1.3 + k * 2.6;
      crownParts[t.kind].push(at(crowns[(t.shape + k + 1) % 4], top[0] + Math.cos(a) * t.crown * 0.75, top[1] - t.crown * (0.25 + 0.2 * k), top[2] + Math.sin(a) * t.crown * 0.75, t.turn + 70 * k, t.crown * 0.55));
    }
  }
  add(wood, surface([0.3, 0.2, 0.17], 0.9));
  for (const kind of Object.keys(crownParts) as TreeKind[]) add(crownParts[kind], surface(crownColour[kind], 0.8), true, true);

  // ---- bushes --------------------------------------------------------------------
  const green: MeshData[] = [],
    white: MeshData[] = [];
  BUSHES.forEach(([x, z, r, flowering], i) => (flowering ? white : green).push(at(bushShapes[i % 2], x, (groundAt(x, z) ?? 0) + r * 0.45, z, i * 77, r)));
  add(green, surface([0.32, 0.5, 0.26], 0.85), true, true);
  add(white, surface([0.96, 0.84, 0.88], 0.8), true, true);

  // ---- bamboo: culms in clumps, tufts of leaf toward their tops ------------------
  {
    const culms: MeshData[] = [],
      leaves: MeshData[] = [];
    const blades: number[] = [];
    for (const [x, z, h, dir, lean] of CULMS) {
      const y = groundAt(x, z) ?? 0;
      const tip: V3 = [x + Math.cos(dir) * lean * h, y + h, z + Math.sin(dir) * lean * h];
      const mid: V3 = [x + Math.cos(dir) * lean * h * 0.3, y + h * 0.55, z + Math.sin(dir) * lean * h * 0.3];
      culms.push(createZhudaCurveTubeMesh({ points: [[x, y - 0.2, z], mid, tip], radius: 0.05, tubularSegments: 6, radialSegments: 5 }));
      // Leaves: thin blades in sprays along the upper half, each drooping from its twig.
      for (let k = 0; k < 6; k++) {
        const f = 0.48 + 0.09 * k + 0.04 * rand();
        const p: V3 = [lerp(mid[0], tip[0], clamp((f - 0.55) / 0.45, 0, 1)), y + h * f, lerp(mid[2], tip[2], clamp((f - 0.55) / 0.45, 0, 1))];
        const spray = rand() * Math.PI * 2;
        for (let b = 0; b < 9; b++) {
          const a = spray + (rand() - 0.5) * 1.6,
            out = 0.25 + 0.75 * rand(),
            long = 0.42 + 0.25 * rand(),
            droop = 0.25 + 0.5 * rand();
          const base: V3 = [p[0] + Math.cos(a) * out * 0.7, p[1] + (rand() - 0.5) * 0.5, p[2] + Math.sin(a) * out * 0.7];
          const end: V3 = [base[0] + Math.cos(a) * long, base[1] - long * droop, base[2] + Math.sin(a) * long];
          const sx = -Math.sin(a) * 0.045,
            sz = Math.cos(a) * 0.045;
          const m: V3 = [(base[0] + end[0]) / 2, (base[1] + end[1]) / 2 + 0.03, (base[2] + end[2]) / 2];
          blades.push(base[0], base[1], base[2], m[0] + sx, m[1], m[2] + sz, end[0], end[1], end[2], m[0] - sx, m[1], m[2] - sz);
        }
      }
    }
    {
      const n = blades.length / 12;
      const positions = new Float32Array(blades),
        normals = new Float32Array(n * 12),
        uvs = new Float32Array(n * 8),
        indices = new Uint32Array(n * 6);
      for (let i = 0; i < n; i++) {
        for (let v = 0; v < 4; v++) normals.set([0, 1, 0], (i * 4 + v) * 3);
        indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      }
      leaves.push({ positions, normals, uvs, indices });
    }
    add(culms, surface([0.33, 0.47, 0.25], 0.5));
    add(leaves, surface([0.3, 0.5, 0.24], 0.7, { doubleSided: true }), true, true);
  }

  // ---- stones: by the water, and the ones to step on ------------------------------
  {
    const stone = (seed: number, flat: number) => {
      const r = random(seed);
      const field = createZhudaSdfField([
        { kind: 'ellipsoid', center: [0, 0, 0], radii: [1, flat, 0.8] },
        { kind: 'ellipsoid', center: [0.4 * r(), 0.1, -0.3 * r()], radii: [0.6, flat * 0.9, 0.6], blend: 0.15 },
        { kind: 'ellipsoid', center: [-0.5 * r(), -0.05, 0.3 * r()], radii: [0.55, flat * 0.8, 0.5], blend: 0.15 },
      ]);
      return createZhudaIsosurfaceMesh({ distance: field.distance, min: [-1.4, -1, -1.2], max: [1.4, 1, 1.2], cellSize: 0.2 });
    };
    const shapes = [stone(1, 0.55), stone(2, 0.45), stone(3, 0.65)];
    const rocks: MeshData[] = [];
    ROCKS.forEach(([x, z, s, turn], i) => rocks.push(at(shapes[i % 3], x, Math.max(heightAt(x, z), WATER_Y - 0.1) + s * 0.12, z, turn, s)));
    const flatStone = stone(4, 0.2);
    for (const [x, z, r] of STEPS) rocks.push(at(flatStone, x, STEP_TOP - 0.16, z, x * 40, r));
    add(rocks, surface([0.56, 0.54, 0.5], 0.9));
  }

  // ---- lily pads and lotus buds on the pond ----------------------------------------
  {
    const pads: MeshData[] = [],
      buds: MeshData[] = [];
    const bud = lumps(12, 2, 1.3, 0.3, 0);
    for (let i = 0; i < 260 && pads.length < 46; i++) {
      const x = POND.center[0] + (rand() - 0.5) * POND.radii[0] * 2,
        z = POND.center[1] + (rand() - 0.5) * POND.radii[1] * 2;
      if (pondDistance(x, z) > 0.86 || STEPS.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + 0.5)) continue;
      const r = 0.28 + 0.3 * rand();
      pads.push(
        at(
          createZhudaLatheMesh({
            profile: [
              [0.001, 0],
              [r, 0],
              [r, 0.015],
              [0.001, 0.02],
            ],
            segments: 14,
          }),
          x,
          WATER_Y + 0.004,
          z,
        ),
      );
      if (rand() < 0.22) buds.push(at(bud, x + 0.1, WATER_Y + 0.16, z, rand() * 360, 0.17));
    }
    add(pads, surface([0.25, 0.5, 0.25], 0.6), false);
    add(buds, surface([0.97, 0.7, 0.8], 0.7), false);
  }

  // ---- the flagstone path -----------------------------------------------------------
  {
    const flags: MeshData[] = [];
    const lay = (line: readonly XZ[]) => {
      for (let i = 0; i < line.length; i += 1) {
        const [px, pz] = line[i];
        const [qx, qz] = line[Math.min(line.length - 1, i + 1)];
        const along = Math.hypot(qx - px, qz - pz) || 1;
        // One stone a step, to the left and the right of the middle in turn.
        for (let k = 0; k < 1; k++) {
          const side = (i % 2 ? 1 : -1) * (0.22 + 0.2 * rand());
          const x = px + (-(qz - pz) / along) * side,
            z = pz + ((qx - px) / along) * side;
          const n = 6 + Math.floor(rand() * 2),
            r = 0.3 + 0.12 * rand();
          const outline: [number, number][] = [];
          for (let a = 0; a < n; a++) {
            const th = (a / n) * Math.PI * 2;
            const rr = r * (0.8 + 0.4 * rand());
            outline.push([Math.cos(th) * rr, Math.sin(th) * rr * 0.8]);
          }
          flags.push(at(createZhudaExtrudeMesh({ outline, height: 0.09, bevel: 0.012 }), x, (groundAt(x, z) ?? 0) - 0.06, z, rand() * 360));
        }
      }
    };
    lay(PATH);
    lay(PATH2);
    add(flags, surface([0.72, 0.7, 0.66], 0.85), false);
  }

  // ---- lantern posts ------------------------------------------------------------------
  const glows: Laya.Material[] = [];
  const lamps: { at: V3; range: number }[] = [];
  const paper = surface([0.98, 0.9, 0.7], 0.6, { emission: [1, 0.72, 0.36] });
  glows.push(paper);
  {
    const posts: MeshData[] = [],
      shades: MeshData[] = [];
    const shade = createZhudaLatheMesh({
      profile: [
        [0.05, 0],
        [0.17, 0.08],
        [0.2, 0.22],
        [0.17, 0.36],
        [0.05, 0.44],
      ],
      segments: 12,
      caps: true,
    });
    for (const [x, z, deg] of LANTERNS) {
      const y = groundAt(x, z) ?? 0;
      const a = (deg * Math.PI) / 180;
      const hx = x + Math.cos(a) * 0.62,
        hz = z - Math.sin(a) * 0.62;
      posts.push(at(createZhudaBoxMesh({ width: 0.13, height: 2.7, depth: 0.13, origin: 'bottom', bevel: 0.015 }), x, y - 0.1, z, deg));
      posts.push(createZhudaRodMesh([x, y + 2.42, z], [hx, y + 2.42, hz], 0.04, 5));
      posts.push(createZhudaRodMesh([hx, y + 2.42, hz], [hx, y + 2.2, hz], 0.012, 4));
      shades.push(at(shade, hx, y + 1.78, hz));
      lamps.push({ at: [hx, y + 1.95, hz], range: 6 });
    }
    add(posts, surface([0.22, 0.15, 0.12], 0.8));
    add(shades, paper, false);
  }

  // ---- the terrace: a round stone floor with a step, lamps on posts, a ring gate ---------
  {
    const [cx, cz] = TERRACE.center,
      R = TERRACE.radius,
      top = TERRACE.height;
    const stone: MeshData[] = [];
    stone.push(
      at(
        createZhudaLatheMesh({
          profile: [
            [R + 0.9, 0],
            [R + 0.9, 0.3],
            [R + 0.45, 0.3],
            [R + 0.45, 0.6],
            [R, 0.6],
            [R, 0.9],
            [0.001, 0.9],
          ],
          segments: 40,
          caps: true,
        }),
        cx,
        top - 0.9,
        cz,
      ),
    );
    // The gate: a ring of stone standing on a plinth.
    stone.push(at(createZhudaBoxMesh({ width: 2.2, height: 0.35, depth: 0.9, origin: 'bottom', bevel: 0.04 }), cx, top, cz, 35));
    stone.push(at(createZhudaTorusMesh({ radius: 1.55, tube: 0.2, radialSegments: 10, tubularSegments: 36 }), cx, top + 1.85, cz, 35, 1, 90));
    const lampShade: MeshData[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = cx + Math.cos(a) * (R - 0.35),
        z = cz + Math.sin(a) * (R - 0.35);
      stone.push(at(createZhudaBoxMesh({ width: 0.32, height: 0.75, depth: 0.32, origin: 'bottom', bevel: 0.03 }), x, top, z, (-a * 180) / Math.PI));
      if (i % 2 === 0) {
        lampShade.push(at(createZhudaBoxMesh({ width: 0.24, height: 0.28, depth: 0.24, origin: 'bottom', bevel: 0.03 }), x, top + 0.77, z, (-a * 180) / Math.PI));
        lamps.push({ at: [x, top + 1.1, z], range: 7 });
      }
    }
    add(stone, surface([0.6, 0.6, 0.62], 0.75));
    add(lampShade, paper, false);
  }

  return {
    glows,
    lamps,
    dispose() {
      for (const o of owned.reverse()) o.dispose();
      for (const m of materials) m.destroy();
    },
  };
}
