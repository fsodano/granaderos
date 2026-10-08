import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {surface,tree,candidates,crossed} from '../tools/characters-3d/cloth-boot-surfaces.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');

const visual=(id,extra={})=>({key:'unit:cloth',id:'cloth',kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'prone',mounted:false,action:'idle',idleAction:'idle',equipment:'long-gun',items:[{id:'1800',reference:'primary',socket:'handRight'}],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},...extra});
const names=id=>[`Human_${id==='friar'?'outfit':'legwear'}_LOD0`,'Human_footwear_LOD0'];
function refresh(actor,cloth,boot){actor.root.updateMatrixWorld(true);cloth.skeleton.update();boot.skeleton.update();}
function pairs(cloth,boot){const bvh=tree(surface(boot)),result=[];for(const triangle of surface(cloth)){const nearby=[];candidates(bvh,triangle.box,nearby);for(const other of nearby)if(crossed(triangle,other)||crossed(other,triangle))result.push([triangle.indices,other.indices]);}return result;}

for(const id of ['friar','woman-shawl']){
 test(`${id} complete close garment clears full boot surfaces for every admitted fixed native clip`,async()=>{
  const asset=await publishedActor(id,0),actor=new ActorRuntime(asset,visual(id)),[clothName,bootName]=names(id),cloth=actor.model.getObjectByName(clothName),boot=actor.model.getObjectByName(bootName),support=asset.appearance.lods[0].nativeClothBootSupport;
  assert.equal(support.retainedOriginalClothTargetsAndRig,true);
  assert.deepEqual(cloth.userData.nativeClothBootSupport,support);
  assert.ok(support.clips.length>=45&&!support.clips.some(name=>name.includes('crawl')));
  const base=cloth.geometry.attributes.normal,old=cloth.geometry.morphAttributes.normal[1],added=cloth.geometry.morphAttributes.normal[2];
  for(let i=0;i<base.count;i++){const normal=new Vector3().fromBufferAttribute(base,i).add(new Vector3().fromBufferAttribute(old,i)).add(new Vector3().fromBufferAttribute(added,i));assert.ok(Math.abs(normal.length()-1)<1e-5,'The combined clearance normal stays finite and unit length');}
  for(const name of support.clips){
   const clip=asset.animation.animations.find(clip=>clip.name===name);assert.ok(clip,name);
   actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip).reset().play();
   for(const phase of [0,.5,1]){action.time=phase*clip.duration;actor.mixer.update(0);cloth.morphTargetInfluences.splice(0,3,0,1,1);refresh(actor,cloth,boot);assert.equal(pairs(cloth,boot).length,0,`${name} phase ${phase}`);}
  }
  assert.ok(asset.body.scene.getObjectByName(clothName).morphTargetInfluences.every(weight=>weight===0),'The actor leaves its shared source unchanged');
  actor.dispose();
 });

 test(`${id} uses paid held-action and real fade weights while restoring exact crawling shape`,async()=>{
  const asset=await publishedActor(id,0),actor=new ActorRuntime(asset,visual(id)),cloth=actor.model.getObjectByName(names(id)[0]);
  for(let frame=0;frame<60;frame++)actor.tick(1/60,frame*1000/60);
  assert.ok(cloth.morphTargetInfluences[2]>.999,'The admitted native idle uses the added shape');
  actor.update(visual(id,{action:'heal',cue:{id:'paid-held',action:'heal',startedAt:1000,durationMs:600,phase:'prepare',phaseStartedAt:1000,phaseDurationMs:300}}),1000);
  for(let frame=0;frame<20;frame++)actor.tick(1/60,1000+frame*1000/60);
  assert.equal(actor.action.timeScale,0,'The real recorded paid action is held at its phase endpoint');
  assert.ok(actor.action.isScheduled()&&!actor.action.isRunning());
  assert.ok(cloth.morphTargetInfluences[2]>.999,'A paid endpoint keeps its actual supported action weight');
  actor.update(visual(id,{action:'crawl',motion:{moving:true,speed:1}}),1400);
  const observed=[];
  for(let frame=0;frame<20;frame++){actor.tick(1/60,1400+frame*1000/60);observed.push(cloth.morphTargetInfluences[2]);}
  assert.ok(observed[0]>0&&observed[0]<1,'The outgoing correction uses the existing native fade');
  assert.equal(observed.at(-1),0,'Settled crawling has no added correction');
  for(let frame=0;frame<20;frame++)actor.tick(1/60,1800+frame*1000/60);
  assert.equal(cloth.morphTargetInfluences[2],0);
  const original=cloth.geometry.morphAttributes.position[1];assert.ok(original.array.every(Number.isFinite));
  actor.update(visual(id,{posture:'standing'}),2200);for(let frame=0;frame<60;frame++)actor.tick(1/60,2200+frame*1000/60);
  assert.ok(cloth.morphTargetInfluences.every(weight=>weight<.001),'Standing returns to the original authored rest shape');
  actor.dispose();
 });
}
