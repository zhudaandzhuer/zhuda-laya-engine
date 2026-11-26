// The hour and the weather, turned into a look for ZhudaSceneLook.
// Every look has the same keys, so changing the hour or the weather only
// updates values in place (the look is not rebuilt).
//
// One day cycle (keyframes, sun path, rain, storm, mist, lightning) shared by
// the island scenes. What differs between places is the `DaySetting`: how far
// shadows and fog reach and what cloud there is. CLOUD_SEA is the floating
// island's (a sea of cloud below a 17 m island); OCEAN is the garden island's
// (fair-weather cloud over open sea, a 100 m island). Both are the values those
// games shipped with.
import type { ZhudaFilmLook } from 'zhuda-laya-engine';
import { clamp, lerp, smooth } from './math.ts';

export type Weather = 'clear' | 'rain' | 'storm' | 'mist';
export const WEATHERS: Record<Weather, string> = { clear: '晴', rain: '雨', storm: '雷雨', mist: '霧' };

type C = [number, number, number];
const mix = (a: C, b: C, t: number): C => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Keyframes over the day: hour, sky, sun colour, sun intensity, ambient, ground light, fog, exposure. */
const KEYS: [number, C, C, number, C, C, C, number][] = [
  [0, [0.04, 0.06, 0.13], [0.55, 0.66, 1.0], 0.35, [0.1, 0.13, 0.24], [0.06, 0.07, 0.11], [0.07, 0.09, 0.17], 1.35],
  [4.8, [0.06, 0.08, 0.17], [0.55, 0.66, 1.0], 0.3, [0.12, 0.14, 0.25], [0.05, 0.05, 0.07], [0.09, 0.1, 0.19], 1.35],
  [6.0, [0.86, 0.6, 0.52], [1.0, 0.58, 0.32], 1.3, [0.5, 0.44, 0.5], [0.45, 0.36, 0.34], [0.86, 0.66, 0.58], 1.15],
  [8.0, [0.62, 0.74, 0.9], [1.0, 0.86, 0.68], 2.2, [0.58, 0.64, 0.78], [0.5, 0.5, 0.5], [0.78, 0.82, 0.88], 1.1],
  [12.5, [0.55, 0.72, 0.94], [1.0, 0.96, 0.88], 2.7, [0.62, 0.7, 0.86], [0.55, 0.56, 0.56], [0.74, 0.83, 0.93], 1.05],
  [16.5, [0.64, 0.72, 0.86], [1.0, 0.84, 0.62], 2.3, [0.6, 0.62, 0.74], [0.52, 0.5, 0.48], [0.8, 0.8, 0.84], 1.1],
  [18.2, [0.98, 0.56, 0.36], [1.0, 0.48, 0.22], 1.5, [0.55, 0.42, 0.45], [0.5, 0.34, 0.28], [0.95, 0.62, 0.48], 1.2],
  [19.4, [0.3, 0.24, 0.45], [0.75, 0.5, 0.6], 0.5, [0.22, 0.2, 0.34], [0.07, 0.06, 0.08], [0.28, 0.22, 0.36], 1.3],
  [20.5, [0.05, 0.07, 0.15], [0.55, 0.66, 1.0], 0.35, [0.11, 0.14, 0.25], [0.04, 0.05, 0.07], [0.07, 0.09, 0.17], 1.35],
  [24, [0.04, 0.06, 0.13], [0.55, 0.66, 1.0], 0.35, [0.1, 0.13, 0.24], [0.04, 0.05, 0.07], [0.07, 0.09, 0.17], 1.35],
];

export interface SkyState {
  look: ZhudaFilmLook;
  /** 0 day .. 1 deep night. */
  night: number;
  /** 0..1 how much sun reaches the ground. */
  sun: number;
  rain: number;
  wind: number;
  /** Fog colour, for things drawn outside the look (the cloud sea). */
  fog: C;
}

/** Weather amounts (0..1), eased by the game toward the chosen weather. */
export interface WeatherMix {
  rain: number;
  storm: number;
  mist: number;
}

/** What a place changes about the day: how far shadows and haze reach, and the cloud. */
export interface DaySetting {
  id: string;
  shadows: (grey: number, mist: number) => { distance: number; cascades: 1 | 2 | 4; strength: number };
  fog: (grey: number, mist: number) => { start: number; end: number };
  /** The light fog gathers only this far (metres), so far cloud, stars and sky stay clear. */
  lightFogMaxDistance: number;
  clouds: (grey: number, storm: number) => Exclude<ZhudaFilmLook['clouds'], false | undefined>;
}

/** A small island above a sea of cloud (the engine's cloud slab, entered from above). */
export const CLOUD_SEA: DaySetting = {
  id: 'cloud-sea',
  shadows: (grey, mist) => ({ distance: 28, cascades: 2, strength: clamp(1 - grey * 0.55 - mist * 0.3, 0.2, 1) }),
  fog: (grey, mist) => ({ start: lerp(70, 6, mist) - grey * 20, end: lerp(900, 60, mist) - grey * 500 }),
  lightFogMaxDistance: 70,
  clouds: (grey, storm) => ({ coverage: 0.5 + grey * 0.3, baseMeters: -90, thicknessMeters: 55, sizeMeters: 420, wind: [3 + 6 * storm, 1.2], steps: 24, density: 0.9 + grey * 0.5, distanceMeters: 2500 }),
};

/** An island in open sea, fair-weather cloud overhead. */
export const OCEAN: DaySetting = {
  id: 'ocean',
  shadows: (grey, mist) => ({ distance: 55, cascades: 4, strength: clamp(0.78 - grey * 0.4 - mist * 0.25, 0.2, 1) }),
  fog: (grey, mist) => ({ start: lerp(90, 8, mist) - grey * 20, end: lerp(1400, 80, mist) - grey * 500 }),
  lightFogMaxDistance: 140,
  clouds: (grey, storm) => ({ coverage: 0.42 + grey * 0.4, baseMeters: 900, thicknessMeters: 600, sizeMeters: 2400, wind: [6 + 6 * storm, 1.5], steps: 24, density: 0.8 + grey * 0.5 }),
};

export function skyAt(hour: number, w: WeatherMix, focus: number, flash: number, fStop = 2.4, off: readonly string[] = [], setting: DaySetting = CLOUD_SEA): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, sky0, sun0, si0, amb0, gr0, fog0, ex0] = KEYS[i];
  const [h1, sky1, sun1, si1, amb1, gr1, fog1, ex1] = KEYS[i + 1];
  const t = smooth(0, 1, (h - h0) / Math.max(0.001, h1 - h0));
  const wet = clamp(w.rain + w.storm, 0, 1);
  const grey = clamp(wet * 0.85 + w.storm * 0.15, 0, 1);
  const overcast: C = [0.5, 0.54, 0.6];
  let sky = mix(mix(sky0, sky1, t), mix(overcast, [0.3, 0.33, 0.4], w.storm), grey * 0.75);
  let fog = mix(mix(fog0, fog1, t), mix([0.58, 0.62, 0.68], [0.36, 0.38, 0.44], w.storm), grey * 0.7);
  fog = mix(fog, [0.82, 0.84, 0.86], w.mist * 0.6);
  const nightness = 1 - smooth(5.2, 6.6, h) + smooth(18.8, 20.2, h);
  const night = clamp(nightness, 0, 1);
  sky = mix(sky, [sky[0] * 0.5, sky[1] * 0.5, sky[2] * 0.6], night * grey * 0.6);
  fog = mix(fog, [fog[0] * 0.35, fog[1] * 0.38, fog[2] * 0.5], night * grey * 0.8);
  const sunColour = mix(sun0, sun1, t);
  const sunPower = lerp(si0, si1, t) * (1 - 0.78 * grey) * (1 - 0.35 * w.mist);
  // The sun from the east in the morning, overhead at noon, west at dusk; the moon opposite at night.
  const day = clamp((h - 6) / 12, 0, 1);
  const azimuth = night > 0.5 ? 200 : 100 + 150 * day;
  const elevation = night > 0.5 ? 38 : Math.max(6, 62 * Math.sin(Math.PI * day));
  let ambient = mix(mix(amb0, amb1, t), [0.55, 0.58, 0.64], grey * 0.5);
  ambient = mix(ambient, [ambient[0] * 0.6, ambient[1] * 0.62, ambient[2] * 0.7], night * grey);
  const lightning = flash;
  if (lightning > 0) {
    sky = mix(sky, [0.85, 0.9, 1.0], lightning * 0.8);
    ambient = mix(ambient, [0.95, 0.97, 1.0], lightning);
  }
  const exposure = lerp(ex0, ex1, t) + grey * 0.12;
  // The sky's own light: day, the low sun's reds, night, and grey under rain.
  type Atmo = [number, C, C, number, number];
  // Below the horizon: the far land under the cloud sea, or the sea's own blue, blue with distance.
  const DAY: Atmo = [1, [0.5, 0.5, 0.5], [0.3, 0.36, 0.46], 1.3, 0.04];
  const LOW: Atmo = [2.0, [0.55, 0.45, 0.45], [0.3, 0.25, 0.22], 1.15, 0.05];
  const NIGHT: Atmo = [0.6, [0.1, 0.13, 0.26], [0.04, 0.05, 0.08], 0.1, 0.02];
  const GREY: Atmo = [1.4, [0.55, 0.55, 0.58], [0.4, 0.4, 0.42], 0.95, 0];
  const mixA = (a: Atmo, b: Atmo, k: number): Atmo => [lerp(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k), lerp(a[3], b[3], k), lerp(a[4], b[4], k)];
  const low = Math.max(Math.exp(-(((h - 6.3) / 1.1) ** 2)), Math.exp(-(((h - 18.2) / 1.1) ** 2)));
  let atmo = mixA(DAY, LOW, low);
  atmo = mixA(atmo, NIGHT, night);
  atmo = mixA(atmo, [GREY[0], GREY[1], GREY[2], GREY[3] * (1 - 0.85 * night), 0], grey * 0.8);
  const mist = w.mist;
  const shadow = setting.shadows(grey, mist),
    fogReach = setting.fog(grey, mist);
  const look: ZhudaFilmLook = {
    preset: 'day',
    sky,
    atmosphere: { thickness: atmo[0], skyTint: atmo[1], groundTint: atmo[2], exposure: atmo[3] * (1 + lightning * 3), sunSize: atmo[4] },
    ambient,
    ambientGround: mix(mix(gr0, gr1, t), [0.18, 0.19, 0.17], grey * 0.5),
    sun: { azimuthDeg: azimuth, elevationDeg: elevation, intensity: sunPower, color: sunColour },
    shadows: { distance: shadow.distance, resolution: 4096, cascades: shadow.cascades, softness: 'soft', strength: shadow.strength },
    fog: { color: fog, start: fogReach.start, end: fogReach.end },
    grade: {
      exposure,
      contrast: 1.06 - grey * 0.04,
      saturation: 1.12 - grey * 0.22 - night * 0.15,
      bloom: 0.32 + night * 0.18,
      ao: off.includes('ao') ? 0 : 0.75,
      ...(off.includes('msaa') ? { antialias: 'fxaa' as const } : {}),
      aoRadius: 0.6,
      vignette: 0.32,
      grain: 0.08,
    },
    lightFog: off.includes('fog') ? false : {
      // Thin haze round the island, thicker with distance; its colour is the hour's.
      density: 0.0045 + mist * 0.05 + grey * 0.008,
      falloffMeters: 40 + mist * 10,
      baseY: 0,
      color: fog,
      scatter: 0.6,
      // gathered only near the island: far cloud and the stars stay clear
      maxDistance: setting.lightFogMaxDistance,
      shafts: { strength: off.includes('shafts') ? 0 : (1 - grey) * (1 - night) * 1.4, anisotropy: 0.7, distance: 40, steps: 32 },
    },
    clouds: off.includes('clouds') ? false : setting.clouds(grey, w.storm),
    screenReflections: off.includes('ssr') ? false : { wetness: wet * 0.7, strength: off.includes('ssr') ? 0 : 0.6 },
    autoExposure: off.includes('exposure') ? false : { strength: 0.25, min: 0.75, max: 1.5, speed: 1.2 },
    motionBlur: { shutter: off.includes('blur') ? 0 : 0.3, maxLength: 0.02 },
    depthOfField: { focusDistanceM: focus, fStop, focalLengthMm: 50 },
    lensFlare: off.includes('flare') ? false : { strength: (1 - grey) * (1 - night) * 0.6 },
  };
  return { look, night, sun: (1 - grey) * (1 - night), rain: wet, wind: Math.min(1, 0.3 + wet * 0.4 + w.storm * 0.3), fog };
}

export function clockText(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
}
