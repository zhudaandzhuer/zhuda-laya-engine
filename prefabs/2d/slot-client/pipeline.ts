// An onion pipeline of named plugs: each plug gets the context and next(); code before
// next() runs on the way in, code after it on the way out. Used for math, locale and
// asset resolution. Pure TypeScript.
// Split from <original-cascade-slot>/client/src/core/pipeline/PipelineExecutor.ts (unchanged).

export type PlugFn<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

export interface NamedPlug<T> {
  name: string;
  fn: PlugFn<T>;
}

export class PipelineExecutor<T> {
  private plugs: NamedPlug<T>[] = [];

  /** use(fn) names the plug after the function; use(name, fn) names it. */
  use(nameOrFn: string | PlugFn<T>, maybeFn?: PlugFn<T>): this {
    if (typeof nameOrFn === 'function') {
      this.plugs.push({ name: nameOrFn.name || `Plug_${this.plugs.length + 1}`, fn: nameOrFn });
    } else if (typeof nameOrFn === 'string' && typeof maybeFn === 'function') {
      this.plugs.push({ name: nameOrFn, fn: maybeFn });
    }
    return this;
  }

  getPlugNames(): string[] {
    return this.plugs.map((p) => p.name);
  }

  async execute(ctx: T): Promise<T> {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times in plug');
      index = i;
      const item = this.plugs[i];
      if (!item) return;
      await item.fn(ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
    return ctx;
  }

  /**
   * Runs the plugs without waiting: correct only when no plug awaits anything but next()
   * (every plug's code before next() runs in order; code after an awaited next() runs later,
   * in a microtask). The math plugs are written that way.
   */
  executeSync(ctx: T): T {
    let index = -1;
    const dispatch = (i: number): void => {
      if (i <= index) throw new Error('next() called multiple times in sync plug');
      index = i;
      const item = this.plugs[i];
      if (!item) return;
      void item.fn(ctx, async () => dispatch(i + 1));
    };
    dispatch(0);
    return ctx;
  }
}
