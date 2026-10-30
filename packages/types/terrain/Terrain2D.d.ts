export interface TerrainTile2D {
    id: number;
    color?: string;
    uv?: [number, number, number, number];
    blocked?: boolean;
}
export interface Terrain2DSpec {
    schemaVersion: 1;
    dimension: 2;
    width: number;
    height: number;
    tileSize: number;
    origin?: [number, number];
    palette: TerrainTile2D[];
    layers: {
        id: string;
        tiles: number[];
    }[];
}
export interface TerrainRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare function validateTerrain2D(spec: unknown): string[];
/** Data-only tile terrain. Zero is empty; blocking is metadata for the consumer's rules. */
export declare class ZhudaTerrain2D {
    readonly width: number;
    readonly height: number;
    readonly tileSize: number;
    readonly origin: readonly [number, number];
    readonly palette: ReadonlyMap<number, Readonly<TerrainTile2D>>;
    private layers;
    private listeners;
    constructor(spec: Terrain2DSpec);
    get layerIds(): string[];
    private index;
    private layer;
    getTile(layer: string, x: number, y: number): number;
    setTile(layer: string, x: number, y: number, id: number): void;
    paintRect(layer: string, r: TerrainRect, id: number): void;
    localToTile(x: number, y: number): {
        col: number;
        row: number;
    } | null;
    tileToLocal(col: number, row: number): {
        x: number;
        y: number;
    };
    isBlocked(col: number, row: number): boolean;
    onChange(f: (r: TerrainRect) => void): () => boolean;
    toJSON(): Terrain2DSpec;
}
/** Visible chunks own graphics commands; atlas and shader material are borrowed. */
export declare class ZhudaTerrain2DRenderer {
    readonly root: any;
    private chunks;
    private unsubscribe;
    private disposed;
    readonly terrain: ZhudaTerrain2D;
    constructor(terrain: ZhudaTerrain2D, options?: {
        parent?: any;
        atlas?: any;
        material?: any;
        chunkCells?: number;
        maxResidentChunks?: number;
    });
    readonly options: {
        parent?: any;
        atlas?: any;
        material?: any;
        chunkCells?: number;
        maxResidentChunks?: number;
    };
    setView(r: TerrainRect): void;
    flush(): void;
    get residentChunks(): number;
    dispose(): void;
}
