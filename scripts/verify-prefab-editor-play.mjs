import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createPrefabEditorServer } from '../packages/compiler/prefab-editor-server.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { png } from './lib/neutral-png.mjs';

const project=await fs.mkdtemp(path.join(os.tmpdir(),'zhuda-editor-play-'));
const output=path.resolve(process.env.EDITOR_PLAY_EVIDENCE_DIR||path.join(project,'evidence'));
await fs.mkdir(path.join(project,'assets'));await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(project,'assets/tile.png'),png([39,205,123,255]));
const image=(id,x,y,width,height)=>({_$id:id,_$type:'Image',name:id,x,y,width,height,skin:'tile.png'});
const source={_$id:'root',_$type:'Sprite',name:'Root',width:800,height:1000,_$child:[image('Button',80,100,120,80),
  {_$id:'Output',_$type:'Text',name:'Output',x:80,y:200,width:300,height:50,text:'Authored',fontSize:26,color:'#ffffff'},
  {_$id:'Track',_$type:'Sprite',name:'Track',x:150,y:320,width:400,height:60,_$child:[image('Grip',0,0,40,60)]}]};
const file=path.join(project,'assets/fixture.lh');await fs.writeFile(file,JSON.stringify(source));
await fs.writeFile(path.join(project,'zhuda.editor.ts'),`
import {ZhudaEngine} from 'zhuda-laya-engine';
export async function mount(ctx) {
 const stats=globalThis.__PLAY_STATS__??={mounts:0,cleanups:0,disposes:0,active:0,clicks:0};
 stats.mounts++;stats.active++;ctx.onDispose(()=>{stats.active--;stats.cleanups++});
 const root=ctx.root,button=ctx.find('Button'),output=ctx.find('Output'),track=ctx.find('Track'),grip=ctx.find('Track/Grip');
 root.mouseEnabled=true;root.mouseThrough=true;button.mouseEnabled=true;track.mouseEnabled=true;grip.mouseEnabled=false;
 ctx.listen(button,'click',()=>{stats.clicks++;output.text='Clicked '+stats.clicks;button.x+=25});
 let dragging=false;const update=()=>{const p=track.globalToLocal(new Laya.Point(ctx.stage.mouseX,ctx.stage.mouseY));grip.x=Math.max(0,Math.min(track.width-grip.width,p.x-grip.width/2));output.text=String(Math.round(grip.x/(track.width-grip.width)*100))};
 ctx.listen(track,'mousedown',()=>{dragging=true;update()});ctx.listen(ctx.stage,'mousemove',()=>{if(dragging)update()});
 ctx.listen(ctx.stage,'mouseup',()=>dragging=false);
 stats.singleton=await ZhudaEngine.boot().then(()=>false,error=>String(error).includes('already active'));
 const mode=new URLSearchParams(location.search).get('fixture');
 if(mode==='fail')throw Error('deliberate preview failure');
 if(mode==='late')await new Promise(resolve=>{globalThis.__FINISH_LATE__=resolve});
 if(mode==='timeout')await new Promise(()=>{});
 return {dispose(){stats.disposes++}};
}`);
const server=await createPrefabEditorServer({projectRoot:project,prefab:'assets/fixture.lh',port:0,previewTimeoutMs:1500});
const {port}=await server.listening,base=`http://127.0.0.1:${port}/`;
const browser=await chromeFixture();
const sourceHashes={};
for(const file of ['packages/compiler/prefab-editor-client.ts','packages/compiler/prefab-editor-server.mjs','packages/compiler/prefab-editor-preview.ts','packages/types/editor-preview.d.ts','scripts/verify-prefab-editor-play.mjs'])sourceHashes[file]=crypto.createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex');
const report={passed:false,sourceHashes,checks:[],limits:['Desktop Chrome; physical devices and speaker output are separate.']};
const near=(a,b,label,tolerance=1)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}`);
const settle=()=>browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,60))))');
const click=id=>browser.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const playing=()=>browser.waitFor(`document.querySelector('#status').textContent==='Play · interactive preview'`);
const stopped=()=>browser.waitFor(`!document.body.classList.contains('play-mode') && document.querySelector('#play').textContent.includes('Play') && !document.querySelector('#save').disabled`);
const native=expression=>browser.evaluate(`(()=>{function find(n,id){if(n.__zhudaPrefabId===id)return n;for(let i=0;i<n.numChildren;i++){const hit=find(n.getChildAt(i),id);if(hit)return hit}};const node=id=>find(Laya.stage,id);return (${expression});})()`);
async function point(id,x,y){return native(`(()=>{const p=node('${id}').localToGlobal(new Laya.Point(${x},${y})),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+p.x*r.width/Laya.stage.width,y:r.y+p.y*r.height/Laya.stage.height}})()`)}
const mouse=(type,p,extra={})=>browser.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1,...extra});
async function load(dpr,fixture=''){
 await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1200,deviceScaleFactor:dpr,mobile:false});
 await browser.send('Page.navigate',{url:base+(fixture?'?fixture='+fixture:'')});
 await browser.waitFor(`document.querySelector('#status').textContent==='Saved' && !document.querySelector('#play').disabled`);await settle();
}
try {
 for(const dpr of [1,1.5,2]){
  await load(dpr);await browser.evaluate(`document.querySelector('[data-node-id="Button"]').click()`);
  await browser.evaluate(`(()=>{const row=[...document.querySelectorAll('.field')].find(r=>r.querySelector('label').textContent==='X');const input=row.querySelector('input');input.value='90';input.dispatchEvent(new Event('change'));})()`);
  assert.equal(await native(`node('Button').x`),90);
  const disk=await fs.readFile(file,'utf8');
  await click('play');await playing();assert.equal(await browser.evaluate('__PLAY_STATS__.singleton'),true);
  assert.equal(await browser.evaluate(`document.querySelector('#save').disabled && document.querySelector('#reload').disabled && document.querySelector('#undo').disabled`),true);
  assert.equal(await browser.evaluate(`document.querySelector('#selection-box').style.display`),'none');
  let p=await point('Button',50,30);await mouse('mouseMoved',p,{buttons:0});await mouse('mousePressed',p);await mouse('mouseReleased',p);await settle();
  assert.equal(await native(`node('Output').text`),'Clicked 1');near(await native(`node('Button').x`),115,'controller click');
  p=await point('Track',90,30);await mouse('mousePressed',p);await mouse('mouseMoved',await point('Track',290,30));await settle();
  near(await native(`node('Grip').x`),270,'interactive volume drag');near(await native(`node('Button').x`),115,'editing drag blocked',.01);
  await mouse('mouseReleased',await point('Track',290,30));
  await click('agent-view');await settle();assert.equal(await browser.evaluate(`document.body.classList.contains('play-mode') && document.body.classList.contains('agent-view')`),true);
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1100,height:900,deviceScaleFactor:dpr,mobile:false});await settle();
  p=await point('Track',180,30);await mouse('mousePressed',p);await mouse('mouseReleased',p);await settle();near(await native(`node('Grip').x`),160,'Play resize input');
  await browser.screenshot(path.join(output,`play-dpr${dpr}.png`));
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',modifiers:2});await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',modifiers:2});
  assert.equal(await fs.readFile(file,'utf8'),disk,'Play cannot save');
  await click('play');await stopped();await settle();
  near(await native(`node('Button').x`),90,'unsaved edit restored',.01);assert.equal(await native(`node('Output').text`),'Authored');
  assert.equal(await browser.evaluate('__PLAY_STATS__.active'),0);assert.equal(await browser.evaluate('__PLAY_STATS__.disposes'),1);
  assert.equal(await browser.evaluate(`document.querySelector('#status').textContent`),'Unsaved changes');
  await click('undo');await settle();near(await native(`node('Button').x`),80,'history unchanged',.01);
  await click('redo');await settle();near(await native(`node('Button').x`),90,'history redo',.01);
  assert.equal(await fs.readFile(file,'utf8'),disk);report.checks.push({label:`DPR ${dpr}: click/drag, Edit isolation, Agent View, resize, Stop and history`,passed:true});
 }
 for(let i=0;i<30;i++){
  await click('play');await playing();await click('play');await stopped();await settle();
  assert.equal(await browser.evaluate('__PLAY_STATS__.active'),0);assert.equal(await browser.evaluate(`document.querySelectorAll('#stage canvas').length`),1);
 }
 report.checks.push({label:'30 Play/Stop cycles without retained controller or extra canvas',stats:await browser.evaluate('__PLAY_STATS__')});
 await click('play');await playing();
 await browser.evaluate(`window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))`);
 await stopped();await settle();near(await native(`node('Button').x`),90,'page restore retains unsaved source',.01);
 assert.equal(await browser.evaluate('__PLAY_STATS__.active'),0);report.checks.push({label:'pagehide retires Play and pageshow restores edits',passed:true});
 for(const fixture of ['fail','timeout','late']){
  await load(2,fixture);await click('play');
  if(fixture==='late'){
   await browser.waitFor('typeof globalThis.__FINISH_LATE__ === "function"');await click('play');await stopped();
   await browser.evaluate('globalThis.__FINISH_LATE__()');await settle();
   assert.equal(await browser.evaluate('__PLAY_STATS__.disposes'),1,'late controller disposed');
  }else{await browser.waitFor(`document.querySelector('#error').textContent.includes('${fixture==='fail'?'deliberate preview failure':'deadline'}')`);await stopped()}
  assert.equal(await browser.evaluate('__PLAY_STATS__.active'),0);assert.equal(await native(`node('Output').text`),'Authored');
  report.checks.push({label:fixture+' mount returns to Edit with no live resources',passed:true});
 }
 assert.deepEqual(browser.errors,[]);assert.equal(await fs.readFile(file,'utf8'),JSON.stringify(source));
 report.sourceSha256=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');report.passed=true;
 console.log('PASS: editor Play interactions and lifecycle; '+output);
} catch(error){report.failure=String(error.stack||error);await browser.screenshot(path.join(output,'failure.png')).catch(()=>{});throw error}
finally{report.errors=browser.errors;await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close()}
