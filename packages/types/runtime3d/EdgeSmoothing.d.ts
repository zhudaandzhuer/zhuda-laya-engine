// Generated from TypeScript source; run npm run types:generate.
export declare class ZhudaEdgeSmoothing {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, before the lens finish. */
    readonly effect: any;
    private readonly material;
    private disposed;
    constructor();
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
