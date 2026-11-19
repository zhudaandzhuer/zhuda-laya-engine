import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import { zhudaToHalfFloats } from './HalfFloat.ts';
/**
 * A colour table from a grading tool (a `.cube` file, as DaVinci Resolve,
 * Photoshop and others write it) applied to the finished picture: the look
 * a colourist made on a still is the look of the game.
 *
 * `parseZhudaCubeLut` reads the text; `ZhudaColorLut` is a post-process
 * effect for `finishEffects` (after tone mapping, on the colours the screen
 * shows, which is what such a table is made for). Two reads of a small
 * texture a pixel. Only the class needs the Laya runtime.
 */

export interface ZhudaCubeLut {
  /** The file's `TITLE`, when it has one. */
  title?: string;
  /** Entries along each edge of the cube. */
  size: number;
  /** The input values the first and the last entry stand for (`DOMAIN_MIN`, `DOMAIN_MAX`). */
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** `size`³ colours, three numbers each, red changing fastest and blue slowest (the file's order). */
  data: Float32Array;
}

/** The largest cube `parseZhudaCubeLut` reads, and the largest `ZhudaColorLut` draws with. */
export const ZHUDA_CUBE_LUT_MAX_SIZE = 256;
export const ZHUDA_COLOR_LUT_MAX_SIZE = 65;

/**
 * Reads a `.cube` file (Adobe Cube LUT 1.0, and the `LUT_3D_INPUT_RANGE`
 * line some tools write instead of a domain). Throws with the line number on
 * anything it does not understand: a one-dimensional table, a missing or
 * repeated size, a wrong number of entries, a number that is not finite.
 */
export function parseZhudaCubeLut(text: string): ZhudaCubeLut {
  if (typeof text !== 'string') throw Error('A .cube file is text');
  let title: string | undefined;
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0],
    domainMax: [number, number, number] = [1, 1, 1];
  let data: Float32Array | undefined;
  let filled = 0;
  const numbers = (parts: string[], count: number, line: number) => {
    if (parts.length !== count) throw Error(`.cube line ${line}: ${count} numbers expected`);
    const values = parts.map(Number);
    if (!values.every(Number.isFinite)) throw Error(`.cube line ${line}: not a number`);
    return values;
  };
  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const content = lines[i].replace(/^\uFEFF/, '').trim();
    if (!content || content.startsWith('#')) continue;
    const parts = content.split(/\s+/);
    const word = parts[0];
    if (/^[A-Za-z_]/.test(word)) {
      if (filled) throw Error(`.cube line ${line}: a keyword after the table began`);
      if (word === 'TITLE') {
        const quoted = content.match(/^TITLE\s+"(.*)"\s*$/);
        title = quoted ? quoted[1] : content.slice(5).trim();
      } else if (word === 'LUT_3D_SIZE') {
        if (size) throw Error(`.cube line ${line}: the size is given twice`);
        const [n] = numbers(parts.slice(1), 1, line);
        if (!Number.isInteger(n) || n < 2 || n > ZHUDA_CUBE_LUT_MAX_SIZE)
          throw Error(`.cube line ${line}: LUT_3D_SIZE 2..${ZHUDA_CUBE_LUT_MAX_SIZE}`);
        size = n;
      } else if (word === 'LUT_1D_SIZE' || word === 'LUT_1D_INPUT_RANGE')
        throw Error(`.cube line ${line}: a one-dimensional table is not a colour cube`);
      else if (word === 'DOMAIN_MIN')
        domainMin = numbers(parts.slice(1), 3, line) as [number, number, number];
      else if (word === 'DOMAIN_MAX')
        domainMax = numbers(parts.slice(1), 3, line) as [number, number, number];
      else if (word === 'LUT_3D_INPUT_RANGE') {
        const [low, high] = numbers(parts.slice(1), 2, line);
        domainMin = [low, low, low];
        domainMax = [high, high, high];
      } else throw Error(`.cube line ${line}: unknown keyword ${word}`);
      continue;
    }
    if (!size) throw Error(`.cube line ${line}: the table begins before LUT_3D_SIZE`);
    data ??= new Float32Array(size * size * size * 3);
    if (filled >= data.length) throw Error(`.cube line ${line}: more entries than ${size}³`);
    data.set(numbers(parts, 3, line), filled);
    filled += 3;
  }
  if (!size) throw Error('.cube: no LUT_3D_SIZE');
  if (!data || filled !== data.length)
    throw Error(`.cube: ${filled / 3} entries, ${size * size * size} expected (${size}³)`);
  for (let k = 0; k < 3; k++)
    if (!(domainMax[k] > domainMin[k])) throw Error('.cube: DOMAIN_MAX must be above DOMAIN_MIN');
  return { ...(title !== undefined ? { title } : {}), size, domainMin, domainMax, data };
}

/** A table that changes nothing, for tests and as a start for a tool. */
export function zhudaIdentityCubeLut(size: number): ZhudaCubeLut {
  if (!Number.isInteger(size) || size < 2 || size > ZHUDA_CUBE_LUT_MAX_SIZE)
    throw Error('Invalid cube size');
  const data = new Float32Array(size * size * size * 3);
  let at = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        data[at++] = r / (size - 1);
        data[at++] = g / (size - 1);
        data[at++] = b / (size - 1);
      }
  return { size, domainMin: [0, 0, 0], domainMax: [1, 1, 1], data };
}

/** Lists what is wrong with a table handed over as data; empty when it is valid. */
export function validateZhudaCubeLut(lut: ZhudaCubeLut): string[] {
  const issues: string[] = [];
  const l = lut as Partial<ZhudaCubeLut> | null | undefined;
  if (!l || typeof l !== 'object') return ['lut: object required'];
  if (
    !Number.isInteger(l.size) ||
    (l.size as number) < 2 ||
    (l.size as number) > ZHUDA_CUBE_LUT_MAX_SIZE
  )
    issues.push(`size: an integer 2..${ZHUDA_CUBE_LUT_MAX_SIZE}`);
  else if (!(l.data instanceof Float32Array) || l.data.length !== (l.size as number) ** 3 * 3)
    issues.push('data: a Float32Array of size³ colours');
  else if (!l.data.every(Number.isFinite)) issues.push('data: finite numbers');
  for (const key of ['domainMin', 'domainMax'] as const) {
    const v = l[key];
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite))
      issues.push(`${key}: three numbers`);
  }
  if (
    !issues.length &&
    !(l.domainMax as number[]).every((v, k) => v > (l.domainMin as number[])[k])
  )
    issues.push('domainMax: above domainMin');
  return issues;
}

/**
 * The colour the table gives for a colour, blended between its eight nearest
 * entries: the shader's arithmetic. Input outside the domain takes the
 * nearest edge.
 */
export function zhudaSampleCubeLut(
  lut: ZhudaCubeLut,
  color: readonly [number, number, number],
): [number, number, number] {
  const n = lut.size;
  const at = color.map((v, k) => {
    const t = (v - lut.domainMin[k]) / (lut.domainMax[k] - lut.domainMin[k]);
    return Math.min(1, Math.max(0, t)) * (n - 1);
  });
  const low = at.map((v) => Math.min(n - 2, Math.floor(v)));
  const part = at.map((v, k) => v - low[k]);
  const out: [number, number, number] = [0, 0, 0];
  for (let corner = 0; corner < 8; corner++) {
    const dr = corner & 1,
      dg = (corner >> 1) & 1,
      db = (corner >> 2) & 1;
    const weight =
      (dr ? part[0] : 1 - part[0]) * (dg ? part[1] : 1 - part[1]) * (db ? part[2] : 1 - part[2]);
    const index = ((low[2] + db) * n * n + (low[1] + dg) * n + (low[0] + dr)) * 3;
    for (let k = 0; k < 3; k++) out[k] += lut.data[index + k] * weight;
  }
  return out;
}

/**
 * How the cube lies in its texture: its blue slices side by side in rows,
 * so that a cube of 65 fits where a single strip would be too wide for a
 * phone.
 */
export function zhudaCubeLutAtlas(size: number): {
  columns: number;
  rows: number;
  width: number;
  height: number;
} {
  const columns = Math.ceil(Math.sqrt(size)),
    rows = Math.ceil(size / columns);
  return { columns, rows, width: columns * size, height: rows * size };
}

const VERTEX =
  '#define SHADER_NAME ZhudaColorLutVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
// u_ZhudaLutShape: entries along an edge, slices in a row of the texture, rows, strength.
const FRAGMENT = `#define SHADER_NAME ZhudaColorLutFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
vec3 zhudaLutSlice(vec2 inSlice,float slice){
float row=floor(slice/u_ZhudaLutShape.y);
vec2 tile=vec2(slice-row*u_ZhudaLutShape.y,row);
return texture2D(u_ZhudaLut,(tile+inSlice)/u_ZhudaLutShape.yz).rgb;}
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
// The chain holds linear colours to its end; the table is made for the colours the screen shows.
vec3 shown=pow(max(source.rgb,vec3(0.0)),vec3(1.0/2.2));
float n=u_ZhudaLutShape.x;
vec3 at=clamp((shown-u_ZhudaLutDomain.xyz)*u_ZhudaLutScale.xyz,0.0,1.0)*(n-1.0);
float slice=min(floor(at.b),n-2.0);
// Half a texel in from the rim of a slice: the filter never reaches the slice beside it.
vec2 inSlice=(at.rg+0.5)/n;
vec3 graded=mix(zhudaLutSlice(inSlice,slice),zhudaLutSlice(inSlice,slice+1.0),at.b-slice);
shown=mix(shown,graded,u_ZhudaLutShape.w);
gl_FragColor=vec4(pow(max(shown,vec3(0.0)),vec3(2.2)),source.a);
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const shader = l.Shader3D.add('ZhudaColorLut');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: l.ShaderDataType.Texture2D,
      u_ZhudaLut: l.ShaderDataType.Texture2D,
      u_ZhudaLutShape: l.ShaderDataType.Vector4,
      u_ZhudaLutDomain: l.ShaderDataType.Vector4,
      u_ZhudaLutScale: l.ShaderDataType.Vector4,
    },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(VERTEX, FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

export interface ZhudaColorLutOptions {
  /** How much of the table's colour is taken, 0..1 (default 1). */
  intensity?: number;
}

export class ZhudaColorLut {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, first. */
  readonly effect: any;
  private readonly material: any;
  private texture: any;
  private intensity: number;
  private disposed = false;

  constructor(lut: ZhudaCubeLut, options: ZhudaColorLutOptions = {}) {
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect)
      throw Error('A colour table needs the Laya post-process module');
    const intensity = options.intensity ?? 1;
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1)
      throw Error('Invalid colour table: intensity: use 0..1');
    this.intensity = intensity;
    register(l);
    this.material = new l.Material();
    this.material.setShaderName('ZhudaColorLut');
    this.effect = new l.MaterialPostProcessEffect();
    this.effect.material = this.material;
    this.upload(lut);
  }

  private upload(lut: ZhudaCubeLut) {
    const issues = validateZhudaCubeLut(lut);
    if (!issues.length && lut.size > ZHUDA_COLOR_LUT_MAX_SIZE)
      issues.push(`size: at most ${ZHUDA_COLOR_LUT_MAX_SIZE} to draw with`);
    if (issues.length) throw Error('Invalid colour table: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    const n = lut.size,
      atlas = zhudaCubeLutAtlas(n);
    const pixels = new Float32Array(atlas.width * atlas.height * 4);
    for (let b = 0; b < n; b++) {
      const left = (b % atlas.columns) * n,
        top = Math.floor(b / atlas.columns) * n;
      for (let g = 0; g < n; g++)
        for (let r = 0; r < n; r++) {
          const from = ((b * n + g) * n + r) * 3,
            to = ((top + g) * atlas.width + left + r) * 4;
          pixels[to] = lut.data[from];
          pixels[to + 1] = lut.data[from + 1];
          pixels[to + 2] = lut.data[from + 2];
          pixels[to + 3] = 1;
        }
    }
    const engine = l.LayaGL.renderEngine,
      capable = l.RenderCapable ?? {};
    // Sixteen-bit floats where the device blends between them; else eight bits, 0..1.
    const half =
      engine.getCapable(capable.TextureFormat_R16G16B16A16) === true &&
      engine.getCapable(capable.Texture_HalfFloatLinearFiltering) === true;
    const texture = new l.Texture2D(
      atlas.width,
      atlas.height,
      half ? l.TextureFormat.R16G16B16A16 : l.TextureFormat.R8G8B8A8,
      false,
      false,
      false,
    );
    texture.filterMode = l.FilterMode.Bilinear;
    // No anisotropic filtering (LayaAir asks for 4x on every WebGL texture). The shader's
    // texture coordinate jumps from one blue slice of the atlas to the next between two
    // neighbouring pixels; anisotropic reads spread along that jump and bring in colours of
    // other slices: dashed lines across smooth gradients and specks on textured ground.
    texture.anisoLevel = 1;
    texture.wrapModeU = texture.wrapModeV = l.WrapMode.Clamp;
    texture.setPixelsData(
      half
        ? zhudaToHalfFloats(pixels)
        : Uint8Array.from(pixels, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)),
      false,
      false,
    );
    this.texture?.destroy();
    this.texture = texture;
    this.material.setTexture('u_ZhudaLut', texture);
    this.material.setVector4(
      'u_ZhudaLutShape',
      new l.Vector4(n, atlas.columns, atlas.rows, this.intensity),
    );
    this.material.setVector4('u_ZhudaLutDomain', new l.Vector4(...lut.domainMin, 0));
    this.material.setVector4(
      'u_ZhudaLutScale',
      new l.Vector4(...lut.domainMax.map((v, k) => 1 / (v - lut.domainMin[k])), 0),
    );
  }

  /** Another table in place (a look that changes with the hour). */
  setLut(lut: ZhudaCubeLut): void {
    if (this.disposed) throw Error('Disposed colour table');
    this.upload(lut);
  }

  /** How much of the table's colour is taken, 0..1; 0 leaves the picture as it is. */
  setIntensity(intensity: number): void {
    if (this.disposed) throw Error('Disposed colour table');
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1)
      throw Error('Invalid colour table: intensity: use 0..1');
    this.intensity = intensity;
    const l = (globalThis as any).Laya;
    const now = this.material.getVector4('u_ZhudaLutShape');
    this.material.setVector4('u_ZhudaLutShape', new l.Vector4(now.x, now.y, now.z, intensity));
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.effect.material = null;
    this.material.destroy();
    this.texture.destroy();
  }
}
