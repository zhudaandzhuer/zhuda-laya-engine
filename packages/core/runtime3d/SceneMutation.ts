export type ZhudaSceneMutationKind = "add" | "remove" | "destroy" | "custom";

export interface ZhudaSceneMutation {
  kind: ZhudaSceneMutationKind;
  apply: () => void;
  key?: string;
}

export interface ZhudaSceneMutationHandle {
  readonly id: number;
  readonly cancelled: boolean;
  cancel(): boolean;
}

interface PendingMutation extends ZhudaSceneMutation {
  id: number;
  cancelled: boolean;
}

/**
 * Batches scene graph writes at an explicit boundary. A mutation enqueued while
 * flushing is deferred to the next flush, so traversal never observes a
 * half-applied batch. The queue only calls public consumer-provided operations.
 */
export class ZhudaSceneMutationQueue {
  private nextId = 1;
  private pending = new Map<number, PendingMutation>();
  private disposed = false;
  private flushing = false;

  enqueue(mutation: ZhudaSceneMutation): ZhudaSceneMutationHandle {
    if (this.disposed) throw Error("Disposed scene mutation queue");
    if (!mutation || typeof mutation.apply !== "function")
      throw Error("Invalid scene mutation");
    if (!["add", "remove", "destroy", "custom"].includes(mutation.kind))
      throw Error("Invalid scene mutation kind");
    const item: PendingMutation = {
      ...mutation,
      id: this.nextId++,
      cancelled: false,
    };
    this.pending.set(item.id, item);
    return {
      id: item.id,
      get cancelled() { return item.cancelled; },
      cancel: () => this.cancel(item.id),
    };
  }

  deferAdd(apply: () => void): ZhudaSceneMutationHandle {
    return this.enqueue({ kind: "add", apply });
  }

  deferRemove(apply: () => void): ZhudaSceneMutationHandle {
    return this.enqueue({ kind: "remove", apply });
  }

  deferDestroy(apply: () => void): ZhudaSceneMutationHandle {
    return this.enqueue({ kind: "destroy", apply });
  }

  private cancel(id: number): boolean {
    const item = this.pending.get(id);
    if (!item || item.cancelled) return false;
    item.cancelled = true;
    this.pending.delete(id);
    return true;
  }

  /** Applies exactly the batch present at the start of this call. */
  flush(): number {
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

  clear(): void {
    for (const item of this.pending.values()) item.cancelled = true;
    this.pending.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  get size(): number { return this.pending.size; }
  get isFlushing(): boolean { return this.flushing; }
}
