import {register} from 'node:module';register('../../tests/tactical-render-loader.mjs',import.meta.url);
import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {publishedActor} from '../../tests/published-actor-fixture.mjs';
const {ActorRuntime}=await import('../../web/lib/three/actor-runtime.ts');
const assets=await Promise.all(['granadero','woman-scout'].map(name=>publishedActor(name,1)));
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
function scene(size,disabled){const actors=[],started=performance.now();for(let i=0;i<size;i++){
 const asset=assets[i%2],visual={key:'unit:step-perf'+i,id:'step-perf'+i,kind:'unit',appearance:asset.appearance.id,skin:'light',side:'player',position:[i*2,0,0],yaw:i%4*Math.PI/2,tacticalLevel:0,posture:'standing',mounted:false,action:'aim',idleAction:'aim',equipment:'short-gun',items:[{id:'1805',reference:'primary',socket:'handLeft'}],cue:{id:'initial-'+i,action:'aim',hand:'handLeft',startedAt:0},garments:{},selected:false,bodyHeights:{}};
 const actor=new ActorRuntime(asset,visual);if(disabled){actor.gestureSupport.begin=()=>{};actor.gestureSupport.apply=()=>{};actor.gestureSupport.restore=()=>{};}actors.push({actor,visual,mesh:actor.model.getObjectByName('Human_footwear_LOD1')});
 }return{actors,constructionMs:performance.now()-started};}
function run(f,disabled,frames=360){const times=[],helperTimes=[],coldTimes=[],coldHelperTimes=[];let processed=0,reject=0,maxAdjust=0,maxContactError=0,stepFrames=0;
 const timing=[];for(const {actor}of f.actors){const h=actor.gestureSupport;for(const name of ['begin','restore','apply']){const call=h[name].bind(h);h[name]=(...args)=>{const began=performance.now(),result=call(...args);timing.push(performance.now()-began);if(name==='apply'){processed+=h.processedVertices;reject+=h.rejectedFits;maxAdjust=Math.max(maxAdjust,h.maximumAdjustment);maxContactError=Math.max(maxContactError,h.maximumContactError);if(h.plan?.step)stepFrames++;}return result;};}}
 for(let i=0;i<12;i++)for(const {actor}of f.actors)actor.tick(1/60,i*1000/60);
 for(let frame=0;frame<frames;frame++){
  const now=1000+frame*1000/60,cycle=Math.floor(frame/96),inCycle=frame%96;timing.length=0;const began=performance.now();
  if(inCycle===0)for(const {actor,visual}of f.actors){assert.equal(actor.actionHand,'handLeft','Every measured cue starts from the real mirrored guard');actor.update({...visual,action:'heal',cue:{id:'heal-'+cycle+'-'+visual.id,action:'heal',startedAt:now,phase:'prepare',phaseStartedAt:now,phaseDurationMs:300,durationMs:600}},now);}
  if(inCycle===18)for(const {actor,visual}of f.actors){const born=1000+cycle*96*1000/60;actor.update({...visual,action:'heal',cue:{id:'heal-'+cycle+'-'+visual.id,action:'heal',startedAt:born,phase:'result',phaseStartedAt:born+300,phaseDurationMs:300,durationMs:600}},now);}
  if(inCycle===83)for(const {actor,visual}of f.actors)actor.update({...visual,cue:{id:'left-'+cycle+'-'+visual.id,action:'aim',hand:'handLeft',startedAt:now}},now);
  for(const {actor,mesh}of f.actors){actor.tick(1/60,now);actor.root.updateMatrixWorld(true);mesh.skeleton.update();}const elapsed=performance.now()-began;
  if(frame<8){coldTimes.push(elapsed);coldHelperTimes.push(timing.reduce((sum,n)=>sum+n,0));}if(frame>=30){times.push(elapsed);helperTimes.push(timing.reduce((sum,n)=>sum+n,0));}
 }
 assert.equal(reject,0);if(disabled)assert.equal(processed,0);else assert.ok(stepFrames>0);
 return{disabled,frames,constructionMs:f.constructionMs,firstFrameMs:coldTimes[0],firstBlendMaxMs:Math.max(...coldTimes),firstHelperMaxMs:Math.max(...coldHelperTimes),medianMs:percentile(times,.5),p95Ms:percentile(times,.95),maxMs:Math.max(...times),helperMedianMs:percentile(helperTimes,.5),helperP95Ms:percentile(helperTimes,.95),helperMaxMs:Math.max(...helperTimes),processed,reject,maxAdjust,maxContactError,stepFrames};}
const rows=[];for(const size of [16,40,100])for(const disabled of [true,false]){const f=scene(size,disabled);try{const row={size,...run(f,disabled)};rows.push(row);console.log(JSON.stringify(row));}finally{for(const {actor}of f.actors)actor.dispose();}}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({node:process.version,lod:1,anatomies:['granadero','woman-scout'],workload:'Actual ActorRuntime, world matrix and footwear skeleton updates; all actors use the real left-hand pistol aim cue, real 300 ms paired healing, automatic native right-hand guard return, then a new ordinary left-hand aim cue.96-frame cycles,360 frames at60 Hz,first30 excluded. All actors enter and step together. Includes cue dispatch and begin/restore/apply; disabled control keeps the same source clocks and ordinary actor work. CPU only; no GPU or frame-rate claim.',rows},null,2)+'\n');
