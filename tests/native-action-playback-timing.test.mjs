import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleFrameDuration} from '../game/battle-playback.js';
import {createBattle,presentedActBattle} from '../game/tactical.js';
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {admittedReloadWork,nativeActionFrameDuration}=await import('../web/lib/three/action-timing.ts');
const {sampleAnimationTime:sample}=await import('../web/lib/three/animation-clock.ts');
const manifest=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url),'utf8'));
const nearly=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

for(const [appearance,gender]of [['granadero','male'],['woman-scout','female']])for(const posture of ['standing','crouched','prone','mounted']){
 test(`${appearance} ${posture} recorded maintenance keeps its native body pace and continuous preparation`,()=>{
  for(const weapon of [1800,1805])for(const [order,action]of [['reload','reload'],['reprime','reprime'],['repair','repair'],['unloadAmmunition','unload']]){
   const unit={id:'actor',side:'player',hp:80,weapon,spriteAppearance:appearance,stance:posture==='mounted'?'standing':posture,mounted:posture==='mounted'},state={units:[unit]};
   const name=`${posture==='standing'?'stand':posture==='crouched'?'crouch':posture}.${action}.${weapon===1800?'long-gun':'short-gun'}`;
   const clip=manifest.animationLibraries[gender].clips.find(clip=>clip.name===name);
   const prepare={type:'prepare',action:order,unitId:'actor',state},result={...prepare,type:'result'};
   const preparation=presentedFrameDuration(prepare,state),recovery=presentedFrameDuration(result,state);
   nearly(preparation+recovery,clip.duration*1000);
   const common={clip,action,cue:{action,startedAt:0,durationMs:preparation+recovery},now:0};
   const before=sample({...common,cue:{...common.cue,phase:'prepare',phaseStartedAt:0,phaseDurationMs:preparation},now:preparation});
   const after=sample({...common,cue:{...common.cue,phase:'result',phaseStartedAt:preparation,phaseDurationMs:recovery},now:preparation});
   nearly(before.time,after.time);assert.equal(before.complete,false);
   for(const elapsed of [0,recovery*.25,recovery*.5,recovery]){
    const recorded=sample({...common,cue:{...common.cue,phase:'result',phaseStartedAt:preparation,phaseDurationMs:recovery},now:preparation+elapsed});
    const direct=sample({...common,cue:{action,startedAt:0},now:preparation+elapsed});
    nearly(recorded.time,direct.time);assert.equal(recorded.complete,direct.complete);
   }
  }
 });
}
test('artillery loading uses one continuous native action and preserves longer supplied delays',()=>{
 const unit={id:'crew',side:'player',hp:80,weapon:1800},state={units:[unit]},prepare={type:'prepare',action:'artilleryReload',unitId:'crew',state},result={...prepare,type:'result'};
 nearly(presentedFrameDuration(prepare,state)+presentedFrameDuration(result,state),4000);
 assert.equal(nativeActionFrameDuration(prepare,2000),2000);
 assert.equal(nativeActionFrameDuration(result,5000),5000);
});
test('hidden, missing, cancelled and incapacitated maintenance retains ordinary timing',()=>{
 const unit={id:'secret',side:'enemy',hp:80,weapon:1800},state={units:[unit]},frame={type:'result',action:'reload',unitId:'secret',state};
 const ordinary=battleFrameDuration(frame);
 for(const change of [{unitId:null},{unitId:'missing'},{performed:false},{state:{units:[{...unit,hp:0}]}},{state:{units:[{...unit,unconscious:true}]}},{state:{units:[{...unit,knockedDown:true}]}}])assert.equal(presentedFrameDuration({...frame,...change},state),ordinary);
 for(const action of ['fire','melee','heal','artillery'])for(const type of ['prepare','contact','projectile','impact','result']){
  const other={...frame,action,type};assert.equal(presentedFrameDuration(other,state),battleFrameDuration(other));
 }
});
test('three paid rifle reload portions preserve work and resume at the interrupted native pose',()=>{
 let state=createBattle([{id:'loader',x:1,y:1,weapon:1800,loaded:0,ammo:3}],{width:8,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),enemies:[{id:'reserve',x:7,y:7,overwatch:false,patrol:false}]});
 const clip=manifest.animationLibraries.male.clips.find(clip=>clip.name==='stand.reload.long-gun');
 for(let portion=0;portion<3;portion++){
  state.units[0].ap=15;const before=structuredClone(state),recorded=presentedActBattle(state,{type:'reload',unitId:'loader'}),frames=admittedReloadWork(recorded.frames),work=[{from:portion/3,to:(portion+1)/3}];
  assert.deepEqual(state,before);assert.equal(recorded.state.lastError,null);assert.deepEqual(recorded.frames.map(frame=>frame.actionWork),[undefined,undefined]);
  for(const frame of frames){nearly(frame.actionWork[0].from,work[0].from);nearly(frame.actionWork[0].to,work[0].to);}
  const delays=frames.map(frame=>presentedFrameDuration(frame,state));nearly(delays.reduce((a,b)=>a+b,0),1600);
  const cue={action:'reload',startedAt:0,phase:'result',phaseStartedAt:delays[0],phaseDurationMs:delays[1],work:frames[1].actionWork};
  const first=sample({clip,action:'reload',cue,now:delays[0]}),last=sample({clip,action:'reload',cue,now:delays[0]+delays[1]});
  nearly(first.time,Math.max(work[0].from,.2025)*clip.duration);nearly(last.time,work[0].to*clip.duration);assert.equal(last.complete,true);
  assert.equal(recorded.state.units[0].ap,0);assert.equal(recorded.state.units[0].loaded,portion===2?1:0);assert.equal(recorded.state.units[0].ammo,portion===2?2:3);
  state=recorded.state;
 }
});
test('separate primary and offhand charge intervals retain their own interrupted portions',()=>{
 const before={id:'loader',side:'player',hp:80,weapon:1805,loaded:0,reloadProgress:.5,offHand:{weapon:1806,loaded:0,reloadProgress:.5}},after={...before,loaded:1,reloadProgress:undefined,offHand:{...before.offHand,loaded:1,reloadProgress:undefined}};
 const frames=admittedReloadWork([{type:'prepare',action:'reload',unitId:'loader',state:{units:[before]}},{type:'result',action:'reload',unitId:'loader',state:{units:[after]}}]);
 assert.deepEqual(frames[1].actionWork,[{from:.5,to:1},{from:.5,to:1}]);
 const clip=manifest.animationLibraries.male.clips.find(clip=>clip.name==='stand.reload.short-gun'),duration=presentedFrameDuration(frames[1],frames[0].state);nearly(duration,4800);assert.equal(presentedFrameDuration(frames[0],frames[0].state),0);
 const cue={action:'reload',startedAt:0,phase:'result',phaseDurationMs:duration,work:frames[1].actionWork};
 nearly(sample({clip,action:'reload',cue,now:1200}).time,clip.duration*.75);nearly(sample({clip,action:'reload',cue,now:3600}).time,clip.duration*.75);nearly(sample({clip,action:'reload',cue,now:4800}).time,clip.duration);
});
test('hidden preparation cannot disclose private reload progress on reappearance',()=>{
 const before={id:'loader',side:'enemy',hp:80,weapon:1800,loaded:0,reloadProgress:.6},after={...before,loaded:1,reloadProgress:undefined};
 for(const hidden of ['prepare','result']){
  const frames=admittedReloadWork([{type:'prepare',action:'reload',unitId:hidden==='prepare'?null:'loader',state:{units:[before]}},{type:'result',action:'reload',unitId:hidden==='result'?null:'loader',state:{units:[after]}}]);
  assert.ok(frames.every(frame=>frame.actionWork===undefined));
 }
});
