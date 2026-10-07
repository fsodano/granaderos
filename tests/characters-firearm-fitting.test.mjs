import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {manifest,nativeScene,readGlb} from './character-bank-fixture.mjs';
const data=readGlb(manifest.equipment.url),scene=nativeScene(data.json);
function positions(id){
 const item=scene.getObjectByName(`item_${id}`),materials={};
 item.traverse(node=>{
  const definition=data.json.nodes.find(entry=>entry.name===node.name);if(definition?.mesh===undefined)return;
  for(const primitive of data.json.meshes[definition.mesh].primitives){
   const values=data.access(primitive.attributes.POSITION),points=materials[data.json.materials[primitive.material].name]??=[];
   for(let offset=0;offset<values.length;offset+=3)points.push(item.worldToLocal(node.localToWorld(new Vector3(...values.slice(offset,offset+3)))));
  }
 });
 return materials;
}
function sameFit(actual,reference,scale,referenceScale,label){
 const compare=(a,b)=>{for(const axis of ['x','y','z'])if(Math.abs(a[axis]-b[axis])>1e-6)return a[axis]-b[axis];return 0;};
 const left=actual.map(point=>new Vector3(point.x/scale,point.y,point.z)).sort(compare),right=reference.map(point=>new Vector3(point.x/referenceScale,point.y,point.z)).sort(compare);
 assert.equal(left.length,right.length,`${label}: the source fitting retains its mesh topology`);
 for(let index=0;index<left.length;index++)assert.ok(left[index].distanceTo(right[index])<1e-6,`${label}: fitting vertex ${index} remains at its actual scaled barrel/stock position (${left[index].toArray()} vs ${right[index].toArray()})`);
}

test('all rifle material batches fit their actual barrel and stock length',()=>{
 const reference=positions('1804');
 for(const [id,scale]of Object.entries({'1800':1.12,'1801':1.10,'1802':.91,'1803':.76,'1804':.85,'1807':.58})){
  const item=scene.getObjectByName(`item_${id}`),muzzle=item.worldToLocal(scene.getObjectByName(`muzzle_${id}`).getWorldPosition(new Vector3())),actual=positions(id);
  assert.ok(Math.abs(muzzle.x-.945*scale)<1e-6,'The native muzzle marker keeps its verified length');
  for(const [material,points]of Object.entries(actual)){
   const expected=id==='1807'&&material==='Equipment_Blackened_Steel'?reference[material].map(point=>{
    if(Math.abs(point.x/.85-.94)>1e-6)return point;
    const flare=1+Math.max(0,(point.x/.85*scale-.40)/.14)*1.8;
    return new Vector3(point.x,.055+(point.y-.055)*flare,point.z*flare);
   }):reference[material];
   sameFit(points,expected,scale,.85,`${id} ${material}`);
  }
  assert.ok(Math.max(...actual.Equipment_Blackened_Steel.map(point=>point.x))<muzzle.x,`${id}: the fitted sight cannot extend past the physical muzzle`);
 }
});

test('each pistol lock and guard follow the same measured stretch as its physical barrel',()=>{
 const reference=positions('1805');
 for(const [id,scale]of Object.entries({'1805':1,'1806':1.13,'1808':.9})){
  const actual=positions(id);
  for(const [material,points]of Object.entries(actual)){
   const rings=material==='Equipment_Blackened_Steel'?reference[material].filter(point=>Math.abs(point.x-.025)<1e-6||Math.abs(point.x-.27)<1e-6):[];
   const expected=id==='1808'&&material==='Equipment_Blackened_Steel'?[...reference[material].map(point=>rings.includes(point)?point.clone().add(new Vector3(0,0,.011)):point),...rings.map(point=>point.clone().add(new Vector3(0,0,-.011)))]:reference[material];
   sameFit(points,expected,scale,1,`${id} ${material}`);
  }
 }
});
