// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaRuntimeSession } from './runtime3d/Runtime';
/** A disposable Play instance. Authored data and editor history are not exposed. */
export interface ZhudaPrefabEditorPreviewContext {
    readonly root: Laya.Sprite;
    readonly stage: Laya.Stage;
    readonly canvas: HTMLCanvasElement;
    readonly runtime: ZhudaRuntimeSession;
    readonly assetPath: string;
    readonly signal: AbortSignal;
    /** Named path relative to root; an empty path returns root. Missing nodes throw. */
    find<T extends Laya.Sprite = Laya.Sprite>(path: string): T;
    /** Resolve a logical asset ID through the editor's project asset route. */
    assetUrl(id: string): string;
    /** Listeners are retired even if an asynchronous mount fails or is cancelled. */
    listen(target: Laya.EventDispatcher, type: string, listener: (event: Laya.Event) => void): () => void;
    /** Register owned resources immediately; late registration is disposed at once. */
    onDispose(cleanup: () => void): () => void;
}
export interface ZhudaPrefabEditorPreviewController {
    dispose(): void;
}
/** Export mount from zhuda.editor.ts or the --preview-controller module.
 * Allocate resources inside mount and register cleanup before awaiting work. */
export interface ZhudaPrefabEditorPreviewModule {
    mount(context: ZhudaPrefabEditorPreviewContext): void | ZhudaPrefabEditorPreviewController | Promise<void | ZhudaPrefabEditorPreviewController>;
}
