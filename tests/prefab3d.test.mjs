import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaPrefabLibrary, inspectPrefabInstance } from '../packages/core/prefabs/PrefabLibrary.ts';
import { buildPrefabTree } from '../packages/core/prefabs/PrefabTree3D.ts';

const definition = {
  id: 'neutral/assembly', kind: '3d',
  tree: {
    materials: { pink: { albedoColor: [1,.4,.5,1] }, blue: { albedoColor: [.2,.4,1,1] } },
    root: { name: 'Root', children: [{ name: 'Pivot', children: [
      { name: 'Body', mesh: { type: 'capsule' }, material: 'pink', localPosition: [0,1,0] },
      { name: 'Accessory', mesh: { type: 'cone' }, material: 'blue', active: false },
    ] }] },
    sockets: { top: 'Pivot/Accessory' },
  },
  states: { idle: {}, turn: { Pivot: { localRotationEuler: [0,45,0] }, 'Pivot/Body': { material: 'blue' }, 'Pivot/Accessory': { active: true } } },
};
function install() {
  const previous = globalThis.Laya;
  const resources = [];
  class Resource { destroyed = false; constructor(){ resources.push(this); } destroy(){ assert.equal(this.destroyed,false); this.destroyed=true; } }
  class Vector3 { constructor(x=0,y=0,z=0){ Object.assign(this,{x,y,z}); } }
  class Node {
    children=[]; name=''; active=true; transform={}; destroyed=false;
    get numChildren(){return this.children.length;}
    addChild(n){this.children.push(n);n.parent=this;return n;}
    getChildAt(i){return this.children[i];}
    destroy(){if(this.destroyed)return;this.destroyed=true;for(const n of this.children)n.destroy();if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  }
  class MeshNode extends Node { constructor(mesh){super();this.mesh=mesh;this.meshRenderer={};} }
  globalThis.Laya={Sprite3D:Node,MeshSprite3D:MeshNode,Vector3,Color:class{},BlinnPhongMaterial:Resource,PrimitiveMesh:Object.fromEntries(['Box','Sphere','Plane','Cone','Cylinder','Capsule'].map(n=>['create'+n,()=>new Resource()]))};
  return { resources, restore(){globalThis.Laya=previous;} };
}
test('3D shared Prefab tree mounts real hierarchy, switches/restores state and releases 30 cycles', async()=>{
  const fake=install();
  try{
    const library=new ZhudaPrefabLibrary({provider:{name:'unused',load(){throw Error('primitive must not fetch');}},definitions:[definition]});
    for(let i=0;i<30;i++){
      const instance=await library.instantiate('neutral/assembly',{state:'turn'});
      assert.equal(instance.root.numChildren,1);
      assert.equal(instance.find('Pivot').transform.localRotationEuler.y,45);
      assert.equal(instance.socket('top').active,true);
      const blue=instance.find('Pivot/Body').meshRenderer.sharedMaterial;
      instance.applyState('idle');
      assert.equal(instance.find('Pivot').transform.localRotationEuler.y,0);
      assert.equal(instance.socket('top').active,false);
      assert.notEqual(instance.find('Pivot/Body').meshRenderer.sharedMaterial,blue);
      assert.equal(inspectPrefabInstance(instance.root).state,'idle');
      assert.match(instance.provenance.definitionHash,/^[a-f0-9]{64}$/);
      assert.equal(instance.provenance.kind,'3d');
      assert.throws(()=>instance.applyState('missing'),/Unknown prefab state/);
      instance.dispose();instance.dispose();
      assert.equal(inspectPrefabInstance(instance.root),null);
      assert.equal(library.report().instances,0);
      assert.ok(fake.resources.every(r=>r.destroyed));
      assert.throws(()=>instance.find(),/Disposed/);
    }
    library.dispose();
  }finally{fake.restore();}
});
test('3D validation rejects bad geometry/paths and applies states transactionally',()=>{
  const fake=install();
  try{
    for(const mutate of [
      t=>t.root.children.push(t.root.children[0]),
      t=>t.root.localScale=[0,1,1],
      t=>t.sockets.top='missing',
      t=>t.root.children[0].children[0].mesh.type='torus',
      t=>t.materials.pink.albedoColor=[NaN,0,0,1],
    ]){
      const tree=structuredClone(definition.tree);mutate(tree);
      assert.throws(()=>buildPrefabTree(tree));
    }
    assert.equal(fake.resources.length,0,'validation precedes allocation');
    const tree=buildPrefabTree(definition.tree);
    assert.throws(()=>tree.apply({Pivot:{localPosition:[1,2,3]},missing:{active:true}}),/path/);
    assert.equal(tree.find('Pivot').transform.localPosition.x,0);
    assert.throws(()=>tree.apply({Pivot:{material:'blue'}}),/material slot/);
    tree.dispose();assert.ok(fake.resources.every(r=>r.destroyed));
  }finally{fake.restore();}
});
test('3D recipe hashes change with authored inputs; cancelled instance never mounts',async()=>{
  const fake=install();
  try{
    const changed=structuredClone(definition);changed.id='changed';changed.tree.root.localPosition=[1,0,0];
    const lib=new ZhudaPrefabLibrary({provider:{name:'unused'},definitions:[definition,changed]});
    const a=await lib.instantiate(definition.id),b=await lib.instantiate(changed.id);
    assert.notEqual(a.provenance.definitionHash,b.provenance.definitionHash);
    const abort=new AbortController();
    const pending=lib.instantiate(definition.id,{signal:abort.signal});abort.abort();
    await assert.rejects(pending,/cancelled/);
    assert.equal(lib.report().instances,2);lib.dispose();
    assert.ok(fake.resources.every(r=>r.destroyed));
  }finally{fake.restore();}
});
