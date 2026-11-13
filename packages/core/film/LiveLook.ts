/**
 * Internal: updates a look that is already on a scene, without rebuilding it.
 * Shared by `ZhudaFilmStage.setLook` and `ZhudaSceneLook.setLook`. Only the
 * values that `zhudaFilmLookRebuildReason` accepts as continuous are touched;
 * nothing here allocates a GPU resource except the small hemisphere ambient,
 * which is replaced only when its colours change.
 */
import { zhudaDecodeColor } from './ColorValues.ts';
import {
  applyZhudaHemisphereAmbient,
  type ZhudaHemisphereAmbientHandle,
} from '../runtime3d/EnvironmentProbe.ts';
import type { ZhudaFilmicPipeline } from '../runtime3d/Filmic.ts';
import type { ZhudaLightFog } from '../runtime3d/LightFog.ts';
import type { ZhudaScreenReflections } from '../runtime3d/ScreenReflections.ts';
import type { ZhudaLensFinish } from '../runtime3d/LensFinish.ts';
import type {
  ZhudaAutoExposure,
  ZhudaDepthOfField,
  ZhudaMotionBlur,
} from '../runtime3d/CameraEffects.ts';
import type { ZhudaFilmVec3, ZhudaResolvedFilmLook } from './FilmScene.ts';

/** What `applyResolvedFilmLook` built, kept so a later look can adjust it in place. */
export interface ZhudaAppliedLookParts {
  lightFog?: ZhudaLightFog;
  reflections?: ZhudaScreenReflections;
  exposure?: ZhudaAutoExposure;
  depthOfField?: ZhudaDepthOfField;
  motionBlur?: ZhudaMotionBlur;
  sky?: any;
  film?: ZhudaFilmicPipeline;
  finish?: ZhudaLensFinish;
}

/** Unit vector from the scene toward the light (the light travels along its forward axis). */
export function zhudaTowardSun(l: any, sun: any): [number, number, number] {
  const travel = new l.Vector3();
  sun.owner.transform.getForward(travel);
  const length = Math.hypot(travel.x, travel.y, travel.z) || 1;
  return [-travel.x / length, -travel.y / length, -travel.z / length];
}

/** Linear sun colour times intensity, as water and light shafts take it. */
/** The sun's light for shaders of this engine (beams in the fog, the glint on water). */
export const zhudaSunRadiance = (look: ZhudaResolvedFilmLook): [number, number, number] => {
  const colour = zhudaDecodeColor(look.sun.color);
  return [
    colour[0] * look.sun.intensity,
    colour[1] * look.sun.intensity,
    colour[2] * look.sun.intensity,
  ];
};

const same = (a: readonly number[] | false, b: readonly number[] | false) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));

/** Sky and ground light; its texture is made once and recoloured in place. */
export class ZhudaHemisphereAmbientSlot {
  private restore: ZhudaHemisphereAmbientHandle | undefined;
  private colours: [ZhudaFilmVec3, ZhudaFilmVec3] | undefined;
  private readonly scene3D: any;
  constructor(scene3D: any) {
    this.scene3D = scene3D;
  }
  set(ambient: ZhudaFilmVec3, ground: ZhudaFilmVec3 | false): void {
    if (!ground) return this.release();
    if (this.colours && same(this.colours[0], ambient) && same(this.colours[1], ground)) return;
    // Display values, like the flat ambient they replace: decoded here, since
    // the hemisphere is made by this engine and not handed to LayaAir as a colour.
    const sky = zhudaDecodeColor(ambient),
      below = zhudaDecodeColor(ground);
    if (this.restore) {
      this.restore.update(sky, below);
      this.colours = [[...ambient], [...ground]];
      return;
    }
    // Release first so the new one remembers the scene's own environment, not
    // a texture that is about to be destroyed. Both run before the next draw.
    this.release();
    this.restore = applyZhudaHemisphereAmbient(this.scene3D, sky, below);
    this.colours = [[...ambient], [...ground]];
  }
  release(): void {
    const restore = this.restore;
    this.restore = undefined;
    this.colours = undefined;
    restore?.();
  }
}

/**
 * Applies the continuous parts of `look` to what is already built. The caller
 * has checked with `zhudaFilmLookRebuildReason` that nothing structural differs.
 */
export function updateZhudaLookInPlace(
  l: any,
  target: { scene3D: any; camera: any; sun: any; parts: ZhudaAppliedLookParts },
  look: ZhudaResolvedFilmLook,
): void {
  const { scene3D, camera, sun, parts } = target;
  sun.owner.transform.rotationEuler = new l.Vector3(-look.sun.elevationDeg, look.sun.azimuthDeg, 0);
  sun.intensity = look.sun.intensity;
  sun.color = new l.Color(...look.sun.color, 1);
  scene3D.ambientColor = new l.Color(...look.ambient, 1);
  camera.clearColor = new l.Color(...look.sky, 1);
  if (look.shadows) {
    sun.shadowMode = look.shadows.softness === 'hard' ? l.ShadowMode.Hard : l.ShadowMode.SoftHigh;
    sun.shadowDistance = look.shadows.distance;
    sun.shadowResolution = look.shadows.resolution;
    sun.shadowStrength = look.shadows.strength;
    sun.shadowCascadesMode =
      look.shadows.cascades === 4
        ? l.ShadowCascadesMode.FourCascades
        : look.shadows.cascades === 1
          ? l.ShadowCascadesMode.NoCascades
          : l.ShadowCascadesMode.TwoCascades;
  }
  if (parts.sky && look.atmosphere) {
    const sky = parts.sky;
    sky.sunSize = look.atmosphere.sunSize;
    sky.atmosphereThickness = look.atmosphere.thickness;
    sky.skyTint = new l.Color(...look.atmosphere.skyTint, 1);
    sky.groundTint = new l.Color(...look.atmosphere.groundTint, 1);
    sky.exposure = look.atmosphere.exposure;
  }
  if (look.fog) {
    scene3D.fogColor = new l.Color(...look.fog.color, 1);
    scene3D.fogStart = look.fog.start;
    scene3D.fogEnd = look.fog.end;
  }
  if (parts.film && look.grade) {
    parts.film.setGrade({
      exposure: look.grade.exposure,
      contrast: look.grade.contrast,
      saturation: look.grade.saturation,
      bloomIntensity: look.grade.bloom,
      aoIntensity: look.grade.ao,
      aoRadius: look.grade.aoRadius,
    });
    parts.film.setAntialias(look.grade.antialias === 'msaa');
  }
  if (parts.finish && look.grade)
    parts.finish.setFinish({
      grain: look.grade.grain,
      vignette: look.grade.vignette,
      fringe: look.grade.fringe,
    });
  if (parts.reflections && look.screenReflections)
    parts.reflections.setReflections(look.screenReflections);
  if (parts.exposure && look.autoExposure) parts.exposure.setExposure(look.autoExposure);
  if (parts.depthOfField && look.depthOfField) parts.depthOfField.setLens(look.depthOfField);
  if (parts.motionBlur && look.motionBlur) parts.motionBlur.setBlur(look.motionBlur);
  if (parts.lightFog && look.lightFog) {
    const { shafts, ...plain } = look.lightFog;
    parts.lightFog.setEdgeSmoothing(!!look.grade && look.grade.antialias === 'msaa');
    parts.lightFog.setFog({
      ...plain,
      color: zhudaDecodeColor(plain.color),
      ...(shafts ? { shafts: { strength: shafts.strength, anisotropy: shafts.anisotropy } } : {}),
    });
  }
  if (parts.lightFog && look.lightFog && look.lightFog.shafts)
    parts.lightFog.attachSun(scene3D, {
      toward: zhudaTowardSun(l, sun),
      color: zhudaSunRadiance(look),
    });
}
