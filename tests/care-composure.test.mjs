import test from 'node:test';
import assert from 'node:assert/strict';
import {CARE_COMPOSURE_RELIEF,careComposureRelief} from '../game/care-composure.js';
import {firstAidPlan} from '../game/first-aid.js';
import {createBattle,actBattle,presentedActBattle,medicalUsePreview,itemUsePreview,getCareComposureResult,shotChance,canSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {runBattleJob} from '../game/battle-job.js';

// Declared isolated care state. All treatment below uses ordinary paid orders.
function field(doctor={},patient={},sector={}){
 const b=createBattle([
  {id:'doc',name:'Sanitaria',x:1,y:2,abilities:['care_composure'],activeSlot:'medical',medical:60,medkits:3,shock:5,weapon:1800,marksmanship:55,...doctor},
  {id:'patient',name:'Herido',x:2,y:2,maxHp:100,hp:55,bleeding:4,...patient},
 ],{width:16,height:8,seed:45,hour:12,enemies:[{id:'enemy',x:14,y:6,patrol:false,overwatch:false}],...sector});
 if(doctor.ap!==undefined)b.units[0].ap=doctor.ap;
 if(patient.side){b.units[1].side=patient.side;b.units[1].patrolOrigin={x:b.units[1].x,y:b.units[1].y};}
 return b;
}
const doctor=b=>b.units[0],patient=b=>b.units[1];
const aid=(b,extra={})=>actBattle(b,{type:'heal',unitId:'doc',targetId:'patient',...extra});
const preview=b=>medicalUsePreview(b,doctor(b),patient(b));
const withoutAbility=b=>{const copy=structuredClone(b);delete doctor(copy).abilities;return copy;};
const rejected=(before,action)=>{const after=actBattle(before,action);assert.ok(after.lastError);assert.deepEqual(after.units,before.units);assert.deepEqual(after.npcs,before.npcs);assert.equal(after.seed,before.seed);assert.equal(after.elapsedSeconds,before.elapsedSeconds);assert.equal(getCareComposureResult(before,after),null);};

test('pure care relief clips only effective other-person care and leaves all inputs intact',()=>{
 const b=field(),u=doctor(b),t=patient(b),plan=firstAidPlan(u,t),before=structuredClone({u,t,plan});
 assert.equal(CARE_COMPOSURE_RELIEF,2);assert.equal(careComposureRelief(u,t,plan,{observed:true}),2);
 assert.equal(careComposureRelief({...u,shock:.75},t,plan,{observed:true}),.75);
 for(const altered of [{...u,shock:0},{...u,shock:NaN},{...u,shock:21},{...u,abilities:[]},{...u,abilities:undefined},{...u,abilities:'care_composure'}])assert.equal(careComposureRelief(altered,t,plan,{observed:true}),0);
 assert.equal(careComposureRelief(u,t,plan),0);
 assert.equal(careComposureRelief(u,{...t,id:u.id},plan,{observed:true}),0);
 assert.equal(careComposureRelief(u,{...t,side:'enemy'},plan,{observed:true}),0);
 assert.equal(careComposureRelief(u,t,{...plan,dressingsUsed:0},{observed:true}),0);
 assert.equal(careComposureRelief(u,t,{...plan,hpAfter:t.hp,bleedingAfter:t.bleeding,bandagedAfter:t.bandaged},{observed:true}),0);
 assert.deepEqual({u,t,plan},before);
});

test('paid bandaging changes only caregiver shock relative to ordinary aid and improves real aiming',()=>{
 const b=field({}, {},{enemies:[{id:'enemy',x:1,y:6,patrol:false,overwatch:false}]}),before=structuredClone(b),p=preview(b),plain=withoutAbility(b);
 assert.equal(p.composureRelief,2);assert.equal(itemUsePreview(b,doctor(b),patient(b)).composureRelief,2);
 assert.deepEqual(b,before,'preview cannot pay or calm the caregiver');
 const after=aid(b),ordinary=aid(plain);assert.equal(after.lastError,null);assert.equal(doctor(after).shock,3);
 assert.equal(doctor(after).ap,75);assert.equal(doctor(after).medkits,2);assert.equal(patient(after).hp,55);assert.equal(patient(after).bleeding,0);assert.equal(after.elapsedSeconds,6);
 const neutral=structuredClone(after);delete doctor(neutral).abilities;doctor(neutral).shock=doctor(ordinary).shock;assert.deepEqual(neutral,ordinary,'HP, work, cost, practice, morale, energy, RNG and gear match ordinary aid');
 const gunner={...doctor(after),activeSlot:'primary'},stressed={...gunner,shock:5},enemy=after.units[2];
 const calmerChance=shotChance(after,gunner,enemy),stressedChance=shotChance(after,stressed,enemy);
 assert.equal(calmerChance-stressedChance,10,'two actual shock points affect an unclamped firearm forecast');
 assert.deepEqual(getCareComposureResult(b,after),{unitId:'doc',targetId:'patient',targetKind:'unit',relief:2});
 const receipt=getCareComposureResult(b,after);receipt.relief=99;assert.equal(getCareComposureResult(b,after).relief,2,'caller cannot edit the transient receipt');
 assert.equal(getCareComposureResult(after,after),null);assert.deepEqual(b,before);
});

test('two finite critical strokes can each steady the caregiver but completed care grants nothing',()=>{
 const b=field({}, {hp:1,bleeding:10}),first=aid(b),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(first))),second=aid(restored);
 assert.equal(patient(first).hp,9);assert.equal(doctor(first).shock,3);assert.equal(doctor(first).medkits,2);
 assert.equal(patient(second).hp,15);assert.equal(doctor(second).shock,1);assert.equal(doctor(second).medkits,1);assert.equal(doctor(second).ap,50);
 assert.deepEqual(second,aid(first));assert.equal(preview(second).composureRelief,undefined);
 rejected(second,{type:'heal',unitId:'doc',targetId:'patient'});
 const low=field({shock:.75}),calm=aid(low);assert.equal(doctor(calm).shock,0);assert.equal(getCareComposureResult(low,calm).relief,.75);
});

test('self care, old numeric identity and failed or already finished treatment never award composure',()=>{
 const self=field({hp:55,bleeding:4}),treated=aid(self,{targetId:'doc'});assert.equal(treated.lastError,null);assert.equal(doctor(treated).medkits,2);assert.equal(doctor(treated).shock,5);assert.equal(getCareComposureResult(self,treated),null);
 const legacy=field({id:'130',abilities:undefined}),old=actBattle(legacy,{type:'heal',unitId:'130',targetId:'patient'});assert.equal(old.lastError,null);assert.equal(doctor(old).shock,5);assert.equal(preview(legacy).composureRelief,undefined);
 for(const b of [field({medkits:0}),field({medical:0}),field({energy:0}),field({ap:24}),field({activeSlot:'primary'}),field({}, {hp:0}),field({}, {hp:100,bleeding:0}),field({}, {bandaged:45,bleeding:0}),field({}, {side:'enemy'})]){
  assert.equal(preview(b).composureRelief,undefined);rejected(b,{type:'heal',unitId:'doc',targetId:'patient'});
 }
});

test('an actual observed civilian with the same ID is another person, while an unseen room gives no relief',()=>{
 const npc={id:'doc',name:'Vecina',x:1,y:3,maxHp:60,hp:30,bleeding:4,bandaged:0};
 const b=field({}, {},{npcs:[npc]}),action={type:'heal',unitId:'doc',targetKind:'npc',targetId:'doc'};
 assert.equal(canSee(b,doctor(b),b.npcs[0]),true);assert.equal(medicalUsePreview(b,doctor(b),b.npcs[0],{targetKind:'npc'}).composureRelief,2);
 const after=actBattle(b,action);assert.equal(after.lastError,null);assert.equal(after.npcs[0].hp,30);assert.equal(after.npcs[0].bleeding,0);assert.equal(doctor(after).shock,3);assert.deepEqual(getCareComposureResult(b,after),{unitId:'doc',targetId:'doc',targetKind:'npc',relief:2});
 const hidden=field({}, {},{npcs:[{...npc,roomId:'unrevealed'}]}),hiddenPlan=medicalUsePreview(hidden,doctor(hidden),hidden.npcs[0],{targetKind:'npc'});
 assert.equal(hiddenPlan.composureRelief,undefined);const cared=actBattle(hidden,action);assert.equal(cared.lastError,null,'existing civilian aid rules are unchanged');assert.equal(doctor(cared).shock,5);assert.equal(getCareComposureResult(hidden,cared),null);
 const revealed=structuredClone(hidden);revealed.revealedRooms=['unrevealed'];assert.equal(medicalUsePreview(revealed,doctor(revealed),revealed.npcs[0],{targetKind:'npc'}).composureRelief,2);
});

test('care needs the caregiver direct sight even when ordinary local bandaging remains possible',()=>{
 const b=field({}, {stance:'prone'},{hour:0,night:true});Object.assign(b.tiles.find(tile=>tile.x===2&&tile.y===2),{type:'forest',cover:100,concealment:100});
 assert.equal(canSee(b,doctor(b),patient(b)),false);assert.equal(preview(b).allowed,true);assert.equal(preview(b).composureRelief,undefined);
 const after=aid(b);assert.equal(after.lastError,null);assert.equal(patient(after).bleeding,0);assert.equal(doctor(after).shock,5);assert.equal(getCareComposureResult(b,after),null);
});

test('composed paid approach agrees with separate move and aid, and an interrupted approach earns no relief',()=>{
 const b=field({ap:100,facing:6},{x:5,y:2}),p=itemUsePreview(b,doctor(b),patient(b));assert.equal(p.valid,true);assert.equal(p.movePa,24);assert.equal(p.composureRelief,2);
 const action={type:'useItem',unitId:'doc',targetId:'patient'},combined=actBattle(b,action),manual=aid(actBattle(b,{type:'move',unitId:'doc',...p.destination}));
 assert.deepEqual(combined,manual);assert.equal(doctor(combined).shock,3);assert.equal(doctor(combined).medkits,2);assert.ok(getCareComposureResult(b,combined));
 const interrupted=field({agility:30,experienceLevel:1},{x:4,y:2,hp:25},{enemies:[{id:'e',x:6,y:2,facing:6,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});interrupted.units[2].ap=6;
 const next=actBattle(interrupted,action);assert.equal(doctor(next).medkits,3);assert.equal(getCareComposureResult(interrupted,next),null);assert.ok(next.elapsedSeconds>0);
});

test('ordinary, presented and worker-cloned results keep the same shock and finite state without saved receipts',()=>{
 const b=field(),action={type:'useItem',unitId:'doc',targetId:'patient'},ordinary=actBattle(b,action),presented=presentedActBattle(b,action),worker=structuredClone(runBattleJob({battle:b,action}));
 assert.deepEqual(presented.state,ordinary);assert.deepEqual(worker,ordinary);assert.ok(getCareComposureResult(b,presented.state));
 assert.equal(getCareComposureResult(b,worker),null,'structured clones do not claim action-local notices');
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(ordinary)));assert.deepEqual(saved,ordinary);assert.equal(getCareComposureResult(b,saved),null);
 assert.deepEqual(actBattle(saved,{type:'look',unitId:'doc',direction:2}),actBattle(ordinary,{type:'look',unitId:'doc',direction:2}));
 assert.equal(getCareComposureResult(ordinary,actBattle(ordinary,{type:'look',unitId:'doc',direction:2})),null,'a later order cannot replay a care notice');
});
