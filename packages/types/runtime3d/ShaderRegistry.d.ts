// Generated from TypeScript source; run npm run types:generate.
/** For the engine's effect modules: keeps `register` for `registerZhudaEffectShaders`. */
export declare function zhudaShaderRegistrar(register: (runtime: any) => void): void;
/**
 * Registers the shaders of every effect of the engine that this runtime can
 * hold (one whose Laya module is not loaded is left out), without making any
 * effect. Each is registered once however often this is called. Returns how
 * many registrations ran without throwing.
 */
export declare function registerZhudaEffectShaders(runtime?: any): number;
