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
