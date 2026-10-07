import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {WEAPONS} from '../game/firearm-definitions.js';
import {banks,manifest,nativeScene,readGlb} from './character-bank-fixture.mjs';

test('Escopeta Criolla has one physical bore on its unchanged one-charge muzzle',()=>{
 assert.equal(WEAPONS[1804].capacity,1,'The existing firearm definition remains the rule authority');
 const data=readGlb(manifest.equipment.url),scene=nativeScene(data.json),item=scene.getObjectByName('item_1804'),metal=[];
 item.traverse(node=>{
  const definition=data.json.nodes.find(entry=>entry.name===node.name);if(definition?.mesh===undefined)return;
  for(const primitive of data.json.meshes[definition.mesh].primitives){
   if(data.json.materials[primitive.material]?.name!=='Equipment_Blackened_Steel')continue;
   const positions=data.access(primitive.attributes.POSITION);for(let index=0;index<positions.length;index+=3)metal.push(item.worldToLocal(node.localToWorld(new Vector3(...positions.slice(index,index+3)))));
  }
 });
 const marker=item.worldToLocal(scene.getObjectByName('muzzle_1804').getWorldPosition(new Vector3())),barrelEnd=.94*.85,ring=metal.filter(point=>Math.abs(point.x-barrelEnd)<1e-6);
 assert.equal(ring.length,16,'The actual exported barrel has one front ring');
 for(const point of ring)assert.ok(Math.abs(Math.hypot(point.y-.055,point.z)-.0105)<1e-6,'Every ring vertex belongs to the single centred bore');
 assert.ok(Math.max(...metal.map(point=>point.x))<=marker.x,'The fitted front sight stays behind the actual muzzle');
 assert.ok(Math.abs(marker.x-.945*.85)<1e-6);assert.ok(Math.abs(marker.y-.055)<1e-6);assert.equal(marker.z,0);
 for(const bank of Object.values(banks))for(const prefix of ['stand','crouch','prone','mounted']){
  const spec=bank.specs.find(clip=>clip.name===`${prefix}.reload.long-gun.1804`);assert.ok(new Vector3(...spec.loadingContact.muzzle).distanceTo(marker)<1e-6,'The existing loading contact remains on the actual muzzle');assert.equal(spec.barrelClips,undefined,'A one-charge weapon cannot acquire a second loading interval');
 }
});
