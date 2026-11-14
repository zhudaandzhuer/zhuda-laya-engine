import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
/**
 * The curve that turns the light of a scene into the colours of a screen.
 * LayaAir 3.4.2 has one, ACES; this adds AgX and the Khronos PBR Neutral
 * curve, and "none".
 *
 * A curve costs no pass of its own. LayaAir's colour grade looks every pixel
 * up in a small table it draws once (contrast, saturation, white balance and
 * the rest), in one pass over the picture; with one of these curves that
 * pass is this module's, and works the curve out for each pixel after the
 * table. The table then holds the graded light in the encoding it is looked
 * up by, so a grade that changes nothing changes nothing: LayaAir's own
 * table holds plain light and is up to 1.2 % off between its entries.
 *
 * The constants of both curves are those of three.js 0.187.0 (MIT), which
 * took AgX from Filament and Blender and Neutral from Khronos:
 * `vendor/threejs-post/README.md`. The functions here are the shader's
 * arithmetic on the CPU, for tests and tools. Only `applyZhudaToneCurve`
 * needs the Laya runtime.
 */

/**
 * `aces`: LayaAir's filmic curve, strong contrast, bright colours lose
 * saturation late and shift hue (a bright red turns orange).
 * `agx`: bright colours fade to white without changing hue; softer contrast.
 * `neutral`: colours below 0.76 come out as they went in (a product shot, a
 * material that must match its swatch); only what is brighter is rolled off.
 * `none`: no curve; what is brighter than white is cut off.
 */
export type ZhudaToneMapping = 'aces' | 'agx' | 'neutral' | 'none';
export const ZHUDA_TONE_MAPPINGS: readonly ZhudaToneMapping[] = ['aces', 'agx', 'neutral', 'none'];

type Rgb = readonly [number, number, number];
// Column vectors, as GLSL's mat3(vec3, vec3, vec3).
const TO_REC2020: readonly Rgb[] = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const FROM_REC2020: readonly Rgb[] = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const AGX_INSET: readonly Rgb[] = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const AGX_OUTSET: readonly Rgb[] = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const AGX_MIN_EV = -12.47393,
  AGX_MAX_EV = 4.026069;
const times = (m: readonly Rgb[], v: Rgb): [number, number, number] => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The AgX contrast curve on a value 0..1 (a share of the 16.5 stops the curve holds). */
export function zhudaAgxContrast(x: number): number {
  const x2 = x * x,
    x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
}

/**
 * AgX on a scene-linear colour (after exposure): linear colour for the
 * screen, 0..1. Middle grey 0.18 comes out as 0.18 of the screen's light
 * within a percent or two; 16.3 and above is white.
 */
export function zhudaAgxToneMap(color: Rgb): [number, number, number] {
  const inset = times(AGX_INSET, times(TO_REC2020, color));
  const curved = inset.map((v) =>
    zhudaAgxContrast(
      clamp01((Math.log2(Math.max(v, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV)),
    ),
  ) as [number, number, number];
  const linear = times(AGX_OUTSET, curved).map((v) => Math.pow(Math.max(0, v), 2.2)) as [
    number,
    number,
    number,
  ];
  return times(FROM_REC2020, linear).map(clamp01) as [number, number, number];
}

/**
 * The Khronos PBR Neutral curve on a scene-linear colour (after exposure).
 * A colour whose brightest channel is below 0.76 keeps its value but for a
 * small lift taken off the darkest channel (0.04 at most); above it the
 * brightness is rolled off toward 1 and the colour toward white.
 */
export function zhudaNeutralToneMap(color: Rgb): [number, number, number] {
  const start = 0.8 - 0.04,
    desaturation = 0.15;
  const low = Math.min(color[0], color[1], color[2]);
  const offset = low < 0.08 ? low - 6.25 * low * low : 0.04;
  const c = color.map((v) => v - offset) as [number, number, number];
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak < start) return c;
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  const scaled = c.map((v) => (v * newPeak) / peak);
  const g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  return scaled.map((v) => v + (newPeak - v) * g) as [number, number, number];
}

/** The curve a name stands for, on the CPU. `aces` is LayaAir's and has no twin here. */
export function zhudaToneMap(
  kind: Exclude<ZhudaToneMapping, 'aces'>,
  color: Rgb,
): [number, number, number] {
  if (kind === 'agx') return zhudaAgxToneMap(color);
  if (kind === 'neutral') return zhudaNeutralToneMap(color);
  if (kind === 'none') return [color[0], color[1], color[2]];
  throw Error('Unknown tone mapping ' + String(kind));
}

const mat3 = (m: readonly Rgb[]) => 'mat3(' + m.map((c) => `vec3(${c.join(',')})`).join(',') + ')';
// LayaAir's own blit vertex program: both passes are drawn with its offset and scale.
const VERTEX = (name: string) =>
  `#define SHADER_NAME ${name}\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(u_OffsetScale.x*2.0-1.0+(a_PositionTexcoord.x+1.0)*u_OffsetScale.z,(1.0-((u_OffsetScale.y*2.0-1.0+(-a_PositionTexcoord.y+1.0)*u_OffsetScale.w)+1.0)/2.0)*2.0-1.0,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}`;
// Where a light lies along an edge of the table, 0..1, and back: LayaAir's
// log encoding from black on. LayaAir's own table starts below black, so
// black is looked up between two entries and comes out a little lifted;
// here black is the first entry itself and comes out black.
const PLACE = `
vec3 zhudaTablePlace(vec3 light){return (linearToLogC(light)-LogC_f)/(1.0-LogC_f);}
vec3 zhudaTableLight(vec3 place){return logCToLinear(LogC_f+place*(1.0-LogC_f));}
`;
// LayaAir's table builder without its ACES branch. The graded light is
// stored as its place along the table: between two entries the table is
// then a straight line wherever the grade is one.
const BUILDER = `#define SHADER_NAME ZhudaLutBuilderFS
#include "Color.glsl";
#include "ColorGrading.glsl";
varying vec2 v_Texcoord0;${PLACE}
vec3 lutValue(vec2 uv,vec4 params){vec3 color;uv-=params.yz;color.r=fract(uv.x*params.x);color.b=uv.x-color.r/params.x;color.g=uv.y;return color*params.w;}
void main(){
vec3 light=zhudaTableLight(lutValue(v_Texcoord0,u_LutParams));
gl_FragColor=vec4(zhudaTablePlace(max(colorGrade(light),vec3(0.0))),1.0);
}`;
// LayaAir's lookup pass, the table decoded, and the curve on what it gives.
const LOOKUP = `#define SHADER_NAME ZhudaGradeLookupFS
#include "Color.glsl";
#include "ColorGrading.glsl";
#include "LUT.glsl";
varying vec2 v_Texcoord0;${PLACE}
vec3 zhudaAgxContrast(vec3 x){vec3 x2=x*x;vec3 x4=x2*x2;return 15.5*x4*x2-40.14*x4*x+31.96*x4-6.868*x2*x+0.4298*x2+0.1191*x-0.00232;}
vec3 zhudaAgx(vec3 color){
color=${mat3(AGX_INSET)}*(${mat3(TO_REC2020)}*color);
color=(log2(max(color,vec3(1e-10)))-(${AGX_MIN_EV}))/(${AGX_MAX_EV}-(${AGX_MIN_EV}));
color=zhudaAgxContrast(clamp(color,0.0,1.0));
color=pow(max(vec3(0.0),${mat3(AGX_OUTSET)}*color),vec3(2.2));
return clamp(${mat3(FROM_REC2020)}*color,0.0,1.0);}
vec3 zhudaNeutral(vec3 color){
float low=min(color.r,min(color.g,color.b));
color-=low<0.08?low-6.25*low*low:0.04;
float peak=max(color.r,max(color.g,color.b));
if(peak<0.76)return color;
float newPeak=1.0-0.0576/(peak+0.24-0.76);
color*=newPeak/peak;
return mix(color,vec3(newPeak),1.0-1.0/(0.15*(peak-newPeak)+1.0));}
void main(){
gl_FragColor=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
gl_FragColor=gammaToLinear(gl_FragColor);
#endif
vec3 color=max(gl_FragColor.rgb*u_LutParams.w,vec3(0.0));
color=zhudaTableLight(applyLut(zhudaTablePlace(color),u_LutParams.xyz));
#ifdef ZHUDA_TONE_AGX
color=zhudaAgx(color);
#endif
#ifdef ZHUDA_TONE_NEUTRAL
color=zhudaNeutral(color);
#endif
gl_FragColor.rgb=color;
gl_FragColor=outputTransform(gl_FragColor);
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const add = (name: string, fragment: string, uniforms: Record<string, unknown>) => {
    const shader = l.Shader3D.add(name);
    shader.shaderType = l.ShaderFeatureType.PostProcess;
    const sub = new l.SubShader(
      { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
      { u_OffsetScale: l.ShaderDataType.Vector4, ...uniforms },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(VERTEX(name + 'VS'), fragment);
    pass.statefirst = true;
    pass.renderState.depthTest = l.RenderState.DEPTHTEST_ALWAYS;
    pass.renderState.depthWrite = false;
    pass.renderState.cull = l.RenderState.CULL_NONE;
    pass.renderState.blend = l.RenderState.BLEND_DISABLE;
  };
  add('ZhudaLutBuilder', BUILDER, {
    u_Lut: l.ShaderDataType.Texture2D,
    u_LutParams: l.ShaderDataType.Vector4,
  });
  add('ZhudaGradeLookup', LOOKUP, {
    u_MainTex: l.ShaderDataType.Texture2D,
    u_MainTex_TexelSize: l.ShaderDataType.Vector4,
    u_Lut: l.ShaderDataType.Texture2D,
    u_LutParams: l.ShaderDataType.Vector4,
  });
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

// What a grade draws its table and looks it up with while one of this
// module's curves is on, and LayaAir's own objects set aside meanwhile.
// LayaAir 3.4.2 does not survive one of its shader-data objects being drawn
// with one shader, then another, then the first again (the first draws with
// values it believes are still uploaded), so each shader keeps its own.
const curves = new WeakMap<
  object,
  { builder: any; lookup: any; layaBuilder: any; layaLookup: any }
>();

/**
 * Makes a LayaAir `ColorGradEffect` end in this curve. Call it after the
 * effect has joined a chain, and before it leaves or joins one again put
 * `aces` back (LayaAir sets its own passes up on joining). The table is
 * drawn again on the next frame. `aces` is LayaAir's own path, untouched.
 * `releaseZhudaToneCurve` frees what this made for a grade.
 */
export function applyZhudaToneCurve(l: any, grade: any, kind: ZhudaToneMapping): void {
  if (!ZHUDA_TONE_MAPPINGS.includes(kind)) throw Error('Unknown tone mapping ' + String(kind));
  if (!grade._lutBuilderMat || !grade._lutShaderData)
    throw Error('This colour grade has no table to draw');
  let own = curves.get(grade);
  if (kind === 'aces') {
    if (own) {
      grade._lutBuilderMat = own.layaBuilder;
      grade._lutShaderData = own.layaLookup;
      grade._LUTShader = l.Shader3D.find('blitLUTShader');
    }
    grade.toneMapping = l.ToneMappingType.ACES;
  } else {
    register(l);
    if (!own) {
      const builder = new l.Material();
      builder.lock = true;
      builder.setShaderName('ZhudaLutBuilder');
      own = {
        builder,
        lookup: l.LayaGL.renderDeviceFactory.createShaderData(null),
        layaBuilder: grade._lutBuilderMat,
        layaLookup: grade._lutShaderData,
      };
      curves.set(grade, own);
    }
    grade._lutBuilderMat = own.builder;
    grade._lutShaderData = own.lookup;
    grade._LUTShader = l.Shader3D.find('ZhudaGradeLookup');
    grade.toneMapping = l.ToneMappingType.None;
    const agx = l.Shader3D.getDefineByName('ZHUDA_TONE_AGX'),
      neutral = l.Shader3D.getDefineByName('ZHUDA_TONE_NEUTRAL');
    if (kind === 'agx') own.lookup.addDefine(agx);
    else own.lookup.removeDefine(agx);
    if (kind === 'neutral') own.lookup.addDefine(neutral);
    else own.lookup.removeDefine(neutral);
  }
  // LayaAir draws the table again only when one of its own values changed.
  grade._needBuildLUT = true;
}

/** Gives a grade its own objects back and frees what `applyZhudaToneCurve` made for it. */
export function releaseZhudaToneCurve(l: any, grade: any): void {
  const own = curves.get(grade);
  if (!own) return;
  applyZhudaToneCurve(l, grade, 'aces');
  curves.delete(grade);
  own.builder.lock = false;
  own.builder.destroy();
  own.lookup.destroy();
}
