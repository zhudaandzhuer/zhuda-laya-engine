import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
/**
 * Ambient occlusion by horizons (GTAO, after Jimenez and others, 2016):
 * round each pixel a few slices are cut through the depth picture, the
 * horizon is found on both sides of each, and the part of the sky's light
 * that still reaches the point is worked out exactly for that slice, with
 * the light weighted by the angle it falls at.
 *
 * Against LayaAir's own occlusion (`ScalableAO`):
 * - open, flat ground stays as it is: a plane's horizons lie in the plane,
 *   where the other method's samples darken it a little everywhere;
 * - the darkening in a crease is the share of the sky that the geometry
 *   within the radius hides, not a tuned amount, and the sky itself is
 *   never darkened;
 * - it reads the depth picture only. LayaAir's needs the scene drawn once
 *   more for normals; here the normal is taken from the depth itself.
 *
 * Two passes: the occlusion (full size, or half size for a phone), and one
 * that smooths it over four by four pixels without crossing a depth edge
 * and darkens the scene by it. As any occlusion laid over a finished
 * picture it darkens direct light as well as ambient light: keep it mild in
 * sunlit scenes. Only the class needs the Laya runtime.
 */

export interface ZhudaGroundTruthAOOptions {
  /**
   * How strongly the scene is darkened, 0..4 (default 1): the light that
   * reaches a point, raised to this power. 1 is what the geometry hides.
   */
  intensity?: number;
  /** How far occluders are looked for, in scene units, 0.05..10 (default 0.5). */
  radius?: number;
  /** Slices through each pixel, 1..4 (default 2). */
  slices?: number;
  /** Depth reads to each side of a slice, 2..8 (default 4). */
  steps?: number;
  /** Work the occlusion out at half size (default false): a quarter of the reads, softer contact. */
  halfSize?: boolean;
}

const RANGES: Record<string, readonly [number, number, boolean]> = {
  intensity: [0, 4, false],
  radius: [0.05, 10, false],
  slices: [1, 4, true],
  steps: [2, 8, true],
};

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaGroundTruthAO(options: ZhudaGroundTruthAOOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  for (const [key, [low, high, whole]] of Object.entries(RANGES)) {
    const value = o[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < low ||
      value > high ||
      (whole && !Number.isInteger(value))
    )
      issues.push(`${key}: use ${whole ? 'a whole number ' : ''}${low}..${high}`);
  }
  if (o.halfSize !== undefined && typeof o.halfSize !== 'boolean')
    issues.push('halfSize: use true or false');
  return issues;
}

/**
 * The light that reaches a point through one slice, 0..1, for a sky lit
 * evenly and weighted by the angle it falls at. `low` and `high` are the
 * horizons to each side as angles from the direction to the eye, in radians
 * (-PI/2..0 and 0..PI/2 for an open plane seen head on), and `normal` is
 * the angle of the surface normal in the slice. The shader's arithmetic.
 */
export function zhudaHorizonVisibility(low: number, high: number, normal: number): number {
  const half = Math.PI / 2;
  const h0 = normal + Math.min(Math.max(low - normal, -half), half),
    h1 = normal + Math.min(Math.max(high - normal, -half), half);
  const arc = (h: number) =>
    (Math.cos(normal) + 2 * h * Math.sin(normal) - Math.cos(2 * h - normal)) / 4;
  return arc(h0) + arc(h1);
}

const VERTEX = (name: string) =>
  `#define SHADER_NAME ${name}\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}`;
// u_ZhudaAoView: half the view's width and height at one unit of depth (a
// lens) or as they are (a flat view), then 1 for a flat view, then the far plane.
// u_ZhudaAoShape: radius, power, slices, steps.
// The depth picture is read at high precision: a phone reads textures at low
// precision unless told, and depth near 1 loses what tells surfaces apart.
const DEPTH = `
float zhudaAoDepth(vec2 uv){
float raw=texture2DLodEXT(u_CameraDepthTexture,uv,0.0).x;
float near=1.0/u_ZBufferParams.w;float far=u_ZBufferParams.y/u_ZBufferParams.w;
return u_ZhudaAoView.z>0.5?near+raw*(far-near):1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);}
`;
const OCCLUSION = `#define SHADER_NAME ZhudaGroundTruthAoFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
varying vec2 v_Texcoord0;${DEPTH}
// Where the surface drawn at uv is, in front of the eye: x and y follow the
// picture, z is depth. A depth belongs to the middle of its pixel: read
// anywhere else in the pixel and placed there, a floor seen at a low angle
// would seem to rise and fall by a pixel's worth, and shade itself. (The
// quarter: at half size a pixel's middle is the corner of four depth
// pixels, and the same one of them must be taken every time.)
vec3 zhudaAoPoint(vec2 uv){
uv=(floor(uv/u_ZhudaAoTexel.zw+0.25)+0.5)*u_ZhudaAoTexel.zw;
float z=zhudaAoDepth(uv);vec2 across=(uv*2.0-1.0)*u_ZhudaAoView.xy;return vec3(across*(u_ZhudaAoView.z>0.5?1.0:z),z);}
void main(){
// From the middle of the depth pixel this point is read at: the slices then
// pass through the point itself, also at half size.
vec2 uv=(floor(v_Texcoord0/u_ZhudaAoTexel.zw+0.25)+0.5)*u_ZhudaAoTexel.zw;
vec3 p=zhudaAoPoint(uv);
float radius=u_ZhudaAoShape.x;
// A radius in the picture: how far, in uv, the radius reaches at this depth.
vec2 reach=radius/(2.0*u_ZhudaAoView.xy*(u_ZhudaAoView.z>0.5?1.0:p.z));
vec2 texel=u_ZhudaAoTexel.zw;
// The sky, or a radius smaller than a pixel: nothing to find.
if(p.z>u_ZhudaAoView.w*0.999||max(reach.x/texel.x,reach.y/texel.y)<1.5){gl_FragColor=vec4(vec3(160.0/255.0),1.0);return;}
// The surface normal from the neighbours' depths. Of each pair of neighbours
// the nearer one: it lies on this surface where the other is across an outline.
vec3 px=zhudaAoPoint(uv+vec2(texel.x,0.0))-p;
vec3 nx=p-zhudaAoPoint(uv-vec2(texel.x,0.0));
vec3 py=zhudaAoPoint(uv+vec2(0.0,texel.y))-p;
vec3 ny=p-zhudaAoPoint(uv-vec2(0.0,texel.y));
vec3 dx=abs(px.z)<abs(nx.z)?px:nx;
vec3 dy=abs(py.z)<abs(ny.z)?py:ny;
vec3 n=normalize(cross(dx,dy));
vec3 view=u_ZhudaAoView.z>0.5?vec3(0.0,0.0,-1.0):normalize(-p);
n=dot(n,view)<0.0?-n:n;
// Sixteen turns and sixteen starts, each once in every four by four pixels:
// the second pass averages exactly those.
vec2 cell=mod(floor(gl_FragCoord.xy),4.0);
float index=cell.x+4.0*cell.y;
float turn=mod(index*7.0,16.0)/16.0;
float start=mod(index*5.0+3.0,16.0)/16.0;
float slices=u_ZhudaAoShape.z;
float steps=u_ZhudaAoShape.w;
// Occluders fade out toward the radius, so that nothing pops in at its rim.
float fadeRange=0.615*radius;
float seen=0.0;
for(int s=0;s<4;s++){
if(float(s)>=slices)break;
float angle=(float(s)+turn)/slices*3.14159265;
vec2 along=vec2(cos(angle),sin(angle));
vec3 direction=vec3(along,0.0);
vec3 inPlane=direction-dot(direction,view)*view;
vec3 axis=normalize(cross(inPlane,view));
vec3 projected=n-axis*dot(n,axis);
float projectedLength=length(projected);
float cosNormal=clamp(dot(projected,view)/max(projectedLength,1e-5),0.0,1.0);
float normalAngle=sign(dot(inPlane,projected))*acos(cosNormal);
// The lowest horizons there can be: the surface's own plane.
float lowAhead=cos(normalAngle+1.5707963);
float lowBehind=cos(normalAngle-1.5707963);
float ahead=lowAhead;
float behind=lowBehind;
for(int j=0;j<8;j++){
if(float(j)>=steps)break;
// More reads near the point, where contact is.
float t=(float(j)+start)/steps;
vec2 offset=along*reach*max(t*t,1.5*max(texel.x/reach.x,texel.y/reach.y));
vec3 a=zhudaAoPoint(uv+offset)-p;
vec3 b=zhudaAoPoint(uv-offset)-p;
float la=length(a);
float lb=length(b);
float wa=clamp(1.0+(radius-fadeRange-la)/fadeRange,0.0,1.0);
float wb=clamp(1.0+(radius-fadeRange-lb)/fadeRange,0.0,1.0);
ahead=max(ahead,mix(lowAhead,dot(a/max(la,1e-5),view),wa));
behind=max(behind,mix(lowBehind,dot(b/max(lb,1e-5),view),wb));
}
float h0=normalAngle+clamp(-acos(clamp(behind,-1.0,1.0))-normalAngle,-1.5707963,1.5707963);
float h1=normalAngle+clamp(acos(clamp(ahead,-1.0,1.0))-normalAngle,-1.5707963,1.5707963);
float sinNormal=sin(normalAngle);
seen+=projectedLength*0.25*((cosNormal+2.0*h0*sinNormal-cos(2.0*h0-normalAngle))+(cosNormal+2.0*h1*sinNormal-cos(2.0*h1-normalAngle)));
}
// One slice of an open surface seen at a slant lets in up to 1.57 times the
// light of the whole sky, another less, and only all of them together 1.
// The picture holds 0..1.59, so that the second pass averages them unclipped
// (1 is the whole number 160 of 255: nothing hidden comes back as exactly 1).
gl_FragColor=vec4(vec3(clamp(seen/slices*(160.0/255.0),0.0,1.0)),1.0);
}`;
// u_ZhudaAoTexel: the size of a pixel of the occlusion picture (x, y) and of the depth picture (z, w).
const APPLY = `#define SHADER_NAME ZhudaGroundTruthAoApplyFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
#include "Color.glsl";
varying vec2 v_Texcoord0;${DEPTH}
void main(){
vec2 uv=v_Texcoord0;
vec4 source=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float depth=zhudaAoDepth(uv);
// Four reads between pixels take in four by four pixels of the occlusion.
// Each counts by how close its depth is to this pixel's: a wall's shade does
// not spill onto what stands in front of it.
float total=0.0;
float weight=0.0;
// From the middle of the occlusion pixel this pixel lies in: each read then
// falls on a corner and takes its four pixels evenly.
vec2 middle=(floor(uv/u_ZhudaAoTexel.xy)+0.5)*u_ZhudaAoTexel.xy;
for(int i=0;i<4;i++){
vec2 at=middle+(vec2(float(i-(i/2)*2),float(i/2))*2.0-1.5)*u_ZhudaAoTexel.xy;
float there=zhudaAoDepth((floor(at/u_ZhudaAoTexel.zw+0.25)+0.5)*u_ZhudaAoTexel.zw);
float w=max(0.0,1.0-abs(there-depth)/(0.03*depth+0.01))+1e-4;
total+=w*texture2DLodEXT(u_ZhudaAoPicture,at,0.0).r;
weight+=w;
}
float seen=pow(clamp((255.0/160.0)*total/weight,0.0,1.0),u_ZhudaAoShape.y);
gl_FragColor=vec4(source.rgb*seen,source.a);
}`;

const NAMES = ['ZhudaGroundTruthAo', 'ZhudaGroundTruthAoApply'] as const;
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
        u_ZhudaAoView: l.ShaderDataType.Vector4,
        u_ZhudaAoShape: l.ShaderDataType.Vector4,
        u_ZhudaAoTexel: l.ShaderDataType.Vector4,
        ...uniforms,
      },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(VERTEX(name + 'VS'), fragment);
    pass.statefirst = true;
    pass.renderState.cull = l.RenderState.CULL_NONE;
  };
  add(NAMES[0], OCCLUSION, {});
  add(NAMES[1], APPLY, { u_ZhudaAoPicture: l.ShaderDataType.Texture2D });
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

export class ZhudaGroundTruthAO {
  /**
   * The Laya post-process effect: first in a chain's linear part, before
   * anything is added to the scene's light. `ZhudaFilmicPipeline` puts it
   * there with `aoMethod: 'gtao'`.
   */
  readonly effect: any;
  private readonly materials: any[];
  private readonly values: Required<ZhudaGroundTruthAOOptions>;
  private disposed = false;

  constructor(options: ZhudaGroundTruthAOOptions = {}) {
    const issues = validateZhudaGroundTruthAO(options);
    if (issues.length) throw Error('Invalid ambient occlusion: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect) throw Error('Ambient occlusion needs the Laya post-process module');
    register(l);
    const values = (this.values = {
      intensity: options.intensity ?? 1,
      radius: options.radius ?? 0.5,
      slices: options.slices ?? 2,
      steps: options.steps ?? 4,
      halfSize: options.halfSize ?? false,
    });
    // A material a pass: each program keeps the values it was given.
    const materials = (this.materials = NAMES.map((name) => {
      const material = new l.Material();
      material.setShaderName(name);
      return material;
    }));
    const pictureId = l.Shader3D.propertyNameToID('u_ZhudaAoPicture');
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      getCameraDepthTextureModeFlag() {
        return l.DepthTextureMode.Depth;
      }
      render(context: any) {
        const source = context.indirectTarget,
          command = context.command,
          camera = context.camera;
        camera.depthTextureMode |= l.DepthTextureMode.Depth;
        const depth = camera.depthTexture;
        if (!depth || values.intensity === 0) {
          // The first frame has no depth picture yet: the scene goes through as it is.
          command.blitScreenTriangle(source, context.destination);
          return;
        }
        const scale = values.halfSize ? 2 : 1;
        const width = Math.max(1, Math.ceil(source.width / scale)),
          height = Math.max(1, Math.ceil(source.height / scale));
        const e = camera.projectionMatrix.elements;
        const flat = e[15] > 0.5;
        const view = new l.Vector4(
          1 / Math.abs(e[0]),
          1 / Math.abs(e[5]),
          flat ? 1 : 0,
          camera.farPlane,
        );
        const shape = new l.Vector4(values.radius, values.intensity, values.slices, values.steps);
        const texel = new l.Vector4(1 / width, 1 / height, 1 / depth.width, 1 / depth.height);
        for (const material of materials) {
          material.setVector4('u_ZhudaAoView', view);
          material.setVector4('u_ZhudaAoShape', shape);
          material.setVector4('u_ZhudaAoTexel', texel);
        }
        const picture = l.RenderTexture.createFromPool(
          width,
          height,
          l.RenderTargetFormat.R8G8B8A8,
          l.RenderTargetFormat.None,
          false,
          1,
        );
        // The second pass reads between pixels: four of them in one read.
        picture.filterMode = l.FilterMode.Bilinear;
        picture.wrapModeU = picture.wrapModeV = l.WrapMode.Clamp;
        context.deferredReleaseTextures.push(picture);
        command.blitScreenTriangle(
          source,
          picture,
          null,
          materials[0].shader,
          materials[0].shaderData,
          0,
        );
        command.setShaderDataTexture(materials[1].shaderData, pictureId, picture);
        command.blitScreenTriangle(
          source,
          context.destination,
          null,
          materials[1].shader,
          materials[1].shaderData,
          0,
        );
      }
    })();
  }

  /** New values in place; the same limits as the options. */
  set(options: ZhudaGroundTruthAOOptions): void {
    if (this.disposed) throw Error('Disposed ambient occlusion');
    const issues = validateZhudaGroundTruthAO(options);
    if (issues.length) throw Error('Invalid ambient occlusion: ' + issues.join('; '));
    for (const key of ['intensity', 'radius', 'slices', 'steps', 'halfSize'] as const)
      if (options[key] !== undefined) (this.values as any)[key] = options[key];
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of this.materials) material.destroy();
  }
}
