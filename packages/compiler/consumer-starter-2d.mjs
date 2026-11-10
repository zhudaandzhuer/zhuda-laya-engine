/** Neutral isolated 2D starter; consumer art/rules belong in the generated project. */
export function starter2D() {
  return {
    'public/assets/panel.lh': JSON.stringify(
      {
        _$id: 'panel',
        _$type: 'Sprite',
        name: 'Root',
        width: 640,
        height: 360,
        _$child: [
          {
            _$id: 'body',
            _$type: 'Sprite',
            name: 'Body',
            x: 40,
            y: 40,
            width: 240,
            height: 160,
            _gcmds: [
              {
                _$type: 'DrawRectCmd',
                x: 0,
                y: 0,
                width: 240,
                height: 160,
                fillColor: '#26a6f2',
                percent: false,
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    'src/prefabs.ts': `import type {PrefabDefinition} from 'zhuda-laya-engine';
export const definitions:PrefabDefinition[]=[{id:'starter.panel',asset:'panel.lh',states:{idle:{},selected:{Body:{alpha:0.5}}}}];
`,
    'src/Main.ts': `import {ZhudaEngine,ZhudaPrefabLibrary,DirectoryAssetProvider} from 'zhuda-laya-engine';
import {definitions} from './prefabs';
async function main(){
 const context=await ZhudaEngine.boot({container:'#game',width:640,height:360,dprCap:3,features:['core','2d','ui']});
 const provider=new DirectoryAssetProvider({baseUrl:'./assets/'});
 const library=new ZhudaPrefabLibrary({provider,definitions});
 const cancel=new AbortController();
 window.addEventListener('pagehide',()=>{cancel.abort();library.dispose();provider.dispose();context.dispose();},{once:true});
 await library.instantiate('starter.panel',{parent:context.rootScene,signal:cancel.signal});
 context.runtime.start(()=>{});
}
void main();
`,
  };
}
