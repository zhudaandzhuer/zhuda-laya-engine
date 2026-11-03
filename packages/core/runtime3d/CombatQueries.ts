export interface ZhudaCombatRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZhudaCombatBoxDefinition {
  id: string;
  ownerId: string;
  layer: number;
  rect: ZhudaCombatRect;
  enabled?: boolean;
  /** Consumer adapter for a bone/socket or procedural pose. */
  sampleRect?: () => ZhudaCombatRect;
}

export interface ZhudaHitboxDefinition extends ZhudaCombatBoxDefinition {
  mask: number;
  swingId: string | number;
  activeFrom?: number;
  activeUntil?: number;
}

export interface ZhudaCombatHit {
  hitboxId: string;
  swingId: string | number;
  attackerId: string;
  hurtboxId: string;
  targetId: string;
  attackRect: ZhudaCombatRect;
  hurtRect: ZhudaCombatRect;
}

interface CombatBox extends ZhudaCombatBoxDefinition {
  rect: ZhudaCombatRect;
}

function validateRect(rect: ZhudaCombatRect): ZhudaCombatRect {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))
    throw Error("Combat rectangles must be finite");
  if (rect.width < 0 || rect.height < 0) throw Error("Combat rectangle size must be non-negative");
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function validateLayer(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff)
    throw Error(`Invalid ${name} layer`);
  return value >>> 0;
}

function overlap(a: ZhudaCombatRect, b: ZhudaCombatRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Deterministic 2D hitbox/hurtbox candidate queries; damage remains consumer-owned. */
export class ZhudaCombatWorld {
  private hurtboxes = new Map<string, CombatBox>();
  private hitboxes = new Map<string, ZhudaHitboxDefinition>();
  private hitTargets = new Map<string, Set<string>>();
  private disposed = false;

  registerHurtbox(definition: ZhudaCombatBoxDefinition): () => boolean {
    if (this.disposed) throw Error("Disposed combat world");
    this.validateBox(definition);
    if (this.hurtboxes.has(definition.id)) throw Error(`Duplicate hurtbox: ${definition.id}`);
    this.hurtboxes.set(definition.id, { ...definition, rect: validateRect(definition.rect) });
    return () => this.hurtboxes.delete(definition.id);
  }

  registerHitbox(definition: ZhudaHitboxDefinition): () => boolean {
    if (this.disposed) throw Error("Disposed combat world");
    this.validateBox(definition);
    if (!definition.swingId && definition.swingId !== 0) throw Error("Hitbox swingId is required");
    if (!Number.isFinite(definition.activeFrom ?? 0) || !Number.isFinite(definition.activeUntil ?? 0))
      throw Error("Invalid hitbox active window");
    if (definition.activeFrom !== undefined && definition.activeUntil !== undefined && definition.activeUntil < definition.activeFrom)
      throw Error("Hitbox active window is reversed");
    if (this.hitboxes.has(definition.id)) throw Error(`Duplicate hitbox: ${definition.id}`);
    this.hitboxes.set(definition.id, { ...definition, rect: validateRect(definition.rect), mask: validateLayer("hitbox mask", definition.mask) });
    return () => {
      this.clearHitboxSwing(definition.id);
      return this.hitboxes.delete(definition.id);
    };
  }

  private validateBox(definition: ZhudaCombatBoxDefinition): void {
    if (!definition?.id || !definition.ownerId) throw Error("Combat box needs id and ownerId");
    validateLayer("box", definition.layer);
    validateRect(definition.rect);
    if (definition.sampleRect && typeof definition.sampleRect !== "function") throw Error("Invalid combat rect sampler");
  }

  updateHurtbox(id: string, patch: Partial<Pick<ZhudaCombatBoxDefinition, "rect" | "layer" | "enabled" | "sampleRect">>): boolean {
    const box = this.hurtboxes.get(id);
    if (!box) return false;
    if (patch.rect) box.rect = validateRect(patch.rect);
    if (patch.layer !== undefined) box.layer = validateLayer("box", patch.layer);
    if (patch.enabled !== undefined) box.enabled = patch.enabled;
    if (patch.sampleRect !== undefined) box.sampleRect = patch.sampleRect;
    return true;
  }

  updateHitbox(id: string, patch: Partial<Pick<ZhudaHitboxDefinition, "rect" | "layer" | "mask" | "enabled" | "sampleRect" | "swingId" | "activeFrom" | "activeUntil">>): boolean {
    const box = this.hitboxes.get(id);
    if (!box) return false;
    const rect = patch.rect ? validateRect(patch.rect) : box.rect;
    const layer = patch.layer === undefined ? box.layer : validateLayer("box", patch.layer);
    const mask = patch.mask === undefined ? box.mask : validateLayer("hitbox mask", patch.mask);
    if (patch.sampleRect !== undefined && typeof patch.sampleRect !== "function") throw Error("Invalid combat rect sampler");
    const swingId = patch.swingId === undefined ? box.swingId : patch.swingId;
    if (!swingId && swingId !== 0) throw Error("Hitbox swingId is required");
    const activeFrom = patch.activeFrom === undefined ? box.activeFrom : patch.activeFrom;
    const activeUntil = patch.activeUntil === undefined ? box.activeUntil : patch.activeUntil;
    if ((activeFrom !== undefined && !Number.isFinite(activeFrom)) || (activeUntil !== undefined && !Number.isFinite(activeUntil)))
      throw Error("Invalid hitbox active window");
    if (activeFrom !== undefined && activeUntil !== undefined && activeUntil < activeFrom)
      throw Error("Hitbox active window is reversed");
    if (patch.swingId !== undefined && String(patch.swingId) !== String(box.swingId)) this.clearHitboxSwing(id);
    Object.assign(box, {
      rect, layer, mask, swingId, activeFrom, activeUntil,
      ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
      ...(patch.sampleRect === undefined ? {} : { sampleRect: patch.sampleRect }),
    });
    return true;
  }

  queryHitbox(id: string, time: number): ZhudaCombatHit[] {
    if (!Number.isFinite(time)) throw Error("Combat query time must be finite");
    const hitbox = this.hitboxes.get(id);
    if (!hitbox || hitbox.enabled === false ||
      (hitbox.activeFrom !== undefined && time < hitbox.activeFrom) ||
      (hitbox.activeUntil !== undefined && time >= hitbox.activeUntil)) return [];
    const attackRect = validateRect(hitbox.sampleRect?.() ?? hitbox.rect);
    const swingKey = `${hitbox.id}\0${String(hitbox.swingId)}`;
    let seen = this.hitTargets.get(swingKey);
    if (!seen) this.hitTargets.set(swingKey, (seen = new Set()));
    const result: ZhudaCombatHit[] = [];
    for (const hurtbox of this.hurtboxes.values()) {
      if (hurtbox.enabled === false || !((hurtbox.layer >>> 0) & hitbox.mask)) continue;
      const hurtRect = validateRect(hurtbox.sampleRect?.() ?? hurtbox.rect);
      if (!overlap(attackRect, hurtRect) || seen.has(hurtbox.id)) continue;
      seen.add(hurtbox.id);
      result.push({
        hitboxId: hitbox.id,
        swingId: hitbox.swingId,
        attackerId: hitbox.ownerId,
        hurtboxId: hurtbox.id,
        targetId: hurtbox.ownerId,
        attackRect,
        hurtRect,
      });
    }
    return result;
  }

  queryAll(time: number): ZhudaCombatHit[] {
    const result: ZhudaCombatHit[] = [];
    for (const id of this.hitboxes.keys()) result.push(...this.queryHitbox(id, time));
    return result;
  }

  clearHitboxSwing(hitboxId: string, swingId?: string | number): number {
    const prefix = `${hitboxId}\0`;
    let removed = 0;
    for (const key of [...this.hitTargets.keys()]) {
      if (key.startsWith(prefix) && (swingId === undefined || key === `${prefix}${String(swingId)}`)) {
        this.hitTargets.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.hurtboxes.clear();
    this.hitboxes.clear();
    this.hitTargets.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  get hurtboxCount(): number { return this.hurtboxes.size; }
  get hitboxCount(): number { return this.hitboxes.size; }
}
