// Generated from TypeScript source; run npm run types:generate.
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
/** Deterministic 2D hitbox/hurtbox candidate queries; damage remains consumer-owned. */
export declare class ZhudaCombatWorld {
    private hurtboxes;
    private hitboxes;
    private hitTargets;
    private disposed;
    registerHurtbox(definition: ZhudaCombatBoxDefinition): () => boolean;
    registerHitbox(definition: ZhudaHitboxDefinition): () => boolean;
    private validateBox;
    updateHurtbox(id: string, patch: Partial<Pick<ZhudaCombatBoxDefinition, 'rect' | 'layer' | 'enabled' | 'sampleRect'>>): boolean;
    updateHitbox(id: string, patch: Partial<Pick<ZhudaHitboxDefinition, 'rect' | 'layer' | 'mask' | 'enabled' | 'sampleRect' | 'swingId' | 'activeFrom' | 'activeUntil'>>): boolean;
    queryHitbox(id: string, time: number): ZhudaCombatHit[];
    queryAll(time: number): ZhudaCombatHit[];
    clearHitboxSwing(hitboxId: string, swingId?: string | number): number;
    clear(): void;
    dispose(): void;
    get hurtboxCount(): number;
    get hitboxCount(): number;
}
