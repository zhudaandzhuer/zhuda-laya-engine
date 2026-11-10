/** All timestamps are monotonic milliseconds in the driver's single time domain. */
export interface ZhudaRuntimeDriver {
  now(): number;
  start(frame: (nowMs: number) => void): void;
  setBackground(background: boolean): void;
  stop(): void;
  dispose(): void;
}
export class ZhudaRafDriver implements ZhudaRuntimeDriver {
  private frame = 0;
  private generation = 0;
  now(): number {
    return performance.now();
  }
  start(callback: (nowMs: number) => void): void {
    this.stop();
    const generation = ++this.generation;
    const tick = (now: number) => {
      if (generation !== this.generation) return;
      this.frame = 0;
      try {
        callback(now);
      } finally {
        if (generation === this.generation) this.frame = requestAnimationFrame(tick);
      }
    };
    this.frame = requestAnimationFrame(tick);
  }
  setBackground(_background: boolean): void {}
  stop(): void {
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  dispose(): void {
    this.stop();
  }
}
export interface ZhudaWorkerDriverOptions {
  intervalMs?: number;
  /** Host/CSP integration may provide an owned Worker with the documented protocol. */
  workerFactory?: () => Worker;
  onError?: (error: Error) => void;
}
/** Worker messages only wake the one runtime clock; no game state runs there.
 * Browsers may freeze both threads. Recovery belongs to RuntimeSession policy. */
export class ZhudaWorkerFrameDriver implements ZhudaRuntimeDriver {
  private readonly raf = new ZhudaRafDriver();
  private readonly worker: Worker;
  private callback?: (nowMs: number) => void;
  private generation = 0;
  private background = false;
  private disposed = false;
  private readonly intervalMs: number;
  constructor(options: ZhudaWorkerDriverOptions = {}) {
    this.intervalMs = options.intervalMs ?? 100;
    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 16 || this.intervalMs > 60_000)
      throw Error('Worker interval must be 16..60000 ms');
    if (options.workerFactory) this.worker = options.workerFactory();
    else {
      const source = `let timer;onmessage=({data})=>{clearInterval(timer);if(data.type==='start')timer=setInterval(()=>postMessage({generation:data.generation}),data.intervalMs);};`;
      const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      try {
        this.worker = new Worker(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    this.worker.onmessage = (event) => {
      if (
        !this.disposed &&
        this.background &&
        this.callback &&
        event.data?.generation === this.generation
      )
        this.callback(this.now());
    };
    this.worker.onerror = (event) => {
      this.stop();
      options.onError?.(Error(event.message || 'Background worker failed'));
    };
  }
  now(): number {
    return performance.now();
  }
  start(callback: (nowMs: number) => void): void {
    if (this.disposed) throw Error('Driver disposed');
    this.callback = callback;
    this.switchSource();
  }
  setBackground(background: boolean): void {
    if (this.disposed || this.background === background) return;
    this.background = background;
    this.switchSource();
  }
  private switchSource(): void {
    const generation = ++this.generation;
    this.raf.stop();
    this.worker.postMessage({ type: 'stop' });
    if (!this.callback) return;
    if (this.background)
      this.worker.postMessage({
        type: 'start',
        generation,
        intervalMs: this.intervalMs,
      });
    else
      this.raf.start((now) => {
        if (generation === this.generation) this.callback?.(now);
      });
  }
  stop(): void {
    this.callback = undefined;
    this.generation++;
    this.raf.stop();
    this.worker.postMessage({ type: 'stop' });
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.raf.dispose();
  }
}
