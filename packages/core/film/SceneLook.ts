/**
 * The look of a film scene on a game Scene: the sun and its shadows, sky and
 * ground light, sky, distance fog, ground fog with beams of sunlight, and
 * the HDR grade. A game gives it its own `Scene3D` and camera and calls
 * `update` every frame; `setQuality` trades parts of the look for speed.
 *
 * A panorama sky and an environment probe need assets or a capture and are
 * not applied here; a look that names them is refused.
 */
import { Zhuda3D } from '../DeclarativeSDK.ts';
import { applyZhudaHemisphereAmbient } from '../runtime3d/EnvironmentProbe.ts';
import type { ZhudaLightFog } from '../runtime3d/LightFog.ts';
import {
  resolveZhudaFilmLook,
  type ZhudaFilmLook,
  type ZhudaResolvedFilmLook,
} from './FilmScene.ts';
import { applyResolvedFilmLook } from './FilmStage.ts';
import { zhudaLookForQuality, type ZhudaLookQuality } from './LookQuality.ts';

export class ZhudaSceneLook {
  /** The directional light of the look (`look.sun`). */
  readonly sun: any;
  private readonly look: ZhudaResolvedFilmLook;
  private readonly sunNode: any;
  private cleanups: (() => void)[] = [];
  private lightFog: ZhudaLightFog | undefined;
  private level: ZhudaLookQuality;
  private frame = 0;
  private disposed = false;
  private restoreAmbient: (() => void) | undefined;

  private readonly scene3D: any;
  private readonly camera: any;

  constructor(
    scene3D: any,
    camera: any,
    look: ZhudaFilmLook,
    options: { quality?: ZhudaLookQuality } = {},
  ) {
    this.scene3D = scene3D;
    this.camera = camera;
    this.look = resolveZhudaFilmLook(look);
    if (this.look.panorama) throw Error('Scene look: a panorama sky is not supported here');
    if (this.look.environment)
      throw Error('Scene look: an environment probe is not supported here');
    this.level = options.quality ?? 3;
    const l = (globalThis as any).Laya;
    const made = Zhuda3D.createDirectionalLight(scene3D, {
      rotationEuler: [-this.look.sun.elevationDeg, this.look.sun.azimuthDeg, 0],
      intensity: this.look.sun.intensity,
      color: [...this.look.sun.color, 1] as [number, number, number, number],
    });
    this.sun = made.light;
    this.sunNode = made.node;
    try {
      // Sky and ground light is the same at every quality level: it is set up
      // once, so changing the level never destroys a texture a frame still uses.
      if (this.look.ambientGround) {
        this.scene3D.ambientColor = new l.Color(...this.look.ambient, 1);
        this.restoreAmbient = applyZhudaHemisphereAmbient(
          this.scene3D,
          this.look.ambient,
          this.look.ambientGround,
        );
      }
      this.apply(l);
    } catch (error) {
      this.release();
      this.restoreAmbient?.();
      this.sunNode.destroy(true);
      throw error;
    }
  }

  get quality(): ZhudaLookQuality {
    return this.level;
  }

  /** Unit vector from the scene toward the sun, for water and other surfaces that glint. */
  get towardSun(): [number, number, number] {
    const l = (globalThis as any).Laya;
    const travel = new l.Vector3();
    this.sunNode.transform.getForward(travel);
    const length = Math.hypot(travel.x, travel.y, travel.z) || 1;
    return [-travel.x / length, -travel.y / length, -travel.z / length];
  }

  /** Rebuilds the look at another level; nothing happens when it is the current one. */
  setQuality(level: ZhudaLookQuality): void {
    if (this.disposed) throw Error('Disposed scene look');
    if (![0, 1, 2, 3].includes(level)) throw Error('Look quality: use 0, 1, 2 or 3');
    if (level === this.level) return;
    this.level = level;
    this.release();
    this.apply((globalThis as any).Laya);
  }

  /** Call every frame after the camera has moved. */
  update(
    eye: readonly [number, number, number],
    target: readonly [number, number, number],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed scene look');
    if (!this.lightFog) return;
    this.lightFog.setFrame(this.frame++ % 1024);
    this.lightFog.update(eye, target, fieldOfViewDeg, aspect);
    this.lightFog.renderShafts();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.restoreAmbient?.();
    this.sunNode.destroy(true);
  }

  private apply(l: any): void {
    const look = zhudaLookForQuality(this.look, this.level);
    const cleanups = this.cleanups;
    const before = {
      ambient: this.scene3D.ambientColor,
      clearFlag: this.camera.clearFlag,
      clearColor: this.camera.clearColor,
    };
    this.scene3D.ambientColor = new l.Color(...look.ambient, 1);
    this.camera.clearColor = new l.Color(...look.sky, 1);
    cleanups.push(() => {
      this.scene3D.ambientColor = before.ambient;
      this.camera.clearFlag = before.clearFlag;
      this.camera.clearColor = before.clearColor;
    });
    this.lightFog = applyResolvedFilmLook(
      l,
      this.scene3D,
      this.camera,
      this.sun,
      look,
      cleanups,
    ).lightFog;
    // Still scenery: the depth picture of the light is redrawn only when the camera has moved on.
    this.lightFog?.setShaftRefresh('moved');
  }

  private release(): void {
    this.lightFog = undefined;
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
  }
}
