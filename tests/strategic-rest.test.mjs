import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {careStatus} from '../game/medical-care.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {preparedCare,DOCTOR,PATIENT,OTHER_DOCTOR,OTHER_PATIENT} from './medical-care-fixture.mjs';
const op=(s,id)=>rosterFor(s).find(o=>o.id===id);
function preparedRest({id=PATIENT,bleeding=0,hp,term='week',twoPairs=false}={}){
 const s=preparedCare({term,twoPairs}),r=s.operativeState[id];Object.assign(r,{energy:8,fatigue:60,bleeding});if(hp!==undefined)r.hp=hp;
 // Exhaustion and wounds are declared prepared state for assignment acceptance.
 synchronizeCampaignPresence(s);return saved({campaign:s}).campaign;
}

test('an exhausted doctor can rest through campaign time and resume finite treatment without a free assignment grant',()=>{
 let s=preparedRest({id:DOCTOR});assert.ok(dispatchCampaign(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'}).lastError);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'rest'});assert.equal(s.operativeState[DOCTOR].energy,8);s=advanceCampaignHours(s,1);assert.equal(s.operativeState[DOCTOR].energy,18);assert.equal(s.operativeState[DOCTOR].fatigue,53);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});const stock=s.operativeState[DOCTOR].medkits,hp=s.operativeState[PATIENT].hp;s=advanceCampaignHours(s,1);assert.equal(s.operativeState[DOCTOR].medkits,stock-1);assert.equal(s.operativeState[DOCTOR].energy,15);assert.equal(s.operativeState[PATIENT].bleeding,0);assert.equal(s.operativeState[PATIENT].hp,hp);assert.ok(saved({campaign:s}));
});

test('six actual safe rest hours yield one health point and saved partial hours cannot be duplicated',()=>{
 let s=order(preparedRest(),{type:'assignCare',id:PATIENT,assignment:'rest'});const initial={...s.operativeState[PATIENT]};
 s=advanceCampaignHours(s,3);assert.equal(s.operativeState[PATIENT].hp,initial.hp);assert.equal(s.operativeState[PATIENT].recoveryHours,3);assert.ok(s.operativeState[PATIENT].energy>initial.energy);assert.ok(s.operativeState[PATIENT].fatigue<initial.fatigue);
 s=order(saved({campaign:s}).campaign,{type:'assignCare',id:PATIENT,assignment:'rest'});assert.equal(s.operativeState[PATIENT].recoveryHours,3);s=advanceCampaignHours(s,2);assert.equal(s.operativeState[PATIENT].hp,initial.hp);s=advanceCampaignHours(saved({campaign:s}).campaign,1);assert.equal(s.operativeState[PATIENT].hp,initial.hp+1);assert.equal(s.operativeState[PATIENT].recoveryHours,0);assert.equal(s.operativeState[PATIENT].medkits,initial.medkits);
 s=order(s,{type:'assignCare',id:PATIENT,assignment:'active'});const p=visit(s),u=p.battle.units.find(u=>u.id===String(PATIENT));assert.equal(u.hp,initial.hp+1);assert.equal(u.energy,s.operativeState[PATIENT].energy);assert.equal(u.fatigue,s.operativeState[PATIENT].fatigue);
});

test('rest does not stop bleeding or grant critical healing, and a patient without a doctor recovers only breath and fatigue',()=>{
 for(const config of [{bleeding:3},{hp:10}]){
  let s=order(preparedRest(config),{type:'assignCare',id:PATIENT,assignment:'rest'}),r={...s.operativeState[PATIENT]};s=advanceCampaignHours(s,6);assert.equal(s.operativeState[PATIENT].hp,r.hp-(r.bleeding?6:0));assert.equal(s.operativeState[PATIENT].bleeding,r.bleeding);assert.equal(s.operativeState[PATIENT].recoveryHours,0);assert.match(careStatus(s,op(s,PATIENT),rosterFor(s)),/necesita un médico/i);assert.ok(s.operativeState[PATIENT].energy>r.energy);assert.ok(saved({campaign:s}));
 }
 let s=order(preparedRest(),{type:'assignCare',id:PATIENT,assignment:'patient'}),hp=s.operativeState[PATIENT].hp;s=advanceCampaignHours(s,6);assert.equal(s.operativeState[PATIENT].hp,hp);assert.ok(s.operativeState[PATIENT].energy>8);assert.match(careStatus(s,op(s,PATIENT),rosterFor(s)),/Sin médico/);
});

test('rest blocks deployment and militia work, and cancellation or occupation clears partial healing without a grant',()=>{
 let s=order(preparedRest({id:DOCTOR,hp:60}),{type:'assignCare',id:DOCTOR,assignment:'rest'});s=advanceCampaignHours(s,5);const hp=s.operativeState[DOCTOR].hp;assert.equal(s.operativeState[DOCTOR].recoveryHours,5);
 for(const action of [{type:'travel',sector:'buenos_aires'},{type:'attack',sector:'san_nicolas'},{type:'visitSector'},{type:'militia',sector:'retiro',rank:0,trainerId:DOCTOR}]){const n=dispatchCampaign(s,action);assert.ok(n.lastError);assert.equal(n.hour,s.hour);}
 // Occupy the actual remote care sector; loss of headquarters ends the campaign.
 let occupied=order(preparedCare(),{type:'travel',sector:'buenos_aires'});Object.assign(occupied.operativeState[DOCTOR],{hp:60,bandaged:0});synchronizeCampaignPresence(occupied);occupied=order(saved({campaign:occupied}).campaign,{type:'assignCare',id:DOCTOR,assignment:'rest'});occupied=advanceCampaignHours(occupied,5);assert.equal(occupied.operativeState[DOCTOR].recoveryHours,5);occupied.sectors.buenos_aires.owner='royalist';const before=occupied.operativeState[DOCTOR].energy,occupiedHp=occupied.operativeState[DOCTOR].hp;const n=advanceCampaignHours(occupied,1);assert.equal(n.operativeState[DOCTOR].hp,occupiedHp);assert.equal(n.operativeState[DOCTOR].energy,before);assert.equal(n.operativeState[DOCTOR].recoveryHours,0);assert.equal(n.defeated,false);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'active'});assert.equal(s.operativeState[DOCTOR].hp,hp);assert.equal(s.operativeState[DOCTOR].recoveryHours,0);s=order(s,{type:'assignCare',id:DOCTOR,assignment:'rest'});s=advanceCampaignHours(s,1);assert.equal(s.operativeState[DOCTOR].hp,hp);assert.equal(s.operativeState[DOCTOR].recoveryHours,1);
 for(const [assignment,hours]of [['rest',6],['rest',-1],['rest',.5],['active',2]]){const wire=JSON.parse(encodeSave(s));Object.assign(wire.campaign.operativeState[DOCTOR],{assignment,recoveryHours:hours});assert.throws(()=>decodeSave(JSON.stringify(wire)),/asignaciones|descanso/i);}
});

test('contract expiry stops rest and clears partial hours without an extra recovery interval',()=>{
 let s=order(preparedRest({id:DOCTOR,hp:60,term:'day'}),{type:'assignCare',id:DOCTOR,assignment:'rest'});s=advanceCampaignHours(s,23);assert.equal(s.operativeState[DOCTOR].recoveryHours,5);const before={...s.operativeState[DOCTOR]};s=advanceCampaignHours(s,1);assert.ok(!s.recruited.includes(DOCTOR));assert.equal(s.operativeState[DOCTOR].assignment,'active');assert.equal(s.operativeState[DOCTOR].recoveryHours,0);assert.equal(s.operativeState[DOCTOR].hp,before.hp);assert.equal(s.operativeState[DOCTOR].energy,before.energy);assert.ok(saved({campaign:s}));
});

test('a resting headquarters squad recovers while a different squad makes an actual march',()=>{
 let s=order(preparedRest({id:DOCTOR,twoPairs:true}),{type:'assignCare',id:DOCTOR,assignment:'rest'});s=order(s,{type:'createSquad',name:'Marcha independiente',ids:[OTHER_DOCTOR,OTHER_PATIENT]});s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,12);assert.equal(s.operativeState[DOCTOR].energy,100);assert.equal(s.operativeState[DOCTOR].fatigue,0);assert.match(careStatus(s,op(s,DOCTOR),rosterFor(s)),/descanso terminó/);assert.equal(s.squads.find(q=>q.members.includes(DOCTOR)).location,'retiro');assert.equal(s.location,'buenos_aires');assert.ok(saved({campaign:s}));
});
