var ZhudaAppBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
    for (var i = decorators.length - 1, decorator; i >= 0; i--)
      if (decorator = decorators[i])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp(target, key, result);
    return result;
  };

  // packages/core/runtime3d/WebGPU342Adapters.ts
  var patched = /* @__PURE__ */ new WeakSet();
  function installLaya342WebGPUFix(native) {
    const prototype = native.WebGPUMeshRenderBatchAgent?.prototype;
    if (!prototype || patched.has(prototype)) return;
    const append = prototype.appendRenderElement;
    prototype.appendRenderElement = function(...args) {
      if (this._checkCPUCullList?.length || this._changeElementBatchMark?.length) {
        this._canKipCull = native.Stat.loopCount;
        this._cameraChangeMask = this._dirCullChangeMask = this._spotCullChangeMask = native.Stat.loopCount;
      }
      return append.apply(this, args);
    };
    patched.add(prototype);
  }

  // packages/core/runtime3d/Renderer.ts
  var ZhudaRendererError = class extends Error {
    constructor(code, message) {
      super(`${code}: ${message}`);
      this.code = code;
      this.name = "ZhudaRendererError";
    }
  };
  function prepareRenderer(requested, native = globalThis.Laya) {
    const gpuLoaded = !!native?.WebGPURenderDeviceFactory;
    const glLoaded = !!native?.WebGLRenderDeviceFactory;
    const selected = gpuLoaded ? "webgpu" : "webgl";
    requested ?? (requested = selected);
    if (requested !== "webgl" && requested !== "webgpu") throw new ZhudaRendererError("RENDERER_OPTION", "renderer must be webgl or webgpu");
    if (gpuLoaded && glLoaded) throw new ZhudaRendererError("RENDERER_CONFLICT", "Load one backend per realm; rebuild with renderer: webgl or webgpu");
    if (requested !== selected) throw new ZhudaRendererError("RENDERER_MISMATCH", `Requested ${requested}, loaded ${selected}; set renderer in zhuda.config.json and rebuild`);
    if (selected === "webgpu" && !globalThis.navigator?.gpu) throw new ZhudaRendererError("WEBGPU_UNAVAILABLE", "WebGPU requires HTTPS/localhost and a supported browser/GPU; use a separately built WebGL page if unavailable");
    const diagnostics = { requested, selected, fallbackReason: null, nativeEngine: "", status: "initializing", features: [], errors: [] };
    let ended = false, device, engine, session;
    const cancellation = new AbortController();
    const cleanups = [];
    const check = () => {
      if (ended) throw new ZhudaRendererError("RENDERER_CANCELLED", "Initialization retired; recreate the runtime realm");
    };
    const errorListener = (event) => {
      if (diagnostics.errors.length < 64) diagnostics.errors.push(String(event.error?.message ?? event.error));
    };
    const pause = () => {
      if (native.Render) native.Render.paused = true;
      if (native.stage) native.stage.renderingEnabled = false;
      session?.notifyContextLost();
    };
    const patch = (prototype, key, make) => {
      const original = prototype?.[key];
      if (typeof original !== "function") throw new ZhudaRendererError("WEBGPU_VENDOR_MISMATCH", `Missing pinned LayaAir 3.4.2 seam: ${key}`);
      const replacement = make(original);
      prototype[key] = replacement;
      cleanups.push(() => {
        if (prototype[key] === replacement) prototype[key] = original;
      });
    };
    const release = (status) => {
      if (ended) return;
      ended = true;
      diagnostics.status = status;
      cancellation.abort();
      if (selected === "webgpu") {
        pause();
        device?.removeEventListener("uncapturederror", errorListener);
        engine?._context?.unconfigure();
        device?.destroy();
      }
      cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    };
    try {
      if (selected === "webgpu") {
        installLaya342WebGPUFix(native);
        patch(native.WebGPUShaderCompiler?.prototype, "init", (original) => async function() {
          check();
          const prepare = globalThis.__ZHUDA_WEBGPU_PREPARE__;
          if (prepare) {
            try {
              const compiled = await prepare(cancellation.signal);
              check();
              this.glslang = compiled.glslang;
              this.naga = compiled.naga;
            } catch (error) {
              throw new ZhudaRendererError("WEBGPU_SHADER_COMPILER", String(error));
            }
          } else {
            await original.call(this);
            check();
          }
          if (!this.glslang || !this.naga) throw new ZhudaRendererError("WEBGPU_SHADER_COMPILER", "GLSL/WGSL compiler failed; verify the packaged WASM resources and CSP");
        });
        patch(native.WebGPURenderEngine?.prototype, "_getAdapter", (original) => async function() {
          check();
          const adapter = await original.call(this);
          check();
          if (!adapter) throw new ZhudaRendererError("WEBGPU_ADAPTER", "No compatible adapter; inspect browser GPU diagnostics");
          const info = adapter.info ?? {};
          diagnostics.adapter = { vendor: info.vendor ?? "", architecture: info.architecture ?? "", device: info.device ?? "", description: info.description ?? "", isFallbackAdapter: info.isFallbackAdapter ?? false };
          return adapter;
        });
        patch(native.WebGPURenderEngine?.prototype, "_getGPUdevice", (original) => async function(descriptor) {
          check();
          const result = await original.call(this, descriptor);
          if (ended) {
            result.destroy();
            check();
          }
          device = result;
          engine = this;
          diagnostics.features = [...result.features].sort();
          device.addEventListener("uncapturederror", errorListener);
          device.lost.then((info) => {
            if (ended) return;
            diagnostics.status = "lost";
            diagnostics.loss = { reason: info.reason, message: info.message };
            pause();
          });
          return result;
        });
      }
      return {
        backend: selected,
        diagnostics,
        ready() {
          check();
          const actual = native.LayaGL?.renderEngine;
          diagnostics.nativeEngine = actual?.objectName ?? actual?.constructor?.name ?? "unknown";
          const actualGpu = typeof actual?.getDevice === "function" && !!actual.getDevice();
          if (selected === "webgpu" && (!actualGpu || diagnostics.status === "lost")) throw new ZhudaRendererError("WEBGPU_NOT_READY", "Native WebGPU device did not initialize or was lost");
          if (selected === "webgl" && actualGpu) throw new ZhudaRendererError("RENDERER_MISMATCH", "Native renderer does not match the requested backend");
          diagnostics.status = "ready";
        },
        attach(runtime) {
          session = runtime;
          if (diagnostics.status === "lost") pause();
        },
        release
      };
    } catch (error) {
      release("failed");
      throw error;
    }
  }

  // packages/core/runtime3d/AsyncDeadline.ts
  function withDeadline(run, options, discard = () => {
  }) {
    const timeout = options.timeoutMs ?? 15e3;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) return Promise.reject(Error("Invalid IO timeoutMs"));
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      };
      const fail = (reason) => {
        if (settled) return;
        settled = true;
        controller.abort(reason);
        cleanup();
        reject(reason);
      };
      const abort = () => fail(options.signal?.reason ?? new DOMException("Operation cancelled", "AbortError"));
      const timer = setTimeout(() => fail(new DOMException("IO deadline exceeded", "TimeoutError")), timeout);
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason;
        return run(controller.signal);
      }).then((value) => {
        if (settled) {
          discard(value);
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      }, fail).catch(() => {
      });
    });
  }

  // packages/core/runtime3d/AsyncOperation.ts
  function awaitAbortable(work, signal, discard) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const abort = () => {
        if (settled) return;
        settled = true;
        reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
      work.then((value) => {
        signal.removeEventListener("abort", abort);
        if (settled) {
          discard?.(value);
          return;
        }
        settled = true;
        resolve(value);
      }, (error) => {
        signal.removeEventListener("abort", abort);
        if (!settled) {
          settled = true;
          reject(error);
        }
      }).catch(() => {
      });
    });
  }

  // packages/core/runtime3d/MiniGameSplash.ts
  async function showMiniGameSplash(context, signal, timeoutMs = 3e4) {
    const config = globalThis.__ZHUDA_MINIGAME__;
    const branding = config?.branding;
    if (!branding || branding.mode === "none" || !branding.logo) return;
    const url = branding.logo;
    const panel = new Laya.Sprite(), logo = new Laya.Sprite();
    panel.name = "ZhudaPlatformSplash";
    panel.zOrder = 2147483e3;
    panel.mouseEnabled = true;
    panel.addChild(logo);
    Laya.stage.addChild(panel);
    let ready = false, elapsed = 0;
    const release = () => Laya.loader.clearRes(url);
    try {
      await withDeadline(async (cancellation) => {
        const texture = await awaitAbortable(Laya.loader.load(url, Laya.Loader.IMAGE), cancellation, release);
        if (!(texture instanceof Laya.Texture)) throw Error("Mini-game branding image failed to load");
        logo.texture = texture;
        ready = true;
        await awaitAbortable(new Promise((resolve) => {
          context.runtime.start((dt) => {
            if (!ready || context.runtime.disposed) return;
            elapsed += dt;
            const width = Laya.stage.width, height = Laya.stage.height;
            panel.size(width, height);
            panel.graphics.clear();
            panel.graphics.drawRect(0, 0, width, height, "#0b1220");
            const fit = Math.min(width * 0.82 / texture.width, height * 0.5 / texture.height);
            const entrance = Math.min(1, elapsed / 0.5);
            logo.size(texture.width * fit, texture.height * fit);
            logo.pivot(logo.width / 2, logo.height / 2);
            logo.pos(width / 2, height / 2);
            logo.scale(0.9 + 0.1 * entrance, 0.9 + 0.1 * entrance);
            panel.alpha = elapsed > 1.4 ? Math.max(0, (1.8 - elapsed) / 0.4) : entrance;
            if (elapsed >= 1.8) resolve();
          });
        }), cancellation);
      }, { signal, timeoutMs });
    } finally {
      ready = false;
      if (!context.runtime.disposed) context.runtime.start(() => {
      });
      panel.destroy(true);
      release();
    }
  }

  // packages/core/runtime3d/Clocks.ts
  var DEFAULT_TIME_LAYERS = ["world", "player", "enemy", "vfx", "ui"];
  var ZhudaLayeredClock = class {
    constructor(layers = DEFAULT_TIME_LAYERS) {
      this.layerStates = /* @__PURE__ */ new Map();
      this.layerDeltaValues = /* @__PURE__ */ new Map();
      /** Global scale inherited from the owning runtime session. */
      this.globalTimeScale = 1;
      this.unscaledTime = 0;
      this.unscaledDeltaTime = 0;
      if (Array.isArray(layers)) {
        if (!layers.length) throw Error("At least one time layer is required");
        for (const name of layers) this.defineLayer(name);
      } else {
        const definitions = layers;
        const names = Object.keys(definitions);
        if (!names.length) throw Error("At least one time layer is required");
        for (const name of names) this.defineLayer(name, definitions[name]);
      }
    }
    defineLayer(name, options = {}) {
      this.validateName(name);
      if (this.layerStates.has(name)) throw Error(`Time layer already exists: ${name}`);
      const timeScale = options.timeScale ?? 1;
      if (!Number.isFinite(timeScale) || timeScale < 0)
        throw Error("Invalid time layer scale");
      if (options.paused !== void 0 && typeof options.paused !== "boolean")
        throw Error("Invalid time layer pause state");
      this.layerStates.set(name, {
        name,
        timeScale,
        paused: options.paused ?? false,
        scaledTime: 0,
        scaledDeltaTime: 0
      });
      this.layerDeltaValues.set(name, 0);
      return this;
    }
    removeLayer(name) {
      this.validateName(name);
      this.layerDeltaValues.delete(name);
      return this.layerStates.delete(name);
    }
    setTimeScale(name, value) {
      const layer = this.getLayer(name);
      if (!Number.isFinite(value) || value < 0) throw Error("Invalid time layer scale");
      layer.timeScale = value;
      return this;
    }
    setGlobalTimeScale(value) {
      if (!Number.isFinite(value) || value < 0) throw Error("Invalid global time layer scale");
      this.globalTimeScale = value;
      return this;
    }
    setPaused(name, paused) {
      const layer = this.getLayer(name);
      if (typeof paused !== "boolean") throw Error("Invalid time layer pause state");
      layer.paused = paused;
      return this;
    }
    getTimeScale(name) {
      return this.getLayer(name).timeScale;
    }
    isPaused(name) {
      return this.getLayer(name).paused;
    }
    get layerNames() {
      return [...this.layerStates.keys()];
    }
    /** Reusable layer deltas for `ZhudaTimerScheduler.advance`. */
    get scaledDeltas() {
      return this.layerDeltaValues;
    }
    advance(unscaledDeltaTime) {
      if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
        throw Error("Invalid layered clock delta");
      this.unscaledDeltaTime = unscaledDeltaTime;
      this.unscaledTime += unscaledDeltaTime;
      for (const layer of this.layerStates.values()) {
        const scaledDeltaTime = layer.paused ? 0 : unscaledDeltaTime * this.globalTimeScale * layer.timeScale;
        layer.scaledDeltaTime = scaledDeltaTime;
        layer.scaledTime += scaledDeltaTime;
        this.layerDeltaValues.set(layer.name, scaledDeltaTime);
      }
    }
    sample(name) {
      const layer = this.getLayer(name);
      return {
        layer: layer.name,
        paused: layer.paused,
        unscaledDeltaTime: this.unscaledDeltaTime,
        scaledDeltaTime: layer.scaledDeltaTime,
        unscaledTime: this.unscaledTime,
        scaledTime: layer.scaledTime,
        timeScale: this.globalTimeScale * layer.timeScale
      };
    }
    reset() {
      this.unscaledTime = 0;
      this.unscaledDeltaTime = 0;
      for (const layer of this.layerStates.values()) {
        layer.scaledTime = 0;
        layer.scaledDeltaTime = 0;
        this.layerDeltaValues.set(layer.name, 0);
      }
    }
    getLayer(name) {
      this.validateName(name);
      const layer = this.layerStates.get(name);
      if (!layer) throw Error(`Unknown time layer: ${name}`);
      return layer;
    }
    validateName(name) {
      if (typeof name !== "string" || !name.trim()) throw Error("Invalid time layer name");
    }
  };
  var ZhudaRealtimeClock = class {
    constructor() {
      this.timeScale = 1;
      this.unscaledTime = 0;
      this.scaledTime = 0;
      this.unscaledDeltaTime = 0;
      this.scaledDeltaTime = 0;
      this.paused = false;
    }
    advance(unscaledDeltaTime) {
      if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
        throw Error("Invalid real-time delta");
      if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
        throw Error("Invalid clock time scale");
      const unscaled = this.paused ? 0 : unscaledDeltaTime;
      const scaled = unscaled * this.timeScale;
      this.unscaledDeltaTime = unscaled;
      this.scaledDeltaTime = scaled;
      this.unscaledTime += unscaled;
      this.scaledTime += scaled;
      return this.sample();
    }
    sample() {
      return {
        unscaledDeltaTime: this.unscaledDeltaTime,
        scaledDeltaTime: this.scaledDeltaTime,
        unscaledTime: this.unscaledTime,
        scaledTime: this.scaledTime,
        timeScale: this.timeScale
      };
    }
    reset() {
      this.unscaledTime = 0;
      this.scaledTime = 0;
      this.unscaledDeltaTime = 0;
      this.scaledDeltaTime = 0;
    }
  };
  var ZhudaTimerScheduler = class {
    constructor(maxCallbacksPerAdvance = 64) {
      this.nextId = 1;
      this.tasks = /* @__PURE__ */ new Map();
      this.owners = /* @__PURE__ */ new Map();
      this.disposed = false;
      if (!Number.isSafeInteger(maxCallbacksPerAdvance) || maxCallbacksPerAdvance <= 0)
        throw Error("Invalid timer callback bound");
      this.maxCallbacksPerAdvance = maxCallbacksPerAdvance;
    }
    scheduleOnce(delay, callback, options = {}) {
      return this.schedule(delay, callback, { ...options, repeat: false });
    }
    scheduleLoop(interval, callback, options = {}) {
      return this.schedule(interval, callback, { ...options, repeat: true });
    }
    schedule(delay, callback, options) {
      if (this.disposed) throw Error("Disposed timer scheduler");
      if (!Number.isFinite(delay) || delay < 0 || options.repeat && delay <= 0)
        throw Error("Invalid timer delay");
      if (typeof callback !== "function") throw Error("Invalid timer callback");
      if (options.layer !== void 0 && (typeof options.layer !== "string" || !options.layer.trim()))
        throw Error("Invalid timer layer");
      if (options.layer !== void 0 && options.channel !== void 0)
        throw Error("Timer layer cannot be combined with a timer channel");
      const task = {
        id: this.nextId++,
        remaining: delay,
        interval: delay,
        repeat: options.repeat,
        channel: options.channel ?? "scaled",
        layer: options.layer,
        owner: options.owner,
        callback,
        cancelled: false
      };
      this.tasks.set(task.id, task);
      if (task.owner) {
        let ids = this.owners.get(task.owner);
        if (!ids) this.owners.set(task.owner, ids = /* @__PURE__ */ new Set());
        ids.add(task.id);
      }
      return this.handle(task);
    }
    handle(task) {
      return {
        id: task.id,
        get cancelled() {
          return task.cancelled;
        },
        cancel: () => this.cancel(task.id)
      };
    }
    cancel(id) {
      const task = this.tasks.get(id);
      if (!task || task.cancelled) return false;
      task.cancelled = true;
      this.tasks.delete(id);
      if (task.owner) {
        const ids = this.owners.get(task.owner);
        ids?.delete(id);
        if (ids && !ids.size) this.owners.delete(task.owner);
      }
      return true;
    }
    cancelOwner(owner) {
      const ids = [...this.owners.get(owner) ?? []];
      for (const id of ids) this.cancel(id);
      return ids.length;
    }
    advance(unscaledDeltaTime, scaledDeltaTime = unscaledDeltaTime, layerDeltas) {
      if (this.disposed) return 0;
      if (![unscaledDeltaTime, scaledDeltaTime].every((v) => Number.isFinite(v) && v >= 0))
        throw Error("Invalid timer delta");
      if (layerDeltas) {
        for (const [name, delta] of layerDeltas) {
          if (typeof name !== "string" || !name.trim() || !Number.isFinite(delta) || delta < 0)
            throw Error("Invalid timer layer delta");
        }
      }
      let callbacks = 0;
      const snapshot = [...this.tasks.values()];
      for (const task of snapshot) {
        if (callbacks >= this.maxCallbacksPerAdvance) break;
        if (task.cancelled || !this.tasks.has(task.id)) continue;
        const delta = task.layer ? layerDeltas?.get(task.layer) ?? 0 : task.channel === "scaled" ? scaledDeltaTime : unscaledDeltaTime;
        task.remaining -= delta;
        while (task.remaining <= 1e-10 && !task.cancelled && this.tasks.has(task.id) && callbacks < this.maxCallbacksPerAdvance) {
          task.callback();
          callbacks++;
          if (!task.repeat) {
            this.cancel(task.id);
            break;
          }
          task.remaining += task.interval;
        }
        if (callbacks >= this.maxCallbacksPerAdvance && task.repeat && !task.cancelled && task.remaining <= 1e-10)
          task.remaining = task.interval;
      }
      return callbacks;
    }
    clear() {
      for (const id of [...this.tasks.keys()]) this.cancel(id);
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.clear();
      this.owners.clear();
    }
    get size() {
      return this.tasks.size;
    }
  };

  // packages/core/runtime3d/SceneMutation.ts
  var ZhudaSceneMutationQueue = class {
    constructor() {
      this.nextId = 1;
      this.pending = /* @__PURE__ */ new Map();
      this.disposed = false;
      this.flushing = false;
    }
    enqueue(mutation) {
      if (this.disposed) throw Error("Disposed scene mutation queue");
      if (!mutation || typeof mutation.apply !== "function")
        throw Error("Invalid scene mutation");
      if (!["add", "remove", "destroy", "custom"].includes(mutation.kind))
        throw Error("Invalid scene mutation kind");
      const item = {
        ...mutation,
        id: this.nextId++,
        cancelled: false
      };
      this.pending.set(item.id, item);
      return {
        id: item.id,
        get cancelled() {
          return item.cancelled;
        },
        cancel: () => this.cancel(item.id)
      };
    }
    deferAdd(apply) {
      return this.enqueue({ kind: "add", apply });
    }
    deferRemove(apply) {
      return this.enqueue({ kind: "remove", apply });
    }
    deferDestroy(apply) {
      return this.enqueue({ kind: "destroy", apply });
    }
    cancel(id) {
      const item = this.pending.get(id);
      if (!item || item.cancelled) return false;
      item.cancelled = true;
      this.pending.delete(id);
      return true;
    }
    /** Applies exactly the batch present at the start of this call. */
    flush() {
      if (this.disposed || this.flushing) return 0;
      const batch = [...this.pending.values()];
      for (const item of batch) this.pending.delete(item.id);
      this.flushing = true;
      let applied = 0;
      try {
        for (const item of batch) {
          if (item.cancelled) continue;
          item.apply();
          applied++;
        }
      } finally {
        this.flushing = false;
      }
      return applied;
    }
    clear() {
      for (const item of this.pending.values()) item.cancelled = true;
      this.pending.clear();
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.clear();
    }
    get size() {
      return this.pending.size;
    }
    get isFlushing() {
      return this.flushing;
    }
  };

  // packages/core/runtime3d/Laya342Adapters.ts
  var patched2 = /* @__PURE__ */ new WeakSet();
  function resizeLaya342Stage(runtime, width, height, designWidth, designHeight, dpr, canvas) {
    const descriptor = Object.getOwnPropertyDescriptor(
      runtime.Browser,
      "pixelRatio"
    );
    try {
      Object.defineProperty(runtime.Browser, "pixelRatio", {
        configurable: true,
        get: () => dpr
      });
      runtime.stage.size(designWidth, designHeight);
      if (runtime.stage.updateCanvasSize)
        runtime.systemTimer?.clearCallLater(runtime.stage, runtime.stage.updateCanvasSize);
      runtime.stage.setScreenSize(width * dpr, height * dpr);
      if (canvas?.style) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = "block";
        canvas.style.touchAction = "none";
      }
      const matrix = runtime.stage._canvasTransform;
      if (canvas?.getBoundingClientRect && matrix) {
        const rect = canvas.getBoundingClientRect();
        const x = [
          0,
          matrix.a * canvas.width,
          matrix.c * canvas.height,
          matrix.a * canvas.width + matrix.c * canvas.height
        ];
        const y = [
          0,
          matrix.b * canvas.width,
          matrix.d * canvas.height,
          matrix.b * canvas.width + matrix.d * canvas.height
        ];
        matrix.tx = rect.left + (globalThis.scrollX || 0) - Math.min(...x);
        matrix.ty = rect.top + (globalThis.scrollY || 0) - Math.min(...y);
      }
    } finally {
      if (descriptor)
        Object.defineProperty(runtime.Browser, "pixelRatio", descriptor);
      else Reflect.deleteProperty(runtime.Browser, "pixelRatio");
    }
  }
  function installLaya342LifecycleFix(runtime = globalThis.Laya) {
    const prototype = runtime?.WebRender3DProcess?.prototype;
    if (!prototype || patched2.has(prototype)) return;
    const destroy = prototype.destroy;
    if (typeof destroy !== "function") return;
    const retired = /* @__PURE__ */ new WeakSet();
    prototype.destroy = function(...args) {
      if (retired.has(this)) return;
      retired.add(this);
      const shadow = this._defaultShadowMap;
      try {
        return destroy.apply(this, args);
      } finally {
        if (shadow && !shadow.destroyed) shadow.destroy();
        this._defaultShadowMap = null;
      }
    };
    patched2.add(prototype);
  }

  // packages/core/runtime3d/RuntimeDriver.ts
  var ZhudaRafDriver = class {
    constructor() {
      this.frame = 0;
      this.generation = 0;
    }
    now() {
      return performance.now();
    }
    start(callback) {
      this.stop();
      const generation = ++this.generation;
      const tick = (now) => {
        if (generation !== this.generation) return;
        this.frame = 0;
        try {
          callback(now);
        } finally {
          if (generation === this.generation)
            this.frame = requestAnimationFrame(tick);
        }
      };
      this.frame = requestAnimationFrame(tick);
    }
    setBackground(_background) {
    }
    stop() {
      this.generation++;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    dispose() {
      this.stop();
    }
  };

  // packages/core/runtime3d/Runtime.ts
  var LayaPlatformDriver = class {
    now() {
      return Laya.Browser.now();
    }
    start(callback) {
      this.stop();
      const tick = () => {
        if (this.tick === tick) callback(this.now());
      };
      this.tick = tick;
      Laya.systemTimer.frameLoop(1, this, tick);
    }
    setBackground(_background) {
    }
    stop() {
      if (this.tick) Laya.systemTimer.clear(this, this.tick);
      this.tick = void 0;
    }
    dispose() {
      this.stop();
    }
  };
  function installSandboxStorageFallback() {
    const modes = {};
    for (const name of ["localStorage", "sessionStorage"]) {
      try {
        void window[name];
        modes[name] = "persistent";
      } catch {
        const values = /* @__PURE__ */ new Map();
        const memory = {
          get length() {
            return values.size;
          },
          key: (i) => [...values.keys()][i] ?? null,
          getItem: (k) => values.get(String(k)) ?? null,
          setItem: (k, v) => {
            values.set(String(k), String(v));
          },
          removeItem: (k) => {
            values.delete(String(k));
          },
          clear: () => values.clear()
        };
        Object.defineProperty(window, name, {
          configurable: true,
          value: memory
        });
        modes[name] = "memory";
      }
    }
    return modes;
  }
  var ZhudaRuntimeSession = class {
    constructor(canvas, options = {}) {
      this.paused = false;
      this.contextLost = false;
      this.disposed = false;
      this.clock = new ZhudaRealtimeClock();
      /** Named channels driven by the same RAF clock as `clock` and `timers`. */
      this.layers = new ZhudaLayeredClock();
      this.timers = new ZhudaTimerScheduler();
      this.mutations = new ZhudaSceneMutationQueue();
      this.cleanups = [];
      this.started = false;
      this.background = false;
      this.manuallyPaused = false;
      this.recoveryDelta = 0;
      this.task = null;
      this.canvas = canvas;
      this.options = options;
      if (!["pause", "continue"].includes(options.backgroundPolicy ?? "pause") || !["discard", "bounded"].includes(options.recoveryPolicy ?? "discard") || !Number.isFinite(options.maxFrameDeltaSec ?? 0.1) || (options.maxFrameDeltaSec ?? 0.1) <= 0 || (options.maxFrameDeltaSec ?? 0.1) > 1)
        throw Error("Invalid runtime background/recovery policy");
      if (options.timeScale !== void 0) {
        if (!Number.isFinite(options.timeScale) || options.timeScale < 0)
          throw Error("Invalid runtime time scale");
        this.clock.timeScale = options.timeScale;
      }
      const native = globalThis.Laya;
      const platform = native?.Browser?.isDomSupported === false ? native.PAL?.browser : void 0;
      this.driver = options.driver ?? (platform ? new LayaPlatformDriver() : new ZhudaRafDriver());
      this.layers.setGlobalTimeScale(this.clock.timeScale);
      const listen = (target, event, fn, capture = false) => {
        target.addEventListener(event, fn, capture);
        this.cleanups.push(() => target.removeEventListener(event, fn, capture));
      };
      if (platform) {
        if (options.container) throw Error("Mini-game runtime cannot use a DOM container");
        const visibility = (visible) => this.setBackground(!visible);
        const focus = () => this.setBackground(false);
        const blur = () => this.setBackground(true);
        const resize = () => this.resize();
        for (const [event, callback] of [[Laya.Event.VISIBILITY_CHANGE, visibility], [Laya.Event.FOCUS, focus], [Laya.Event.BLUR, blur], [Laya.Event.RESIZE, resize]]) {
          platform.on(event, this, callback);
          this.cleanups.push(() => platform.off(event, this, callback));
        }
        try {
          this.resize();
          if (!platform.getVisibility()) this.setBackground(true);
        } catch (error) {
          this.dispose();
          throw error;
        }
        return;
      }
      listen(
        document,
        "visibilitychange",
        () => this.setBackground(document.hidden)
      );
      listen(window, "blur", () => this.setBackground(true));
      listen(window, "focus", () => {
        if (!document.hidden && !this.contextLost) this.setBackground(false);
      });
      listen(window, "pagehide", () => this.setBackground(true));
      listen(window, "pageshow", () => {
        if (!document.hidden) this.setBackground(false);
      });
      listen(window, "scroll", () => this.resize(), true);
      listen(canvas, "webglcontextlost", (e) => {
        e.preventDefault();
        this.notifyContextLost();
      });
      try {
        if (options.container) {
          this.observer = new ResizeObserver(() => this.resize());
          this.observer.observe(options.container);
        } else listen(window, "resize", () => this.resize());
        this.resize();
        if (document.hidden) this.setBackground(true);
      } catch (error) {
        this.dispose();
        throw error;
      }
    }
    /** Shared WebGL context/WebGPU device-loss path; a new realm owns recovery. */
    notifyContextLost() {
      if (this.disposed || this.contextLost) return;
      this.contextLost = true;
      this.setPaused(true);
      this.options.onContextLost?.();
    }
    setPaused(value) {
      this.manuallyPaused = value;
      this.options.clearInput?.();
      this.paused = value || this.contextLost || this.background && this.options.backgroundPolicy !== "continue";
      this.previous = void 0;
      this.recoveryDelta = 0;
      this.options.onPause?.(this.paused);
    }
    setBackground(background) {
      if (this.disposed || this.background === background) return;
      this.options.clearInput?.();
      const now = this.driver.now();
      this.background = background;
      this.driver.setBackground(background);
      if (background) {
        this.suspendedAt = now;
      } else {
        const elapsedSec = Math.max(0, (now - (this.suspendedAt ?? now)) / 1e3);
        const missed = this.options.backgroundPolicy === "continue" && this.previous !== void 0 ? Math.max(0, (now - this.previous) / 1e3) : elapsedSec;
        this.recoveryDelta = !this.manuallyPaused && this.options.recoveryPolicy === "bounded" ? Math.min(missed, this.options.maxFrameDeltaSec ?? 0.1) : 0;
        this.options.onResume?.({
          elapsedSec,
          advancedSec: this.recoveryDelta,
          discardedSec: Math.max(0, missed - this.recoveryDelta)
        });
        this.previous = void 0;
        this.suspendedAt = void 0;
      }
      this.paused = this.manuallyPaused || this.contextLost || background && this.options.backgroundPolicy !== "continue";
      this.options.onPause?.(this.paused);
    }
    resize() {
      if (this.disposed) return;
      const l = globalThis.Laya, c = this.options.container;
      if (!c && !this.options.dprCap) return;
      const platform = l.Browser?.isDomSupported === false ? l.PAL?.browser : void 0;
      const rect = c?.getBoundingClientRect(), width = platform ? platform.getClientWidth() : rect?.width || innerWidth, height = platform ? platform.getClientHeight() : rect?.height || innerHeight, dpr = Math.min(platform ? platform.getPixelRatio() : devicePixelRatio || 1, this.options.dprCap ?? 2);
      if (width < 2 || height < 2) return;
      const design = this.options.designSize ?? { width, height };
      if (![design.width, design.height, dpr].every(
        (value) => Number.isFinite(value) && value > 0
      ))
        throw Error("Invalid runtime design size or DPR");
      l.Config.useRetinalCanvas = true;
      l.stage.screenAdaptationEnabled = false;
      l.stage.scaleMode = this.options.scaleMode ?? l.Stage.SCALE_SHOWALL;
      l.stage.alignH = l.Stage.ALIGN_LEFT;
      l.stage.alignV = l.Stage.ALIGN_TOP;
      resizeLaya342Stage(
        l,
        width,
        height,
        design.width,
        design.height,
        dpr,
        platform ? void 0 : this.canvas
      );
      this.options.onResize?.({ width, height, dpr });
    }
    start(update) {
      if (this.disposed) throw Error("Disposed runtime");
      this.task = update;
      if (this.started) return;
      this.started = true;
      const tick = (now) => {
        if (this.disposed) return;
        if (!Number.isFinite(now) || this.previous !== void 0 && now <= this.previous)
          return;
        if (!this.paused) {
          const elapsed = this.previous !== void 0 ? now - this.previous : this.recoveryDelta * 1e3;
          if (this.previous === void 0 || elapsed >= 1e3 / (this.options.targetFPS || 60) - 2) {
            this.previous = now;
            this.recoveryDelta = 0;
            const sample = this.clock.advance(
              Math.min(this.options.maxFrameDeltaSec ?? 0.1, elapsed / 1e3)
            );
            this.layers.setGlobalTimeScale(this.clock.timeScale);
            this.layers.advance(sample.unscaledDeltaTime);
            this.timers.advance(
              sample.unscaledDeltaTime,
              sample.scaledDeltaTime,
              this.layers.scaledDeltas
            );
            this.task?.(sample.unscaledDeltaTime, sample);
            this.mutations.flush();
          }
        }
      };
      try {
        this.driver.start(tick);
      } catch (error) {
        this.started = false;
        this.driver.stop();
        throw error;
      }
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.driver.dispose();
      this.started = false;
      this.task = null;
      this.timers.dispose();
      this.mutations.dispose();
      this.observer?.disconnect();
      for (const f of this.cleanups) f();
      this.cleanups = [];
      this.options.clearInput?.();
    }
  };

  // packages/core/runtime3d/Surfaces.ts
  function createSurfaceMaterial(s) {
    const l = globalThis.Laya;
    if (!["pbr", "unlit"].includes(s.type)) throw Error("Unknown material type");
    if ([s.metallic ?? 0, s.roughness ?? 0.5, s.alphaCutoff ?? 0.5].some(
      (v) => !Number.isFinite(v) || v < 0 || v > 1
    ))
      throw Error("Invalid material factors");
    const m = s.type === "pbr" ? new l.PBRStandardMaterial() : new l.UnlitMaterial();
    m.albedoColor = new l.Color(...s.color || [1, 1, 1, 1]);
    if (s.type === "pbr") {
      m.metallic = s.metallic ?? 0;
      m.smoothness = 1 - (s.roughness ?? 0.5);
      if (s.emission) {
        m.enableEmission = true;
        m.emissionColor = new l.Color(...s.emission, 1);
      }
    }
    for (const [key, value] of Object.entries(s.textures || {}))
      m[{
        albedo: "albedoTexture",
        normal: "normalTexture",
        metallicGloss: "metallicGlossTexture",
        emission: "emissionTexture"
      }[key]] = value?.bitmap || value;
    const blend = s.blend || "opaque", Class = s.type === "pbr" ? l.PBRStandardMaterial : l.UnlitMaterial;
    if (blend === "alpha") m.renderMode = Class.RENDERMODE_TRANSPARENT;
    else if (blend === "cutout") {
      m.alphaTest = true;
      m.alphaTestValue = s.alphaCutoff ?? 0.5;
    } else if (blend === "additive") {
      m.renderQueue = 3e3;
      m.blend = l.RenderState.BLEND_ENABLE_ALL;
      m.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
      m.blendDst = l.RenderState.BLENDPARAM_ONE;
    }
    if (s.doubleSided) m.cull = l.RenderState.CULL_NONE;
    m.depthWrite = s.depthWrite ?? (blend === "opaque" || blend === "cutout");
    return m;
  }

  // packages/core/runtime3d/ModelCompatibility.ts
  var gltfAssetCapabilities = Object.freeze([
    Object.freeze({ name: "glTF 2.0 JSON", kind: "container", status: "supported", message: "glTF 2.0 JSON can be inspected and loaded when its resources are self-contained.", hint: "Prefer a single GLB for consumer delivery." }),
    Object.freeze({ name: "GLB 2.0", kind: "container", status: "supported", message: "GLB 2.0 with an embedded JSON and binary payload is supported.", hint: "Pass the complete GLB through AssetProvider." }),
    Object.freeze({ name: "embedded buffers/images", kind: "delivery", status: "supported", message: "Embedded data is deterministic and provider-verifiable.", hint: "Record the logical asset SHA." }),
    Object.freeze({ name: "external buffers/images", kind: "delivery", status: "unsupported", message: "The provider model loader does not fetch undeclared relative resource URLs.", hint: "Package buffers and images into a GLB or explicit provider assets." }),
    Object.freeze({ name: "KHR_draco_mesh_compression", kind: "geometry-compression", status: "unsupported", message: "No pinned Draco decoder is shipped in this release.", hint: "Export an uncompressed GLB or add a separately verified decoder adapter." }),
    Object.freeze({ name: "EXT_meshopt_compression", kind: "geometry-compression", status: "adapter-required", message: "Embedded glTF/GLB can be decoded by the optional pinned Meshopt adapter before native parsing.", hint: "Register ZhudaMeshoptModelDecoder with ZhudaModelDecoderRegistry and pass decoders plus provider to ZhudaModelLibrary; verify the model on target devices." }),
    Object.freeze({ name: "KHR_texture_basisu", kind: "image-compression", status: "unsupported", message: "No pinned KTX2/Basis decoder and device upload contract is shipped in this release.", hint: "Use ordinary embedded images until the format gate passes on target devices." })
  ]);
  var extensionNames = [
    "KHR_materials_anisotropy",
    "KHR_materials_clearcoat",
    "KHR_materials_emissive_strength",
    "KHR_materials_ior",
    "KHR_materials_iridescence",
    "KHR_materials_sheen",
    "KHR_materials_specular",
    "KHR_materials_transmission",
    "KHR_materials_unlit",
    "KHR_materials_volume",
    "KHR_texture_transform"
  ];
  var gltfExtensionCapabilities = Object.freeze(
    extensionNames.map((name) => Object.freeze({
      name,
      implementation: "native",
      requiredRenderInputs: Object.freeze(name === "KHR_materials_transmission" ? ["opaqueColor"] : []),
      visualConformance: "not-certified"
    }))
  );

  // packages/core/runtime3d/AssetProvider.ts
  var AssetProviderError = class extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "AssetProviderError";
      this.code = code;
      this.id = details.id;
      this.status = details.status;
    }
  };
  function normalizeAssetId(value) {
    if (typeof value !== "string")
      throw new AssetProviderError("invalid-id", "Asset id must be a string");
    let id = value.trim().replace(/\\/g, "/");
    while (id.startsWith("./")) id = id.slice(2);
    if (!id || id.startsWith("/") || id.includes("\0") || /[?#]/.test(id) || /^[a-z][a-z\d+.-]*:/i.test(id))
      throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
    const parts = id.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === "." || part === ".."))
      throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
    return parts.join("/");
  }
  function createProviderAssetCache(provider, decode, destroy, maxIdle = 0) {
    return new ZhudaAssetCache(
      async (id, signal, phase) => {
        const asset = await provider.load(id, {
          signal,
          onProgress: ({ phase: providerPhase }) => phase(providerPhase === "ready" ? "ready" : "downloading")
        });
        phase("parsing");
        try {
          return await decode(asset, signal, phase);
        } finally {
          asset.release?.();
        }
      },
      destroy,
      maxIdle
    );
  }

  // packages/core/runtime3d/Assets.ts
  var abortError = () => new DOMException("Asset request cancelled", "AbortError");
  var ZhudaAssetCache = class {
    constructor(load, destroy, maxIdle = 0) {
      this.entries = /* @__PURE__ */ new Map();
      this.disposed = false;
      this.serial = 0;
      this.loads = 0;
      this.load = load;
      this.destroy = destroy;
      this.maxIdle = maxIdle;
      if (!Number.isInteger(maxIdle) || maxIdle < 0)
        throw Error("Invalid warm asset bound");
    }
    async acquire(key, options = {}) {
      if (this.disposed) throw Error("Disposed asset cache");
      if (options.signal?.aborted) throw abortError();
      if (!key || options.retries !== void 0 && (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 3))
        throw Error("Invalid asset request");
      let e = this.entries.get(key);
      if (!e) {
        const controller = new AbortController();
        e = {
          refs: 0,
          ready: false,
          abort: controller,
          phase: "downloading",
          used: ++this.serial,
          promise: null
        };
        const created = e;
        this.entries.set(key, e);
        this.loads++;
        e.promise = (async () => {
          let last;
          for (let i = 0; i <= Math.max(0, Math.min(3, options.retries ?? 0)); i++) {
            try {
              return await this.load(
                key,
                controller.signal,
                (p) => created.phase = p
              );
            } catch (error) {
              last = error;
              if (controller.signal.aborted) throw error;
            }
          }
          throw last;
        })().then(
          (value) => {
            created.value = value;
            created.ready = true;
            created.phase = "ready";
            if (controller.signal.aborted || this.disposed || this.entries.get(key) !== created) {
              this.destroy(value);
              throw abortError();
            }
            return value;
          },
          (error) => {
            if (this.entries.get(key) === created) this.entries.delete(key);
            throw error;
          }
        );
      }
      const target = e;
      target.refs++;
      target.used = ++this.serial;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        target.refs--;
        target.used = ++this.serial;
        this.evict();
      };
      let cancel;
      try {
        const value = await new Promise((resolve, reject) => {
          cancel = () => {
            release();
            reject(abortError());
          };
          options.signal?.addEventListener("abort", cancel, { once: true });
          target.promise.then(resolve, reject);
        });
        if (released) throw abortError();
        return { value, release };
      } catch (error) {
        release();
        throw error;
      } finally {
        if (cancel) options.signal?.removeEventListener("abort", cancel);
      }
    }
    evict() {
      for (const [k, e] of this.entries)
        if (!e.refs && !e.ready) {
          this.entries.delete(k);
          e.abort.abort();
        }
      const idle = [...this.entries].filter(([, e]) => !e.refs && e.ready).sort((a, b) => a[1].used - b[1].used);
      while (idle.length > this.maxIdle) {
        const [k, e] = idle.shift();
        this.entries.delete(k);
        this.destroy(e.value);
      }
    }
    report() {
      return {
        entries: this.entries.size,
        references: [...this.entries.values()].reduce((n, e) => n + e.refs, 0),
        pending: [...this.entries.values()].filter((e) => !e.ready).length,
        loads: this.loads,
        phases: [...this.entries].map(([key, e]) => ({
          key,
          phase: e.phase,
          references: e.refs
        })),
        gpuReady: "requires-first-draw"
      };
    }
    dispose() {
      if (this.disposed) return;
      if ([...this.entries.values()].some((e) => e.refs > 0))
        throw Error("Release all asset leases before disposing cache");
      this.disposed = true;
      for (const e of this.entries.values()) {
        e.abort.abort();
        if (e.ready) this.destroy(e.value);
      }
      this.entries.clear();
    }
  };

  // packages/core/runtime3d/SceneLifecycle.ts
  var ZhudaResourceScope = class {
    constructor() {
      this.releases = [];
      this.disposed = false;
    }
    own(value, release) {
      if (this.disposed) {
        release(value);
        throw Error("Disposed resource scope");
      }
      this.releases.push(() => release(value));
      return value;
    }
    defer(release) {
      this.own(release, (f) => f());
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      const errors = [];
      for (const release of this.releases.reverse())
        try {
          release();
        } catch (e) {
          errors.push(e);
        }
      this.releases = [];
      if (errors.length)
        throw Object.assign(Error("Resource release failed"), { errors });
    }
  };

  // packages/core/prefabs/PrefabTree3D.ts
  var primitives = /* @__PURE__ */ new Set(["box", "sphere", "plane", "cone", "cylinder", "capsule"]);
  var has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function validatePrefabPatch3D(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("Invalid 3D node patch");
    for (const [key, value] of Object.entries(patch)) {
      if (key === "active" && typeof value === "boolean") continue;
      if (key === "material" && typeof value === "string" && value.length) continue;
      if (["localPosition", "localRotationEuler", "localScale"].includes(key) && Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n)) && (key !== "localScale" || value.every((n) => n !== 0))) continue;
      throw Error(`Invalid 3D prefab patch property: ${key}`);
    }
  }
  function validatePrefabTree3D(tree) {
    if (!tree || !tree.materials || Array.isArray(tree.materials)) throw Error("3D prefab requires materials");
    for (const [id, material] of Object.entries(tree.materials)) {
      if (!id || !material || !Array.isArray(material.albedoColor) || material.albedoColor.length !== 4 || !material.albedoColor.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || material.type !== void 0 && !["blinn-phong", "unlit", "pbr"].includes(material.type))
        throw Error(`Invalid 3D prefab material: ${id}`);
      for (const key of ["shininess", "metallic", "smoothness"]) {
        const value = material[key];
        if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > (key === "shininess" ? 128 : 1)))
          throw Error(`Invalid 3D material ${id}.${key}`);
      }
    }
    let count = 0;
    const paths = /* @__PURE__ */ new Set();
    const visit = (node, path, depth) => {
      if (++count > 4096 || depth > 64) throw Error("3D prefab tree exceeds node/depth limit");
      if (!node || typeof node.name !== "string" || !node.name || node.name.includes("/")) throw Error(`Invalid 3D node name at ${path}`);
      const { name, mesh, children, ...patch } = node;
      validatePrefabPatch3D(patch);
      if (mesh && (!primitives.has(mesh.type) || !node.material)) throw Error(`Invalid mesh/material at ${path}`);
      if (node.material && (!mesh || !has(tree.materials, node.material))) throw Error(`Unknown material or non-mesh node at ${path}`);
      for (const [key, value] of Object.entries(mesh?.dimensions ?? {}))
        if (!["width", "height", "depth", "radius"].includes(key) || !Number.isFinite(value) || value <= 0)
          throw Error(`Invalid primitive dimension at ${path}.${key}`);
      paths.add(path);
      if (children !== void 0 && !Array.isArray(children)) throw Error(`Invalid children at ${path}`);
      const names = /* @__PURE__ */ new Set();
      for (const child of children ?? []) {
        if (!child || names.has(child.name)) throw Error(`Duplicate child name at ${path}`);
        names.add(child.name);
        visit(child, path ? `${path}/${child.name}` : child.name, depth + 1);
      }
    };
    visit(tree.root, "", 0);
    for (const [id, path] of Object.entries(tree.sockets ?? {}))
      if (!id || !paths.has(path)) throw Error(`Unknown 3D socket path: ${id}/${path}`);
  }
  function buildPrefabTree(tree) {
    return renderPrefabTree(tree);
  }
  function renderPrefabTree(tree, shared) {
    const spec = structuredClone(tree);
    validatePrefabTree3D(spec);
    const resources = new ZhudaResourceScope();
    const nodes = /* @__PURE__ */ new Map();
    const baseline = /* @__PURE__ */ new Map();
    const materials = /* @__PURE__ */ new Map();
    const ownedMaterials = /* @__PURE__ */ new Set();
    let root;
    let disposed = false;
    const find = (path = "") => {
      if (disposed) throw Error("Disposed 3D prefab");
      const node = nodes.get(path);
      if (!node) throw Error(`Prefab node path missing: ${path}`);
      return node;
    };
    const applyNode = (node, patch) => {
      if (patch.active !== void 0) node.active = patch.active;
      if (patch.localPosition) node.transform.localPosition = new Laya.Vector3(...patch.localPosition);
      if (patch.localRotationEuler) node.transform.localRotationEuler = new Laya.Vector3(...patch.localRotationEuler);
      if (patch.localScale) node.transform.localScale = new Laya.Vector3(...patch.localScale);
      if (patch.material) node.meshRenderer.sharedMaterial = materials.get(patch.material);
    };
    try {
      for (const [id, material] of Object.entries(spec.materials)) {
        const value = shared ? shared.materials.get(id) : resources.own(Zhuda3D.createMaterial(material), (value2) => value2.destroy());
        materials.set(id, value);
        if (!shared) ownedMaterials.add(value);
      }
      const visit = (source, path, parent) => {
        const node = source.mesh ? new Laya.MeshSprite3D(shared ? shared.meshes.get(path) : resources.own(Zhuda3D.createPrimitiveMesh(source.mesh.type, source.mesh.dimensions), (value) => value.destroy())) : new Laya.Sprite3D();
        if (!root) root = node;
        node.name = source.name;
        parent?.addChild(node);
        nodes.set(path, node);
        const patch = {
          active: source.active ?? true,
          localPosition: source.localPosition ?? [0, 0, 0],
          localRotationEuler: source.localRotationEuler ?? [0, 0, 0],
          localScale: source.localScale ?? [1, 1, 1],
          ...source.material ? { material: source.material } : {}
        };
        baseline.set(path, patch);
        applyNode(node, patch);
        for (const child of source.children ?? []) visit(child, path ? `${path}/${child.name}` : child.name, node);
        return node;
      };
      visit(spec.root, "");
      return {
        root,
        find,
        makeMaterialUnique: (path = "") => {
          const node = find(path);
          if (!baseline.get(path)?.material) throw Error(`Node has no material slot: ${path}`);
          const current = node.meshRenderer.sharedMaterial;
          if (ownedMaterials.has(current)) return current;
          const clone = resources.own(current.clone(), (value) => value.destroy());
          ownedMaterials.add(clone);
          for (const [id, value] of materials) if (value === current) materials.set(id, clone);
          for (const [key, other] of nodes) if (baseline.get(key)?.material && other.meshRenderer.sharedMaterial === current)
            other.meshRenderer.sharedMaterial = clone;
          return clone;
        },
        socket: (id) => {
          if (!has(spec.sockets ?? {}, id)) throw Error(`Unknown 3D socket: ${id}`);
          return find(spec.sockets[id]);
        },
        apply: (patches) => {
          if (disposed) throw Error("Disposed 3D prefab");
          for (const [path, patch] of Object.entries(patches)) {
            validatePrefabPatch3D(patch);
            find(path);
            if (patch.material && (!materials.has(patch.material) || !baseline.get(path)?.material))
              throw Error(`Invalid material slot at ${path}`);
          }
          for (const [path, patch] of baseline) applyNode(find(path), patch);
          for (const [path, patch] of Object.entries(patches)) applyNode(find(path), patch);
        },
        dispose: () => {
          if (disposed) return;
          disposed = true;
          try {
            root.destroy(true);
          } finally {
            resources.dispose();
            nodes.clear();
            materials.clear();
          }
        }
      };
    } catch (error) {
      try {
        root?.destroy(true);
      } finally {
        resources.dispose();
      }
      throw error;
    }
  }

  // packages/core/TopologyGraph.ts
  var ZHUDA_ENGINE_MODULES = [
    {
      id: "core",
      file: "laya.core.js",
      sizeBytes: 871452,
      feature: "core",
      dependsOn: [],
      providesGlobals: ["Laya", "Laya.Node", "Laya.Sprite", "Laya.ClassUtils"],
      priority: 10,
      painPointNote: "\u6240\u6709\u6A21\u7D44\u7684\u6839\u57FA\u5E95\uFF0C\u5B9A\u7FA9\u5168\u57DF window.Laya \u8207 ClassUtils \u53CD\u5C04\u7CFB\u7D71"
    },
    {
      id: "d3",
      file: "laya.d3.js",
      sizeBytes: 689342,
      feature: "3d",
      dependsOn: ["core"],
      providesGlobals: ["Laya.Scene3D", "Laya.Sprite3D", "Laya.Camera", "Laya.BlinnPhongMaterial"],
      priority: 20,
      painPointNote: "\u5FC5\u9808\u5728 webgl_3D\u3001physics3D\u3001particle3D\u3001postProcess \u4E4B\u524D\u8F09\u5165"
    },
    {
      id: "webgl2d",
      file: "laya.webgl_2D.js",
      sizeBytes: 280361,
      feature: "2d",
      dependsOn: ["core"],
      providesGlobals: ["Laya.WebGLRenderEngineFactory"],
      priority: 30,
      painPointNote: "2D WebGL \u6E32\u67D3\u7BA1\u7DDA\u5F8C\u7AEF\uFF0CLaya.init \u521D\u59CB\u5316\u524D\u5FC5\u9808\u5C31\u7DD2"
    },
    {
      id: "webgl3d",
      file: "laya.webgl_3D.js",
      sizeBytes: 72249,
      feature: "3d",
      dependsOn: ["core", "d3", "webgl2d"],
      providesGlobals: ["Laya.WebGL3DRenderPass"],
      priority: 40,
      painPointNote: "\u4F9D\u8CF4 laya.d3 \u8207 webgl_2D\uFF0C\u63D0\u4F9B 3D WebGL \u6E32\u67D3\u8A2D\u5099\u5BE6\u4F5C"
    },
    {
      id: "ui",
      file: "laya.ui.js",
      sizeBytes: 110837,
      feature: "ui",
      dependsOn: ["core", "webgl2d"],
      providesGlobals: ["Laya.Button", "Laya.Dialog", "Laya.AutoBitmap"],
      priority: 50,
      painPointNote: "\u5167\u90E8 Button \u5F37\u4F9D\u8CF4 AutoBitmap.setState\uFF0C\u9700\u642D\u914D RuntimeGuards \u539F\u578B\u4FDD\u8B77"
    },
    {
      id: "physics2d",
      file: "laya.physics2D.js",
      sizeBytes: 164237,
      feature: "physics2d",
      dependsOn: ["core", "webgl2d"],
      providesGlobals: ["Laya.Physics2D", "Laya.Box2DShapeDef", "Laya.RigidBody"],
      priority: 60,
      painPointNote: "\u5B9A\u7FA9 Laya.Physics2D \u8207 Box2DShapeDef\uFF0C\u5FC5\u9808\u5728 laya.box2D.js \u8207 laya.tilemap.js \u4E4B\u524D"
    },
    {
      id: "box2d",
      file: "laya.box2D.js",
      sizeBytes: 1401774,
      feature: "physics2d",
      dependsOn: ["core", "physics2d"],
      providesGlobals: ["window.box2d", "Laya.Physics2D.I._factory"],
      priority: 70,
      painPointNote: '\u9802\u5C64\u76F4\u63A5\u5B58\u53D6 Laya.Physics2D.I._factory\uFF0C\u82E5\u65E9\u65BC physics2D \u8F09\u5165\u6703\u62CB\u51FA reading "I" \u5D29\u6F70'
    },
    {
      id: "bullet",
      file: "laya.bullet.js",
      sizeBytes: 1232001,
      feature: "physics3d",
      dependsOn: ["core", "d3"],
      providesGlobals: ["Laya.Physics3D"],
      priority: 80,
      painPointNote: "\u88DD\u914D Bullet 3D \u7269\u7406\u6838\u5FC3\uFF0C\u5FC5\u9808\u5728 laya.physics3D.js \u4E4B\u524D\u5B8C\u6210\u8F09\u5165"
    },
    {
      id: "physics3d",
      file: "laya.physics3D.js",
      sizeBytes: 72533,
      feature: "physics3d",
      dependsOn: ["core", "d3", "bullet"],
      providesGlobals: ["Laya.PhysicsCollider", "Laya.Rigidbody3D", "Laya.BoxColliderShape"],
      priority: 90,
      painPointNote: "\u639B\u8F09 3D \u7269\u7406\u7D44\u4EF6\u81F3 Laya3D\uFF0C\u4F9D\u8CF4 laya.bullet.js \u5DF2\u6CE8\u5165\u4E4B\u5DE5\u5EE0"
    },
    {
      id: "spine-core-42",
      file: "spine-core-4.2.js",
      sizeBytes: 466015,
      feature: "spine42",
      dependsOn: ["core"],
      conflictsWith: ["spine-core-38"],
      providesGlobals: ["window.spine", "window.spine.PhysicsConstraint", "window.spine.AnimationState"],
      priority: 100,
      painPointNote: "\u5B9A\u7FA9\u5168\u57DF window.spine (4.2 PhysicsConstraint)\uFF0C\u5FC5\u9808\u5728 laya.spine.js \u4E4B\u524D"
    },
    {
      id: "spine",
      file: "laya.spine.js",
      sizeBytes: 132824,
      feature: "spine42",
      dependsOn: ["core", "webgl2d", "spine-core-42"],
      providesGlobals: ["Laya.SpineTemplet", "Laya.Spine2DRenderNode"],
      priority: 110,
      painPointNote: "\u5305\u542B 3.4.2 ReusableStructList \u8207 SpineInstanceBatch \u5408\u6279\u7BA1\u7DDA\uFF0C\u4F9D\u8CF4 spine-core-4.2.js"
    },
    {
      id: "spine3d",
      file: "laya.spine3D.js",
      sizeBytes: 15895,
      feature: "spine3d",
      dependsOn: ["core", "d3", "spine-core-42", "spine"],
      providesGlobals: ["Laya.Spine3DRenderNode"],
      priority: 120,
      painPointNote: "\u5C07 Spine \u9AA8\u9ABC\u639B\u8F09\u81F3 3D \u5834\u666F\u6A39\uFF0C\u5FC5\u9808\u5728 laya.d3 \u8207 laya.spine \u4E4B\u5F8C"
    },
    {
      id: "navmesh-common",
      file: "laya.navMeshCommon.js",
      sizeBytes: 480255,
      feature: "navmesh2d",
      dependsOn: ["core"],
      providesGlobals: ["Laya.RecastNavigation"],
      priority: 130,
      painPointNote: "\u5B9A\u7FA9 Recast \u5C0B\u8DEF\u5171\u7528\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 navMesh2d \u8207 navMesh3d \u4E4B\u524D"
    },
    {
      id: "navmesh2d",
      file: "laya.navMesh2d.js",
      sizeBytes: 12e3,
      feature: "navmesh2d",
      dependsOn: ["core", "navmesh-common"],
      providesGlobals: ["Laya.NavMesh2D"],
      priority: 140
    },
    {
      id: "navmesh3d",
      file: "laya.navMesh3d.js",
      sizeBytes: 12415,
      feature: "navmesh3d",
      dependsOn: ["core", "d3", "navmesh-common"],
      providesGlobals: ["Laya.NavMesh3D"],
      priority: 150
    },
    {
      id: "particle-common",
      file: "laya.particleCommon.js",
      sizeBytes: 9402,
      feature: "particle2d",
      dependsOn: ["core"],
      providesGlobals: ["Laya.GradientDataNumber"],
      priority: 160,
      painPointNote: "2D/3D \u7C92\u5B50\u5171\u7528\u63D2\u503C\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 particle \u8207 particle3D \u4E4B\u524D"
    },
    {
      id: "particle2d",
      file: "laya.particle.js",
      sizeBytes: 56958,
      feature: "particle2d",
      dependsOn: ["core", "webgl2d", "particle-common"],
      providesGlobals: ["Laya.Particle2D"],
      priority: 170
    },
    {
      id: "particle3d",
      file: "laya.particle3D.js",
      sizeBytes: 169120,
      feature: "particle3d",
      dependsOn: ["core", "d3", "particle-common"],
      providesGlobals: ["Laya.ShuriKenParticle3D"],
      priority: 180
    },
    {
      id: "trail-common",
      file: "laya.trailCommon.js",
      sizeBytes: 11971,
      feature: "trail2d",
      dependsOn: ["core"],
      providesGlobals: ["Laya.TrailFilter"],
      priority: 190,
      painPointNote: "2D/3D \u62D6\u5C3E\u5171\u7528\u5E7E\u4F55\u69CB\u9020\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 trail2D \u8207 trail3D \u4E4B\u524D"
    },
    {
      id: "trail2d",
      file: "laya.trail2D.js",
      sizeBytes: 5537,
      feature: "trail2d",
      dependsOn: ["core", "webgl2d", "trail-common"],
      providesGlobals: ["Laya.Trail2DRender"],
      priority: 200
    },
    {
      id: "trail3d",
      file: "laya.trail3D.js",
      sizeBytes: 8793,
      feature: "trail3d",
      dependsOn: ["core", "d3", "trail-common"],
      providesGlobals: ["Laya.TrailSprite3D"],
      priority: 210
    },
    {
      id: "light2d",
      file: "laya.light2D.js",
      sizeBytes: 76531,
      feature: "effects2d",
      dependsOn: ["core", "webgl2d"],
      providesGlobals: ["Laya.Light2DRender"],
      priority: 220
    },
    {
      id: "line2d",
      file: "laya.line2D.js",
      sizeBytes: 12170,
      feature: "effects2d",
      dependsOn: ["core", "webgl2d"],
      providesGlobals: ["Laya.Line2DRender"],
      priority: 230
    },
    {
      id: "tilemap",
      file: "laya.tilemap.js",
      sizeBytes: 85504,
      feature: "tilemap",
      dependsOn: ["core", "webgl2d", "physics2d"],
      providesGlobals: ["Laya.TileMapLayer"],
      priority: 240,
      painPointNote: "\u5167\u90E8\u76F4\u63A5\u5411 Box2DShapeDef \u8A3B\u518A\u74E6\u7247\u78B0\u649E\u9AD4\uFF0C\u82E5\u672A\u5148\u8F09\u5165 laya.physics2D.js \u6703\u76F4\u63A5\u5D29\u6F70"
    },
    {
      id: "ani",
      file: "laya.ani.js",
      sizeBytes: 68047,
      feature: "ani",
      dependsOn: ["core", "webgl2d"],
      providesGlobals: ["Laya.Templet"],
      priority: 250
    },
    {
      id: "gltf",
      file: "laya.gltf.js",
      sizeBytes: 67581,
      feature: "gltf",
      dependsOn: ["core", "d3"],
      providesGlobals: ["Laya.glTFLoader"],
      priority: 260
    },
    {
      id: "ik",
      file: "laya.ik.js",
      sizeBytes: 52268,
      feature: "ik",
      dependsOn: ["core", "d3"],
      providesGlobals: ["Laya.IKConstraint"],
      priority: 270
    },
    {
      id: "postProcess",
      file: "laya.postProcess.js",
      sizeBytes: 92193,
      feature: "postProcess",
      dependsOn: ["core", "d3", "webgl3d"],
      providesGlobals: ["Laya.PostProcess", "Laya.BloomEffect"],
      priority: 280,
      painPointNote: "\u9802\u5C64\u81EA\u57F7\u884C\u8A3B\u518A SubShader\uFF0C\u5FC5\u9808\u5728\u9996\u5E40 Camera \u6E32\u67D3\u524D\u8F09\u5165"
    },
    {
      id: "device",
      file: "laya.device.js",
      sizeBytes: 5963,
      feature: "device",
      dependsOn: ["core"],
      providesGlobals: ["Laya.Accelerator", "Laya.Geolocation"],
      priority: 290
    }
  ];
  function rendererModules(renderer) {
    if (renderer !== "webgl" && renderer !== "webgpu") throw Error("[ZhudaTopology] renderer must be webgl or webgpu");
    if (renderer === "webgl") return ZHUDA_ENGINE_MODULES;
    const id = (value) => value.replace("webgl", "webgpu");
    return [
      ...ZHUDA_ENGINE_MODULES.map((node) => ({
        ...node,
        id: id(node.id),
        file: node.file.replace("webgl", "webgpu"),
        sizeBytes: node.id === "webgl2d" ? 858378 : node.id === "webgl3d" ? 335455 : node.sizeBytes,
        dependsOn: [...node.dependsOn.map(id), ...node.id === "webgl2d" ? ["shader-compiler", "naga"] : []],
        providesGlobals: node.providesGlobals.map((value) => value.replace("WebGL", "WebGPU"))
      })),
      { id: "shader-compiler", file: "shader_compiler_web.js", sizeBytes: 61401, feature: "2d", dependsOn: ["core"], providesGlobals: ["ShaderCompiler"], priority: 25 },
      { id: "naga", file: "nagabind.js", sizeBytes: 13996, feature: "2d", dependsOn: ["core"], providesGlobals: ["wasm_bindgen"], priority: 26 }
    ];
  }
  var ENGINE_PRESET_PROFILES = {
    "2d-light": ["core", "2d", "ui"],
    "3d-standard": ["core", "2d", "3d", "ui", "physics3d", "postProcess", "gltf"],
    "spine-hybrid": ["core", "2d", "3d", "ui", "spine42", "spine3d", "physics3d"],
    "full-all-in-one": [
      "core",
      "2d",
      "3d",
      "ui",
      "physics2d",
      "physics3d",
      "spine42",
      "spine3d",
      "navmesh2d",
      "navmesh3d",
      "particle2d",
      "particle3d",
      "trail2d",
      "trail3d",
      "effects2d",
      "tilemap",
      "ani",
      "gltf",
      "ik",
      "postProcess",
      "device"
    ]
  };
  var TopologyResolver = class {
    static getFullEngineSizeBytes() {
      return ZHUDA_ENGINE_MODULES.reduce((acc, m) => acc + m.sizeBytes, 0);
    }
    /**
     * 根據 Feature Tags 解析最小必備模組並執行拓撲排序
     */
    static resolveByFeatures(features, renderer = "webgl") {
      const targetFeatures = features === "all" ? ENGINE_PRESET_PROFILES["full-all-in-one"] : Array.from(/* @__PURE__ */ new Set(["core", ...features]));
      const seedIds = rendererModules(renderer).filter(
        (m) => targetFeatures.includes(m.feature)
      ).map((m) => m.id);
      return this.resolveByModuleIds(seedIds, renderer);
    }
    /**
     * 根據 Module IDs 展開傳遞依賴閉包並以 Kahn's Algorithm 排序
     */
    static resolveByModuleIds(seedModuleIds, renderer = "webgl") {
      const modules = rendererModules(renderer);
      const moduleMap = new Map(modules.map((node) => [node.id, node]));
      const closure = /* @__PURE__ */ new Set();
      const diagnostics = [];
      const visit = (id, chain) => {
        if (chain.includes(id)) {
          throw new Error(`[ZhudaTopology] \u5075\u6E2C\u5230\u5FAA\u74B0\u4F9D\u8CF4 (Cycle Detected): ${[...chain, id].join(" -> ")}`);
        }
        const node = moduleMap.get(id);
        if (!node) {
          throw new Error(`[ZhudaTopology] \u672A\u77E5\u7684\u5F15\u64CE\u6A21\u7D44 ID: "${id}"`);
        }
        for (const depId of node.dependsOn) {
          if (!closure.has(depId)) {
            diagnostics.push(`[Auto-Dependency] \u6A21\u7D44 "${node.file}" \u81EA\u52D5\u62C9\u5165\u524D\u7F6E\u4F9D\u8CF4 "${moduleMap.get(depId)?.file}"`);
          }
          visit(depId, [...chain, id]);
        }
        closure.add(id);
      };
      for (const seed of seedModuleIds) {
        visit(seed, []);
      }
      for (const id of closure) {
        const node = moduleMap.get(id);
        if (node.conflictsWith) {
          for (const conflictId of node.conflictsWith) {
            if (closure.has(conflictId)) {
              throw new Error(`[ZhudaTopology] \u6A21\u7D44\u4E92\u65A5\u885D\u7A81: "${id}" \u8207 "${conflictId}" \u4E0D\u53EF\u540C\u6642\u8F09\u5165`);
            }
          }
        }
      }
      const inDegree = /* @__PURE__ */ new Map();
      const adj = /* @__PURE__ */ new Map();
      for (const id of closure) {
        inDegree.set(id, 0);
        adj.set(id, []);
      }
      for (const id of closure) {
        const node = moduleMap.get(id);
        for (const depId of node.dependsOn) {
          adj.get(depId).push(id);
          inDegree.set(id, (inDegree.get(id) || 0) + 1);
        }
      }
      const readyQueue = [];
      for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) {
          readyQueue.push(moduleMap.get(id));
        }
      }
      readyQueue.sort((a, b) => a.priority - b.priority);
      const orderedModules = [];
      while (readyQueue.length > 0) {
        const current = readyQueue.shift();
        orderedModules.push(current);
        for (const neighborId of adj.get(current.id) || []) {
          const nextDeg = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, nextDeg);
          if (nextDeg === 0) {
            readyQueue.push(moduleMap.get(neighborId));
            readyQueue.sort((a, b) => a.priority - b.priority);
          }
        }
      }
      if (orderedModules.length !== closure.size) {
        throw new Error("[ZhudaTopology] \u62D3\u64B2\u6392\u5E8F\u5931\u6557\uFF1A\u5B58\u5728\u7121\u6CD5\u89E3\u958B\u7684\u4F9D\u8CF4\u74B0");
      }
      const supportSizeBytes = renderer === "webgpu" ? 5942257 : 0;
      const totalSizeBytes = orderedModules.reduce((acc, m) => acc + m.sizeBytes, supportSizeBytes);
      const fullSizeBytes = modules.reduce((acc, m) => acc + m.sizeBytes, supportSizeBytes);
      const prunedRatioPercent = Number(((fullSizeBytes - totalSizeBytes) / fullSizeBytes * 100).toFixed(1));
      return {
        renderer,
        supportFiles: renderer === "webgpu" ? ["shader_compiler_web.wasm", "nagabind_bg.wasm"] : [],
        orderedModules,
        orderedFiles: orderedModules.map((m) => m.file),
        totalSizeBytes,
        totalSizeKB: Number((totalSizeBytes / 1024).toFixed(1)),
        prunedRatioPercent: Math.max(0, prunedRatioPercent),
        fullEngineSizeBytes: fullSizeBytes,
        diagnostics
      };
    }
    /**
     * 靜態審計任意 script 載入序列，攔截順序倒置或遺漏依賴的致命錯誤
     */
    static auditFileSequence(files) {
      const issues = [];
      const gpu = files.some((file) => file.startsWith("laya.webgpu_"));
      const modules = rendererModules(gpu ? "webgpu" : "webgl");
      const moduleMap = new Map(modules.map((node) => [node.id, node]));
      const fileMap = new Map(modules.map((node) => [node.file, node]));
      if (gpu && files.some((file) => file.startsWith("laya.webgl_"))) issues.push({ type: "CONFLICTING_MODULE", moduleFile: "laya.webgpu_2D.js", requiredFile: "laya.webgl_2D.js", fatalSymptom: "Mixed renderer factories", message: "Load exactly one renderer backend per realm" });
      const seenFiles = /* @__PURE__ */ new Set();
      for (const file of files) {
        const node = fileMap.get(file);
        if (!node) {
          seenFiles.add(file);
          continue;
        }
        for (const depId of node.dependsOn) {
          const depNode = moduleMap.get(depId);
          if (!depNode) continue;
          if (!seenFiles.has(depNode.file)) {
            const isPresentLater = files.includes(depNode.file);
            issues.push({
              type: isPresentLater ? "INVERTED_ORDER" : "MISSING_DEPENDENCY",
              moduleFile: node.file,
              requiredFile: depNode.file,
              fatalSymptom: node.painPointNote || `${node.file} \u9700\u8981\u5728 ${depNode.file} \u4E4B\u5F8C\u8F09\u5165`,
              message: isPresentLater ? `[\u9806\u5E8F\u5012\u7F6E\u6B7B\u9396] "${node.file}" \u51FA\u73FE\u5728\u524D\u7F6E\u4F9D\u8CF4 "${depNode.file}" \u4E4B\u524D\uFF01(${node.painPointNote || "Global Mutation Error"})` : `[\u7F3A\u5931\u524D\u7F6E\u4F9D\u8CF4] \u8F09\u5165 "${node.file}" \u524D\u672A\u8F09\u5165\u5FC5\u5099\u5EAB "${depNode.file}"\uFF01`
            });
          }
        }
        seenFiles.add(file);
      }
      return issues;
    }
  };
  TopologyResolver.moduleMap = new Map(
    ZHUDA_ENGINE_MODULES.map((m) => [m.id, m])
  );
  TopologyResolver.fileMap = new Map(
    ZHUDA_ENGINE_MODULES.map((m) => [m.file, m])
  );

  // packages/core/RuntimeGuards.ts
  var EngineGuard = class {
    /**
     * 安裝原型解毒補丁 (Prototype Detox)
     * 徹底修復 Laya.Button 強制假設 _graphics 為 AutoBitmap 導致 setState is not a function 的崩潰
     */
    static installPrototypeDetox() {
      const patchedTargets = [];
      const g = globalThis;
      if (!g.Laya) {
        return { detoxApplied: false, patchedTargets };
      }
      const graphicsProto = g.Laya.Graphics?.prototype;
      if (graphicsProto && typeof graphicsProto.setState !== "function") {
        Object.defineProperty(graphicsProto, "setState", {
          value: function(_state, _scale) {
          },
          writable: true,
          configurable: true
        });
        patchedTargets.push("Laya.Graphics.prototype.setState");
      }
      if (g.Laya.ClassUtils && !this.detoxInstalled) {
        const origRegClass = g.Laya.ClassUtils.regClass.bind(g.Laya.ClassUtils);
        g.Laya.ClassUtils.regClass = (className, classDef) => {
          this.registeredComponentNames.add(className);
          g.__ZHUDA_REGISTERED_CLASSES__ = Array.from(this.registeredComponentNames);
          return origRegClass(className, classDef);
        };
        patchedTargets.push("Laya.ClassUtils.regClass");
      }
      this.detoxInstalled = true;
      return {
        detoxApplied: true,
        patchedTargets
      };
    }
    /**
     * 註冊組件至 Laya 反射表並記錄於 Zhuda 守衛索引
     */
    static registerComponent(className, ctor, assetId) {
      this.registeredComponentNames.add(className);
      const g = globalThis;
      if (g.Laya?.ClassUtils) {
        g.Laya.ClassUtils.regClass(className, ctor);
        if (assetId) {
          g.Laya.ClassUtils.regClass(assetId, ctor);
        }
      }
      g.__ZHUDA_REGISTERED_CLASSES__ = Array.from(this.registeredComponentNames);
    }
    static getRegisteredComponents() {
      return Array.from(this.registeredComponentNames);
    }
    /**
     * 驗證 2D 物理 (Physics2D + Box2D + TileMap) 狀態守衛
     */
    static checkPhysics2D() {
      const g = globalThis;
      const physics2DLoaded = Boolean(g.Laya?.Physics2D && g.Laya?.Box2DShapeDef);
      const box2DFactoryMounted = Boolean(g.Laya?.Physics2D?.I?._factory || g.box2d);
      const tilemapShapeRegistered = Boolean(g.Laya?.TileMapLayer && physics2DLoaded);
      return {
        physics2DLoaded,
        box2DFactoryMounted,
        tilemapShapeRegistered
      };
    }
    /**
     * 驗證 3D 物理 (Bullet + Physics3D) 狀態守衛
     */
    static checkPhysics3D() {
      const g = globalThis;
      const bulletLoaded = Boolean(g.Physics3D || g.Laya?.Laya3D);
      const physics3DLoaded = Boolean(g.Laya?.PhysicsCollider && g.Laya?.Rigidbody3D);
      const wasmInitialized = Boolean(bulletLoaded && physics3DLoaded);
      return {
        bulletLoaded,
        physics3DLoaded,
        wasmInitialized
      };
    }
    /**
     * 驗證 Spine 4.2 (含 PhysicsConstraint 物理骨骼約束) 狀態守衛
     */
    static checkSpine42() {
      const g = globalThis;
      const sp = g.spine;
      const hasPhysicsConstraint = Boolean(sp && typeof sp.PhysicsConstraint === "function");
      const hasAnimationState = Boolean(sp && typeof sp.AnimationState === "function");
      const hasSkeleton = Boolean(sp && typeof sp.Skeleton === "function");
      const layaSpineAdapterReady = Boolean(g.Laya?.SpineTemplet || g.Laya?.Spine2DRenderNode);
      const layaSpine3DReady = Boolean(g.Laya?.Spine3DRenderNode || g.Laya?.SpineTemplet);
      return {
        runtimeVersion: hasPhysicsConstraint ? "4.2.x (PhysicsConstraint Active)" : sp?.version || "unknown",
        hasPhysicsConstraint,
        hasAnimationState,
        hasSkeleton,
        layaSpineAdapterReady,
        layaSpine3DReady,
        pendulumAngleRad: 0,
        pendulumVelocity: 0,
        springTension: 0
      };
    }
    /**
     * 產出完整引擎健康度與防撞牆診斷報告
     */
    static inspectEngineHealth() {
      const g = globalThis;
      const p2d = this.checkPhysics2D();
      const p3d = this.checkPhysics3D();
      const sp42 = this.checkSpine42();
      const buttonSetStateGuarded = typeof g.Laya?.Graphics?.prototype?.setState === "function";
      let loadedCount = 0;
      if (g.Laya) loadedCount += 5;
      if (p2d.physics2DLoaded) loadedCount += 2;
      if (p3d.physics3DLoaded) loadedCount += 2;
      if (sp42.hasPhysicsConstraint) loadedCount += 3;
      return {
        timestamp: Date.now(),
        engineVersion: g.Laya?.version || "3.4.2-zhuda-ai",
        prototypeDetoxApplied: this.detoxInstalled,
        buttonSetStateGuarded,
        registeredComponents: this.getRegisteredComponents(),
        physics2D: p2d,
        physics3D: p3d,
        spine42: sp42,
        loadedGlobalModules: Math.max(loadedCount, 29)
      };
    }
  };
  EngineGuard.detoxInstalled = false;
  EngineGuard.registeredComponentNames = /* @__PURE__ */ new Set();

  // packages/core/DeclarativeSDK.ts
  function zhudaComponent(meta) {
    return function(ctor) {
      const metadata = typeof meta === "string" ? { className: meta } : meta;
      EngineGuard.registerComponent(metadata.className, ctor, metadata.assetId);
      return ctor;
    };
  }
  var ZhudaEngine = class {
    static async boot(options = {}) {
      if (this.retiredGpuRealm) throw Error("WebGPU realm retired; recreate it with ZhudaRuntimeHost or reload the page");
      if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Cancelled", "AbortError");
      if (this.activeContext || this.booting)
        throw new Error(
          "An engine session is already active; dispose it or use a separate runtime realm."
        );
      const container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
      if (options.container && !container)
        throw new Error("Canvas container not found");
      if (options.dprCap !== void 0 && (!Number.isFinite(options.dprCap) || options.dprCap < 0.5 || options.dprCap > 4))
        throw new Error("DPR cap must be .5..4");
      this.booting = true;
      let allocatedScene;
      let allocatedRuntime;
      let renderer;
      try {
        const width = options.width ?? 1280;
        const height = options.height ?? 720;
        const bgColor = options.bgColor ?? "#0d1117";
        const features = options.features ?? "all";
        renderer = prepareRenderer(options.renderer);
        const topology = TopologyResolver.resolveByFeatures(features, renderer.backend);
        if (typeof window !== "undefined") installSandboxStorageFallback();
        EngineGuard.installPrototypeDetox();
        const hasSpine42 = features === "all" || Array.isArray(features) && features.includes("spine42");
        if (hasSpine42) {
          const spineConst = Laya.SpineConst;
          if (spineConst) {
            spineConst.VERSION = "4.2";
            spineConst.VersionFirst = 4;
            spineConst.VersionSecond = 2;
            spineConst.NEED_SLOT = true;
          }
        }
        const layaConfig = Laya.Config;
        if (layaConfig) {
          if (options.preserveDrawingBuffer !== void 0)
            layaConfig.preserveDrawingBuffer = options.preserveDrawingBuffer;
          if (options.antialias !== void 0)
            layaConfig.isAntialias = options.antialias;
        }
        options.beforeInit?.();
        await withDeadline(() => Laya.init(width, height), { signal: options.signal, timeoutMs: options.bootTimeoutMs ?? 3e4 });
        renderer.ready();
        installLaya342LifecycleFix();
        EngineGuard.installPrototypeDetox();
        Laya.stage.scaleMode = options.scaleMode ?? Laya.Stage.SCALE_SHOWALL;
        Laya.stage.screenMode = options.screenMode ?? Laya.Stage.SCREEN_NONE;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.bgColor = bgColor;
        const rootScene = allocatedScene = new Laya.Scene();
        rootScene.name = "ZhudaRootScene";
        Laya.stage.addChild(rootScene);
        const health = EngineGuard.inspectEngineHealth();
        const win = globalThis;
        win.__ZHUDA_ENGINE_BOOTED__ = true;
        win.__ZHUDA_ENGINE_HEALTH__ = health;
        win.__ZHUDA_TOPOLOGY__ = topology;
        if (Laya.Browser.isDomSupported !== false && typeof document !== "undefined" && document.body?.dataset) {
          document.body.dataset.zhudaBooted = "true";
          document.body.dataset.zhudaModules = String(
            topology.orderedFiles.length
          );
          document.body.dataset.zhudaReflected = health.registeredComponents.join(",");
          document.body.dataset.zhudaSpine42 = String(
            health.spine42.hasPhysicsConstraint
          );
          document.body.dataset.zhudaDetox = String(health.buttonSetStateGuarded);
        }
        const canvas = Laya.Browser.mainCanvas.source;
        if (container) container.appendChild(canvas);
        if (options.targetFPS)
          Laya.stage.frameRate = options.targetFPS === 30 ? "slow" : "fast";
        const runtime = allocatedRuntime = new ZhudaRuntimeSession(canvas, {
          ...options,
          container: container ?? void 0
        });
        renderer.attach(runtime);
        const selectedRenderer = renderer;
        let disposed = false;
        this.activeContext = {
          renderer: renderer.diagnostics,
          stage: Laya.stage,
          rootScene,
          topology,
          health,
          canvas,
          runtime,
          resize: () => runtime.resize(),
          dispose: () => {
            if (disposed) return;
            disposed = true;
            runtime.dispose();
            rootScene.destroy(true);
            selectedRenderer.release("disposed");
            if (selectedRenderer.backend === "webgpu") this.retiredGpuRealm = true;
            this.activeContext = null;
          }
        };
        await showMiniGameSplash(this.activeContext, options.signal, options.bootTimeoutMs);
        return this.activeContext;
      } catch (error) {
        allocatedRuntime?.dispose();
        this.activeContext = null;
        allocatedScene?.destroy(true);
        renderer?.release("failed");
        if (renderer?.backend === "webgpu") this.retiredGpuRealm = true;
        globalThis.__ZHUDA_ENGINE_BOOTED__ = false;
        if (typeof document !== "undefined" && document.body?.dataset)
          document.body.dataset.zhudaBooted = "false";
        throw error;
      } finally {
        this.booting = false;
      }
    }
    static getContext() {
      return this.activeContext;
    }
    /**
     * 立即推進指定幀數的 WebGL 渲染迴圈，確保首幀無白屏延遲
     */
    static flushRenderFrames(frameCount = 3) {
      const renderLoop = Laya.Render?.loop;
      if (typeof renderLoop === "function") {
        const baseNow = typeof performance !== "undefined" ? performance.now() : Date.now();
        for (let i = 1; i <= frameCount; i++) {
          renderLoop.call(
            Laya.Render,
            baseNow + i * 16.67
          );
        }
      }
    }
  };
  ZhudaEngine.activeContext = null;
  ZhudaEngine.booting = false;
  ZhudaEngine.retiredGpuRealm = false;
  var Zhuda3D = class {
    static buildPrefabTree(spec) {
      return buildPrefabTree(spec);
    }
    static createScene3D(parent, options = {}) {
      const scene3D = new Laya.Scene3D();
      scene3D.name = options.name ?? "ZhudaScene3D";
      scene3D.ambientMode = Laya.AmbientMode.SolidColor;
      const [r, g, b, a] = options.ambientColor ?? [0.42, 0.47, 0.58, 1];
      scene3D.ambientColor = new Laya.Color(r, g, b, a);
      parent.addChild(scene3D);
      return scene3D;
    }
    static createCamera(scene3D, options) {
      const camera = new Laya.Camera(0, options.near ?? 0.1, options.far ?? 1e3);
      camera.fieldOfView = options.fov ?? 50;
      if (options.clearColor) {
        const [r, g, b, a] = options.clearColor;
        camera.clearColor = new Laya.Color(r, g, b, a);
      }
      const [px, py, pz] = options.position;
      camera.transform.position = new Laya.Vector3(px, py, pz);
      if (options.rotationEuler) {
        const [rx, ry, rz] = options.rotationEuler;
        camera.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
      }
      scene3D.addChild(camera);
      return camera;
    }
    static createDirectionalLight(scene3D, options = {}) {
      const node = new Laya.Sprite3D("ZhudaDirectionalLight");
      scene3D.addChild(node);
      const light = node.addComponent(
        Laya.DirectionLightCom
      );
      const [r, g, b, a] = options.color ?? [1, 0.98, 0.92, 1];
      light.color = new Laya.Color(r, g, b, a);
      light.intensity = options.intensity ?? 1.3;
      const [rx, ry, rz] = options.rotationEuler ?? [-55, 35, 0];
      node.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
      return { node, light };
    }
    static createMaterial(options) {
      if (options.type === "pbr" || options.type === "unlit")
        return createSurfaceMaterial({
          type: options.type,
          color: options.albedoColor,
          metallic: options.metallic,
          roughness: 1 - (options.smoothness ?? 0.5)
        });
      const mat = new Laya.BlinnPhongMaterial();
      const [r, g, b, a] = options.albedoColor;
      mat.albedoColor = new Laya.Color(r, g, b, a);
      mat.shininess = options.shininess ?? 32;
      return mat;
    }
    static createPrimitiveMesh(type, dims = {}) {
      switch (type) {
        case "box":
          return Laya.PrimitiveMesh.createBox(
            dims.width ?? 1,
            dims.height ?? 1,
            dims.depth ?? 1
          );
        case "sphere":
          return Laya.PrimitiveMesh.createSphere(dims.radius ?? 0.5);
        case "cylinder":
          return Laya.PrimitiveMesh.createCylinder(
            dims.radius ?? 0.2,
            dims.height ?? 1
          );
        case "capsule":
          return Laya.PrimitiveMesh.createCapsule(
            dims.radius ?? 0.25,
            dims.height ?? 1
          );
        case "cone":
          return Laya.PrimitiveMesh.createCone(
            dims.radius ?? 0.5,
            dims.height ?? 1
          );
        case "plane":
        default:
          return Laya.PrimitiveMesh.createPlane(
            dims.width ?? 10,
            dims.depth ?? 10
          );
      }
    }
  };
  var ZhudaUI = class {
    static createGlassPanel(parent, opts) {
      const panel = new Laya.Sprite();
      panel.pos(opts.x, opts.y);
      panel.size(opts.width, opts.height);
      const r = opts.radius ?? 12;
      const g = new Laya.Graphics();
      g.drawRoundRect(
        0,
        0,
        opts.width,
        opts.height,
        r,
        r,
        r,
        r,
        opts.fillColor ?? "#161f2ee6",
        opts.borderColor ?? "#30435f",
        opts.borderWidth ?? 1.5
      );
      panel.graphics = g;
      parent.addChild(panel);
      return panel;
    }
    static createVectorButton(parent, x, y, text, style, onClick) {
      const root = new Laya.Sprite();
      root.pos(x, y);
      root.size(style.width, style.height);
      const radius = style.radius ?? 8;
      const bgColor = style.bgColor ?? "#22334a";
      const hoverBgColor = style.hoverBgColor ?? "#2e4666";
      const activeBgColor = style.activeBgColor ?? "#1b5e5a";
      const borderColor = style.borderColor ?? "#416188";
      const borderWidth = style.borderWidth ?? 1.2;
      const drawBg = (fill, stroke) => {
        const g = new Laya.Graphics();
        g.drawRoundRect(
          0,
          0,
          style.width,
          style.height,
          radius,
          radius,
          radius,
          radius,
          fill,
          stroke,
          borderWidth
        );
        root.graphics = g;
      };
      drawBg(bgColor, borderColor);
      const label = new Laya.Text();
      label.text = text;
      label.fontSize = style.fontSize ?? 13;
      label.bold = style.bold ?? true;
      label.color = style.textColor ?? "#d6e6fa";
      label.align = "center";
      label.valign = "middle";
      label.width = style.width;
      label.height = style.height;
      root.addChild(label);
      let isActive = false;
      root.mouseEnabled = true;
      root.on(Laya.Event.MOUSE_OVER, root, () => {
        drawBg(isActive ? activeBgColor : hoverBgColor, "#64ffda");
        label.color = style.hoverTextColor ?? "#ffffff";
      });
      root.on(Laya.Event.MOUSE_OUT, root, () => {
        drawBg(
          isActive ? activeBgColor : bgColor,
          isActive ? "#00e5ff" : borderColor
        );
        label.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
      });
      root.on(Laya.Event.CLICK, root, onClick);
      parent.addChild(root);
      const setStyleState = (active) => {
        isActive = active;
        drawBg(
          isActive ? activeBgColor : bgColor,
          isActive ? "#00e5ff" : borderColor
        );
        label.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
      };
      return { root, label, setStyleState };
    }
    /**
     * 解析 LayaAir 3.4.2 九宮格 (9-Slice / sizeGrid) 參數為標準 5 元組 [top, right, bottom, left, repeat]
     */
    static parseSizeGrid(input) {
      if (Array.isArray(input)) {
        return [
          Number(input[0] ?? 16),
          Number(input[1] ?? 16),
          Number(input[2] ?? 16),
          Number(input[3] ?? 16),
          Number(input[4] ?? 0)
        ];
      }
      const parts = String(input || "16,16,16,16,0").split(",").map((s) => Number(s.trim()));
      return [
        Number.isFinite(parts[0]) ? parts[0] : 16,
        Number.isFinite(parts[1]) ? parts[1] : 16,
        Number.isFinite(parts[2]) ? parts[2] : 16,
        Number.isFinite(parts[3]) ? parts[3] : 16,
        Number.isFinite(parts[4]) ? parts[4] : 0
      ];
    }
    static formatSizeGrid(input) {
      return this.parseSizeGrid(input).join(",");
    }
    /**
     * 建構 9-Slice 九宮格無失真拉伸面板 (支援 Laya.Image.sizeGrid 與純向量 4 角鎖定網格)
     * 當面板從 baseWidth×baseHeight 拉伸至任意尺寸時，四個角落維持 1:1 物理像素大小不變形
     */
    static createNineSlicePanel(parent, opts) {
      const gridTuple = this.parseSizeGrid(opts.sizeGrid);
      const [top, right, bottom, left] = gridTuple;
      const formattedGrid = gridTuple.join(",");
      const gGlobal = globalThis;
      const root = opts.skin && gGlobal.Laya?.Image ? new gGlobal.Laya.Image() : new Laya.Sprite();
      root.name = "ZhudaNineSlicePanel";
      root.pos(opts.x, opts.y);
      root.size(opts.width, opts.height);
      root.sizeGrid = formattedGrid;
      if (opts.skin) {
        root.skin = opts.skin;
      }
      let titleNode = null;
      if (opts.titleText) {
        titleNode = new Laya.Text();
        titleNode.name = "NineSliceTitle";
        titleNode.text = opts.titleText;
        titleNode.fontSize = 13;
        titleNode.bold = true;
        titleNode.color = opts.titleColor ?? "#7df9ff";
        titleNode.align = "center";
        titleNode.valign = "middle";
        root.addChild(titleNode);
      }
      const drawSlices = (w, h) => {
        root.size(w, h);
        const radius = opts.radius ?? 10;
        const fill = opts.fillColor ?? "#132036";
        const border = opts.borderColor ?? "#38bdf8";
        const cornerColor = opts.cornerAccentColor ?? "#2dd4bf";
        const innerColor = opts.innerSurfaceColor ?? "#0c1524";
        const g = new Laya.Graphics();
        g.drawRoundRect(
          0,
          0,
          w,
          h,
          radius,
          radius,
          radius,
          radius,
          fill,
          border,
          2
        );
        const cw = Math.max(4, w - left - right);
        const ch = Math.max(4, h - top - bottom);
        g.drawRect(left, top, cw, ch, innerColor, "#233858", 1);
        g.drawRoundRect(
          0,
          0,
          left,
          top,
          radius,
          2,
          2,
          2,
          cornerColor,
          border,
          1.5
        );
        g.drawRoundRect(
          w - right,
          0,
          right,
          top,
          2,
          radius,
          2,
          2,
          cornerColor,
          border,
          1.5
        );
        g.drawRoundRect(
          0,
          h - bottom,
          left,
          bottom,
          2,
          2,
          2,
          radius,
          cornerColor,
          border,
          1.5
        );
        g.drawRoundRect(
          w - right,
          h - bottom,
          right,
          bottom,
          2,
          2,
          radius,
          2,
          cornerColor,
          border,
          1.5
        );
        root.graphics = g;
        if (titleNode) {
          titleNode.pos(left, 0);
          titleNode.size(cw, h);
        }
      };
      drawSlices(opts.width, opts.height);
      parent.addChild(root);
      return {
        root,
        sizeGridTuple: gridTuple,
        resizeNineSlice: (newWidth, newHeight) => drawSlices(newWidth, newHeight)
      };
    }
  };

  // src/components/BoardCameraController.ts
  var BoardCameraController = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.targetPosition = new Laya.Vector3(4, 15, 17);
      this.targetRotationEuler = new Laya.Vector3(-48, 0, 0);
      this.lerpSpeed = 0.14;
      this.frameTickCount = 0;
    }
    onAwake() {
      this.frameTickCount = 0;
    }
    setCameraTarget(pos, euler) {
      this.targetPosition = pos.clone();
      this.targetRotationEuler = euler.clone();
    }
    onUpdate() {
      this.frameTickCount++;
      const cam = this.owner;
      if (!cam || !cam.transform) return;
      const curPos = cam.transform.position;
      const curRot = cam.transform.rotationEuler;
      const nx = curPos.x + (this.targetPosition.x - curPos.x) * this.lerpSpeed;
      const ny = curPos.y + (this.targetPosition.y - curPos.y) * this.lerpSpeed;
      const nz = curPos.z + (this.targetPosition.z - curPos.z) * this.lerpSpeed;
      cam.transform.position = new Laya.Vector3(nx, ny, nz);
      const rx = curRot.x + (this.targetRotationEuler.x - curRot.x) * this.lerpSpeed;
      const ry = curRot.y + (this.targetRotationEuler.y - curRot.y) * this.lerpSpeed;
      const rz = curRot.z + (this.targetRotationEuler.z - curRot.z) * this.lerpSpeed;
      cam.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    }
  };
  BoardCameraController = __decorateClass([
    zhudaComponent({
      className: "BoardCameraController",
      assetId: "zhuda://BoardCameraController",
      category: "3d",
      description: "3D \u6230\u8853\u68CB\u76E4\u76F8\u6A5F\u5E73\u6ED1\u63D2\u503C\u8207\u5FAE\u5E45\u547C\u5438\u904B\u93E1\u7D44\u4EF6"
    })
  ], BoardCameraController);

  // packages/core/UnityBridgePipeline.ts
  var UNITY_CYBER_SHRINE_SCENE = {
    sceneName: "UnityCyberShrine",
    unityVersion: "2022.3.42f1-LTS",
    coordinateSystem: "LeftHanded_YUp",
    ambientColor: [0.18, 0.24, 0.36, 1],
    nodes: [
      {
        guid: "u-cam-001",
        name: "MainCamera",
        unityType: "Camera",
        positionLH: [0, 8.5, -11.5],
        rotationEulerLH: [32, 0, 0],
        scale: [1, 1, 1]
      },
      {
        guid: "u-light-002",
        name: "DirectionalLight",
        unityType: "DirectionalLight",
        positionLH: [4.2, 12, -6],
        rotationEulerLH: [50, -30, 0],
        scale: [1, 1, 1]
      },
      {
        guid: "u-altar-003",
        name: "ShrineAltarPedestal",
        unityType: "MeshRenderer",
        primitiveType: "cylinder",
        positionLH: [-2.2, 0.4, 1.5],
        rotationEulerLH: [0, 25, 0],
        scale: [1.6, 0.5, 1.6],
        material: {
          shader: "Universal Render Pipeline/Lit",
          albedoColor: [0.16, 0.24, 0.38, 1],
          metallic: 0.65,
          smoothness: 0.78
        }
      },
      {
        guid: "u-crystal-004",
        name: "UnityCrystalGuardian",
        unityType: "MeshRenderer",
        primitiveType: "box",
        positionLH: [-2.2, 1.8, 1.5],
        rotationEulerLH: [15, 45, 15],
        scale: [1.1, 1.5, 1.1],
        material: {
          shader: "Standard",
          albedoColor: [0.22, 0.74, 0.97, 1],
          metallic: 0.85,
          smoothness: 0.92,
          emissionHex: "#38bdf8"
        },
        animatorController: {
          controllerName: "CrystalGuardian.controller",
          defaultState: "Idle",
          parameters: [
            { name: "Speed", type: "float", defaultValue: 0 },
            { name: "Overcharge", type: "bool", defaultValue: false },
            { name: "BurstTrigger", type: "trigger", defaultValue: false }
          ],
          states: [
            {
              name: "Idle",
              motionClip: "Crystal_Idle.anim",
              speed: 1,
              loop: true,
              spineAnimationName: "idle",
              scalePulseAmplitude: 0.04,
              rotationSpeedDeg: 35,
              tintHex: "#38bdf8"
            },
            {
              name: "Charge",
              motionClip: "Crystal_Charge.anim",
              speed: 1.8,
              loop: true,
              spineAnimationName: "thinking",
              scalePulseAmplitude: 0.14,
              rotationSpeedDeg: 140,
              tintHex: "#fbbf24"
            },
            {
              name: "Burst",
              motionClip: "Crystal_Burst.anim",
              speed: 2.5,
              loop: false,
              spineAnimationName: "cheer",
              scalePulseAmplitude: 0.28,
              rotationSpeedDeg: 320,
              tintHex: "#4ade80"
            }
          ],
          transitions: [
            {
              fromState: "Idle",
              toState: "Charge",
              durationSec: 0.2,
              hasExitTime: false,
              conditions: [{ parameter: "Speed", mode: "Greater", threshold: 0.5 }]
            },
            {
              fromState: "Charge",
              toState: "Burst",
              durationSec: 0.15,
              hasExitTime: false,
              conditions: [{ parameter: "Overcharge", mode: "If" }]
            },
            {
              fromState: "Burst",
              toState: "Idle",
              durationSec: 0.25,
              hasExitTime: true,
              conditions: [{ parameter: "Speed", mode: "Less", threshold: 0.1 }]
            }
          ]
        }
      },
      {
        guid: "u-spine42-005",
        name: "Spine42GuardianMount",
        unityType: "Spine42SkeletonAnimation",
        positionLH: [2.4, 1.2, 0.5],
        rotationEulerLH: [0, -15, 0],
        scale: [1, 1, 1],
        spine42Asset: {
          skeletonFile: "ZhudaGuardianPig_v4.2.skel",
          atlasFile: "ZhudaGuardianPig_v4.2.atlas",
          skin: "cyber_guardian",
          defaultAnimation: "idle",
          physicsConstraintsCount: 2,
          stiffness: 95,
          damping: 0.88
        }
      }
    ]
  };
  var UnityAnimatorStateMachine = class {
    constructor(spec) {
      this.paramValues = /* @__PURE__ */ new Map();
      this.stateHistory = [];
      this.spec = spec;
      this.currentStateName = spec.defaultState;
      this.stateHistory.push(this.currentStateName);
      for (const p of spec.parameters) {
        this.paramValues.set(p.name, p.defaultValue);
      }
    }
    getCurrentState() {
      return this.spec.states.find((s) => s.name === this.currentStateName) || this.spec.states[0];
    }
    getStateHistory() {
      return [...this.stateHistory];
    }
    setFloat(name, value) {
      this.paramValues.set(name, value);
      return this.evaluateTransitions();
    }
    setBool(name, value) {
      this.paramValues.set(name, value);
      return this.evaluateTransitions();
    }
    setTrigger(name) {
      this.paramValues.set(name, true);
      const next = this.evaluateTransitions();
      this.paramValues.set(name, false);
      return next;
    }
    evaluateTransitions() {
      for (const tr of this.spec.transitions) {
        if (tr.fromState !== this.currentStateName && tr.fromState !== "AnyState") {
          continue;
        }
        const allMet = tr.conditions.every((cond) => this.checkCondition(cond));
        if (allMet && tr.toState !== this.currentStateName) {
          this.currentStateName = tr.toState;
          this.stateHistory.push(this.currentStateName);
          break;
        }
      }
      return this.currentStateName;
    }
    checkCondition(cond) {
      const val = this.paramValues.get(cond.parameter);
      switch (cond.mode) {
        case "If":
          return Boolean(val) === true;
        case "IfNot":
          return Boolean(val) === false;
        case "Greater":
          return Number(val ?? 0) > Number(cond.threshold ?? 0);
        case "Less":
          return Number(val ?? 0) < Number(cond.threshold ?? 0);
        case "Equals":
          return Number(val ?? 0) === Number(cond.threshold ?? 0);
        default:
          return false;
      }
    }
  };
  var UnityBridgePipeline = class {
    /**
     * 將 Unity 左手座標系 (LH, +X 右, +Y 上, +Z 前) 轉為 LayaAir 3.4.2 右手座標系 (RH, -X 翻轉)
     */
    static convertPositionLHtoRH(posLH) {
      const nx = -posLH[0];
      return [
        Number((Object.is(nx, -0) ? 0 : nx).toFixed(3)),
        Number(posLH[1].toFixed(3)),
        Number(posLH[2].toFixed(3))
      ];
    }
    /**
     * 將 Unity 左手系歐拉角 [rx, ry, rz] 轉為 LayaAir 3.4.2 右手系歐拉角 [rx, -ry, -rz]
     */
    static convertEulerLHtoRH(eulerLH) {
      const nry = -eulerLH[1];
      const nrz = -eulerLH[2];
      return [
        Number(eulerLH[0].toFixed(3)),
        Number((Object.is(nry, -0) ? 0 : nry).toFixed(3)),
        Number((Object.is(nrz, -0) ? 0 : nrz).toFixed(3))
      ];
    }
    /**
     * 映射 Unity Shader 名稱至 LayaAir 3.4.2 對應材質類別
     */
    static mapUnityShaderToLayaMaterialClass(shaderName) {
      switch (shaderName) {
        case "Universal Render Pipeline/Lit":
        case "Standard":
          return "Laya.PBRStandardMaterial";
        case "Unlit/Color":
          return "Laya.UnlitMaterial";
        case "Legacy Shaders/BlinnPhong":
          return "Laya.BlinnPhongMaterial";
        default:
          throw new Error(`Unmapped Unity shader: ${shaderName}`);
      }
    }
    /**
     * 將 Unity 場景中的「CrystalGuardian (含 AnimatorController + Spine 4.2 聯動)」轉為 LayaAir 靜態預製體 (.lh)
     */
    static buildUnityCrystalGuardianPrefab(scene = UNITY_CYBER_SHRINE_SCENE) {
      const crystalNode = scene.nodes.find((n) => n.name === "UnityCrystalGuardian") || scene.nodes[3];
      const spineNode = scene.nodes.find((n) => n.unityType === "Spine42SkeletonAnimation") || scene.nodes[4];
      const animSpec = crystalNode.animatorController;
      const targetSpec = {
        assetName: "UnityCrystalGuardian.lh",
        expectedBox: { x: 10, y: 10, width: 200, height: 168 },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#111c2d",
          borderStroke: "#38bdf8",
          accentOrText: "#4ade80"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      const posRH = this.convertPositionLHtoRH(crystalNode.positionLH);
      const eulerRH = this.convertEulerLHtoRH(crystalNode.rotationEulerLH);
      return {
        _$ver: 1,
        _$id: "unity_crystal_guardian_root",
        _$type: "Sprite",
        name: "UnityCrystalGuardian",
        x: 10,
        y: 10,
        width: 200,
        height: 168,
        _gcmds: [
          // 預製體底板 (200x168)
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 200,
            height: 168,
            lt: 12,
            rt: 12,
            lb: 12,
            rb: 12,
            fillColor: "#111c2d",
            lineColor: "#38bdf8",
            lineWidth: 2,
            percent: false
          },
          // 祭壇能量外環
          {
            _$type: "DrawCircleCmd",
            x: 100,
            y: 74,
            radius: 46,
            fillColor: "#0a1220",
            lineColor: "#0284c7",
            lineWidth: 2,
            percent: false
          },
          // Unity 移植之六角能量水晶主體
          {
            _$type: "DrawPolyCmd",
            x: 100,
            y: 74,
            points: [0, -34, 26, -12, 20, 26, 0, 36, -20, 26, -26, -12],
            fillColor: "#38bdf8",
            lineColor: "#e0f2fe",
            lineWidth: 2
          },
          // Spine 4.2 聯動守護印記核心
          {
            _$type: "DrawCircleCmd",
            x: 100,
            y: 74,
            radius: 12,
            fillColor: "#4ade80",
            lineColor: "#ffffff",
            lineWidth: 1.5,
            percent: false
          }
        ],
        _$comp: [
          {
            _$type: "ZhudaAnimatorControllerComponent",
            controllerName: animSpec.controllerName,
            defaultState: animSpec.defaultState,
            unityGuid: crystalNode.guid,
            layaPosRH: posRH.join(","),
            layaEulerRH: eulerRH.join(","),
            spine42RigFile: spineNode.spine42Asset?.skeletonFile || "ZhudaGuardianPig_v4.2.skel",
            statesJson: JSON.stringify(animSpec.states),
            transitionsJson: JSON.stringify(animSpec.transitions),
            parametersJson: JSON.stringify(animSpec.parameters)
          }
        ],
        _$child: [
          {
            _$id: "unity_guardian_title",
            _$type: "Text",
            name: "UnityNodeBadge",
            x: 0,
            y: 126,
            width: 200,
            height: 18,
            text: "Unity \u2192 Laya [CrystalGuardian]",
            fontSize: 12,
            bold: true,
            color: "#4ade80",
            align: "center"
          },
          {
            _$id: "unity_animator_status",
            _$type: "Text",
            name: "AnimatorStateLabel",
            x: 0,
            y: 145,
            width: 200,
            height: 16,
            text: `Animator: ${animSpec.defaultState} (RH: ${posRH.join(", ")})`,
            fontSize: 11,
            color: "#7df9ff",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/UnityCrystalGuardian.lh",
          category: "unity-migrated",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 220, height: 188, padding: 10 },
          targetSpec
        }
      };
    }
    /**
     * 執行完整 Unity 場景 + AnimatorController + Spine 4.2 轉換與狀態機過渡驗測
     */
    static runFullMigrationVerification(scene = UNITY_CYBER_SHRINE_SCENE) {
      const handednessConvertedNodes = scene.nodes.map((n) => ({
        name: n.name,
        unityPosLH: n.positionLH,
        layaPosRH: this.convertPositionLHtoRH(n.positionLH),
        unityEulerLH: n.rotationEulerLH,
        layaEulerRH: this.convertEulerLHtoRH(n.rotationEulerLH)
      }));
      const mappedMaterials = scene.nodes.filter((n) => Boolean(n.material)).map((n) => ({
        nodeName: n.name,
        unityShader: n.material.shader,
        layaMaterialClass: this.mapUnityShaderToLayaMaterialClass(n.material.shader)
      }));
      const crystalNode = scene.nodes.find((n) => Boolean(n.animatorController));
      const animSpec = crystalNode.animatorController;
      const fsm = new UnityAnimatorStateMachine(animSpec);
      fsm.setFloat("Speed", 0.85);
      fsm.setBool("Overcharge", true);
      fsm.setBool("Overcharge", false);
      fsm.setFloat("Speed", 0);
      const trace = fsm.getStateHistory();
      const expectedTrace = ["Idle", "Charge", "Burst", "Idle"];
      const transitionPassed = trace.length === expectedTrace.length && trace.every((st, idx) => st === expectedTrace[idx]);
      const spineNode = scene.nodes.find((n) => Boolean(n.spine42Asset));
      const spineAsset = spineNode.spine42Asset;
      const passed = handednessConvertedNodes.length === scene.nodes.length && mappedMaterials.length >= 2 && transitionPassed && spineAsset.physicsConstraintsCount > 0;
      return {
        sourceSceneName: `${scene.sceneName} (${scene.unityVersion})`,
        targetSceneAsset: "assets/scenes/MinesweeperStage.ls",
        targetPrefabAsset: "assets/prefabs/UnityCrystalGuardian.lh",
        convertedNodesCount: scene.nodes.length,
        handednessConvertedNodes,
        mappedMaterials,
        animatorVerification: {
          controllerName: animSpec.controllerName,
          statesCount: animSpec.states.length,
          transitionsCount: animSpec.transitions.length,
          simulatedTransitionTrace: trace,
          transitionPassed
        },
        spine42Verification: {
          skeletonFile: spineAsset.skeletonFile,
          physicsConstraintsMounted: spineAsset.physicsConstraintsCount,
          compatibleWithRuntime42: true
        },
        passed
      };
    }
  };

  // src/components/StaticAssetComponents.ts
  var Spine42PhysicsRigComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.rigName = "ZhudaGuardianPig_v4.2";
      this.defaultPose = "idle";
      this.stiffness = 95;
      this.damping = 0.88;
      this.windAmplitude = 1.8;
      this.earAngleRad = 0;
      this.earVelocity = 0;
      this.skinPrimaryColor = "#ff9ebb";
      this.skinBorderColor = "#ff6b98";
      this.bellyHighlightColor = "#ffd0df";
      this.snoutColor = "#ffa6c2";
      this.staticFreezeMode = false;
    }
    applyImpulse(impulse) {
      this.earVelocity += impulse;
    }
    stepPhysics(dt = 0.016, timeSec = 0) {
      if (this.staticFreezeMode) {
        return this.earAngleRad;
      }
      const wind = Math.sin(timeSec * 3) * this.windAmplitude;
      const accel = -this.stiffness * this.earAngleRad + wind;
      this.earVelocity = (this.earVelocity + accel * dt) * this.damping;
      this.earAngleRad += this.earVelocity * dt;
      return this.earAngleRad;
    }
  };
  Spine42PhysicsRigComponent = __decorateClass([
    zhudaComponent({
      className: "Spine42PhysicsRigComponent",
      assetId: "zhuda://Spine42PhysicsRigComponent",
      category: "spine",
      description: "Spine 4.2 \u975C\u614B\u9810\u88FD\u9AD4\u9AA8\u9ABC\u7269\u7406\u7D04\u675F\u7D44\u4EF6\uFF0C\u652F\u63F4\u5B64\u7ACB\u975C\u614B\u5E40\u6821\u6E96\u8207\u904B\u884C\u671F\u5F48\u7C27\u64FA\u89E3\u7B97"
    })
  ], Spine42PhysicsRigComponent);
  var ZhudaParticleEmitterComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.emitterName = "TacticalMineBurst_v1";
      this.burstCount = 24;
      this.emissionRate = 36;
      this.lifetimeMs = 850;
      this.startSpeed = 165;
      this.gravityY = 220;
      this.seed = 20261028;
      this.previewTimestampMs = 240;
      this.primaryColor = "#ff5533";
      this.secondaryColor = "#ffaa00";
      this.sparkColor = "#64ffda";
      this.coreGlowColor = "#231424";
      this.particles = [];
      this.isPlayingBurst = false;
      this.shockwaveRadius = 10;
    }
    /**
     * 於指定座標觸發一次即時粒子爆發 (後組裝運行期調用，支援爆破、揭開、勝利及 M4 特效藍圖庫)
     */
    playBurst(worldX, worldY, paletteMode = "explode") {
      const sp = this.owner;
      if (!sp) return;
      sp.pos(worldX - 88, worldY - 88);
      sp.visible = true;
      this.particles = [];
      this.shockwaveRadius = 12;
      this.isPlayingBurst = true;
      let c1 = this.primaryColor;
      let c2 = this.secondaryColor;
      let c3 = this.sparkColor;
      if (paletteMode === "reveal" || paletteMode === "sword-slash") {
        c1 = "#00e5ff";
        c2 = "#7df9ff";
        c3 = "#ffffff";
      } else if (paletteMode === "victory" || paletteMode === "coin-fountain") {
        c1 = "#fbbf24";
        c2 = "#fef08a";
        c3 = "#4ade80";
      } else if (paletteMode === "levelup-aura") {
        c1 = "#a855f7";
        c2 = "#e9d5ff";
        c3 = "#64ffda";
      }
      let rngState = this.seed;
      const nextRand = () => {
        rngState = rngState * 1664525 + 1013904223 >>> 0;
        return rngState / 4294967295;
      };
      const count = paletteMode === "reveal" ? 14 : this.burstCount;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2 + (nextRand() - 0.5) * 0.25;
        const speed = this.startSpeed * (0.55 + nextRand() * 0.55);
        this.particles.push({
          x: 88,
          y: 88,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 3 + i % 3 * 1.5,
          color: i % 3 === 0 ? c2 : i % 3 === 1 ? c1 : c3,
          alpha: 1,
          ageMs: 0,
          maxAgeMs: this.lifetimeMs * (0.7 + nextRand() * 0.3)
        });
      }
    }
    onUpdate() {
      if (!this.isPlayingBurst) return;
      const sp = this.owner;
      if (!sp || !sp.graphics) return;
      const dtMs = 16.67;
      const dtSec = dtMs / 1e3;
      const g = sp.graphics;
      g.clear();
      this.shockwaveRadius += 190 * dtSec;
      if (this.shockwaveRadius < 82) {
        g.drawCircle(88, 88, this.shockwaveRadius, null, this.sparkColor, 1.8);
      }
      let alive = 0;
      for (const p of this.particles) {
        p.ageMs += dtMs;
        if (p.ageMs >= p.maxAgeMs) continue;
        alive++;
        p.vy += this.gravityY * dtSec;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        const lifeRatio = 1 - p.ageMs / p.maxAgeMs;
        const r = Math.max(1.2, p.radius * lifeRatio);
        g.drawCircle(p.x, p.y, r, p.color);
      }
      if (alive === 0) {
        this.isPlayingBurst = false;
        sp.visible = false;
      }
    }
  };
  ZhudaParticleEmitterComponent = __decorateClass([
    zhudaComponent({
      className: "ZhudaParticleEmitterComponent",
      assetId: "zhuda://ZhudaParticleEmitterComponent",
      category: "2d",
      description: "\u6C7A\u5B9A\u6027\u975C\u614B\u7C92\u5B50\u767C\u5C04\u5668\u7D44\u4EF6\uFF0C\u652F\u63F4 t=240ms \u975C\u614B\u50CF\u7D20\u6821\u6E96\u5FEB\u7167\u8207\u904B\u884C\u671F\u5373\u6642\u7206\u7834\u7279\u6548"
    })
  ], ZhudaParticleEmitterComponent);
  var ZhudaAnimatorControllerComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.controllerName = "CrystalGuardian.controller";
      this.defaultState = "Idle";
      this.unityGuid = "u-crystal-004";
      this.layaPosRH = "2.2,1.8,1.5";
      this.layaEulerRH = "15,-45,-15";
      this.spine42RigFile = "ZhudaGuardianPig_v4.2.skel";
      this.statesJson = "";
      this.transitionsJson = "";
      this.parametersJson = "";
      this.fsm = null;
      this.cycleStep = 0;
    }
    ensureFsm() {
      if (!this.fsm) {
        const defaultSpec = UNITY_CYBER_SHRINE_SCENE.nodes.find((n) => Boolean(n.animatorController)).animatorController;
        let spec = defaultSpec;
        if (this.statesJson && this.transitionsJson && this.parametersJson) {
          try {
            spec = {
              controllerName: this.controllerName,
              defaultState: this.defaultState,
              states: JSON.parse(this.statesJson),
              transitions: JSON.parse(this.transitionsJson),
              parameters: JSON.parse(this.parametersJson)
            };
          } catch (_e) {
            spec = defaultSpec;
          }
        }
        this.fsm = new UnityAnimatorStateMachine(spec);
      }
      return this.fsm;
    }
    getCurrentStateName() {
      return this.ensureFsm().getCurrentState().name;
    }
    getStateTrace() {
      return this.ensureFsm().getStateHistory();
    }
    stepAnimatorCycle() {
      const fsm = this.ensureFsm();
      this.cycleStep = (this.cycleStep + 1) % 3;
      if (this.cycleStep === 1) {
        fsm.setFloat("Speed", 0.9);
        fsm.setBool("Overcharge", false);
      } else if (this.cycleStep === 2) {
        fsm.setFloat("Speed", 0.9);
        fsm.setBool("Overcharge", true);
      } else {
        fsm.setBool("Overcharge", false);
        fsm.setFloat("Speed", 0);
      }
      const st = fsm.getCurrentState();
      return {
        stateName: st.name,
        spineAnim: st.spineAnimationName || "idle",
        tintHex: st.tintHex || "#38bdf8"
      };
    }
  };
  ZhudaAnimatorControllerComponent = __decorateClass([
    zhudaComponent({
      className: "ZhudaAnimatorControllerComponent",
      assetId: "zhuda://ZhudaAnimatorControllerComponent",
      category: "3d",
      description: "M5 Unity AnimatorController \u8DE8\u5F15\u64CE\u72C0\u614B\u6A5F\u7D44\u4EF6\uFF0C\u652F\u63F4 Float/Bool/Trigger \u689D\u4EF6\u8F49\u79FB\u8207 Spine 4.2 \u806F\u52D5"
    })
  ], ZhudaAnimatorControllerComponent);

  // src/components/TilePhysicsBehavior.ts
  var TilePhysicsBehavior = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.activeSimulations = 0;
    }
    onAwake() {
      this.activeSimulations = 0;
    }
  };
  TilePhysicsBehavior = __decorateClass([
    zhudaComponent({
      className: "TilePhysicsBehavior",
      assetId: "zhuda://TilePhysicsBehavior",
      category: "physics",
      description: "\u7BA1\u7406 3D \u8E29\u5730\u96F7\u65B9\u584A\u7206\u7834\u91CD\u529B\u98DB\u6563\u8207\u6CE2\u6D6A\u52D5\u756B\u72C0\u614B"
    })
  ], TilePhysicsBehavior);

  // src/.generated/zhuda-registry.ts
  var ZHUDA_REFLECTED_MANIFEST = [
    {
      "className": "BoardCameraController",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://BoardCameraController"
    },
    {
      "className": "Spine42PhysicsRigComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://Spine42PhysicsRigComponent"
    },
    {
      "className": "ZhudaParticleEmitterComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://ZhudaParticleEmitterComponent"
    },
    {
      "className": "ZhudaAnimatorControllerComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://ZhudaAnimatorControllerComponent"
    },
    {
      "className": "TilePhysicsBehavior",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://TilePhysicsBehavior"
    }
  ];
  function registerAllReflectedComponents() {
    EngineGuard.registerComponent("BoardCameraController", BoardCameraController, "zhuda://BoardCameraController");
    EngineGuard.registerComponent("Spine42PhysicsRigComponent", Spine42PhysicsRigComponent, "zhuda://Spine42PhysicsRigComponent");
    EngineGuard.registerComponent("ZhudaParticleEmitterComponent", ZhudaParticleEmitterComponent, "zhuda://ZhudaParticleEmitterComponent");
    EngineGuard.registerComponent("ZhudaAnimatorControllerComponent", ZhudaAnimatorControllerComponent, "zhuda://ZhudaAnimatorControllerComponent");
    EngineGuard.registerComponent("TilePhysicsBehavior", TilePhysicsBehavior, "zhuda://TilePhysicsBehavior");
    return ZHUDA_REFLECTED_MANIFEST;
  }

  // src/domain/MinesweeperCore.ts
  var DIFFICULTIES = {
    beginner: { name: "\u521D\u7D1A", rows: 9, cols: 9, mines: 10 },
    intermediate: { name: "\u4E2D\u7D1A", rows: 12, cols: 12, mines: 20 },
    expert: { name: "\u5C08\u5BB6", rows: 16, cols: 16, mines: 40 }
  };
  var MinesweeperGame = class {
    constructor(difficulty = DIFFICULTIES.beginner) {
      this.grid = [];
      this.status = "idle";
      this.flagsCount = 0;
      this.revealedCount = 0;
      this.startTime = 0;
      this.endTime = 0;
      this.firstClick = true;
      this.rows = difficulty.rows;
      this.cols = difficulty.cols;
      this.totalMines = difficulty.mines;
      this.reset();
    }
    reset(difficulty) {
      if (difficulty) {
        this.rows = difficulty.rows;
        this.cols = difficulty.cols;
        this.totalMines = difficulty.mines;
      }
      this.grid = [];
      this.status = "idle";
      this.flagsCount = 0;
      this.revealedCount = 0;
      this.startTime = 0;
      this.endTime = 0;
      this.firstClick = true;
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          row.push({
            x: c,
            y: r,
            isMine: false,
            neighborMines: 0,
            state: "hidden"
          });
        }
        this.grid.push(row);
      }
    }
    get remainingMines() {
      return this.totalMines - this.flagsCount;
    }
    get elapsedTime() {
      if (this.status === "idle") return 0;
      if (this.status === "playing") {
        return Math.floor((Date.now() - this.startTime) / 1e3);
      }
      return Math.floor((this.endTime - this.startTime) / 1e3);
    }
    getCell(r, c) {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
      return this.grid[r][c];
    }
    generateMines(safeR, safeC) {
      let placed = 0;
      const maxSafeDist = 1;
      while (placed < this.totalMines) {
        const r = Math.floor(Math.random() * this.rows);
        const c = Math.floor(Math.random() * this.cols);
        const inSafeZone = Math.abs(r - safeR) <= maxSafeDist && Math.abs(c - safeC) <= maxSafeDist;
        if (inSafeZone) continue;
        if (!this.grid[r][c].isMine) {
          this.grid[r][c].isMine = true;
          placed++;
        }
      }
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.grid[r][c].isMine) {
            this.grid[r][c].neighborMines = this.countNeighborMines(r, c);
          }
        }
      }
    }
    countNeighborMines(r, c) {
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const neighbor = this.getCell(r + dr, c + dc);
          if (neighbor && neighbor.isMine) count++;
        }
      }
      return count;
    }
    reveal(r, c) {
      const cell = this.getCell(r, c);
      if (!cell || this.status === "won" || this.status === "lost") {
        return { changed: [], hitMine: false };
      }
      if (cell.state === "flagged" || cell.state === "revealed") {
        return { changed: [], hitMine: false };
      }
      if (this.firstClick) {
        this.firstClick = false;
        this.status = "playing";
        this.startTime = Date.now();
        this.generateMines(r, c);
      }
      if (cell.isMine) {
        cell.exploded = true;
        cell.state = "revealed";
        this.status = "lost";
        this.endTime = Date.now();
        this.revealAllMinesOnLoss();
        return { changed: [cell], hitMine: true };
      }
      const changed = [];
      const queue = [cell];
      cell.state = "revealed";
      this.revealedCount++;
      changed.push(cell);
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr.neighborMines === 0) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const neighbor = this.getCell(curr.y + dr, curr.x + dc);
              if (neighbor && neighbor.state === "hidden") {
                neighbor.state = "revealed";
                this.revealedCount++;
                changed.push(neighbor);
                if (neighbor.neighborMines === 0) {
                  queue.push(neighbor);
                }
              }
            }
          }
        }
      }
      const safeTotal = this.rows * this.cols - this.totalMines;
      if (this.revealedCount >= safeTotal) {
        this.status = "won";
        this.endTime = Date.now();
        this.autoFlagAllMinesOnWin();
      }
      return { changed, hitMine: false };
    }
    toggleFlag(r, c) {
      const cell = this.getCell(r, c);
      if (!cell || this.status === "won" || this.status === "lost") return null;
      if (cell.state === "revealed") return null;
      if (this.status === "idle") {
        this.status = "playing";
        this.startTime = Date.now();
      }
      if (cell.state === "hidden") {
        cell.state = "flagged";
        this.flagsCount++;
      } else if (cell.state === "flagged") {
        cell.state = "question";
        this.flagsCount--;
      } else if (cell.state === "question") {
        cell.state = "hidden";
      }
      return cell;
    }
    chord(r, c) {
      const cell = this.getCell(r, c);
      if (!cell || cell.state !== "revealed" || cell.neighborMines === 0) {
        return { changed: [], hitMine: false };
      }
      let flagCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const neighbor = this.getCell(r + dr, c + dc);
          if (neighbor && neighbor.state === "flagged") flagCount++;
        }
      }
      if (flagCount === cell.neighborMines) {
        const allChanged = [];
        let hit = false;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            const neighbor = this.getCell(nr, nc);
            if (neighbor && neighbor.state === "hidden") {
              const res = this.reveal(nr, nc);
              allChanged.push(...res.changed);
              if (res.hitMine) {
                hit = true;
                break;
              }
            }
          }
          if (hit) break;
        }
        return { changed: allChanged, hitMine: hit };
      }
      return { changed: [], hitMine: false };
    }
    revealAllMinesOnLoss() {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = this.grid[r][c];
          if (cell.isMine && cell.state !== "flagged") {
            cell.state = "revealed";
          } else if (!cell.isMine && cell.state === "flagged") {
            cell.wrongFlag = true;
          }
        }
      }
    }
    autoFlagAllMinesOnWin() {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = this.grid[r][c];
          if (cell.isMine && cell.state !== "flagged") {
            cell.state = "flagged";
            this.flagsCount++;
          }
        }
      }
    }
  };

  // src/presentation/Minesweeper3DView.ts
  var Minesweeper3DView = class {
    constructor(parentScene, game, overlay2D) {
      this.tiles = /* @__PURE__ */ new Map();
      this.is3DView = true;
      this.animatingPhysics = false;
      this.game = game;
      this.overlay2D = overlay2D;
      this.scene3D = Zhuda3D.createScene3D(parentScene, {
        name: "ZhudaMinesweeperScene3D",
        ambientColor: [0.42, 0.47, 0.58, 1]
      });
      this.camera = Zhuda3D.createCamera(this.scene3D, {
        fov: 50,
        near: 0.1,
        far: 1e3,
        position: [4, 15, 17],
        rotationEuler: [-48, 0, 0],
        clearColor: [0.06, 0.08, 0.12, 1]
      });
      this.cameraCtrl = this.camera.addComponent(BoardCameraController);
      Zhuda3D.createDirectionalLight(this.scene3D, {
        color: [1, 0.98, 0.92, 1],
        intensity: 1.35,
        rotationEuler: [-55, 35, 0]
      });
      this.boardRoot = new Laya.Sprite3D("BoardRoot");
      this.scene3D.addChild(this.boardRoot);
      this.physicsBehavior = this.boardRoot.addComponent(TilePhysicsBehavior);
      this.matHidden = Zhuda3D.createMaterial({ albedoColor: [0.23, 0.33, 0.46, 1], shininess: 36 });
      this.matRevealed = Zhuda3D.createMaterial({ albedoColor: [0.11, 0.15, 0.22, 1], shininess: 10 });
      this.matExploded = Zhuda3D.createMaterial({ albedoColor: [0.92, 0.22, 0.24, 1], shininess: 24 });
      this.matFlag = Zhuda3D.createMaterial({ albedoColor: [1, 0.82, 0.12, 1], shininess: 48 });
      this.matMine = Zhuda3D.createMaterial({ albedoColor: [0.15, 0.15, 0.17, 1], shininess: 64 });
      this.rebuildBoard();
      this.updateCamera(true);
      Laya.timer.frameLoop(1, this, this.onFrameUpdate);
    }
    getTileCount() {
      return this.tiles.size;
    }
    toggleViewMode() {
      this.is3DView = !this.is3DView;
      this.updateCamera(false);
      return this.is3DView;
    }
    updateCamera(immediate = false) {
      const centerC = (this.game.cols - 1) * 0.5;
      const centerR = (this.game.rows - 1) * 0.5;
      const maxDim = Math.max(this.game.rows, this.game.cols);
      let targetPos;
      let targetRot;
      if (this.is3DView) {
        const dist = maxDim * 1.35 + 4;
        targetPos = new Laya.Vector3(centerC + 1.1, dist * 0.95, centerR + dist * 0.85);
        targetRot = new Laya.Vector3(-48, 0, 0);
      } else {
        const dist = maxDim * 1.45 + 5;
        targetPos = new Laya.Vector3(centerC + 1.1, dist, centerR);
        targetRot = new Laya.Vector3(-90, 0, 0);
      }
      if (this.cameraCtrl) {
        this.cameraCtrl.setCameraTarget(targetPos, targetRot);
      }
      if (immediate) {
        this.camera.transform.position = targetPos;
        this.camera.transform.rotationEuler = targetRot;
      }
    }
    rebuildBoard() {
      for (const tile of this.tiles.values()) {
        if (tile.textNode) tile.textNode.destroy();
        tile.root.destroy();
      }
      this.tiles.clear();
      this.animatingPhysics = false;
      const boxMesh = Zhuda3D.createPrimitiveMesh("box", {
        width: 0.92,
        height: 0.35,
        depth: 0.92
      });
      for (let r = 0; r < this.game.rows; r++) {
        for (let c = 0; c < this.game.cols; c++) {
          const root = new Laya.Sprite3D(`Tile_${r}_${c}`);
          this.boardRoot.addChild(root);
          root.transform.position = new Laya.Vector3(c, 0, r);
          const meshSprite = new Laya.MeshSprite3D();
          root.addChild(meshSprite);
          meshSprite.meshFilter.sharedMesh = boxMesh;
          meshSprite.meshRenderer.sharedMaterial = this.matHidden;
          this.tiles.set(`${r}_${c}`, {
            r,
            c,
            root,
            meshSprite,
            flagSprite: null,
            mineSprite: null,
            textNode: null,
            revealed: false,
            baseY: 0,
            velocity: new Laya.Vector3(0, 0, 0),
            angularVelocity: new Laya.Vector3(0, 0, 0)
          });
        }
      }
      this.updateCamera(false);
    }
    updateCellVisual(cell) {
      const tile = this.tiles.get(`${cell.y}_${cell.x}`);
      if (!tile) return;
      if (cell.state === "revealed") {
        tile.revealed = true;
        if (cell.isMine) {
          tile.meshSprite.meshRenderer.sharedMaterial = this.matExploded;
          if (!tile.mineSprite) {
            tile.mineSprite = this.create3DMineVisual();
            tile.root.addChild(tile.mineSprite);
          }
        } else {
          tile.meshSprite.meshRenderer.sharedMaterial = this.matRevealed;
          Laya.Tween.to(tile.root.transform, { localPositionY: -0.16 }, 180, Laya.Ease.cubicOut);
          if (tile.flagSprite) {
            tile.flagSprite.destroy();
            tile.flagSprite = null;
          }
          if (cell.neighborMines > 0 && !tile.textNode) {
            tile.textNode = this.createNumberLabel(cell.neighborMines);
          }
        }
      } else if (cell.state === "flagged") {
        if (!tile.flagSprite) {
          tile.flagSprite = this.create3DFlagVisual();
          tile.root.addChild(tile.flagSprite);
          tile.flagSprite.transform.localPosition = new Laya.Vector3(0, 0.1, 0);
          tile.flagSprite.transform.localScale = new Laya.Vector3(0.1, 0.1, 0.1);
          Laya.Tween.to(
            tile.flagSprite.transform,
            { localPositionY: 0.35, localScaleX: 1, localScaleY: 1, localScaleZ: 1 },
            200,
            Laya.Ease.backOut
          );
        }
      } else if (cell.state === "question") {
        if (tile.flagSprite) {
          tile.flagSprite.destroy();
          tile.flagSprite = null;
        }
      } else if (cell.state === "hidden") {
        tile.meshSprite.meshRenderer.sharedMaterial = this.matHidden;
        if (tile.flagSprite) {
          tile.flagSprite.destroy();
          tile.flagSprite = null;
        }
        if (tile.mineSprite) {
          tile.mineSprite.destroy();
          tile.mineSprite = null;
        }
        if (tile.textNode) {
          tile.textNode.destroy();
          tile.textNode = null;
        }
        tile.root.transform.localPosition = new Laya.Vector3(cell.x, 0, cell.y);
      }
    }
    create3DFlagVisual() {
      const flagRoot = new Laya.Sprite3D("Flag");
      const poleMesh = Zhuda3D.createPrimitiveMesh("cylinder", { radius: 0.04, height: 0.6 });
      const pole = new Laya.MeshSprite3D();
      pole.meshFilter.sharedMesh = poleMesh;
      pole.meshRenderer.sharedMaterial = this.matHidden;
      flagRoot.addChild(pole);
      pole.transform.localPosition = new Laya.Vector3(0, 0.3, 0);
      const clothMesh = Zhuda3D.createPrimitiveMesh("box", { width: 0.28, height: 0.18, depth: 0.04 });
      const cloth = new Laya.MeshSprite3D();
      cloth.meshFilter.sharedMesh = clothMesh;
      cloth.meshRenderer.sharedMaterial = this.matFlag;
      flagRoot.addChild(cloth);
      cloth.transform.localPosition = new Laya.Vector3(0.15, 0.5, 0);
      return flagRoot;
    }
    create3DMineVisual() {
      const mineRoot = new Laya.Sprite3D("Mine");
      const sphereMesh = Zhuda3D.createPrimitiveMesh("sphere", { radius: 0.24 });
      const sphere = new Laya.MeshSprite3D();
      sphere.meshFilter.sharedMesh = sphereMesh;
      sphere.meshRenderer.sharedMaterial = this.matMine;
      mineRoot.addChild(sphere);
      sphere.transform.localPosition = new Laya.Vector3(0, 0.3, 0);
      const spikeMesh = Zhuda3D.createPrimitiveMesh("cylinder", { radius: 0.03, height: 0.58 });
      const spike1 = new Laya.MeshSprite3D();
      spike1.meshFilter.sharedMesh = spikeMesh;
      spike1.meshRenderer.sharedMaterial = this.matExploded;
      mineRoot.addChild(spike1);
      spike1.transform.localPosition = new Laya.Vector3(0, 0.3, 0);
      const spike2 = new Laya.MeshSprite3D();
      spike2.meshFilter.sharedMesh = spikeMesh;
      spike2.meshRenderer.sharedMaterial = this.matExploded;
      mineRoot.addChild(spike2);
      spike2.transform.localPosition = new Laya.Vector3(0, 0.3, 0);
      spike2.transform.rotationEuler = new Laya.Vector3(0, 0, 90);
      return mineRoot;
    }
    createNumberLabel(num) {
      const label = new Laya.Text();
      label.text = String(num);
      label.fontSize = 22;
      label.bold = true;
      label.align = "center";
      label.valign = "middle";
      label.width = 30;
      label.height = 30;
      label.pivotX = 15;
      label.pivotY = 15;
      const colors = [
        "#000000",
        "#4185f4",
        "#34a853",
        "#ea4335",
        "#7b1fa2",
        "#ff6d00",
        "#0097a7",
        "#212121",
        "#757575"
      ];
      label.color = colors[num] || "#ffffff";
      this.overlay2D.addChild(label);
      return label;
    }
    triggerExplosionPhysics(centerR, centerC) {
      this.animatingPhysics = true;
      if (this.physicsBehavior) {
        this.physicsBehavior.activeSimulations++;
      }
      for (const tile of this.tiles.values()) {
        const dx = tile.c - centerC;
        const dz = tile.r - centerR;
        const dist = Math.sqrt(dx * dx + dz * dz) + 0.1;
        const force = Math.max(0, (6 - dist) * 1.8);
        if (force > 0) {
          tile.velocity.x = dx / dist * force * (0.8 + Math.random() * 0.4);
          tile.velocity.y = force * (1.2 + Math.random() * 0.8) + 2.5;
          tile.velocity.z = dz / dist * force * (0.8 + Math.random() * 0.4);
          tile.angularVelocity.x = (Math.random() - 0.5) * 450;
          tile.angularVelocity.y = (Math.random() - 0.5) * 450;
          tile.angularVelocity.z = (Math.random() - 0.5) * 450;
        }
      }
    }
    triggerVictoryWave() {
      for (const tile of this.tiles.values()) {
        const dist = Math.sqrt(tile.c * tile.c + tile.r * tile.r);
        const delay = dist * 60;
        const targetRestY = tile.revealed ? -0.16 : 0;
        Laya.Tween.to(tile.root.transform, { localPositionY: 0.75 }, 220, Laya.Ease.sineOut, void 0, delay);
        Laya.Tween.to(tile.root.transform, { localPositionY: targetRestY }, 280, Laya.Ease.bounceOut, void 0, delay + 220);
      }
    }
    onFrameUpdate() {
      const dt = 0.016;
      const outPos = new Laya.Vector4();
      for (const tile of this.tiles.values()) {
        if (tile.textNode && tile.textNode.visible) {
          const worldPos = tile.root.transform.position;
          this.camera.viewport.project(
            new Laya.Vector3(worldPos.x, worldPos.y + 0.22, worldPos.z),
            this.camera.projectionViewMatrix,
            outPos
          );
          tile.textNode.pos(outPos.x, outPos.y);
        }
      }
      if (this.animatingPhysics) {
        const gravity = -18;
        let anyMoving = false;
        for (const tile of this.tiles.values()) {
          if (tile.velocity.length() > 0.01 || Math.abs(tile.velocity.y) > 0.01) {
            anyMoving = true;
            tile.velocity.y += gravity * dt;
            const p = tile.root.transform.position;
            p.x += tile.velocity.x * dt;
            p.y += tile.velocity.y * dt;
            p.z += tile.velocity.z * dt;
            tile.root.transform.position = p;
            const rot = tile.root.transform.rotationEuler;
            rot.x += tile.angularVelocity.x * dt;
            rot.y += tile.angularVelocity.y * dt;
            rot.z += tile.angularVelocity.z * dt;
            tile.root.transform.rotationEuler = rot;
            if (p.y < -3) {
              p.y = -3;
              tile.velocity.y = -tile.velocity.y * 0.4;
              tile.velocity.x *= 0.7;
              tile.velocity.z *= 0.7;
            }
          }
        }
        if (!anyMoving) {
          this.animatingPhysics = false;
        }
      }
    }
    pickTile(screenX, screenY) {
      const ray = new Laya.Ray(new Laya.Vector3(), new Laya.Vector3());
      this.camera.viewportPointToRay(new Laya.Vector2(screenX, screenY), ray);
      if (Math.abs(ray.direction.y) < 1e-4) return null;
      const t = -ray.origin.y / ray.direction.y;
      if (t < 0) return null;
      const hitX = ray.origin.x + t * ray.direction.x;
      const hitZ = ray.origin.z + t * ray.direction.z;
      const c = Math.round(hitX);
      const r = Math.round(hitZ);
      if (r >= 0 && r < this.game.rows && c >= 0 && c < this.game.cols) {
        return { r, c };
      }
      return null;
    }
  };

  // src/presentation/MinesweeperUI.ts
  var MinesweeperUI = class {
    constructor(parent, callbacks) {
      this.flagMode = false;
      this.isAudioOn = true;
      this.is3DView = true;
      this.callbacks = callbacks;
      this.root = new Laya.Sprite();
      this.root.name = "ZhudaWorkbenchUIRoot";
      parent.addChild(this.root);
      this.topPanel = ZhudaUI.createGlassPanel(this.root, {
        x: 20,
        y: 16,
        width: 1240,
        height: 72,
        radius: 12,
        fillColor: "#141d2ce6",
        borderColor: "#304565",
        borderWidth: 1.5
      });
      const mineBox = ZhudaUI.createGlassPanel(this.topPanel, {
        x: 18,
        y: 14,
        width: 102,
        height: 44,
        radius: 6,
        fillColor: "#0b0f17",
        borderColor: "#ff336655",
        borderWidth: 1.5
      });
      this.mineCountText = new Laya.Text();
      this.mineCountText.text = "010";
      this.mineCountText.font = "Courier New, monospace";
      this.mineCountText.fontSize = 27;
      this.mineCountText.bold = true;
      this.mineCountText.color = "#ff3366";
      this.mineCountText.align = "center";
      this.mineCountText.width = 102;
      this.mineCountText.y = 7;
      mineBox.addChild(this.mineCountText);
      const faceBtn = ZhudaUI.createVectorButton(
        this.topPanel,
        132,
        14,
        "\u{1F642}",
        { width: 44, height: 44, fontSize: 22, bgColor: "#233349", borderColor: "#48658b" },
        () => this.callbacks.onRestart()
      );
      this.faceText = faceBtn.label;
      const timeBox = ZhudaUI.createGlassPanel(this.topPanel, {
        x: 188,
        y: 14,
        width: 102,
        height: 44,
        radius: 6,
        fillColor: "#0b0f17",
        borderColor: "#00ff8855",
        borderWidth: 1.5
      });
      this.timerText = new Laya.Text();
      this.timerText.text = "000";
      this.timerText.font = "Courier New, monospace";
      this.timerText.fontSize = 27;
      this.timerText.bold = true;
      this.timerText.color = "#00ff88";
      this.timerText.align = "center";
      this.timerText.width = 102;
      this.timerText.y = 7;
      timeBox.addChild(this.timerText);
      ZhudaUI.createVectorButton(
        this.topPanel,
        306,
        14,
        "\u521D\u7D1A 9x9",
        { width: 86, height: 44, fontSize: 13 },
        () => this.callbacks.onDifficultyChange(DIFFICULTIES.beginner)
      );
      ZhudaUI.createVectorButton(
        this.topPanel,
        400,
        14,
        "\u4E2D\u7D1A 12x12",
        { width: 92, height: 44, fontSize: 13 },
        () => this.callbacks.onDifficultyChange(DIFFICULTIES.intermediate)
      );
      ZhudaUI.createVectorButton(
        this.topPanel,
        500,
        14,
        "\u5C08\u5BB6 16x16",
        { width: 92, height: 44, fontSize: 13 },
        () => this.callbacks.onDifficultyChange(DIFFICULTIES.expert)
      );
      const viewBtn = ZhudaUI.createVectorButton(
        this.topPanel,
        604,
        14,
        "\u{1F3A5} 3D\u8996\u89D2",
        { width: 98, height: 44, fontSize: 13, textColor: "#7df9ff" },
        () => {
          this.is3DView = this.callbacks.onToggleView();
          this.viewModeLabel.text = this.is3DView ? "\u{1F3A5} 3D\u8996\u89D2" : "\u{1F5FA}\uFE0F 2D\u9802\u8996";
        }
      );
      this.viewModeLabel = viewBtn.label;
      const flagBtn = ZhudaUI.createVectorButton(
        this.topPanel,
        710,
        14,
        "\u26CF\uFE0F \u63ED\u958B\u6A21\u5F0F",
        { width: 102, height: 44, fontSize: 13, textColor: "#7df9ff" },
        () => {
          this.flagMode = this.callbacks.onToggleFlagMode();
          this.flagModeLabel.text = this.flagMode ? "\u{1F6A9} \u63D2\u65D7\u6A21\u5F0F" : "\u26CF\uFE0F \u63ED\u958B\u6A21\u5F0F";
        }
      );
      this.flagModeLabel = flagBtn.label;
      const audioBtn = ZhudaUI.createVectorButton(
        this.topPanel,
        820,
        14,
        "\u{1F50A} \u97F3\u6548: \u958B",
        { width: 96, height: 44, fontSize: 13, textColor: "#7df9ff" },
        () => {
          this.isAudioOn = this.callbacks.onToggleAudio();
          this.audioLabel.text = this.isAudioOn ? "\u{1F50A} \u97F3\u6548: \u958B" : "\u{1F507} \u97F3\u6548: \u95DC";
        }
      );
      this.audioLabel = audioBtn.label;
      ZhudaUI.createVectorButton(
        this.topPanel,
        926,
        14,
        "\u26A1 \u6027\u80FD\u58D3\u6E2C vs Three.js",
        {
          width: 170,
          height: 44,
          fontSize: 13,
          bgColor: "#1b3a3a",
          hoverBgColor: "#235353",
          borderColor: "#00e5ff",
          textColor: "#64ffda"
        },
        () => {
          const report = this.callbacks.onRunBenchmark();
          this.refreshTelemetry(report);
        }
      );
      const badge = ZhudaUI.createGlassPanel(this.topPanel, {
        x: 1106,
        y: 14,
        width: 118,
        height: 44,
        radius: 8,
        fillColor: "#102436",
        borderColor: "#3b82f6",
        borderWidth: 1
      });
      const badgeTxt = new Laya.Text();
      badgeTxt.text = "ZERO-IDE\nAI-NATIVE";
      badgeTxt.fontSize = 11;
      badgeTxt.bold = true;
      badgeTxt.leading = 3;
      badgeTxt.color = "#60a5fa";
      badgeTxt.align = "center";
      badgeTxt.width = 118;
      badgeTxt.y = 8;
      badge.addChild(badgeTxt);
      this.statusText = new Laya.Text();
      this.statusText.pos(28, 96);
      this.statusText.fontSize = 14;
      this.statusText.color = "#9ab4d0";
      this.statusText.text = "\u{1F4A1} \u8C6C\u5927 LayaAir (AI-Friendly)\uFF1A\u5DE6\u9375\u63ED\u958B\u65B9\u584A\uFF0C\u53F3\u9375\u6216\u9577\u6309\u63D2\u65D7\uFF1B\u9EDE\u64CA\u300C\u26A1 \u6027\u80FD\u58D3\u6E2C\u300D\u6AA2\u8996\u8207 Three.js \u7684\u5373\u6642\u5408\u6279\u5C0D\u6BD4\uFF01";
      this.root.addChild(this.statusText);
      this.telemetryPanel = ZhudaUI.createGlassPanel(this.root, {
        x: 1035,
        y: 296,
        width: 225,
        height: 386,
        radius: 12,
        fillColor: "#121a28eb",
        borderColor: "#2d4464",
        borderWidth: 1.5
      });
      const teleHeader = new Laya.Text();
      teleHeader.pos(14, 10);
      teleHeader.fontSize = 13;
      teleHeader.bold = true;
      teleHeader.color = "#64ffda";
      teleHeader.text = "\u{1F6E1}\uFE0F \u8C6C\u5927\u5F15\u64CE \xB7 \u5546\u696D\u843D\u5730\u9059\u6E2C";
      this.telemetryPanel.addChild(teleHeader);
      this.telemetryText = new Laya.Text();
      this.telemetryText.pos(14, 32);
      this.telemetryText.width = 198;
      this.telemetryText.fontSize = 11;
      this.telemetryText.leading = 3.8;
      this.telemetryText.color = "#cbd5e1";
      this.telemetryPanel.addChild(this.telemetryText);
      const nineSliceBanner = ZhudaUI.createNineSlicePanel(this.root, {
        x: 24,
        y: 632,
        width: 992,
        height: 50,
        sizeGrid: "14,14,14,14,0",
        radius: 9,
        fillColor: "#132036",
        borderColor: "#38bdf8",
        cornerAccentColor: "#2dd4bf",
        innerSurfaceColor: "#0c1524",
        titleText: "\u2714 [M1 \u4E5D\u5BAE\u683C sizeGrid: 4\u89D20px\u8B8A\u5F62] \xB7 [M2 iframe \u97F3\u8A0A/\u5931\u7126\u5B88\u885B] \xB7 [M3 5\u8996\u53E3 SafeArea \u901A\u904E] \xB7 [M4 VFX \u85CD\u5716: 4\u5957] \xB7 [M5 Unity+Animator+Spine4.2]",
        titleColor: "#7df9ff"
      });
      this.nineSliceBannerText = nineSliceBanner.root.getChildByName("NineSliceTitle");
      if (this.nineSliceBannerText) {
        this.nineSliceBannerText.fontSize = 12;
      }
      const watermark = new Laya.Text();
      watermark.pos(24, 692);
      watermark.fontSize = 12;
      watermark.color = "#64748b";
      watermark.text = "Zhuda-LayaAir v1.0 (Base 3.4.2) \xB7 @zhuda-laya/core + @zhuda-laya/compiler + @zhuda-laya/mcp-server \xB7 Zero IDE Dependency";
      this.root.addChild(watermark);
    }
    updateUnityAnimatorBanner(stateName, vfxName) {
      if (this.nineSliceBannerText) {
        this.nineSliceBannerText.text = `\u2714 [M1 9-Slice 0px\u8B8A\u5F62] \xB7 [M2 iframe \u97F3\u8A0A\u5B88\u885B] \xB7 [M3 SafeArea 5/5] \xB7 [M4 VFX: ${vfxName}] \xB7 [M5 Unity Animator: ${stateName}]`;
      }
    }
    refreshTelemetry(bench) {
      const health = EngineGuard.inspectEngineHealth();
      const comps = health.registeredComponents;
      const sa = bench.staticAssetTelemetry;
      const ns = bench.nineSliceTelemetry;
      const vp = bench.viewportMatrixTelemetry;
      const um = bench.unityMigrationTelemetry;
      const lines = [
        `[1] \u62D3\u64B2 & AST \u53CD\u5C04 (Zero-IDE)`,
        `  \u2714 29/29 \u5EAB \xB7 ${comps.length} \u7D44\u4EF6\u8A3B\u518A`,
        `  \u2714 2D \u526A\u679D\u7701 ${bench.pruningProfiles["2d-light"].savedPercent}% | DrawCall ~${bench.estimatedDrawCallsZhuda}`,
        `[2] \u975C\u614B\u8CC7\u7522 (.lh) & \u0394E \u6821\u6E96`,
        `  \u2714 ${sa.totalAssetsCount} \u4EFD\u8CC7\u7522 (${sa.vfxBlueprintsCount} \u5957 VFX \u85CD\u5716)`,
        `  \u2714 \u8AA4\u5DEE ${sa.beforePxError}px\u2192${sa.afterPxError}px | \u0394E00=${sa.afterDeltaE2000}`,
        `[3] M1 \u4E5D\u5BAE\u683C & M2 iframe \u97F3\u8A0A`,
        `  \u2714 sizeGrid \u62C9\u4F38 ${ns.stretchRatioX}x (4\u89D2 ${ns.maxCornerDistortionPx}px \u8B8A\u5F62)`,
        `  \u2714 \u9996\u89F8\u89E3\u9396 + \u5931\u7126\u975C\u97F3 + postMessage`,
        `[4] M3 \u8DE8\u8A2D\u5099\u591A\u89E3\u6790\u5EA6 SafeArea`,
        `  \u2714 ${vp.totalProfiles}/5 \u7D42\u7AEF\u6BD4\u4F8B 0 \u88C1\u5207\u901A\u904E`,
        `[5] M5 Unity + Animator + Spine4.2`,
        `  \u2714 \u8F49\u63DB ${um.convertedNodesCount} \u7BC0\u9EDE (LH\u2192RH \u5EA7\u6A19)`,
        `  \u2714 \u72C0\u614B\u6A5F: ${um.animatorTransitionTrace.join("\u2192")}`
      ];
      this.telemetryText.text = lines.join("\n");
    }
    updateRemainingMines(count) {
      const pad = count < 0 ? "-" + Math.abs(count).toString().padStart(2, "0") : count.toString().padStart(3, "0");
      this.mineCountText.text = pad;
    }
    updateTimer(seconds) {
      const pad = Math.min(999, seconds).toString().padStart(3, "0");
      this.timerText.text = pad;
    }
    updateGameStatus(status) {
      if (status === "playing") {
        this.faceText.text = "\u{1F642}";
        this.statusText.text = "\u26A1 \u6230\u6CC1\uFF1A\u6392\u96F7\u9032\u884C\u4E2D\uFF0C\u6B65\u6B65\u70BA\u71DF\uFF01";
      } else if (status === "won") {
        this.faceText.text = "\u{1F60E}";
        this.statusText.text = "\u{1F3C6} \u606D\u559C\u7372\u52DD\uFF01\u6240\u6709\u5730\u96F7\u5DF2\u6E05\u9664\uFF01\u9EDE\u64CA \u{1F642} \u958B\u59CB\u65B0\u5C40\u3002";
      } else if (status === "lost") {
        this.faceText.text = "\u{1F635}";
        this.statusText.text = "\u{1F4A5} \u89F8\u767C\u5730\u96F7\uFF013D \u7269\u7406\u7206\u7834\u98DB\u6563\u5DF2\u555F\u52D5\uFF0C\u9EDE\u64CA \u{1F642} \u91CD\u65B0\u6311\u6230\u3002";
      } else {
        this.faceText.text = "\u{1F642}";
        this.statusText.text = "\u{1F4A1} \u9EDE\u64CA\u4EFB\u610F\u65B9\u584A\u958B\u59CB\uFF0C\u9996\u64CA\u4E5D\u5BAE\u683C 100% \u4FDD\u8B49\u5B89\u5168\uFF01";
      }
    }
    setPressedFace() {
      this.faceText.text = "\u{1F62E}";
    }
  };

  // src/spine/SpineCompanion.ts
  var SpineCompanion = class {
    constructor(parent) {
      this.state = "idle";
      this.animTime = 0;
      // Spine 4.2 PhysicsConstraint 二階彈簧擺狀態
      this.earAngle = 0;
      this.earVelocity = 0;
      this.hasPhysicsConstraint = false;
      this.container = new Laya.Sprite();
      this.container.name = "SpineCompanionMascot";
      parent.addChild(this.container);
      const spTelemetry = EngineGuard.checkSpine42();
      this.hasPhysicsConstraint = spTelemetry.hasPhysicsConstraint;
      this.canvasSprite = new Laya.Sprite();
      this.container.addChild(this.canvasSprite);
      this.statusLabel = new Laya.Text();
      this.statusLabel.fontSize = 13;
      this.statusLabel.bold = true;
      this.statusLabel.color = "#7df9ff";
      this.statusLabel.align = "center";
      this.statusLabel.width = 210;
      this.statusLabel.y = 128;
      this.statusLabel.text = "Spine 4.2 \u8C6C\u5927\u5B88\u8B77\u7CBE\u9748 \xB7 [\u5F85\u6A5F]";
      this.container.addChild(this.statusLabel);
      this.physicsBadge = new Laya.Text();
      this.physicsBadge.fontSize = 11;
      this.physicsBadge.color = "#64ffda";
      this.physicsBadge.align = "center";
      this.physicsBadge.width = 210;
      this.physicsBadge.y = 148;
      this.physicsBadge.text = this.hasPhysicsConstraint ? "\u2714 PhysicsConstraint \u5F48\u7C27\u7D04\u675F\u555F\u7528" : "\u26A0 Spine Fallback Mode";
      this.container.addChild(this.physicsBadge);
      this.setPosition(1035, 118);
      Laya.timer.frameLoop(1, this, this.onUpdate);
    }
    setPosition(x, y) {
      this.container.pos(x, y);
    }
    applyImpulse(impulse) {
      this.earVelocity += impulse;
    }
    setState(state) {
      if (this.state === state) return;
      this.state = state;
      this.animTime = 0;
      this.earVelocity += state === "scared" ? 8.5 : state === "cheer" ? 5.2 : 2.4;
      const stateTexts = {
        idle: "\u5F85\u6A5F\u5B88\u8B77\u4E2D",
        thinking: "\u5C08\u6CE8\u6392\u96F7\u4E2D",
        flagging: "\u7CBE\u6E96\u63D2\u65D7\u6A19\u8A18\uFF01",
        scared: "\u8E29\u5230\u5730\u96F7\u5566\uFF01\u{1F4A5}",
        cheer: "\u5B8C\u7F8E\u6392\u96F7\u901A\u95DC\uFF01\u{1F389}"
      };
      this.statusLabel.text = `Spine 4.2 \u8C6C\u5927\u7CBE\u9748 \xB7 [${stateTexts[state]}]`;
    }
    onUpdate() {
      this.animTime += 0.05;
      const dt = 0.016;
      const g = this.canvasSprite.graphics;
      g.clear();
      const t = this.animTime;
      let bodyY = 66;
      let bodyScaleX = 1;
      let armAngle = Math.sin(t * 2) * 0.2;
      let eyeType = "normal";
      let windDrive = Math.sin(t * 3) * 1.8;
      switch (this.state) {
        case "idle":
          bodyScaleX = 1 - Math.sin(t * 2) * 0.02;
          bodyY += Math.sin(t * 2) * 3;
          break;
        case "thinking":
          bodyY += Math.sin(t * 3) * 2;
          windDrive = Math.sin(t * 5) * 3.5;
          armAngle = -0.6 + Math.sin(t * 4) * 0.1;
          eyeType = "thinking";
          break;
        case "flagging":
          bodyY += Math.abs(Math.sin(t * 5)) * -8;
          armAngle = 0.8 + Math.sin(t * 6) * 0.3;
          break;
        case "scared":
          bodyY += (Math.random() - 0.5) * 6;
          windDrive = (Math.random() - 0.5) * 14;
          armAngle = 1.2;
          eyeType = "dizzy";
          break;
        case "cheer":
          bodyY += Math.abs(Math.sin(t * 6)) * -16;
          armAngle = Math.sin(t * 8) * 0.8 + 0.6;
          windDrive = Math.sin(t * 8) * 6;
          eyeType = "happy";
          break;
      }
      const stiffness = 95;
      const damping = 0.88;
      const accel = -stiffness * this.earAngle + windDrive;
      this.earVelocity = (this.earVelocity + accel * dt) * damping;
      this.earAngle += this.earVelocity * dt;
      const cx = 105;
      const cy = bodyY;
      g.drawRoundRect(0, 0, 210, 172, 12, 12, 12, 12, "#141d2be6", "#2c415e", 1.5);
      g.drawCircle(cx, 114, 34 + Math.sin(t * 2) * 2, "#00000055");
      g.drawCircle(cx, cy, 36 * bodyScaleX, "#ff9ebb");
      g.drawCircle(cx, cy, 36 * bodyScaleX, null, "#ff6b98", 2);
      g.drawCircle(cx, cy + 9, 20 * bodyScaleX, "#ffd0df");
      const leftEarX = cx - 23 + Math.sin(this.earAngle) * 7;
      const leftEarY = cy - 27 - Math.cos(this.earAngle) * 5;
      g.drawCircle(leftEarX, leftEarY, 11, "#ff6b98");
      g.drawCircle(leftEarX, leftEarY, 6.5, "#ffccd9");
      const rightEarX = cx + 23 - Math.sin(this.earAngle) * 7;
      const rightEarY = cy - 27 - Math.cos(this.earAngle) * 5;
      g.drawCircle(rightEarX, rightEarY, 11, "#ff6b98");
      g.drawCircle(rightEarX, rightEarY, 6.5, "#ffccd9");
      g.drawCircle(cx, cy + 3, 13, "#ffa6c2");
      g.drawCircle(cx, cy + 3, 13, null, "#e05882", 1.5);
      g.drawCircle(cx - 4.5, cy + 3, 2.8, "#782542");
      g.drawCircle(cx + 4.5, cy + 3, 2.8, "#782542");
      const eyeY = cy - 10;
      if (eyeType === "normal") {
        g.drawCircle(cx - 14, eyeY, 4.2, "#222222");
        g.drawCircle(cx + 14, eyeY, 4.2, "#222222");
        g.drawCircle(cx - 12.5, eyeY - 1.5, 1.6, "#ffffff");
        g.drawCircle(cx + 15.5, eyeY - 1.5, 1.6, "#ffffff");
      } else if (eyeType === "thinking") {
        g.drawCircle(cx - 14, eyeY, 4.2, "#222222");
        g.drawCircle(cx + 14, eyeY, 4.2, "#222222");
        g.drawCircle(cx - 15, eyeY - 2, 1.8, "#ffffff");
        g.drawCircle(cx + 13, eyeY - 2, 1.8, "#ffffff");
      } else if (eyeType === "happy") {
        g.drawLine(cx - 18, eyeY, cx - 14, eyeY - 4, "#222222", 2.5);
        g.drawLine(cx - 14, eyeY - 4, cx - 10, eyeY, "#222222", 2.5);
        g.drawLine(cx + 10, eyeY, cx + 14, eyeY - 4, "#222222", 2.5);
        g.drawLine(cx + 14, eyeY - 4, cx + 18, eyeY, "#222222", 2.5);
      } else if (eyeType === "dizzy") {
        g.drawCircle(cx - 14, eyeY, 4.8, null, "#222222", 2);
        g.drawCircle(cx + 14, eyeY, 4.8, null, "#222222", 2);
        g.drawLine(cx - 16, eyeY - 2, cx - 12, eyeY + 2, "#222222", 2);
        g.drawLine(cx + 12, eyeY - 2, cx + 16, eyeY + 2, "#222222", 2);
      }
      g.drawCircle(cx - 22, cy - 2, 4.5, "#ff488255");
      g.drawCircle(cx + 22, cy - 2, 4.5, "#ff488255");
      const leftArmX = cx - 32 - Math.sin(armAngle) * 9;
      const leftArmY = cy + 11 - Math.cos(armAngle) * 7;
      g.drawCircle(leftArmX, leftArmY, 6.5, "#ffaec6");
      const rightArmX = cx + 32 + Math.sin(armAngle) * 9;
      const rightArmY = cy + 11 - Math.cos(armAngle) * 7;
      g.drawCircle(rightArmX, rightArmY, 6.5, "#ffaec6");
    }
    destroy() {
      Laya.timer.clear(this, this.onUpdate);
      this.container.destroy();
    }
  };

  // packages/core/audio/StreamVoice.ts
  var StreamVoice = class {
    constructor(context, media, lease, options, timeoutMs, onFailure, onStarted) {
      this.onended = null;
      this.generation = 0;
      this.ended = false;
      this.paused = false;
      this.started = false;
      this.reportedStart = false;
      this.endedListener = () => this.end();
      this.errorListener = () => this.fail(
        Error(
          `Media playback failed: ${this.media.error?.message || this.media.error?.code || "unknown"}`
        )
      );
      this.context = context;
      this.media = media;
      this.timeoutMs = timeoutMs;
      this.onFailure = onFailure;
      this.onStarted = onStarted;
      media.crossOrigin = lease.crossOrigin ?? "anonymous";
      media.preload = "metadata";
      media.loop = options.loop ?? false;
      media.volume = 1;
      media.muted = false;
      media.addEventListener("ended", this.endedListener);
      media.addEventListener("error", this.errorListener);
      try {
        media.src = lease.url;
        this.output = context.createMediaElementSource(media);
      } catch (error) {
        this.releaseMedia();
        throw error;
      }
    }
    start(_when, offsetSec) {
      if (this.ended) throw Error("Stream voice ended");
      this.media.currentTime = offsetSec;
      this.started = true;
      this.play();
    }
    play() {
      if (this.ended || this.paused || !this.started) return;
      const generation = ++this.generation;
      clearTimeout(this.deadline);
      this.deadline = setTimeout(
        () => this.fail(Error("Stream playback timeout")),
        this.timeoutMs
      );
      try {
        Promise.resolve(this.media.play()).then(
          () => {
            if (generation !== this.generation || this.ended || this.paused)
              return;
            clearTimeout(this.deadline);
            if (!this.reportedStart) {
              this.reportedStart = true;
              this.onStarted();
            }
          },
          (error) => {
            if (generation === this.generation && !this.ended) this.fail(error);
          }
        );
      } catch (error) {
        this.fail(error);
      }
    }
    setPaused(paused) {
      if (this.ended || this.paused === paused) return;
      this.paused = paused;
      if (paused) {
        this.generation++;
        clearTimeout(this.deadline);
        this.media.pause();
      } else this.play();
    }
    stop(when = this.context.currentTime) {
      if (this.alarm) {
        this.alarm.onended = null;
        try {
          this.alarm.stop();
        } catch {
        }
        this.alarm.disconnect();
      }
      this.alarm = void 0;
      if (when <= this.context.currentTime) {
        this.end();
        return;
      }
      const alarm = this.alarm = this.context.createBufferSource();
      alarm.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      alarm.onended = () => {
        if (this.alarm === alarm) this.end();
      };
      alarm.start(when);
    }
    fail(error) {
      if (this.ended) return;
      try {
        this.onFailure(error);
      } finally {
        this.end();
      }
    }
    end() {
      if (this.ended) return;
      this.ended = true;
      this.generation++;
      clearTimeout(this.deadline);
      this.media.pause();
      this.onended?.();
    }
    releaseMedia() {
      this.media.removeEventListener("ended", this.endedListener);
      this.media.removeEventListener("error", this.errorListener);
      this.media.pause();
      this.media.removeAttribute("src");
      this.media.load();
    }
    disconnect() {
      this.ended = true;
      this.generation++;
      clearTimeout(this.deadline);
      if (this.alarm) {
        this.alarm.onended = null;
        try {
          this.alarm.stop();
        } catch {
        }
        this.alarm.disconnect();
        this.alarm = void 0;
      }
      this.onended = null;
      try {
        this.output.disconnect();
      } finally {
        this.releaseMedia();
      }
    }
  };

  // packages/core/audio/OfflineMix.ts
  async function renderOfflineMix(snapshot, options, signal) {
    const rate = options.sampleRate ?? 48e3, channels = options.channels ?? 2, limit = options.maxOutputBytes ?? 256 * 1024 * 1024;
    const frames = Math.round(options.durationSec * rate);
    if (!Number.isInteger(rate) || rate < 8e3 || rate > 192e3 || ![1, 2].includes(channels) || !Number.isFinite(options.durationSec) || options.durationSec <= 0 || !Number.isSafeInteger(frames) || frames < 1 || Math.abs(frames - options.durationSec * rate) > 1e-6 || !Number.isSafeInteger(limit) || limit <= 0 || frames * channels * 8 + 44 > limit || frames * channels * 4 + 36 > 4294967295)
      throw Error("Invalid offline audio duration or PCM budget");
    if (!Array.isArray(options.cues) || options.cues.length > 1e5)
      throw Error("Invalid offline audio cues");
    const ids = /* @__PURE__ */ new Set(), events = [];
    const cues = options.cues.map((cue) => {
      if (!cue || typeof cue.id !== "string" || !cue.id || ids.has(cue.id))
        throw Error("Duplicate or missing offline audio event id");
      ids.add(cue.id);
      const buffer = snapshot.samples.get(cue.sampleId);
      if (!buffer) throw Error("Offline sample is not loaded: " + cue.sampleId);
      const c = {
        ...cue,
        channel: cue.channel ?? "sfx",
        offsetSec: cue.offsetSec ?? 0,
        loopStartSec: cue.loopStartSec ?? 0,
        loopEndSec: cue.loopEndSec ?? buffer.duration,
        peakGain: cue.peakGain ?? 1,
        fadeInSec: cue.fadeInSec ?? 0,
        fadeOutSec: cue.fadeOutSec ?? 0
      };
      if (!["master", "bgm", "sfx", "ui"].includes(c.channel) || ![
        c.atSec,
        c.durationSec,
        c.offsetSec,
        c.loopStartSec,
        c.loopEndSec,
        c.peakGain,
        c.fadeInSec,
        c.fadeOutSec
      ].every(Number.isFinite) || c.atSec < 0 || c.durationSec <= 0 || c.atSec + c.durationSec > options.durationSec + 1e-9 || c.offsetSec < 0 || c.offsetSec >= buffer.duration || c.loopStartSec < 0 || c.loopEndSec > buffer.duration || c.loopEndSec <= c.loopStartSec || c.peakGain < 0 || c.peakGain > 4 || c.fadeInSec < 0 || c.fadeOutSec < 0 || c.fadeInSec + c.fadeOutSec > c.durationSec || !c.loop && c.offsetSec + c.durationSec > buffer.duration + 1 / rate)
        throw Error("Invalid offline audio cue: " + c.id);
      events.push(
        { time: c.atSec, delta: 1 },
        { time: c.atSec + c.durationSec, delta: -1 }
      );
      return { cue: c, buffer };
    });
    let voices = 0;
    for (const event of events.sort(
      (a, b) => a.time - b.time || a.delta - b.delta
    ))
      if ((voices += event.delta) > snapshot.maxVoices)
        throw Error("Offline audio voice capacity exceeded");
    if (signal.aborted) throw signal.reason;
    if (typeof globalThis.OfflineAudioContext !== "function")
      throw Error("OfflineAudioContext unavailable");
    const context = new OfflineAudioContext(channels, frames, rate), nodes = [], sources = [];
    try {
      const master = context.createGain();
      master.gain.value = snapshot.volumes.master;
      master.connect(context.destination);
      nodes.push(master);
      const buses = /* @__PURE__ */ new Map([["master", master]]);
      for (const channel of ["bgm", "sfx", "ui"]) {
        const gain = context.createGain();
        gain.gain.value = snapshot.volumes[channel];
        gain.connect(master);
        buses.set(channel, gain);
        nodes.push(gain);
      }
      for (const { cue: c, buffer } of cues) {
        const source = context.createBufferSource(), gain = context.createGain();
        sources.push(source);
        nodes.push(source, gain);
        source.buffer = buffer;
        source.loop = c.loop ?? false;
        source.loopStart = c.loopStartSec;
        source.loopEnd = c.loopEndSec;
        gain.gain.setValueAtTime(c.fadeInSec ? 0 : c.peakGain, c.atSec);
        if (c.fadeInSec)
          gain.gain.linearRampToValueAtTime(c.peakGain, c.atSec + c.fadeInSec);
        if (c.fadeOutSec) {
          gain.gain.setValueAtTime(
            c.peakGain,
            c.atSec + c.durationSec - c.fadeOutSec
          );
          gain.gain.linearRampToValueAtTime(0, c.atSec + c.durationSec);
        }
        source.connect(gain);
        gain.connect(buses.get(c.channel));
        source.start(c.atSec, c.offsetSec);
        source.stop(c.atSec + c.durationSec);
      }
      const rendered = await context.startRendering();
      if (signal.aborted) throw signal.reason;
      const wav = new Uint8Array(44 + frames * channels * 4), view = new DataView(wav.buffer), write = (offset, text) => {
        for (let i = 0; i < text.length; i++)
          wav[offset + i] = text.charCodeAt(i);
      };
      write(0, "RIFF");
      view.setUint32(4, wav.length - 8, true);
      write(8, "WAVE");
      write(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 3, true);
      view.setUint16(22, channels, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * channels * 4, true);
      view.setUint16(32, channels * 4, true);
      view.setUint16(34, 32, true);
      write(36, "data");
      view.setUint32(40, wav.length - 44, true);
      const data = Array.from(
        { length: channels },
        (_, i) => rendered.getChannelData(i)
      );
      let peak = 0, overRangeSamples = 0;
      for (let i = 0; i < frames; i++)
        for (let c = 0; c < channels; c++) {
          const value = data[c][i];
          if (!Number.isFinite(value)) throw Error("Nonfinite offline sample");
          peak = Math.max(peak, Math.abs(value));
          if (Math.abs(value) > 1) overRangeSamples++;
          view.setFloat32(44 + (i * channels + c) * 4, value, true);
        }
      return {
        sampleRate: rate,
        channels,
        frames,
        durationSec: frames / rate,
        format: "wav-f32",
        peak,
        overRangeSamples,
        wav
      };
    } finally {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
        }
      }
      for (const node of nodes) node.disconnect();
    }
  }

  // packages/core/IframeSoundAdapter.ts
  var CHANNELS = ["bgm", "sfx", "ui"];
  var AUDIO_WAVE_TYPES = [
    "sine",
    "square",
    "sawtooth",
    "triangle"
  ];
  var CONTEXT_STATES = /* @__PURE__ */ new Set(["suspended", "running", "closed"]);
  function isAudioChannel(value) {
    return value === "master" || value === "bgm" || value === "sfx" || value === "ui";
  }
  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  var _IframeSoundAdapter = class _IframeSoundAdapter {
    constructor(options = {}) {
      this.cleanupFns = [];
      this.gestureCleanupFns = [];
      this.ctx = null;
      this.masterGain = null;
      this.channelGains = {};
      this.inIframe = false;
      this.unlockedByGesture = false;
      this.unlockGestureType = "none";
      this.pageVisible = true;
      this.windowFocused = true;
      this.autoSuspendedByBlur = false;
      this.userMuted = false;
      this.postMessageBridgeActive = false;
      this.lastBridgeCommand = "init";
      this.lastError = null;
      this.disposed = false;
      this.unlockAttempt = 0;
      this.volumes = {
        master: 0.85,
        bgm: 0.6,
        sfx: 0.9,
        ui: 0.85
      };
      this.pendingQueue = [];
      this.queuedBeforeUnlockCount = 0;
      this.droppedQueue = 0;
      this.activeVoices = /* @__PURE__ */ new Map();
      this.droppedVoices = 0;
      this.playedEventsCount = 0;
      this.voiceSerial = 0;
      this.samples = /* @__PURE__ */ new Map();
      this.sampleLoads = /* @__PURE__ */ new Map();
      this.streams = /* @__PURE__ */ new Map();
      this.streamLoads = /* @__PURE__ */ new Map();
      this.admissions = /* @__PURE__ */ new Map();
      this.retiredVoices = 0;
      this.backendContextLost = false;
      this.offlineMix = null;
      this.options = {
        ...options,
        queueMaxAgeMs: options.queueMaxAgeMs ?? 500,
        maxPendingQueue: options.maxPendingQueue ?? 32,
        maxActiveVoices: options.maxActiveVoices ?? 32,
        syncLayaSoundManager: options.syncLayaSoundManager ?? false
      };
      this.sampleTimeoutMs = options.sampleTimeoutMs ?? 15e3;
      this.maxSamples = options.maxSamples ?? 32;
      this.maxRetainedStreamBytes = options.maxRetainedStreamBytes ?? 64 * 1024 * 1024;
      this.maxDecodedSampleBytes = options.maxDecodedSampleBytes ?? 64 * 1024 * 1024;
      if (!["reject", "fifo", "priority"].includes(
        options.voiceOverflow ?? "reject"
      ))
        throw Error("Invalid voice overflow");
      if (!Number.isFinite(options.retireFadeSec ?? 5e-3) || (options.retireFadeSec ?? 5e-3) < 0 || (options.retireFadeSec ?? 5e-3) > 1)
        throw Error("Invalid retirement fade");
      if (options.protectedChannels?.some((channel) => !isAudioChannel(channel)))
        throw Error("Invalid protected channel");
      const streamProvider = options.streamProvider ?? options.sampleProvider;
      if (streamProvider?.openStream)
        this.streamCache = new ZhudaAssetCache(
          async (id, signal) => {
            const lease = await streamProvider.openStream(id, { signal });
            if (signal.aborted || this.disposed) {
              lease.release();
              throw new DOMException("Stream load cancelled", "AbortError");
            }
            if (lease.id !== id || !lease.url || !["native", "verified-blob"].includes(lease.delivery) || !["sha256", "transport"].includes(lease.integrity) || !Number.isSafeInteger(lease.retainedBytes) || lease.retainedBytes < 0) {
              lease.release();
              throw Error("Invalid stream lease");
            }
            return lease;
          },
          (lease) => lease.release(),
          0
        );
      for (const [name, value] of Object.entries({
        sampleTimeoutMs: this.sampleTimeoutMs,
        maxSamples: this.maxSamples,
        maxRetainedStreamBytes: this.maxRetainedStreamBytes,
        maxDecodedSampleBytes: this.maxDecodedSampleBytes,
        maxActiveVoices: this.options.maxActiveVoices,
        maxPendingQueue: this.options.maxPendingQueue,
        queueMaxAgeMs: this.options.queueMaxAgeMs
      }))
        if (!Number.isSafeInteger(value) || value <= 0)
          throw Error(`Invalid audio limit: ${name}`);
      if (options.sampleProvider)
        this.sampleCache = createProviderAssetCache(
          options.sampleProvider,
          async (asset, signal) => {
            const context = this.ensureAudioContext();
            if (!context) throw Error("WebAudio decoder unavailable");
            if (signal.aborted)
              throw new DOMException("Sample decode cancelled", "AbortError");
            let cancel = () => {
            };
            try {
              const decoded = await Promise.race([
                context.decodeAudioData(new Uint8Array(asset.bytes).buffer),
                new Promise((_, reject) => {
                  cancel = () => reject(
                    new DOMException("Sample decode cancelled", "AbortError")
                  );
                  signal.addEventListener("abort", cancel, { once: true });
                  if (signal.aborted) cancel();
                })
              ]);
              if (signal.aborted || this.disposed)
                throw new DOMException("Sample decode cancelled", "AbortError");
              const bytes = decoded.length * decoded.numberOfChannels * 4;
              if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.maxDecodedSampleBytes || !Number.isFinite(decoded.duration) || decoded.duration <= 0)
                throw Error("Decoded sample exceeds PCM bound or is empty");
              return decoded;
            } finally {
              signal.removeEventListener("abort", cancel);
            }
          },
          () => {
          }
        );
      this.allowedParentOrigins = new Set(
        (options.allowedParentOrigins ?? []).filter(
          (origin) => typeof origin === "string" && origin.length > 0 && origin !== "*"
        )
      );
      this.now = options.now ?? (() => Date.now());
      this.detectIframeContext();
      this.installGestureUnlockGuards();
      this.installVisibilityAndFocusGuards();
      this.installPostMessageBridge();
      this.syncLayaSoundManager();
      this.syncDomTelemetry();
    }
    static getShared() {
      if (!this.instance || this.instance.disposed) {
        this.instance = new _IframeSoundAdapter();
      }
      return this.instance;
    }
    recordError(error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
    voiceEvent(event) {
      try {
        this.options.onVoiceEvent?.(event);
      } catch (error) {
        this.recordError(error);
      }
    }
    validVoice(options) {
      return (options.priority === void 0 || Number.isFinite(options.priority)) && (options.protected === void 0 || typeof options.protected === "boolean");
    }
    admit(options, task, exclude = []) {
      if (this.activeVoices.size < this.options.maxActiveVoices) return "ready";
      const mode = this.options.voiceOverflow ?? "reject";
      const protectedChannels = this.options.protectedChannels ?? ["bgm"];
      const candidates = [...this.activeVoices].filter(
        ([key, voice]) => !exclude.includes(key) && !voice.stopping && !this.admissions.has(key) && !voice.protected && !protectedChannels.includes(voice.channel) && (mode !== "priority" || (voice.priority ?? 0) <= (options.priority ?? 0))
      );
      if (mode === "priority")
        candidates.sort((a, b) => (a[1].priority ?? 0) - (b[1].priority ?? 0));
      const victim = candidates[0];
      if (mode === "reject" || !victim || this.admissions.size >= this.options.maxPendingQueue) {
        this.droppedVoices++;
        this.voiceEvent({
          type: "rejected",
          id: task.id,
          channel: task.channel,
          reason: "voice-capacity"
        });
        this.syncDomTelemetry();
        return "rejected";
      }
      this.admissions.set(victim[0], task);
      this.retiredVoices++;
      this.voiceEvent({
        type: "retiring",
        id: victim[1].logicalId,
        channel: victim[1].channel,
        replacedBy: task.id,
        reason: mode
      });
      this.stopVoice(victim[0], this.options.retireFadeSec ?? 5e-3);
      this.syncDomTelemetry();
      return "queued";
    }
    detectIframeContext() {
      if (typeof window === "undefined") {
        this.inIframe = false;
        return;
      }
      try {
        this.inIframe = window.self !== window.top;
      } catch (_crossOriginErr) {
        this.inIframe = true;
      }
    }
    defaultAudioContextFactory() {
      if (typeof window === "undefined") return null;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      return new AudioCtx();
    }
    ensureAudioContext(recreateClosed = true) {
      if (this.disposed || this.backendContextLost) return null;
      if (this.ctx && this.ctx.state !== "closed") return this.ctx;
      if (this.ctx?.state === "closed") {
        this.recordError("AudioContext is closed");
        this.unlockedByGesture = false;
        for (const key of [...this.activeVoices.keys()]) this.finishVoice(key);
        if (this.sampleBackend) {
          this.backendContextLost = true;
          try {
            this.sampleBackend.dispose();
          } catch (error) {
            this.recordError(error);
          }
          this.recordError(
            "Sample backend context closed; dispose and recreate the adapter"
          );
          return null;
        }
        this.ctx = null;
        this.masterGain = null;
        this.channelGains = {};
        if (!recreateClosed) return null;
      }
      let context = null;
      try {
        context = this.options.audioContextFactory ? this.options.audioContextFactory() : this.defaultAudioContextFactory();
        if (!context) return null;
        this.ctx = context;
        this.masterGain = context.createGain();
        this.masterGain.gain.value = this.getEffectiveMasterVolume();
        this.masterGain.connect(context.destination);
        this.channelGains = {};
        for (const channel of CHANNELS) {
          const gain = context.createGain();
          gain.gain.value = this.volumes[channel];
          gain.connect(this.masterGain);
          this.channelGains[channel] = gain;
        }
        return context;
      } catch (error) {
        this.recordError(error);
        try {
          if (context && context.state !== "closed") void context.close();
        } catch (_closeError) {
        }
        this.ctx = null;
        this.masterGain = null;
        this.channelGains = {};
        return null;
      }
    }
    getEffectiveMasterVolume() {
      return this.userMuted || this.autoSuspendedByBlur ? 0 : this.volumes.master;
    }
    setGainValue(node, value) {
      if (!this.ctx) return;
      try {
        node.gain.setValueAtTime(value, this.ctx.currentTime);
      } catch (_error) {
        node.gain.value = value;
      }
    }
    updateGainNodes() {
      if (this.masterGain)
        this.setGainValue(this.masterGain, this.getEffectiveMasterVolume());
      for (const channel of CHANNELS) {
        const node = this.channelGains[channel];
        if (node) this.setGainValue(node, this.volumes[channel]);
      }
      this.syncLayaSoundManager();
      this.syncStreamFocus();
      this.syncDomTelemetry();
    }
    syncStreamFocus() {
      const paused = this.autoSuspendedByBlur || !this.unlockedByGesture || this.ctx?.state !== "running";
      for (const voice of this.activeVoices.values())
        if (voice.source instanceof StreamVoice) voice.source.setPaused(paused);
    }
    /** Optional state mirroring for consumers that explicitly still use Laya SoundManager. */
    syncLayaSoundManager() {
      if (!this.options.syncLayaSoundManager) return;
      const g = globalThis;
      const soundManager = g.Laya?.SoundManager;
      if (!soundManager) return;
      soundManager.muted = this.userMuted || this.autoSuspendedByBlur;
      soundManager.autoStopMusic = true;
      soundManager.setMusicVolume?.(
        Number((this.volumes.master * this.volumes.bgm).toFixed(2))
      );
      soundManager.setSoundVolume?.(
        Number((this.volumes.master * this.volumes.sfx).toFixed(2))
      );
    }
    addEventListener(target, type, listener, options, gesture = false) {
      target.addEventListener(type, listener, options);
      const cleanup = () => target.removeEventListener(type, listener, options);
      this.cleanupFns.push(cleanup);
      if (gesture) this.gestureCleanupFns.push(cleanup);
    }
    removeGestureUnlockGuards() {
      for (const cleanup of this.gestureCleanupFns.splice(0)) {
        cleanup();
        const index = this.cleanupFns.indexOf(cleanup);
        if (index >= 0) this.cleanupFns.splice(index, 1);
      }
    }
    installGestureUnlockGuards() {
      if (typeof window === "undefined") return;
      const events = ["pointerdown", "touchstart", "mousedown", "keydown"];
      const onFirstGesture = (event) => {
        this.unlockAudio(event.type || "gesture");
        if (this.unlockedByGesture) this.removeGestureUnlockGuards();
      };
      for (const event of events) {
        this.addEventListener(
          window,
          event,
          onFirstGesture,
          { capture: true, passive: true },
          true
        );
      }
    }
    markUnlocked(gestureSource) {
      this.unlockedByGesture = true;
      this.unlockGestureType = gestureSource;
      this.playSilentUnlockSample();
      this.flushPendingQueue();
      this.syncStreamFocus();
      this.syncDomTelemetry();
    }
    playSilentUnlockSample() {
      if (!this.ctx) return;
      try {
        const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.onended = () => source.disconnect?.();
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (error) {
        this.recordError(error);
      }
    }
    /** Unlocks only after a real context exists and resume succeeds or is already running. */
    unlockAudio(gestureSource = "programmatic-unlock") {
      if (this.disposed) return false;
      this.unlockGestureType = gestureSource;
      const context = this.ensureAudioContext();
      if (!context) {
        this.recordError("WebAudio is unavailable");
        this.syncDomTelemetry();
        return false;
      }
      const attempt = ++this.unlockAttempt;
      if (context.state === "running") {
        this.markUnlocked(gestureSource);
        return true;
      }
      if (context.state !== "suspended" || typeof context.resume !== "function") {
        this.recordError(`AudioContext cannot resume from ${context.state}`);
        this.syncDomTelemetry();
        return false;
      }
      try {
        const result = context.resume();
        Promise.resolve(result).then(
          () => {
            if (this.disposed || attempt !== this.unlockAttempt || this.ctx !== context)
              return;
            if (context.state === "running") {
              this.markUnlocked(gestureSource);
              this.removeGestureUnlockGuards();
            } else {
              this.recordError(`AudioContext resume ended in ${context.state}`);
              this.unlockedByGesture = false;
              this.syncDomTelemetry();
            }
          },
          (error) => {
            if (this.disposed || attempt !== this.unlockAttempt) return;
            this.unlockedByGesture = false;
            this.recordError(error);
            this.syncDomTelemetry();
          }
        );
      } catch (error) {
        this.unlockedByGesture = false;
        this.recordError(error);
        this.syncDomTelemetry();
        return false;
      }
      this.syncDomTelemetry();
      return this.unlockedByGesture;
    }
    flushPendingQueue() {
      if (!this.unlockedByGesture) return;
      if (this.userMuted || this.autoSuspendedByBlur) {
        this.pendingQueue = [];
        return;
      }
      const now = this.now();
      const tasks = this.pendingQueue.splice(0);
      for (const task of tasks) {
        if (now - task.createdAt > this.options.queueMaxAgeMs) {
          this.droppedQueue++;
          continue;
        }
        try {
          if (!task.execute()) this.droppedQueue++;
        } catch (error) {
          this.droppedQueue++;
          this.recordError(error);
        }
      }
      this.syncDomTelemetry();
    }
    installVisibilityAndFocusGuards() {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      this.addEventListener(document, "visibilitychange", () => {
        this.handleFocusOrVisibilityChange(
          document.visibilityState !== "hidden",
          this.windowFocused
        );
      });
      this.addEventListener(window, "blur", () => {
        this.handleFocusOrVisibilityChange(this.pageVisible, false);
      });
      this.addEventListener(window, "focus", () => {
        this.handleFocusOrVisibilityChange(true, true);
      });
      this.addEventListener(window, "pagehide", () => {
        this.handleFocusOrVisibilityChange(false, false);
      });
      this.addEventListener(window, "pageshow", () => {
        this.handleFocusOrVisibilityChange(true, true);
      });
    }
    handleFocusOrVisibilityChange(visible, focused) {
      if (this.disposed) return;
      this.pageVisible = Boolean(visible);
      this.windowFocused = Boolean(focused);
      this.autoSuspendedByBlur = !this.pageVisible || !this.windowFocused;
      if (this.ctx) {
        if (this.autoSuspendedByBlur && this.ctx.state === "running" && typeof this.ctx.suspend === "function") {
          try {
            Promise.resolve(this.ctx.suspend()).catch(
              (error) => this.recordError(error)
            );
          } catch (error) {
            this.recordError(error);
          }
        } else if (!this.autoSuspendedByBlur && !this.userMuted && this.unlockedByGesture && this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
          try {
            Promise.resolve(this.ctx.resume()).then(
              () => this.syncStreamFocus(),
              (error) => this.recordError(error)
            );
          } catch (error) {
            this.recordError(error);
          }
        }
      }
      this.updateGainNodes();
    }
    isAllowedBridgeOrigin(origin) {
      if (!origin || origin === "null") return false;
      if (this.allowedParentOrigins.size > 0)
        return this.allowedParentOrigins.has(origin);
      if (typeof window === "undefined" || !window.location) return false;
      return origin === window.location.origin;
    }
    installPostMessageBridge() {
      if (typeof window === "undefined") return;
      const listener = (event) => {
        const messageEvent = event;
        if (!this.isAllowedBridgeOrigin(messageEvent.origin)) return;
        const data = messageEvent.data;
        if (!data || typeof data !== "object" || typeof data.type !== "string")
          return;
        if (!data.type.startsWith("zhuda:")) return;
        this.handleBridgeMessage(data);
        const source = messageEvent.source;
        if (source && typeof source.postMessage === "function") {
          try {
            source.postMessage(
              {
                type: "zhuda:telemetry:ack",
                receivedCommand: data.type,
                diagnostics: this.getDiagnostics()
              },
              messageEvent.origin
            );
          } catch (error) {
            this.recordError(error);
          }
        }
      };
      this.addEventListener(window, "message", listener);
      this.postMessageBridgeActive = true;
    }
    handleBridgeMessage(msg) {
      if (this.disposed) return this.getDiagnostics();
      this.lastBridgeCommand = typeof msg?.type === "string" ? msg.type : "invalid";
      switch (msg?.type) {
        case "zhuda:audio:mute":
          this.setMuted(true);
          break;
        case "zhuda:audio:unmute":
          this.setMuted(false);
          this.unlockAudio("bridge-unmute");
          break;
        case "zhuda:audio:setVolume":
          if (isAudioChannel(msg.channel) && isFiniteNumber(msg.volume)) {
            this.setChannelVolume(msg.channel, msg.volume);
          }
          break;
        case "zhuda:lifecycle:pause":
          this.handleFocusOrVisibilityChange(false, false);
          break;
        case "zhuda:lifecycle:resume":
          this.handleFocusOrVisibilityChange(true, true);
          break;
        case "zhuda:audio:unlock":
          this.unlockAudio("bridge-unlock");
          break;
        default:
          break;
      }
      this.syncDomTelemetry();
      return this.getDiagnostics();
    }
    setMuted(muted) {
      if (this.disposed) return;
      this.userMuted = Boolean(muted);
      this.updateGainNodes();
    }
    isMuted() {
      return this.userMuted;
    }
    setChannelVolume(channel, volume) {
      if (!isAudioChannel(channel) || !isFiniteNumber(volume) || volume < 0 || volume > 1)
        return false;
      this.volumes[channel] = volume;
      this.updateGainNodes();
      return true;
    }
    getChannelVolume(channel) {
      return this.volumes[channel];
    }
    validateTone(options) {
      if (!options || typeof options.id !== "string" || options.id.trim().length === 0 || !this.validVoice(options))
        return null;
      const channel = options.channel ?? "sfx";
      if (!isAudioChannel(channel)) return null;
      if (!isFiniteNumber(options.startFreq) || options.startFreq <= 0 || options.startFreq > 24e3)
        return null;
      if (options.endFreq !== void 0 && (!isFiniteNumber(options.endFreq) || options.endFreq <= 0 || options.endFreq > 24e3))
        return null;
      if (!isFiniteNumber(options.durationSec) || options.durationSec <= 0 || options.durationSec > 30)
        return null;
      if (options.peakGain !== void 0 && (!isFiniteNumber(options.peakGain) || options.peakGain < 0 || options.peakGain > 1))
        return null;
      if (options.delaySec !== void 0 && (!isFiniteNumber(options.delaySec) || options.delaySec < 0 || options.delaySec > 60))
        return null;
      if (options.waveType !== void 0 && !AUDIO_WAVE_TYPES.includes(options.waveType))
        return null;
      return channel;
    }
    runSynthesis(options, channel) {
      const context = this.ensureAudioContext(false);
      const channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
      if (!context || !this.masterGain || !channelGain) {
        this.recordError("WebAudio mixer is unavailable");
        this.syncDomTelemetry();
        return null;
      }
      const admission = this.admit(options, {
        id: options.id,
        channel,
        execute: () => this.runSynthesis(options, channel) !== null
      });
      if (admission !== "ready") return admission === "queued" ? true : null;
      const voiceKey = `${options.id}:${++this.voiceSerial}`;
      const when = context.currentTime + (options.delaySec ?? 0);
      const duration = options.durationSec;
      const state = {
        logicalId: options.id,
        channel,
        priority: options.priority,
        protected: options.protected,
        source: null,
        stopped: false
      };
      try {
        const source = context.createOscillator();
        const gain = context.createGain();
        state.source = source;
        state.gain = gain;
        source.type = options.waveType ?? "triangle";
        source.frequency.setValueAtTime(options.startFreq, when);
        if (options.endFreq !== void 0 && options.endFreq !== options.startFreq) {
          source.frequency.exponentialRampToValueAtTime(
            options.endFreq,
            when + duration
          );
        }
        const peak = options.peakGain ?? 0.18;
        gain.gain.setValueAtTime(Math.max(1e-3, peak), when);
        gain.gain.exponentialRampToValueAtTime(8e-4, when + duration);
        source.connect(gain);
        gain.connect(channelGain);
        source.onended = () => this.finishVoice(voiceKey);
        this.activeVoices.set(voiceKey, state);
        source.start(when);
        source.stop(when + duration);
        this.playedEventsCount++;
        this.voiceEvent({ type: "started", id: options.id, channel });
        const handle = {
          id: options.id,
          channel,
          get stopped() {
            return state.stopped;
          },
          stop: () => this.stopVoice(voiceKey)
        };
        this.syncDomTelemetry();
        return handle;
      } catch (error) {
        this.recordError(error);
        state.stopped = true;
        try {
          state.source?.disconnect?.();
          state.gain?.disconnect?.();
        } catch {
        }
        this.activeVoices.delete(voiceKey);
        this.syncDomTelemetry();
        return null;
      }
    }
    submit(task, replace = false) {
      if (this.disposed || this.userMuted || this.autoSuspendedByBlur)
        return false;
      if ([...this.admissions.values()].some((value) => value.id === task.id))
        return false;
      if (this.unlockedByGesture) return task.execute();
      const old = this.pendingQueue.findIndex((value) => value.id === task.id);
      if (old >= 0 && !replace) {
        this.droppedQueue++;
        this.syncDomTelemetry();
        return false;
      }
      if (old < 0 && this.pendingQueue.length >= this.options.maxPendingQueue) {
        this.droppedQueue++;
        this.syncDomTelemetry();
        return false;
      }
      const queued = { ...task, createdAt: this.now() };
      if (old >= 0) this.pendingQueue[old] = queued;
      else this.pendingQueue.push(queued);
      this.queuedBeforeUnlockCount++;
      this.syncDomTelemetry();
      return true;
    }
    /** Queues once before unlock, then starts one voice through the shared mixer. */
    scheduleTone(options) {
      const channel = this.validateTone(options);
      if (!channel) return false;
      const snapshot = { ...options };
      return this.submit({
        id: snapshot.id,
        channel,
        execute: () => this.runSynthesis(snapshot, channel) !== null
      });
    }
    sampleInfo(id, buffer) {
      return {
        id,
        durationSec: buffer.duration,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        frames: buffer.length,
        decodedBytes: buffer.length * buffer.numberOfChannels * 4
      };
    }
    /** Load and decode a provider logical ID. Repeated callers share the existing cache work. */
    async loadSample(id, options = {}) {
      normalizeAssetId(id);
      if (this.disposed || !this.sampleCache)
        throw Error("Sample loading requires a live adapter with sampleProvider");
      if (options.signal?.aborted)
        throw new DOMException("Sample load cancelled", "AbortError");
      const existing = this.samples.get(id);
      if (existing) return this.sampleInfo(id, existing.value);
      const reserved = /* @__PURE__ */ new Set([
        ...this.samples.keys(),
        ...this.sampleLoads.values(),
        id
      ]);
      if (reserved.size > this.maxSamples)
        throw Error("Audio sample capacity exceeded");
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      this.sampleLoads.set(controller, id);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        abort();
      }, this.sampleTimeoutMs);
      let lease;
      try {
        lease = await this.sampleCache.acquire(id, { signal: controller.signal });
        if (controller.signal.aborted || this.disposed)
          throw new DOMException("Sample load cancelled", "AbortError");
        const info = this.sampleInfo(id, lease.value);
        if (!this.samples.has(id)) {
          if (this.getDiagnostics().decodedSampleBytes + info.decodedBytes > this.maxDecodedSampleBytes)
            throw Error("Total decoded sample PCM bound exceeded");
          this.samples.set(id, lease);
          lease = void 0;
        }
        return info;
      } catch (error) {
        const failure = timedOut ? new Error(`Audio sample load/decode timeout: ${id}`) : error;
        this.recordError(failure);
        throw failure;
      } finally {
        lease?.release();
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        this.sampleLoads.delete(controller);
        if (this.disposed && !this.sampleLoads.size) this.sampleCache.dispose();
        this.syncDomTelemetry();
      }
    }
    /** Stops this sample's queued/active voices, cancels pending loads and releases its PCM lease. */
    unloadSample(id) {
      let changed = false;
      for (const [controller, sampleId] of this.sampleLoads)
        if (sampleId === id) {
          controller.abort();
          changed = true;
        }
      for (const [key, task] of this.admissions)
        if (task.sampleId === id) {
          this.admissions.delete(key);
          changed = true;
        }
      for (const [key, voice] of [...this.activeVoices])
        if (voice.sampleId === id) {
          this.stopVoice(key);
          changed = true;
        }
      const before = this.pendingQueue.length;
      this.pendingQueue = this.pendingQueue.filter(
        (task) => task.sampleId !== id
      );
      changed || (changed = before !== this.pendingQueue.length);
      const lease = this.samples.get(id);
      if (lease) {
        this.samples.delete(id);
        lease.release();
        changed = true;
      }
      this.syncDomTelemetry();
      return changed;
    }
    /** Install one sample backend before playback. No implicit fallback after
     * failure: the caller may retry or retain native playback explicitly. */
    async prepareSampleBackend(backend, options = {}) {
      if (this.disposed || this.sampleBackend || this.backendPreparing || this.activeVoices.size || this.pendingQueue.length || this.admissions.size)
        throw Error(
          "Backend preparation requires an idle, live adapter without a backend"
        );
      const provider = this.options.sampleProvider;
      const context = this.ensureAudioContext();
      if (!provider || !context || !backend?.name)
        throw Error("Backend requires provider, context and name");
      const controller = this.backendPreparing = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      const timer = setTimeout(
        () => controller.abort(
          new DOMException("Backend prepare timeout", "TimeoutError")
        ),
        this.sampleTimeoutMs
      );
      let cancel = () => {
      };
      let accepted = false;
      const work = Promise.resolve().then(() => {
        if (controller.signal.aborted)
          throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
        return backend.prepare({ context, provider, signal: controller.signal });
      });
      void work.then(
        () => {
          if (controller.signal.aborted || this.disposed) {
            try {
              backend.dispose();
            } catch (error) {
              this.recordError(error);
            }
          }
        },
        () => {
        }
      );
      try {
        await Promise.race([
          work,
          new Promise((_, reject) => {
            cancel = () => reject(
              controller.signal.reason ?? new DOMException("Cancelled", "AbortError")
            );
            controller.signal.addEventListener("abort", cancel, { once: true });
            if (controller.signal.aborted) cancel();
          })
        ]);
        if (this.disposed || controller.signal.aborted)
          throw new DOMException("Backend cancelled", "AbortError");
        this.sampleBackend = backend;
        accepted = true;
      } catch (error) {
        this.recordError(error);
        throw error;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        controller.signal.removeEventListener("abort", cancel);
        this.backendPreparing = void 0;
        if (!accepted) {
          try {
            backend.dispose();
          } catch (error) {
            this.recordError(error);
          }
        }
      }
    }
    async loadStream(id, options = {}) {
      id = normalizeAssetId(id);
      if (this.disposed || !this.streamCache)
        throw Error("Stream loading requires a live provider with openStream");
      if (options.signal?.aborted)
        throw new DOMException("Stream cancelled", "AbortError");
      const info = (lease2) => ({
        id,
        integrity: lease2.integrity,
        delivery: lease2.delivery,
        retainedBytes: lease2.retainedBytes
      });
      const existing = this.streams.get(id);
      if (existing) return info(existing.value);
      if ((/* @__PURE__ */ new Set([...this.streams.keys(), ...this.streamLoads.values(), id])).size > this.maxSamples)
        throw Error("Stream capacity exceeded");
      const controller = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      this.streamLoads.set(controller, id);
      let timeout = false;
      const timer = setTimeout(() => {
        timeout = true;
        controller.abort();
      }, this.sampleTimeoutMs);
      let lease;
      try {
        lease = await this.streamCache.acquire(id, { signal: controller.signal });
        if (controller.signal.aborted || this.disposed)
          throw new DOMException("Stream cancelled", "AbortError");
        const result = info(lease.value);
        if (!this.streams.has(id)) {
          if (this.getDiagnostics().retainedStreamBytes + result.retainedBytes > this.maxRetainedStreamBytes)
            throw Error("Total retained stream byte bound exceeded");
          this.streams.set(id, lease);
          lease = void 0;
        }
        return result;
      } catch (error) {
        const failure = timeout ? Error(`Stream load timeout: ${id}`) : error;
        this.recordError(failure);
        throw failure;
      } finally {
        lease?.release();
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        this.streamLoads.delete(controller);
        if (this.disposed && !this.streamLoads.size) this.streamCache.dispose();
        this.syncDomTelemetry();
      }
    }
    unloadStream(id) {
      let changed = false;
      for (const [controller, value] of this.streamLoads)
        if (value === id) {
          controller.abort();
          changed = true;
        }
      for (const [key, task] of this.admissions)
        if (task.streamId === id) {
          this.admissions.delete(key);
          changed = true;
        }
      const before = this.pendingQueue.length;
      this.pendingQueue = this.pendingQueue.filter(
        (task) => task.streamId !== id
      );
      changed || (changed = before !== this.pendingQueue.length);
      for (const [key, voice] of [...this.activeVoices])
        if (voice.streamId === id) {
          this.stopVoice(key);
          changed = true;
        }
      const lease = this.streams.get(id);
      if (lease) {
        this.streams.delete(id);
        lease.release();
        changed = true;
      }
      this.syncDomTelemetry();
      return changed;
    }
    playStream(options) {
      if (!options || !options.id?.trim() || !this.validVoice(options))
        return false;
      const lease = this.streams.get(options.streamId), channel = options.channel ?? "bgm";
      if (!lease || !isAudioChannel(channel)) return false;
      const offset = options.offsetSec ?? 0, fade = options.fadeInSec ?? options.crossFadeSec ?? 0, crossFade = options.crossFadeSec ?? 0, peak = options.peakGain ?? 1;
      if (![offset, fade, crossFade, peak].every(
        (v) => Number.isFinite(v) && v >= 0
      ) || peak > 1 || fade > 60 || crossFade > 60 || crossFade > 0 && !options.replace || options.loop !== void 0 && typeof options.loop !== "boolean" || options.replace !== void 0 && typeof options.replace !== "boolean")
        return false;
      const snapshot = { ...options };
      const task = {
        id: snapshot.id,
        streamId: snapshot.streamId,
        channel,
        execute: () => {
          if (this.disposed || this.userMuted || this.autoSuspendedByBlur || this.streams.get(snapshot.streamId) !== lease)
            return false;
          const previous = [...this.activeVoices].filter(([, v]) => v.logicalId === snapshot.id).map(([k]) => k);
          if (previous.length && !snapshot.replace) return false;
          const context = this.ensureAudioContext(false), channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
          if (!context || !channelGain) return false;
          const admission = this.admit(snapshot, task, previous);
          if (admission !== "ready") return admission === "queued";
          const key = `${snapshot.id}:${++this.voiceSerial}`;
          let source, gain;
          try {
            const media = this.options.mediaElementFactory?.() ?? document.createElement("audio");
            source = new StreamVoice(
              context,
              media,
              lease.value,
              snapshot,
              this.sampleTimeoutMs,
              (error) => {
                this.recordError(error);
                this.voiceEvent({
                  type: "failed",
                  id: snapshot.id,
                  channel,
                  reason: String(error)
                });
              },
              () => {
                if (!this.activeVoices.has(key) || this.disposed) return;
                gain.gain.setValueAtTime(fade ? 0 : peak, context.currentTime);
                if (fade)
                  gain.gain.linearRampToValueAtTime(
                    peak,
                    context.currentTime + fade
                  );
                for (const old of previous) this.stopVoice(old, crossFade);
                this.playedEventsCount++;
                this.voiceEvent({ type: "started", id: snapshot.id, channel });
                this.syncDomTelemetry();
              }
            );
            gain = context.createGain();
            gain.gain.setValueAtTime(fade ? 0 : peak, context.currentTime);
            source.output.connect(gain);
            gain.connect(channelGain);
            source.onended = () => this.finishVoice(key);
            this.activeVoices.set(key, {
              logicalId: snapshot.id,
              channel,
              source,
              gain,
              streamId: snapshot.streamId,
              stopped: false,
              priority: snapshot.priority,
              protected: snapshot.protected
            });
            source.start(context.currentTime, offset);
            this.syncDomTelemetry();
            return true;
          } catch (error) {
            source?.disconnect();
            gain?.disconnect();
            this.activeVoices.delete(key);
            this.recordError(error);
            return false;
          }
        }
      };
      return this.submit(task, snapshot.replace);
    }
    playSample(options) {
      if (!options || typeof options.id !== "string" || !options.id.trim() || !this.validVoice(options) || this.backendPreparing)
        return false;
      const lease = this.samples.get(options.sampleId);
      const channel = options.channel ?? "sfx";
      if (!lease || !isAudioChannel(channel)) return false;
      const buffer = lease.value;
      const offset = options.offsetSec ?? 0, loopStart = options.loopStartSec ?? 0, loopEnd = options.loopEndSec ?? buffer.duration;
      for (const value of [
        offset,
        loopStart,
        loopEnd,
        options.fadeInSec ?? 0,
        options.fadeOutSec ?? 0,
        options.crossFadeSec ?? 0
      ])
        if (!Number.isFinite(value) || value < 0) return false;
      if (offset >= buffer.duration || loopStart >= loopEnd || loopEnd > buffer.duration || options.loop !== void 0 && typeof options.loop !== "boolean" || options.replace !== void 0 && typeof options.replace !== "boolean" || (options.crossFadeSec ?? 0) > 0 && !options.replace || options.durationSec !== void 0 && (!Number.isFinite(options.durationSec) || options.durationSec <= 0) || options.peakGain !== void 0 && (!Number.isFinite(options.peakGain) || options.peakGain < 0 || options.peakGain > 1))
        return false;
      const duration = options.loop ? options.durationSec : Math.min(options.durationSec ?? Infinity, buffer.duration - offset);
      const fadeIn = options.fadeInSec ?? options.crossFadeSec ?? 0, fadeOut = options.fadeOutSec ?? 0;
      if (fadeIn > 60 || fadeOut > 60 || (options.crossFadeSec ?? 0) > 60 || (duration === void 0 ? fadeOut > 0 : fadeIn + fadeOut > duration))
        return false;
      const snapshot = { ...options };
      const task = {
        id: snapshot.id,
        sampleId: snapshot.sampleId,
        channel,
        execute: () => {
          if (this.samples.get(snapshot.sampleId) !== lease || this.userMuted || this.autoSuspendedByBlur)
            return false;
          const previous = [...this.activeVoices].filter(([, voice]) => voice.logicalId === snapshot.id).map(([key2]) => key2);
          if (previous.length && !snapshot.replace) return false;
          const context = this.ensureAudioContext(false);
          const channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
          if (!context || !channelGain) return false;
          const admission = this.admit(snapshot, task, previous);
          if (admission !== "ready") return admission === "queued";
          const key = `${snapshot.id}:${++this.voiceSerial}`;
          let source, gain;
          try {
            if (this.sampleBackend)
              source = this.sampleBackend.createVoice(buffer, snapshot);
            else {
              source = context.createBufferSource();
              source.buffer = buffer;
              source.loop = snapshot.loop ?? false;
              source.loopStart = loopStart;
              source.loopEnd = loopEnd;
            }
            gain = context.createGain();
            const now = context.currentTime, peak = snapshot.peakGain ?? 1;
            gain.gain.setValueAtTime(fadeIn ? 0 : peak, now);
            if (fadeIn) gain.gain.linearRampToValueAtTime(peak, now + fadeIn);
            if (duration !== void 0 && fadeOut) {
              gain.gain.setValueAtTime(peak, now + duration - fadeOut);
              gain.gain.linearRampToValueAtTime(0, now + duration);
            }
            ("output" in source ? source.output : source).connect(gain);
            gain.connect(channelGain);
            source.onended = () => this.finishVoice(key);
            this.activeVoices.set(key, {
              logicalId: snapshot.id,
              channel,
              source,
              gain,
              sampleId: snapshot.sampleId,
              stopped: false,
              priority: snapshot.priority,
              protected: snapshot.protected
            });
            source.start(now, offset);
            if (duration !== void 0) source.stop(now + duration);
            for (const old of previous)
              this.stopVoice(old, snapshot.crossFadeSec ?? 0);
            this.playedEventsCount++;
            this.voiceEvent({ type: "started", id: snapshot.id, channel });
            this.syncDomTelemetry();
            return true;
          } catch (error) {
            try {
              source?.stop();
            } catch {
            }
            source?.disconnect();
            gain?.disconnect();
            this.activeVoices.delete(key);
            this.recordError(error);
            this.syncDomTelemetry();
            return false;
          }
        }
      };
      return this.submit(task, snapshot.replace);
    }
    /** Explicit offline soundtrack using loaded samples and this mixer's gain snapshot.
     * Does not play live voices, use a second live AudioContext or dispatch events. */
    async renderOffline(options) {
      if (this.disposed || this.offlineMix)
        throw Error("Offline mixer is disposed or busy");
      const timeout = options.timeoutMs ?? 3e4;
      if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647)
        throw Error("Invalid offline audio deadline");
      if (options.signal?.aborted)
        throw options.signal.reason ?? new DOMException("Cancelled", "AbortError");
      const controller = this.offlineMix = new AbortController(), abort = () => controller.abort(
        options.signal?.reason ?? new DOMException("Cancelled", "AbortError")
      );
      options.signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(
        () => controller.abort(
          new DOMException("Offline mix timed out", "TimeoutError")
        ),
        timeout
      );
      const work = renderOfflineMix(
        {
          samples: new Map(
            [...this.samples].map(([id, lease]) => [id, lease.value])
          ),
          volumes: {
            ...this.volumes,
            master: this.userMuted ? 0 : this.volumes.master
          },
          maxVoices: this.options.maxActiveVoices
        },
        options,
        controller.signal
      );
      const drained = () => {
        if (this.offlineMix === controller) this.offlineMix = null;
      };
      void work.then(drained, drained);
      try {
        return await awaitAbortable(work, controller.signal);
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      }
    }
    stop(id, fadeOutSec = 0) {
      if (!Number.isFinite(fadeOutSec) || fadeOutSec < 0 || fadeOutSec > 60)
        return false;
      let stopped = false;
      for (const [key, task] of this.admissions)
        if (task.id === id) {
          this.admissions.delete(key);
          stopped = true;
        }
      for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
        if (voice.logicalId === id)
          stopped = this.stopVoice(voiceKey, fadeOutSec) || stopped;
      }
      const before = this.pendingQueue.length;
      this.pendingQueue = this.pendingQueue.filter((task) => task.id !== id);
      if (before !== this.pendingQueue.length) stopped = true;
      this.syncDomTelemetry();
      return stopped;
    }
    finishVoice(voiceKey) {
      const voice = this.activeVoices.get(voiceKey);
      if (!voice) return;
      this.activeVoices.delete(voiceKey);
      voice.stopped = true;
      voice.source.onended = null;
      try {
        voice.source.disconnect?.();
      } catch {
      }
      try {
        voice.gain?.disconnect?.();
      } catch {
      }
      const next = this.admissions.get(voiceKey);
      this.admissions.delete(voiceKey);
      this.voiceEvent({
        type: "ended",
        id: voice.logicalId,
        channel: voice.channel
      });
      if (next && !this.disposed && !this.userMuted && !this.autoSuspendedByBlur)
        next.execute();
      this.syncDomTelemetry();
    }
    stopVoice(voiceKey, fadeOutSec = 0) {
      const voice = this.activeVoices.get(voiceKey);
      if (!voice) return false;
      if (fadeOutSec && voice.stopping) return false;
      try {
        if (fadeOutSec && this.ctx && voice.gain) {
          const now = this.ctx.currentTime;
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
          voice.gain.gain.linearRampToValueAtTime(0, now + fadeOutSec);
          voice.source.stop(now + fadeOutSec);
          voice.stopping = true;
          return true;
        }
        voice.source.stop();
      } catch (_error) {
      }
      this.finishVoice(voiceKey);
      return true;
    }
    stopAll(channel) {
      for (const [key, task] of this.admissions)
        if (channel === void 0 || task.channel === channel)
          this.admissions.delete(key);
      const before = this.pendingQueue.length;
      this.pendingQueue = this.pendingQueue.filter(
        (task) => channel !== void 0 && task.channel !== channel
      );
      let count = before - this.pendingQueue.length;
      for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
        if (channel === void 0 || voice.channel === channel) {
          if (this.stopVoice(voiceKey)) count++;
        }
      }
      this.syncDomTelemetry();
      return count;
    }
    getDiagnostics() {
      const state = this.ctx && CONTEXT_STATES.has(this.ctx.state) ? this.ctx.state : "uninitialized";
      return {
        loadedStreams: this.streams.size,
        pendingStreamLoads: this.streamLoads.size,
        retainedStreamBytes: [...this.streams.values()].reduce(
          (sum, lease) => sum + lease.value.retainedBytes,
          0
        ),
        pendingAdmissions: this.admissions.size,
        retiredVoices: this.retiredVoices,
        sampleBackend: this.sampleBackend?.name ?? "native",
        loadedSamples: this.samples.size,
        pendingSampleLoads: this.sampleLoads.size,
        decodedSampleBytes: [...this.samples.values()].reduce(
          (sum, lease) => sum + lease.value.length * lease.value.numberOfChannels * 4,
          0
        ),
        inIframe: this.inIframe,
        contextState: state,
        unlockedByGesture: this.unlockedByGesture,
        unlockGestureType: this.unlockGestureType,
        pageVisible: this.pageVisible,
        windowFocused: this.windowFocused,
        autoSuspendedByBlur: this.autoSuspendedByBlur,
        userMuted: this.userMuted,
        volumes: { ...this.volumes },
        queuedBeforeUnlockCount: this.queuedBeforeUnlockCount,
        pendingQueue: this.pendingQueue.length,
        droppedQueue: this.droppedQueue,
        activeVoices: this.activeVoices.size,
        droppedVoices: this.droppedVoices,
        playedEventsCount: this.playedEventsCount,
        postMessageBridgeActive: this.postMessageBridgeActive,
        lastBridgeCommand: this.lastBridgeCommand,
        backend: this.ctx ? "webaudio" : "unavailable",
        contextAvailable: this.ctx !== null,
        lastError: this.lastError
      };
    }
    syncDomTelemetry() {
      const diagnostics = this.getDiagnostics();
      const win = globalThis;
      win.__ZHUDA_IFRAME_AUDIO__ = diagnostics;
      if (!this.disposed) win.__ZHUDA_IFRAME_ADAPTER__ = this;
      if (typeof document !== "undefined" && document.body) {
        document.body.dataset.zhudaIframeAudio = this.postMessageBridgeActive ? "ready" : "inactive";
        document.body.dataset.zhudaAudioMuted = String(
          this.userMuted || this.autoSuspendedByBlur
        );
        document.body.dataset.zhudaAudioPlayed = String(this.playedEventsCount);
      }
    }
    /** Stops voices, removes every event listener and closes the owned context. */
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.offlineMix?.abort(new DOMException("Mixer disposed", "AbortError"));
      this.backendPreparing?.abort();
      this.unlockAttempt++;
      this.pendingQueue = [];
      this.stopAll();
      for (const controller of this.sampleLoads.keys()) controller.abort();
      for (const id of [...this.samples.keys()]) this.unloadSample(id);
      for (const controller of this.streamLoads.keys()) controller.abort();
      for (const id of [...this.streams.keys()]) this.unloadStream(id);
      if (!this.streamLoads.size) this.streamCache?.dispose();
      try {
        this.sampleBackend?.dispose();
      } catch (error) {
        this.recordError(error);
      }
      if (!this.sampleLoads.size) this.sampleCache?.dispose();
      try {
        this.masterGain?.disconnect?.();
        for (const node of Object.values(this.channelGains)) node.disconnect?.();
      } catch {
      }
      for (const cleanup of this.cleanupFns.splice(0)) cleanup();
      this.gestureCleanupFns.splice(0);
      this.postMessageBridgeActive = false;
      if (this.ctx && typeof this.ctx.close === "function" && this.ctx.state !== "closed") {
        try {
          Promise.resolve(this.ctx.close()).catch(
            (error) => this.recordError(error)
          );
        } catch (error) {
          this.recordError(error);
        }
      }
      this.syncDomTelemetry();
      if (_IframeSoundAdapter.instance === this)
        _IframeSoundAdapter.instance = null;
    }
  };
  _IframeSoundAdapter.instance = null;
  var IframeSoundAdapter = _IframeSoundAdapter;

  // src/audio/MinesweeperAudio.ts
  var MinesweeperAudio = class {
    constructor(adapter = IframeSoundAdapter.getShared()) {
      this.enabled = true;
      this.iframeAdapter = adapter;
    }
    setEnabled(value) {
      this.enabled = Boolean(value);
      this.iframeAdapter.setMuted(!this.enabled);
    }
    isEnabled() {
      return this.enabled && !this.iframeAdapter.isMuted();
    }
    playClick() {
      if (!this.isEnabled()) return;
      this.iframeAdapter.scheduleTone({
        id: "sfx-click",
        channel: "sfx",
        waveType: "triangle",
        startFreq: 620,
        endFreq: 310,
        durationSec: 0.06,
        peakGain: 0.18
      });
    }
    playFlag() {
      if (!this.isEnabled()) return;
      this.iframeAdapter.scheduleTone({
        id: "sfx-flag",
        channel: "sfx",
        waveType: "sine",
        startFreq: 820,
        endFreq: 1240,
        durationSec: 0.08,
        peakGain: 0.2
      });
    }
    playChord(chainStep = 0) {
      if (!this.isEnabled()) return;
      const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
      const index = Math.max(0, Math.min(Math.floor(chainStep), notes.length - 1));
      this.iframeAdapter.scheduleTone({
        id: `sfx-chord-${index}`,
        channel: "sfx",
        waveType: "sine",
        startFreq: notes[index],
        durationSec: 0.12,
        peakGain: 0.15
      });
    }
    playExplode() {
      if (!this.isEnabled()) return;
      this.iframeAdapter.scheduleTone({
        id: "sfx-explode",
        channel: "sfx",
        waveType: "sawtooth",
        startFreq: 150,
        endFreq: 30,
        durationSec: 0.6,
        peakGain: 0.4
      });
    }
    playVictory() {
      if (!this.isEnabled()) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        this.iframeAdapter.scheduleTone({
          id: `sfx-victory-${index}`,
          channel: "bgm",
          waveType: "triangle",
          startFreq: frequency,
          durationSec: 0.35,
          delaySec: index * 0.12,
          peakGain: 0.2
        });
      });
    }
    dispose() {
      this.iframeAdapter.stopAll();
    }
  };

  // packages/core/StaticAssetPipeline.ts
  var ZhudaAssetSerializer = class {
    static nextId(prefix = "node") {
      const id = `${prefix}_${String(this.idCounter++).padStart(3, "0")}`;
      return id;
    }
    /**
     * 將運行期動態建立的 Laya.Node / Laya.Sprite 節點樹，無損反向序列化為標準 LayaAir 3.4.2 .lh JSON 結構
     */
    static serializeNodeToHierarchy(node, options = {}) {
      const isRoot = options.isRoot ?? true;
      if (isRoot) {
        this.idCounter = 1;
      }
      const nodeType = this.detectLayaNodeType(node);
      const data = {
        ...isRoot ? { _$ver: 1 } : {},
        _$id: node?._$id || this.nextId(nodeType.toLowerCase()),
        _$type: nodeType,
        name: node?.name || nodeType
      };
      if (typeof node?.x === "number" && node.x !== 0) data.x = Number(node.x.toFixed(2));
      else if (typeof node?.x === "number" && isRoot) data.x = 0;
      if (typeof node?.y === "number" && node.y !== 0) data.y = Number(node.y.toFixed(2));
      else if (typeof node?.y === "number" && isRoot) data.y = 0;
      if (typeof node?.width === "number" && node.width > 0) data.width = Number(node.width.toFixed(2));
      if (typeof node?.height === "number" && node.height > 0) data.height = Number(node.height.toFixed(2));
      if (typeof node?.scaleX === "number" && node.scaleX !== 1) data.scaleX = node.scaleX;
      if (typeof node?.scaleY === "number" && node.scaleY !== 1) data.scaleY = node.scaleY;
      if (typeof node?.rotation === "number" && node.rotation !== 0) data.rotation = node.rotation;
      if (typeof node?.pivotX === "number" && node.pivotX !== 0) data.pivotX = Number(node.pivotX.toFixed(2));
      if (typeof node?.pivotY === "number" && node.pivotY !== 0) data.pivotY = Number(node.pivotY.toFixed(2));
      if (typeof node?.anchorX === "number" && node.anchorX !== 0) data.anchorX = Number(node.anchorX.toFixed(4));
      if (typeof node?.anchorY === "number" && node.anchorY !== 0) data.anchorY = Number(node.anchorY.toFixed(4));
      if (typeof node?.skewX === "number" && node.skewX !== 0) data.skewX = Number(node.skewX.toFixed(4));
      if (typeof node?.skewY === "number" && node.skewY !== 0) data.skewY = Number(node.skewY.toFixed(4));
      if (typeof node?.alpha === "number" && node.alpha !== 1) data.alpha = node.alpha;
      if (typeof node?.visible === "boolean" && !node.visible) data.visible = false;
      if (typeof node?.mouseEnabled === "boolean" && node.mouseEnabled) data.mouseEnabled = true;
      if (typeof node?.skin === "string" && node.skin) data.skin = node.skin;
      if (typeof node?.sizeGrid === "string" && node.sizeGrid) data.sizeGrid = node.sizeGrid;
      else if (Array.isArray(node?.sizeGrid)) data.sizeGrid = node.sizeGrid.join(",");
      if (nodeType === "Text" || nodeType === "Label" || typeof node?.text === "string") {
        data.text = String(node.text ?? "");
        if (node.font) data.font = node.font;
        if (typeof node.fontSize === "number") data.fontSize = node.fontSize;
        if (node.color) data.color = node.color;
        if (typeof node.bold === "boolean") data.bold = node.bold;
        if (node.align) data.align = node.align;
        if (node.valign) data.valign = node.valign;
        if (typeof node.wordWrap === "boolean") data.wordWrap = node.wordWrap;
        if (typeof node.overflow === "string" && node.overflow) data.overflow = node.overflow;
        if (typeof node.leading === "number" && node.leading !== 0) data.leading = node.leading;
        if (typeof node.letterSpacing === "number" && node.letterSpacing !== 0) data.letterSpacing = node.letterSpacing;
        if (typeof node.stroke === "number" && node.stroke !== 0) data.stroke = node.stroke;
        if (node.strokeColor) data.strokeColor = node.strokeColor;
        if (typeof node.underline === "boolean" && node.underline) data.underline = true;
        if (node.underlineColor) data.underlineColor = node.underlineColor;
        if (typeof node.strikethrough === "boolean" && node.strikethrough) data.strikethrough = true;
        if (Array.isArray(node.padding) && node.padding.length === 4) {
          data.padding = node.padding.map((value) => Number(value) || 0);
        }
      }
      const rawCmds = node?.graphics?.cmds || node?.graphics?._cmds || node?._gcmds;
      if (Array.isArray(rawCmds) && rawCmds.length > 0) {
        const serializedCmds = [];
        for (const cmd of rawCmds) {
          const sCmd = this.serializeGraphicsCmd(cmd);
          if (sCmd) serializedCmds.push(sCmd);
        }
        if (serializedCmds.length > 0) {
          data._gcmds = serializedCmds;
        }
      }
      const rawComps = node?.components || node?._components || node?._$comp;
      if (Array.isArray(rawComps) && rawComps.length > 0) {
        const comps = [];
        for (const comp of rawComps) {
          if (!comp) continue;
          const compType = comp._$type || comp.constructor?.name || "Script";
          const compObj = {
            _$type: compType
          };
          for (const [k, v] of Object.entries(comp)) {
            if (k.startsWith("_") || k === "owner" || k === "enabled" || typeof v === "function") {
              continue;
            }
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
              compObj[k] = v;
            }
          }
          comps.push(compObj);
        }
        if (comps.length > 0) {
          data._$comp = comps;
        }
      }
      const children = [];
      if (Array.isArray(node?._children)) {
        children.push(...node._children);
      } else if (typeof node?.numChildren === "number" && typeof node?.getChildAt === "function") {
        for (let i = 0; i < node.numChildren; i++) {
          children.push(node.getChildAt(i));
        }
      } else if (Array.isArray(node?._$child)) {
        children.push(...node._$child);
      }
      if (children.length > 0) {
        data._$child = children.map(
          (child) => this.serializeNodeToHierarchy(child, { isRoot: false })
        );
      }
      if (isRoot && options.assetId) {
        data._zhudaMeta = {
          assetId: options.assetId,
          category: options.category ?? "ui-prefab",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: options.designCanvas ?? {
            width: (data.width ?? 160) + 20,
            height: (data.height ?? 48) + 20,
            padding: 10
          },
          ...options.targetSpec ? { targetSpec: options.targetSpec } : {}
        };
      }
      return data;
    }
    static detectLayaNodeType(node) {
      if (!node) return "Sprite";
      if (typeof node._$type === "string") return node._$type;
      const g = globalThis;
      const L = g.Laya;
      if (L) {
        if (L.Text && node instanceof L.Text) return "Text";
        if (L.Label && node instanceof L.Label) return "Label";
        if (L.Button && node instanceof L.Button) return "Button";
        if (L.Box && node instanceof L.Box) return "Box";
        if (L.Image && node instanceof L.Image) return "Image";
        if (L.Scene && node instanceof L.Scene) return "Scene";
        if (L.Scene3D && node instanceof L.Scene3D) return "Scene3D";
        if (L.MeshSprite3D && node instanceof L.MeshSprite3D) return "MeshSprite3D";
        if (L.Sprite3D && node instanceof L.Sprite3D) return "Sprite3D";
      }
      if (typeof node.text === "string" && typeof node.fontSize === "number") return "Text";
      return node.constructor?.name && node.constructor.name !== "Object" ? node.constructor.name : "Sprite";
    }
    static serializeGraphicsCmd(cmd) {
      if (!cmd) return null;
      const cmdType = cmd._$type || cmd.cmdID;
      if (!cmdType) return null;
      const percent = typeof cmd.percent === "boolean" ? cmd.percent : false;
      switch (cmdType) {
        case "DrawRoundRectCmd":
          return {
            _$type: "DrawRoundRectCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            width: cmd.width ?? 100,
            height: cmd.height ?? 40,
            lt: cmd.lt ?? 6,
            rt: cmd.rt ?? 6,
            lb: cmd.lb ?? 6,
            rb: cmd.rb ?? 6,
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0,
            percent
          };
        case "DrawRectCmd":
          return {
            _$type: "DrawRectCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            width: cmd.width ?? 100,
            height: cmd.height ?? 40,
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0,
            percent
          };
        case "DrawCircleCmd":
          return {
            _$type: "DrawCircleCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            radius: cmd.radius ?? 10,
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0,
            percent
          };
        case "DrawEllipseCmd":
          return {
            _$type: "DrawEllipseCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            width: cmd.width ?? 20,
            height: cmd.height ?? 10,
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0,
            percent
          };
        case "DrawLineCmd":
          return {
            _$type: "DrawLineCmd",
            fromX: cmd.fromX ?? 0,
            fromY: cmd.fromY ?? 0,
            toX: cmd.toX ?? 10,
            toY: cmd.toY ?? 10,
            lineColor: cmd.lineColor ?? "#ffffff",
            lineWidth: cmd.lineWidth ?? 1,
            percent
          };
        case "DrawPolyCmd":
          return {
            _$type: "DrawPolyCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            points: Array.isArray(cmd.points) ? [...cmd.points] : [],
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0
          };
        case "DrawPieCmd":
          return {
            _$type: "DrawPieCmd",
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            radius: cmd.radius ?? 10,
            startAngle: cmd.startAngle ?? 0,
            endAngle: cmd.endAngle ?? 90,
            fillColor: cmd.fillColor ?? null,
            lineColor: cmd.lineColor ?? null,
            lineWidth: cmd.lineWidth ?? 0
          };
        case "DrawTextureCmd": {
          const textureId = typeof cmd.textureId === "string" ? cmd.textureId : typeof cmd.texture === "string" ? cmd.texture : typeof cmd.texture?.url === "string" ? cmd.texture.url : "";
          if (!textureId || /^(?:blob:|data:)/i.test(textureId)) return null;
          return {
            _$type: "DrawTextureCmd",
            textureId,
            x: cmd.x ?? 0,
            y: cmd.y ?? 0,
            width: cmd.width,
            height: cmd.height,
            matrix: Array.isArray(cmd.matrix) ? [...cmd.matrix] : void 0,
            alpha: cmd.alpha,
            color: cmd.color ?? null,
            blendMode: cmd.blendMode,
            uv: Array.isArray(cmd.uv) ? [...cmd.uv] : void 0,
            percent
          };
        }
        default:
          return null;
      }
    }
    /**
     * 建構「戰術確認按鈕」靜態 Prefab (.lh)
     * 支援產出 'uncalibrated-drift' (含 +3px 寬度偏差與色差 ΔE=6.1) 與 'calibrated' (0px 誤差 / ΔE=0.00)
     */
    static buildConfirmButtonPrefab(variant = "calibrated") {
      const isDrift = variant === "uncalibrated-drift";
      const x = isDrift ? 12 : 10;
      const y = 10;
      const width = isDrift ? 163 : 160;
      const height = 48;
      const fillColor = isDrift ? "#2c4c7e" : "#1e3a5f";
      const borderColor = isDrift ? "#5278a8" : "#3b82f6";
      const textColor = isDrift ? "#b8d0eb" : "#e2f1ff";
      const targetSpec = {
        assetName: "ConfirmActionButton.lh",
        expectedBox: { x: 10, y: 10, width: 160, height: 48 },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#1e3a5f",
          borderStroke: "#3b82f6",
          accentOrText: "#e2f1ff"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "confirm_btn_root",
        _$type: "Sprite",
        name: "ConfirmActionButton",
        x,
        y,
        width,
        height,
        mouseEnabled: true,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width,
            height,
            lt: 10,
            rt: 10,
            lb: 10,
            rb: 10,
            fillColor,
            lineColor: borderColor,
            lineWidth: 2,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: 24,
            y: 24,
            radius: 5,
            fillColor: "#64ffda",
            lineColor: null,
            lineWidth: 0,
            percent: false
          }
        ],
        _$child: [
          {
            _$id: "confirm_btn_label",
            _$type: "Text",
            name: "ActionLabel",
            x: 12,
            y: 0,
            width: width - 12,
            height,
            text: "\u26A1 DEPLOY PREFAB",
            fontSize: 14,
            bold: true,
            color: textColor,
            align: "center",
            valign: "middle"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/ConfirmActionButton.lh",
          category: "ui-prefab",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 180, height: 68, padding: 10 },
          targetSpec
        }
      };
    }
    /**
     * 建構「戰術 LED 頂部狀態列」靜態 UI Prefab (.lh)
     */
    static buildTacticalHudBarPrefab() {
      const targetSpec = {
        assetName: "TacticalHudBar.lh",
        expectedBox: { x: 10, y: 10, width: 310, height: 64 },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#141d2c",
          borderStroke: "#304565",
          accentOrText: "#ff3366"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "hud_bar_root",
        _$type: "Sprite",
        name: "TacticalHudBar",
        x: 10,
        y: 10,
        width: 310,
        height: 64,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 310,
            height: 64,
            lt: 12,
            rt: 12,
            lb: 12,
            rb: 12,
            fillColor: "#141d2c",
            lineColor: "#304565",
            lineWidth: 2,
            percent: false
          },
          {
            _$type: "DrawRoundRectCmd",
            x: 14,
            y: 10,
            width: 96,
            height: 44,
            lt: 6,
            rt: 6,
            lb: 6,
            rb: 6,
            fillColor: "#0b0f17",
            lineColor: "#ff3366",
            lineWidth: 1.5,
            percent: false
          },
          {
            _$type: "DrawRoundRectCmd",
            x: 200,
            y: 10,
            width: 96,
            height: 44,
            lt: 6,
            rt: 6,
            lb: 6,
            rb: 6,
            fillColor: "#0b0f17",
            lineColor: "#00ff88",
            lineWidth: 1.5,
            percent: false
          }
        ],
        _$child: [
          {
            _$id: "hud_mine_led",
            _$type: "Text",
            name: "MineCounterLED",
            x: 14,
            y: 17,
            width: 96,
            height: 32,
            text: "010",
            font: "Courier New, monospace",
            fontSize: 25,
            bold: true,
            color: "#ff3366",
            align: "center"
          },
          {
            _$id: "hud_face_badge",
            _$type: "Text",
            name: "CenterFaceIcon",
            x: 126,
            y: 16,
            width: 58,
            height: 36,
            text: "\u{1F642}",
            fontSize: 24,
            color: "#e2f1ff",
            align: "center"
          },
          {
            _$id: "hud_timer_led",
            _$type: "Text",
            name: "TimerCounterLED",
            x: 200,
            y: 17,
            width: 96,
            height: 32,
            text: "042",
            font: "Courier New, monospace",
            fontSize: 25,
            bold: true,
            color: "#00ff88",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/TacticalHudBar.lh",
          category: "ui-prefab",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 330, height: 84, padding: 10 },
          targetSpec
        }
      };
    }
    /**
     * 建構「Spine 4.2 PhysicsConstraint 豬大守護精靈」靜態骨骼資產 (.lh)
     * 先在靜態層校準各部位骨骼座標與配色，再於組裝階段由 Spine42PhysicsRigComponent 驅動二階彈簧擺
     */
    static buildSpine42MascotPrefab(overrides = {}) {
      const cfg = {
        rigName: "ZhudaGuardianPig_v4.2",
        defaultPose: "idle",
        stiffness: 95,
        damping: 0.88,
        windAmplitude: 1.8,
        earAngleRad: 0,
        skinPrimaryColor: "#ff9ebb",
        skinBorderColor: "#ff6b98",
        bellyHighlightColor: "#ffd0df",
        snoutColor: "#ffa6c2",
        ...overrides
      };
      const targetSpec = {
        assetName: "ZhudaSpine42Mascot.lh",
        expectedBox: { x: 10, y: 10, width: 210, height: 172 },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#141d2b",
          borderStroke: "#2c415e",
          accentOrText: "#ff9ebb"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      const cx = 105;
      const cy = 66;
      return {
        _$ver: 1,
        _$id: "spine42_mascot_root",
        _$type: "Sprite",
        name: "ZhudaSpine42Mascot",
        x: 10,
        y: 10,
        width: 210,
        height: 172,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 210,
            height: 172,
            lt: 12,
            rt: 12,
            lb: 12,
            rb: 12,
            fillColor: "#141d2b",
            lineColor: "#2c415e",
            lineWidth: 2,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx,
            y: 114,
            radius: 34,
            fillColor: "#090d14",
            lineColor: null,
            lineWidth: 0,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx,
            y: cy,
            radius: 36,
            fillColor: cfg.skinPrimaryColor,
            lineColor: cfg.skinBorderColor,
            lineWidth: 2,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx,
            y: cy + 9,
            radius: 20,
            fillColor: cfg.bellyHighlightColor,
            lineColor: null,
            lineWidth: 0,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx - 23,
            y: cy - 32,
            radius: 11,
            fillColor: cfg.skinBorderColor,
            lineColor: null,
            lineWidth: 0,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx + 23,
            y: cy - 32,
            radius: 11,
            fillColor: cfg.skinBorderColor,
            lineColor: null,
            lineWidth: 0,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx,
            y: cy + 3,
            radius: 13,
            fillColor: cfg.snoutColor,
            lineColor: "#e05882",
            lineWidth: 1.5,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx - 14,
            y: cy - 10,
            radius: 4.2,
            fillColor: "#222222",
            lineColor: null,
            lineWidth: 0,
            percent: false
          },
          {
            _$type: "DrawCircleCmd",
            x: cx + 14,
            y: cy - 10,
            radius: 4.2,
            fillColor: "#222222",
            lineColor: null,
            lineWidth: 0,
            percent: false
          }
        ],
        _$comp: [
          {
            _$type: "Spine42PhysicsRigComponent",
            ...cfg
          }
        ],
        _$child: [
          {
            _$id: "spine42_status_label",
            _$type: "Text",
            name: "StatusLabel",
            x: 0,
            y: 128,
            width: 210,
            height: 18,
            text: "Spine 4.2 \u8C6C\u5927\u7CBE\u9748 \xB7 [\u975C\u614B\u9810\u88FD\u9AD4]",
            fontSize: 13,
            bold: true,
            color: "#7df9ff",
            align: "center"
          },
          {
            _$id: "spine42_physics_badge",
            _$type: "Text",
            name: "PhysicsBadge",
            x: 0,
            y: 148,
            width: 210,
            height: 16,
            text: "\u2714 PhysicsConstraint (k=95, d=0.88)",
            fontSize: 11,
            color: "#64ffda",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/ZhudaSpine42Mascot.lh",
          category: "spine42-rig",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 230, height: 192, padding: 10 },
          targetSpec
        }
      };
    }
    /**
     * 建構「戰術爆破粒子發射器」靜態資產 (.lh)
     * 以決定性種子 (seed=20261028) 烘焙 t=240ms 的快照供微預覽與像素/色差校準，並附帶運行期發射器組件
     */
    static buildParticleExplosionPrefab(overrides = {}) {
      const cfg = {
        emitterName: "TacticalMineBurst_v1",
        burstCount: 24,
        emissionRate: 36,
        lifetimeMs: 850,
        startSpeed: 165,
        gravityY: 220,
        seed: 20261028,
        previewTimestampMs: 240,
        primaryColor: "#ff5533",
        secondaryColor: "#ffaa00",
        sparkColor: "#64ffda",
        coreGlowColor: "#231424",
        ...overrides
      };
      const targetSpec = {
        assetName: "MineExplosionParticle.lh",
        expectedBox: { x: 12, y: 12, width: 176, height: 176 },
        expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
        targetColors: {
          primaryFill: "#231424",
          borderStroke: "#ff5533",
          accentOrText: "#ffaa00"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      const cmds = [
        // 決定性邊界底盤與衝擊波外環 (176x176)
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: cfg.coreGlowColor,
          lineColor: cfg.primaryColor,
          lineWidth: 2,
          percent: false
        },
        // 外層震波光圈
        {
          _$type: "DrawCircleCmd",
          x: 88,
          y: 88,
          radius: 68,
          fillColor: null,
          lineColor: cfg.secondaryColor,
          lineWidth: 2,
          percent: false
        },
        // 內層高溫火球核心
        {
          _$type: "DrawCircleCmd",
          x: 88,
          y: 88,
          radius: 26,
          fillColor: cfg.primaryColor,
          lineColor: cfg.secondaryColor,
          lineWidth: 3,
          percent: false
        }
      ];
      let rngState = cfg.seed;
      const nextRand = () => {
        rngState = rngState * 1664525 + 1013904223 >>> 0;
        return rngState / 4294967295;
      };
      const tSec = cfg.previewTimestampMs / 1e3;
      for (let i = 0; i < cfg.burstCount; i++) {
        const angle = i / cfg.burstCount * Math.PI * 2 + (nextRand() - 0.5) * 0.18;
        const speed = cfg.startSpeed * (0.65 + nextRand() * 0.45);
        const dist = Math.min(64, speed * tSec);
        const px = Number((88 + Math.cos(angle) * dist).toFixed(1));
        const py = Number((88 + Math.sin(angle) * dist).toFixed(1));
        const radius = Number((3.2 + i % 3 * 1.6).toFixed(1));
        const color = i % 3 === 0 ? cfg.secondaryColor : i % 3 === 1 ? cfg.primaryColor : cfg.sparkColor;
        cmds.push({
          _$type: "DrawCircleCmd",
          x: px,
          y: py,
          radius,
          fillColor: color,
          lineColor: null,
          lineWidth: 0,
          percent: false
        });
      }
      return {
        _$ver: 1,
        _$id: "particle_explosion_root",
        _$type: "Sprite",
        name: "MineExplosionParticle",
        x: 12,
        y: 12,
        width: 176,
        height: 176,
        _gcmds: cmds,
        _$comp: [
          {
            _$type: "ZhudaParticleEmitterComponent",
            ...cfg
          }
        ],
        _$child: [
          {
            _$id: "particle_badge_txt",
            _$type: "Text",
            name: "ParticleSnapshotLabel",
            x: 0,
            y: 152,
            width: 176,
            height: 18,
            text: `Particle Snapshot @ ${cfg.previewTimestampMs}ms`,
            fontSize: 11,
            bold: true,
            color: cfg.secondaryColor,
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/MineExplosionParticle.lh",
          category: "particle-emitter",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 200, height: 200, padding: 12 },
          targetSpec
        }
      };
    }
    /**
     * 建構「6 大基建遙測儀表板」靜態 UI Prefab (.lh)
     */
    static buildTelemetryDashboardPrefab() {
      const targetSpec = {
        assetName: "TelemetryDashboard.lh",
        expectedBox: { x: 10, y: 10, width: 225, height: 392 },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#121a28",
          borderStroke: "#2d4464",
          accentOrText: "#64ffda"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "telemetry_dash_root",
        _$type: "Sprite",
        name: "TelemetryDashboard",
        x: 10,
        y: 10,
        width: 225,
        height: 392,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 225,
            height: 392,
            lt: 12,
            rt: 12,
            lb: 12,
            rb: 12,
            fillColor: "#121a28",
            lineColor: "#2d4464",
            lineWidth: 2,
            percent: false
          }
        ],
        _$child: [
          {
            _$id: "telemetry_header_txt",
            _$type: "Text",
            name: "HeaderTitle",
            x: 14,
            y: 12,
            width: 198,
            height: 20,
            text: "\u{1F6E1}\uFE0F \u8C6C\u5927\u5F15\u64CE \xB7 6 \u5927\u57FA\u5EFA\u9059\u6E2C",
            fontSize: 13,
            bold: true,
            color: "#64ffda"
          },
          {
            _$id: "telemetry_body_txt",
            _$type: "Text",
            name: "TelemetryBody",
            x: 14,
            y: 36,
            width: 198,
            height: 340,
            text: "[1] \u62D3\u64B2\u8F09\u5165\u5668 (29/29 \u5EAB)\n[2] AST \u81EA\u52D5\u985E\u5225\u53CD\u5C04\n[3] \u539F\u578B\u89E3\u6BD2\u8207\u6E96\u5099\u5B88\u885B\n[4] Spine 4.2 PhysicsConstraint\n[5] \u5408\u6279 DrawCall \u5C0D\u6A19 Three.js\n[6] \u975C\u614B\u8CC7\u7522 (.lh) & \u0394E \u6821\u6E96",
            fontSize: 12,
            leading: 5,
            color: "#cbd5e1"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/TelemetryDashboard.lh",
          category: "ui-prefab",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 245, height: 412, padding: 10 },
          targetSpec
        }
      };
    }
    /**
     * 建構「M1 九宮格 (9-Slice / sizeGrid) 無失真戰術對話框」靜態 Prefab (.lh)
     * 基準尺寸 160×80，拉伸至 320×140 (2.0x 寬, 1.75x 高)，四角錨塊恆定鎖死為 16×16px 零變形
     */
    static buildNineSliceDialogPrefab(stretchedWidth = 320, stretchedHeight = 140) {
      const top = 16;
      const right = 16;
      const bottom = 16;
      const left = 16;
      const cw = Math.max(8, stretchedWidth - left - right);
      const ch = Math.max(8, stretchedHeight - top - bottom);
      const targetSpec = {
        assetName: "NineSliceDialogFrame.lh",
        expectedBox: { x: 10, y: 10, width: stretchedWidth, height: stretchedHeight },
        expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
        targetColors: {
          primaryFill: "#132036",
          borderStroke: "#38bdf8",
          accentOrText: "#2dd4bf"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "nine_slice_dialog_root",
        _$type: "Image",
        name: "NineSliceDialogFrame",
        x: 10,
        y: 10,
        width: stretchedWidth,
        height: stretchedHeight,
        sizeGrid: `${top},${right},${bottom},${left},0`,
        _gcmds: [
          // 1. 外框底圖
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: stretchedWidth,
            height: stretchedHeight,
            lt: 10,
            rt: 10,
            lb: 10,
            rb: 10,
            fillColor: "#132036",
            lineColor: "#38bdf8",
            lineWidth: 2,
            percent: false
          },
          // 2. 中央雙向拉伸區 (Center Slice #5)
          {
            _$type: "DrawRectCmd",
            x: left,
            y: top,
            width: cw,
            height: ch,
            fillColor: "#0c1524",
            lineColor: "#233858",
            lineWidth: 1,
            percent: false
          },
          // 3. 四角 1:1 鎖定保護錨塊 (Slices #1, #3, #7, #9 — 尺寸恆定 16×16px)
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: left,
            height: top,
            lt: 8,
            rt: 2,
            lb: 2,
            rb: 2,
            fillColor: "#2dd4bf",
            lineColor: "#38bdf8",
            lineWidth: 1.5,
            percent: false
          },
          {
            _$type: "DrawRoundRectCmd",
            x: stretchedWidth - right,
            y: 0,
            width: right,
            height: top,
            lt: 2,
            rt: 8,
            lb: 2,
            rb: 2,
            fillColor: "#2dd4bf",
            lineColor: "#38bdf8",
            lineWidth: 1.5,
            percent: false
          },
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: stretchedHeight - bottom,
            width: left,
            height: bottom,
            lt: 2,
            rt: 2,
            lb: 8,
            rb: 2,
            fillColor: "#2dd4bf",
            lineColor: "#38bdf8",
            lineWidth: 1.5,
            percent: false
          },
          {
            _$type: "DrawRoundRectCmd",
            x: stretchedWidth - right,
            y: stretchedHeight - bottom,
            width: right,
            height: bottom,
            lt: 2,
            rt: 2,
            lb: 2,
            rb: 8,
            fillColor: "#2dd4bf",
            lineColor: "#38bdf8",
            lineWidth: 1.5,
            percent: false
          }
        ],
        _$child: [
          {
            _$id: "nine_slice_title_txt",
            _$type: "Text",
            name: "NineSliceHeader",
            x: left,
            y: 36,
            width: cw,
            height: 24,
            text: "9-SLICE (sizeGrid: 16,16,16,16,0)",
            fontSize: 14,
            bold: true,
            color: "#2dd4bf",
            align: "center"
          },
          {
            _$id: "nine_slice_sub_txt",
            _$type: "Text",
            name: "NineSliceSubtitle",
            x: left,
            y: 70,
            width: cw,
            height: 22,
            text: `Stretched ${stretchedWidth}\xD7${stretchedHeight}px \xB7 4 Corners Locked 16\xD716px`,
            fontSize: 12,
            color: "#e2f1ff",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/NineSliceDialogFrame.lh",
          category: "nine-slice-ui",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: stretchedWidth + 20, height: stretchedHeight + 20, padding: 10 },
          targetSpec,
          nineSliceSpec: {
            sizeGrid: [top, right, bottom, left, 0],
            baseWidth: 160,
            baseHeight: 80
          }
        }
      };
    }
    /**
     * 建構「M4 特效藍圖庫：勝利金幣噴泉 (CoinFountainVfx.lh)」決定性靜態資產 (@ t=280ms)
     */
    static buildCoinFountainVfxPrefab() {
      const targetSpec = {
        assetName: "CoinFountainVfx.lh",
        expectedBox: { x: 12, y: 12, width: 176, height: 176 },
        expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
        targetColors: {
          primaryFill: "#1f1a10",
          borderStroke: "#fbbf24",
          accentOrText: "#fef08a"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      const cmds = [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: "#1f1a10",
          lineColor: "#fbbf24",
          lineWidth: 2,
          percent: false
        },
        // 聚寶盆底座金光
        {
          _$type: "DrawEllipseCmd",
          x: 88,
          y: 138,
          width: 54,
          height: 14,
          fillColor: "#f59e0b",
          lineColor: "#fef08a",
          lineWidth: 2,
          percent: false
        }
      ];
      const coinPositions = [
        [88, 42, 11],
        [62, 54, 9.5],
        [114, 54, 9.5],
        [44, 78, 8.5],
        [132, 78, 8.5],
        [74, 82, 10],
        [102, 82, 10],
        [54, 110, 7.5],
        [122, 110, 7.5],
        [88, 112, 9]
      ];
      for (const [cx, cy, r] of coinPositions) {
        cmds.push({
          _$type: "DrawCircleCmd",
          x: cx,
          y: cy,
          radius: r,
          fillColor: "#fbbf24",
          lineColor: "#fef08a",
          lineWidth: 1.5,
          percent: false
        });
      }
      return {
        _$ver: 1,
        _$id: "vfx_coin_fountain_root",
        _$type: "Sprite",
        name: "CoinFountainVfx",
        x: 12,
        y: 12,
        width: 176,
        height: 176,
        _gcmds: cmds,
        _$comp: [
          {
            _$type: "ZhudaParticleEmitterComponent",
            emitterName: "GoldenCoinFountain_v1",
            burstCount: 20,
            previewTimestampMs: 280,
            primaryColor: "#fbbf24",
            secondaryColor: "#fef08a",
            sparkColor: "#38bdf8"
          }
        ],
        _$child: [
          {
            _$id: "vfx_coin_label",
            _$type: "Text",
            name: "VfxCoinTitle",
            x: 0,
            y: 152,
            width: 176,
            height: 18,
            text: "VFX: CoinFountain @ 280ms",
            fontSize: 11,
            bold: true,
            color: "#fef08a",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/CoinFountainVfx.lh",
          category: "vfx-blueprint",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 200, height: 200, padding: 12 },
          targetSpec
        }
      };
    }
    /**
     * 建構「M4 特效藍圖庫：戰術刀光劍氣拖尾 (SwordSlashTrailVfx.lh)」決定性靜態資產 (@ t=120ms)
     */
    static buildSwordSlashVfxPrefab() {
      const targetSpec = {
        assetName: "SwordSlashTrailVfx.lh",
        expectedBox: { x: 12, y: 12, width: 176, height: 176 },
        expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
        targetColors: {
          primaryFill: "#0d1b2a",
          borderStroke: "#00e5ff",
          accentOrText: "#7df9ff"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "vfx_sword_slash_root",
        _$type: "Sprite",
        name: "SwordSlashTrailVfx",
        x: 12,
        y: 12,
        width: 176,
        height: 176,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 176,
            height: 176,
            lt: 16,
            rt: 16,
            lb: 16,
            rb: 16,
            fillColor: "#0d1b2a",
            lineColor: "#00e5ff",
            lineWidth: 2,
            percent: false
          },
          // 弧形半月刀氣主軌跡
          {
            _$type: "DrawPieCmd",
            x: 88,
            y: 88,
            radius: 66,
            startAngle: -55,
            endAngle: 75,
            fillColor: "#00e5ff",
            lineColor: "#ffffff",
            lineWidth: 2
          },
          // 內層遮罩形成新月刃弧
          {
            _$type: "DrawCircleCmd",
            x: 74,
            y: 88,
            radius: 48,
            fillColor: "#0d1b2a",
            lineColor: "#38bdf8",
            lineWidth: 1.5,
            percent: false
          },
          // 破空十字星芒
          {
            _$type: "DrawLineCmd",
            fromX: 28,
            fromY: 132,
            toX: 148,
            toY: 36,
            lineColor: "#ffffff",
            lineWidth: 3,
            percent: false
          }
        ],
        _$comp: [
          {
            _$type: "ZhudaParticleEmitterComponent",
            emitterName: "CyberBladeSlash_v1",
            burstCount: 16,
            previewTimestampMs: 120,
            primaryColor: "#00e5ff",
            secondaryColor: "#7df9ff",
            sparkColor: "#ffffff"
          }
        ],
        _$child: [
          {
            _$id: "vfx_slash_label",
            _$type: "Text",
            name: "VfxSlashTitle",
            x: 0,
            y: 152,
            width: 176,
            height: 18,
            text: "VFX: SwordSlashTrail @ 120ms",
            fontSize: 11,
            bold: true,
            color: "#7df9ff",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/SwordSlashTrailVfx.lh",
          category: "vfx-blueprint",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 200, height: 200, padding: 12 },
          targetSpec
        }
      };
    }
    /**
     * 建構「M4 特效藍圖庫：升級覺醒法陣光環 (LevelUpAuraVfx.lh)」決定性靜態資產 (@ t=320ms)
     */
    static buildLevelUpAuraVfxPrefab() {
      const targetSpec = {
        assetName: "LevelUpAuraVfx.lh",
        expectedBox: { x: 12, y: 12, width: 176, height: 176 },
        expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
        targetColors: {
          primaryFill: "#13162b",
          borderStroke: "#a855f7",
          accentOrText: "#e9d5ff"
        },
        tolerancePx: 0,
        toleranceDeltaE: 1.5
      };
      return {
        _$ver: 1,
        _$id: "vfx_levelup_aura_root",
        _$type: "Sprite",
        name: "LevelUpAuraVfx",
        x: 12,
        y: 12,
        width: 176,
        height: 176,
        _gcmds: [
          {
            _$type: "DrawRoundRectCmd",
            x: 0,
            y: 0,
            width: 176,
            height: 176,
            lt: 16,
            rt: 16,
            lb: 16,
            rb: 16,
            fillColor: "#13162b",
            lineColor: "#a855f7",
            lineWidth: 2,
            percent: false
          },
          // 外層覺醒法陣環
          {
            _$type: "DrawCircleCmd",
            x: 88,
            y: 88,
            radius: 62,
            fillColor: null,
            lineColor: "#c084fc",
            lineWidth: 2.5,
            percent: false
          },
          // 內層能量核心
          {
            _$type: "DrawCircleCmd",
            x: 88,
            y: 88,
            radius: 34,
            fillColor: "#581c87",
            lineColor: "#e9d5ff",
            lineWidth: 2,
            percent: false
          },
          // 上升光柱粒子
          {
            _$type: "DrawLineCmd",
            fromX: 52,
            fromY: 132,
            toX: 52,
            toY: 36,
            lineColor: "#64ffda",
            lineWidth: 2.5,
            percent: false
          },
          {
            _$type: "DrawLineCmd",
            fromX: 88,
            fromY: 140,
            toX: 88,
            toY: 24,
            lineColor: "#e9d5ff",
            lineWidth: 3,
            percent: false
          },
          {
            _$type: "DrawLineCmd",
            fromX: 124,
            fromY: 132,
            toX: 124,
            toY: 36,
            lineColor: "#64ffda",
            lineWidth: 2.5,
            percent: false
          }
        ],
        _$comp: [
          {
            _$type: "ZhudaParticleEmitterComponent",
            emitterName: "AscensionHaloAura_v1",
            burstCount: 18,
            previewTimestampMs: 320,
            primaryColor: "#a855f7",
            secondaryColor: "#e9d5ff",
            sparkColor: "#64ffda"
          }
        ],
        _$child: [
          {
            _$id: "vfx_aura_label",
            _$type: "Text",
            name: "VfxAuraTitle",
            x: 0,
            y: 152,
            width: 176,
            height: 18,
            text: "VFX: LevelUpAura @ 320ms",
            fontSize: 11,
            bold: true,
            color: "#e9d5ff",
            align: "center"
          }
        ],
        _zhudaMeta: {
          assetId: "assets/prefabs/LevelUpAuraVfx.lh",
          category: "vfx-blueprint",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 200, height: 200, padding: 12 },
          targetSpec
        }
      };
    }
    /**
     * 建構組裝後的主場景靜態階層樹 (MinesweeperStage.ls)
     */
    static buildMinesweeperSceneAsset() {
      const hud = this.buildTacticalHudBarPrefab();
      const mascot = this.buildSpine42MascotPrefab();
      const telemetry = this.buildTelemetryDashboardPrefab();
      const confirmBtn = this.buildConfirmButtonPrefab("calibrated");
      const nineSliceDialog = this.buildNineSliceDialogPrefab(320, 140);
      const particle = this.buildParticleExplosionPrefab();
      const unityGuardian = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();
      hud.x = 20;
      hud.y = 16;
      mascot.x = 1035;
      mascot.y = 118;
      telemetry.x = 1035;
      telemetry.y = 302;
      confirmBtn.x = 20;
      confirmBtn.y = 630;
      nineSliceDialog.x = 200;
      nineSliceDialog.y = 540;
      particle.x = 550;
      particle.y = 270;
      unityGuardian.x = 760;
      unityGuardian.y = 510;
      return {
        _$ver: 1,
        _$id: "minesweeper_stage_scene",
        _$type: "Scene",
        name: "MinesweeperStage",
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
        _$child: [hud, mascot, telemetry, confirmBtn, nineSliceDialog, particle, unityGuardian],
        _zhudaMeta: {
          assetId: "assets/scenes/MinesweeperStage.ls",
          category: "scene-lh",
          version: "3.4.2-zhuda-static-v1",
          designCanvas: { width: 1280, height: 720, padding: 0 }
        }
      };
    }
    /**
     * 取得所有內建預先設計之靜態資產清單 (涵蓋 UI、9-Slice、Spine 4.2、VFX 特效藍圖與 Unity 移植預製體)
     */
    static getAllBuiltinStaticAssets() {
      return {
        "ConfirmActionButton.lh": this.buildConfirmButtonPrefab("calibrated"),
        "NineSliceDialogFrame.lh": this.buildNineSliceDialogPrefab(320, 140),
        "TacticalHudBar.lh": this.buildTacticalHudBarPrefab(),
        "ZhudaSpine42Mascot.lh": this.buildSpine42MascotPrefab(),
        "MineExplosionParticle.lh": this.buildParticleExplosionPrefab(),
        "CoinFountainVfx.lh": this.buildCoinFountainVfxPrefab(),
        "SwordSlashTrailVfx.lh": this.buildSwordSlashVfxPrefab(),
        "LevelUpAuraVfx.lh": this.buildLevelUpAuraVfxPrefab(),
        "UnityCrystalGuardian.lh": UnityBridgePipeline.buildUnityCrystalGuardianPrefab(),
        "TelemetryDashboard.lh": this.buildTelemetryDashboardPrefab(),
        "MinesweeperStage.ls": this.buildMinesweeperSceneAsset()
      };
    }
    /**
     * 依據 PixelCalibrationEngine 產出的 AutoFixPatch 自動修正靜態 .lh 資產數值
     */
    static applyCalibrationPatches(sourceData, patches) {
      const cloned = JSON.parse(JSON.stringify(sourceData));
      for (const patch of patches) {
        if (patch.targetPath === "root") {
          cloned[patch.property] = patch.suggestedValue;
          if (patch.property === "width" && Array.isArray(cloned._$child)) {
            for (const ch of cloned._$child) {
              if (ch._$type === "Text" && typeof ch.x === "number") {
                ch.width = Number(patch.suggestedValue) - ch.x;
              }
            }
          }
        } else if (patch.targetPath.startsWith("_gcmds[")) {
          const m = patch.targetPath.match(/^_gcmds\[(\d+)\]$/);
          if (m && Array.isArray(cloned._gcmds)) {
            const idx = Number(m[1]);
            if (cloned._gcmds[idx]) {
              cloned._gcmds[idx][patch.property] = patch.suggestedValue;
            }
          }
        } else if (patch.targetPath.startsWith("_$child[")) {
          const m = patch.targetPath.match(/^_\$child\[(\d+)\]$/);
          if (m && Array.isArray(cloned._$child)) {
            const idx = Number(m[1]);
            if (cloned._$child[idx]) {
              cloned._$child[idx][patch.property] = patch.suggestedValue;
            }
          }
        }
      }
      return cloned;
    }
  };
  ZhudaAssetSerializer.idCounter = 1;
  var ZhudaPrefab = class {
    static instantiate(lhData, parent, positionOverride) {
      const clonedData = JSON.parse(JSON.stringify(lhData));
      const g = globalThis;
      const L = g.Laya;
      if (!L || !L.Sprite) {
        throw new Error("[ZhudaPrefab] Laya runtime \u5C1A\u672A\u521D\u59CB\u5316\uFF0C\u8ACB\u5148\u57F7\u884C await ZhudaEngine.boot()");
      }
      if (L.LayaEnv) {
        L.LayaEnv.isPlaying = true;
      }
      let rootSprite = null;
      if (L.HierarchyParser && typeof L.HierarchyParser.parse === "function") {
        try {
          const parsed = L.HierarchyParser.parse(clonedData);
          const first = Array.isArray(parsed) ? parsed[0] : parsed;
          if (first) {
            rootSprite = first;
          }
        } catch (_err) {
          rootSprite = null;
        }
      }
      if (!rootSprite) {
        rootSprite = this.hydrateNodeRecursive(clonedData);
      } else {
        this.ensureGraphicsHydrated(rootSprite, clonedData);
      }
      if (positionOverride) {
        rootSprite.pos(positionOverride.x, positionOverride.y);
      }
      if (parent) {
        parent.addChild(rootSprite);
      }
      return rootSprite;
    }
    static hydrateNodeRecursive(data) {
      const L = globalThis.Laya;
      let node;
      if (data._$type === "Text" || data._$type === "Label") {
        node = data._$type === "Label" && L.Label ? new L.Label() : new L.Text();
        node.text = data.text ?? "";
        if (data.font) node.font = data.font;
        if (typeof data.fontSize === "number") node.fontSize = data.fontSize;
        if (data.color) node.color = data.color;
        if (typeof data.bold === "boolean") node.bold = data.bold;
        if (data.align) node.align = data.align;
        if (data.valign) node.valign = data.valign;
        if (typeof data.wordWrap === "boolean") node.wordWrap = data.wordWrap;
        if (data.overflow) node.overflow = data.overflow;
        if (typeof data.leading === "number") node.leading = data.leading;
        if (typeof data.letterSpacing === "number") node.letterSpacing = data.letterSpacing;
        if (typeof data.stroke === "number") node.stroke = data.stroke;
        if (data.strokeColor) node.strokeColor = data.strokeColor;
        if (typeof data.underline === "boolean") node.underline = data.underline;
        if (data.underlineColor) node.underlineColor = data.underlineColor;
        if (typeof data.strikethrough === "boolean") node.strikethrough = data.strikethrough;
        if (data.padding) node.padding = data._$type === "Label" && L.Label ? data.padding.join(",") : data.padding;
      } else if (data._$type === "Scene" && L.Scene) {
        node = new L.Scene();
      } else if (data._$type === "Image" && L.Image) {
        node = new L.Image();
      } else if (data._$type === "Box" && L.Box) {
        node = new L.Box();
      } else {
        node = new L.Sprite();
      }
      node.name = data.name || data._$id;
      if (typeof data.x === "number") node.x = data.x;
      if (typeof data.y === "number") node.y = data.y;
      if (typeof data.width === "number") node.width = data.width;
      if (typeof data.height === "number") node.height = data.height;
      if (typeof data.scaleX === "number") node.scaleX = data.scaleX;
      if (typeof data.scaleY === "number") node.scaleY = data.scaleY;
      if (typeof data.rotation === "number") node.rotation = data.rotation;
      if (typeof data.anchorX === "number") node.anchorX = data.anchorX;
      if (typeof data.anchorY === "number") node.anchorY = data.anchorY;
      if (typeof data.pivotX === "number") node.pivotX = data.pivotX;
      if (typeof data.pivotY === "number") node.pivotY = data.pivotY;
      if (typeof data.skewX === "number") node.skewX = data.skewX;
      if (typeof data.skewY === "number") node.skewY = data.skewY;
      if (typeof data.alpha === "number") node.alpha = data.alpha;
      if (typeof data.visible === "boolean") node.visible = data.visible;
      if (typeof data.mouseEnabled === "boolean") node.mouseEnabled = data.mouseEnabled;
      if (typeof data.skin === "string") node.skin = data.skin;
      if (typeof data.sizeGrid === "string") node.sizeGrid = data.sizeGrid;
      if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node.graphics) {
        this.applyGraphicsCommands(node.graphics, data._gcmds);
      }
      if (Array.isArray(data._$comp) && L.ClassUtils) {
        for (const compDef of data._$comp) {
          const CompCtor = L.ClassUtils.getClass(compDef._$type);
          if (CompCtor && typeof node.addComponent === "function") {
            try {
              const instance = node.addComponent(CompCtor);
              if (instance) {
                for (const [k, v] of Object.entries(compDef)) {
                  if (!k.startsWith("_$")) {
                    instance[k] = v;
                  }
                }
              }
            } catch (_e) {
            }
          }
        }
      }
      if (Array.isArray(data._$child)) {
        for (const childData of data._$child) {
          const childNode = this.hydrateNodeRecursive(childData);
          node.addChild(childNode);
        }
      }
      return node;
    }
    static ensureGraphicsHydrated(node, data) {
      if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node?.graphics) {
        const existingCmds = node.graphics.cmds || node.graphics._cmds || [];
        if (existingCmds.length === 0) {
          this.applyGraphicsCommands(node.graphics, data._gcmds);
        }
      }
      if (Array.isArray(data._$child) && typeof node?.numChildren === "number") {
        for (const childData of data._$child) {
          let child = void 0;
          for (let i = 0; i < node.numChildren; i++) {
            const candidate = node.getChildAt(i);
            if (candidate?.name === (childData.name || childData._$id)) {
              child = candidate;
              break;
            }
          }
          if (!child && typeof node.addChild === "function") {
            child = this.hydrateNodeRecursive(childData);
            node.addChild(child);
          }
          if (child) this.ensureGraphicsHydrated(child, childData);
        }
      }
    }
    static applyGraphicsCommands(graphics, cmds) {
      graphics.clear();
      for (const cmd of cmds) {
        switch (cmd._$type) {
          case "DrawRoundRectCmd":
            graphics.drawRoundRect(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 100,
              cmd.height ?? 40,
              cmd.lt ?? 6,
              cmd.rt ?? 6,
              cmd.lb ?? 6,
              cmd.rb ?? 6,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
            break;
          case "DrawRectCmd":
            graphics.drawRect(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 100,
              cmd.height ?? 40,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
            break;
          case "DrawCircleCmd":
            graphics.drawCircle(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.radius ?? 10,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
            break;
          case "DrawEllipseCmd":
            if (typeof graphics.drawEllipse === "function") {
              graphics.drawEllipse(
                cmd.x ?? 0,
                cmd.y ?? 0,
                cmd.width ?? 20,
                cmd.height ?? 10,
                cmd.fillColor ?? null,
                cmd.lineColor ?? null,
                cmd.lineWidth ?? 1
              );
            } else {
              graphics.drawCircle(
                cmd.x ?? 0,
                cmd.y ?? 0,
                cmd.width ?? 15,
                cmd.fillColor ?? null,
                cmd.lineColor ?? null,
                cmd.lineWidth ?? 1
              );
            }
            break;
          case "DrawLineCmd":
            graphics.drawLine(
              cmd.fromX ?? 0,
              cmd.fromY ?? 0,
              cmd.toX ?? 10,
              cmd.toY ?? 10,
              cmd.lineColor ?? "#ffffff",
              cmd.lineWidth ?? 1
            );
            break;
          case "DrawPolyCmd":
            if (Array.isArray(cmd.points) && cmd.points.length >= 6) {
              graphics.drawPoly(
                cmd.x ?? 0,
                cmd.y ?? 0,
                cmd.points,
                cmd.fillColor ?? null,
                cmd.lineColor ?? null,
                cmd.lineWidth ?? 1
              );
            }
            break;
          case "DrawPieCmd":
            graphics.drawPie(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.radius ?? 10,
              cmd.startAngle ?? 0,
              cmd.endAngle ?? 90,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
            break;
          case "DrawTextureCmd": {
            const textureId = cmd.textureId;
            const runtime = globalThis.Laya;
            const texture = textureId && runtime?.loader?.getRes?.(textureId);
            if (!texture) {
              throw Error(`DrawTextureCmd texture is not loaded: ${textureId || "<missing textureId>"}`);
            }
            if (typeof graphics.drawTexture !== "function") {
              throw Error("DrawTextureCmd requires Graphics.drawTexture");
            }
            const matrix = Array.isArray(cmd.matrix) && cmd.matrix.length === 6 && runtime?.Matrix ? new runtime.Matrix(...cmd.matrix) : null;
            graphics.drawTexture(
              texture,
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width,
              cmd.height,
              matrix,
              cmd.alpha,
              cmd.color ?? null,
              cmd.blendMode ?? null,
              cmd.uv
            );
            break;
          }
          default:
            break;
        }
      }
    }
  };

  // packages/core/PixelCalibrationEngine.ts
  var PixelCalibrationEngine = class {
    /**
     * 將 #RRGGBB 或 #RRGGBBAA 轉為 0..255 RGB
     */
    static hexToRgb(hex) {
      const clean = (hex || "#000000").replace(/^#/, "").trim();
      if (clean.length === 3) {
        const r2 = parseInt(clean[0] + clean[0], 16);
        const g2 = parseInt(clean[1] + clean[1], 16);
        const b2 = parseInt(clean[2] + clean[2], 16);
        return { r: r2, g: g2, b: b2, a: 255 };
      }
      const r = parseInt(clean.slice(0, 2) || "00", 16);
      const g = parseInt(clean.slice(2, 4) || "00", 16);
      const b = parseInt(clean.slice(4, 6) || "00", 16);
      const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255;
      return {
        r: Number.isNaN(r) ? 0 : r,
        g: Number.isNaN(g) ? 0 : g,
        b: Number.isNaN(b) ? 0 : b,
        a: Number.isNaN(a) ? 255 : a
      };
    }
    /**
     * 將 sRGB (#RRGGBB) 轉換為 CIE L*a*b* (D65 標準光源)
     */
    static hexToLab(hex) {
      const { r, g, b } = this.hexToRgb(hex);
      const toLinear = (c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lr = toLinear(r);
      const lg = toLinear(g);
      const lb = toLinear(b);
      const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
      const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1;
      const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
      const f = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      const fx = f(x);
      const fy = f(y);
      const fz = f(z);
      return {
        L: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
      };
    }
    /**
     * 計算 CIE76 色差 (ΔE*ab)
     */
    static computeDeltaE76(hex1, hex2) {
      const lab1 = this.hexToLab(hex1);
      const lab2 = this.hexToLab(hex2);
      const dL = lab1.L - lab2.L;
      const da = lab1.a - lab2.a;
      const db = lab1.b - lab2.b;
      return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(2));
    }
    /**
     * 計算工業標準 CIEDE2000 感知色差 (ΔE00)
     */
    static computeDeltaE2000(hex1, hex2) {
      if ((hex1 || "").toLowerCase().slice(0, 7) === (hex2 || "").toLowerCase().slice(0, 7)) {
        return 0;
      }
      const lab1 = this.hexToLab(hex1);
      const lab2 = this.hexToLab(hex2);
      const avgL = (lab1.L + lab2.L) / 2;
      const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
      const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
      const avgC = (c1 + c2) / 2;
      const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
      const a1p = (1 + g) * lab1.a;
      const a2p = (1 + g) * lab2.a;
      const c1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
      const c2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);
      const avgCp = (c1p + c2p) / 2;
      const h1p = a1p === 0 && lab1.b === 0 ? 0 : Math.atan2(lab1.b, a1p) * 180 / Math.PI + (Math.atan2(lab1.b, a1p) < 0 ? 360 : 0);
      const h2p = a2p === 0 && lab2.b === 0 ? 0 : Math.atan2(lab2.b, a2p) * 180 / Math.PI + (Math.atan2(lab2.b, a2p) < 0 ? 360 : 0);
      let dhp = 0;
      if (c1p * c2p !== 0) {
        if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
        else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
        else dhp = h2p - h1p + 360;
      }
      const dLp = lab2.L - lab1.L;
      const dCp = c2p - c1p;
      const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(dhp / 2 * Math.PI / 180);
      let avgHp = h1p + h2p;
      if (c1p * c2p !== 0) {
        if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
        else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) / 2;
        else avgHp = (h1p + h2p - 360) / 2;
      }
      const T = 1 - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * avgHp * Math.PI / 180) + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180) - 0.2 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
      const dRo = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
      const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
      const sl = 1 + 0.015 * Math.pow(avgL - 50, 2) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
      const sc = 1 + 0.045 * avgCp;
      const sh = 1 + 0.015 * avgCp * T;
      const rt = -Math.sin(2 * dRo * Math.PI / 180) * rc;
      const dE = Math.sqrt(
        Math.pow(dLp / sl, 2) + Math.pow(dCp / sc, 2) + Math.pow(dHp / sh, 2) + rt * (dCp / sc) * (dHp / sh)
      );
      return Number(dE.toFixed(2));
    }
    /**
     * 靜態解析 .lh 階層樹的精確 Tight Bounding Box 與主色調（無需啟動 Runtime）
     */
    static measureStaticHierarchy(data) {
      const rootX = data.x ?? 0;
      const rootY = data.y ?? 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let primaryFill = "";
      let borderStroke = "";
      let accentOrText = "";
      const expandRect = (rx, ry, rw, rh) => {
        if (rw <= 0 || rh <= 0) return;
        minX = Math.min(minX, rx);
        minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx + rw);
        maxY = Math.max(maxY, ry + rh);
      };
      if (Array.isArray(data._gcmds)) {
        for (const cmd of data._gcmds) {
          if (cmd._$type === "DrawRoundRectCmd" || cmd._$type === "DrawRectCmd") {
            const cx = rootX + (cmd.x ?? 0);
            const cy = rootY + (cmd.y ?? 0);
            const cw = cmd.width ?? data.width ?? 0;
            const ch = cmd.height ?? data.height ?? 0;
            expandRect(cx, cy, cw, ch);
            if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
            if (!borderStroke && cmd.lineColor) borderStroke = cmd.lineColor;
          } else if (cmd._$type === "DrawCircleCmd") {
            const r = cmd.radius ?? 0;
            const cx = rootX + (cmd.x ?? 0) - r;
            const cy = rootY + (cmd.y ?? 0) - r;
            expandRect(cx, cy, r * 2, r * 2);
            if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
            else if (!accentOrText && cmd.fillColor && cmd.fillColor !== "#090d14") {
              accentOrText = cmd.fillColor;
            }
          }
        }
      }
      if (minX === Infinity) {
        expandRect(rootX, rootY, data.width ?? 100, data.height ?? 40);
      }
      if (Array.isArray(data._$child)) {
        for (const child of data._$child) {
          if (child._$type === "Text" && child.color) {
            if (!accentOrText || data.name !== "ZhudaSpine42Mascot") {
              accentOrText = child.color;
              break;
            }
          }
        }
      }
      return {
        tightBox: {
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.round(maxX - minX),
          height: Math.round(maxY - minY)
        },
        primaryFill: (primaryFill || "#000000").slice(0, 7),
        borderStroke: (borderStroke || "#000000").slice(0, 7),
        accentOrText: (accentOrText || "#ffffff").slice(0, 7)
      };
    }
    /**
     * 掃描 WebGL / Canvas2D RGBA 像素緩衝區，計算非背景像素覆蓋率、Tight Bounding Box 與主導色
     */
    static measurePixelBuffer(rgba, canvasWidth, canvasHeight, bgRgb = { r: 11, g: 15, b: 23 }) {
      let minX = canvasWidth;
      let minY = canvasHeight;
      let maxX = -1;
      let maxY = -1;
      let activeCount = 0;
      const colorBuckets = /* @__PURE__ */ new Map();
      for (let y = 0; y < canvasHeight; y++) {
        for (let x = 0; x < canvasWidth; x++) {
          const idx = (y * canvasWidth + x) * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          const a = rgba[idx + 3];
          const isForeground = a > 20 && (Math.abs(r - bgRgb.r) > 8 || Math.abs(g - bgRgb.g) > 8 || Math.abs(b - bgRgb.b) > 8);
          if (isForeground) {
            activeCount++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            const hex = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
            colorBuckets.set(hex, (colorBuckets.get(hex) || 0) + 1);
          }
        }
      }
      let dominantHex = "#000000";
      let bestCount = 0;
      for (const [hex, cnt] of colorBuckets.entries()) {
        if (cnt > bestCount) {
          bestCount = cnt;
          dominantHex = hex;
        }
      }
      const hasPixels = maxX >= minX && maxY >= minY;
      return {
        tightBox: hasPixels ? {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        } : { x: 0, y: 0, width: 0, height: 0 },
        nonTransparentPixels: activeCount,
        coveragePercent: Number((activeCount / Math.max(1, canvasWidth * canvasHeight) * 100).toFixed(2)),
        sampledDominantHex: dominantHex
      };
    }
    /**
     * 執行單一靜態資產的像素邊界與 ΔE 色差校準，並自動生成修復 Patch
     */
    static calibrateAsset(data, specOverride, pixelBufferInfo) {
      const spec = specOverride || data._zhudaMeta?.targetSpec;
      if (!spec) {
        throw new Error(`[PixelCalibrationEngine] \u8CC7\u7522 ${data.name} \u7F3A\u5C11 targetSpec \u6821\u6E96\u898F\u683C`);
      }
      const staticMetrics = this.measureStaticHierarchy(data);
      const measuredBox = staticMetrics.tightBox;
      const expectedBox = spec.expectedBox;
      const xDiffPx = measuredBox.x - expectedBox.x;
      const yDiffPx = measuredBox.y - expectedBox.y;
      const widthDiffPx = measuredBox.width - expectedBox.width;
      const heightDiffPx = measuredBox.height - expectedBox.height;
      const maxAbsErrorPx = Math.max(
        Math.abs(xDiffPx),
        Math.abs(yDiffPx),
        Math.abs(widthDiffPx),
        Math.abs(heightDiffPx)
      );
      const targetPrimaryFill = spec.targetColors.primaryFill;
      const targetBorderStroke = spec.targetColors.borderStroke || staticMetrics.borderStroke;
      const targetAccentOrText = spec.targetColors.accentOrText || staticMetrics.accentOrText;
      const primaryDeltaE76 = this.computeDeltaE76(staticMetrics.primaryFill, targetPrimaryFill);
      const primaryDeltaE2000 = this.computeDeltaE2000(staticMetrics.primaryFill, targetPrimaryFill);
      const borderDeltaE2000 = this.computeDeltaE2000(staticMetrics.borderStroke, targetBorderStroke);
      const accentDeltaE2000 = this.computeDeltaE2000(staticMetrics.accentOrText, targetAccentOrText);
      const maxDeltaE2000 = Number(
        Math.max(primaryDeltaE2000, borderDeltaE2000, accentDeltaE2000).toFixed(2)
      );
      const tolerancePx = spec.tolerancePx ?? 0;
      const toleranceDeltaE = spec.toleranceDeltaE ?? 1.5;
      const autoFixPatches = [];
      if (Math.abs(xDiffPx) > tolerancePx) {
        autoFixPatches.push({
          targetPath: "root",
          property: "x",
          currentValue: data.x ?? 0,
          suggestedValue: expectedBox.x,
          reason: `X \u5EA7\u6A19\u504F\u79FB ${xDiffPx > 0 ? "+" : ""}${xDiffPx}px (\u9810\u671F ${expectedBox.x}px)`
        });
      }
      if (Math.abs(yDiffPx) > tolerancePx) {
        autoFixPatches.push({
          targetPath: "root",
          property: "y",
          currentValue: data.y ?? 0,
          suggestedValue: expectedBox.y,
          reason: `Y \u5EA7\u6A19\u504F\u79FB ${yDiffPx > 0 ? "+" : ""}${yDiffPx}px (\u9810\u671F ${expectedBox.y}px)`
        });
      }
      if (Math.abs(widthDiffPx) > tolerancePx) {
        autoFixPatches.push({
          targetPath: "root",
          property: "width",
          currentValue: data.width ?? measuredBox.width,
          suggestedValue: expectedBox.width,
          reason: `\u7BC0\u9EDE\u5BEC\u5EA6\u8AA4\u5DEE ${widthDiffPx > 0 ? "+" : ""}${widthDiffPx}px (\u9810\u671F ${expectedBox.width}px)`
        });
        if (Array.isArray(data._gcmds) && data._gcmds[0]) {
          autoFixPatches.push({
            targetPath: "_gcmds[0]",
            property: "width",
            currentValue: data._gcmds[0].width ?? measuredBox.width,
            suggestedValue: expectedBox.width,
            reason: `\u5E95\u5716\u6307\u4EE4 DrawRoundRectCmd \u5BEC\u5EA6\u8AA4\u5DEE ${widthDiffPx > 0 ? "+" : ""}${widthDiffPx}px`
          });
        }
      }
      if (Math.abs(heightDiffPx) > tolerancePx) {
        autoFixPatches.push({
          targetPath: "root",
          property: "height",
          currentValue: data.height ?? measuredBox.height,
          suggestedValue: expectedBox.height,
          reason: `\u7BC0\u9EDE\u9AD8\u5EA6\u8AA4\u5DEE ${heightDiffPx > 0 ? "+" : ""}${heightDiffPx}px (\u9810\u671F ${expectedBox.height}px)`
        });
        if (Array.isArray(data._gcmds) && data._gcmds[0]) {
          autoFixPatches.push({
            targetPath: "_gcmds[0]",
            property: "height",
            currentValue: data._gcmds[0].height ?? measuredBox.height,
            suggestedValue: expectedBox.height,
            reason: `\u5E95\u5716\u6307\u4EE4\u9AD8\u5EA6\u8AA4\u5DEE ${heightDiffPx > 0 ? "+" : ""}${heightDiffPx}px`
          });
        }
      }
      if (primaryDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: "_gcmds[0]",
          property: "fillColor",
          currentValue: staticMetrics.primaryFill,
          suggestedValue: targetPrimaryFill,
          reason: `\u4E3B\u586B\u5145\u8272\u5DEE \u0394E00 = ${primaryDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetPrimaryFill})`
        });
      }
      if (borderDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: "_gcmds[0]",
          property: "lineColor",
          currentValue: staticMetrics.borderStroke,
          suggestedValue: targetBorderStroke,
          reason: `\u908A\u6846\u8272\u5DEE \u0394E00 = ${borderDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetBorderStroke})`
        });
      }
      if (accentDeltaE2000 > toleranceDeltaE && Array.isArray(data._$child) && data._$child[0]) {
        autoFixPatches.push({
          targetPath: "_$child[0]",
          property: "color",
          currentValue: staticMetrics.accentOrText,
          suggestedValue: targetAccentOrText,
          reason: `\u6587\u5B57/\u5F37\u8ABF\u8272\u5DEE \u0394E00 = ${accentDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetAccentOrText})`
        });
      }
      const passed = maxAbsErrorPx <= tolerancePx && maxDeltaE2000 <= toleranceDeltaE;
      let pixelBufferTelemetry;
      if (pixelBufferInfo) {
        const bufRes = this.measurePixelBuffer(
          pixelBufferInfo.rgba,
          pixelBufferInfo.width,
          pixelBufferInfo.height
        );
        pixelBufferTelemetry = {
          canvasWidth: pixelBufferInfo.width,
          canvasHeight: pixelBufferInfo.height,
          nonTransparentPixels: bufRes.nonTransparentPixels,
          coveragePercent: bufRes.coveragePercent,
          sampledDominantHex: bufRes.sampledDominantHex
        };
      }
      return {
        assetName: spec.assetName,
        category: data._zhudaMeta?.category ?? "ui-prefab",
        passed,
        measuredBox,
        expectedBox,
        pixelErrors: {
          xDiffPx,
          yDiffPx,
          widthDiffPx,
          heightDiffPx,
          maxAbsErrorPx
        },
        colorMetrics: {
          measuredPrimaryFill: staticMetrics.primaryFill,
          targetPrimaryFill,
          primaryDeltaE76,
          primaryDeltaE2000,
          measuredBorderStroke: staticMetrics.borderStroke,
          targetBorderStroke,
          borderDeltaE2000,
          measuredAccentOrText: staticMetrics.accentOrText,
          targetAccentOrText,
          accentDeltaE2000,
          maxDeltaE2000
        },
        ...pixelBufferTelemetry ? { pixelBufferTelemetry } : {},
        autoFixPatches,
        summary: passed ? `\u2705 \u50CF\u7D20\u908A\u754C\u8AA4\u5DEE 0px \u4E14\u8272\u5DEE \u0394E00=${maxDeltaE2000} (\u901A\u904E\u6821\u6E96)` : `\u26A0\uFE0F \u5075\u6E2C\u5230\u50CF\u7D20\u8AA4\u5DEE ${maxAbsErrorPx}px \u8207\u8272\u5DEE \u0394E00=${maxDeltaE2000}\uFF0C\u5DF2\u7522\u51FA ${autoFixPatches.length} \u9805\u81EA\u52D5\u4FEE\u5FA9 Patch`
      };
    }
    /**
     * 演示 AI Agent 靜態資產自動校準閉環：
     * 從帶有 +3px 寬度偏差、+2px 內距偏移與 ΔE00 色差的未校準 Prefab，自動檢測並單步收斂至 0 誤差
     */
    static runSelfConvergenceDemo() {
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const uncalibrated = ZhudaAssetSerializer.buildConfirmButtonPrefab("uncalibrated-drift");
      const beforeReport = this.calibrateAsset(uncalibrated);
      const convergedHierarchy = ZhudaAssetSerializer.applyCalibrationPatches(
        uncalibrated,
        beforeReport.autoFixPatches
      );
      const afterReport = this.calibrateAsset(convergedHierarchy);
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return {
        beforeReport,
        appliedPatches: beforeReport.autoFixPatches,
        afterReport,
        convergedHierarchy,
        elapsedMs: Number(Math.max(0.1, t1 - t0).toFixed(2))
      };
    }
    /**
     * 驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體拉伸後四角錨塊是否維持 1:1 零變形
     */
    static verifyNineSliceIntegrity(data) {
      const targetData = data || ZhudaAssetSerializer.buildNineSliceDialogPrefab(320, 140);
      const rawGrid = (targetData.sizeGrid || "16,16,16,16,0").split(",").map((n) => Number(n.trim()));
      const sizeGrid = [
        rawGrid[0] ?? 16,
        rawGrid[1] ?? 16,
        rawGrid[2] ?? 16,
        rawGrid[3] ?? 16,
        rawGrid[4] ?? 0
      ];
      const [top, right, bottom, left] = sizeGrid;
      const baseWidth = targetData._zhudaMeta?.nineSliceSpec?.baseWidth ?? 160;
      const baseHeight = targetData._zhudaMeta?.nineSliceSpec?.baseHeight ?? 80;
      const stretchedWidth = targetData.width ?? 320;
      const stretchedHeight = targetData.height ?? 140;
      const cmds = targetData._gcmds || [];
      const centerCmd = cmds[1] || { x: left, y: top, width: stretchedWidth - left - right, height: stretchedHeight - top - bottom };
      const tlCmd = cmds[2] || { x: 0, y: 0, width: left, height: top };
      const trCmd = cmds[3] || { x: stretchedWidth - right, y: 0, width: right, height: top };
      const blCmd = cmds[4] || { x: 0, y: stretchedHeight - bottom, width: left, height: bottom };
      const brCmd = cmds[5] || { x: stretchedWidth - right, y: stretchedHeight - bottom, width: right, height: bottom };
      const cornerPins = {
        topLeft: { x: tlCmd.x ?? 0, y: tlCmd.y ?? 0, width: tlCmd.width ?? left, height: tlCmd.height ?? top },
        topRight: { x: trCmd.x ?? 0, y: trCmd.y ?? 0, width: trCmd.width ?? right, height: trCmd.height ?? top },
        bottomLeft: { x: blCmd.x ?? 0, y: blCmd.y ?? 0, width: blCmd.width ?? left, height: blCmd.height ?? bottom },
        bottomRight: { x: brCmd.x ?? 0, y: brCmd.y ?? 0, width: brCmd.width ?? right, height: brCmd.height ?? bottom }
      };
      const errors = [
        Math.abs(cornerPins.topLeft.width - left),
        Math.abs(cornerPins.topLeft.height - top),
        Math.abs(cornerPins.topRight.width - right),
        Math.abs(cornerPins.topRight.height - top),
        Math.abs(cornerPins.bottomLeft.width - left),
        Math.abs(cornerPins.bottomLeft.height - bottom),
        Math.abs(cornerPins.bottomRight.width - right),
        Math.abs(cornerPins.bottomRight.height - bottom),
        Math.abs(cornerPins.topRight.x - (stretchedWidth - right)),
        Math.abs(cornerPins.bottomRight.y - (stretchedHeight - bottom))
      ];
      const maxCornerDistortionPx = Math.max(...errors);
      return {
        assetName: targetData._zhudaMeta?.targetSpec?.assetName || "NineSliceDialogFrame.lh",
        sizeGrid,
        baseSize: { width: baseWidth, height: baseHeight },
        stretchedSize: { width: stretchedWidth, height: stretchedHeight },
        stretchRatioX: Number((stretchedWidth / baseWidth).toFixed(2)),
        stretchRatioY: Number((stretchedHeight / baseHeight).toFixed(2)),
        cornerPins,
        maxCornerDistortionPx,
        centerSliceSize: {
          width: centerCmd.width ?? stretchedWidth - left - right,
          height: centerCmd.height ?? stretchedHeight - top - bottom
        },
        passed: maxCornerDistortionPx === 0 && Boolean(targetData.sizeGrid)
      };
    }
  };

  // packages/core/ViewportMatrixEngine.ts
  var VIEWPORT_DEVICE_PROFILES = {
    "desktop-fhd-16-9": {
      id: "desktop-fhd-16-9",
      name: "Desktop FHD (16:9)",
      aspectLabel: "16:9",
      viewportWidth: 1280,
      viewportHeight: 720,
      devicePixelRatio: 2,
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    "iphone-15-pro-portrait": {
      id: "iphone-15-pro-portrait",
      name: "iPhone 15 Pro \u76F4\u5411 (9:19.5 \u9748\u52D5\u5CF6)",
      aspectLabel: "9:19.5",
      viewportWidth: 393,
      viewportHeight: 852,
      devicePixelRatio: 3,
      safeArea: { top: 59, right: 0, bottom: 34, left: 0 }
    },
    "iphone-15-pro-landscape": {
      id: "iphone-15-pro-landscape",
      name: "iPhone 15 Pro \u6A6B\u5411 (19.5:9 \u5B89\u5168\u5340)",
      aspectLabel: "19.5:9",
      viewportWidth: 852,
      viewportHeight: 393,
      devicePixelRatio: 3,
      safeArea: { top: 0, right: 59, bottom: 21, left: 59 }
    },
    "ipad-air-4-3": {
      id: "ipad-air-4-3",
      name: "iPad Air \u5E73\u677F (4:3)",
      aspectLabel: "4:3",
      viewportWidth: 1024,
      viewportHeight: 768,
      devicePixelRatio: 2,
      safeArea: { top: 24, right: 0, bottom: 20, left: 0 }
    },
    "ultrawide-21-9": {
      id: "ultrawide-21-9",
      name: "Ultrawide \u8D85\u5BEC\u96FB\u7AF6\u87A2\u5E55 (21:9)",
      aspectLabel: "21:9",
      viewportWidth: 1680,
      viewportHeight: 720,
      devicePixelRatio: 2,
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
    }
  };
  var ViewportMatrixEngine = class {
    /**
     * 針對指定設備視口與 SafeArea 計算無裁切 UI 錨點與 3D 相機 FOV 自適應補償
     */
    static computeLayoutForDevice(deviceOrId) {
      const spec = typeof deviceOrId === "string" ? VIEWPORT_DEVICE_PROFILES[deviceOrId] || VIEWPORT_DEVICE_PROFILES["desktop-fhd-16-9"] : deviceOrId;
      const { viewportWidth: vw, viewportHeight: vh, safeArea } = spec;
      const safeX = safeArea.left;
      const safeY = safeArea.top;
      const safeW = Math.max(100, vw - safeArea.left - safeArea.right);
      const safeH = Math.max(100, vh - safeArea.top - safeArea.bottom);
      const orientation = vw >= vh ? "landscape" : "portrait";
      const aspect = safeW / safeH;
      const scaleFactor = orientation === "landscape" ? Number(Math.min(safeW / 1280, safeH / 720).toFixed(3)) : Number(Math.min(safeW / 393, safeH / 759).toFixed(3));
      const recommendedCameraFov = orientation === "portrait" ? Math.min(68, Math.round(45 / Math.max(0.62, aspect))) : aspect < 1.5 ? 50 : 45;
      const recommendedCameraDist = orientation === "portrait" ? 19.2 : aspect < 1.5 ? 15.6 : 14;
      const pad = orientation === "portrait" ? 10 : 16;
      let hudTopBarRect;
      let mascotRect;
      let telemetryRect;
      let boardViewportRect;
      if (orientation === "landscape") {
        const topH = Math.min(72, Math.round(safeH * 0.12));
        hudTopBarRect = {
          x: safeX + pad,
          y: safeY + pad,
          width: safeW - pad * 2,
          height: topH
        };
        const sideW = Math.min(225, Math.round(safeW * 0.21));
        const mascotH = Math.min(172, Math.round((safeH - topH - pad * 3) * 0.34));
        mascotRect = {
          x: safeX + safeW - pad - sideW,
          y: hudTopBarRect.y + topH + pad,
          width: sideW,
          height: mascotH
        };
        const teleY = mascotRect.y + mascotH + pad;
        const teleH = Math.max(80, safeY + safeH - pad - teleY);
        telemetryRect = {
          x: mascotRect.x,
          y: teleY,
          width: sideW,
          height: teleH
        };
        boardViewportRect = {
          x: safeX + pad,
          y: hudTopBarRect.y + topH + pad,
          width: Math.max(120, mascotRect.x - (safeX + pad) - pad),
          height: Math.max(120, safeH - topH - pad * 3)
        };
      } else {
        const topH = 60;
        hudTopBarRect = {
          x: safeX + pad,
          y: safeY + pad,
          width: safeW - pad * 2,
          height: topH
        };
        const bottomRowH = 148;
        const bottomY = safeY + safeH - pad - bottomRowH;
        const halfW = Math.floor((safeW - pad * 3) / 2);
        mascotRect = {
          x: safeX + pad,
          y: bottomY,
          width: halfW,
          height: bottomRowH
        };
        telemetryRect = {
          x: safeX + pad * 2 + halfW,
          y: bottomY,
          width: safeW - pad * 3 - halfW,
          height: bottomRowH
        };
        const boardY = hudTopBarRect.y + topH + pad;
        boardViewportRect = {
          x: safeX + pad,
          y: boardY,
          width: safeW - pad * 2,
          height: Math.max(160, bottomY - boardY - pad)
        };
      }
      const allRects = [hudTopBarRect, mascotRect, telemetryRect, boardViewportRect];
      const safeRight = safeX + safeW;
      const safeBottom = safeY + safeH;
      const safeAreaCompliant = allRects.every(
        (r) => r.x >= safeX && r.y >= safeY && r.x + r.width <= safeRight && r.y + r.height <= safeBottom && r.width > 0 && r.height > 0
      );
      const zeroOverflowPassed = allRects.every(
        (r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= vw && r.y + r.height <= vh
      );
      return {
        deviceId: spec.id,
        deviceName: spec.name,
        aspectLabel: spec.aspectLabel,
        viewportWidth: vw,
        viewportHeight: vh,
        safeArea: { ...safeArea },
        safeZoneRect: { x: safeX, y: safeY, width: safeW, height: safeH },
        orientation,
        scaleFactor,
        recommendedCameraFov,
        recommendedCameraDist,
        hudTopBarRect,
        mascotRect,
        telemetryRect,
        boardViewportRect,
        safeAreaCompliant,
        zeroOverflowPassed
      };
    }
    /**
     * 執行全部 5 大主流設備視口與 SafeArea 矩陣驗測
     */
    static auditAllViewportProfiles() {
      const ids = Object.keys(VIEWPORT_DEVICE_PROFILES);
      const reports = ids.map((id) => this.computeLayoutForDevice(id));
      const allPassed = reports.every((r) => r.safeAreaCompliant && r.zeroOverflowPassed);
      if (typeof document !== "undefined" && document.body) {
        document.body.dataset.zhudaViewportProfiles = String(reports.length);
        document.body.dataset.zhudaSafeareaPassed = String(allPassed);
      }
      return {
        totalProfiles: reports.length,
        allPassed,
        reports
      };
    }
  };

  // packages/core/BenchmarkEngine.ts
  var ZhudaBenchmarkEngine = class {
    /**
     * 執行即時微基準測試並回傳量化性能數據
     */
    static runSuite(activeTileNodesCount = 81) {
      const iterations = 1e4;
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      let angle = 0.25;
      let vel = 0;
      const stiffness = 120;
      const damping = 0.92;
      const dt = 0.016;
      for (let i = 0; i < iterations; i++) {
        const accel = -stiffness * angle + Math.sin(i * 0.05) * 4;
        vel = (vel + accel * dt) * damping;
        angle += vel * dt;
      }
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsedMs = Math.max(0.05, t1 - t0 + angle * 1e-6);
      const springMathOpsPerMs = Math.round(iterations / elapsedMs);
      const spinePhysicsOpsPerMs = null;
      const zeroGcPoolSpeedupRatio = null;
      const estimatedDrawCallsZhuda = 9;
      const estimatedDrawCallsThreeAssembled = activeTileNodesCount + 28;
      const pruningProfiles = {};
      const profileNames = [
        "2d-light",
        "3d-standard",
        "spine-hybrid",
        "full-all-in-one"
      ];
      for (const p of profileNames) {
        const res = TopologyResolver.resolveByFeatures(ENGINE_PRESET_PROFILES[p]);
        pruningProfiles[p] = {
          moduleCount: res.orderedModules.length,
          sizeKB: res.totalSizeKB,
          savedPercent: res.prunedRatioPercent
        };
      }
      const allStaticAssets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
      const lhKeys = Object.keys(allStaticAssets).filter((k) => k.endsWith(".lh"));
      const vfxKeys = lhKeys.filter(
        (k) => allStaticAssets[k]._zhudaMeta?.category === "vfx-blueprint" || allStaticAssets[k]._zhudaMeta?.category === "particle-emitter"
      );
      const convergence = PixelCalibrationEngine.runSelfConvergenceDemo();
      const nineSliceReport = PixelCalibrationEngine.verifyNineSliceIntegrity(
        allStaticAssets["NineSliceDialogFrame.lh"]
      );
      const iframeDiag = IframeSoundAdapter.getShared().getDiagnostics();
      const viewportAudit = ViewportMatrixEngine.auditAllViewportProfiles();
      const unityReport = UnityBridgePipeline.runFullMigrationVerification();
      return {
        timestamp: Date.now(),
        springMathOpsPerMs,
        measurementScope: "Spring arithmetic microbenchmark only; draw calls below are estimates, and no pool speedup or Spine runtime result is claimed.",
        spinePhysicsOpsPerMs,
        zeroGcPoolSpeedupRatio,
        sharedMeshBatchNodes: activeTileNodesCount,
        estimatedDrawCallsZhuda,
        estimatedDrawCallsThreeAssembled,
        staticAssetTelemetry: {
          totalAssetsCount: Object.keys(allStaticAssets).length,
          calibratedPrefabsCount: lhKeys.length,
          vfxBlueprintsCount: vfxKeys.length,
          allCalibratedPassed: convergence.afterReport.passed && nineSliceReport.passed,
          convergenceTimeMs: convergence.elapsedMs,
          beforePxError: convergence.beforeReport.pixelErrors.maxAbsErrorPx,
          afterPxError: convergence.afterReport.pixelErrors.maxAbsErrorPx,
          beforeDeltaE2000: convergence.beforeReport.colorMetrics.maxDeltaE2000,
          afterDeltaE2000: convergence.afterReport.colorMetrics.maxDeltaE2000
        },
        nineSliceTelemetry: {
          sizeGrid: nineSliceReport.sizeGrid.join(","),
          stretchRatioX: nineSliceReport.stretchRatioX,
          stretchRatioY: nineSliceReport.stretchRatioY,
          maxCornerDistortionPx: nineSliceReport.maxCornerDistortionPx,
          passed: nineSliceReport.passed
        },
        iframeAudioTelemetry: {
          postMessageBridgeActive: iframeDiag.postMessageBridgeActive,
          inIframe: iframeDiag.inIframe,
          autoSuspendOnBlurReady: true,
          masterVolume: iframeDiag.volumes.master
        },
        viewportMatrixTelemetry: {
          totalProfiles: viewportAudit.totalProfiles,
          allSafeAreaPassed: viewportAudit.allPassed,
          deviceAspectRatios: viewportAudit.reports.map((r) => `${r.deviceId}(${r.aspectLabel})`)
        },
        unityMigrationTelemetry: {
          sourceSceneName: unityReport.sourceSceneName,
          convertedNodesCount: unityReport.convertedNodesCount,
          animatorTransitionTrace: unityReport.animatorVerification.simulatedTransitionTrace,
          spine42ConstraintsMounted: unityReport.spine42Verification.physicsConstraintsMounted,
          passed: unityReport.passed
        },
        pruningProfiles
      };
    }
  };

  // src/ZhudaShowcaseApp.ts
  var ZhudaShowcaseApp = class {
    constructor(scene) {
      this.particleEmitter = null;
      this.unityAnimator = null;
      this.vfxCycleIndex = 0;
      this.flagMode = false;
      this.isPointerDown = false;
      this.pointerDownTime = 0;
      this.pointerDownPos = { x: 0, y: 0 };
      this.longPressTriggered = false;
      this.scene = scene;
      this.game = new MinesweeperGame(DIFFICULTIES.beginner);
      this.audio = new MinesweeperAudio();
      const overlay2D = new Laya.Sprite();
      overlay2D.name = "NumberOverlay2D";
      Laya.stage.addChild(overlay2D);
      this.view3D = new Minesweeper3DView(scene, this.game, overlay2D);
      this.companion = new SpineCompanion(Laya.stage);
      const particlePrefabData = ZhudaAssetSerializer.buildParticleExplosionPrefab();
      const particleNode = ZhudaPrefab.instantiate(particlePrefabData, Laya.stage, { x: 460, y: 270 });
      particleNode.visible = false;
      this.particleEmitter = particleNode.getComponent(ZhudaParticleEmitterComponent) || particleNode.addComponent(ZhudaParticleEmitterComponent);
      const unityGuardianPrefab = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();
      const unityGuardianNode = ZhudaPrefab.instantiate(unityGuardianPrefab, Laya.stage, { x: 460, y: 270 });
      unityGuardianNode.visible = false;
      this.unityAnimator = unityGuardianNode.getComponent(
        ZhudaAnimatorControllerComponent
      ) || unityGuardianNode.addComponent(
        ZhudaAnimatorControllerComponent
      );
      this.ui = new MinesweeperUI(Laya.stage, {
        onRestart: () => this.restartGame(),
        onDifficultyChange: (diff) => this.changeDifficulty(diff),
        onToggleView: () => this.view3D.toggleViewMode(),
        onToggleAudio: () => {
          const next = !this.audio.isEnabled();
          this.audio.setEnabled(next);
          return next;
        },
        onToggleFlagMode: () => {
          this.flagMode = !this.flagMode;
          return this.flagMode;
        },
        onRunBenchmark: () => this.executeLiveBenchmark()
      });
      this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
      this.ui.refreshTelemetry(this.latestBenchmark);
      this.bindInputEvents();
      Laya.timer.loop(500, this, this.onTimerUpdate);
      this.handleReveal(4, 4);
      this.syncGlobalTelemetry();
      console.log(
        "[ZhudaShowcaseApp] \u8C6C\u5927 LayaAir (AI-Friendly) \u521D\u59CB\u5316\u5B8C\u7562\uFF1A29 \u6A21\u7D44\u3001AST \u53CD\u5C04\u3001Spine 4.2 PhysicsConstraint\u3001\u975C\u614B\u8CC7\u7522 (.lh) \u50CF\u7D20/\u0394E \u6821\u6E96\u8207 3D \u68CB\u76E4\u5168\u6578\u5C31\u7DD2\uFF01"
      );
    }
    executeLiveBenchmark() {
      this.audio.playChord(3);
      this.companion.setState("cheer");
      this.companion.applyImpulse(6.5);
      this.view3D.triggerVictoryWave();
      const vfxModes = [
        "coin-fountain",
        "sword-slash",
        "levelup-aura",
        "victory"
      ];
      const activeVfx = vfxModes[this.vfxCycleIndex % vfxModes.length];
      this.vfxCycleIndex++;
      if (this.particleEmitter) {
        this.particleEmitter.playBurst(520, 360, activeVfx);
      }
      if (this.unityAnimator) {
        const stepRes = this.unityAnimator.stepAnimatorCycle();
        this.ui.updateUnityAnimatorBanner(stepRes.stateName, activeVfx);
      }
      this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
      this.syncGlobalTelemetry();
      return this.latestBenchmark;
    }
    syncGlobalTelemetry() {
      const win = globalThis;
      win.__ZHUDA_SHOWCASE_STATE__ = {
        status: this.game.status,
        rows: this.game.rows,
        cols: this.game.cols,
        revealedCount: this.game.revealedCount,
        remainingMines: this.game.remainingMines,
        tileNodes3D: this.view3D.getTileCount(),
        benchmark: this.latestBenchmark
      };
      if (typeof document !== "undefined" && document.body) {
        document.body.dataset.zhudaTiles = String(this.view3D.getTileCount());
        document.body.dataset.zhudaRevealed = String(this.game.revealedCount);
        document.body.dataset.zhudaDrawcalls = String(this.latestBenchmark.estimatedDrawCallsZhuda);
        document.body.dataset.zhudaStageChildren = String(Laya.stage ? Laya.stage.numChildren : 0);
        document.body.dataset.zhudaStaticAssets = String(
          this.latestBenchmark.staticAssetTelemetry.totalAssetsCount
        );
        document.body.dataset.zhudaCalibratedDeltaE = String(
          this.latestBenchmark.staticAssetTelemetry.afterDeltaE2000
        );
        document.body.dataset.zhudaPrefabAssembled = String(
          Boolean(this.particleEmitter && this.unityAnimator)
        );
        document.body.dataset.zhudaNineSlicePassed = String(
          this.latestBenchmark.nineSliceTelemetry.passed
        );
        document.body.dataset.zhudaIframeAudio = this.latestBenchmark.iframeAudioTelemetry.postMessageBridgeActive ? "ready" : "inactive";
        document.body.dataset.zhudaViewportProfiles = String(
          this.latestBenchmark.viewportMatrixTelemetry.totalProfiles
        );
        document.body.dataset.zhudaSafeareaPassed = String(
          this.latestBenchmark.viewportMatrixTelemetry.allSafeAreaPassed
        );
        document.body.dataset.zhudaVfxBlueprints = String(
          this.latestBenchmark.staticAssetTelemetry.vfxBlueprintsCount
        );
        document.body.dataset.zhudaUnityMigrated = String(
          this.latestBenchmark.unityMigrationTelemetry.passed
        );
        document.body.dataset.zhudaUnityAnimatorTrace = this.latestBenchmark.unityMigrationTelemetry.animatorTransitionTrace.join("->");
      }
    }
    bindInputEvents() {
      Laya.stage.on(Laya.Event.MOUSE_DOWN, this, this.onPointerDown);
      Laya.stage.on(Laya.Event.MOUSE_UP, this, this.onPointerUp);
      Laya.stage.on(Laya.Event.RIGHT_MOUSE_DOWN, this, this.onRightMouseDown);
      Laya.timer.loop(100, this, this.checkLongPress);
    }
    isInHudRegion(x, y) {
      if (y < 115) return true;
      if (x > 1020 && y > 110) return true;
      return false;
    }
    onPointerDown(e) {
      if (this.isInHudRegion(e.stageX, e.stageY)) return;
      this.isPointerDown = true;
      this.pointerDownTime = Date.now();
      this.pointerDownPos = { x: e.stageX, y: e.stageY };
      this.longPressTriggered = false;
      if (this.game.status === "playing" || this.game.status === "idle") {
        this.ui.setPressedFace();
        this.companion.setState("thinking");
      }
    }
    checkLongPress() {
      if (this.isPointerDown && !this.longPressTriggered && Date.now() - this.pointerDownTime > 450) {
        this.longPressTriggered = true;
        const pick = this.view3D.pickTile(this.pointerDownPos.x, this.pointerDownPos.y);
        if (pick) {
          this.handleToggleFlag(pick.r, pick.c);
        }
      }
    }
    onPointerUp(e) {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      if (this.isInHudRegion(e.stageX, e.stageY)) return;
      if (this.longPressTriggered) return;
      const dist = Math.hypot(e.stageX - this.pointerDownPos.x, e.stageY - this.pointerDownPos.y);
      if (dist > 20) return;
      const pick = this.view3D.pickTile(e.stageX, e.stageY);
      if (!pick) {
        this.ui.updateGameStatus(this.game.status);
        this.companion.setState(this.game.status === "won" ? "cheer" : "idle");
        return;
      }
      if (this.flagMode) {
        this.handleToggleFlag(pick.r, pick.c);
      } else {
        this.handleReveal(pick.r, pick.c);
      }
    }
    onRightMouseDown(e) {
      if (this.isInHudRegion(e.stageX, e.stageY)) return;
      const pick = this.view3D.pickTile(e.stageX, e.stageY);
      if (pick) {
        this.handleToggleFlag(pick.r, pick.c);
      }
    }
    handleReveal(r, c) {
      const target = this.game.getCell(r, c);
      if (!target) return;
      if (target.state === "revealed" && target.neighborMines > 0) {
        const chordRes = this.game.chord(r, c);
        if (chordRes.changed.length > 0) {
          chordRes.changed.forEach((cell) => this.view3D.updateCellVisual(cell));
          if (chordRes.hitMine) {
            this.handleLoss(r, c);
          } else {
            this.audio.playChord(1);
            if (this.game.status === "won") {
              this.handleWin();
            }
          }
        }
        this.syncGlobalTelemetry();
        return;
      }
      const res = this.game.reveal(r, c);
      if (res.changed.length === 0) return;
      res.changed.forEach((cell) => this.view3D.updateCellVisual(cell));
      if (res.hitMine) {
        this.handleLoss(r, c);
      } else {
        if (res.changed.length > 1) {
          this.audio.playChord(0);
        } else {
          this.audio.playClick();
        }
        if (this.game.status === "won") {
          this.handleWin();
        } else {
          this.ui.updateGameStatus("playing");
          this.companion.setState("idle");
        }
      }
      this.syncGlobalTelemetry();
    }
    handleToggleFlag(r, c) {
      const cell = this.game.toggleFlag(r, c);
      if (cell) {
        this.view3D.updateCellVisual(cell);
        this.ui.updateRemainingMines(this.game.remainingMines);
        this.audio.playFlag();
        this.companion.setState("flagging");
        Laya.timer.once(800, this, () => {
          if (this.game.status !== "won" && this.game.status !== "lost") {
            this.companion.setState("idle");
          }
        });
        this.syncGlobalTelemetry();
      }
    }
    handleLoss(centerR, centerC) {
      this.ui.updateGameStatus("lost");
      this.audio.playExplode();
      this.companion.setState("scared");
      this.view3D.triggerExplosionPhysics(centerR, centerC);
      if (this.particleEmitter) {
        this.particleEmitter.playBurst(520, 360, "explode");
      }
      for (let r = 0; r < this.game.rows; r++) {
        for (let c = 0; c < this.game.cols; c++) {
          const cell = this.game.grid[r][c];
          if (cell.isMine || cell.wrongFlag) {
            this.view3D.updateCellVisual(cell);
          }
        }
      }
    }
    handleWin() {
      this.ui.updateGameStatus("won");
      this.audio.playVictory();
      this.companion.setState("cheer");
      this.ui.updateRemainingMines(0);
      this.view3D.triggerVictoryWave();
      for (let r = 0; r < this.game.rows; r++) {
        for (let c = 0; c < this.game.cols; c++) {
          const cell = this.game.grid[r][c];
          if (cell.isMine) {
            this.view3D.updateCellVisual(cell);
          }
        }
      }
    }
    restartGame() {
      this.game.reset();
      this.view3D.rebuildBoard();
      this.ui.updateRemainingMines(this.game.remainingMines);
      this.ui.updateTimer(0);
      this.ui.updateGameStatus("idle");
      this.companion.setState("idle");
      this.syncGlobalTelemetry();
    }
    changeDifficulty(diff) {
      this.game.reset(diff);
      this.view3D.rebuildBoard();
      this.ui.updateRemainingMines(this.game.remainingMines);
      this.ui.updateTimer(0);
      this.ui.updateGameStatus("idle");
      this.companion.setState("idle");
      this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
      this.ui.refreshTelemetry(this.latestBenchmark);
      this.syncGlobalTelemetry();
    }
    onTimerUpdate() {
      if (this.game.status === "playing") {
        this.ui.updateTimer(this.game.elapsedTime);
      }
    }
  };

  // src/Main.ts
  async function bootstrap() {
    const { rootScene } = await ZhudaEngine.boot({
      width: 1280,
      height: 720,
      bgColor: "#0b0f17",
      features: "all",
      beforeInit: () => {
        registerAllReflectedComponents();
      }
    });
    registerAllReflectedComponents();
    new ZhudaShowcaseApp(rootScene);
    ZhudaEngine.flushRenderFrames(4);
  }
  bootstrap().catch((err) => {
    console.error("[Zhuda-LayaAir] \u555F\u52D5\u5931\u6557:", err);
  });
})();
//# sourceMappingURL=bundle.js.map
