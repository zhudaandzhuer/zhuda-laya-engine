// The sea: one level sheet whose surface moves. Swell and ripples bend its
// normal, the water pales toward the shore, and lines of foam run in to the
// sand and fade. Drawn by the engine's lit surface (sun, sky and fog as on
// everything else); the hook below only says what the surface is.
import { ZhudaDynamicMesh, ZhudaLitSurfaceMaterial, type MeshData } from 'zhuda-laya-engine';
import { ISLAND_RADIUS, SEA_Y } from './land.ts';

export function buildSea(scene: Laya.Scene3D) {
  const S = 900;
  const data: MeshData = {
    positions: new Float32Array([-S, SEA_Y, -S, S, SEA_Y, -S, -S, SEA_Y, S, S, SEA_Y, S]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
  };
  const surface = new ZhudaLitSurfaceMaterial({
    name: 'ZhudaGardenSea',
    material: { color: [1, 1, 1, 1], roughness: 0.12, metallic: 0 },
    uniforms: { u_ZhudaSeaTime: { type: 'float', value: 0 }, u_ZhudaSeaRadius: { type: 'float', value: ISLAND_RADIUS } },
    surface: `
      float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float seaNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), u.x), mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // Height of the water at a place: two swells crossing, and small ripples that drift.
      float seaHeight(vec2 p, float t) {
        float h = 0.5 * sin(dot(p, vec2(0.11, 0.07)) + t * 0.9) + 0.35 * sin(dot(p, vec2(-0.06, 0.16)) + t * 1.2);
        h += 0.5 * seaNoise(p * 0.55 + vec2(t * 0.35, t * 0.22)) + 0.28 * seaNoise(p * 1.7 - vec2(t * 0.5, -t * 0.3));
        return h;
      }
      void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 worldPosition, vec3 worldNormal) {
        vec2 p = worldPosition.xz;
        float t = u_ZhudaSeaTime;
        // The shore: the island's rim at this bearing, as the land has it.
        float a = atan(p.y, p.x);
        float rim = u_ZhudaSeaRadius * (1.0 + 0.09 * sin(2.0 * a + 0.6) + 0.06 * sin(3.0 * a + 2.1) + 0.035 * sin(5.0 * a + 0.9) + 0.02 * sin(9.0 * a + 1.3));
        float out_ = length(p) - rim; // metres out to sea from the shore line
        float e = 0.35;
        float h0 = seaHeight(p, t);
        vec2 slope = vec2(seaHeight(p + vec2(e, 0.0), t) - h0, seaHeight(p + vec2(0.0, e), t) - h0) / e;
        // Calmer far off, where ripples would only shimmer.
        float calm = 1.0 / (1.0 + max(out_, 0.0) * 0.012);
        s.normalTS = normalize(vec3(-slope * 0.7 * calm, 1.0));
        // Colour: pale over the sand, turquoise in the shallows, deep blue beyond.
        vec3 deep = vec3(0.012, 0.11, 0.2), mid = vec3(0.02, 0.3, 0.36), pale = vec3(0.28, 0.62, 0.6);
        vec3 c = mix(pale, mid, smoothstep(-1.0, 7.0, out_));
        c = mix(c, deep, smoothstep(6.0, 34.0, out_));
        c *= 1.0 + 0.22 * h0 * calm;
        // Foam: lines that travel to the shore, broken up, strongest in the last metres; and the wash on the sand.
        float breakup = seaNoise(p * 0.35 + vec2(t * 0.1, 0.0));
        float run = out_ * 1.25 + t * 1.3 + breakup * 2.4;
        float line = smoothstep(0.82, 0.97, sin(run)) * smoothstep(13.0, 0.3, out_) * smoothstep(-0.9, 0.2, out_);
        float lace = smoothstep(0.55, 0.85, seaNoise(p * 2.6 + vec2(t * 0.6, -t * 0.4))) * smoothstep(3.5, -0.3, out_) * 0.6;
        float wash = smoothstep(0.35, -0.25 - 0.3 * sin(t * 0.9 + breakup * 6.0), out_) * 0.75;
        float foam = clamp(line + lace * (0.4 + 0.6 * line) + wash, 0.0, 1.0);
        s.baseColor = mix(c, vec3(0.95), foam);
        s.roughness = mix(0.1, 0.7, foam);
      }`,
  });
  const mesh = new ZhudaDynamicMesh(data, scene);
  const r = (mesh.node as Laya.MeshSprite3D).meshRenderer;
  r.sharedMaterial = surface.material;
  r.castShadow = false;
  r.receiveShadow = true;
  return {
    setTime: (seconds: number) => surface.set('u_ZhudaSeaTime', seconds % 3600),
    dispose() {
      mesh.dispose();
      surface.material.destroy();
    },
  };
}
