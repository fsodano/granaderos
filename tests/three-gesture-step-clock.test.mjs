import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const records=[];
after(()=>{if(process.env.GESTURE_CLOCK_METRICS)writeFileSync(process.env.GESTURE_CLOCK_METRICS,JSON.stringify(records,null,2)+'\n');});
const leg=/^(thigh|calf|foot|ball)_[lr]$/;
function pose(model){const rows=[];model.traverse(node=>{if(node.isBone)rows.push({node,p:node.position.toArray(),q:node.quaternion.toArray(),s:node.scale.toArray()});});return rows;}
function points(actor,mesh){actor.root.updateMatrixWorld(true);mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));}

for(const anatomy of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${anatomy} LOD${lod}: real idle pause and resume preserves a changed-hand step endpoint`,async()=>{
 const asset=await publishedActor(anatomy,lod),row={anatomy,lod,rateModes:[],minimum:Infinity,completeBootSpeed:0,endpointSpeed:0,maximumAdjustment:0,completed:0};
 for(const mode of ['resume-before-endpoint','hold-through-endpoint']){
  const visual={key:'unit:clock',id:'clock',kind:'unit',appearance:anatomy,skin:'light',side:'player',position:[6,.4,-4],yaw:Math.PI/2,tacticalLevel:0,posture:'standing',mounted:false,action:'aim',idleAction:'aim',equipment:'short-gun',items:[{id:'1805',reference:'primary',socket:'handLeft'}],garments:{},selected:false,bodyHeights:{},cue:{id:'left-aim',action:'aim',hand:'handLeft',startedAt:0}},actor=new ActorRuntime(asset,visual),h=actor.gestureSupport,mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),savedRoot=actor.root.position.toArray();
  let previous,seenRunning=false,seenHeld=false,seenResumed=false,finished=false,phaseResult=false,returnBorn,endpoint;
  const original=h.apply.bind(h);
  h.apply=(...args)=>{const native=pose(actor.model),time=actor.mixer.time,clocks=actor.mixer._actions.map(action=>[action.time,action.timeScale,action.getEffectiveWeight()]);original(...args);assert.equal(h.rejectedFits,0);assert.equal(actor.mixer.time,time);assert.deepEqual(actor.mixer._actions.map(action=>[action.time,action.timeScale,action.getEffectiveWeight()]),clocks);for(const {node,p,q,s}of native){assert.deepEqual(node.position.toArray(),p,node.name+' native position');assert.deepEqual(node.scale.toArray(),s,node.name+' native scale');if(!leg.test(node.name))assert.deepEqual(node.quaternion.toArray(),q,node.name+' native upper rotation');}};
  actor.onCueComplete=()=>row.completed++;
  try{
   for(let frame=0;frame<12;frame++)actor.tick(1/60,frame*1000/60);
   actor.update({...visual,idleAction:'idle',action:'heal',cue:{id:'clock-heal',action:'heal',phase:'prepare',startedAt:1000,phaseStartedAt:1000,phaseDurationMs:300,durationMs:600}},1000);
   for(let frame=0;frame<310;frame++){
    const now=1000+frame*1000/240;
    if(!phaseResult&&now>=1300){actor.update({...visual,idleAction:'idle',action:'heal',cue:{id:'clock-heal',action:'heal',phase:'result',startedAt:1000,phaseStartedAt:1300,phaseDurationMs:300,durationMs:600}},1300);phaseResult=true;}
    if(h.plan?.step&&returnBorn===undefined)returnBorn=h.plan.started;
    const elapsed=returnBorn===undefined?-1:actor.mixer.time-returnBorn,hold=elapsed>=.12&&elapsed<(mode==='resume-before-endpoint'?.32:.62),active=Boolean(h.plan);
    actor.tick(frame?1/240:0,now,hold);
    if(h.plan?.step){if(actor.action.timeScale===0)seenHeld=true;else if(seenHeld)seenResumed=true;else seenRunning=true;}
    if(finished&&!hold&&actor.action.timeScale>0)seenResumed=true;
    const full=points(actor,mesh),low=Math.min(...full.map(point=>point.y-.4));row.minimum=Math.min(row.minimum,low);
    if(h.plan?.step)assert.ok(low<.003,'At least one complete weighted boot remains supported');
    if(previous){const speed=Math.max(...full.map((point,index)=>point.distanceTo(previous[index])))*240;row.completeBootSpeed=Math.max(row.completeBootSpeed,speed);if(active&&!h.plan){finished=true;endpoint=speed;row.endpointSpeed=Math.max(row.endpointSpeed,speed);}}
    row.maximumAdjustment=Math.max(row.maximumAdjustment,h.maximumAdjustment);
    assert.deepEqual(actor.root.position.toArray(),savedRoot,'The saved world cell stays exact');assert.equal(actor.root.rotation.y,visual.yaw,'The authored orientation stays exact');
    for(const definition of h.legs){const hip=definition.thigh.getWorldPosition(new Vector3()),knee=definition.calf.getWorldPosition(new Vector3()),foot=definition.foot.getWorldPosition(new Vector3());assert.ok(Math.abs(hip.distanceTo(knee)-definition.first)<1e-6);assert.ok(Math.abs(knee.distanceTo(foot)-definition.second)<1e-6);}
    previous=full;
   }
   assert.ok(seenRunning&&seenHeld&&seenResumed,'The real clock runs, holds, then resumes '+JSON.stringify({mode,seenRunning,seenHeld,seenResumed,finished,returnBorn,time:actor.mixer.time}));assert.ok(finished,'The step reaches its actual endpoint');assert.equal(actor.clipSpec.name,'stand.idle.short-gun');assert.equal(h.plan,undefined);assert.equal(h.processedVertices,0,'The completed rest has no full-skin work');assert.ok(endpoint<.001,'The complete weighted boot endpoint has only submicrometre matrix residual per frame: '+endpoint);row.rateModes.push({mode,endpointSpeed:endpoint});
  }finally{actor.dispose();}
 }
 assert.equal(row.completed,2);assert.ok(row.minimum>.0018,'The complete boot stays above the saved floor '+row.minimum);assert.ok(row.completeBootSpeed<8,'The retained compressed source envelope stays bounded '+row.completeBootSpeed);assert.ok(row.maximumAdjustment<.20,'The native leg-only step remains bounded '+row.maximumAdjustment);records.push(row);
});
