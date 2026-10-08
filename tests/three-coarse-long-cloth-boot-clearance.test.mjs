import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {surface,tree,candidates,crossed} from '../tools/characters-3d/cloth-boot-surfaces.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const visual=(id,extra={})=>({key:'unit:cloth',id:'cloth',kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'prone',mounted:false,action:'idle',idleAction:'idle',equipment:'long-gun',items:[{id:'1800',reference:'primary',socket:'handRight'}],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},...extra});
const clothName=(id,lod)=>`Human_${id==='friar'?'outfit':'legwear'}_LOD${lod}`;
function pairs(actor,cloth,boot){actor.root.updateMatrixWorld(true);cloth.skeleton.update();boot.skeleton.update();const bvh=tree(surface(boot));let count=0;for(const triangle of surface(cloth)){const nearby=[];candidates(bvh,triangle.box,nearby);for(const other of nearby)if(crossed(triangle,other)||crossed(other,triangle))count++;}return count;}
for(const id of ['friar','woman-shawl'])for(const lod of [1,2]){
 test(`${id} LOD${lod} retains reviewed cloth topology and clears complete published boot and garment surfaces`,async()=>{
  const asset=await publishedActor(id,lod),close=await publishedActor(id,0),actor=new ActorRuntime(asset,visual(id)),cloth=actor.model.getObjectByName(clothName(id,lod)),boot=actor.model.getObjectByName(`Human_footwear_LOD${lod}`),donor=close.body.scene.getObjectByName(clothName(id,0)),record=asset.appearance.lods[lod],support=record.nativeClothBootSupport;
  try{
   const bytes=readFileSync(new URL(`../web/public/.${record.url}`,import.meta.url));assert.equal(bytes.length,record.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
   assert.equal(record.nativeClothTopology.method,'reviewed-close-garment-topology');assert.equal(record.nativeClothTopology.retainedOtherCoarseMeshesAndRig,true);assert.equal(record.nativeClothTopology.sourceSha256,close.appearance.lods[0].sha256);assert.ok(record.nativeClothTopology.maximumExtraWorldDisplacement<=.002);
   for(const semantic of ['position','normal','uv','skinIndex','skinWeight'])assert.deepEqual(cloth.geometry.attributes[semantic].array,donor.geometry.attributes[semantic].array,`Reviewed ${semantic} stays exact`);
   assert.deepEqual(cloth.geometry.index.array,donor.geometry.index.array);
   for(const semantic of ['position','normal'])for(const target of [0,1])assert.deepEqual(cloth.geometry.morphAttributes[semantic][target].array,donor.geometry.morphAttributes[semantic][target].array,'Both reviewed cloth shapes stay exact');
   assert.deepEqual(cloth.skeleton.bones.map(b=>b.name),donor.skeleton.bones.map(b=>b.name));assert.deepEqual(cloth.skeleton.boneInverses.map(m=>m.elements),donor.skeleton.boneInverses.map(m=>m.elements));
   for(const target of cloth.geometry.morphAttributes.position)for(let i=0;i<target.count;i++)assert.ok(new Vector3().fromBufferAttribute(target,i).length()<.15,'The existing native vector-length bound remains strict for every shape');
   assert.deepEqual(support,close.appearance.lods[0].nativeClothBootSupport);assert.deepEqual(cloth.userData.nativeClothBootSupport,support);
   for(const name of support.clips){const clip=asset.animation.animations.find(c=>c.name===name);assert.ok(clip,name);actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip).reset().play();for(const phase of [0,.5,1]){action.time=phase*clip.duration;actor.mixer.update(0);cloth.morphTargetInfluences.splice(0,3,0,1,1);assert.equal(pairs(actor,cloth,boot),0,`${name} phase${phase}`);}}
  }finally{actor.dispose();}
 });
 test(`${id} LOD${lod} uses actual paid held/fade weights and restores native crawling and standing`,async()=>{
  const asset=await publishedActor(id,lod),actor=new ActorRuntime(asset,visual(id)),cloth=actor.model.getObjectByName(clothName(id,lod));
  try{
   for(let frame=0;frame<60;frame++)actor.tick(1/60,frame*1000/60);assert.ok(cloth.morphTargetInfluences[2]>.999);
   actor.update(visual(id,{action:'heal',cue:{id:'paid-held',action:'heal',startedAt:1000,durationMs:600,phase:'prepare',phaseStartedAt:1000,phaseDurationMs:300}}),1000);for(let f=0;f<20;f++)actor.tick(1/60,1000+f*1000/60);assert.equal(actor.action.timeScale,0);assert.ok(cloth.morphTargetInfluences[2]>.999);
   actor.update(visual(id,{action:'crawl',motion:{moving:true,speed:1}}),1400);actor.tick(1/60,1400);assert.ok(cloth.morphTargetInfluences[2]>0&&cloth.morphTargetInfluences[2]<1);for(let f=1;f<20;f++)actor.tick(1/60,1400+f*1000/60);assert.equal(cloth.morphTargetInfluences[2],0);
   actor.update(visual(id,{posture:'standing'}),2200);for(let f=0;f<60;f++)actor.tick(1/60,2200+f*1000/60);assert.ok(cloth.morphTargetInfluences.every(w=>w<.001));assert.ok(asset.body.scene.getObjectByName(cloth.name).morphTargetInfluences.every(w=>w===0));
  }finally{actor.dispose();}
 });
}
