/**
 * A line round the things that are selected, drawn over the finished
 * picture: the selected renderers are drawn once more into a mask (a
 * skinned or moved mesh is masked as it is drawn), and a pass over the
 * picture draws the line just outside the mask. Where the selected thing is
 * behind something else the line takes another colour, and that part can be
 * filled, so a unit behind a wall is still found.
 *
 * It costs one more draw of each selected renderer and one pass of up to 25
 * reads of the mask a pixel; with nothing selected it copies the picture.
 * The mask is as large as the picture and holds one sample a pixel, so the
 * inner side of the line follows the mesh a pixel coarser than multisampled
 * edges do. A selected thing drawn with a vertex hook (grass in the wind) is
 * masked where it stands still.
 *
 * Only the class needs the Laya runtime; the pulse and the checks are plain.
 */
import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import { zhudaSrgbToLinear } from './Surfaces.ts';

export type ZhudaOutlineColor = readonly [number, number, number];
export interface ZhudaSelectionOutlineOptions {
  /**
   * Colour of the line where the selected thing is seen (default amber): a
   * display colour, as `SurfaceMaterialSpec.color` is, so the line matches an
   * unlit surface of the same colour.
   */
  visibleColor?: ZhudaOutlineColor;
  /**
   * Colour of the line, and of the fill, where it is behind something
   * (default: `visibleColor`). `null`: no line there.
   */
  hiddenColor?: ZhudaOutlineColor | null;
  /** How strong the hidden line is beside the seen one, 0..1 (default 0.6). */
  hiddenStrength?: number;
  /** How much the hidden part is filled with `hiddenColor`, 0..1 (default 0, not at all). */
  hiddenFill?: number;
  /** Width of the line in pixels of the picture, 1..6 (default 2). */
  width?: number;
  /**
   * Tell the hidden parts from the seen ones (default true). It reads the
   * camera's depth texture, which the camera then draws if nothing else
   * asked for it: one more pass over the scene's depth. `false`: one colour,
   * drawn through everything, and no depth texture.
   */
  occlusion?: boolean;
}

const finite = (v: unknown, low: number, high: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const colour = (v: unknown): v is ZhudaOutlineColor =>
  Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, 0, 1));

/** Problems with the options; an empty list means `ZhudaSelectionOutline` takes them. */
export function validateZhudaSelectionOutline(options: unknown): string[] {
  const o = options as ZhudaSelectionOutlineOptions;
  if (!o || typeof o !== 'object') return ['Expected selection outline options'];
  const e: string[] = [];
  if (o.visibleColor !== undefined && !colour(o.visibleColor))
    e.push('visibleColor: three numbers 0..1');
  if (o.hiddenColor !== undefined && o.hiddenColor !== null && !colour(o.hiddenColor))
    e.push('hiddenColor: three numbers 0..1, or null');
  if (o.hiddenStrength !== undefined && !finite(o.hiddenStrength, 0, 1))
    e.push('hiddenStrength: use 0..1');
  if (o.hiddenFill !== undefined && !finite(o.hiddenFill, 0, 1)) e.push('hiddenFill: use 0..1');
  if (o.width !== undefined && !finite(o.width, 1, 6)) e.push('width: 1..6 pixels');
  if (o.occlusion !== undefined && typeof o.occlusion !== 'boolean')
    e.push('occlusion: true or false');
  return e;
}

/**
 * A strength that swells and fades for a line that pulses: 1 at `seconds`
 * 0, down to `low` half a `period` later, and back. Give it the time of the
 * clock the scene runs on; it keeps none of its own.
 */
export function zhudaOutlinePulse(seconds: number, period = 1.2, low = 0.35): number {
  if (!Number.isFinite(seconds)) throw Error('Outline pulse: seconds must be finite');
  if (!finite(period, 0.05, 3600)) throw Error('Outline pulse: period 0.05..3600 seconds');
  if (!finite(low, 0, 1)) throw Error('Outline pulse: low 0..1');
  return low + (1 - low) * (0.5 + 0.5 * Math.cos((seconds / period) * Math.PI * 2));
}

const MASK_VERTEX = `#define SHADER_NAME ZhudaSelectionMaskVS
#include "Math.glsl";
#include "Scene.glsl";
#include "Camera.glsl";
#include "Sprite3DVertex.glsl";
#include "VertexCommon.glsl";
varying float v_ZhudaEye;
void main(){Vertex vertex;getVertexParams(vertex);mat4 world=getWorldMatrix();vec4 p=world*vec4(vertex.positionOS,1.0);vec3 at=p.xyz/p.w;
// How far in front of the eye, whichever way the view space faces.
v_ZhudaEye=abs((u_View*vec4(at,1.0)).z);
gl_Position=remapPositionZ(getPositionCS(at));}`;
// A phone reads a texture at low precision unless it is told otherwise
// (LayaAir asks for high precision in numbers, not in texture reads). Depth
// near 1 then loses the digits that tell one surface from the next, and
// every seen pixel came out hidden on an Adreno 720.
const MASK_FRAGMENT = `#define SHADER_NAME ZhudaSelectionMaskFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
varying float v_ZhudaEye;
void main(){
float seen=1.0;
#ifdef ZHUDA_OUTLINE_OCCLUSION
float raw=texture2D(u_CameraDepthTexture,gl_FragCoord.xy*u_ZhudaOutlineMaskTexel.xy).x;
// The depth of a flat (orthographic) view runs evenly from near to far; a lens's does not.
float near=1.0/u_ZBufferParams.w;float far=u_ZBufferParams.y/u_ZBufferParams.w;
float scene=u_Projection[3][3]>0.5?near+raw*(far-near):1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);
// The selected thing is in that depth itself: a little room for it.
seen=step(v_ZhudaEye,scene*1.004+0.02);
#endif
// Red: seen. Green: behind something.
gl_FragColor=vec4(seen,1.0-seen,0.0,1.0);}`;
const BLIT_VERTEX =
  '#define SHADER_NAME ZhudaSelectionOutlineVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
const LINE_FRAGMENT = `#define SHADER_NAME ZhudaSelectionOutlineFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
void main(){
vec2 uv=v_Texcoord0;
vec4 base=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
base=gammaToLinear(base);
#endif
vec4 here=texture2D(u_ZhudaOutlineMask,uv);
float inside=max(here.r,here.g);
vec2 reach=u_ZhudaOutlineShape.xy*u_ZhudaOutlineShape.z;
float seen=0.0;float hidden=0.0;
// A ring of sixteen at the line's width and eight at half of it, so a thin thing between two reads is still met.
for(int i=0;i<16;i++){float turn=float(i)*0.39269908;vec4 far=texture2D(u_ZhudaOutlineMask,uv+vec2(cos(turn),sin(turn))*reach);seen=max(seen,far.r);hidden=max(hidden,far.g);}
for(int i=0;i<8;i++){float turn=float(i)*0.78539816+0.19634954;vec4 near=texture2D(u_ZhudaOutlineMask,uv+vec2(cos(turn),sin(turn))*reach*0.5);seen=max(seen,near.r);hidden=max(hidden,near.g);}
// Only outside the thing itself; of what is near, how much is seen picks the colour.
float behind=hidden*u_ZhudaOutlineHidden.a;
float line=max(seen,behind)*(1.0-inside);
float share=seen/max(seen+behind,0.0001);
vec3 tone=mix(u_ZhudaOutlineHidden.rgb,u_ZhudaOutlineVisible.rgb,share);
float strength=u_ZhudaOutlineShape.w;
vec3 color=mix(base.rgb,tone,line*strength);
color=mix(color,u_ZhudaOutlineHidden.rgb,here.g*u_ZhudaOutlineVisible.a*strength);
gl_FragColor=vec4(color,base.a);}`;

const OCCLUSION_DEFINE = 'ZHUDA_OUTLINE_OCCLUSION';
const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const mask = l.Shader3D.add('ZhudaSelectionMask', false, false);
  mask.shaderType = l.ShaderFeatureType.D3;
  const maskSub = new l.SubShader(l.SubShader.DefaultAttributeMap, {
    u_ZhudaOutlineMaskTexel: l.ShaderDataType.Vector4,
  });
  mask.addSubShader(maskSub);
  maskSub.addShaderPass(MASK_VERTEX, MASK_FRAGMENT);
  const line = l.Shader3D.add('ZhudaSelectionOutline');
  line.shaderType = l.ShaderFeatureType.PostProcess;
  const lineSub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: l.ShaderDataType.Texture2D,
      u_ZhudaOutlineMask: l.ShaderDataType.Texture2D,
      u_ZhudaOutlineShape: l.ShaderDataType.Vector4,
      u_ZhudaOutlineVisible: l.ShaderDataType.Vector4,
      u_ZhudaOutlineHidden: l.ShaderDataType.Vector4,
    },
  );
  line.addSubShader(lineSub);
  const pass = lineSub.addShaderPass(BLIT_VERTEX, LINE_FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

const AMBER: ZhudaOutlineColor = [1, 0.72, 0.1];

/** The renderers a node and everything under it draws with, in the order they are met. */
function renderersUnder(l: any, node: any, into: Set<any>) {
  if (!node || node.destroyed) return;
  const found =
    typeof node.getComponent === 'function' && l.BaseRender
      ? node.getComponent(l.BaseRender)
      : null;
  const renderer = found ?? node.meshRenderer ?? node.skinnedMeshRenderer;
  if (renderer) into.add(renderer);
  const count = node.numChildren ?? 0;
  for (let i = 0; i < count; i++) renderersUnder(l, node.getChildAt(i), into);
}

export class ZhudaSelectionOutline {
  /**
   * The Laya post-process effect. `ZhudaFilmicPipeline` takes it in
   * `finishEffects`, where the line keeps its colour (before edge smoothing,
   * which then smooths the line too); in `sceneEffects` or a camera's own
   * chain it is graded with the scene.
   */
  readonly effect: any;
  private readonly mask: any;
  private readonly line: any;
  private options: Required<Omit<ZhudaSelectionOutlineOptions, 'hiddenColor'>> & {
    hiddenColor: ZhudaOutlineColor | null;
  };
  private readonly nodes = new Set<any>();
  private strength = 1;
  private disposed = false;

  constructor(options: ZhudaSelectionOutlineOptions = {}) {
    const problems = validateZhudaSelectionOutline(options);
    if (problems.length) throw Error('Selection outline: ' + problems.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect || !l.RenderTexture?.createFromPool || !l.Material)
      throw Error('Selection outline needs the Laya post-process module');
    register(l);
    const visibleColor = options.visibleColor ?? AMBER;
    this.options = {
      visibleColor,
      hiddenColor: options.hiddenColor === undefined ? visibleColor : options.hiddenColor,
      hiddenStrength: options.hiddenStrength ?? 0.6,
      hiddenFill: options.hiddenFill ?? 0,
      width: options.width ?? 2,
      occlusion: options.occlusion ?? true,
    };
    const mask = (this.mask = new l.Material());
    mask.setShaderName('ZhudaSelectionMask');
    mask.cull = l.RenderState.CULL_NONE;
    mask.depthTest = l.RenderState.DEPTHTEST_LEQUAL;
    mask.depthWrite = true;
    mask.blend = l.RenderState.BLEND_DISABLE;
    mask.setVector4('u_ZhudaOutlineMaskTexel', new l.Vector4(1 / 1280, 1 / 720, 0, 0));
    if (this.options.occlusion)
      mask.shaderData.addDefine(l.Shader3D.getDefineByName(OCCLUSION_DEFINE));
    const line = (this.line = new l.Material());
    line.setShaderName('ZhudaSelectionOutline');
    line.setVector4('u_ZhudaOutlineShape', new l.Vector4(1 / 1280, 1 / 720, 2, 1));
    this.colours();
    const maskTexture = l.Shader3D.propertyNameToID('u_ZhudaOutlineMask');
    const owner = this;
    const occlusion = this.options.occlusion;
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      getCameraDepthTextureModeFlag() {
        return occlusion ? l.DepthTextureMode.Depth : l.DepthTextureMode.None;
      }
      render(context: any) {
        const command = context.command,
          source = context.indirectTarget;
        const renderers = owner.renderers();
        if (!renderers.length || owner.strength <= 0) {
          command.blitScreenTriangle(source, context.destination);
          return;
        }
        const target = l.RenderTexture.createFromPool(
          source.width,
          source.height,
          l.RenderTargetFormat.R8G8B8A8,
          l.RenderTargetFormat.DEPTH_16,
          false,
          1,
        );
        target.filterMode = l.FilterMode.Bilinear;
        target.wrapModeU = target.wrapModeV = l.WrapMode.Clamp;
        mask.setVector4(
          'u_ZhudaOutlineMaskTexel',
          new l.Vector4(1 / source.width, 1 / source.height, 0, 0),
        );
        line.setVector4(
          'u_ZhudaOutlineShape',
          new l.Vector4(1 / source.width, 1 / source.height, owner.options.width, owner.strength),
        );
        command.setRenderTarget(target, true, true, new l.Color(0, 0, 0, 0));
        const stamps: { stamp: any; x: number; y: number }[] = [];
        for (const renderer of renderers) {
          const node = renderer._baseRenderNode;
          const parts = node?.renderelements?.length ?? renderer.sharedMaterials?.length ?? 0;
          if (parts && node?.ismoved)
            stamps.push({ stamp: node.ismoved, x: node.ismoved.x, y: node.ismoved.y });
          for (let i = 0; i < parts; i++) command.drawRender(renderer, mask, i);
        }
        // LayaAir 3.4.2 stamps a renderer as moved "now" when a command draws
        // it. A move made before the next frame begins then carries the same
        // stamp, is taken for one already seen, and the scene keeps drawing
        // the thing where it was. Each stamp goes back to when it last moved.
        command.addCustomCMD({
          run() {
            for (const each of stamps) each.stamp.setValue(each.x, each.y);
          },
          recover() {},
        });
        command.setShaderDataTexture(line.shaderData, maskTexture, target);
        command.blitScreenTriangle(
          source,
          context.destination,
          null,
          line.shader,
          line.shaderData,
          0,
        );
        context.deferredReleaseTextures.push(target);
      }
    })();
  }

  private colours() {
    const l = (globalThis as any).Laya;
    const { visibleColor, hiddenColor, hiddenStrength, hiddenFill } = this.options;
    // The chain holds linear colours to its end; the screen's curve comes after it.
    const tone = (c: ZhudaOutlineColor) => c.map((v) => zhudaSrgbToLinear(v));
    const seen = tone(visibleColor);
    const behind = tone(hiddenColor ?? visibleColor);
    // The fill rides in the seen colour's fourth number, the hidden line's strength in the hidden one's.
    this.line.setVector4(
      'u_ZhudaOutlineVisible',
      new l.Vector4(seen[0], seen[1], seen[2], hiddenColor ? hiddenFill : 0),
    );
    this.line.setVector4(
      'u_ZhudaOutlineHidden',
      new l.Vector4(behind[0], behind[1], behind[2], hiddenColor ? hiddenStrength : 0),
    );
  }
  private renderers(): any[] {
    const l = (globalThis as any).Laya;
    const found = new Set<any>();
    for (const node of this.nodes) {
      if (node.destroyed) this.nodes.delete(node);
      else if (node.activeInHierarchy !== false) renderersUnder(l, node, found);
    }
    return [...found].filter((r) => r && !r.destroyed && r.enabled !== false);
  }
  private alive() {
    if (this.disposed) throw Error('Disposed selection outline');
  }

  /** Replaces the selection: each node with everything under it. A destroyed node leaves by itself. */
  select(nodes: readonly any[]): void {
    this.alive();
    if (!Array.isArray(nodes)) throw Error('Selection outline: select takes a list of nodes');
    this.nodes.clear();
    for (const node of nodes) this.add(node);
  }
  add(node: any): void {
    this.alive();
    if (!node || typeof node !== 'object' || node.destroyed)
      throw Error('Selection outline: a live node is expected');
    this.nodes.add(node);
  }
  remove(node: any): void {
    this.alive();
    this.nodes.delete(node);
  }
  clear(): void {
    this.alive();
    this.nodes.clear();
  }
  /** How many nodes are selected. */
  get count(): number {
    return this.nodes.size;
  }
  /** Colours, width and fill; what is left out stays. `occlusion` is fixed when it is made. */
  set(options: Omit<ZhudaSelectionOutlineOptions, 'occlusion'>): void {
    this.alive();
    const problems = validateZhudaSelectionOutline(options);
    if (problems.length) throw Error('Selection outline: ' + problems.join('; '));
    const o = options as ZhudaSelectionOutlineOptions;
    if (o.occlusion !== undefined)
      throw Error('Selection outline: occlusion is fixed when it is made');
    const next = { ...this.options };
    if (options.visibleColor !== undefined) next.visibleColor = options.visibleColor;
    if (options.hiddenColor !== undefined) next.hiddenColor = options.hiddenColor;
    if (options.hiddenStrength !== undefined) next.hiddenStrength = options.hiddenStrength;
    if (options.hiddenFill !== undefined) next.hiddenFill = options.hiddenFill;
    if (options.width !== undefined) next.width = options.width;
    this.options = next;
    this.colours();
  }
  /** 0..1 over the whole line and fill: `zhudaOutlinePulse` gives one that pulses. 0 draws nothing. */
  setStrength(strength: number): void {
    this.alive();
    if (!finite(strength, 0, 1)) throw Error('Selection outline: strength 0..1');
    this.strength = strength;
  }
  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.nodes.clear();
    this.mask.destroy();
    this.line.destroy();
  }
}
