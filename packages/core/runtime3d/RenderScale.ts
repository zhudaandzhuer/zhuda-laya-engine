/**
 * The 3D picture drawn smaller than the canvas and brought up to it, for
 * devices that cannot fill every pixel: at 0.67 a frame has 45 % of the
 * pixels to light and grade. The 2D interface over it is drawn at the
 * canvas's own size and stays sharp.
 *
 * The scale is LayaAir's own `Config3D.pixelRatio` (every screen camera draws
 * its picture, and every effect of its chain, at that size); picking with
 * `Camera.viewportPointToRay` already takes it into account. Where LayaAir
 * stretches the picture over the canvas, this draws it instead:
 * - `'fsr'` (default): AMD FidelityFX Super Resolution 1 in two passes:
 *   EASU, an upscale that follows edges (12 reads a pixel), then RCAS, a
 *   sharpening that stops short of rings (5 reads), at canvas size;
 * - `'bilinear'`: one pass, RCAS on a plain filtered upscale;
 * - `'plain'`: LayaAir's own filtered stretch, no sharpening.
 * The upscale cannot be an effect inside the camera's chain: LayaAir sizes
 * every picture of the chain to the camera's (smaller) target.
 *
 * `Config3D.pixelRatio` is one value for the whole stage: one render scale
 * at a time. Only the class needs the Laya runtime.
 */
export type ZhudaUpscale = 'fsr' | 'bilinear' | 'plain';

export interface ZhudaRenderScaleOptions {
  /** Size of the 3D picture against the canvas, 0.5..1 (default 1). */
  scale?: number;
  /** How the smaller picture reaches the canvas (default 'fsr'). */
  upscale?: ZhudaUpscale;
  /**
   * Strength of the sharpening, 0..1 (default 0.8): 1 is the most RCAS
   * allows (FSR's 0 stops), 0.5 one stop less, 0 none.
   */
  sharpness?: number;
}

export const ZHUDA_RENDER_SCALE_MIN = 0.5;

/** Checked options with every default filled in. */
export function zhudaRenderScaleOptions(
  options: ZhudaRenderScaleOptions = {},
): Required<ZhudaRenderScaleOptions> {
  const scale = options.scale ?? 1,
    upscale = options.upscale ?? 'fsr',
    sharpness = options.sharpness ?? 0.8;
  if (!(Number.isFinite(scale) && scale >= ZHUDA_RENDER_SCALE_MIN && scale <= 1))
    throw Error('Render scale: use 0.5..1');
  if (upscale !== 'fsr' && upscale !== 'bilinear' && upscale !== 'plain')
    throw Error('Render scale: upscale is fsr, bilinear or plain');
  if (!(Number.isFinite(sharpness) && sharpness >= 0 && sharpness <= 1))
    throw Error('Render scale: sharpness 0..1');
  return { scale, upscale, sharpness };
}

/** The size the 3D picture is drawn at for a canvas of `width` by `height` (LayaAir's rounding). */
export function zhudaRenderScaleSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  return { width: (width * scale) | 0, height: (height * scale) | 0 };
}

// LayaAir's own blit vertex stage (BlitScreen), so the passes place and
// orient the picture exactly as its stretch does.
const VERTEX =
  '#define SHADER_NAME ZhudaUpscaleVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(u_OffsetScale.x*2.0-1.0+(a_PositionTexcoord.x+1.0)*u_OffsetScale.z,(1.0-((u_OffsetScale.y*2.0-1.0+(-a_PositionTexcoord.y+1.0)*u_OffsetScale.w)+1.0)/2.0)*2.0-1.0,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';

// The camera's picture holds light (or display values with Gamma_u_MainTex);
// both passes work on its square root, close to how the eye weighs it,
// which keeps EASU's rings and RCAS's halos down in the dark.
const READ_SOURCE = `vec3 zhudaSource(vec2 uv){vec4 c=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
return sqrt(clamp(c.rgb,0.0,1.0));}`;

/** EASU: 12 texels around the pixel, a Lanczos-2 lobe stretched along the edge they show. */
const EASU = `#define SHADER_NAME ZhudaUpscaleEasuFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
${READ_SOURCE}
vec3 zhudaTexel(vec2 p){return zhudaSource((p+0.5)*u_MainTex_TexelSize.zw);}
float zhudaLuma(vec3 c){return c.r*0.5+c.g+c.b*0.5;}
// One bilinear quarter: the direction of the edge and how clear it is.
vec3 zhudaEdge(float w,float a,float b,float c,float d,float e){
float lenX=max(abs(d-c),abs(c-b));float dirX=d-b;float sx=clamp(abs(dirX)/max(lenX,1.0/65536.0),0.0,1.0);
float lenY=max(abs(e-c),abs(c-a));float dirY=e-a;float sy=clamp(abs(dirY)/max(lenY,1.0/65536.0),0.0,1.0);
return vec3(dirX*w,dirY*w,(sx*sx+sy*sy)*w);}
vec4 zhudaTap(vec2 off,vec2 dir,vec2 len2,float lob,float clp,vec3 c){
vec2 v=vec2(off.x*dir.x+off.y*dir.y,off.y*dir.x-off.x*dir.y)*len2;
float d2=min(dot(v,v),clp);
float wB=0.4*d2-1.0;float wA=lob*d2-1.0;
float w=(1.5625*wB*wB-0.5625)*(wA*wA);
return vec4(c*w,w);}
void main(){
vec2 pp=v_Texcoord0*u_MainTex_TexelSize.xy-0.5;
vec2 fp=floor(pp);vec2 f=pp-fp;
vec3 b=zhudaTexel(fp+vec2(0.0,-1.0));vec3 c=zhudaTexel(fp+vec2(1.0,-1.0));
vec3 e=zhudaTexel(fp+vec2(-1.0,0.0));vec3 f0=zhudaTexel(fp);vec3 g=zhudaTexel(fp+vec2(1.0,0.0));vec3 h=zhudaTexel(fp+vec2(2.0,0.0));
vec3 i=zhudaTexel(fp+vec2(-1.0,1.0));vec3 j=zhudaTexel(fp+vec2(0.0,1.0));vec3 k=zhudaTexel(fp+vec2(1.0,1.0));vec3 l=zhudaTexel(fp+vec2(2.0,1.0));
vec3 n=zhudaTexel(fp+vec2(0.0,2.0));vec3 o=zhudaTexel(fp+vec2(1.0,2.0));
float bL=zhudaLuma(b);float cL=zhudaLuma(c);float eL=zhudaLuma(e);float fL=zhudaLuma(f0);float gL=zhudaLuma(g);float hL=zhudaLuma(h);
float iL=zhudaLuma(i);float jL=zhudaLuma(j);float kL=zhudaLuma(k);float lL=zhudaLuma(l);float nL=zhudaLuma(n);float oL=zhudaLuma(o);
vec3 acc=zhudaEdge((1.0-f.x)*(1.0-f.y),bL,eL,fL,gL,jL)+zhudaEdge(f.x*(1.0-f.y),cL,fL,gL,hL,kL)
+zhudaEdge((1.0-f.x)*f.y,fL,iL,jL,kL,nL)+zhudaEdge(f.x*f.y,gL,jL,kL,lL,oL);
vec2 dir=acc.xy;float dirSq=dot(dir,dir);float level=step(dirSq,1.0/32768.0);
dir=mix(dir*inversesqrt(max(dirSq,1.0/32768.0)),vec2(1.0,0.0),level);
float len=acc.z*0.5;len*=len;
float stretch=dot(dir,dir)/max(abs(dir.x),abs(dir.y));
vec2 len2=vec2(1.0+(stretch-1.0)*len,1.0-0.5*len);
float lob=0.5+(0.25-0.04-0.5)*len;float clp=1.0/lob;
vec4 sum=zhudaTap(vec2(0.0,-1.0)-f,dir,len2,lob,clp,b)+zhudaTap(vec2(1.0,-1.0)-f,dir,len2,lob,clp,c)
+zhudaTap(vec2(-1.0,0.0)-f,dir,len2,lob,clp,e)+zhudaTap(-f,dir,len2,lob,clp,f0)
+zhudaTap(vec2(1.0,0.0)-f,dir,len2,lob,clp,g)+zhudaTap(vec2(2.0,0.0)-f,dir,len2,lob,clp,h)
+zhudaTap(vec2(-1.0,1.0)-f,dir,len2,lob,clp,i)+zhudaTap(vec2(0.0,1.0)-f,dir,len2,lob,clp,j)
+zhudaTap(vec2(1.0,1.0)-f,dir,len2,lob,clp,k)+zhudaTap(vec2(2.0,1.0)-f,dir,len2,lob,clp,l)
+zhudaTap(vec2(0.0,2.0)-f,dir,len2,lob,clp,n)+zhudaTap(vec2(1.0,2.0)-f,dir,len2,lob,clp,o);
vec3 colour=sum.rgb/sum.w;
// No ringing: the result stays between the four nearest texels.
colour=clamp(colour,min(min(f0,g),min(j,k)),max(max(f0,g),max(j,k)));
gl_FragColor=vec4(colour,1.0);
}`;

/**
 * RCAS: the four neighbours pull the pixel apart as far as the darkest and
 * brightest of them allow without leaving 0..1. `easu` reads EASU's picture
 * (already square roots) at canvas size; otherwise the camera's picture,
 * filtered, at the canvas pixel's neighbours.
 */
const rcas = (easu: boolean) => `#define SHADER_NAME ZhudaUpscaleRcasFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
${READ_SOURCE}
vec3 zhudaRead(vec2 uv){${easu ? 'return texture2D(u_MainTex,uv).rgb;' : 'return zhudaSource(uv);'}}
void main(){
vec2 t=u_ZhudaUpscale.xy;
vec3 e=zhudaRead(v_Texcoord0);
vec3 b=zhudaRead(v_Texcoord0+vec2(0.0,-t.y));vec3 d=zhudaRead(v_Texcoord0+vec2(-t.x,0.0));
vec3 f=zhudaRead(v_Texcoord0+vec2(t.x,0.0));vec3 h=zhudaRead(v_Texcoord0+vec2(0.0,t.y));
vec3 lowest=min(min(b,d),min(f,h));vec3 highest=max(max(b,d),max(f,h));
vec3 hitMin=min(lowest,e)/max(4.0*highest,vec3(1.0/65536.0));
vec3 hitMax=(1.0-max(highest,e))/min(4.0*lowest-4.0,vec3(-1.0/65536.0));
vec3 lobeRGB=max(-hitMin,hitMax);
float lobe=max(-0.1875,min(max(lobeRGB.r,max(lobeRGB.g,lobeRGB.b)),0.0))*u_ZhudaUpscale.z;
vec3 colour=clamp((lobe*(b+d+f+h)+e)/(4.0*lobe+1.0),0.0,1.0);
gl_FragColor=outputTransform(vec4(colour*colour,1.0));
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const add = (name: string, fragment: string) => {
    const shader = l.Shader3D.add(name);
    shader.shaderType = l.ShaderFeatureType.PostProcess;
    const sub = new l.SubShader(
      { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
      {
        u_OffsetScale: l.ShaderDataType.Vector4,
        u_MainTex: l.ShaderDataType.Texture2D,
        u_MainTex_TexelSize: l.ShaderDataType.Vector4,
        u_ZhudaUpscale: l.ShaderDataType.Vector4,
      },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(VERTEX, fragment);
    pass.statefirst = true;
    const state = pass.renderState;
    state.depthTest = l.RenderState.DEPTHTEST_ALWAYS;
    state.depthWrite = false;
    state.cull = l.RenderState.CULL_NONE;
    state.blend = l.RenderState.BLEND_DISABLE;
  };
  add('ZhudaUpscaleEasu', EASU);
  add('ZhudaUpscaleRcas', rcas(true));
  add('ZhudaUpscaleBilinear', rcas(false));
  registered.add(l.Shader3D);
}

/** The stage's render scale is held by one of these at a time. */
let active: ZhudaRenderScale | null = null;

export class ZhudaRenderScale {
  private options: Required<ZhudaRenderScaleOptions>;
  private readonly l: any;
  private readonly scene3D: any;
  private readonly previousRatio: number;
  /** The scene's own `blitMainCanvas`, when it had one of its own before this. */
  private readonly ownBlit: PropertyDescriptor | undefined;
  private readonly passes: { easu: any; rcas: any; bilinear: any };
  private readonly data: { easu: any; rcas: any; bilinear: any };
  /** EASU's picture at canvas size, kept from frame to frame. */
  private target: any = null;
  /** Kept from frame to frame: where the passes draw and what they are told. */
  private readonly places: { viewport: any; corner: any; step: any; flip: any; id: number };
  private disposed = false;

  constructor(scene3D: any, options: ZhudaRenderScaleOptions = {}) {
    const l = (this.l = (globalThis as any).Laya);
    this.options = zhudaRenderScaleOptions(options);
    if (!l?.Config3D || !l.BlitFrameBufferCMD || !l.RenderContext3D)
      throw Error('Render scale needs the LayaAir 3D module');
    if (typeof scene3D?.blitMainCanvas !== 'function')
      throw Error('Render scale: needs a LayaAir 3.4.2 Scene3D');
    if (active) throw Error('Render scale: the stage has one already; dispose it first');
    register(l);
    const shader = (name: string) => l.Shader3D.find(name);
    this.passes = {
      easu: shader('ZhudaUpscaleEasu'),
      rcas: shader('ZhudaUpscaleRcas'),
      bilinear: shader('ZhudaUpscaleBilinear'),
    };
    const make = () => l.LayaGL.renderDeviceFactory.createShaderData(null);
    this.data = { easu: make(), rcas: make(), bilinear: make() };
    // Every declared uniform is written: an unset one reads stale bytes.
    for (const data of Object.values(this.data))
      data.setVector(l.Shader3D.propertyNameToID('u_ZhudaUpscale'), new l.Vector4(0, 0, 0, 0));
    this.places = {
      viewport: new l.Viewport(0, 0, 1, 1),
      corner: new l.Viewport(0, 0, 1, 1),
      step: new l.Vector4(),
      flip: new l.Vector4(0, 1, 1, -1),
      id: l.Shader3D.propertyNameToID('u_ZhudaUpscale'),
    };
    this.scene3D = scene3D;
    this.previousRatio = l.Config3D.pixelRatio;
    this.ownBlit = Object.getOwnPropertyDescriptor(scene3D, 'blitMainCanvas');
    const native = scene3D.blitMainCanvas;
    scene3D.blitMainCanvas = (source: any, viewport: any, camera: any) =>
      this.blit(native, source, viewport, camera);
    active = this;
    this.apply();
  }

  get scale(): number {
    return this.options.scale;
  }

  get upscale(): ZhudaUpscale {
    return this.options.upscale;
  }

  get sharpness(): number {
    return this.options.sharpness;
  }

  /** Changes the scale (and, when given, the upscale and sharpness) from the next frame. */
  set(options: ZhudaRenderScaleOptions): void {
    if (this.disposed) throw Error('Disposed render scale');
    this.options = zhudaRenderScaleOptions({ ...this.options, ...options });
    this.apply();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.l.Config3D.pixelRatio = this.previousRatio;
    Reflect.deleteProperty(this.scene3D, 'blitMainCanvas');
    if (this.ownBlit) Object.defineProperty(this.scene3D, 'blitMainCanvas', this.ownBlit);
    this.target?.destroy();
    this.target = null;
    for (const data of Object.values(this.data)) data.destroy?.();
    if (active === this) active = null;
  }

  private apply(): void {
    this.l.Config3D.pixelRatio = this.options.scale;
    if (this.options.scale === 1 || this.options.upscale !== 'fsr') {
      this.target?.destroy();
      this.target = null;
    }
  }

  /** In place of LayaAir's `Scene3D.blitMainCanvas`, for each camera drawn to the canvas. */
  private blit(native: any, source: any, normalized: any, camera: any): void {
    const l = this.l;
    const { scale, upscale, sharpness } = this.options;
    // At full size, without an upscale, or with LayaAir's own edge smoothing: its stretch.
    if (!source || scale === 1 || upscale === 'plain' || camera?.fxaa)
      return native.call(this.scene3D, source, normalized, camera);
    const width = l.RenderContext3D.clientWidth,
      height = l.RenderContext3D.clientHeight;
    const { viewport, corner, step } = this.places;
    viewport.x = (width * normalized.x) | 0;
    viewport.y = (height * normalized.y) | 0;
    viewport.width = (width * normalized.width) | 0;
    viewport.height = (height * normalized.height) | 0;
    if (viewport.width < 1 || viewport.height < 1) return;
    source.filterMode = l.FilterMode.Bilinear;
    step.setValue(1 / viewport.width, 1 / viewport.height, sharpness, 0);
    const run = (from: any, to: any, at: any, offsetScale: any, shader: any, data: any) => {
      data.setVector(this.places.id, step);
      const command = l.BlitFrameBufferCMD.create(from, to, at, offsetScale, shader, data, 0);
      command.run();
      command.recover();
    };
    if (upscale === 'bilinear')
      run(source, null, viewport, null, this.passes.bilinear, this.data.bilinear);
    else {
      if (
        !this.target ||
        this.target.width !== viewport.width ||
        this.target.height !== viewport.height
      ) {
        this.target?.destroy();
        // Eight bits hold the square roots well enough; nothing depth or multisampled.
        this.target = new l.RenderTexture(
          viewport.width,
          viewport.height,
          l.RenderTargetFormat.R8G8B8A8,
          l.RenderTargetFormat.None,
          false,
          1,
        );
        this.target.filterMode = l.FilterMode.Point;
        this.target.wrapModeU = this.target.wrapModeV = l.WrapMode.Clamp;
      }
      // LayaAir's blit is made for the canvas. On WebGL it places a viewport
      // from the bottom: the target is filled from its corner. On WebGPU the
      // canvas is upside down against a target: drawn into one the picture is
      // turned over, so that the second pass turns it back.
      const flipped = !!l.LayaGL.renderEngine._screenInvertY;
      corner.x = 0;
      corner.y = flipped ? 0 : height - viewport.height;
      corner.width = viewport.width;
      corner.height = viewport.height;
      run(
        source,
        this.target,
        corner,
        flipped ? this.places.flip : null,
        this.passes.easu,
        this.data.easu,
      );
      run(this.target, null, viewport, null, this.passes.rcas, this.data.rcas);
    }
    // As LayaAir's stretch leaves it: the 2D layer does not clear what was drawn.
    if (l.RenderTexture2D) l.RenderTexture2D._clear = false;
  }
}
