import { ZhudaEngine,Zhuda3D,DirectoryAssetProvider,ZhudaModelLibrary,ZhudaRuntimeProfiler,ZhudaCrowdScheduler,ZhudaRemoteCharacterPresenter,ZhudaEffectBudget,ZhudaCameraCoordinates,ZhudaInstanceGroup,inspectSceneResources,ZhudaRibbonPath3D,ZhudaLayaRibbonRenderer3D } from 'zhuda-laya-engine';
import { characterDefinition,createCharacter } from './character';
import type { CrowdPresentationTier } from 'zhuda-laya-engine';
type Actor=Awaited<ReturnType<typeof createCharacter>>;
type Position={x:number;z:number};
async function main(){
 const params=new URLSearchParams(location.search),count=Number(params.get('count')||25),mode=params.get('mode')||'full',selection=params.get('selection')||'',frozen=!!selection;
 const context=await ZhudaEngine.boot({container:document.querySelector<HTMLElement>('#game')!,features:['core','2d','3d','gltf'],dprCap:1,bgColor:'#172332'});
 const scene=Zhuda3D.createScene3D(context.rootScene,{ambientColor:[.8,.8,.8,1]});
 const camera=Zhuda3D.createCamera(scene,{position:frozen?[0,1.2,3.5]:[0,14,20],rotationEuler:frozen?[-8,0,0]:[-34,0,0],near:.1,far:100,clearColor:[.06,.09,.14,1]});
 Zhuda3D.createDirectionalLight(scene,{rotationEuler:[-40,-30,0],intensity:1});
 const provider=new DirectoryAssetProvider({baseUrl:'./assets/',manifest:{schemaVersion:1,entries:[{id:'CesiumMan.glb',kind:'model',bytes:438044,sha256:'b7001eaeea8254bd44773bcd247e78696d94169388fbb2a1800fc69434e777d9'}]}});
 const library=new ZhudaModelLibrary({provider,maxIdle:0,timeoutMs:30000}),actors:Actor[]=[];
 const coords=new ZhudaCameraCoordinates(camera,()=>{const r=context.canvas.getBoundingClientRect();return {...r,left:r.left,top:r.top,width:r.width,height:r.height,backingWidth:context.canvas.width,backingHeight:context.canvas.height};});
 const settings={tiers:[{maxDistance:18,updateHz:60,animation:'full' as const},{maxDistance:Infinity,updateHz:15,animation:'low' as const,animationInterval:4}],maxUpdatesPerFrame:100,hysteresis:1};
 const scheduler=new ZhudaCrowdScheduler(settings);
 const remote=new ZhudaRemoteCharacterPresenter<Position>({...settings,epoch:'initial',interpolate:(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}),maxExtrapolation:.15});
 let sceneTime=0,callbackMs=0,callbacks=0,networkPackets=0,reconnects=0,lastSequence=-1,epoch='initial',lastSnapshotTime=0;
 const position=(i:number,t:number):Position=>({x:((i%10)-4.5)*1.25+Math.sin(t*.5+i)*.2,z:(Math.floor(i/10)-4.5)*1.25});
 const present=(a:Actor,p:Position)=>{a.setPosition(p.x,p.z);const h=coords.worldToScreen({x:p.x,y:1.8,z:p.z});a.hud.style.display=h.visible?'block':'none';a.hud.style.transform=`translate(${h.x}px,${h.y}px)`;};
 let instances:ZhudaInstanceGroup|undefined,instanceMesh:Laya.Mesh|undefined,instanceMaterial:Laya.Material|undefined;
 const matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=.3;matrix[15]=1;
 if(mode==='instances'){
  instanceMesh=Laya.PrimitiveMesh.createBox(1,1,1);instanceMaterial=Zhuda3D.createMaterial({type:'blinn-phong',albedoColor:[.2,.7,.8,1]});instances=new ZhudaInstanceGroup(scene,instanceMesh,instanceMaterial);
  for(let i=0;i<count;i++){matrix[12]=(i%25-12)*.5;matrix[14]=(Math.floor(i/25)-10)*.5;instances.set(String(i),matrix);}
 }else{
  // Sequential entry bounds peak provider/native parser pressure; library still shares its decoded model.
  for(let i=0;i<(frozen?1:count);i++){
   const a=await createCharacter(library,scene,i,{unique:mode==='unique',equipment:mode!=='bare',frozen});actors.push(a);
   if(frozen){a.setPosition(0,0);a.hud.style.display='none';if(selection==='equipment'){a.root.active=false;camera.transform.position=new Laya.Vector3(0,0,1);scene.addChild(a.equipment!.root);a.equipment!.root.transform.position=new Laya.Vector3();}if(selection==='warning'){a.root.active=false;a.warning.root.active=true;camera.transform.position=new Laya.Vector3(0,2,2);camera.transform.rotationEuler=new Laya.Vector3(-45,0,0);}if(selection==='sparks'){a.root.active=false;a.particles.burst(24);a.particles.update(.2);a.renderer.render(camera);}continue;}
   const setTier=(tier:Readonly<CrowdPresentationTier>|null)=>{for(const lod of a.lod)lod.set(mode==='budget'?(tier?.animation??'paused'):'full',tier?.animationInterval??2);};
   if(mode!=='network')scheduler.register(String(i),{setTier,update:()=>present(a,position(i,sceneTime))},{visible:true,distance:Math.hypot(position(i,0).x,20-position(i,0).z)});
   if(mode==='network')remote.register(String(i),{setTier,present:p=>present(a,p)},{visible:true,distance:0});
   present(a,position(i,0));
  }
 }
 let ribbon:ZhudaLayaRibbonRenderer3D|undefined;
 if(selection==='ribbon'){
  actors[0].root.active=false;
  const path=new ZhudaRibbonPath3D({maxPoints:8,width:.12});
  ribbon=new ZhudaLayaRibbonRenderer3D(path,scene,Laya.Texture2D.whiteTexture,'#6fc7ff');
  path.setPoints([{x:-.5,y:1,z:0},{x:0,y:1.2,z:0}]);ribbon.render(camera);
  path.clear();ribbon.render(camera);
  path.setPoints([{x:-.6,y:1,z:0},{x:-.2,y:1.2,z:0},{x:.2,y:.9,z:0},{x:.6,y:1.1,z:0}]);ribbon.render(camera);
 }
 const budget=new ZhudaEffectBudget({maxParticles:mode==='budget'?600:4800,maxCoverage:mode==='budget'?1.2:10});
 let fallbacks=0;
 const requests=actors.map((a,i)=>({id:String(i),particles:48,coverage:.04,priority:i===0?10:0,minimumScale:i%10===0?.25:0,fallbackId:'ground-warning'}));
 const network=mode==='network';
 async function fetchSnapshots(){
  if(!network)return;
  const response=await fetch('/snapshots?after='+lastSequence,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Snapshot transport failed');
  const packet=await response.json() as {epoch:string;sequence:number;time:number;actors:{id:string;value:Position;teleport?:boolean}[];dropped?:boolean};
  if(packet.dropped)return;
  if(epoch!==packet.epoch){epoch=packet.epoch;remote.reset(epoch);lastSequence=-1;reconnects++;}
  if(packet.sequence<=lastSequence)return;lastSequence=packet.sequence;lastSnapshotTime=packet.time;
  for(const a of packet.actors)remote.push(a.id,{epoch,sequence:packet.sequence,time:packet.time,value:a.value},!!a.teleport);networkPackets++;
 }
 let pending=false,networkAge=0,networkError:string|undefined;
 context.runtime.start(dt=>{
  if(frozen)return;const start=performance.now();sceneTime+=dt;
  if(instances){for(let i=0;i<count;i++){matrix[12]=(i%25-12)*.5;matrix[13]=Math.sin(sceneTime+i)*.05;matrix[14]=(Math.floor(i/25)-10)*.5;instances.set(String(i),matrix);}}
  else if(network){networkAge+=dt;if(!pending&&networkAge>=.1){networkAge=0;pending=true;void fetchSnapshots().catch(e=>{networkError=String(e);}).finally(()=>pending=false);}remote.update(dt,lastSnapshotTime+networkAge-.1);}
  else {for(let i=0;i<actors.length;i++){const p=position(i,sceneTime),screen=coords.worldToScreen({x:p.x,y:.8,z:p.z});scheduler.setState(String(i),{visible:screen.visible,distance:Math.hypot(p.x,20-p.z)});}scheduler.update(dt);}
  if(mode==='full'||mode==='budget'){
   const allocations=budget.allocate(requests);fallbacks=0;
   for(let i=0;i<actors.length;i++){const a=actors[i],allocation=allocations[i];a.particles.particleLimit=allocation.particleLimit;a.particles.intensity=allocation.emissionScale;a.particles.setSimulation({frequencyHz:mode==='budget'?30:120,maxSubsteps:8});a.particles.play();a.particles.update(dt);a.renderer.render(camera);a.warning.root.active=i%10===0||allocation.fallbackRequired;if(allocation.fallbackRequired)fallbacks++;}
  }
  callbackMs+=performance.now()-start;callbacks++;
 });
 const gl=context.canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 is required for this benchmark');
 const extension=gl.getExtension('WEBGL_debug_renderer_info');const renderer=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 let profiler:ZhudaRuntimeProfiler|undefined,last=0;const render=Laya.stage.render;
 Laya.stage.render=function(timestamp:number){const p=profiler,start=performance.now();if(p)p.beginFrame();try{return render.call(this,timestamp);}finally{if(p){const heap=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;p.endFrame(last?start-last:0,performance.now()-start,{heapBytes:heap?.usedJSHeapSize});last=start;}}};
 const report=()=>({mode,count,selection,definition:characterDefinition,renderer,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},profile:profiler?.report(),resources:inspectSceneResources(),models:library.report(),animation:actors.map(a=>({animators:a.animators.length,normalizedTime:a.animators[0].getControllerLayer(0).getCurrentPlayState().normalizedTime,localRotation:{x:a.hand.transform.localRotation.x,y:a.hand.transform.localRotation.y,z:a.hand.transform.localRotation.z,w:a.hand.transform.localRotation.w},localHand:{x:a.hand.transform.localPosition.x,y:a.hand.transform.localPosition.y,z:a.hand.transform.localPosition.z},hand:{x:a.hand.transform.position.x,y:a.hand.transform.position.y,z:a.hand.transform.position.z}})),particles:{steps:actors.reduce((n,a)=>n+a.particles.simulatedSteps,0),alive:actors.reduce((n,a)=>n+a.particles.aliveCount,0),fallbacks},callback:{samples:callbacks,totalMs:callbackMs},network:{packets:networkPackets,reconnects,error:networkError,sequence:lastSequence}});
 const start=()=>{profiler?.dispose();profiler=new ZhudaRuntimeProfiler({capacity:60000});profiler.attach(gl);profiler.enableGpuTiming(gl);last=0;callbackMs=callbacks=0;};
 const lifecycle=async()=>{const measurements=[];for(let i=0;i<30;i++){
   const isolatedLibrary=new ZhudaModelLibrary({provider,maxIdle:0});
   const extra=await createCharacter(isolatedLibrary,scene,100+i,{equipment:true});extra.dispose();isolatedLibrary.dispose();
   // Let non-model native components finish their deferred destroy callbacks.
   await new Promise<void>(resolve=>Laya.timer.callLater(null,resolve));
   measurements.push({cycle:i+1,resources:inspectSceneResources(),models:isolatedLibrary.report()});
  }return measurements;};
 const dispose=()=>{Laya.stage.render=render;profiler?.dispose();scheduler.dispose();remote.dispose();ribbon?.dispose();context.runtime.dispose();for(const a of actors)a.dispose();actors.length=0;instances?.dispose();instanceMaterial?.destroy();instanceMesh?.destroy();library.dispose();provider.dispose();scene.destroy(true);return{models:library.report(),resources:inspectSceneResources()};};
 Object.assign(window,{crowd:{ready:true,start,report,lifecycle,dispose}});
}
void main().catch(error=>{Object.assign(window,{crowd:{ready:false,error:String(error)}});console.error(error);});
