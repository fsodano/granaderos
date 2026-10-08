import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {asset,visual,surface,vertices,sample} from './helpers/climb-native-fixture.mjs';
import {predecessorActor} from './helpers/climb-crest-predecessor.mjs';
import {ladderGeometry} from '../game/climb-geometry.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const results=[],shift=(a,b)=>Math.max(0,...a.map((v,i)=>v.distanceTo(b[i])));
function crestEdges(actor,id,action,g,spec,list,extra={}) {
 const duration=Math.max(spec.duration,g.height/.65),values=[];
 for(const center of [.76,.82,.85]){
  const moves=[];
  for(const eps of [1e-4,1e-6]){sample(actor,id,action,g,spec,center-eps,0,extra);const before=vertices(list);sample(actor,id,action,g,spec,center+eps,0,extra);moves.push(shift(before,vertices(list)));}
  assert.ok(moves[1]<moves[0]*.0103+1e-5,'Complete skin/clothes/items have no fixed crest or fade jump');
  if(center===.76)assert.ok(moves[1]/(2e-6*duration)<8,'Independent full-surface crest velocity bound');
  values.push({center,coarseMm:moves[0]*1000,fineMm:moves[1]*1000});
 }
 return values;
}
for(const id of ['friar','woman-shawl','royalist','worker','surgeon','gaucho'])for(const lod of [0,1,2])test(`${id} LOD${lod}: complete appearance surfaces retain crest continuity`,async()=>{
 const source=await asset(id,lod),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES);
 for(const action of ['climbUp','climbDown']){
  const actor=new ActorRuntime(source,visual(id,action,{cue:undefined})),spec=source.clips.find(s=>s.name==='life.'+action),list=surface(actor).all;
  assert.ok(list.length>1000,'Actual published complete visible geometry');
  const edges=crestEdges(actor,id,action,g,spec,list),before=predecessorActor(source,id,action);
  for(const up of [.85,.86,.91,.98,1]){sample(actor,id,action,g,spec,up);sample(before,id,action,g,spec,up);assert.ok(shift(vertices(list),vertices(surface(before).all))<.000001,'Later complete appearance surface is the exact predecessor');}
  results.push({id,lod,action,visibleMeshes:[...new Set(list.map(v=>v.mesh.name))],edges});actor.dispose();before.dispose();
 }
});
for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${id} LOD${lod}: real carried items and worn overlays keep crest joins`,async()=>{
 const source=await asset(id,lod),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES);
 for(const action of ['climbUp','climbDown'])for(const [item,equipment,socket] of [['1800','long-gun','handRight'],['1805','short-gun','handLeft'],['1809','blade','handRight'],['1812','blade','handRight'],['medkits','unarmed','handRight']]){
  const spec=source.clips.find(s=>s.name==='life.'+action),extra={equipment,items:[{id:item,reference:'owned:'+item,socket}],garments:{headwear:'hat',outfit:'poncho',legwear:'trousers'}},actor=new ActorRuntime(source,visual(id,action,{cue:undefined,...extra}));
  sample(actor,id,action,g,spec,.76,0,extra);const list=surface(actor).all,items=list.filter(({mesh})=>{for(let n=mesh;n;n=n.parent)if(n.userData.itemId===item)return true;return false;});assert.ok(items.length>20,'Complete owned item surface is present');
  const edges=crestEdges(actor,id,action,g,spec,list,extra),before=predecessorActor(source,id,action,extra);
  sample(actor,id,action,g,spec,.85,0,extra);sample(before,id,action,g,spec,.85,0,extra);assert.ok(shift(vertices(list),vertices(surface(before).all))<.000001,'Whole item/overlay/native pose is exact at original roof transfer');assert.deepEqual(actor.visual.items,extra.items,'Fitting keeps real owned item state');
  results.push({id,lod,action,item,visibleMeshes:[...new Set(list.map(v=>v.mesh.name))],edges});actor.dispose();before.dispose();
 }
});
test.after(()=>{mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/climb-crest-appearance.json',JSON.stringify({results,scope:'Complete published appearance/owned-item surfaces; continuity and later-pose regression. Natural pace and cloth collision are separate open audits.'},null,2)+'\n');});
