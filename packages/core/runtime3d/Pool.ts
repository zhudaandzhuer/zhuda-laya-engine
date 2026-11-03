export interface ZhudaPoolOptions<T> {
  capacity: number;
  create: () => T;
  reset?: (item: T) => void;
  onSpawn?: (item: T) => void;
  onDespawn?: (item: T) => void;
  dispose?: (item: T) => void;
}

/** Explicit lifecycle contract for reusable consumer-owned objects. */
export class ZhudaObjectPool<T> {
  readonly capacity: number;
  private readonly create: () => T;
  private readonly reset?: (item: T) => void;
  private readonly onSpawn?: (item: T) => void;
  private readonly onDespawn?: (item: T) => void;
  private readonly disposeItemCallback?: (item: T) => void;
  private readonly free: T[] = [];
  private readonly active = new Set<T>();
  private readonly disposedItems = new Set<T>();
  private created = 0;
  private disposed = false;

  constructor(options: ZhudaPoolOptions<T>) {
    if (!options || !Number.isSafeInteger(options.capacity) || options.capacity <= 0)
      throw Error("Invalid pool capacity");
    if (typeof options.create !== "function") throw Error("Pool create callback is required");
    this.capacity = options.capacity;
    this.create = options.create;
    this.reset = options.reset;
    this.onSpawn = options.onSpawn;
    this.onDespawn = options.onDespawn;
    this.disposeItemCallback = options.dispose;
  }

  acquire(): T | null {
    if (this.disposed) return null;
    let item: T | null;
    if (this.free.length) item = this.free.pop()!;
    else if (this.created < this.capacity) {
      item = this.create();
      this.created++;
    } else item = null;
    if (item === null) return null;
    this.active.add(item);
    try {
      this.onSpawn?.(item);
    } catch (error) {
      this.active.delete(item);
      this.disposeItem(item);
      throw error;
    }
    return item;
  }

  release(item: T): boolean {
    if (this.disposed || !this.active.has(item)) return false;
    this.active.delete(item);
    try {
      this.onDespawn?.(item);
      this.reset?.(item);
    } catch (error) {
      this.disposeItem(item);
      throw error;
    }
    this.free.push(item);
    return true;
  }

  private disposeItem(item: T): void {
    if (this.disposedItems.has(item)) return;
    this.disposedItems.add(item);
    this.disposeItemCallback?.(item);
    this.created = Math.max(0, this.created - 1);
  }

  clear(): number {
    const items = [...this.active];
    for (const item of items) this.release(item);
    return items.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    let firstError: unknown;
    let hadError = false;
    const run = (action: () => void) => {
      try { action(); }
      catch (error) { if (!hadError) { hadError = true; firstError = error; } }
    };
    for (const item of this.active) {
      run(() => this.onDespawn?.(item));
      run(() => this.disposeItem(item));
    }
    for (const item of this.free) run(() => this.disposeItem(item));
    this.active.clear();
    this.free.length = 0;
    if (hadError) throw firstError;
  }

  get activeCount(): number { return this.active.size; }
  get availableCount(): number { return this.free.length; }
  get createdCount(): number { return this.created; }
  get isDisposed(): boolean { return this.disposed; }
}
