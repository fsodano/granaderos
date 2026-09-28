import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {militiaPromotionStatus} from '../game/garrison.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,visit,leave,tactical} from './local-contract-fixture.mjs';
import {woundedGarrison,MILITIA_DOCTOR as D} from './militia-care-fixture.mjs';
const militia=s=>s.garrisons.retiro??[];
const save=s=>saved({campaign:s}).campaign;
const promotion=(s,trainerId=1000,rank=1)=>order(s,{type:'militia',rank,trainerId});
const finish=s=>order(s,{type:'wait',hours:s.militiaTraining[0].remaining});
function trained({twoCohorts=false,woundedInstructor=false}={}){
 const d=defaultContentPackage();d.rules.startingTreasury=10000;
 for(const at of ['buenos_aires','ensenada'])d.startingTerritory[at]={owner:'patriot',loyalty:65};
 for(const id of [D,137]){const c=d.characters.find(c=>c.id===`person-${id}`);c.arrivalHours=0;c.attributes.leadership=50;}
 if(woundedInstructor){d.careRules={...DEFAULT_CARE_RULES,bleedingDamagePercent:100};d.characters.find(c=>c.id==='person-137').startingCondition={hp:20,energy:100,fatigue:0,bleeding:10,bandaged:0};}
 let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 s=order(s,{type:'recruitCivic',id:D,term:'month'});
 for(let i=0;i<(twoCohorts?2:1);i++)s=finish(order(s,{type:'militia',rank:0,trainerId:1000}));
 return save(leave(visit(s)));
}
function stabilized(){let {campaign:s,patientId}=woundedGarrison();s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:2});s=order(s,{type:'assignCare',id:D,assignment:'active'});assert.equal(militia(s).find(u=>u.id===patientId).hp,19);return {s:save(s),patientId};}
const preserved=['id','hp','maxHp','energy','fatigue','bleeding','bandaged','ammo','loaded','priming','flints','rations','torches','medkits','boleadoras','condition','weapon','blade','weaponMetadata','bladeMetadata','inventory'];
function unchanged(actual,before){for(const key of preserved)assert.deepEqual(actual[key],before[key],`${before.id}: ${key}`);}

test('paid regular promotion retains an actually injured and treated soldier, equipment and identity through reentry',()=>{
 let {s,patientId}=stabilized();const before=structuredClone(militia(s)),next=s.nextMilitiaId;
 for(const rank of [1]){
  const money=s.resources.treasury;s=promotion(s,1000,rank);assert.equal(s.resources.treasury,money-60*(rank+1));assert.deepEqual(s.sectors.retiro.militia,[0,0,0]);assert.deepEqual(militia(s),[]);
  assert.deepEqual(s.militiaTraining[0].trainees.map(u=>u.id),before.map(u=>u.id));s=save(s);s=finish(s);assert.equal(s.militiaTraining.length,0);assert.equal(s.sectors.retiro.militia[rank],3);
  for(const u of militia(s)){const prior=before.find(v=>v.id===u.id);unchanged(u,prior);assert.equal(u.militiaRank,rank);assert.equal(u.marksmanship,prior.marksmanship+8*rank);assert.equal(u.leadership,prior.leadership+5*rank);}
  assert.equal(s.nextMilitiaId,next);s=save(s);
 }
 assert.equal(militia(s).find(u=>u.id===patientId).hp,19,'training does not replace medical treatment');
 const p=visit(s);assert.deepEqual(p.campaign.pendingBattle.garrison.map(u=>u.id),before.map(u=>u.id));for(const u of p.battle.units.filter(u=>u.militia))assert.equal(u.hp,before.find(v=>v.id===Number(u.id)).hp);assert.ok(save(leave(p)));
});

test('unstable or deployed militia cannot be promoted or charged, and availability queries do not issue soldiers',()=>{
 let {campaign:s}=woundedGarrison();const before=structuredClone(s),status=militiaPromotionStatus(s,'retiro',1);assert.equal(status.available,2);assert.equal(status.ready,false);assert.deepEqual(s,before);
 const denied=dispatchCampaign(s,{type:'militia',rank:1,trainerId:1000});assert.match(denied.lastError,/estables/);const error=denied.lastError;denied.lastError=null;assert.deepEqual(denied,before,error);
 // Prepared boundary fixtures for exhaustion and shock, after real paid training.
 s=trained();for(const fields of [{energy:10},{hp:14},{bleeding:1},{unconscious:true},{routed:true}]){const altered=structuredClone(s);Object.assign(militia(altered)[0],fields);assert.equal(militiaPromotionStatus(altered,'retiro',1).ready,false);assert.match(dispatchCampaign(altered,{type:'militia',rank:1,trainerId:1000}).lastError,/estables/);}
 const p=visit(s);assert.equal(militiaPromotionStatus(p.campaign,'retiro',1).available,0);assert.match(dispatchCampaign(p.campaign,{type:'militia',rank:1,trainerId:1000}).lastError,/batalla pendiente/);
 const unissued=trained();delete unissued.garrisons.retiro;const next=unissued.nextMilitiaId;assert.equal(militiaPromotionStatus(unissued,'retiro',1).available,3);assert.equal(unissued.nextMilitiaId,next);assert.equal(unissued.garrisons.retiro,undefined);
});

test('cancelling or dismissing a paid instructor returns the exact reserved cohort without refunds or rank gain',()=>{
 for(const mode of ['cancel','dismiss']){let {s}=stabilized();const before=structuredClone(militia(s));s=promotion(s,D);const money=s.resources.treasury;s=save(s);s=order(s,mode==='cancel'?{type:'cancelMilitia',sector:'retiro'}:{type:'dismiss',id:D});assert.equal(s.resources.treasury,money);assert.equal(s.militiaTraining.length,0);assert.deepEqual(militia(s),before);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);s=save(s);assert.deepEqual(visit(s).campaign.pendingBattle.garrison,before);}
});

test('actual contract expiry and an authored wound death each return their reserved soldiers once',()=>{
 for(const death of [false,true]){let s=trained({woundedInstructor:death});s=order(s,{type:'recruitCivic',id:137,term:death?'week':'day'});const before=structuredClone(militia(s));s=promotion(s,137);assert.ok(s.militiaTraining[0].remaining>24);const next=s.nextMilitiaId;s=order(s,{type:'wait',hours:death?2:24});assert.equal(s.militiaTraining.length,0);assert.deepEqual(militia(s),before);assert.equal(s.nextMilitiaId,next);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);if(death)assert.equal(s.operativeState[137].alive,false);else assert.ok(!s.recruited.includes(137));s=order(save(s),{type:'wait',hours:1});assert.deepEqual(militia(s),before);assert.ok(save(s));}
});

test('a course completing during another squad deployment retains returning trainees alongside deployed survivors',()=>{
 let s=trained({twoCohorts:true}),original=structuredClone(militia(s));s=promotion(s);const traineeIds=s.militiaTraining[0].trainees.map(u=>u.id);s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining-1});s=order(s,{type:'createSquad',name:'Patrulla local',ids:[D]});let p=visit(s);assert.equal(p.campaign.pendingBattle.garrison.length,3);assert.ok(p.battle.units.every(u=>!traineeIds.includes(Number(u.id))));const at=p.campaign.hour;
 while(p.campaign.hour===at)p=tactical(p,{type:'rest',seconds:600});assert.equal(p.campaign.militiaTraining.length,0);assert.equal(militia(p.campaign).length,6);p=saved(p);s=save(leave(p));assert.equal(militia(s).length,6);assert.deepEqual(militia(s).map(u=>u.id).sort(),original.map(u=>u.id).sort());for(const id of traineeIds)unchanged(militia(s).find(u=>u.id===id),original.find(u=>u.id===id));
 const again=visit(s);assert.equal(again.battle.units.filter(u=>u.militia&&u.hp>0).length,6);assert.ok(saved(again));
});

test('saved trainee records reject malformed arrays, invalid health and duplicate physical identities',()=>{
 const s=promotion(trained()),mutations=[c=>c.trainees=null,c=>c.trainees={},c=>c.trainees=[null,null,null],c=>c.trainees.pop(),c=>c.trainees[1].id=c.trainees[0].id,c=>c.trainees[0].hp=0,c=>c.trainees[0].hp=101,c=>c.trainees[0].bleeding=11,c=>c.trainees[0].militiaRank=1,c=>c.trainees[0].ammo=-1,c=>c.rank=0];
 for(const mutate of mutations){const wire=JSON.parse(encodeSave(s));mutate(wire.campaign.militiaTraining[0]);assert.throws(()=>decodeSave(JSON.stringify(wire)),/instrucción|suministros|munición/);}
 {const wire=JSON.parse(encodeSave(s));wire.campaign.garrisons.retiro=[structuredClone(wire.campaign.militiaTraining[0].trainees[0])];assert.throws(()=>decodeSave(JSON.stringify(wire)),/instrucción/);}
 {const wire=JSON.parse(encodeSave(s));wire.campaign.militiaTraining.push({...structuredClone(wire.campaign.militiaTraining[0]),sector:'buenos_aires',trainerId:D});assert.throws(()=>decodeSave(JSON.stringify(wire)),/instrucción/);}
 assert.deepEqual(save(s),s);
});

test('older count-only paid courses remain readable and keep their original count contract',()=>{
 for(const complete of [false,true]){let s=promotion(trained());delete s.militiaTraining[0].trainees;s=save(s);assert.equal(s.militiaTraining[0].trainees,undefined);s=complete?finish(s):order(s,{type:'cancelMilitia',sector:'retiro'});assert.deepEqual(s.sectors.retiro.militia,complete?[0,3,0]:[3,0,0]);assert.equal(militia(s).length,0,'an older course cannot recover identities that were never stored');assert.ok(save(s));}
});

test('territorial loss disperses a reserved cohort instead of returning it behind enemy lines',()=>{
 let s=promotion(trained());const ids=s.militiaTraining[0].trainees.map(u=>u.id);
 // Prepared territory boundary; this is not a claimed successful defense route.
 s.sectors.retiro.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.militiaTraining.length,0);assert.deepEqual(s.sectors.retiro.militia,[0,0,0]);assert.ok(militia(s).every(u=>!ids.includes(u.id)));assert.ok(save(s));
});

test('an older paid veteran course with saved individuals completes without replacing its participants',()=>{
 let {s}=stabilized();s=finish(promotion(s));const before=structuredClone(militia(s));
 // Explicit already-paid, pre-policy save boundary. New veteran tuition is rejected.
 s.militiaTraining=[{sector:'retiro',rank:2,trainerId:1000,count:3,duration:48,remaining:1,started:s.hour,trainees:structuredClone(before)}];s.garrisons.retiro=[];s.sectors.retiro.militia=[0,0,0];
 s=finish(save(s));assert.deepEqual(s.sectors.retiro.militia,[0,0,3]);for(const u of militia(s)){unchanged(u,before.find(v=>v.id===u.id));assert.equal(u.militiaRank,2);}assert.ok(save(s));
});
