// Generated from TypeScript source; run npm run types:generate.
import type { LayaHierarchyNodeData, LayaGraphicsCmdData } from './index.js';
export declare class ZhudaPrefab {
    static instantiate(lhData: LayaHierarchyNodeData, parent?: Laya.Node, positionOverride?: {
        x: number;
        y: number;
    }): Laya.Sprite;
    private static hydrateNodeRecursive;
    private static ensureGraphicsHydrated;
    static applyGraphicsCommands(graphics: Laya.Graphics, cmds: LayaGraphicsCmdData[]): void;
}
