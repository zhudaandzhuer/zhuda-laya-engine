import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedPrefabEnvironment, auditPrefabEnvironment } from '../packages/compiler/prefab-environment.mjs';

test('DPR 2 requested but DPR 1 measured fails independently of a pixel comparison', () => {
  const requested = requestedPrefabEnvironment('http://localhost/preview?width=1024&height=576&dpr=2');
  const measured = {viewport:{width:800,height:457},dpr:1,
    canvas:{css:{width:1024,height:576},backing:{width:1024,height:576}},stage:{width:1024,height:576,scaleX:1,scaleY:1}};
  const audit = auditPrefabEnvironment(requested, measured);
  assert.equal(audit.passed,false);
  assert.match(audit.issues.join(';'), /devicePixelRatio/);
  assert.match(audit.issues.join(';'), /viewport.width/);
  assert.match(audit.issues.join(';'), /canvas.backing.width/);
  measured.viewport={...requested.viewport}; measured.dpr=2; measured.canvas.backing={width:2048,height:1152};
  assert.equal(auditPrefabEnvironment(requested,measured).passed,true);
});

test('viewport, canvas and render DPR can be declared independently with bounded input', () => {
  const request=requestedPrefabEnvironment('http://localhost/scene?width=320&height=240&dpr=2', {viewportWidth:800, viewportHeight:600,renderDpr:1});
  assert.deepEqual(request.viewport,{width:800,height:600});
  assert.equal(request.renderDpr,1);
  for(const value of ['0','NaN','-1','4']) assert.throws(()=>requestedPrefabEnvironment(`http://localhost/?dpr=${value}`),/Invalid/);
  assert.throws(()=>requestedPrefabEnvironment('http://localhost/?width=NaN'),/Invalid/);
  assert.equal(auditPrefabEnvironment(undefined,undefined).passed,false);
});
