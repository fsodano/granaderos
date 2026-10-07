import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleFrameDuration} from '../game/battle-playback.js';
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {nativeActionFrameDuration}=await import('../web/lib/three/action-timing.ts');
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
 for(const action of ['fire','melee','heal','throwKnife','artillery'])for(const type of ['prepare','contact','projectile','impact','result']){
  const other={...frame,action,type};assert.equal(presentedFrameDuration(other,state),battleFrameDuration(other));
 }
});
