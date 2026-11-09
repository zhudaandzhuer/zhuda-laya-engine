import type { ZhudaPrefabEditorPreviewContext, ZhudaPrefabEditorPreviewController } from '../types/editor-preview.ts';
import { withDeadline } from '../core/runtime3d/AsyncDeadline.ts';

/** One Play owner. Cleanup must survive failed, non-cooperative and late mounts. */
export class PrefabEditorPreviewSession {
  private readonly abort = new AbortController();
  private readonly cleanups = new Set<() => void>();
  readonly errors: unknown[] = [];
  get signal() { return this.abort.signal; }

  own(cleanup: () => void) {
    let active = true;
    const release = () => {
      if (!active) return;
      active = false; this.cleanups.delete(release);
      try { cleanup(); } catch (error) { this.errors.push(error); }
    };
    if (this.signal.aborted) release(); else this.cleanups.add(release);
    return release;
  }

  context(input: Omit<ZhudaPrefabEditorPreviewContext, 'signal' | 'find' | 'listen' | 'onDispose'>): ZhudaPrefabEditorPreviewContext {
    const check = () => { if (this.signal.aborted) throw this.signal.reason; };
    return Object.freeze({
      ...input, signal: this.signal,
      find: <T extends Laya.Sprite>(path: string) => {
        check();
        let node: Laya.Node = input.root;
        for (const part of path.split('/').filter(Boolean)) {
          node = node.getChildByName(part);
          if (!node) throw Error(`Preview node not found: ${path} (${input.assetPath})`);
        }
        return node as T;
      },
      listen: (target: Laya.EventDispatcher, type: string, listener: (event: Laya.Event) => void) => {
        check(); target.on(type, this, listener);
        return this.own(() => target.off(type, this, listener));
      },
      onDispose: (cleanup: () => void) => this.own(cleanup),
    });
  }

  async mount(run: () => Promise<void | ZhudaPrefabEditorPreviewController>, timeoutMs = 15000) {
    try {
      await withDeadline(async () => {
        const controller = await run();
        if (controller) {
          if (typeof controller.dispose !== 'function') throw Error('Preview mount must return a disposable controller or nothing');
          this.own(() => controller.dispose());
        }
        if (this.signal.aborted) throw this.signal.reason;
      }, { signal: this.signal, timeoutMs });
    } catch (error) { this.dispose(); throw error; }
  }

  dispose() {
    if (this.signal.aborted) return;
    this.abort.abort(new DOMException('Preview stopped', 'AbortError'));
    for (const release of [...this.cleanups].reverse()) release();
  }
}
