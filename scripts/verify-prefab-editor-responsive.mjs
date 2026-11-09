import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createPrefabEditorServer} from '../packages/compiler/prefab-editor-server.mjs';
import {chromeFixture} from './lib/chrome-fixture.mjs';
import {png} from './lib/neutral-png.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'zhuda-responsive-'));
const output=path.resolve(process.env.EDITOR_RESPONSIVE_EVIDENCE_DIR||path.join(root,'evidence'));
await fs.mkdir(path.join(root,'assets'),{recursive:true});await fs.mkdir(output,{recursive:true});
const colors=[[231,54,91],[39,205,123],[64,131,242],[236,191,37]];
for(let i=0;i<4;i++)await fs.writeFile(path.join(root,`assets/corner${i}.png`),png([...colors[i],255]));
const source={_$id:'root',_$type:'Sprite',name:'ResponsiveFixture',width:800,height:1000,_$child:[
 ...[[0,0],[768,0],[768,968],[0,968]].map(([x,y],i)=>({_$id:'corner'+i,_$type:'Image',name:'Corner'+i,x,y,width:32,height:32,skin:`corner${i}.png`})),
 {_$id:'button',_$type:'Image',name:'Button',x:300,y:400,width:160,height:100,skin:'corner1.png'},
 {_$id:'label',_$type:'Text',name:'Label',x:200,y:520,width:400,height:50,text:'Ready',color:'#ffffff',fontSize:28}
]};
await fs.writeFile(path.join(root,'assets/fixture.lh'),JSON.stringify(source));
await fs.writeFile(path.join(root,'zhuda.editor.ts'),`export function mount(ctx){ctx.root.mouseEnabled=true;const button=ctx.find('Button'),label=ctx.find('Label');button.mouseEnabled=true;ctx.listen(button,'click',()=>{label.text='Clicked'});}`);
const editor=await createPrefabEditorServer({projectRoot:root,prefab:'assets/fixture.lh',port:0});
const {port}=await editor.listening,base=`http://127.0.0.1:${port}/`;
const report={passed:false,checks:[],sourceHashes:{},limits:['Desktop Chromium; physical devices and non-Chromium browsers are separate.']};
for(const file of ['packages/compiler/prefab-editor-client.ts','packages/compiler/prefab-editor-server.mjs','scripts/verify-prefab-editor-responsive.mjs'])report.sourceHashes[file]=crypto.createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex');
let browser;
const settle=()=>browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,100))))');
const click=id=>browser.evaluate(`document.getElementById('${id}').click()`);
async function load(width,height,dpr=1,agent=true){
 await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
 // Page.navigate can acknowledge before the new document has a toolbar.
 const loaded=browser.waitEvent('Page.loadEventFired');
 await browser.send('Page.navigate',{url:base+(agent?'?view=agent':'')});
 await loaded;
 await browser.waitFor(`document.querySelector('#status')?.textContent==='Saved'&&document.querySelector('#play')?.disabled===false`);await settle();
}
async function measure(label,agent,pixels=false){
 const m=await browser.evaluate(`(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const body=document.body,main=document.querySelector('.layout'),panel=document.querySelector('.stage-panel');
  const buttons=[...document.querySelectorAll('.top button')].map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,...rect(e),hit:hit===e||e.contains(hit)}});
  return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},body:{...rect(body),scrollWidth:body.scrollWidth},header:rect(document.querySelector('.top')),title:rect(document.querySelector('.top h1')),main:{...rect(main),clientWidth:main.clientWidth,clientHeight:main.clientHeight,scrollWidth:main.scrollWidth,scrollHeight:main.scrollHeight},panel:rect(panel),canvas:rect(document.querySelector('#stage canvas')),buttons,panels:[...main.children].filter(e=>getComputedStyle(e).display!=='none').map(e=>({class:e.className,...rect(e)})),error:document.querySelector('#error').textContent};
 })()`);
 report.checks.push({label,...m});
 const within=(r,b,name)=>{assert.ok(r.x>=b.x-1&&r.right<=b.right+1,`${label}: ${name} horizontal bounds ${JSON.stringify(r)}`)};
 assert.equal(m.error,'',label);assert.ok(m.body.scrollWidth<=m.body.width+1,`${label}: body horizontal overflow`);
 assert.ok(m.main.scrollWidth<=m.main.clientWidth+1,`${label}: workspace horizontal overflow`);
 within(m.title,m.body,'title');
 for(const button of m.buttons){within(button,m.body,button.id);assert.ok(button.y>=-1&&button.bottom<=m.viewport.height+1,`${label}: ${button.id} vertical viewport`);assert.equal(button.hit,true,`${label}: ${button.id} hit target`)}
 for(const p of m.panels)within(p,m.body,'panel');
 within(m.canvas,m.panel,'canvas');assert.ok(m.canvas.y>=m.panel.y-1&&m.canvas.bottom<=m.panel.bottom+1,`${label}: canvas fits its panel`);
 if(agent){assert.ok(m.canvas.y>=m.header.bottom-1&&m.canvas.bottom<=m.viewport.height+1,`${label}: whole canvas visible`);assert.ok(Math.abs(m.panel.height-(m.main.clientHeight-parseFloat(await browser.evaluate(`getComputedStyle(document.querySelector('.layout')).paddingTop`))*2))<3,`${label}: Agent View uses full remaining row`)}
 if(pixels){
  await browser.evaluate(`document.querySelectorAll('#selection-box,#anchor-marker').forEach(e=>e.style.visibility='hidden')`);
  const shot=await browser.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,report.checks.length+'-viewport.png'),Buffer.from(shot.data,'base64'));
  const painted=await browser.evaluate(`(async()=>{const img=await createImageBitmap(await(await fetch('data:image/png;base64,${shot.data}')).blob());const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data,r=document.querySelector('#stage canvas').getBoundingClientRect(),sx=c.width/innerWidth,sy=c.height/innerHeight;return ${JSON.stringify(colors)}.map((color,i)=>{const p=[[16,16],[784,16],[784,984],[16,984]][i],x=Math.round((r.x+p[0]*r.width/800)*sx),y=Math.round((r.y+p[1]*r.height/1000)*sy);let hit=false;for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){const at=(yy*c.width+xx)*4;if(xx>=0&&yy>=0&&xx<c.width&&yy<c.height&&color.every((v,k)=>Math.abs(v-data[at+k])<8))hit=true;}return hit;});})()`);
  assert.deepEqual(painted,[true,true,true,true],`${label}: all actual painted corners visible`);report.checks.at(-1).paintedCorners=painted;
  await browser.evaluate(`document.querySelectorAll('#selection-box,#anchor-marker').forEach(e=>e.style.visibility='')`);
 }
 return m;
}
async function playClick(label){
 await click('play');await browser.waitFor(`document.querySelector('#status').textContent==='Play · interactive preview'`);await settle();
 await measure(label+' Play',true,true);
 const p=await browser.evaluate(`(()=>{function find(n){if(n.name==='Button')return n;for(let i=0;i<n.numChildren;i++){const hit=find(n.getChildAt(i));if(hit)return hit}}const p=find(Laya.stage).localToGlobal(new Laya.Point(80,50)),r=document.querySelector('#stage canvas').getBoundingClientRect();return{x:r.x+p.x*r.width/Laya.stage.width,y:r.y+p.y*r.height/Laya.stage.height}})()`);
 for(const type of ['mousePressed','mouseReleased'])await browser.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
 await settle();assert.equal(await browser.evaluate(`(()=>{function find(n){if(n.name==='Label')return n;for(let i=0;i<n.numChildren;i++){const hit=find(n.getChildAt(i));if(hit)return hit}}return find(Laya.stage).text})()`),'Clicked',label+' native Play input');
 await click('play');await browser.waitFor(`document.querySelector('#status').textContent==='Saved'`);await settle();
}
try{
 browser=await chromeFixture();
 for(const [width,height,dpr] of [[800,600,2],[1440,1000,1],[820,700,1.5],[640,480,2],[360,700,2],[320,480,1],[960,320,1],[1440,240,2]]){
  await load(width,height,dpr,true);await measure(`${width}x${height} DPR ${dpr}`,true,true);
  await playClick(`${width}x${height}`);
  await click('agent-view');await settle();await measure(`${width} Editor`,false);
  await browser.evaluate(`document.querySelector('.asset-panel').scrollIntoView({block:'end'})`);await settle();
  const reachable=await browser.evaluate(`(()=>{const a=document.querySelector('.asset-panel').getBoundingClientRect(),m=document.querySelector('.layout').getBoundingClientRect();return a.top<m.bottom&&a.bottom>m.top})()`);assert.equal(reachable,true,'Assets reachable by vertical scrolling');
 }
 await load(1440,900,2,true);
 // Host/container changes can occur without a window resize in an embedded pane.
 await browser.evaluate(`document.body.style.width='600px'`);await settle();await measure('600px embedded body without window resize',true,true);
 await click('agent-view');await settle();await measure('600px embedded Editor',false);
 await browser.evaluate(`document.querySelector('#status').textContent='Saved · backup assets/prefabs/a-very-long-consumer-package-name/a-very-long-panel-name.lh.bak'`);await settle();
 await measure('wrapped status resizes workspace without window resize',false);
 await click('agent-view');await settle();await measure('wrapped status Agent',true,true);
 assert.deepEqual(browser.errors,[]);await browser.close();browser=undefined;
 for(const zoomFactor of [1.25,1.5,2]){
  browser=await chromeFixture({zoomFactor});await load(1000,800,1,true);
  const dpr=await browser.evaluate('devicePixelRatio');assert.ok(Math.abs(dpr-zoomFactor)<.001,'actual desktop page zoom');
  await measure(`Chrome ${zoomFactor*100}% zoom`,true,true);await playClick(`Chrome ${zoomFactor*100}%`);
  await click('agent-view');await settle();await measure(`Chrome ${zoomFactor*100}% Editor`,false);
  assert.deepEqual(browser.errors,[]);await browser.close();browser=undefined;
 }
 report.passed=true;console.log(`PASS: ${report.checks.length} responsive viewport checks; ${output}`);
}catch(error){report.failure=String(error.stack||error);if(browser)await browser.screenshot(path.join(output,'failure.png')).catch(()=>{});throw error}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await editor.close()}
