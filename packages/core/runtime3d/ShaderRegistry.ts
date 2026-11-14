/**
 * The engine's effects register their shader the first time one of them is
 * made (a look that never smooths edges never registers that shader). A
 * shader that is not registered cannot be compiled ahead of its first draw,
 * so each effect also leaves its registration here, and a warm-up runs them
 * all when it meets a name it does not know. Material shaders named by a
 * consumer's own spec are not here: they are registered when the material is
 * made.
 */
const registrars: ((runtime: any) => void)[] = [];

/** For the engine's effect modules: keeps `register` for `registerZhudaEffectShaders`. */
export function zhudaShaderRegistrar(register: (runtime: any) => void): void {
  registrars.push(register);
}

/**
 * Registers the shaders of every effect of the engine that this runtime can
 * hold (one whose Laya module is not loaded is left out), without making any
 * effect. Each is registered once however often this is called. Returns how
 * many registrations ran without throwing.
 */
export function registerZhudaEffectShaders(runtime: any = (globalThis as any).Laya): number {
  if (typeof runtime?.Shader3D?.add !== 'function') return 0;
  let done = 0;
  for (const register of registrars)
    try {
      register(runtime);
      done++;
    } catch {
      // A module this runtime was built without: its effect cannot be made either.
    }
  return done;
}
