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
  layers: { id: string; tiles: number[] }[];
}
export interface TerrainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function validateTerrain2D(spec: unknown): string[] {
  const s = spec as Terrain2DSpec,
    e: string[] = [];
  if (!s || s.schemaVersion !== 1 || s.dimension !== 2)
    return ["Expected schemaVersion:1, dimension:2"];
  if (
    ![s.width, s.height].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 4096,
    ) ||
    s.width * s.height > 1048576
  )
    e.push("width/height must be 1..4096 and at most 1048576 cells");
  if (!Number.isFinite(s.tileSize) || s.tileSize <= 0)
    e.push("tileSize must be positive");
  if (
    s.origin &&
    (!Array.isArray(s.origin) ||
      s.origin.length !== 2 ||
      !s.origin.every(Number.isFinite))
  )
    e.push("Invalid origin");
  const ids = new Set<number>([0]);
  if (!Array.isArray(s.palette) || s.palette.length > 65535)
    e.push("Invalid palette");
  else
    for (const t of s.palette) {
      if (
        !t ||
        !Number.isInteger(t.id) ||
        t.id < 1 ||
        t.id > 65535 ||
        ids.has(t.id)
      ) {
        e.push("Palette IDs must be unique integers 1..65535");
        continue;
      }
      ids.add(t.id);
      if (
        t.color !== undefined &&
        !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(t.color)
      )
        e.push("Tile color must be #RRGGBB or #RRGGBBAA");
      if (
        t.uv &&
        (!Array.isArray(t.uv) ||
          t.uv.length !== 4 ||
          !t.uv.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) ||
          t.uv[0] >= t.uv[2] ||
          t.uv[1] >= t.uv[3])
      )
        e.push("Invalid normalized atlas rectangle");
    }
  if (
    !Array.isArray(s.layers) ||
    !s.layers.length ||
    s.layers.length > 8 ||
    s.layers.length * s.width * s.height > 2097152
  )
    e.push("Expected 1..8 layers and at most 2097152 total cells");
  else {
    const names = new Set<string>();
    for (const l of s.layers) {
      if (!l || typeof l.id !== "string" || !l.id || names.has(l.id)) {
        e.push("Layer IDs must be unique nonempty strings");
        continue;
      }
      names.add(l.id);
      if (
        !Array.isArray(l.tiles) ||
        l.tiles.length !== s.width * s.height ||
        l.tiles.some((id) => !ids.has(id))
      )
        e.push(`Invalid tiles for layer ${l.id}`);
    }
  }
  return e;
}
/** Data-only tile terrain. Zero is empty; blocking is metadata for the consumer's rules. */
export class ZhudaTerrain2D {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly origin: readonly [number, number];
  readonly palette: ReadonlyMap<number, Readonly<TerrainTile2D>>;
  private layers = new Map<string, Uint16Array>();
  private listeners = new Set<(r: TerrainRect) => void>();
  constructor(spec: Terrain2DSpec) {
    const errors = validateTerrain2D(spec);
    if (errors.length) throw Error(errors.join("; "));
    this.width = spec.width;
    this.height = spec.height;
    this.tileSize = spec.tileSize;
    this.origin = Object.freeze([...(spec.origin || [0, 0])]) as readonly [
      number,
      number,
    ];
    this.palette = new Map(
      spec.palette.map((t) => [
        t.id,
        Object.freeze({
          ...t,
          uv: t.uv
            ? (Object.freeze([...t.uv]) as unknown as TerrainTile2D["uv"])
            : undefined,
        }),
      ]),
    );
    for (const layer of spec.layers)
      this.layers.set(layer.id, new Uint16Array(layer.tiles));
  }
  get layerIds() {
    return [...this.layers.keys()];
  }
  private index(x: number, y: number) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= this.width ||
      y >= this.height
    )
      throw Error("Tile outside terrain");
    return y * this.width + x;
  }
  private layer(id: string) {
    const l = this.layers.get(id);
    if (!l) throw Error("Unknown layer " + id);
    return l;
  }
  getTile(layer: string, x: number, y: number) {
    return this.layer(layer)[this.index(x, y)];
  }
  setTile(layer: string, x: number, y: number, id: number) {
    this.paintRect(layer, { x, y, width: 1, height: 1 }, id);
  }
  paintRect(layer: string, r: TerrainRect, id: number) {
    const l = this.layer(layer);
    if (id !== 0 && !this.palette.has(id)) throw Error("Unknown tile ID");
    if (
      ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
      r.width < 1 ||
      r.height < 1
    )
      throw Error("Invalid tile rectangle");
    this.index(r.x, r.y);
    this.index(r.x + r.width - 1, r.y + r.height - 1);
    for (let y = r.y; y < r.y + r.height; y++)
      l.fill(id, y * this.width + r.x, y * this.width + r.x + r.width);
    for (const f of this.listeners) f({ ...r });
  }
  localToTile(x: number, y: number) {
    if (![x, y].every(Number.isFinite)) throw Error("Invalid terrain point");
    const col = Math.floor((x - this.origin[0]) / this.tileSize),
      row = Math.floor((y - this.origin[1]) / this.tileSize);
    return col >= 0 && row >= 0 && col < this.width && row < this.height
      ? { col, row }
      : null;
  }
  tileToLocal(col: number, row: number) {
    this.index(col, row);
    return {
      x: this.origin[0] + (col + 0.5) * this.tileSize,
      y: this.origin[1] + (row + 0.5) * this.tileSize,
    };
  }
  isBlocked(col: number, row: number) {
    const i = this.index(col, row);
    return [...this.layers.values()].some(
      (l) => this.palette.get(l[i])?.blocked === true,
    );
  }
  onChange(f: (r: TerrainRect) => void) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  toJSON(): Terrain2DSpec {
    return {
      schemaVersion: 1,
      dimension: 2,
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      origin: [...this.origin],
      palette: [...this.palette.values()].map((t) => ({
        ...t,
        uv: t.uv ? [...t.uv] : undefined,
      })),
      layers: [...this.layers].map(([id, tiles]) => ({
        id,
        tiles: [...tiles],
      })),
    };
  }
}
/** Visible chunks own graphics commands; atlas and shader material are borrowed. */
export class ZhudaTerrain2DRenderer {
  readonly root: any;
  private chunks = new Map<
    string,
    { node: any; x: number; y: number; dirty: boolean }
  >();
  private unsubscribe: () => void;
  private disposed = false;
  readonly terrain: ZhudaTerrain2D;
  constructor(
    terrain: ZhudaTerrain2D,
    options: {
      parent?: any;
      atlas?: any;
      material?: any;
      chunkCells?: number;
      maxResidentChunks?: number;
    } = {},
  ) {
    this.terrain = terrain;
    this.options = options;
    const c = options.chunkCells ?? 16;
    if (!Number.isInteger(c) || c < 1 || c > 128)
      throw Error("chunkCells must be 1..128");
    if (
      !Number.isInteger(options.maxResidentChunks ?? 128) ||
      (options.maxResidentChunks ?? 128) < 1
    )
      throw Error("Invalid chunk budget");
    if([...terrain.palette.values()].some(tile=>tile.uv)&&!options.atlas)throw Error('Atlas texture required for UV tiles');
    if(options.atlas?.destroyed)throw Error('Atlas texture is destroyed');
    const l = (globalThis as any).Laya;
    this.root = new l.Sprite();
    options.parent?.addChild(this.root);
    this.unsubscribe = terrain.onChange((r) => {
      for (const chunk of this.chunks.values())
        if (
          chunk.x * c < r.x + r.width &&
          (chunk.x + 1) * c > r.x &&
          chunk.y * c < r.y + r.height &&
          (chunk.y + 1) * c > r.y
        )
          chunk.dirty = true;
    });
  }
  readonly options: {
    parent?: any;
    atlas?: any;
    material?: any;
    chunkCells?: number;
    maxResidentChunks?: number;
  };
  setView(r: TerrainRect) {
    if (this.disposed) throw Error("Disposed terrain renderer");
    if (
      !Object.values(r).every(Number.isFinite) ||
      r.width <= 0 ||
      r.height <= 0
    )
      throw Error("Invalid local view");
    const t = this.terrain,
      c = this.options.chunkCells ?? 16,
      size = t.tileSize * c;
    const x0 = Math.max(0, Math.floor((r.x - t.origin[0]) / size)),
      x1 = Math.min(
        Math.ceil(t.width / c) - 1,
        Math.ceil((r.x + r.width - t.origin[0]) / size) - 1,
      ),
      y0 = Math.max(0, Math.floor((r.y - t.origin[1]) / size)),
      y1 = Math.min(
        Math.ceil(t.height / c) - 1,
        Math.ceil((r.y + r.height - t.origin[1]) / size) - 1,
      );
    if (
      Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1) >
      (this.options.maxResidentChunks ?? 128)
    )
      throw Error("Visible terrain exceeds chunk budget");
    const needed = new Set<string>();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) needed.add(x + ":" + y);
    for (const [key, r] of this.chunks)
      if (!needed.has(key)) {
        r.node.destroy(true);
        this.chunks.delete(key);
      }
    const l = (globalThis as any).Laya;
    for (const key of needed)
      if (!this.chunks.has(key)) {
        const [x, y] = key.split(":").map(Number),
          node = new l.Sprite();
        node.pos(t.origin[0] + x * size, t.origin[1] + y * size);
        node.graphics.material = this.options.material || null;
        this.root.addChild(node);
        this.chunks.set(key, { node, x, y, dirty: true });
      }
    this.flush();
  }
  flush() {
    if (this.disposed) throw Error("Disposed terrain renderer");
    const t = this.terrain,
      c = this.options.chunkCells ?? 16;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      const g = chunk.node.graphics;
      g.clear();
      for (const layer of t.layerIds)
        for (
          let y = chunk.y * c;
          y < Math.min(t.height, (chunk.y + 1) * c);
          y++
        )
          for (
            let x = chunk.x * c;
            x < Math.min(t.width, (chunk.x + 1) * c);
            x++
          ) {
            const tile = t.palette.get(t.getTile(layer, x, y));
            if (!tile) continue;
            const px = (x - chunk.x * c) * t.tileSize,
              py = (y - chunk.y * c) * t.tileSize;
            if (tile.uv && this.options.atlas) {
              const [u0, v0, u1, v1] = tile.uv;
              g.drawTexture(
                this.options.atlas,
                px,
                py,
                t.tileSize,
                t.tileSize,
                null,
                1,
                tile.color || "#ffffff",
                null,
                [u0, v0, u1, v0, u1, v1, u0, v1],
              );
            } else
              g.drawRect(
                px,
                py,
                t.tileSize,
                t.tileSize,
                tile.color || "#ffffff",
              );
          }
      chunk.dirty = false;
    }
  }
  get residentChunks() {
    return this.chunks.size;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.root.destroy(true);
    this.chunks.clear();
  }
}
