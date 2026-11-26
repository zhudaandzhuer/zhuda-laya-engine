/**
 * Draws a cel-motion figure (see cel-motion.ts) as one skinned mesh per frame: the key
 * pose or baked in-between nearest to the pose is cut into a 16 × 20 grid whose
 * vertices follow the ten joints by inverse-distance weights, so the painted figure
 * bends with its joints between cels. An optional dent pushes the armour in around a
 * contact point (an elliptical falloff, 55 × 29 units) and lets it spring back.
 *
 * Laya-side half of 2d/cel-motion; extracted from 「灰燼之庭」 render.ts (ArmoredSprite).
 */
import { mix, pin, type CelSheet, type Frame, type Point, type Pose } from "./cel-motion.ts";

const NX = 16,
  NY = 20;
function gridIndices(columns: number, rows: number): Uint16Array {
  const result = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x,
        b = a + columns + 1;
      result.push(a, a + 1, b, a + 1, b + 1, b);
    }
  return new Uint16Array(result);
}
const skinIndices = gridIndices(NX, NY);

/**
 * Takes the texture of the node's "Art" image child (loaded by the prefab), hides that
 * image and resets the node's placement, so the node can draw the mesh itself.
 */
export function sourceTexture(sprite: Laya.Sprite): Laya.Texture {
  const art = sprite.getChildByName("Art") as Laya.Image;
  const texture = art?.skin
    ? (Laya.loader.getRes(art.skin) as Laya.Texture)
    : null;
  if (!texture) throw Error("找不到材質 " + sprite.name);
  art.visible = false;
  sprite.pos(0, 0);
  sprite.scale(1, 1);
  sprite.rotation = 0;
  sprite.scrollRect = null;
  return texture;
}

function makeSkin(frame: Frame, tex: Laya.Texture, scale: number) {
  const [left, top, right, bottom] = frame.box;
  const rests = [],
    uvs = [],
    weights = [];
  for (let row = 0; row <= NY; row++)
    for (let col = 0; col <= NX; col++) {
      const x = mix(left, right, col / NX),
        y = mix(top, bottom, row / NY);
      uvs.push(x / tex.width, y / tex.height);
      rests.push((x - frame.origin[0]) * scale, (y - frame.origin[1]) * scale);
      const influence = frame.pins.map(
        (p) => 1 / Math.pow(90 + (x - p[0]) ** 2 + (y - p[1]) ** 2, 1.65)
      );
      const sum = influence.reduce((a, b) => a + b, 0);
      weights.push(...influence.map((value) => value / sum));
    }
  return {
    rest: Float32Array.from(rests),
    uv: Float32Array.from(uvs),
    weights: Float32Array.from(weights),
    texture: tex,
    pins: frame.pins.map(([x, y]) => [
      (x - frame.origin[0]) * scale,
      (y - frame.origin[1]) * scale,
    ]),
  };
}

/** Where a figure stands (its planted foot) and how it is posed. */
export interface CelActor {
  x: number;
  y: number;
  pose: Pose;
}
/** A dent in the armour: centre in world units, `displacement` the current push (springs back to 0). */
export interface CelDent extends Point {
  displacement: number;
}

/**
 * One figure on a Laya sprite node. The node must have an "Art" image child with the
 * key-pose atlas and, for each page of `sheet`, a hidden "Motion<i>" image child with
 * that page (the prefab loads them; this class only reads their textures).
 * `scale` is the figure's draw scale; `celScale` the scale the in-betweens were baked at.
 */
export class CelSprite {
  private readonly originals: ReturnType<typeof makeSkin>[];
  private readonly strips = new Map<string, ReturnType<typeof makeSkin>[]>();
  private readonly offsets: Float32Array;
  private readonly vertices = new Float32Array(2 * (NX + 1) * (NY + 1));
  private node: Laya.Sprite;
  private frames: readonly Frame[];
  private scale: number;
  constructor(
    node: Laya.Sprite,
    frames: readonly Frame[],
    scale: number,
    sheet: CelSheet,
    celScale: number,
    name = node.name
  ) {
    this.node = node;
    this.frames = frames;
    this.scale = scale;
    const texture = sourceTexture(node);
    this.originals = frames.map((f) => makeSkin(f, texture, scale));
    this.offsets = new Float32Array(frames[0].pins.length * 2);
    const pages = sheet.pages.map((_, index) => {
      const image = node.getChildByName("Motion" + index) as Laya.Image;
      const page =
        image?.skin && (Laya.loader.getRes(image.skin) as Laya.Texture);
      if (!page) throw Error("缺少連續圖 " + name + " " + index);
      return page;
    });
    for (const [key, tiles] of Object.entries(sheet.edges)) {
      const [a, b] = key.split("-").map(Number);
      const ready = tiles.map(([page, x, y, w, h, px, py], i) => {
        const t = (i + 1) / (tiles.length + 1);
        const origin = [x + px, y + py] as const;
        const pins = frames[a].pins.map((_, j) => {
          const joint = pin(frames, { a, b, t }, j, celScale);
          return [origin[0] + joint.x, origin[1] + joint.y] as const;
        });
        return makeSkin(
          { box: [x, y, x + w, y + h], origin, pins },
          pages[page],
          scale / celScale
        );
      });
      this.strips.set(key, [this.originals[a], ...ready, this.originals[b]]);
    }
  }
  /** Redraws the figure for this pose; `dent` deforms the armour around a contact. */
  draw(actor: CelActor, dent?: CelDent): void {
    const { a, b, t } = actor.pose;
    const strip = a === b ? undefined : this.strips.get(a + "-" + b);
    const skin = strip
      ? strip[Math.round(t * (strip.length - 1))]
      : this.originals[a];
    const { rest, uv, weights, pins, texture } = skin;
    const joints =
      actor.pose.joints ??
      this.frames[a].pins.map((_, i) =>
        pin(this.frames, actor.pose, i, this.scale)
      );
    for (let i = 0; i < joints.length; i++) {
      this.offsets[i * 2] = joints[i].x - pins[i][0];
      this.offsets[i * 2 + 1] = joints[i].y - pins[i][1];
    }
    const vertices = this.vertices;
    for (let i = 0, k = 0; i < rest.length; i += 2, k += joints.length) {
      let x = rest[i],
        y = rest[i + 1];
      for (let j = 0; j < joints.length; j++) {
        x += weights[k + j] * this.offsets[j * 2];
        y += weights[k + j] * this.offsets[j * 2 + 1];
      }
      if (dent && Math.abs(dent.displacement) > 0.05) {
        const dx = x + actor.x - dent.x,
          dy = y + actor.y - dent.y;
        const falloff = Math.exp(
          -((dx * dx) / (55 * 55) + (dy * dy) / (29 * 29))
        );
        x += dent.displacement * falloff;
        y -= (dent.displacement * 0.22 * falloff * dy) / 30;
      }
      vertices[i] = x;
      vertices[i + 1] = y;
    }
    this.node.graphics.clear();
    this.node.graphics.drawTriangles(
      texture,
      actor.x,
      actor.y,
      vertices,
      uv,
      skinIndices
    );
  }
}
