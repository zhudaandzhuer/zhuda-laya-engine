import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
test('strict public consumer composes sample audio and inferred 2D/3D Prefab roots',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-consumer-types-'));
  try{
    fs.mkdirSync(path.join(root,'node_modules'));fs.symlinkSync(path.resolve('.'),path.join(root,'node_modules/zhuda-laya-engine'),'dir');
    const file=path.join(root,'consumer.ts');
    fs.writeFileSync(file,`import { ZhudaPrefabLibrary, Zhuda3D, IframeSoundAdapter, DirectoryAssetProvider } from 'zhuda-laya-engine';
import type { Prefab3DDefinition, PrefabDefinition, PrefabPreview3D } from 'zhuda-laya-engine';
const provider=new DirectoryAssetProvider({baseUrl:'./assets/'});
const definitions:Prefab3DDefinition[]=[{id:'tree',kind:'3d',tree:{root:{name:'Root'},materials:{}},states:{idle:{}}}];
const library=new ZhudaPrefabLibrary({provider,definitions});
async function use(){
 const instance=await library.instantiate('tree');
 const root:Laya.Sprite3D=instance.root;
 const socket:Laya.Sprite3D=instance.socket('mount');
 instance.applyState('idle');
 // @ts-expect-error 3D roots are not 2D sprites
 const bad:Laya.Sprite=instance.root;
 const twoD:PrefabDefinition[]=[{id:'panel',asset:'panel.lh',states:{idle:{}}}];
 const panel=await new ZhudaPrefabLibrary({provider,definitions:twoD}).instantiate('panel');
 const sprite:Laya.Sprite=panel.root;
 const tree=Zhuda3D.buildPrefabTree(definitions[0].tree);tree.dispose();
 const audio=new IframeSoundAdapter({sampleProvider:provider,maxSamples:4});
 const info=await audio.loadSample('tone.wav');const duration:number=info.durationSec;
 audio.playSample({id:'bgm',sampleId:'tone.wav',loop:true,replace:true,crossFadeSec:.2});
 audio.stop('bgm',.2);audio.unloadSample('tone.wav');audio.dispose();
 // @ts-expect-error logical sample ID is required
 audio.playSample({id:'missing'});
}
const preview:PrefabPreview3D={camera:{position:[0,2,6]}};
// @ts-expect-error 3D transforms are XYZ tuples
definitions[0].states.bad={Root:{localScale:[1,1]}};
`);
    const program=ts.createProgram([file],{noEmit:true,strict:true,skipLibCheck:true,types:[],target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
    const diagnostics=ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
    assert.equal(program.getSourceFiles().some(f=>f.fileName.includes('/packages/core/')),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
