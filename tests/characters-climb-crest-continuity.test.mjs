import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {asset,visual,surface,vertices,sample,snapshot,supportSkin,lowestSurface,palm} from './helpers/climb-native-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
import {ladderGeometry} from '../game/climb-geometry.js';
import {predecessorActor} from './helpers/climb-crest-predecessor.mjs';
const results=[],retainedPalmFloorFailures=[],shift=(a,b)=>Math.max(0,...a.map((v,i)=>v.distanceTo(b[i]))),edges=[.76,.82,.84,.85,.86,.91,.96,.98,1];
for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const action of ['climbUp','climbDown'])test(`${id} LOD${lod} ${action}: full body/garment surfaces have no crest or roof-contact pose jump`,async()=>{
 const source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.'+action);
 for(const H of [2,3,4.2,5.6])for(const span of [0,TILE_METRES,Math.SQRT2*TILE_METRES]){
  const g=ladderGeometry([0,1.1,0],[0,1.1+H,span],TILE_METRES),actor=new ActorRuntime(source,visual(id,action,{cue:undefined})),list=surface(actor).all,duration=Math.max(spec.duration,H/.65),record={id,lod,action,height:H,span,steps:g.steps,edges:[]};
  for(const center of edges){const values=[];for(const eps of [1e-4,1e-6]){sample(actor,id,action,g,spec,center-eps);const a=vertices(list);sample(actor,id,action,g,spec,Math.min(1,center+eps));values.push(shift(a,vertices(list)));}assert.ok(values[1]<values[0]*.0103+1e-5,`${H}m span${span} ${center}: no fixed visible-surface jump`);if(center===.76)assert.ok(values[1]/(2e-6*duration)<8,`${H}m span${span}: repaired crest keeps its independent full-surface speed limit`);record.edges.push({center,coarseMm:values[0]*1000,fineMm:values[1]*1000,speed:values[1]/(2e-6*duration)});}
  // Physical240Hz frames cover the repaired crest and original roof transfer.
  // Full visible scan includes complete boots/head/clothes, not joint probes.
  let prior=null,priorFraction=null,maxSpeed=0;for(let t=.735;t<=.79;t+=1/(duration*240)){sample(actor,id,action,g,spec,t);const next=vertices(list);if(prior){const speed=shift(prior,next)*240;maxSpeed=Math.max(maxSpeed,speed);if(priorFraction<=.76&&t>=.76)assert.ok(speed<8,`${H}m ${t}: actual240Hz repaired crest keeps its independent speed bound`);}prior=next;priorFraction=t;}
  record.maxCrest240HzSpeed=maxSpeed;results.push(record);actor.dispose();
 }
});
for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${id} LOD${lod}: crest palms and complete soles retain predecessor clearance and held poses`,async()=>{
 const source=await asset(id,lod);
 for(const action of ['climbUp','climbDown'])for(const H of [2,3,4.2,5.6])for(const span of [0,TILE_METRES]){
  const spec=source.clips.find(s=>s.name==='life.'+action),g=ladderGeometry([0,.4,0],[0,.4+H,span],TILE_METRES),actor=new ActorRuntime(source,visual(id,action,{cue:undefined})),skin=supportSkin(actor),before=predecessorActor(source,id,action),beforeSkin=supportSkin(before);let checks=0;
  for(const up of [.76,.78,.82,.83,.84,.85,.86,.88,.90,.91,.94,.96]){const plan=sample(actor,id,action,g,spec,up);sample(before,id,action,g,spec,up);assert.equal(actor.climbFit.rejectedFits,0,'Existing valid routes keep every reach admission');for(const side of ['l','r']){const hand=plan.hands[side];if(hand.weight>.999){assert.ok(actor.root.localToWorld(palm(actor,side)).distanceTo(new Vector3(hand.position[0],.4+hand.position[1],hand.position[2]))<.025,'Actual native palm anchor on the physical rung/crest');checks++;}for(const[group,contact]of [['feet',plan.feet[side]],['hands',hand]])if(contact.planted&&contact.roofWeight>.999&&(contact.weight===undefined||contact.weight>.999)&&!(contact.restWeight>0)){const min=lowestSurface(actor,skin[group][side])+plan.root.height-H,oldMin=lowestSurface(before,beforeSkin[group][side])+plan.root.height-H;
     if(group==='feet')assert.ok(min>-.004,`${H}m span${span} ${up} ${side} complete sole keeps the independent4mm floor bound`);
     else {assert.ok(min>=oldMin-.000001,`${H}m span${span} ${up} ${side} complete palm must not add floor penetration`);if(min<-.004)retainedPalmFloorFailures.push({id,lod,action,height:H,span,up,side,beforeMm:oldMin*1000,currentMm:min*1000});}
}}
  }
  assert.ok(checks>10);sample(actor,id,action,g,spec,.78);const heldSnapshot=snapshot(actor),v=vertices(surface(actor).all),clock=actor.action.time;for(let i=0;i<20;i++)actor.tick(1/60,1000);assert.deepEqual(snapshot(actor),heldSnapshot,'Held crest cannot accumulate corrections');assert.ok(shift(v,vertices(surface(actor).all))<1e-8);assert.equal(actor.action.time,clock);actor.dispose();before.dispose();
 }
});
test.after(()=>{mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/climb-crest-continuity.json',JSON.stringify({results,retainedPalmFloorFailures,scope:'Crest continuity and exact predecessor support regression. Retained >4mm palm penetration is an open floor defect.'},null,2)+'\n');});
