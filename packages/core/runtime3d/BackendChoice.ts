/**
 * Which backend a page starts: WebGPU where the browser has a real adapter,
 * WebGL elsewhere.
 *
 * A realm holds one backend. LayaAir's libraries for the two cannot be
 * loaded together, and a realm that started WebGPU cannot start anything
 * again. So nothing falls back after the fact: the page asks the browser
 * first and then loads the libraries of one backend only. `ZhudaLoader` is
 * this file as a script of its own, loaded before either bundle
 * (`zhuda-loader.js` of the browser SDK; `"renderer": "auto"` of a consumer
 * build puts it into the page).
 *
 * Nothing here needs LayaAir or the rest of the engine.
 */

export type ZhudaBackendName = 'webgl' | 'webgpu';

/** What a page found out about its browser before choosing. */
export interface ZhudaBackendFacts {
  /** `isSecureContext`: browsers have WebGPU on HTTPS and localhost only. */
  secure: boolean;
  /** `navigator.gpu` is there. */
  api: boolean;
  /**
   * What `navigator.gpu.requestAdapter()` gave: a hardware adapter, one that
   * draws on the CPU, none, an error, or no answer in time. Not read when
   * `secure` or `api` is false.
   */
  adapter: 'hardware' | 'software' | 'none' | 'error' | 'timeout';
  /** The error's message, with `adapter: 'error'`. */
  message?: string;
}

export interface ZhudaBackendOptions {
  /**
   * `'webgpu'` (default, also for `undefined`): WebGPU where it can run,
   * WebGL elsewhere. `'webgl'`: WebGL without asking the browser, for a
   * game whose own settings say so.
   */
  prefer?: ZhudaBackendName;
  /**
   * Take an adapter that draws on the CPU for WebGPU (default false: WebGL
   * on the same machine is the faster of the two).
   */
  allowSoftware?: boolean;
}

export interface ZhudaBackendChoice {
  backend: ZhudaBackendName;
  /**
   * Why the page is on WebGL although WebGPU was preferred; `null` when it
   * is on WebGPU, or on WebGL because that was preferred. One of
   * `ZHUDA_FALLBACK_REASONS`, with a detail after `': '` for `retry`,
   * `adapter-error` and `bundle-failed`.
   */
  fallbackReason: string | null;
}

/** The reasons a choice can carry, before any detail. */
export const ZHUDA_FALLBACK_REASONS = Object.freeze([
  /** The page before this one loaded WebGPU and it did not start (`ZhudaLoader.retry`). */
  'retry',
  'insecure-context',
  'no-webgpu-api',
  'no-adapter',
  'software-adapter',
  'adapter-error',
  'adapter-timeout',
  /** The WebGPU bundle did not load (network, integrity); nothing of it ran. */
  'bundle-failed',
] as const);

const clip = (text: unknown) => String(text).replace(/\s+/g, ' ').trim().slice(0, 160);

/**
 * The decision, with nothing asked of the browser: the same facts give the
 * same answer. `retry` is the reason carried over from a page that loaded
 * WebGPU and failed to start it.
 */
export function chooseZhudaBackend(
  facts: ZhudaBackendFacts | null,
  options: ZhudaBackendOptions = {},
  retry?: string | null,
): ZhudaBackendChoice {
  const prefer = options?.prefer ?? 'webgpu';
  if (prefer !== 'webgl' && prefer !== 'webgpu')
    throw Error("Invalid backend choice: prefer is 'webgpu' or 'webgl'");
  if (options?.allowSoftware !== undefined && typeof options.allowSoftware !== 'boolean')
    throw Error('Invalid backend choice: allowSoftware is true or false');
  const webgl = (fallbackReason: string | null): ZhudaBackendChoice => ({
    backend: 'webgl',
    fallbackReason,
  });
  if (prefer === 'webgl') return webgl(null);
  if (retry) return webgl('retry: ' + clip(retry));
  if (!facts || typeof facts !== 'object')
    throw Error('Invalid backend choice: what the browser has is required');
  if (!facts.secure) return webgl('insecure-context');
  if (!facts.api) return webgl('no-webgpu-api');
  switch (facts.adapter) {
    case 'hardware':
      return { backend: 'webgpu', fallbackReason: null };
    case 'software':
      return options?.allowSoftware
        ? { backend: 'webgpu', fallbackReason: null }
        : webgl('software-adapter');
    case 'none':
      return webgl('no-adapter');
    case 'timeout':
      return webgl('adapter-timeout');
    case 'error':
      return webgl('adapter-error' + (facts.message ? ': ' + clip(facts.message) : ''));
    default:
      throw Error('Invalid backend choice: adapter is hardware, software, none, error or timeout');
  }
}

/** What the adapter said about itself, where the browser tells. */
export interface ZhudaBackendAdapter {
  vendor: string;
  architecture: string;
  isFallbackAdapter: boolean;
}

/**
 * Asks the browser: is this a secure page, is there `navigator.gpu`, and
 * what adapter does it give within `timeoutMs` (100..30000, default 3000).
 * Never rejects; makes no device.
 */
export async function probeZhudaBackend(
  env: any = globalThis,
  timeoutMs = 3000,
): Promise<{ facts: ZhudaBackendFacts; adapter: ZhudaBackendAdapter | null }> {
  if (!(Number.isFinite(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 30000))
    throw Error('Invalid backend choice: timeoutMs is 100..30000');
  const secure = env?.isSecureContext !== false;
  const gpu = env?.navigator?.gpu;
  const facts: ZhudaBackendFacts = { secure, api: !!gpu, adapter: 'none' };
  if (!secure || !gpu || typeof gpu.requestAdapter !== 'function') return { facts, adapter: null };
  const late = {};
  const wait = typeof env.setTimeout === 'function' ? env.setTimeout.bind(env) : setTimeout;
  const stop = typeof env.clearTimeout === 'function' ? env.clearTimeout.bind(env) : clearTimeout;
  let timer: any;
  try {
    const found = await Promise.race([
      Promise.resolve().then(() => gpu.requestAdapter()),
      new Promise((resolve) => (timer = wait(() => resolve(late), timeoutMs))),
    ]);
    if (found === late) return { facts: { ...facts, adapter: 'timeout' }, adapter: null };
    if (!found) return { facts, adapter: null };
    const info = (found as any).info ?? {};
    const software = !!(info.isFallbackAdapter ?? (found as any).isFallbackAdapter);
    return {
      facts: { ...facts, adapter: software ? 'software' : 'hardware' },
      adapter: {
        vendor: String(info.vendor ?? ''),
        architecture: String(info.architecture ?? ''),
        isFallbackAdapter: software,
      },
    };
  } catch (error) {
    return {
      facts: { ...facts, adapter: 'error', message: clip((error as Error)?.message ?? error) },
      adapter: null,
    };
  } finally {
    stop(timer);
  }
}

/** A script to load: its address, and the integrity the browser is to hold it to. */
export interface ZhudaScriptRef {
  src: string;
  integrity?: string;
}

export interface ZhudaLoaderOptions extends ZhudaBackendOptions {
  /** The scripts of the WebGPU build, in the order they run. */
  webgpu: readonly (string | ZhudaScriptRef)[];
  /** The scripts of the WebGL build, in the order they run. */
  webgl: readonly (string | ZhudaScriptRef)[];
  /**
   * What runs after the backend, whichever it is: the game's own scripts,
   * in order. A function is called in its place.
   */
  after?: readonly (string | ZhudaScriptRef | (() => void))[];
  /** How long the browser has to answer about its adapter, 100..30000 ms (default 3000). */
  timeoutMs?: number;
}

/** What the loader did; also `globalThis.ZhudaBackend` once the backend's scripts have run. */
export interface ZhudaBackendRecord extends ZhudaBackendChoice {
  /** What the browser had; `null` when it was not asked (WebGL preferred, or a retry). */
  facts: ZhudaBackendFacts | null;
  adapter: ZhudaBackendAdapter | null;
  /** Milliseconds the browser took to answer about its adapter. */
  probeMs: number;
}

/** Where a retry's reason waits for the page's next load. */
export const ZHUDA_BACKEND_RETRY_KEY = 'zhuda-backend-retry';

function refs(list: unknown, name: string, functions = false): (ZhudaScriptRef | (() => void))[] {
  if (!Array.isArray(list)) throw Error(`Invalid loader: ${name} is a list of scripts`);
  return list.map((item) => {
    if (functions && typeof item === 'function') return item as () => void;
    const ref = typeof item === 'string' ? { src: item } : item;
    if (
      !ref ||
      typeof ref.src !== 'string' ||
      !ref.src ||
      (ref.integrity !== undefined && typeof ref.integrity !== 'string')
    )
      throw Error(`Invalid loader: ${name} holds addresses, or {src, integrity}`);
    return { src: ref.src, ...(ref.integrity ? { integrity: ref.integrity } : {}) };
  });
}

/**
 * Asks the browser, chooses, and loads the scripts of one backend, then
 * `after`. Scripts run one after another in the order given; the browser is
 * told about all of them at once, so they download together.
 *
 * If the first WebGPU script does not load, nothing of WebGPU has run and
 * the WebGL scripts are loaded in its place (`bundle-failed`). If a later
 * one fails, the realm holds half a backend: the promise rejects with
 * `code: 'ZHUDA_LOADER_PARTIAL'`, and `retryZhudaBackend` loads the page
 * again on WebGL.
 *
 * One call a page. `globalThis.ZhudaBackend` holds the record from the
 * moment the backend's scripts have run, before `after`.
 */
export async function loadZhudaBackend(
  options: ZhudaLoaderOptions,
  env: any = globalThis,
): Promise<ZhudaBackendRecord> {
  if (!options || typeof options !== 'object') throw Error('Invalid loader: options are required');
  const lists = {
    webgpu: refs(options.webgpu, 'webgpu') as ZhudaScriptRef[],
    webgl: refs(options.webgl, 'webgl') as ZhudaScriptRef[],
  };
  if (!lists.webgpu.length || !lists.webgl.length)
    throw Error('Invalid loader: webgpu and webgl each need a script');
  const after = refs(options.after ?? [], 'after', true);
  const prefer = options.prefer ?? 'webgpu';
  // Checks the options before anything is asked or loaded.
  chooseZhudaBackend({ secure: true, api: true, adapter: 'none' }, options);
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!(Number.isFinite(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 30000))
    throw Error('Invalid loader: timeoutMs is 100..30000');
  if (env.__ZHUDA_BACKEND_TRIED__ || env.ZhudaBackend || env.Laya || env.Zhuda)
    throw Error(
      'ZHUDA_DUPLICATE_RUNTIME: one backend a page; the loader runs once, before any bundle',
    );
  env.__ZHUDA_BACKEND_TRIED__ = 'asking';
  const doc = env.document;
  if (!doc?.createElement) throw Error('Invalid loader: a page with a document is required');

  // A reason left by this page's last load: WebGPU was loaded and did not start.
  let retry: string | null = null;
  try {
    retry = env.sessionStorage.getItem(ZHUDA_BACKEND_RETRY_KEY);
    if (retry !== null) env.sessionStorage.removeItem(ZHUDA_BACKEND_RETRY_KEY);
  } catch {
    // No storage here (a sandboxed frame): nothing was carried over.
  }
  let facts: ZhudaBackendFacts | null = null,
    adapter: ZhudaBackendAdapter | null = null,
    probeMs = 0;
  if (prefer === 'webgpu' && !retry) {
    const now = () => env.performance?.now?.() ?? 0;
    const start = now();
    ({ facts, adapter } = await probeZhudaBackend(env, timeoutMs));
    probeMs = Math.round((now() - start) * 10) / 10;
  }
  let choice = chooseZhudaBackend(facts, options, retry);

  const head = doc.head ?? doc.documentElement;
  const hint = (ref: ZhudaScriptRef) => {
    const link = doc.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = ref.src;
    if (ref.integrity) {
      link.integrity = ref.integrity;
      link.crossOrigin = 'anonymous';
    }
    head.appendChild(link);
  };
  const run = (ref: ZhudaScriptRef) =>
    new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = ref.src;
      if (ref.integrity) {
        script.integrity = ref.integrity;
        script.crossOrigin = 'anonymous';
      }
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(Error('ZHUDA_LOADER: ' + ref.src + ' did not load (address, network, integrity)'));
      head.appendChild(script);
    });
  const backend = async (name: ZhudaBackendName) => {
    const list = lists[name];
    // What `retryZhudaBackend` reads: it works from the first script on, also
    // for a backend that loaded by halves.
    env.__ZHUDA_BACKEND_TRIED__ = name;
    // The first is fetched by its own script element; the rest are announced now.
    list.slice(1).forEach(hint);
    for (let i = 0; i < list.length; i++) {
      try {
        await run(list[i]);
      } catch (error) {
        (error as any).code = i === 0 ? 'ZHUDA_LOADER_FIRST' : 'ZHUDA_LOADER_PARTIAL';
        throw error;
      }
    }
  };
  after.forEach((item) => typeof item !== 'function' && hint(item));
  try {
    await backend(choice.backend);
  } catch (error) {
    if (choice.backend !== 'webgpu' || (error as any).code !== 'ZHUDA_LOADER_FIRST') throw error;
    choice = { backend: 'webgl', fallbackReason: 'bundle-failed: ' + clip(lists.webgpu[0].src) };
    await backend('webgl');
  }
  const record: ZhudaBackendRecord = Object.freeze({ ...choice, facts, adapter, probeMs });
  Object.defineProperty(env, 'ZhudaBackend', {
    value: record,
    configurable: false,
    writable: false,
  });
  for (const item of after) {
    if (typeof item === 'function') item();
    else await run(item);
  }
  return record;
}

/**
 * For a page whose WebGPU was loaded and did not start (`ZhudaEngine.boot`
 * rejected, the device was lost): loads the page again, and the loader then
 * takes WebGL with `fallbackReason: 'retry: <reason>'`, for that load only.
 *
 * Returns false and does nothing when the page is not on WebGPU (there is
 * nothing to fall back to: no loop) or has no session storage to carry the
 * reason in (a sandboxed frame).
 */
export function retryZhudaBackend(reason: string, env: any = globalThis): boolean {
  if (env.__ZHUDA_BACKEND_TRIED__ !== 'webgpu') return false;
  try {
    env.sessionStorage.setItem(ZHUDA_BACKEND_RETRY_KEY, clip(reason) || 'webgpu did not start');
  } catch {
    return false;
  }
  env.location.reload();
  return true;
}
