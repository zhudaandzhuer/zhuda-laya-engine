/** Portable neutral fixture: browser preview and mini-game use the same recipe. */
export function starterMiniGame() {
  return {
    'src/prefabs.ts': `import type {AnyPrefabDefinition,AssetProvider} from 'zhuda-laya-engine';
export const definitions:AnyPrefabDefinition[]=[{
 id:'starter.cube',kind:'3d',tree:{materials:{blue:{type:'pbr',albedoColor:[.1,.6,.9,1],metallic:.2,smoothness:.5}},root:{name:'Root',children:[{name:'Body',mesh:{type:'box'},material:'blue',localRotationEuler:[0,20,0]}]}},states:{idle:{}}
}];
// This fixture has no external assets. Real games provide a platform transport.
export function createAssetProvider():AssetProvider {return {name:'procedural-only',async load(id){throw Error('No external asset declared: '+id);}};}
export const preview3D={camera:{position:[0,2,6] as [number,number,number],rotationEuler:[-15,0,0] as [number,number,number],clearColor:[.08,.12,.18,1] as [number,number,number,number]}};
`,
    'src/Main.ts': `import {ZhudaEngine,Zhuda3D,ZhudaPrefabLibrary} from 'zhuda-laya-engine';
import {definitions,createAssetProvider,preview3D} from './prefabs';
async function main(){
 const context=await ZhudaEngine.boot({features:['core','3d'],width:640,height:360,designSize:{width:640,height:360},dprCap:3});
 const scene=Zhuda3D.createScene3D(context.rootScene);
 Zhuda3D.createCamera(scene,preview3D.camera);
 Zhuda3D.createDirectionalLight(scene);
 const provider=createAssetProvider();
 const library=new ZhudaPrefabLibrary({provider,definitions});
 const instance=await library.instantiate('starter.cube',{parent:scene});
 context.runtime.start(()=>{});
 const dispose=()=>{instance.dispose();library.dispose();provider.dispose?.();context.dispose();};
 // Keep a simple acceptance hook; game ownership/lifecycle remains consumer-side.
 Object.assign(globalThis,{miniGameFixture:{context,library,dispose}});
}
void main().catch(error=>{console.error(error);Object.assign(globalThis,{miniGameError:String(error)});});
`,
  };
}
