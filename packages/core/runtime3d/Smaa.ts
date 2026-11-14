import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import {
  ZHUDA_SMAA_AREA_SIZE,
  ZHUDA_SMAA_SEARCH_SIZE,
  zhudaSmaaAreaTable,
  zhudaSmaaSearchTable,
} from './SmaaTables.ts';
/**
 * Edge smoothing that finds the shape of each edge (SMAA 1x): where the
 * picture steps, it follows the step to both ends, works out how much of
 * each pixel the true edge would have covered, and mixes each pixel with
 * its neighbour by that much. A slanted line comes out as a ramp of the
 * right length, where `ZhudaEdgeSmoothing` (FXAA) only blurs along it; flat
 * areas and texture inside a surface are left exactly as they were.
 *
 * Three passes over the picture and two pictures of its size, eight bits a
 * channel, for the frame. It runs after tone mapping (`finishEffects`): an
 * edge is judged as the eye sees it and mixed as light. It cannot recover a
 * line thinner than a pixel, and it does not look for diagonal patterns
 * (one of the reference's "high" and "ultra" extras): edges near 30 and 60
 * degrees keep more of their steps than level and upright ones.
 *
 * The method is SMAA 2.8 by Jimenez, Echevarria, Masia, Navarro and
 * Gutierrez (MIT); the passes follow the WebGL port in three.js 0.187.0
 * (MIT) and the two lookup tables are theirs: `vendor/threejs-post/README.md`.
 * Only the class needs the Laya runtime.
 */

export type ZhudaSmaaQuality = 'low' | 'medium' | 'high' | 'ultra';
/**
 * What each quality stands for: the step in brightness that counts as an
 * edge (on a curve close to the screen's, 0..1), and how far an edge is
 * followed to each side, in steps of two pixels.
 */
export const ZHUDA_SMAA_QUALITIES: Record<ZhudaSmaaQuality, { threshold: number; steps: number }> =
  {
    low: { threshold: 0.15, steps: 4 },
    medium: { threshold: 0.1, steps: 8 },
    high: { threshold: 0.1, steps: 16 },
    ultra: { threshold: 0.05, steps: 32 },
  };

export interface ZhudaSmaaOptions {
  /** Default `high`: an edge is followed 32 pixels to each side. */
  quality?: ZhudaSmaaQuality;
  /**
   * How much a sharp corner (of a box, a window, a panel) is rounded, 0..1
   * (default 0). A level or upright edge that ends in a corner looks to the
   * method like the last step of a slanted line: at 0 such an edge is left
   * as it is, at 1 it is smoothed like any step, a faint ramp along the
   * edge as far as an edge is followed. The reference uses 0.25. Slanted
   * edges come out the same at any value.
   */
  cornerRounding?: number;
}

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaSmaa(options: ZhudaSmaaOptions): string[] {
  const o = (options ?? {}) as Record<string, unknown>;
  const issues: string[] = [];
  if (o.quality !== undefined && !Object.hasOwn(ZHUDA_SMAA_QUALITIES, String(o.quality)))
    issues.push('quality: use low, medium, high or ultra');
  const rounding = o.cornerRounding;
  if (
    rounding !== undefined &&
    (typeof rounding !== 'number' || !Number.isFinite(rounding) || rounding < 0 || rounding > 1)
  )
    issues.push('cornerRounding: use 0..1');
  return issues;
}

const VERTEX = (name: string) =>
  `#define SHADER_NAME ${name}\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}`;
// u_ZhudaSmaaTexel: the size of a pixel (x, y), the edge threshold, the search steps.
// u_ZhudaSmaaShape.x: how much of a corner's weights is taken back (1 less the rounding).
// Every read names its level: the passes branch on what they read.
// "Above" is toward v = 0 throughout, as in the reference. Whether that is
// the top of the screen does not matter: the method is the same in a mirror.
const EDGES = `#define SHADER_NAME ZhudaSmaaEdgesFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
// Edges are judged on a curve close to the screen's, as the eye sees them.
vec3 zhudaSmaaShown(vec2 uv){vec4 c=texture2DLodEXT(u_MainTex,uv,0.0);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
return sqrt(clamp(c.rgb,0.0,1.0));}
float zhudaSmaaStep(vec3 a,vec3 b){vec3 t=abs(a-b);return max(max(t.r,t.g),t.b);}
void main(){
vec2 uv=v_Texcoord0;
vec2 px=u_ZhudaSmaaTexel.xy;
vec3 here=zhudaSmaaShown(uv);
vec4 delta;
delta.x=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(-1.0,0.0)));
delta.y=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(0.0,-1.0)));
vec2 edges=step(vec2(u_ZhudaSmaaTexel.z),delta.xy);
if(edges.x+edges.y==0.0){gl_FragColor=vec4(0.0);return;}
// A step is not an edge beside one twice as strong: the stronger one is.
delta.z=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(1.0,0.0)));
delta.w=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(0.0,1.0)));
float strongest=max(max(max(delta.x,delta.y),delta.z),delta.w);
delta.z=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(-2.0,0.0)));
delta.w=zhudaSmaaStep(here,zhudaSmaaShown(uv+px*vec2(0.0,-2.0)));
strongest=max(max(strongest,delta.z),delta.w);
edges*=step(0.5*strongest,delta.xy);
gl_FragColor=vec4(edges,0.0,0.0);
}`;
const WEIGHTS = `#define SHADER_NAME ZhudaSmaaWeightsFS
varying vec2 v_Texcoord0;
vec2 zhudaSmaaEdge(vec2 uv){return texture2DLodEXT(u_MainTex,uv,0.0).rg;}
// How far into the last read of a search the edge went: 0, 1 or 2 pixels.
float zhudaSmaaSearchLength(vec2 e,float bias){
e.r=bias+e.r*0.5;
return 255.0*texture2DLodEXT(u_ZhudaSmaaSearch,e,0.0).r;}
// Each search reads between four edges at a time and stops where the edge
// ends or is crossed.
float zhudaSmaaLeft(vec2 at,float end){
vec2 px=u_ZhudaSmaaTexel.xy;
vec2 e=vec2(0.0,1.0);
for(int i=0;i<32;i++){
if(float(i)>=u_ZhudaSmaaTexel.w)break;
e=zhudaSmaaEdge(at);
at.x-=2.0*px.x;
if(!(at.x>end&&e.g>0.8281&&e.r==0.0))break;
}
return at.x+px.x*(3.25-zhudaSmaaSearchLength(e,0.0));}
float zhudaSmaaRight(vec2 at,float end){
vec2 px=u_ZhudaSmaaTexel.xy;
vec2 e=vec2(0.0,1.0);
for(int i=0;i<32;i++){
if(float(i)>=u_ZhudaSmaaTexel.w)break;
e=zhudaSmaaEdge(at);
at.x+=2.0*px.x;
if(!(at.x<end&&e.g>0.8281&&e.r==0.0))break;
}
return at.x-px.x*(3.25-zhudaSmaaSearchLength(e,0.5));}
float zhudaSmaaUp(vec2 at,float end){
vec2 px=u_ZhudaSmaaTexel.xy;
vec2 e=vec2(1.0,0.0);
for(int i=0;i<32;i++){
if(float(i)>=u_ZhudaSmaaTexel.w)break;
e=zhudaSmaaEdge(at);
at.y-=2.0*px.y;
if(!(at.y>end&&e.r>0.8281&&e.g==0.0))break;
}
return at.y+px.y*(3.25-zhudaSmaaSearchLength(e.gr,0.0));}
float zhudaSmaaDown(vec2 at,float end){
vec2 px=u_ZhudaSmaaTexel.xy;
vec2 e=vec2(1.0,0.0);
for(int i=0;i<32;i++){
if(float(i)>=u_ZhudaSmaaTexel.w)break;
e=zhudaSmaaEdge(at);
at.y+=2.0*px.y;
if(!(at.y<end&&e.r>0.8281&&e.g==0.0))break;
}
return at.y-px.y*(3.25-zhudaSmaaSearchLength(e.gr,0.5));}
// The share of the two pixels beside the edge that the true edge covers,
// from how far it runs to each side and how it is crossed at each end.
vec2 zhudaSmaaArea(vec2 distance,float e1,float e2){
vec2 at=16.0*floor(4.0*vec2(e1,e2)+0.5)+distance;
return texture2DLodEXT(u_ZhudaSmaaArea,(at+0.5)/${ZHUDA_SMAA_AREA_SIZE}.0,0.0).rg;}
// A long straight edge that turns a corner is not a step: where the far side
// of the corner is an edge too, the weights are taken back, most at the corner.
vec2 zhudaSmaaCorner(vec2 d){vec2 nearer=step(d.xy,d.yx);return u_ZhudaSmaaShape.x*nearer/(nearer.x+nearer.y);}
void main(){
vec2 uv=v_Texcoord0;
vec2 px=u_ZhudaSmaaTexel.xy;
vec2 pixel=uv/px;
// A quarter and an eighth of a pixel off centre: one read then tells four edges apart.
vec4 o0=uv.xyxy+px.xyxy*vec4(-0.25,-0.125,1.25,-0.125);
vec4 o1=uv.xyxy+px.xyxy*vec4(-0.125,-0.25,-0.125,1.25);
vec4 o2=vec4(o0.xz,o1.yw)+vec4(-2.0,2.0,-2.0,2.0)*px.xxyy*u_ZhudaSmaaTexel.w;
vec4 weights=vec4(0.0);
vec2 e=zhudaSmaaEdge(uv);
if(e.g>0.0){
// An edge above this pixel: how far it runs to the left and right, and what crosses it at each end.
float left=zhudaSmaaLeft(o0.xy,o2.x);
float e1=zhudaSmaaEdge(vec2(left,o1.y)).r;
float right=zhudaSmaaRight(o0.zw,o2.y);
vec2 d=abs(floor(vec2(left,right)/px.x-pixel.x+0.5));
float e2=zhudaSmaaEdge(vec2(right+px.x,o1.y)).r;
weights.rg=zhudaSmaaArea(sqrt(d),e1,e2);
vec2 rounding=zhudaSmaaCorner(d);
vec2 keep=vec2(1.0);
keep.x-=rounding.x*zhudaSmaaEdge(vec2(left,uv.y)+px*vec2(0.0,1.0)).r;
keep.x-=rounding.y*zhudaSmaaEdge(vec2(right,uv.y)+px*vec2(1.0,1.0)).r;
keep.y-=rounding.x*zhudaSmaaEdge(vec2(left,uv.y)+px*vec2(0.0,-2.0)).r;
keep.y-=rounding.y*zhudaSmaaEdge(vec2(right,uv.y)+px*vec2(1.0,-2.0)).r;
weights.rg*=clamp(keep,0.0,1.0);
}
if(e.r>0.0){
// An edge to the left of this pixel: the same up and down.
float up=zhudaSmaaUp(o1.xy,o2.z);
float e1=zhudaSmaaEdge(vec2(o0.x,up)).g;
float down=zhudaSmaaDown(o1.zw,o2.w);
vec2 d=abs(floor(vec2(up,down)/px.y-pixel.y+0.5));
float e2=zhudaSmaaEdge(vec2(o0.x,down+px.y)).g;
weights.ba=zhudaSmaaArea(sqrt(d),e1,e2);
vec2 rounding=zhudaSmaaCorner(d);
vec2 keep=vec2(1.0);
keep.x-=rounding.x*zhudaSmaaEdge(vec2(uv.x,up)+px*vec2(1.0,0.0)).g;
keep.x-=rounding.y*zhudaSmaaEdge(vec2(uv.x,down)+px*vec2(1.0,1.0)).g;
keep.y-=rounding.x*zhudaSmaaEdge(vec2(uv.x,up)+px*vec2(-2.0,0.0)).g;
keep.y-=rounding.y*zhudaSmaaEdge(vec2(uv.x,down)+px*vec2(-2.0,1.0)).g;
weights.ba*=clamp(keep,0.0,1.0);
}
gl_FragColor=weights;
}`;
const BLEND = `#define SHADER_NAME ZhudaSmaaBlendFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
vec4 zhudaSmaaSource(vec2 uv){vec4 c=texture2DLodEXT(u_MainTex,uv,0.0);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
return c;}
void main(){
vec2 uv=v_Texcoord0;
vec2 px=u_ZhudaSmaaTexel.xy;
// How much of each neighbour this pixel takes: of the one to the right and
// the one below from their own weights, of the one to the left and above from this pixel's.
vec4 own=texture2DLodEXT(u_ZhudaSmaaWeights,uv,0.0);
vec4 a=vec4(texture2DLodEXT(u_ZhudaSmaaWeights,uv+vec2(px.x,0.0),0.0).a,texture2DLodEXT(u_ZhudaSmaaWeights,uv+vec2(0.0,px.y),0.0).g,own.b,own.r);
vec4 here=zhudaSmaaSource(uv);
if(a.x+a.y+a.z+a.w<1e-5){gl_FragColor=here;return;}
// Sideways or up and down, whichever is the stronger.
bool sideways=max(a.x,a.z)>max(a.y,a.w);
vec2 amount=sideways?a.xz:a.yw;
vec2 toward=sideways?vec2(px.x,0.0):vec2(0.0,px.y);
vec2 share=amount/(amount.x+amount.y);
// The chain holds light, not screen values: the pixels are mixed as light.
gl_FragColor=share.x*mix(here,zhudaSmaaSource(uv+toward),amount.x)+share.y*mix(here,zhudaSmaaSource(uv-toward),amount.y);
}`;

const NAMES = ['ZhudaSmaaEdges', 'ZhudaSmaaWeights', 'ZhudaSmaaBlend'] as const;
const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const add = (name: string, fragment: string, uniforms: Record<string, unknown>) => {
    const shader = l.Shader3D.add(name);
    shader.shaderType = l.ShaderFeatureType.PostProcess;
    const sub = new l.SubShader(
      { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
      {
        u_MainTex: l.ShaderDataType.Texture2D,
        u_ZhudaSmaaTexel: l.ShaderDataType.Vector4,
        ...uniforms,
      },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(VERTEX(name + 'VS'), fragment);
    pass.statefirst = true;
    pass.renderState.cull = l.RenderState.CULL_NONE;
  };
  add(NAMES[0], EDGES, {});
  add(NAMES[1], WEIGHTS, {
    u_ZhudaSmaaShape: l.ShaderDataType.Vector4,
    u_ZhudaSmaaArea: l.ShaderDataType.Texture2D,
    u_ZhudaSmaaSearch: l.ShaderDataType.Texture2D,
  });
  add(NAMES[2], BLEND, { u_ZhudaSmaaWeights: l.ShaderDataType.Texture2D });
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

export class ZhudaSmaa {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, before the lens finish. */
  readonly effect: any;
  private readonly materials: any[];
  private readonly tables: any[];
  private quality: ZhudaSmaaQuality;
  private disposed = false;
  private shape(rounding: number) {
    const l = (globalThis as any).Laya;
    this.materials[1].setVector4('u_ZhudaSmaaShape', new l.Vector4(1 - rounding, 0, 0, 0));
  }

  constructor(options: ZhudaSmaaOptions = {}) {
    const issues = validateZhudaSmaa(options);
    if (issues.length) throw Error('Invalid edge smoothing: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect) throw Error('Edge smoothing needs the Laya post-process module');
    register(l);
    this.quality = options.quality ?? 'high';
    const table = (
      width: number,
      height: number,
      bytes: Uint8Array,
      channels: number,
      filter: any,
    ) => {
      const pixels = new Uint8Array(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        pixels[i * 4] = bytes[i * channels];
        pixels[i * 4 + 1] = channels > 1 ? bytes[i * channels + 1] : 0;
        pixels[i * 4 + 3] = 255;
      }
      const texture = new l.Texture2D(width, height, l.TextureFormat.R8G8B8A8, false, false, false);
      texture.filterMode = filter;
      texture.wrapModeU = texture.wrapModeV = l.WrapMode.Clamp;
      texture.setPixelsData(pixels, false, false);
      return texture;
    };
    const area = table(
        ZHUDA_SMAA_AREA_SIZE,
        ZHUDA_SMAA_AREA_SIZE,
        zhudaSmaaAreaTable(),
        2,
        l.FilterMode.Bilinear,
      ),
      search = table(
        ZHUDA_SMAA_SEARCH_SIZE[0],
        ZHUDA_SMAA_SEARCH_SIZE[1],
        zhudaSmaaSearchTable(),
        1,
        l.FilterMode.Point,
      );
    this.tables = [area, search];
    // A material a pass: each program keeps the values it was given.
    const materials = (this.materials = NAMES.map((name) => {
      const material = new l.Material();
      material.setShaderName(name);
      return material;
    }));
    this.shape(options.cornerRounding ?? 0);
    materials[1].setTexture('u_ZhudaSmaaArea', area);
    materials[1].setTexture('u_ZhudaSmaaSearch', search);
    const weightsId = l.Shader3D.propertyNameToID('u_ZhudaSmaaWeights');
    const owner = this;
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      render(context: any) {
        const source = context.indirectTarget,
          command = context.command;
        const { threshold, steps } = ZHUDA_SMAA_QUALITIES[owner.quality];
        const texel = new l.Vector4(1 / source.width, 1 / source.height, threshold, steps);
        for (const material of materials) material.setVector4('u_ZhudaSmaaTexel', texel);
        const picture = () => {
          const target = l.RenderTexture.createFromPool(
            source.width,
            source.height,
            l.RenderTargetFormat.R8G8B8A8,
            l.RenderTargetFormat.None,
            false,
            1,
          );
          // The searches read between pixels: four edges in one read.
          target.filterMode = l.FilterMode.Bilinear;
          target.wrapModeU = target.wrapModeV = l.WrapMode.Clamp;
          context.deferredReleaseTextures.push(target);
          return target;
        };
        const edges = picture(),
          weights = picture();
        const blit = (from: any, to: any, material: any) =>
          command.blitScreenTriangle(from, to, null, material.shader, material.shaderData, 0);
        blit(source, edges, materials[0]);
        blit(edges, weights, materials[1]);
        command.setShaderDataTexture(materials[2].shaderData, weightsId, weights);
        blit(source, context.destination, materials[2]);
      }
    })();
  }

  /** Another quality or corner rounding in place. */
  set(options: ZhudaSmaaOptions): void {
    if (this.disposed) throw Error('Disposed edge smoothing');
    const issues = validateZhudaSmaa(options);
    if (issues.length) throw Error('Invalid edge smoothing: ' + issues.join('; '));
    if (options.quality !== undefined) this.quality = options.quality;
    if (options.cornerRounding !== undefined) this.shape(options.cornerRounding);
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of this.materials) material.destroy();
    for (const texture of this.tables) texture.destroy();
  }
}
