import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Box3,Mesh}=await import('../web/node_modules/three/build/three.module.js');
const {GLTFLoader}=await import('../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {markActorMaterials}=await import('../web/lib/three/actor-occlusion.ts');
const manifest=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url)));
const packed=readFileSync(new URL('../web/public/models/characters/equipment.glb',import.meta.url));
const equipment=await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength),'');
const assets={manifest,equipment};
const terrain={width:4,height:6,tiles:Array.from({length:24},(_,n)=>({x:n%4,y:Math.floor(n/4),type:'grass',elevation:0}))};
const ready=()=>new Promise(resolve=>queueMicrotask(resolve));

test('floor weapons and supplies use the actual carried GLB models, stay on the surface and preserve the shared assets',async()=>{
 const ids=[...Array.from({length:14},(_,n)=>String(1800+n)),'medkits','rations','ammunition','torches','boleadoras','grenade','crowbar','key','lockpick','pliers'];
 const loot=ids.map((id,n)=>({id:`drop-${id}`,x:n%4,y:Math.floor(n/4),elevation:n%2?3:0,...(n<14?{weapon:Number(id)}:{item:id,count:1})})),input={terrain,loot},before=structuredClone(input);
 const sourceGeometry=new Map();equipment.scene.traverse(object=>{if(object instanceof Mesh){sourceGeometry.set(object.geometry,{positions:Array.from(object.geometry.getAttribute('position').array),disposed:0});object.geometry.addEventListener('dispose',()=>sourceGeometry.get(object.geometry).disposed++);}});
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:1.2,assetUrl:path=>path,equipment:Promise.resolve(assets)});world.update(input);await ready();
 assert.equal(world.inspect().pendingModels,0);assert.deepEqual(world.inspect().assetErrors,[]);
 for(const [n,id]of ids.entries()){
  const node=scene.getObjectByName(`loot:drop-${id}`),spec=manifest.equipment.items[id];assert.deepEqual(node.userData.modelNodes,[spec.node]);
  const bounds=new Box3().setFromObject(node);assert.ok(Math.abs(bounds.min.y-loot[n].elevation-.006)<1e-5,`${id} sits on its admitted floor`);
  assert.ok(bounds.max.x>bounds.min.x&&bounds.max.z>bounds.min.z);
 }
 const rifle=new Box3().setFromObject(scene.getObjectByName('loot:drop-1800'));assert.ok(rifle.max.y-rifle.min.y<.3,'the rifle lies along the floor, rather than becoming a supply box');
 world.update({terrain});assert.equal(world.inspect().semanticIds.some(id=>id.startsWith('loot:')),false);world.dispose();
 for(const [geometry,snapshot]of sourceGeometry){assert.deepEqual(Array.from(geometry.getAttribute('position').array),snapshot.positions);assert.equal(snapshot.disposed,0,'removing a floor item cannot dispose the carried shared geometry');}
 assert.deepEqual(input,before);
});

test('equipment admission uses the current visible floor records and cannot revive a removed item after an async load',async()=>{
 let load;const promise=new Promise(resolve=>load=resolve),scene=new Scene(),world=createSectorWorld(scene,{tileMetres:1.2,assetUrl:path=>path,equipment:promise});
 world.update({terrain,loot:[{id:'old',weapon:1800,x:1,y:1}]});assert.equal(world.inspect().pendingModels,1);
 world.update({terrain,loot:[{id:'current',weapon:'campaign-rifle',weaponMetadata:{contentWeapon:{template:1802}},x:2,y:1,elevation:3}]});load(assets);await ready();
 assert.equal(scene.getObjectByName('loot:old'),undefined);assert.deepEqual(scene.getObjectByName('loot:current').userData.modelNodes,['item_1802']);
 world.dispose();assert.equal(scene.getObjectByName('sector-world'),undefined);
});

test('floor models retain world occlusion and admitted night light without owning carried materials or textures',async()=>{
 markActorMaterials(equipment.scene);
 const sources=new Set();equipment.scene.traverse(object=>{if(object instanceof Mesh)sources.add(object.material);});
 const sourceDisposed=new Map([...sources].map(material=>[material,0]));for(const material of sources)material.addEventListener('dispose',()=>sourceDisposed.set(material,sourceDisposed.get(material)+1));
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:1.2,assetUrl:path=>path,equipment:Promise.resolve(assets)});
 const input={terrain:{...terrain,night:true},illumination:{'0:1,1':0,'0:2,1':1},loot:[{id:'dark',weapon:1800,x:1,y:1},{id:'lit',weapon:1800,x:2,y:1}]};world.update(input);await ready();
 const retained=new Set(),disposed=new Map();
 for(const [id,light]of [['dark',.27],['lit',1]])scene.getObjectByName(`loot:${id}`).traverse(object=>{if(object instanceof Mesh){
  assert.equal(sources.has(object.material),false);assert.equal(object.material.vertexColors,true);assert.equal(object.material.stencilRef,1);assert.equal(object.material.stencilWrite,true);
  for(const value of object.geometry.getAttribute('color').array)assert.ok(Math.abs(value-light)<1e-6,'actual floor model receives the admitted cell light');
  retained.add(object.material);
 }});
 // Actor occlusion marks shared carried materials every frame. It must never
 // change a floor material, or cause floor removal to dispose a carried asset.
 markActorMaterials(equipment.scene);for(const material of retained){assert.equal(material.stencilRef,1);disposed.set(material,0);material.addEventListener('dispose',()=>disposed.set(material,disposed.get(material)+1));}
 world.update({terrain});for(const material of retained)assert.equal(disposed.get(material),0,'cached world material survives pile replacement');
 world.dispose();for(const material of retained)assert.equal(disposed.get(material),1);for(const material of sources){assert.equal(sourceDisposed.get(material),0);assert.equal(material.stencilRef,0);}
});
