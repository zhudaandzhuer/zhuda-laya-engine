export interface VfxMaterialSpec {
  version: 1;
  maskTexture?: string;
  noiseTexture?: string;
  dissolve?: number;
  edgeWidth?: number;
  edgeColor?: string;
  intensity?: number;
  uvScroll?: { x: number; y: number };
  uvDistortion?: number;
  refraction?: number;
  softDistance?: number;
}
export function validateVfxMaterial(s: VfxMaterialSpec): string[] {
  if (!s || s.version !== 1) return ['VFX material requires version 1.'];
  const errors: string[] = [];
  for (const k of ['dissolve','edgeWidth','uvDistortion','refraction'] as const) if (s[k] !== undefined && (!Number.isFinite(s[k]) || s[k]! < 0 || s[k]! > 1)) errors.push(`${k} must be 0..1.`);
  for (const k of ['intensity','softDistance'] as const) if (s[k] !== undefined && (!Number.isFinite(s[k]) || s[k]! < 0 || s[k]! > 100)) errors.push(`${k} must be 0..100.`);
  if (s.uvScroll && ![s.uvScroll.x,s.uvScroll.y].every(Number.isFinite)) errors.push('Invalid UV scroll.');
  if (s.edgeColor !== undefined && !/^#[0-9a-f]{6}$/i.test(s.edgeColor)) errors.push('Invalid edge color.');
  for (const key of ['maskTexture','noiseTexture']) if (s[key] !== undefined && (typeof s[key] !== 'string' || !s[key].length)) errors.push(`Invalid ${key}.`);
  return errors;
}
export const ZHUDA_VFX_VERTEX = `
#define SHADER_NAME ZhudaVfxVS
#include "Camera.glsl";
#include "Sprite3DVertex.glsl";
#include "VertexCommon.glsl";
varying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;
void main(){
  Vertex vertex; getVertexParams(vertex);
  v_UV=vertex.texCoord0; v_Color=vertex.vertexColor;
  vec4 world=getWorldMatrix()*vec4(vertex.positionOS,1.0);
  vec4 clip=getPositionCS(world.xyz/world.w); v_Clip=clip;
  v_EyeDepth=-(u_View*world).z;
  gl_Position=remapPositionZ(clip);
}`;
export const ZHUDA_VFX_FRAGMENT = `
#define SHADER_NAME ZhudaVfxFS
#include "Camera.glsl";
varying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;
uniform sampler2D u_BaseTexture; uniform sampler2D u_MaskTexture; uniform sampler2D u_NoiseTexture;
uniform vec4 u_VfxParams; uniform vec4 u_UVParams; uniform vec4 u_EdgeColor; uniform vec4 u_VfxFlags; uniform float u_VfxTime;
void main(){
  vec2 uv=v_UV+u_UVParams.xy*u_VfxTime;
  vec2 flow=texture2D(u_NoiseTexture,uv).rg*2.0-1.0;
  vec4 base=texture2D(u_BaseTexture,uv+flow*u_UVParams.z)*v_Color;
  float noise=texture2D(u_NoiseTexture,uv).r;
  float visible=1.0; float edge=0.0;
  if(u_VfxParams.x>0.0){
    visible=smoothstep(u_VfxParams.x,u_VfxParams.x+max(0.001,u_VfxParams.y),noise);
    edge=visible*(1.0-smoothstep(u_VfxParams.x+u_VfxParams.y,u_VfxParams.x+2.0*max(0.001,u_VfxParams.y),noise));
  }
  if(u_VfxParams.x>=1.0)visible=0.0;
  base.a*=texture2D(u_MaskTexture,v_UV).r*visible;
  base.rgb=base.rgb*u_VfxParams.z+u_EdgeColor.rgb*edge*u_EdgeColor.a;
  vec2 screen=v_Clip.xy/v_Clip.w*0.5+0.5;
  screen.y=mix(screen.y,1.0-screen.y,u_VfxFlags.y);
  if(u_UVParams.w>0.0){vec3 scene=texture2D(u_CameraOpaqueTexture,clamp(screen+flow*u_UVParams.w,0.001,0.999)).rgb;base.rgb=mix(base.rgb,scene,0.85);}
  if(u_VfxParams.w>0.0){float d=texture2D(u_CameraDepthTexture,screen).r;float eye=1.0/(u_ZBufferParams.z*d+u_ZBufferParams.w);base.a*=clamp((eye-v_EyeDepth)/u_VfxParams.w,0.0,1.0);}
  gl_FragColor=base;
}`;
/** Laya 3.4.2 mesh material. Textures are borrowed and detached on disposal. Requires camera depth/opaque passes for soft particles/refraction. */
export class ZhudaVfxMaterial {
  readonly material: any;
  private spec: VfxMaterialSpec;
  private readonly resolveTexture: (key: string) => any;
  private readonly baseTexture: any;
  private disposed = false;
  constructor(spec: VfxMaterialSpec, baseTexture: any, resolveTexture: (key: string) => any, blend: 'alpha'|'additive'='alpha') {
    const errors=validateVfxMaterial(spec);if(errors.length)throw new Error(errors.join(' | '));
    const l=(globalThis as any).Laya;if(!l?.Shader3D||!baseTexture)throw new Error('Boot Laya 3D and load a base texture before creating VFX materials.');
    if(!l.Shader3D.find('ZhudaVfx')){
      const shader=l.Shader3D.add('ZhudaVfx',true,false);shader.shaderType=l.ShaderFeatureType.D3;
      const uniforms={u_BaseTexture:l.ShaderDataType.Texture2D,u_MaskTexture:l.ShaderDataType.Texture2D,u_NoiseTexture:l.ShaderDataType.Texture2D,
        u_VfxParams:l.ShaderDataType.Vector4,u_UVParams:l.ShaderDataType.Vector4,u_EdgeColor:l.ShaderDataType.Vector4,u_VfxFlags:l.ShaderDataType.Vector4,u_VfxTime:l.ShaderDataType.Float};
      const sub=new l.SubShader(l.SubShader.DefaultAttributeMap,uniforms);shader.addSubShader(sub);sub.addShaderPass(ZHUDA_VFX_VERTEX,ZHUDA_VFX_FRAGMENT);
    }
    this.resolveTexture=resolveTexture;this.baseTexture=baseTexture.bitmap||baseTexture;
    this.material=new l.Material();this.material.setShaderName('ZhudaVfx');
    this.material.renderQueue=3000;this.material.depthWrite=false;this.material.depthTest=l.RenderState.DEPTHTEST_LEQUAL;this.material.cull=l.RenderState.CULL_NONE;
    this.material.blend=l.RenderState.BLEND_ENABLE_ALL;this.material.blendSrc=l.RenderState.BLENDPARAM_SRC_ALPHA;this.material.blendDst=blend==='additive'?l.RenderState.BLENDPARAM_ONE:l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
    this.spec=JSON.parse(JSON.stringify(spec));
    try { this.apply(this.spec); } catch(error) { this.dispose();throw error; }
  }
  descriptor():VfxMaterialSpec{return JSON.parse(JSON.stringify(this.spec));}
  configure(patch:Partial<VfxMaterialSpec>):void{if(this.disposed)throw new Error('Disposed VFX material.');const next={...this.spec,...patch};const errors=validateVfxMaterial(next);if(errors.length)throw new Error(errors.join(' | '));this.apply(next);this.spec=JSON.parse(JSON.stringify(next));}
  setTime(seconds:number):void{if(!Number.isFinite(seconds))throw new Error('Invalid material time.');this.material.setFloat('u_VfxTime',seconds);}
  setScreenFlipY(flip:boolean):void{const l=(globalThis as any).Laya;this.material.setVector4('u_VfxFlags',new l.Vector4(0,flip?1:0,0,0));}
  private apply(s:VfxMaterialSpec):void{
    const l=(globalThis as any).Laya,m=this.material;
    const texture=(key:string|undefined)=>{if(!key)return l.Texture2D.whiteTexture;const value=this.resolveTexture(key);if(!value)throw new Error(`Missing VFX texture: ${key}`);return value.bitmap||value;};
    const mask=texture(s.maskTexture),noise=texture(s.noiseTexture); // Resolve before mutating live material.
    m.setTexture('u_BaseTexture',this.baseTexture);m.setTexture('u_MaskTexture',mask);m.setTexture('u_NoiseTexture',noise);
    m.setVector4('u_VfxParams',new l.Vector4(s.dissolve??0,s.edgeWidth??.04,s.intensity??1,s.softDistance??0));
    m.setVector4('u_UVParams',new l.Vector4(s.uvScroll?.x??0,s.uvScroll?.y??0,s.uvDistortion??0,s.refraction??0));
    const color=parseInt((s.edgeColor||'#ffbb44').slice(1),16);m.setVector4('u_EdgeColor',new l.Vector4((color>>16&255)/255,(color>>8&255)/255,(color&255)/255,1));
    m.setVector4('u_VfxFlags',new l.Vector4());m.setFloat('u_VfxTime',0);
  }
  dispose():void{if(this.disposed)return;this.disposed=true;for(const name of ['u_BaseTexture','u_MaskTexture','u_NoiseTexture'])this.material.setTexture(name,null);this.material.destroy();}
}
/** Explicit ownership of additional camera passes; restore the original state when leaving the scene. */
export class ZhudaVfxCamera {
  private static owners=new WeakSet<object>();
  private disposed=false;
  private readonly depth:number;private readonly opaque:boolean;private readonly post:any;private readonly bloom:any;private readonly ownedPost:any;
  readonly camera:any;
  constructor(camera:any,options:{softParticles?:boolean;refraction?:boolean;bloomIntensity?:number}={}){
    const runtime=(globalThis as any).Laya;
    if(ZhudaVfxCamera.owners.has(camera))throw new Error('This camera already has a VFX pass owner.');
    if(options.bloomIntensity!==undefined&&(!runtime?.PostProcess||!runtime?.BloomEffect||!Number.isFinite(options.bloomIntensity)||options.bloomIntensity<0))throw new Error('Bloom requires the Laya postProcess module and a non-negative intensity.');
    ZhudaVfxCamera.owners.add(camera);
    this.camera=camera;const l=(globalThis as any).Laya;this.depth=camera.depthTextureMode;this.opaque=camera.opaquePass;this.post=camera.postProcess;
    if(options.softParticles)camera.depthTextureMode|=l.DepthTextureMode.Depth;
    if(options.refraction)camera.opaquePass=true;
    if(options.bloomIntensity!==undefined){
      if(!l.PostProcess||!l.BloomEffect||!Number.isFinite(options.bloomIntensity)||options.bloomIntensity<0)throw new Error('Bloom requires the Laya postProcess module and a non-negative intensity.');
      this.ownedPost=this.post||new l.PostProcess();camera.postProcess=this.ownedPost;this.bloom=new l.BloomEffect();this.bloom.intensity=options.bloomIntensity;this.ownedPost.addEffect(this.bloom);
    }
  }
  dispose():void{if(this.disposed)return;this.disposed=true;ZhudaVfxCamera.owners.delete(this.camera);this.camera.depthTextureMode=this.depth;this.camera.opaquePass=this.opaque;if(this.bloom){this.ownedPost.removeEffect(this.bloom);if(this.camera.postProcess===this.ownedPost&&!this.post)this.camera.postProcess=this.post;}}
}
