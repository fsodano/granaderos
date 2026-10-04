import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
const {sampleAnimationTime:sample,cueControlsAction}=await import('../web/lib/three/animation-clock.ts');
const walk={duration:1,loop:true,locomotionSpeed:1.5};
const nearly=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('distance-based gait keeps its phase at paid tile boundaries and across diagonal speeds',()=>{
 const a=sample({clip:walk,action:'walk',now:1000,motion:{moving:true,elapsedMs:210,elapsedDistance:1.2,speed:1.2/.21}});
 const wait=sample({clip:walk,action:'walk',now:1120,motion:{moving:true,elapsedMs:210,elapsedDistance:1.2}});
 const b=sample({clip:walk,action:'walk',now:1120,motion:{moving:true,elapsedMs:210,elapsedDistance:1.2,speed:Math.SQRT2*1.2/.21}});
 nearly(a.time,.8);nearly(wait.time,a.time);nearly(b.time,a.time);assert.equal(a.rate,0);
 const diagonal=sample({clip:walk,action:'walk',now:1200,motion:{moving:true,elapsedDistance:1.2+.2*Math.SQRT2,speed:8}});
 nearly(diagonal.time,((1.2+.2*Math.SQRT2)/1.5)%1);
});
test('backward travel reverses the gait, including elapsed-time compatibility',()=>{
 const backwards=sample({clip:walk,action:'walk',now:0,motion:{moving:true,elapsedDistance:.3,speed:3,signedForwardSpeed:-3}});
 nearly(backwards.time,.8);
 const later=sample({clip:walk,action:'walk',now:0,motion:{moving:true,elapsedDistance:.45,speed:3,signedForwardSpeed:-3}});nearly(later.time,.7);
 const legacy=sample({clip:walk,action:'walk',now:0,motion:{moving:true,elapsedMs:100,speed:3,signedForwardSpeed:-3}});nearly(legacy.time,.8);
});
test('climb follows the recorded path fraction and is independent of clock delay',()=>{
 for(const action of ['climbUp','climbDown']){
  nearly(sample({clip:{duration:1.8,loop:false},action,now:9999,motion:{moving:true,segmentFraction:.5}}).time,.9);
  nearly(sample({clip:{duration:1.8,loop:false},action,now:9999,motion:{moving:true,segmentFraction:1}}).time,1.8);
 }
});
test('melee contact lands at contact-frame end and recovery starts at the same pose',()=>{
 const clip={duration:1.2,loop:false,markers:{contact:.58}};
 const base={clip,action:'strike',cue:{action:'strike',startedAt:0,durationMs:1970,phase:'contact',phaseStartedAt:420,phaseDurationMs:650}};
 const start=sample({...base,now:420}),end=sample({...base,now:1070});
 nearly(start.time,.58*.45);nearly(end.time,.58);assert.equal(end.complete,false);assert.equal(end.phaseComplete,true);
 const impact=sample({...base,now:1070,cue:{...base.cue,phase:'impact',phaseStartedAt:1070,phaseDurationMs:900}});nearly(impact.time,end.time);
});
test('fire and throw release start exactly at the matching projectile marker',()=>{
 for(const [action,markers]of [['fire',{shot:.3}],['throwKnife',{release:.75}]]){
  const clip={duration:1.2,loop:false,markers},cue={action,startedAt:100,durationMs:500,phase:'projectile'};
  nearly(sample({clip,action,cue,now:100}).time,Object.values(markers)[0]);
 }
});
test('stale cues cannot override locomotion and reduced motion suppresses only idle',()=>{
 assert.equal(cueControlsAction('walk',{action:'reload'}),false);
 const motion={moving:true,elapsedDistance:.3,speed:3};
 const moving=sample({clip:walk,action:'walk',motion,cue:{action:'reload',startedAt:0},now:10000,reducedMotion:true});nearly(moving.time,.2);assert.equal(moving.cueControlsAction,false);
 assert.deepEqual(sample({clip:walk,action:'idle',now:0,reducedMotion:true}),{time:0,rate:0,complete:false,phaseComplete:false,cueControlsAction:false});
 const shot={clip:{duration:1,loop:false,markers:{shot:.2}},action:'fire',cue:{action:'fire',startedAt:0},now:400};
 assert.deepEqual(sample({...shot,reducedMotion:true}),sample(shot));
});
test('a native long reload completes at its clip duration when no override is supplied',()=>{
 const base={clip:{duration:4.8,loop:false},action:'reload',cue:{action:'reload',startedAt:0}};
 const atThree=sample({...base,now:3000});nearly(atThree.time,3);assert.equal(atThree.complete,false);
 const end=sample({...base,now:4800});nearly(end.time,4.8);assert.equal(end.complete,true);
});
