/**
 * A Spine 4.2 character on LayaAir's Spine2DRenderNode, set up the way that was found to work when a game
 * changes the skeleton by hand (grabbing cloth, pulling a layer, swapping attachments):
 *
 * - Spine physics on: the node's `physicsUpdate` defaults to 0 (none), so PhysicsConstraints never step.
 * - The slow render path (`useFastRender = false`, no cache): the fast one draws from caches and does not
 *   show bones moved or attachments set by the game.
 * - Straight alpha by default (zhuda-spine2D exports `pma:false`), set again after the templet is applied:
 *   LayaAir switches to premultiplied, and its `templet.checkPremultipliedAlpha()` reported true for a
 *   `pma:false` atlas, so it is not trusted.
 * - Places in the art's pixels: the node draws the skeleton's bounds (its JSON `skeleton.x/y/width/height`)
 *   with their top-left corner at the node's origin, and moves the skeleton itself (`skeleton.x/y`), so a
 *   bone's world position has that subtracted. This class converts between the skeleton's space (y up)
 *   and the art's canvas (pixels, y down, origin at the bounds' top-left), which is how rigs made with
 *   zhuda-spine2D place everything.
 *
 * Drive it from the runtime's frame callback: call `update()` once a frame. It makes no clock of its own.
 */

/** The skeleton's bounds as its JSON gives them (Spine units, y up): `skeleton.x/y/width/height`. */
export interface ZhudaSpineBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZhudaSpineCharacterOptions {
  /** A Laya.Sprite (or Scene) the character is added to. */
  parent: { addChild(child: any): any };
  /** A loaded Laya.SpineTemplet: `await Laya.loader.load(url, Laya.Loader.SPINE)`. */
  templet: any;
  /** The animation to play on track 0 (default: none). */
  animation?: string;
  /** Loop it (default true). */
  loop?: boolean;
  /** Step Spine 4.2 physics (default true; LayaAir's own default is off). */
  physics?: boolean;
  /** Premultiplied alpha (default false: straight, as zhuda-spine2D exports). Set true only for a `pma:true` atlas. */
  premultipliedAlpha?: boolean;
}

export interface ZhudaSpineDiagnostics {
  physicsUpdate: number;
  useFastRender: boolean;
  premultipliedAlpha: boolean;
  /** Where LayaAir has moved the skeleton (subtracted from bone world positions). */
  skeletonOffset: [number, number];
  bounds: ZhudaSpineBounds;
  bones: number;
  slots: number;
  ikConstraints: number;
  physicsConstraints: number;
}

/** Spine's PhysicsConstraint update mode `update` (spine.Physics.update). */
export const ZHUDA_SPINE_PHYSICS_UPDATE = 2;

/** A point of the skeleton's space (y up) on the art's canvas (pixels, y down, origin at the bounds' top-left). */
export function zhudaSpineToCanvas(
  bounds: ZhudaSpineBounds,
  x: number,
  y: number,
): [number, number] {
  return [x - bounds.x, bounds.y + bounds.height - y];
}

/** A point of the art's canvas in the skeleton's space. */
export function zhudaSpineFromCanvas(
  bounds: ZhudaSpineBounds,
  cx: number,
  cy: number,
): [number, number] {
  return [cx + bounds.x, bounds.y + bounds.height - cy];
}

const finite = (name: string, ...values: number[]) => {
  for (const v of values)
    if (!Number.isFinite(v))
      throw new Error(`ZhudaSpineCharacter: ${name} must be finite numbers.`);
};

export class ZhudaSpineCharacter {
  /** The Laya.Sprite holding the renderer; its local space is the art's canvas. */
  public readonly node: any;
  /** The Laya.Spine2DRenderNode. */
  public readonly renderer: any;
  /** The spine-core Skeleton (the web runtime exposes it). */
  public readonly skeleton: any;
  public readonly bounds: ZhudaSpineBounds;
  private readonly pma: boolean;
  private readonly physics: boolean;
  private disposed = false;

  public constructor(options: ZhudaSpineCharacterOptions) {
    if (!options?.parent) throw new Error('ZhudaSpineCharacter requires a parent Sprite.');
    if (!options.templet) throw new Error('ZhudaSpineCharacter requires a loaded Spine templet.');
    const L = (globalThis as typeof globalThis & { Laya?: any }).Laya;
    if (!L?.Sprite || !L?.Spine2DRenderNode)
      throw new Error('Laya.Spine2DRenderNode is unavailable: build with the spine42 feature.');
    this.physics = options.physics ?? true;
    this.pma = options.premultipliedAlpha ?? false;
    this.node = new L.Sprite();
    options.parent.addChild(this.node);
    this.renderer = this.node.addComponent(L.Spine2DRenderNode);
    this.renderer.useFastRender = false;
    this.renderer.enableCache = false;
    this.renderer.physicsUpdate = this.physics ? ZHUDA_SPINE_PHYSICS_UPDATE : 0;
    this.renderer.templet = options.templet;
    this.renderer.setPremultipliedAlpha(this.pma);
    if (options.animation) this.renderer.play(options.animation, options.loop ?? true);
    this.skeleton = this.renderer.getSkeleton?.();
    if (!this.skeleton) {
      this.dispose();
      throw new Error(
        'ZhudaSpineCharacter: the renderer exposes no skeleton (the web runtime is needed).',
      );
    }
    const data = this.skeleton.data ?? {};
    this.bounds = {
      x: +data.x || 0,
      y: +data.y || 0,
      width: +data.width || 0,
      height: +data.height || 0,
    };
  }

  /** Once a frame: keeps the settings LayaAir may reset after the templet is applied. */
  public update(): void {
    if (this.disposed) return;
    if (this.renderer.premultipliedAlpha !== this.pma)
      this.renderer.setPremultipliedAlpha(this.pma);
    if (this.renderer.useFastRender) this.renderer.useFastRender = false;
    const want = this.physics ? ZHUDA_SPINE_PHYSICS_UPDATE : 0;
    if (this.renderer.physicsUpdate !== want) this.renderer.physicsUpdate = want;
  }

  /** A point of the stage (Laya.stage pixels) on the art's canvas. */
  public stageToCanvas(x: number, y: number): [number, number] {
    finite('stageToCanvas', x, y);
    const L = (globalThis as typeof globalThis & { Laya?: any }).Laya;
    const p = this.node.globalToLocal(new L.Point(x, y));
    return [p.x, p.y];
  }

  /** A point along a bone (`along` from its start, in its length's units; default its start), on the canvas. */
  public boneCanvas(name: string, along = 0): [number, number] {
    finite('boneCanvas', along);
    const bone = this.bone(name);
    const v = { x: along, y: 0 };
    bone.localToWorld(v);
    return zhudaSpineToCanvas(this.bounds, v.x - this.offsetX, v.y - this.offsetY);
  }

  /** The far end of a bone (start + its length), on the canvas: the tip of a chain's last link. */
  public boneTipCanvas(name: string): [number, number] {
    return this.boneCanvas(name, this.bone(name).data?.length ?? 0);
  }

  /** Puts a bone's start at a point of the canvas (through its parent's world transform). */
  public moveBoneTo(name: string, cx: number, cy: number): void {
    finite('moveBoneTo', cx, cy);
    const bone = this.bone(name);
    const [sx, sy] = zhudaSpineFromCanvas(this.bounds, cx, cy);
    const world = { x: sx + this.offsetX, y: sy + this.offsetY };
    if (bone.parent) bone.parent.worldToLocal(world);
    bone.x = world.x;
    bone.y = world.y;
  }

  /** Moves a bone from its setup place by (dx, dy) canvas pixels (y down), in its parent's axes. */
  public nudgeBone(name: string, dx: number, dy: number): void {
    finite('nudgeBone', dx, dy);
    const bone = this.bone(name);
    let lx = dx,
      ly = -dy;
    if (bone.parent) {
      const a = { x: 0, y: 0 },
        b = { x: dx, y: -dy };
      bone.parent.worldToLocal(a);
      bone.parent.worldToLocal(b);
      lx = b.x - a.x;
      ly = b.y - a.y;
    }
    bone.x = bone.data.x + lx;
    bone.y = bone.data.y + ly;
  }

  /** An IK constraint's mix (0 lets go, 1 follows its target). */
  public setIkMix(name: string, mix: number): void {
    finite('setIkMix', mix);
    const ik = this.skeleton.findIkConstraint?.(name);
    if (!ik) throw new Error(`ZhudaSpineCharacter: no IK constraint "${name}".`);
    ik.mix = Math.min(1, Math.max(0, mix));
  }

  /** Shows an attachment in a slot, or empties it (null). Unknown names are refused by name. */
  public setAttachment(slot: string, attachment: string | null): void {
    const s = this.skeleton.findSlot?.(slot);
    if (!s) throw new Error(`ZhudaSpineCharacter: no slot "${slot}".`);
    if (
      attachment !== null &&
      typeof this.skeleton.getAttachmentByName === 'function' &&
      !this.skeleton.getAttachmentByName(slot, attachment)
    )
      throw new Error(`ZhudaSpineCharacter: slot "${slot}" has no attachment "${attachment}".`);
    this.skeleton.setAttachment(slot, attachment);
  }

  public diagnostics(): ZhudaSpineDiagnostics {
    const sk = this.skeleton;
    return {
      physicsUpdate: this.renderer.physicsUpdate,
      useFastRender: !!this.renderer.useFastRender,
      premultipliedAlpha: !!this.renderer.premultipliedAlpha,
      skeletonOffset: [this.offsetX, this.offsetY],
      bounds: { ...this.bounds },
      bones: sk.bones?.length ?? 0,
      slots: sk.slots?.length ?? 0,
      ikConstraints: sk.ikConstraints?.length ?? 0,
      physicsConstraints: sk.physicsConstraints?.length ?? 0,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.node.destroy?.(true);
  }

  private get offsetX(): number {
    return +this.skeleton.x || 0;
  }
  private get offsetY(): number {
    return +this.skeleton.y || 0;
  }
  private bone(name: string): any {
    if (this.disposed) throw new Error('ZhudaSpineCharacter is disposed.');
    const bone = this.skeleton.findBone?.(name);
    if (!bone) throw new Error(`ZhudaSpineCharacter: no bone "${name}".`);
    return bone;
  }
}
