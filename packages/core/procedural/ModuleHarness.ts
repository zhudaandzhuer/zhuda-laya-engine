/**
 * Boot contract for games assembled from independent modules.
 *
 * Each module can be created, shown alone in an isolated showcase, and
 * replaced by a stub when it fails, so one broken system does not hide the
 * rest from review. URL parameters make every run reproducible.
 */
export interface ZhudaRunParams {
  /** `?seed=`; defaults to 1. */
  seed: number;
  /** `?show=<module>`: build up to that module and run only its showcase. */
  show?: string;
  /** `?dt=<seconds>`: fixed simulation step for repeatable captures. */
  fixedDt?: number;
  /** `?shot=1`: still capture; consumers should disable adaptive quality. */
  shot: boolean;
  /** `?bench=1` or `#bench`. */
  bench: boolean;
  /** Every parameter as written. */
  raw: Record<string, string>;
}

export function parseZhudaRunParams(search = '', hash = ''): ZhudaRunParams {
  const raw: Record<string, string> = {};
  // forEach, not for…of: URLSearchParams iteration needs lib DOM.Iterable,
  // which consumers on TypeScript 5.x may not enable.
  new URLSearchParams(search).forEach((value, key) => {
    raw[key] = value;
  });
  const seed = raw.seed === undefined ? 1 : Number(raw.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0x7fffffff)
    throw Error('seed must be a non-negative integer');
  let fixedDt: number | undefined;
  if (raw.dt !== undefined) {
    fixedDt = Number(raw.dt);
    if (!Number.isFinite(fixedDt) || fixedDt <= 0 || fixedDt > 1)
      throw Error('dt must be a step in seconds above 0 and at most 1');
  }
  const on = (value: string | undefined) =>
    value !== undefined && value !== '0' && value !== 'false';
  return {
    seed,
    show: raw.show || undefined,
    fixedDt,
    shot: on(raw.shot),
    bench: on(raw.bench) || hash === '#bench',
    raw,
  };
}

export interface ZhudaGameModule<C> {
  create(context: C): unknown | Promise<unknown>;
  /** Isolated scene that proves this module alone; runs after create(). */
  showcase?(context: C): unknown | Promise<unknown>;
  /** Minimal stand-in used when create() throws. */
  stub?(context: C): unknown;
  /** A required module has no fallback: its failure stops the boot. */
  required?: boolean;
}

export interface ZhudaBootReport {
  modules: Record<string, 'ready' | 'stub' | 'skipped'>;
  errors: Array<{ module: string; message: string }>;
  ms: Record<string, number>;
  showcase?: string;
  showcaseResult?: unknown;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Creates modules in declaration order and stores each result on
 * `context[name]`. With `show`, modules after the named one are skipped and
 * its showcase runs last.
 */
export async function bootZhudaModules<C extends Record<string, unknown>>(
  context: C,
  modules: Record<string, ZhudaGameModule<C>>,
  options: {
    show?: string;
    onProgress?: (module: string, index: number, total: number) => void;
  } = {},
): Promise<ZhudaBootReport> {
  const names = Object.keys(modules),
    report: ZhudaBootReport = { modules: {}, errors: [], ms: {} };
  if (options.show !== undefined) {
    const target = modules[options.show];
    if (!target || typeof target.showcase !== 'function')
      throw Error(
        `Unknown showcase "${options.show}". Available: ${
          names.filter((name) => typeof modules[name].showcase === 'function').join(', ') || 'none'
        }`,
      );
  }
  const last = options.show === undefined ? names.length - 1 : names.indexOf(options.show);
  for (let index = 0; index < names.length; index++) {
    const name = names[index],
      module = modules[name];
    if (index > last) {
      report.modules[name] = 'skipped';
      continue;
    }
    options.onProgress?.(name, index, names.length);
    const started = now();
    try {
      (context as Record<string, unknown>)[name] = await module.create(context);
      report.modules[name] = 'ready';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push({ module: name, message });
      if (module.required || typeof module.stub !== 'function')
        throw Error(`Module "${name}" failed and has no stub: ${message}`);
      (context as Record<string, unknown>)[name] = module.stub(context);
      report.modules[name] = 'stub';
    }
    report.ms[name] = now() - started;
  }
  if (options.show !== undefined) {
    report.showcase = options.show;
    report.showcaseResult = await modules[options.show].showcase!(context);
  }
  return report;
}
