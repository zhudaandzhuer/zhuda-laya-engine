// Five named UI layers a slot mounts into, bottom to top, so features (regulatory bars,
// promo widgets, overlays, dialogs) plug in without knowing each other.
// Split from <original-cascade-slot>/client/src/renderer/MountSlotManager.ts (unchanged
// except typing). Needs the engine (Laya.Sprite).

export type UIMountSlot = 'TOP_REGULATORY_BAR' | 'BOTTOM_CONTROL_DECK' | 'SIDE_PROMO_WIDGET' | 'CENTER_STAGE_OVERLAY' | 'MODAL_POPUP_LAYER';

export const SLOT_ORDER: UIMountSlot[] = ['TOP_REGULATORY_BAR', 'BOTTOM_CONTROL_DECK', 'SIDE_PROMO_WIDGET', 'CENTER_STAGE_OVERLAY', 'MODAL_POPUP_LAYER'];

/** A feature that puts itself into one slot. */
export interface FrontendFeaturePlug {
  plugId: string;
  targetSlot: UIMountSlot;
  mount(slot: Laya.Sprite): void;
  unmount?(): void;
}

export class MountSlotManager {
  readonly root = new Laya.Sprite();
  readonly slots = {} as Record<UIMountSlot, Laya.Sprite>;
  private mounted: FrontendFeaturePlug[] = [];

  constructor(parent: Laya.Sprite) {
    this.root.name = 'MountSlotRoot';
    parent.addChild(this.root);
    SLOT_ORDER.forEach((name, i) => {
      const s = new Laya.Sprite();
      s.name = name;
      s.zOrder = 100 + i * 100;
      this.root.addChild(s);
      this.slots[name] = s;
    });
  }

  getSlot(name: UIMountSlot): Laya.Sprite {
    return this.slots[name];
  }

  mountPlug(plug: FrontendFeaturePlug): void {
    plug.mount(this.slots[plug.targetSlot]);
    this.mounted.push(plug);
  }

  unmountAll(): void {
    for (const p of this.mounted.splice(0)) p.unmount?.();
  }

  getMountedPlugIds(): string[] {
    return this.mounted.map((p) => p.plugId);
  }
}
