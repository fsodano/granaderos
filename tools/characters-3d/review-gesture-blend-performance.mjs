import {register} from 'node:module';register('../../tests/tactical-render-loader.mjs',import.meta.url);
import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {BATTLE_PLAYBACK} from '../../game/battle-playback.js';
import {publishedActor} from '../../tests/published-actor-fixture.mjs';
const {ActorRuntime}=await import('../../web/lib/three/actor-runtime.ts');
const assets=await Promise.all(['granadero','woman-scout'].map(name=>publishedActor(name,1)));
const held={unarmed:null,'long-gun':1800,'short-gun':1805,blade:1810,knife:1813,lance:1812};
const guards=['idle.unarmed','idle.long-gun','idle.short-gun','idle.blade','idle.knife','idle.lance','aim.long-gun','aim.short-gun','brace.long-gun'];
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
function scene(size,disabled){const actors=[];const started=performance.now();for(let index=0;index<size;index++){
 const [idleAction,equipment]=guards[index%guards.length].split('.'),asset=assets[index%2],visual={key:'unit:perf'+index,id:'perf'+index,kind:'unit',appearance:asset.appearance.id,skin:'light',side:'player',position:[index*2,0,0],yaw:index%4*Math.PI/2,tacticalLevel:0,posture:'standing',mounted:false,action:idleAction,idleAction,equipment:['knife','lance'].includes(equipment)?'blade':equipment,items:held[equipment]?[{id:String(held[equipment]),reference:'primary',socket:'handRight'}]:[],garments:{},selected:false,bodyHeights:{}};
 const actor=new ActorRuntime(asset,visual);if(disabled){actor.gestureSupport.begin=()=>{};actor.gestureSupport.apply=()=>{};actor.gestureSupport.restore=()=>{};}actors.push({actor,visual,mesh:actor.model.getObjectByName('Human_footwear_LOD1')});
 }return{actors,constructionMs:performance.now()-started};}
function run(f,kind,frames=360){const times=[],helperTimes=[],coldTimes=[],coldHelperTimes=[];let processed=0,reject=0,maxAdjust=0,maxContactError=0,maxHeelRoll=0;
 const timing=[];for(const entry of f.actors){const support=entry.actor.gestureSupport;for(const method of ['begin','restore','apply']){const call=support[method].bind(support);support[method]=(...args)=>{const began=performance.now();const result=call(...args);timing.push(performance.now()-began);if(method==='apply'){processed+=support.processedVertices;reject+=support.rejectedFits;maxAdjust=Math.max(maxAdjust,support.maximumAdjustment);maxContactError=Math.max(maxContactError,support.maximumContactError);maxHeelRoll=Math.max(maxHeelRoll,support.maximumHeelRoll);}return result;};}}
 const cycleFrames=kind==='active-compressed'?54:108;
 for(let frame=0;frame<frames;frame++){
  const now=frame*1000/60,cycle=Math.floor(frame/cycleFrames),inCycle=frame%cycleFrames,action=['heal','loot','free'][cycle%3],compressed=kind==='active-compressed'||action==='heal';
  timing.length=0;const began=performance.now();
  if(kind!=='idle'&&inCycle===0)for(const {actor,visual}of f.actors){const cue={id:cycle+'-'+visual.id,action,startedAt:now,...(compressed?{phase:'prepare',phaseStartedAt:now,phaseDurationMs:BATTLE_PLAYBACK.action,durationMs:BATTLE_PLAYBACK.action*2}:{})};actor.update({...visual,action,cue},now);}
  if(kind!=='idle'&&compressed&&inCycle===18)for(const {actor,visual}of f.actors){const born=cycle*cycleFrames*1000/60;actor.update({...visual,action,cue:{id:cycle+'-'+visual.id,action,phase:'result',startedAt:born,phaseStartedAt:now,phaseDurationMs:BATTLE_PLAYBACK.action,durationMs:BATTLE_PLAYBACK.action*2}},now);}
  for(const {actor,mesh}of f.actors){actor.tick(1/60,now);actor.root.updateMatrixWorld(true);mesh.skeleton.update();}const elapsed=performance.now()-began;
  if(frame<8){coldTimes.push(elapsed);coldHelperTimes.push(timing.reduce((sum,n)=>sum+n,0));}if(frame>=30){times.push(elapsed);helperTimes.push(timing.reduce((sum,n)=>sum+n,0));}
 }
 return{kind,frames,constructionMs:f.constructionMs,firstFrameMs:coldTimes[0],firstBlendMaxMs:Math.max(...coldTimes),firstHelperMaxMs:Math.max(...coldHelperTimes),medianMs:percentile(times,.5),p95Ms:percentile(times,.95),maxMs:Math.max(...times),helperMedianMs:percentile(helperTimes,.5),helperP95Ms:percentile(helperTimes,.95),helperMaxMs:Math.max(...helperTimes),processed,reject,maxAdjust,maxContactError,maxHeelRoll};}
const report=[];
for(const size of [16,40,100])for(const kind of ['idle','active-compressed','active-ordinary'])for(const disabled of [true,false]){
 const f=scene(size,disabled);try{const r={size,disabled,...run(f,kind)};if(!disabled){assert.equal(r.reject,0);if(kind==='idle')assert.equal(r.processed,0);}report.push(r);console.log(JSON.stringify(r));}finally{for(const {actor}of f.actors)actor.dispose();}
}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({node:process.version,lod:1,anatomies:['granadero','woman-scout'],workload:'Actual ActorRuntime ticks plus complete scene matrix and boot skeleton update.9 guards,3 gesture cues,360 frames at60Hz,first30 excluded for warm statistics. Includes cue dispatch/forecast plus begin/restore/apply in helper cost. All actors enter gestures together; compressed workload uses54-frame cycles and real300ms prepare/result phases. Ordinary workload uses108-frame cycles:300ms paired healing, native unphased1.4s loot/free. Disabled control preserves the same actor, mixer and world updates. CPU only; no GPU/render/tactical frame-rate claim.',rows:report},null,2)+'\n');
