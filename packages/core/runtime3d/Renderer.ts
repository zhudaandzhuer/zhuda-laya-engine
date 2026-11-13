import { fixLaya342WebGPUShaders, installLaya342WebGPUFix } from './WebGPU342Adapters.ts';
export type RendererBackend = 'webgl' | 'webgpu';
import type { ZhudaRuntimeSession } from './Runtime.ts';

export interface RendererDiagnostics {
  requested: RendererBackend;
  selected: RendererBackend;
  /** This release never silently falls back. A fallback requires a fresh realm. */
  fallbackReason: null;
  nativeEngine: string;
  status: 'initializing' | 'ready' | 'lost' | 'disposed' | 'failed';
  adapter?: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
    isFallbackAdapter: boolean;
  };
  features: string[];
  errors: string[];
  loss?: { reason: string; message: string };
}
export class ZhudaRendererError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'ZhudaRendererError';
  }
}

/** Version-pinned native seam. All private upstream details stay in the engine.
 * WebGPU's device belongs to the realm; after release/loss use RuntimeHost to
 * recreate the realm, rather than invoking Laya's cached init promise again. */
export function prepareRenderer(
  requested?: RendererBackend,
  native: any = (globalThis as any).Laya,
) {
  const gpuLoaded = !!native?.WebGPURenderDeviceFactory;
  const glLoaded = !!native?.WebGLRenderDeviceFactory;
  const selected: RendererBackend = gpuLoaded ? 'webgpu' : 'webgl';
  requested ??= selected;
  if (requested !== 'webgl' && requested !== 'webgpu')
    throw new ZhudaRendererError('RENDERER_OPTION', 'renderer must be webgl or webgpu');
  if (gpuLoaded && glLoaded)
    throw new ZhudaRendererError(
      'RENDERER_CONFLICT',
      'Load one backend per realm; rebuild with renderer: webgl or webgpu',
    );
  if (requested !== selected)
    throw new ZhudaRendererError(
      'RENDERER_MISMATCH',
      `Requested ${requested}, loaded ${selected}; set renderer in zhuda.config.json and rebuild`,
    );
  if (selected === 'webgpu' && !(globalThis as any).navigator?.gpu)
    throw new ZhudaRendererError(
      'WEBGPU_UNAVAILABLE',
      'WebGPU requires HTTPS/localhost and a supported browser/GPU; use a separately built WebGL page if unavailable',
    );
  const diagnostics: RendererDiagnostics = {
    requested,
    selected,
    fallbackReason: null,
    nativeEngine: '',
    status: 'initializing',
    features: [],
    errors: [],
  };
  let ended = false,
    device: any,
    engine: any,
    session: ZhudaRuntimeSession | undefined;
  const cancellation = new AbortController();
  const cleanups: (() => void)[] = [];
  const check = () => {
    if (ended)
      throw new ZhudaRendererError(
        'RENDERER_CANCELLED',
        'Initialization retired; recreate the runtime realm',
      );
  };
  const errorListener = (event: any) => {
    if (diagnostics.errors.length < 64)
      diagnostics.errors.push(String(event.error?.message ?? event.error));
  };
  const pause = () => {
    if (native.Render) native.Render.paused = true;
    if (native.stage) native.stage.renderingEnabled = false;
    session?.notifyContextLost();
  };
  const patch = (prototype: any, key: string, make: (original: Function) => Function) => {
    const original = prototype?.[key];
    if (typeof original !== 'function')
      throw new ZhudaRendererError(
        'WEBGPU_VENDOR_MISMATCH',
        `Missing pinned LayaAir 3.4.2 seam: ${key}`,
      );
    const replacement = make(original);
    prototype[key] = replacement;
    cleanups.push(() => {
      if (prototype[key] === replacement) prototype[key] = original;
    });
  };
  const release = (status: 'disposed' | 'failed') => {
    if (ended) return;
    ended = true;
    diagnostics.status = status;
    cancellation.abort();
    if (selected === 'webgpu') {
      pause();
      device?.removeEventListener('uncapturederror', errorListener);
      engine?._context?.unconfigure();
      device?.destroy();
    }
    cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup());
  };
  try {
    if (selected === 'webgpu') {
      installLaya342WebGPUFix(native);
      patch(
        native.WebGPUShaderCompiler?.prototype,
        'init',
        (original) =>
          async function (this: any) {
            check();
            const prepare = (globalThis as any).__ZHUDA_WEBGPU_PREPARE__;
            if (prepare) {
              try {
                const compiled = await prepare(cancellation.signal);
                check();
                this.glslang = compiled.glslang;
                this.naga = compiled.naga;
              } catch (error) {
                throw new ZhudaRendererError('WEBGPU_SHADER_COMPILER', String(error));
              }
            } else {
              await original.call(this);
              check();
            }
            if (!this.glslang || !this.naga)
              throw new ZhudaRendererError(
                'WEBGPU_SHADER_COMPILER',
                'GLSL/WGSL compiler failed; verify the packaged WASM resources and CSP',
              );
            // A shader the compiler rejects is only logged upstream, and the
            // draw then throws on a null buffer. Keep the compiler's message
            // with the source lines it points at, so the cause can be read
            // from `context.renderer.errors`.
            const glslang = this.glslang;
            const compile = glslang.glsl450_to_spirv;
            if (typeof compile === 'function' && !glslang.__zhudaReports) {
              glslang.__zhudaReports = true;
              glslang.glsl450_to_spirv = function (source: string, stage: string) {
                const result = compile.call(this, source, stage);
                if (result && !result.success && diagnostics.errors.length < 64) {
                  const log = String(result.info_log ?? '').trim();
                  const line = Number(/ERROR: :?(\d+):/.exec(log)?.[1]);
                  const lines = String(source).split('\n');
                  const context = Number.isFinite(line)
                    ? lines
                        .slice(Math.max(0, line - 3), line + 1)
                        .map((text, i) => `${Math.max(1, line - 2) + i}: ${text.slice(0, 240)}`)
                        .join('\n')
                    : '';
                  diagnostics.errors.push(`Shader compile failed (${stage}): ${log}\n${context}`);
                }
                return result;
              };
            }
          },
      );
      patch(
        native.WebGPURenderEngine?.prototype,
        '_getAdapter',
        (original) =>
          async function (this: any) {
            check();
            const adapter = await original.call(this);
            check();
            if (!adapter)
              throw new ZhudaRendererError(
                'WEBGPU_ADAPTER',
                'No compatible adapter; inspect browser GPU diagnostics',
              );
            const info = adapter.info ?? {};
            diagnostics.adapter = {
              vendor: info.vendor ?? '',
              architecture: info.architecture ?? '',
              device: info.device ?? '',
              description: info.description ?? '',
              isFallbackAdapter: info.isFallbackAdapter ?? false,
            };
            return adapter;
          },
      );
      patch(
        native.WebGPURenderEngine?.prototype,
        '_getGPUdevice',
        (original) =>
          async function (this: any, descriptor: unknown) {
            check();
            // LayaAir asks for the adapter's sizes but leaves the count of
            // textures a shader stage may sample at WebGPU's default of 16. A
            // lit material with all its maps, the shadow maps, the environment
            // and a probe volume needs 17: the pipeline is then invalid and
            // nothing using it is drawn. Ask for what the adapter has.
            const adapter = this._adapter;
            const request = adapter?.requestDevice;
            if (typeof request === 'function')
              adapter.requestDevice = (wanted: any = {}) => {
                delete adapter.requestDevice;
                const limits: Record<string, number> = { ...(wanted.requiredLimits ?? {}) };
                for (const name of [
                  'maxSampledTexturesPerShaderStage',
                  'maxSamplersPerShaderStage',
                ])
                  if (adapter.limits?.[name] > (limits[name] ?? 0))
                    limits[name] = adapter.limits[name];
                return request.call(adapter, { ...wanted, requiredLimits: limits });
              };
            const result = await original.call(this, descriptor);
            if (ended) {
              result.destroy();
              check();
            }
            device = result;
            engine = this;
            diagnostics.features = [...result.features].sort();
            device.addEventListener('uncapturederror', errorListener);
            // The promise cannot be removed. Retired callbacks never touch a new session.
            device.lost.then((info: any) => {
              if (ended) return;
              diagnostics.status = 'lost';
              diagnostics.loss = { reason: info.reason, message: info.message };
              pause();
            });
            return result;
          },
      );
    }
    return {
      backend: selected,
      diagnostics,
      ready() {
        check();
        const actual = native.LayaGL?.renderEngine;
        diagnostics.nativeEngine = actual?.objectName ?? actual?.constructor?.name ?? 'unknown';
        const actualGpu = typeof actual?.getDevice === 'function' && !!actual.getDevice();
        // On WebGL the same shader only logs a warning and draws nothing in that pass.
        fixLaya342WebGPUShaders(native);
        if (selected === 'webgpu' && (!actualGpu || diagnostics.status === 'lost'))
          throw new ZhudaRendererError(
            'WEBGPU_NOT_READY',
            'Native WebGPU device did not initialize or was lost',
          );
        if (selected === 'webgl' && actualGpu)
          throw new ZhudaRendererError(
            'RENDERER_MISMATCH',
            'Native renderer does not match the requested backend',
          );
        diagnostics.status = 'ready';
      },
      attach(runtime: ZhudaRuntimeSession) {
        session = runtime;
        if (diagnostics.status === 'lost') pause();
      },
      release,
    };
  } catch (error) {
    release('failed');
    throw error;
  }
}
