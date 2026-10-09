import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import {createSceneTerrainCache} from '../game/scene-terrain.js';
import {createBattle,presentedActBattle} from '../game/tactical.js';
import {makeGrenadeStack} from '../game/grenades.js';
const {Box3,Scene,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps}=await import('../web/lib/three/world-props.ts');
const {buildBuilding,buildIndependentWalls}=await import('../web/lib/three/world-buildings.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {presentWorld}=await import('../web/lib/three/presentation.ts');
const T=1.2360585147470482,eps=1e-5;
function renderProp(prop){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),before=structuredClone(prop),group=buildProps('damage',[prop],{terrain:{tiles:[]}},T,geometry,materials);
 assert.deepEqual(prop,before);return {group,dispose(){disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}
test('partial blast damage darkens local wear while retaining the exact prop geometry and admitted light',()=>{
 for(const type of ['table','chest','barrels','bed','cart']){
  const prop={id:type,type,x:2,y:3,footprint:{width:2,height:1},rotation:90},intact=renderProp(prop),damaged=renderProp({...prop,structureDamage:65});
  assert.equal(damaged.group.children.length,intact.group.children.length);
  for(const [n,mesh]of damaged.group.children.entries()){
   const original=intact.group.children[n];assert.equal(mesh.material.name,original.material.name);
   for(const name of ['position','normal','uv'])assert.deepEqual(mesh.geometry.getAttribute(name).array,original.geometry.getAttribute(name).array,`${type}: ${name} stays exact`);
   const colours=mesh.geometry.getAttribute('color').array,source=original.geometry.getAttribute('color').array;
   assert.ok(colours.some((value,index)=>value<source[index]));assert.ok(colours.every((value,index)=>value>source[index]*.79&&value<=source[index]));
  }
  intact.dispose();damaged.dispose();
 }
});
test('partial wall and window damage shades only that tile while retaining shape, materials, UVs and room cutaways',()=>{
 const vertices=group=>{
  const records=[];group.traverse(mesh=>{if(!mesh.geometry)return;const p=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv'),colour=mesh.geometry.getAttribute('color');
   for(let n=0;n<p.count;n++)records.push({key:[mesh.material.uuid,...[p.getX(n),p.getY(n),p.getZ(n),normal.getX(n),normal.getY(n),normal.getZ(n),uv.getX(n),uv.getY(n)].map(value=>value.toFixed(5))].join(':'),x:p.getX(n),z:p.getZ(n),colour:colour.getX(n)});
  });return records.sort((a,b)=>a.key.localeCompare(b.key)||a.colour-b.colour);
 };
 for(const type of ['wall','window'])for(const independent of [false,true])for(const cutaway of [false,true]){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),building={id:'house',x:1,y:1,width:5,height:5,kind:'house',rooms:[{id:'room',cells:[{x:3,y:4},{x:4,y:3}]}]},near={x:3,y:5,type,blocked:type==='wall',material:'adobe',elevation:3,...(independent?{}:{buildingId:'house'})},far={x:5,y:3,type:'wall',blocked:true,material:'adobe',elevation:3,...(independent?{}:{buildingId:'house'})},input={terrain:{width:8,height:8,tiles:[near,far],buildings:independent?[]:[building],night:true},revealedRooms:cutaway?['room']:[],illumination:{'0:3,5':.25,'0:5,3':.8}},before=structuredClone(input);
  const build=source=>independent?buildIndependentWalls(source,T,geometry,materials):buildBuilding(building,source,T,geometry,materials),original=build(input),damaged=build({...input,terrain:{...input.terrain,tiles:[{...near,structureDamage:60},far]}}),a=vertices(original),b=vertices(damaged);
  assert.deepEqual(b.map(record=>record.key),a.map(record=>record.key),`${type}: geometry, normals, UVs and shared materials remain unchanged`);
  let worn=0,unaffected=0;
  for(let n=0;n<b.length;n++){
   assert.ok(b[n].colour<=a[n].colour+eps&&b[n].colour>=a[n].colour*.81-eps,'wear retains the admitted night illumination within a restrained shade');
   if(b[n].colour<a[n].colour-eps){worn++;assert.ok(Math.abs(b[n].x-near.x*T)<T*.75&&Math.abs(b[n].z-near.y*T)<T*.75,'only the affected tile changes');}
   if(b[n].x>4*T&&b[n].z<4*T){unaffected++;assert.equal(b[n].colour,a[n].colour,'unrelated wall sections keep their original illumination');}
  }
  assert.ok(worn>0&&unaffected>0);assert.deepEqual(input,before);disposeWorldNode(original);disposeWorldNode(damaged);geometry.dispose();materials.dispose();
 }
});
test('destroyed furniture shows only low debris inside every footprint and above its current floor',()=>{
 for(const type of ['table','bench','bed','chest','barrels','hay','cart','hearth','pottery','sacks','candle'])for(const rotation of [0,90,180,270])for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:3}])for(const elevation of [0,3]){
  const prop={id:type,type,x:2,y:3,footprint,rotation,elevation,structureDamage:100,destroyed:true,blocksMovement:false,open:true,obstacleHeight:.2},draw=renderProp(prop),bounds=new Box3().setFromObject(draw.group);
  assert.ok(bounds.min.y>=elevation-eps&&bounds.max.y<elevation+.2,`${type}: no intact silhouette remains`);
  assert.ok(bounds.min.x>=(prop.x-.5)*T-eps&&bounds.max.x<=(prop.x+footprint.width-.5)*T+eps,`${type}: debris fits X`);
  assert.ok(bounds.min.z>=(prop.y-.5)*T-eps&&bounds.max.z<=(prop.y+footprint.height-.5)*T+eps,`${type}: debris fits Z`);
  assert.equal(draw.group.children.some(mesh=>['world:flame','world:ember'].includes(mesh.material.name)),false);draw.dispose();
 }
 // A broken chest lock alone still retains its authored body.
 const lock=renderProp({id:'lock',type:'chest',x:0,y:0,broken:true});assert.ok(new Box3().setFromObject(lock.group).max.y>.7);lock.dispose();
});
test('blast damage replaces only its prop chunk, disposes old geometry, and reuses unchanged records',()=>{
 const near={id:'near',type:'table',x:2,y:3},remote={id:'remote',type:'chest',x:26,y:3},input={terrain:{width:32,height:8,tiles:[],props:[near,remote]}},before=structuredClone(input),scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});
 world.update(input);const root=scene.getObjectByName('sector-world'),first=root.getObjectByName('props:0:0,0'),far=root.getObjectByName('props:0:3,0');let disposals=0;for(const mesh of first.children)mesh.geometry.addEventListener('dispose',()=>disposals++);
 world.update(input);assert.equal(root.getObjectByName('props:0:0,0'),first);
 const damaged={...input,terrain:{...input.terrain,props:[{...near,structureDamage:30},remote]}};world.update(damaged);
 const wear=root.getObjectByName('props:0:0,0');assert.notEqual(wear,first);assert.equal(disposals,first.children.length);assert.equal(root.getObjectByName('props:0:3,0'),far);
 world.update(damaged);assert.equal(root.getObjectByName('props:0:0,0'),wear);
 const destroyed={...input,terrain:{...input.terrain,props:[{...near,structureDamage:100,destroyed:true},remote]}};world.update(destroyed);assert.ok(new Box3().setFromObject(root.getObjectByName('props:0:0,0')).max.y<.2);assert.equal(root.getObjectByName('props:0:3,0'),far);
 assert.deepEqual(input,before);world.dispose();
});
test('destroyed props remain behind the existing room disclosure boundary',()=>{
 const prop={id:'hidden',type:'chest',x:2,y:2,roomId:'room',buildingId:'house',structureDamage:100,destroyed:true,blocksMovement:false},state={width:5,height:5,tiles:[{x:2,y:2,type:'floor',buildingId:'house'}],buildings:[{id:'house',x:1,y:1,width:3,height:3,rooms:[{id:'room',cells:[{x:2,y:2}]}]}],props:[prop],lights:[],units:[],groundItems:[]},before=structuredClone(state),terrain=createSceneTerrainCache()(state);
 const hidden=presentWorld(state,terrain,[],new Set(),[],0);assert.equal(hidden.terrain.props.some(item=>item.id===prop.id),false);
 const shown=presentWorld(state,terrain,[],new Set(['room']),[],0);assert.equal(shown.terrain.props.find(item=>item.id===prop.id).destroyed,true);assert.deepEqual(state,before);
});
test('destroyed building and independent doors retain a clear standing opening and low timber debris',()=>{
 for(const axis of ['x','y'])for(const independent of [false,true]){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),building={id:'house',x:1,y:1,width:5,height:5,kind:'house',rooms:[]},point=axis==='x'?{x:3,y:5}:{x:5,y:3},door={...point,type:'door',doorId:'blast-door',open:true,broken:true,destroyed:true,structureDamage:100,blocked:false,elevation:3,...(independent?{}:{buildingId:'house'})};
  const tiles=[door,...[-1,1].map(n=>({x:point.x+(axis==='x'?n:0),y:point.y+(axis==='y'?n:0),type:'wall',blocked:true,elevation:3,...(independent?{}:{buildingId:'house'})}))],input={terrain:{width:8,height:8,tiles,buildings:independent?[]:[building]}},before=structuredClone(input),group=independent?buildIndependentWalls(input,T,geometry,materials):buildBuilding(building,input,T,geometry,materials),debris=group.getObjectByName('door:blast-door');
  group.updateMatrixWorld(true);assert.ok(debris);const bounds=new Box3().setFromObject(debris);assert.ok(bounds.min.y>=3-eps&&bounds.max.y<3.2);assert.equal(debris.userData.destroyed,true);
  const centre=bounds.getCenter(new Vector3()),from=centre.clone().add(new Vector3(axis==='y'?.8:0,1,axis==='x'?.8:0)),direction=new Vector3(axis==='y'?-1:0,0,axis==='x'?-1:0);
  assert.equal(new Raycaster(from,direction,0,2).intersectObject(debris,true).length,0);assert.equal(debris.children.some(node=>node.name.startsWith('door-leaf:')),false);assert.deepEqual(input,before);disposeWorldNode(group);geometry.dispose();materials.dispose();
 }
});
test('a real recorded grenade flight retains intact furniture until its durable blast result',()=>{
 const state=createBattle([{id:'thrower',name:'Lanzador',x:2,y:3,weapon:0,activeSlot:'item',activeItem:'inventory:grenades',inventory:{grenades:makeGrenadeStack()},strength:100,dexterity:100,marksmanship:100}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,n)=>({x:n%12,y:Math.floor(n/12),type:'grass',blocked:false,cover:0})),props:[{id:'blast-table',type:'table',x:8,y:4,blocksMovement:true}],enemies:[],exploration:true}),before=structuredClone(state),result=presentedActBattle(state,{type:'throwGrenade',unitId:'thrower',x:8,y:3}),cache=createSceneTerrainCache(),scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});
 assert.equal(result.state.lastError,null);assert.deepEqual(result.frames.map(frame=>frame.type),['prepare','effect','result']);assert.equal(result.state.props[0].destroyed,true);
 for(const frame of result.frames){
  const shown=frame.state,input=presentWorld(shown,cache(shown),shown.units.filter(unit=>unit.side==='player'),new Set(shown.revealedRooms),[],0);world.update(input);
  const prop=input.terrain.props.find(item=>item.id==='blast-table'),bounds=new Box3().setFromObject(scene.getObjectByName('sector-world').getObjectByName('props:0:1,0'));
  if(frame.type==='result'){assert.equal(prop.destroyed,true);assert.ok(bounds.max.y<.2);}
  else{assert.equal(prop.destroyed,undefined);assert.ok(bounds.max.y>.7);}
 }
 assert.deepEqual(state,before);world.dispose();
});
