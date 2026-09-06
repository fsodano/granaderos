import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSprite,spriteAnimationFrame,spriteCondition} from '../game/sprite-state.js';
import {actBattle,createBattle} from '../game/tactical.js';
const motion={direction:3,frame:5,moving:false};
const soldier={id:'p',side:'player',hp:100,weapon:1800,loaded:1,activeSlot:'primary',stance:'prone'};

test('prone has armed/unarmed idle and crawl, including empty guns and dropped or switched weapons',()=>{
 for(const moving of [false,true]){
  const gait=moving?'walk':'idle',m={...motion,moving};
  assert.equal(selectSprite(soldier,m).name,`granadero-prone-armed-${gait}`);
  assert.equal(selectSprite({...soldier,loaded:0},m).name,`granadero-prone-armed-${gait}`);
  for(const change of [{weaponDropped:true},{activeSlot:'blade'},{weapon:1811},{weapon:undefined}])assert.equal(selectSprite({...soldier,...change},m).name,`granadero-prone-unarmed-${gait}`);
 }
});
test('prone fire/reload use their own action frames and no-gun variants cannot display a firearm action',()=>{
 for(const pose of ['fire','reload']){
  assert.deepEqual(selectSprite(soldier,motion,pose),{name:`granadero-prone-armed-${pose}`,playback:'action'});
  assert.equal(selectSprite({...soldier,weaponDropped:true},motion,pose).name,'granadero-prone-unarmed-idle');
 }
});
test('death overrides unconsciousness, a mount, movement and pending fire; recovery restores equipment-aware posture',()=>{
 const moving={...motion,moving:true};
 for(const appearance of ['soldier','civilian']){
  const family=appearance==='civilian'?'civilian':'granadero';
  assert.deepEqual(selectSprite({...soldier,hp:0,unconscious:true,mounted:true},moving,'fire',appearance),{name:`${family}-dead-idle`,playback:'still'});
  assert.deepEqual(selectSprite({...soldier,unconscious:true,mounted:true},moving,'fire',appearance),{name:`${family}-unconscious-breathe`,playback:'breathing'});
 }
 assert.equal(spriteCondition({...soldier,unconscious:true}),'unconscious');
 assert.equal(selectSprite({...soldier,unconscious:false},motion).name,'granadero-prone-armed-idle');
});
test('breathing loops slowly while death stays still and gun actions finish once',()=>{
 assert.deepEqual([0,500,1000,3500,4000,4500].map(t=>spriteAnimationFrame('breathing',t)),[0,1,2,7,0,1]);
 for(const t of [0,500,5000,60000])assert.equal(spriteAnimationFrame('still',t),0);
 assert.equal(spriteAnimationFrame('action',200),2);assert.equal(spriteAnimationFrame('action',5000),7);
});
test('a live prone soldier can fire and stays prone after spending ammunition and AP',()=>{
 let state=createBattle([{id:'p',x:1,y:1,weapon:1800,marksmanship:95}],{width:8,height:8,enemies:[{id:'e',x:4,y:1}],weather:{rain:0,humidity:0},seed:1813});
 state=actBattle(state,{type:'movement',movement:'prone',unitId:'p'});
 assert.equal(state.lastError,null);
 const before=state.units.find(u=>u.id==='p');
 const fired=actBattle(state,{type:'fire',unitId:'p',targetId:'e'}),after=fired.units.find(u=>u.id==='p');
 assert.equal(fired.lastError,null);assert.equal(after.stance,'prone');assert.ok(after.ap<before.ap);
 assert.equal(after.loaded,before.loaded-1);
 assert.equal(selectSprite(after,motion,'fire').name,'granadero-prone-armed-fire');
});
