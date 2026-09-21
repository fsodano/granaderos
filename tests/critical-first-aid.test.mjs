import test from 'node:test';
import assert from 'node:assert/strict';
import {firstAidPlan} from '../game/first-aid.js';
import {createBattle,actBattle,endTurn,itemUsePreview,medicalUsePreview} from '../game/tactical.js';
import {autoBandageBattle,autoBandageStatus} from '../game/auto-bandage.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const unknown=()=>({attackerId:null,side:'unknown',militia:false,intentional:false});
const medic={id:'doc',name:'Sanitario',x:2,y:2,facing:2,medical:60,dexterity:75,experienceLevel:4,activeSlot:'medical',medkits:3};
const casualty={id:'patient',name:'Herido',x:3,y:2,maxHp:100,hp:1,bleeding:10,bandaged:0,energy:75,stance:'prone',movementMode:'prone',medical:0,medkits:0};
const flat=()=>Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0}));
function field(doctor={},patient={},sector={}){
 const s=createBattle([{...medic,...doctor},{...casualty,...patient}],{width:16,height:10,seed:45,tiles:flat(),enemies:[{id:'enemy',x:14,y:8,patrol:false,overwatch:false}],...sector});
 s.units[0].ap=doctor.ap??100;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;
}
const use=s=>actBattle(s,{type:'useItem',unitId:s.units[0].id,targetId:'patient'});
const physician=s=>s.units[0],patient=s=>s.units.find(u=>u.id==='patient');
const reject=s=>{const n=use(s);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);return n;};

test('critical work follows medical skill, whole two-point HP work and residual bleeding',()=>{
 const plan=firstAidPlan(medic,casualty);assert.equal(plan.skill,70);assert.equal(plan.capacity,16);assert.equal(plan.work,16);assert.equal(plan.hpGain,8);assert.equal(plan.hpAfter,9);assert.equal(plan.bleedingAfter,2);assert.equal(plan.remainingWork,12);assert.equal(plan.paCost,25);assert.equal(plan.dressingsUsed,1);assert.equal(plan.partial,true);
 const next=firstAidPlan(medic,{...casualty,hp:9,bleeding:2});assert.equal(next.hpGain,6);assert.equal(next.work,12);assert.equal(next.hpAfter,15);assert.equal(next.bleedingAfter,0);assert.equal(next.bandagedAfter,85);assert.equal(next.complete,true);assert.equal(next.paCost,25);
 const weak=firstAidPlan({...medic,medical:1,dexterity:0,experienceLevel:1},casualty);assert.equal(weak.capacity,7);assert.equal(weak.hpGain,3);assert.equal(weak.bleedingAfter,6,'the odd work point reduces bleeding');assert.equal(weak.partial,true);
 const strong=firstAidPlan({...medic,medical:100,dexterity:100,experienceLevel:10},casualty);assert.equal(strong.capacity,24);assert.equal(strong.hpGain,12);assert.ok(strong.hpGain>weak.hpGain);
});

test('AP discounts change paid cost without reducing medical work or supply use',()=>{
 for(const baseCost of [25,20,18]){
  const p=firstAidPlan(medic,casualty,{baseCost,budgetAP:baseCost});assert.equal(p.valid,true);assert.equal(p.hpGain,8);assert.equal(p.work,16);assert.equal(p.paCost,baseCost);assert.equal(p.dressingsUsed,1);
  const blocked=firstAidPlan(medic,casualty,{baseCost,budgetAP:baseCost-1});assert.equal(blocked.valid,false);assert.equal(blocked.hpGain,0);assert.equal(blocked.work,0);assert.equal(blocked.dressingsUsed,0);
 }
 for(const patch of [{id:10},{traits:['field_rescuer']},{}]){const s=field(patch),p=medicalUsePreview(s,physician(s),patient(s)),n=use(s);assert.equal(n.lastError,null);assert.equal(physician(n).ap,100-p.cost);assert.equal(patient(n).hp,9);}
});

test('partial treatment spends real dressings and AP and replays after saving',()=>{
 const s=field(),before=structuredClone(s),preview=itemUsePreview(s,physician(s),patient(s));assert.equal(preview.treatment.partial,true);assert.equal(preview.treatment.hpGain,8);
 const once=use(s);assert.equal(once.lastError,null);assert.equal(patient(once).hp,9);assert.equal(patient(once).bleeding,2);assert.equal(physician(once).medkits,2);assert.equal(physician(once).ap,75);
 const twice=use(once);assert.equal(twice.lastError,null);assert.equal(patient(twice).hp,15);assert.equal(patient(twice).bleeding,0);assert.equal(physician(twice).medkits,1);assert.equal(physician(twice).ap,50);assert.equal(twice.elapsedSeconds,6);
 assert.deepEqual(use(validateBattleSnapshot(JSON.parse(JSON.stringify(once)))),twice);assert.deepEqual(s,before);
 const repeated=use(twice);assert.ok(repeated.lastError);assert.deepEqual(repeated.units,twice.units);
});

test('stabilization wakes a breathing patient at15 without granting AP, energy, fatigue relief or posture',()=>{
 const s=field({}, {hp:14,bleeding:0,bandaged:86,energy:60,fatigue:15,knockedDown:true}),before=structuredClone(patient(s)),n=use(s),p=patient(n);
 assert.equal(n.lastError,null);assert.equal(p.hp,15);assert.equal(p.unconscious,false);assert.equal(p.ap,0);
 for(const key of ['energy','fatigue','stance','movementMode','knockedDown','mounted'])assert.equal(p[key],before[key],key);
 const lowBreath=field({}, {hp:14,bleeding:0,energy:0}),treated=use(lowBreath);assert.equal(patient(treated).hp,15);assert.equal(patient(treated).energy,0);assert.equal(patient(treated).unconscious,true);assert.equal(patient(treated).ap,0);
});

test('fully bandaged critical wounds still need stabilization while ordinary wounds never regain HP',()=>{
 const critical=field({}, {hp:10,bleeding:0,bandaged:90}),n=use(critical);assert.equal(n.lastError,null);assert.equal(patient(n).hp,15);assert.equal(patient(n).bandaged,85);
 const ordinary=field({}, {hp:55,bleeding:4,bandaged:0}),treated=use(ordinary);assert.equal(patient(treated).hp,55);assert.equal(patient(treated).bleeding,0);assert.equal(patient(treated).bandaged,45);assert.equal(physician(treated).medkits,2);
});

test('critical first aid never resurrects, exceeds maximum health or consumes unpaid work',()=>{
 for(const patch of [{medkits:0},{medical:0},{ap:24},{activeSlot:'primary'}])reject(field(patch));
 reject(field({}, {hp:0,bleeding:0}));
 for(const maxHp of [10,15,60,100]){const p=firstAidPlan(medic,{...casualty,maxHp,hp:9,bleeding:0});assert.equal(p.hpAfter,Math.min(15,maxHp));assert.ok(p.hpAfter<=maxHp);}
 const fractional=firstAidPlan(medic,{...casualty,hp:14.5,bleeding:2});assert.equal(fractional.hpAfter,15);assert.equal(fractional.hpGain,.5);assert.equal(fractional.work,4);assert.equal(fractional.bleedingAfter,0);assert.equal(fractional.dressingsUsed,1);
});

test('exploration uses the same treatment work and pays time without using AP',()=>{
 const s=field({ap:0},{bleeding:0,bandaged:99},{exploration:true}),first=use(s),second=use(first);
 assert.equal(first.lastError,null);assert.equal(patient(first).hp,9);assert.equal(patient(second).hp,15);assert.equal(physician(second).ap,0);assert.equal(physician(second).medkits,1);assert.equal(second.elapsedSeconds,4);assert.equal(patient(second).energy,75);
});

test('an interrupted approach retains movement and does not spend a critical treatment dressing',()=>{
 const s=field({x:1,y:2,agility:30,experienceLevel:1},{x:4,y:3,hp:1,bleeding:0,bandaged:99},{enemies:[{id:'enemy',x:6,y:2,facing:6,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});s.units.find(u=>u.side==='enemy').ap=6;
 const n=use(s);assert.equal(n.lastError,null);assert.equal(physician(n).medkits,3);assert.ok(physician(n).x>1);assert.equal(patient(n).hp,1);assert.equal(n.units.find(u=>u.side==='enemy').reactionTurn,1);
});

test('critical aid in a player interrupt grants the patient no new reaction turn or AP',()=>{
 const s=field({x:1,y:1,agility:100,experienceLevel:10},{x:4,y:4,hp:14,bleeding:0,bandaged:86},{enemies:[{id:'enemy',x:7,y:1,weapon:1809,agility:30,experienceLevel:1,patrol:false}]});s.units.find(u=>u.side==='enemy').ap=24;
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.ok(!paused.interrupt.unitIds.includes('patient'));
 const treated=use(paused);assert.equal(treated.lastError,null);assert.equal(patient(treated).hp,15);assert.equal(patient(treated).unconscious,false);assert.equal(patient(treated).ap,0);assert.ok(!treated.interrupt.unitIds.includes('patient'));assert.equal(treated.phase,'interrupt');
 assert.deepEqual(use(validateBattleSnapshot(JSON.parse(JSON.stringify(paused)))),treated);
});

test('civilian critical treatment records actual restoration without equipment, AP or erased harm',()=>{
 const s=field({}, {hp:80,bleeding:0},{npcs:[{id:'civil',name:'Vecina',x:2,y:3,civilianHealthVersion:1,maxHp:60,hp:1,energy:75,unconscious:true,stance:'prone',movementMode:'prone',civilianWoundVersion:1,bleeding:10,bandaged:0,bleedSource:unknown()}]});
 const action={type:'useItem',unitId:'doc',targetId:'civil',targetKind:'npc'},first=actBattle(s,action),second=actBattle(first,action);
 assert.equal(first.lastError,null);assert.equal(first.npcs[0].hp,9);assert.equal(first.npcs[0].civilianFirstAid.hpRestored,8);assert.equal(second.npcs[0].hp,15);assert.equal(second.npcs[0].bandaged,45);assert.equal(second.npcs[0].civilianFirstAid.hpRestored,14);assert.equal(second.npcs[0].maxHp,60);assert.equal(second.npcs[0].energy,75);assert.equal(second.npcs[0].stance,'prone');assert.equal(second.npcs[0].unconscious,false);
 for(const key of ['ap','inventory','medkits','morale','xp'])assert.equal(second.npcs[0][key],undefined,key);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(first))),action),second);
});

test('partial critical treatment can still bleed on the next real wound tick',()=>{
 const s=field({}, {},{exploration:true});s.bleedSeconds=5;
 const n=use(s);assert.equal(n.lastError,null);assert.equal(patient(n).hp,7,'eight HP restored, then two HP lost to the remaining bleed');assert.equal(patient(n).bleeding,2);assert.equal(n.elapsedSeconds,2);assert.equal(physician(n).medkits,2);
 const finished=use(n);assert.equal(patient(finished).hp,15);assert.equal(patient(finished).bleeding,0);
});

test('auto-bandage repeats effective finite strokes and reports an unfinished critical patient when supplies end',()=>{
 for(const medkits of [1,2]){
  const s=field({medkits},{bleeding:0,bandaged:99},{exploration:true,enemies:[]}),report=autoBandageBattle(s);
  assert.equal(report.steps.filter(a=>a.type==='useItem').length,medkits);assert.equal(physician(report.battle).medkits,0);assert.equal(patient(report.battle).hp,medkits===1?9:15);
  assert.equal(report.untreated.length,medkits===1?1:0);assert.deepEqual(report.treatedIds,medkits===1?[]:['patient']);
  assert.deepEqual(report.battle,report.steps.reduce((state,action)=>actBattle(state,action),s));
 }
});

test('auto-bandage lets a rescued critical medic use his finite supplies on other patients',()=>{
 const s=createBattle([
  {...medic,id:'first',x:1,y:2,medical:80,medkits:1},
  {...medic,id:'rescued',x:2,y:2,hp:10,medical:1,dexterity:0,experienceLevel:1,activeSlot:'primary',medkits:10},
  {...casualty,id:'a',x:4,y:2,bleeding:0,bandaged:99},{...casualty,id:'b',x:6,y:2,bleeding:0,bandaged:99},
 ],{width:16,height:10,tiles:flat(),exploration:true,enemies:[]});
 const report=autoBandageBattle(s);assert.equal(report.untreated.length,0);assert.equal(report.stoppedReason,null);assert.deepEqual(report.treatedIds,['rescued','a','b']);
 for(const id of ['rescued','a','b'])assert.equal(report.battle.units.find(u=>u.id===id).hp,15);
 assert.ok(report.steps.length>11);assert.equal(report.battle.units.reduce((sum,u)=>sum+u.medkits,0),0);assert.equal(autoBandageStatus(report.battle).available,false);
 assert.deepEqual(report.battle,report.steps.reduce((state,action)=>actBattle(state,action),s));
});

test('AI medics prepare supplies and treat an allied critical patient even with no bleeding',()=>{
 const s=field({activeSlot:'primary'},{hp:1,bleeding:0,bandaged:99}),equip=chooseEnemyAction(s,physician(s));assert.deepEqual(equip,{type:'weapon',unitId:'doc',slot:'medical'});
 const prepared=actBattle(s,equip),first=chooseEnemyAction(prepared,physician(prepared));assert.deepEqual(first,{type:'useItem',unitId:'doc',targetId:'patient'});
 const treated=actBattle(prepared,first);assert.equal(patient(treated).hp,9);assert.equal(patient(treated).bleeding,0);assert.deepEqual(chooseEnemyAction(treated,physician(treated)),first);
});
