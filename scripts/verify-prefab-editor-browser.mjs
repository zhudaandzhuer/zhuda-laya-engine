import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildPrefabEditorBundle, createPrefabEditorServer } from '../packages/compiler/prefab-editor-server.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { png } from './lib/neutral-png.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-editor-coordinates-'));
const output = path.resolve(process.env.EDITOR_EVIDENCE_DIR || path.join(root, 'evidence'));
await fs.mkdir(path.join(root, 'assets'), { recursive: true });
await fs.mkdir(output, { recursive: true });
const colors = { flat: [231, 54, 91], rotated: [39, 205, 123], reflected: [64, 131, 242] };
for (const [id, color] of Object.entries(colors)) await fs.writeFile(path.join(root, 'assets', `${id}.png`), png([...color, 255]));
const image = (id, extra = {}) => ({ _$id: id, _$type: 'Image', name: id, skin: `${id}.png`, width: 120, height: 80, ...extra });
const fixture = (type = 'Sprite') => ({ _$ver: 1, _$id: 'root', _$type: type, name: 'Root', width: 800, height: 1000, _$child: [
  { _$id: 'panel', _$type: 'Sprite', name: 'Panel', x: 104.5, y: 150, width: 300, height: 200,
    _$child: [image('flat', { x: 80, y: 60, pivotX: 12, pivotY: 8 })] },
  { _$id: 'transformed', _$type: 'Sprite', name: 'Transformed', x: 450, y: 320, scaleX: 1.25, scaleY: 0.8, rotation: 27, pivotX: 20, pivotY: 15,
    _$child: [image('rotated', { x: 60, y: 90, rotation: -13, scaleX: 1.1, anchorX: 0.5, anchorY: 0.25 }),
      { _$id: 'reflection', _$type: 'Sprite', name: 'Reflection', x: 30, y: 300, rotation: -22, scaleX: -0.75, scaleY: 1.2,
        _$child: [image('reflected', { x: 65, y: 80, anchorX: 0.3, anchorY: 0.6 })] }] },
] });
const definitions = { 'fixture.lh': fixture(), 'fixture.ls': fixture('Scene') };
for (const [file, data] of Object.entries(definitions)) await fs.writeFile(path.join(root, 'assets', file), JSON.stringify(data));

const report = { baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), date: new Date().toISOString(),
  environment: { os: `${os.platform()} ${os.release()}`, node: process.version, renderer: 'real Laya WebGL in isolated headless Chrome' },
  sourceHashes: {}, checks: [], limits: ['Physical mobile, Windows, Firefox and Safari are not covered.'] };
for (const file of ['packages/compiler/prefab-editor-client.ts', 'packages/compiler/prefab-editor-server.mjs', 'scripts/verify-prefab-editor-browser.mjs', 'scripts/lib/chrome-fixture.mjs']) {
  report.sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(new URL(`../${file}`, import.meta.url))).digest('hex');
}
const bundle = await buildPrefabEditorBundle();
report.editorBundleSha256 = crypto.createHash('sha256').update(bundle).digest('hex');
const editor = await createPrefabEditorServer({ projectRoot: root, prefab: 'assets/fixture.lh', port: 0, bundle });
const { port } = await editor.listening;
const base = `http://127.0.0.1:${port}/`;
let browser;
const near = (actual, expected, label, tolerance = 1.5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: actual ${actual}, expected ${expected} ± ${tolerance}`);
const settle = () => browser.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 80))))');
const click = id => browser.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
async function load(file, width, height, dpr) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
  await browser.send('Page.navigate', { url: `${base}?prefab=assets/${file}` });
  await browser.waitFor(`document.querySelector('[data-node-id="flat"]') && document.querySelector('#status').textContent==='Saved' && document.querySelector('canvas')`);
  await settle();
}
function ancestry(data, id, parents = []) {
  if (data._$id === id) return [...parents, data];
  for (const child of data._$child || []) { const found = ancestry(child, id, [...parents, data]); if (found) return found; }
}
// Independent oracle from authored JSON. Do not use the editor's coordinate
// functions (or Laya localToGlobal) to calculate expected selection geometry.
function stagePoint(chain, point) {
  let { x, y } = point;
  for (const node of [...chain].reverse()) {
    const pivotX = node.pivotX ?? (node.anchorX || 0) * (node.width || 0);
    const pivotY = node.pivotY ?? (node.anchorY || 0) * (node.height || 0);
    const a = (node.rotation || 0) * Math.PI / 180;
    const xx = (x - pivotX) * (node.scaleX ?? 1), yy = (y - pivotY) * (node.scaleY ?? 1);
    x = (node.x || 0) + xx * Math.cos(a) - yy * Math.sin(a);
    y = (node.y || 0) + xx * Math.sin(a) + yy * Math.cos(a);
  }
  return { x, y };
}
async function inspect(id) {
  return browser.evaluate(`(() => {
    const rect = element => { const r=element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
    const canvas=document.querySelector('canvas'), shell=document.querySelector('#stage-shell'), box=document.querySelector('#selection-box');
    const r=shell.getBoundingClientRect(), m=new DOMMatrix(getComputedStyle(box).transform);
    const width=parseFloat(box.style.width), height=parseFloat(box.style.height);
    const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>({x:r.x+shell.clientLeft+parseFloat(box.style.left||0)+m.a*x+m.c*y+m.e,y:r.y+shell.clientTop+parseFloat(box.style.top||0)+m.b*x+m.d*y+m.f}));
    function find(n){ if(n.__zhudaPrefabId===${JSON.stringify(id)})return n; for(let i=0;i<n.numChildren;i++){const hit=find(n.getChildAt(i));if(hit)return hit;} }
    const node=find(Laya.stage), anchor=rect(document.querySelector('#anchor-marker'));
    return { canvas: {...rect(canvas), backingWidth:canvas.width, backingHeight:canvas.height, style:canvas.getAttribute('style')},
      shell:{...rect(shell),innerWidth:shell.clientWidth,innerHeight:shell.clientHeight}, box:rect(box), corners,
      anchor:{x:anchor.x+anchor.width/2,y:anchor.y+anchor.height/2}, node:{x:node.x,y:node.y},
      dpr:devicePixelRatio, viewport:{width:innerWidth,height:innerHeight},visualScale:visualViewport.scale,error:document.querySelector('#error').textContent };
  })()`);
}
async function pixelBounds(id) {
  await browser.screenshot(path.join(output, `${report.checks.length}-${id}-overlay.png`));
  await browser.evaluate(`document.querySelectorAll('#selection-box,#anchor-marker').forEach(e=>e.style.visibility='hidden')`);
  const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
  await browser.evaluate(`document.querySelectorAll('#selection-box,#anchor-marker').forEach(e=>e.style.visibility='')`);
  await fs.writeFile(path.join(output, `${report.checks.length}-${id}.png`), Buffer.from(shot.data, 'base64'));
  const bounds = await browser.evaluate(`(async()=>{
    const img=await createImageBitmap(await(await fetch('data:image/png;base64,${shot.data}')).blob());
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height).data;
    const color=${JSON.stringify(colors[id])};let x0=Infinity,y0=Infinity,x1=-1,y1=-1,count=0;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const at=(y*img.width+x)*4;
      if(color.every((v,c)=>Math.abs(v-pixels[at+c])<=4)){count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
    const sx=img.width/innerWidth,sy=img.height/innerHeight;
    return {x:x0/sx,y:y0/sy,width:(x1-x0+1)/sx,height:(y1-y0+1)/sy,count,screenshot:{width:img.width,height:img.height}};
  })()`);
  return {...bounds, artifacts:{overlay:`${report.checks.length}-${id}-overlay.png`,image:`${report.checks.length}-${id}.png`}};
}
async function geometry(file, id, label, pixels = true) {
  await browser.evaluate(`document.querySelector('[data-node-id="${id}"]').click()`);
  await settle();
  const m = await inspect(id), chain = ancestry(definitions[file], id), node = chain.at(-1);
  report.lastMeasurement={label,id,...m};
  assert.equal(m.error, '', label);
  near(m.canvas.width, m.shell.innerWidth, `${label}: displayed canvas width`);
  near(m.canvas.height, m.shell.innerHeight, `${label}: displayed canvas height`);
  const toClient = p => ({ x: m.canvas.x + p.x / 800 * m.canvas.width, y: m.canvas.y + p.y / 1000 * m.canvas.height });
  const corners = [[0,0],[node.width,0],[node.width,node.height],[0,node.height]].map(([x,y]) => toClient(stagePoint(chain,{x,y})));
  for (let i=0;i<4;i++) for(const axis of ['x','y']) near(m.corners[i][axis], corners[i][axis], `${label}: corner ${i}.${axis}`);
  const pivot = toClient(stagePoint(chain, { x: node.pivotX ?? (node.anchorX || 0)*node.width, y:node.pivotY ?? (node.anchorY || 0)*node.height }));
  for(const axis of ['x','y']) near(m.anchor[axis],pivot[axis],`${label}: pivot.${axis}`);
  const bounds={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y))};
  bounds.width=Math.max(...corners.map(p=>p.x))-bounds.x;bounds.height=Math.max(...corners.map(p=>p.y))-bounds.y;
  let painted;
  if (pixels) {
    painted=await pixelBounds(id);assert.ok(painted.count>40, `${label}: actual image pixels`);
    for(const key of ['x','y','width','height']) near(painted[key],bounds[key],`${label}: painted ${key}`,3);
  }
  report.checks.push({label,id,...m,expected:{corners,pivot,bounds},painted});
  return {metrics:m,toClient,chain};
}
const mouse = (type, x, y, extra = {}) => browser.send('Input.dispatchMouseEvent', { type, x, y,
  ...(type === 'mouseMoved' ? { buttons: 1 } : { button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }), ...extra });
async function drag(file, id, label) {
  const { metrics, toClient, chain } = await geometry(file,id,`${label}: before`,false);
  const node=chain.at(-1), before={x:node.x,y:node.y}, grab={x:50,y:35};
  const start=toClient(stagePoint(chain,grab));
  await mouse('mouseMoved',start.x,start.y,{buttons:0});await settle();
  const native=await browser.evaluate('({x:Laya.stage.mouseX,y:Laya.stage.mouseY})');
  await mouse('mousePressed',start.x,start.y);
  const down=await inspect(id);
  for(const axis of ['x','y']) near(down.node[axis],before[axis],`${label}: no jump ${axis}`,0.01);
  const expectedDown=stagePoint(chain,grab);
  for(const axis of ['x','y']) near(native[axis],expectedDown[axis],`${label}: native cursor ${axis}`,2.5);
  const dx=27,dy=19, parent=chain.slice(0,-1), p=stagePoint(parent,{x:0,y:0}),px=stagePoint(parent,{x:1,y:0}),py=stagePoint(parent,{x:0,y:1});
  const aa=px.x-p.x,bb=px.y-p.y,cc=py.x-p.x,dd=py.y-p.y,det=aa*dd-bb*cc;
  const sx=dx*800/metrics.canvas.width,sy=dy*1000/metrics.canvas.height;
  const localDelta={x:(dd*sx-cc*sy)/det,y:(aa*sy-bb*sx)/det};
  for(const t of [0.25,0.6,1]) {
    await mouse('mouseMoved',start.x+dx*t,start.y+dy*t);await settle();
    const moved=await inspect(id);
    for(const axis of ['x','y']) near(moved.node[axis],before[axis]+localDelta[axis]*t,`${label}: parent-local ${axis}`,0.02);
    const actualChain=[...parent,{...node,...moved.node}],actualGrab=toClient(stagePoint(actualChain,grab));
    near(actualGrab.x,start.x+dx*t,`${label}: cursor x`,0.15);near(actualGrab.y,start.y+dy*t,`${label}: cursor y`,0.15);
  }
  await mouse('mouseReleased',start.x+dx,start.y+dy);await settle();
  node.x=before.x+localDelta.x;node.y=before.y+localDelta.y;
  await geometry(file,id,`${label}: after`);
  await click('undo');await settle();
  Object.assign(node,before);await geometry(file,id,`${label}: undo`,false);
  await click('redo');await settle();
  node.x=before.x+localDelta.x;node.y=before.y+localDelta.y;
  await geometry(file,id,`${label}: redo`,false);
  await click('save');await browser.waitFor(`document.querySelector('#status').textContent.startsWith('Saved')`);
  const saved=JSON.parse(await fs.readFile(path.join(root,'assets',file),'utf8'));
  for(const axis of ['x','y']) near(ancestry(saved,id).at(-1)[axis],node[axis],`${label}: persisted ${axis}`,0.02);
  await fs.access(path.join(root,'assets',file+'.bak'));
  await click('reload');await settle();await geometry(file,id,`${label}: reload`);
  report.checks.push({label:`${label}: drag/save/reload`,native,expectedDown,before,localDelta});
}
async function cancelledDrag(file,id,mode) {
  const {toClient,chain}=await geometry(file,id,`${mode}: before`,false),node=chain.at(-1),before={x:node.x,y:node.y};
  const start=toClient(stagePoint(chain,{x:50,y:35}));
  if(mode==='lost capture') {
    await browser.evaluate(`document.addEventListener('pointerdown',event=>{globalThis.__editorTestPointerId=event.pointerId},{once:true})`);
    const point=(x,y)=>({id:1,x,y,radiusX:1,radiusY:1,force:1});
    await browser.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(start.x,start.y)]});
    await browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(start.x+20,start.y+15)]});
    await settle();
    assert.notDeepEqual((await inspect(id)).node,before,`${mode}: moved`);
    assert.equal(await browser.evaluate(`document.querySelector('canvas').hasPointerCapture(globalThis.__editorTestPointerId)`),true,`${mode}: real capture acquired`);
    await browser.evaluate(`document.querySelector('canvas').releasePointerCapture(globalThis.__editorTestPointerId)`);
    await browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(start.x+21,start.y+16)]});
    await browser.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } else if(mode==='multi-touch cancel') {
    const point=(id,x,y)=>({id,x,y,radiusX:1,radiusY:1,force:1});
    await browser.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,start.x,start.y)]});
    await browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,start.x+15,start.y+10)]});
    await settle();const first=await inspect(id);
    assert.ok(Math.abs(first.node.x-before.x)>0.1,`${mode}: first pointer moved`);
    await browser.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,start.x+15,start.y+10),point(2,start.x+55,start.y+30)]});
    await browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,start.x+15,start.y+10),point(2,start.x+85,start.y+60)]});
    await settle();const second=await inspect(id);assert.deepEqual(second.node,first.node,`${mode}: second pointer ignored`);
    await browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,start.x+20,start.y+15)]});
    await settle();const continued=await inspect(id);assert.notDeepEqual(continued.node,first.node,`${mode}: primary pointer continues`);
    await browser.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  } else {
    await browser.evaluate(`document.addEventListener('pointerdown',event=>{globalThis.__editorTestPointerId=event.pointerId},{once:true})`);
    await mouse('mouseMoved',start.x,start.y,{buttons:0});await mouse('mousePressed',start.x,start.y);
    await mouse('mouseMoved',start.x+20,start.y+15);await settle();
    assert.notDeepEqual((await inspect(id)).node,before,`${mode}: moved`);
    await browser.evaluate(`window.dispatchEvent(new Event('blur'))`);
    await settle();await mouse('mouseReleased',start.x+20,start.y+15);
  }
  await settle();
  for(const axis of ['x','y']) near((await inspect(id)).node[axis],before[axis],`${mode}: restored ${axis}`,0.01);
  assert.equal(await browser.evaluate(`document.querySelector('#status').textContent`),'Saved',`${mode}: source stays clean`);
  await geometry(file,id,`${mode}: restored`,false);
  if(mode==='blur') await browser.evaluate(`window.dispatchEvent(new Event('focus'))`);
}
try {
  browser=await chromeFixture();
  report.environment.chrome=await browser.send('Browser.getVersion');
  let normalSize;
  for(const dpr of [1,1.5,2]) {
    for(const file of ['fixture.lh','fixture.ls']) {
      console.log(`Checking ${file}, DPR ${dpr}`);
      await load(file,1440,1200,dpr);
      for(const id of Object.keys(colors)) {
        const {metrics}=await geometry(file,id,`${file} DPR ${dpr}`);
        normalSize ??= metrics.canvas;
        for(const axis of ['width','height']) near(metrics.canvas[axis],normalSize[axis],`DPR ${dpr}: identical image scale ${axis}`,0.75);
        near(metrics.canvas.backingWidth,metrics.canvas.width*dpr,`DPR ${dpr}: backing width`,2);
        await drag(file,id,`${file} DPR ${dpr} ${id}`);
      }
      await click('agent-view');await settle();
      await geometry(file,'reflected',`${file} DPR ${dpr}: Agent View`);
      await browser.send('Emulation.setDeviceMetricsOverride',{width:1100,height:900,deviceScaleFactor:dpr,mobile:false});await settle();
      await geometry(file,'rotated',`${file} DPR ${dpr}: Agent resize`);
      await click('agent-view');await settle();
      await geometry(file,'flat',`${file} DPR ${dpr}: Editor resize`);
    }
  }
  await cancelledDrag('fixture.ls','rotated','multi-touch cancel');
  await cancelledDrag('fixture.ls','reflected','blur');
  await cancelledDrag('fixture.ls','flat','lost capture');
  assert.deepEqual(browser.errors,[]);
  await browser.close();browser=undefined;
  for(const zoomFactor of [0.8,1.25,1.5]) {
    browser=await chromeFixture({zoomFactor});
    await load('fixture.lh',1600,1300,1);
    const zoom=await browser.evaluate('({dpr:devicePixelRatio,width:innerWidth,visualScale:visualViewport.scale})');
    near(zoom.dpr,zoomFactor,'actual Chrome page zoom DPR',0.001);
    near(zoom.width,1600/zoomFactor,'actual Chrome page zoom viewport',1);
    assert.equal(zoom.visualScale,1,'desktop page zoom, not pinch emulation');
    await geometry('fixture.lh','rotated',`Chrome zoom ${zoomFactor*100}%`);
    await drag('fixture.lh','reflected',`Chrome zoom ${zoomFactor*100}% reflected`);
    await click('agent-view');await settle();await geometry('fixture.lh','flat',`Chrome zoom ${zoomFactor*100}% Agent View`);
    assert.deepEqual(browser.errors,[]);
    await browser.close();browser=undefined;
  }
  report.passed=true;
  console.log(`PASS: ${report.checks.length} editor coordinate checks; ${output}`);
} catch(error) {
  report.passed=false;report.failure=String(error.stack||error);
  if(browser) await browser.screenshot(path.join(output,'failure.png')).catch(()=>{});
  throw error;
} finally {
  report.runtimeErrors=browser?.errors || [];
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Editor evidence: ${output}`);
  await browser?.close();await editor.close();
}
