import type { EffectKey } from './effects/EffectDirector.ts';
import { validateVfxMaterial } from './effects/VfxMaterial.ts';
import type { VfxMaterialSpec } from './effects/VfxMaterial.ts';
export interface UnityVisualMaterial {
  id:string;shader:string;color?:[number,number,number,number];metallic?:number;smoothness?:number;
  emission?:[number,number,number];transparent?:boolean;textures?:{albedo?:string;normal?:string;metallicGloss?:string;emission?:string};
  vfx?:VfxMaterialSpec;
}
export interface MigratedVisualMaterial { id:string;target:'PBRStandardMaterial'|'UnlitMaterial'|'ZhudaVfx';properties:Record<string,any>;textures:Record<string,string>;vfx?:VfxMaterialSpec; }
/** Converts explicit Unity exporter data. Unknown shaders block conversion instead of silently falling back to BlinnPhong. */
export function convertUnityVisualMaterial(input:UnityVisualMaterial):MigratedVisualMaterial{
  if(!input?.id||!input.shader)throw new Error('Material needs a source id and shader.');
  const pbr=['Standard','Universal Render Pipeline/Lit'].includes(input.shader),unlit=['Unlit/Color','Unlit/Texture','Universal Render Pipeline/Unlit'].includes(input.shader);
  if(!pbr&&!unlit&&!input.vfx)throw new Error(`Unmapped Unity shader ${input.shader}; supply an explicit VFX material contract.`);
  if(input.vfx){const errors=validateVfxMaterial(input.vfx);if(errors.length)throw new Error(errors.join(' | '));}
  const color=input.color||[1,1,1,1];if(color.length!==4||!color.every(v=>Number.isFinite(v)&&v>=0)||[input.metallic??0,input.smoothness??.5].some(v=>!Number.isFinite(v)||v<0||v>1)||input.emission&&(input.emission.length!==3||!input.emission.every(v=>Number.isFinite(v)&&v>=0)))throw new Error('Invalid source material values.');
  const textures:Record<string,string>={};for(const [name,key]of Object.entries(input.textures||{})){if(!['albedo','normal','metallicGloss','emission'].includes(name)||typeof key!=='string'||!key)throw new Error('Unknown texture semantic.');textures[name]=key;}
  if(!pbr&&(textures.normal||textures.metallicGloss))throw new Error('PBR texture semantics cannot be applied to an unlit material.');
  return{id:input.id,target:input.vfx?'ZhudaVfx':pbr?'PBRStandardMaterial':'UnlitMaterial',properties:{albedoColor:[...color],metallic:input.metallic??0,smoothness:input.smoothness??.5,emission:input.emission?[...input.emission]:[0,0,0],transparent:!!input.transparent},textures,...input.vfx?{vfx:JSON.parse(JSON.stringify(input.vfx))}:{}};
}
export function instantiateMigratedMaterial(spec:MigratedVisualMaterial,resolve:(key:string)=>any):any{
  const l=(globalThis as any).Laya;if(spec.target==='ZhudaVfx')throw new Error('Construct ZhudaVfxMaterial with this contract and the resolved albedo texture.');
  if(!l?.[spec.target])throw new Error(`Missing Laya material class ${spec.target}.`);
  const textures:Record<string,any>={};for(const [name,key]of Object.entries(spec.textures)){const t=resolve(key);if(!t)throw new Error(`Missing migrated texture ${key}`);textures[name]=t.bitmap||t;}
  const m=new l[spec.target](),p=spec.properties;m.albedoColor=new l.Color(...p.albedoColor);
  if(spec.target==='PBRStandardMaterial'){m.metallic=p.metallic;m.smoothness=p.smoothness;m.enableEmission=p.emission.some((v:number)=>v>0);m.emissionColor=new l.Color(...p.emission,1);}
  const map={albedo:'albedoTexture',normal:'normalTexture',metallicGloss:'metallicGlossTexture',emission:'emissionTexture'};
  for(const [name,t]of Object.entries(textures))m[map[name]]=t;
  if(p.transparent)m.renderMode=l[spec.target].RENDERMODE_TRANSPARENT;
  return m;
}
/** Dispose a migrated material without cascading into shared application textures. */
export function disposeMigratedMaterial(material:any):void{for(const key of ['albedoTexture','normalTexture','metallicGlossTexture','emissionTexture'])if(key in material)material[key]=null;material.destroy();}
export interface UnityCurveKey {time:number;value:number;inTangent?:number;outTangent?:number;weightedMode?:number;}
/** Adaptive Hermite baking with an explicit error bound at quarter points. Weighted tangents need an exporter-side bake. */
export function convertUnityAnimationCurve(keys:readonly UnityCurveKey[],tolerance=0.001):EffectKey[]{
  if(!keys.length||keys.length>4096||!Number.isFinite(tolerance)||tolerance<=0)throw new Error('Invalid source curve.');
  keys.forEach((k,i)=>{if(![k.time,k.value,k.inTangent??0,k.outTangent??0].every(Number.isFinite)||k.time<0||(i>0&&k.time<=keys[i-1].time)||k.weightedMode)throw new Error('Unordered, non-finite or weighted curve; bake unsupported tangent modes before import.');});
  const out:EffectKey[]=[{time:keys[0].time,value:keys[0].value}];
  for(let i=1;i<keys.length;i++){
    const a=keys[i-1],b=keys[i],span=b.time-a.time;
    const sample=(t:number)=>{const u=(t-a.time)/span,u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*a.value+(u3-2*u2+u)*(a.outTangent??(b.value-a.value)/span)*span+(-2*u3+3*u2)*b.value+(u3-u2)*(b.inTangent??(b.value-a.value)/span)*span;};
    const split=(lo:number,hi:number,lv:number,hv:number,depth:number)=>{let error=0;for(const f of [.25,.5,.75])error=Math.max(error,Math.abs(sample(lo+(hi-lo)*f)-(lv+(hv-lv)*f)));if(error>tolerance){if(depth>=16||out.length>65530)throw new Error('Curve exceeds baking budget.');const mid=(lo+hi)/2,mv=sample(mid);split(lo,mid,lv,mv,depth+1);split(mid,hi,mv,hv,depth+1);}else out.push({time:hi,value:hv});};
    split(a.time,b.time,a.value,b.value,0);
  }return out;
}
export interface VisualFrameMetrics {passed:boolean;intersectionOverUnion:number;sourcePixels:number;targetPixels:number;centroidErrorPx:number;}
/** Compare aligned RGBA captures by silhouette. Color is intentionally excluded; render timing and viewport must be matched by the caller. */
export function compareVisualFrames(source:ArrayLike<number>,target:ArrayLike<number>,width:number,height:number,options:{alphaThreshold?:number;minIoU?:number;maxCentroidErrorPx?:number}={}):VisualFrameMetrics{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||source.length!==width*height*4||target.length!==source.length)throw new Error('Frames must share an explicit RGBA viewport.');
  const threshold=options.alphaThreshold??16,minIoU=options.minIoU??.95,maxCenter=options.maxCentroidErrorPx??1;
  if(!Number.isFinite(threshold)||threshold<0||threshold>255||!Number.isFinite(minIoU)||minIoU<0||minIoU>1||!Number.isFinite(maxCenter)||maxCenter<0)throw new Error('Invalid visual comparison thresholds.');
  let a=0,b=0,intersection=0,union=0,ax=0,ay=0,bx=0,by=0;
  for(let i=0;i<width*height;i++){const sa=source[i*4+3]>threshold,tb=target[i*4+3]>threshold,x=i%width,y=Math.floor(i/width);if(sa){a++;ax+=x;ay+=y;}if(tb){b++;bx+=x;by+=y;}if(sa&&tb)intersection++;if(sa||tb)union++;}
  const iou=union?intersection/union:1,center=a&&b?Math.hypot(ax/a-bx/b,ay/a-by/b):a===b?0:Infinity;
  return{passed:a>0&&b>0&&iou>=minIoU&&center<=maxCenter,intersectionOverUnion:iou,sourcePixels:a,targetPixels:b,centroidErrorPx:center};
}
