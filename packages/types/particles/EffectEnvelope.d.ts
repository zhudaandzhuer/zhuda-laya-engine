// Generated from TypeScript source; run npm run types:generate.
export type EffectPhase = 'idle' | 'attack' | 'sustain' | 'release';
/** Generic attack/sustain/release envelope. Stopping releases the effect without clearing live particles. */
export declare class ZhudaEffectEnvelope {
    phase: EffectPhase;
    value: number;
    private target;
    private from;
    private elapsed;
    readonly attack: number;
    readonly release: number;
    constructor(attack?: number, release?: number);
    start(strength?: number): void;
    setStrength(strength: number): void;
    stop(): void;
    reset(): void;
    update(dt: number): number;
}
