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
import type { ZhudaLightFog } from '../runtime3d/LightFog.ts';
import {
  parseZhudaFilmScene,
  resolveZhudaFilmLook,
  zhudaFilmLookRebuildReason,
  type ZhudaFilmLook,
  type ZhudaResolvedFilmLook,
} from './FilmScene.ts';
import { applyResolvedFilmLook } from './FilmStage.ts';
import {
  ZhudaHemisphereAmbientSlot,
  updateZhudaLookInPlace,
  zhudaTowardSun,
  type ZhudaAppliedLookParts,
} from './LiveLook.ts';
import { zhudaLookForQuality, type ZhudaLookQuality } from './LookQuality.ts';
import {
  ZhudaRenderScale,
  zhudaRenderScaleOptions,
  type ZhudaRenderScaleOptions,
  type ZhudaUpscale,
} from '../runtime3d/RenderScale.ts';
import type { ZhudaQualityStep } from '../runtime3d/QualityGovernor.ts';

export interface ZhudaSceneLookOptions extends ZhudaRenderScaleOptions {
  /** Quality level to start at (default 3, the look as authored). */
  quality?: ZhudaLookQuality;
  /**
   * Size the 3D picture is drawn at against the canvas, 0.5..1 (default 1),
   * brought up to it by `upscale` with `sharpness` (see `ZhudaRenderScale`).
   * Below 1 the look holds the stage's one render scale.
   */
  scale?: number;
}

export class ZhudaSceneLook {
  /** The directional light of the look (`look.sun`). */
  readonly sun: any;
  private look: ZhudaResolvedFilmLook;
  private parts: ZhudaAppliedLookParts = {};
  private readonly sunNode: any;
  private cleanups: (() => void)[] = [];
  private lightFog: ZhudaLightFog | undefined;
  /** How long the clouds have drifted, in seconds. */
  private cloudSeconds = 0;
  private level: ZhudaLookQuality;
  private frame = 0;
  private disposed = false;
  private readonly hemisphere: ZhudaHemisphereAmbientSlot;
  /** The render scale, made when the picture is first drawn below full size. */
  private renderScale: ZhudaRenderScale | undefined;
  private scaling: Required<ZhudaRenderScaleOptions>;

  private readonly scene3D: any;
  private readonly camera: any;

  constructor(scene3D: any, camera: any, look: ZhudaFilmLook, options: ZhudaSceneLookOptions = {}) {
    this.scene3D = scene3D;
    this.camera = camera;
    this.scaling = zhudaRenderScaleOptions(options);
    if (options.quality !== undefined && ![0, 1, 2, 3].includes(options.quality))
      throw Error('Look quality: use 0, 1, 2 or 3');
    this.look = resolveZhudaFilmLook(look);
    if (this.look.panorama) throw Error('Scene look: a panorama sky is not supported here');
    if (this.look.environment)
      throw Error('Scene look: an environment probe is not supported here');
    if (this.look.bounceLight)
      throw Error(
        'Scene look: bounceLight is for film scenes; in a game bake a ZhudaProbeVolume over the level',
      );
    this.level = options.quality ?? 3;
    const l = (globalThis as any).Laya;
    const made = Zhuda3D.createDirectionalLight(scene3D, {
      rotationEuler: [-this.look.sun.elevationDeg, this.look.sun.azimuthDeg, 0],
      intensity: this.look.sun.intensity,
      color: [...this.look.sun.color, 1] as [number, number, number, number],
    });
    this.sun = made.light;
    this.sunNode = made.node;
    this.hemisphere = new ZhudaHemisphereAmbientSlot(scene3D);
    try {
      // Sky and ground light is the same at every quality level: it is set up
      // apart from the rest, so changing the level never destroys a texture a
      // frame still uses.
      if (this.look.ambientGround) this.scene3D.ambientColor = new l.Color(...this.look.ambient, 1);
      this.hemisphere.set(this.look.ambient, this.look.ambientGround);
      this.apply(l);
      this.scaleTo(this.scaling);
    } catch (error) {
      this.release();
      this.renderScale?.dispose();
      this.hemisphere.release();
      this.sunNode.destroy(true);
      throw error;
    }
  }

  get quality(): ZhudaLookQuality {
    return this.level;
  }

  /** Size of the 3D picture against the canvas (1 is full size). */
  get scale(): number {
    return this.scaling.scale;
  }

  /** How a picture drawn smaller reaches the canvas. */
  get upscale(): ZhudaUpscale {
    return this.scaling.upscale;
  }

  /**
   * Draws the 3D picture at `scale` of the canvas from the next frame,
   * 0.5..1, cheap enough to change at any time (nothing is rebuilt); the
   * upscale and sharpness can change with it. Below 1 the look holds the
   * stage's one render scale (`ZhudaRenderScale`): a second look that does
   * so is refused.
   */
  setRenderScale(scale: number, options: Omit<ZhudaRenderScaleOptions, 'scale'> = {}): void {
    if (this.disposed) throw Error('Disposed scene look');
    this.scaleTo(zhudaRenderScaleOptions({ ...this.scaling, ...options, scale }));
  }

  /**
   * Moves to a rung of a quality ladder (`zhudaQualitySteps`): its look
   * level and its render scale.
   */
  setStep(step: ZhudaQualityStep): void {
    if (this.disposed) throw Error('Disposed scene look');
    if (!step || typeof step !== 'object')
      throw Error('Quality step: { look, renderScale } required');
    const scaling = zhudaRenderScaleOptions({ ...this.scaling, scale: step.renderScale });
    this.setQuality(step.look);
    this.scaleTo(scaling);
  }

  /**
   * Draws the sun's shadow maps on the next frame, for a look whose
   * `shadows.update` is 'interval' or 'manual' (a caster moved, the camera
   * went elsewhere, the game turned `sun` itself instead of through
   * `setLook`). Nothing to do when they are drawn every frame.
   */
  redrawShadows(): void {
    if (this.disposed) throw Error('Disposed scene look');
    this.parts.shadowUpdates?.redraw();
  }

  /**
   * While `shadows.update` keeps the shadow maps: the frames drawn with
   * shadows on since the look's shadows were last rebuilt, how many of them
   * drew the maps, and how many of those only because another camera had
   * drawn maps of its own since (see `ZhudaShadowUpdates.stats`). `taken`
   * rising with `frames` means nothing is saved. Undefined while the maps
   * are drawn every frame.
   */
  get shadowStats(): { frames: number; drawn: number; taken: number } | undefined {
    return this.parts.shadowUpdates?.stats;
  }

  /** Unit vector from the scene toward the sun, for water and other surfaces that glint. */
  get towardSun(): [number, number, number] {
    return zhudaTowardSun((globalThis as any).Laya, this.sun);
  }

  /**
   * Changes the look while the game runs (a day passing, weather turning),
   * at the current quality level. A rejected look changes nothing. When only
   * continuous values differ (see `zhudaFilmLookRebuildReason`) they are set
   * in place, cheap enough for every frame, and `'updated'` is returned;
   * otherwise the look is rebuilt and `'rebuilt'` is returned. A panorama or
   * environment probe is refused, as in the constructor.
   */
  setLook(look: ZhudaFilmLook): 'updated' | 'rebuilt' {
    if (this.disposed) throw Error('Disposed scene look');
    const parsed = parseZhudaFilmScene({
      schemaVersion: 1,
      id: 'scene-look',
      camera: { eye: [0, 0, 1], target: [0, 0, 0] },
      look,
      nodes: [],
    });
    const next = resolveZhudaFilmLook(parsed.look);
    if (next.panorama) throw Error('Scene look: a panorama sky is not supported here');
    if (next.environment) throw Error('Scene look: an environment probe is not supported here');
    const l = (globalThis as any).Laya;
    const effective = zhudaLookForQuality(next, this.level);
    const reason = zhudaFilmLookRebuildReason(
      zhudaLookForQuality(this.look, this.level),
      effective,
    );
    const previous = this.look;
    this.look = next;
    if (reason === null) this.updateInPlace(l, effective);
    else {
      this.release();
      try {
        this.apply(l);
      } catch (error) {
        this.release();
        this.look = previous;
        this.apply(l);
        throw error;
      }
    }
    this.hemisphere.set(next.ambient, next.ambientGround);
    return reason === null ? 'updated' : 'rebuilt';
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

  /**
   * Call every frame after the camera has moved. `frameSeconds` is the time
   * since the frame before (default 1/60): how far automatic exposure adapts.
   */
  update(
    eye: readonly [number, number, number],
    target: readonly [number, number, number],
    fieldOfViewDeg: number,
    aspect: number,
    frameSeconds = 1 / 60,
  ): void {
    if (this.disposed) throw Error('Disposed scene look');
    this.parts?.reflections?.update(eye, target, fieldOfViewDeg, aspect);
    this.parts?.motionBlur?.update(eye, target, fieldOfViewDeg, aspect);
    this.parts?.exposure?.setFrameSeconds(frameSeconds);
    if (this.parts?.clouds) {
      this.cloudSeconds += frameSeconds;
      this.parts.clouds.setTime(this.cloudSeconds);
      this.parts.clouds.update(eye, target, fieldOfViewDeg, aspect);
    }
    if (!this.lightFog) return;
    this.lightFog.setFrame(this.frame++ % 1024);
    this.lightFog.update(eye, target, fieldOfViewDeg, aspect);
    this.lightFog.renderShafts();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.renderScale?.dispose();
    this.renderScale = undefined;
    this.hemisphere.release();
    this.sunNode.destroy(true);
  }

  /** At full size the stage's render scale is given back; below it is taken (once). */
  private scaleTo(scaling: Required<ZhudaRenderScaleOptions>): void {
    if (scaling.scale === 1) {
      this.renderScale?.dispose();
      this.renderScale = undefined;
    } else if (this.renderScale) this.renderScale.set(scaling);
    else this.renderScale = new ZhudaRenderScale(this.scene3D, scaling);
    this.scaling = scaling;
  }

  private updateInPlace(l: any, look: ZhudaResolvedFilmLook): void {
    updateZhudaLookInPlace(
      l,
      { scene3D: this.scene3D, camera: this.camera, sun: this.sun, parts: this.parts },
      look,
    );
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
    this.parts = applyResolvedFilmLook(l, this.scene3D, this.camera, this.sun, look, cleanups);
    this.lightFog = this.parts.lightFog;
    // Still scenery: the depth picture of the light is redrawn only when the camera has moved on.
    this.lightFog?.setShaftRefresh('moved');
    // The sun, its shadows and the shaft sun follow the look (also after `setLook`).
    this.updateInPlace(l, look);
  }

  private release(): void {
    this.lightFog = undefined;
    this.parts = {};
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
  }
}
