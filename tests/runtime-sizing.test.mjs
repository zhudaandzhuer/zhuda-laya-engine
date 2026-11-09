import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeLaya342Stage } from '../packages/core/runtime3d/Laya342Adapters.ts';

test('DPR cap restores native ratio on success and sizing failure, with embedded input origin', () => {
  const Browser = {};
  const get = () => 3;
  Object.defineProperty(Browser, 'pixelRatio', {configurable:true, get});
  const calls = [];
  const stage = {
    _canvasTransform:{a:1/1.5,b:0,c:0,d:1/1.5,tx:0,ty:0},
    size(w,h) { calls.push([w,h,Browser.pixelRatio]); },
    setScreenSize(w,h) { calls.push([w,h,Browser.pixelRatio]); },
  };
  const canvas = {width:960,height:540,getBoundingClientRect:()=>({left:30,top:50})};
  resizeLaya342Stage({Browser,stage},640,360,320,180,1.5,canvas);
  assert.deepEqual(calls,[[320,180,1.5],[960,540,1.5]]);
  assert.equal(Object.getOwnPropertyDescriptor(Browser,'pixelRatio').get,get);
  assert.equal(stage._canvasTransform.tx,30);assert.equal(stage._canvasTransform.ty,50);
  stage.setScreenSize=()=>{throw Error('sizing failed')};
  assert.throws(()=>resizeLaya342Stage({Browser,stage},640,360,640,360,2),/sizing failed/);
  assert.equal(Browser.pixelRatio,3);
  assert.equal(Object.getOwnPropertyDescriptor(Browser,'pixelRatio').get,get);
});

test('managed container sizing cancels the native delayed window resize only',()=>{
 const queue=new Map(),other=()=>{},Browser={};let backing;
 const stage={updateCanvasSize(){backing=[1440,810];},size(){queue.set(this,this.updateCanvasSize);},setScreenSize(w,h){backing=[w,h];}};
 queue.set(other,other);
 const systemTimer={clearCallLater(caller,method){if(queue.get(caller)===method)queue.delete(caller);}};
 resizeLaya342Stage({Browser,stage,systemTimer},640,360,640,360,2);
 assert.deepEqual(backing,[1280,720]);assert.equal(queue.has(stage),false);assert.equal(queue.has(other),true);
 for(const [caller,fn]of queue)fn.call(caller);assert.deepEqual(backing,[1280,720]);
});

test('retinal backing pixels do not change the browser CSS canvas box',()=>{
 const Browser={}, style={};
 const stage={size(){},setScreenSize() {}};
 const canvas={width:780,height:1688,style,getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})};
 resizeLaya342Stage({Browser,stage},390,844,390,844,2,canvas);
 assert.equal(style.width,'390px');
 assert.equal(style.height,'844px');
 assert.equal(style.display,'block');
 assert.equal(style.touchAction,'none');
});


test('retinal CSS transform composes implicit browser sizing without changing native input scale',()=>{
 for(const dpr of [1,1.5,2]) {
  const style={left:'7px',top:'9px'}, matrix={a:1/dpr,b:0,c:0,d:1/dpr,tx:7,ty:9};
  const canvas={width:640*dpr,height:360*dpr,style,getBoundingClientRect:()=>({left:37,top:59})};
  const stage={_canvasTransform:matrix,size(){},setScreenSize(){}};
  resizeLaya342Stage({Browser:{},stage},640,360,640,360,dpr,canvas);
  assert.equal(style.transform,'matrix(1,0,0,1,0,0)');
  assert.equal(parseFloat(style.width),640);assert.equal(parseFloat(style.height),360);
  assert.equal(matrix.a,1/dpr);assert.equal(matrix.d,1/dpr);
  assert.equal(matrix.tx,37);assert.equal(matrix.ty,59);
 }
 // Rotated native canvas: compose each backing axis independently and retain
 // native alignment; embedded page placement still belongs to the input seam.
 const matrix={a:0,b:0.5,c:-0.5,d:0,tx:187,ty:9};
 const style={left:'7px',top:'9px'};
 const canvas={width:640,height:360,style,getBoundingClientRect:()=>({left:30,top:50})};
 const stage={_canvasTransform:matrix,size(){},setScreenSize(){}};
 resizeLaya342Stage({Browser:{},stage},320,180,320,180,2,canvas);
 assert.equal(style.transform,'matrix(0,1,-1,0,180,0)');
 assert.equal(matrix.a,0);assert.equal(matrix.b,0.5);assert.equal(matrix.c,-0.5);assert.equal(matrix.d,0);
 assert.equal(matrix.tx,210);assert.equal(matrix.ty,50);
});
