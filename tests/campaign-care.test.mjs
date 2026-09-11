import {scriptedBattleReport} from './scripted-battle-report.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {advanceMedicalCare,doctorRate,MEDICAL_KIT_PRICE,careStatus} from '../game/medical-care.js';
import {enterSector} from '../game/world.js';
import {marchToFront} from './campaign-test-helpers.mjs';

const order=(s,action)=>{const next=dispatch(s,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const assign=(s,id,assignment)=>order(s,{type:'assignCare',operativeId:id,assignment});
const wound=(s,id,values={})=>Object.assign(s.operativeState[id],{hp:30,bandaged:s.operativeState[id].maxHp-30,energy:20,fatigue:60},values);
const medicalTeam=()=>{let s=initialCampaign();wound(s,3);s=assign(s,10,'doctor');return assign(s,3,'patient');};

test('doctor treatment requires hours and consumes finite personal kits',()=>{
 let s=medicalTeam();const rate=doctorRate(rosterFor(s).find(o=>o.id===10));assert.equal(s.operativeState[3].hp,30);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].hp,30+rate);assert.equal(s.operativeState[10].medkits,1);assert.equal(s.operativeState[3].bandaged,s.operativeState[3].maxHp-s.operativeState[3].hp);
 s=order(s,{type:'wait',hours:5});assert.equal(s.operativeState[3].hp,30+rate*2);assert.equal(s.operativeState[10].medkits,0);assert.match(careStatus(s,rosterFor(s).find(o=>o.id===10),rosterFor(s)),/botiquines/);
});

test('a critical bleeding patient is stabilized before health recovery',()=>{
 let s=medicalTeam();wound(s,3,{hp:8,bleeding:12,bandaged:0,energy:0});
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].alive,true);assert.equal(s.operativeState[3].hp,8);assert.equal(s.operativeState[3].bleeding,0);assert.equal(s.operativeState[3].bandaged,s.operativeState[3].maxHp-8);assert.equal(s.operativeState[3].energy,12);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].hp,14);s=order(s,{type:'purchaseMedicalSupplies',operativeId:10,quantity:1});s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].hp,20);
});

test('medical skill changes recovery and one doctor cannot heal a whole squad each hour',()=>{
 let s=medicalTeam();wound(s,4,{hp:15,bandaged:s.operativeState[4].maxHp-15,bleeding:8});s=assign(s,4,'patient');
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[4].bleeding,0);assert.equal(s.operativeState[4].hp,15);assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[10].medkits,1);
 assert.ok(doctorRate({medical:98})>doctorRate({medical:20}));
});

test('doctors cannot treat remotely, without energy, or during militia work',()=>{
 let s=medicalTeam();s=order(s,{type:'createSquad',name:'Retaguardia',ids:[3]});s=assign(s,3,'active');s=order(s,{type:'travel',sector:'ensenada'});s=assign(s,3,'patient');s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[10].medkits,2);
 s=medicalTeam();s.operativeState[10].energy=10;s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[10].medkits,2);
 s=initialCampaign();s.militiaTraining=[{trainerId:10,sector:'retiro',rank:0,count:3,duration:8,remaining:8,started:0}];assert.ok(dispatch(s,{type:'assignCare',operativeId:10,assignment:'doctor'}).lastError);
});

test('only assigned safe rest gives slow natural recovery and restores energy',()=>{
 let s=initialCampaign();wound(s,3);s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[3].energy,20);assert.equal(s.operativeState[3].fatigue,60);
 s=assign(s,3,'rest');s=order(s,{type:'wait',hours:5});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[3].energy,80);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].hp,31);assert.equal(s.operativeState[3].bandaged,s.operativeState[3].maxHp-31);
 s.sectors.retiro.owner='royalist';s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[3].hp,31);
});

test('a critical stable patient needs a doctor and cannot heal through sleep',()=>{
 let s=initialCampaign();wound(s,3,{hp:8,bandaged:s.operativeState[3].maxHp-8});s=assign(s,3,'rest');s=order(s,{type:'wait',hours:24});assert.equal(s.hour,0);assert.equal(s.operativeState[3].hp,8);assert.equal(s.operativeState[3].energy,20);assert.ok(s.assignmentAttention.notice.events.some(e=>e.operativeId===3&&e.code==='critical'));
 s=order(s,{type:'wait',hours:24});assert.equal(s.hour,24);assert.equal(s.operativeState[3].hp,8);assert.equal(s.operativeState[3].energy,100);
});

test('travel and deployment require active assignments and cannot grant recovery',()=>{
 let s=medicalTeam();assert.ok(dispatch(s,{type:'travel',sector:'ensenada'}).lastError);assert.ok(dispatch(s,{type:'visitSector'}).lastError);assert.ok(dispatch(s,{type:'attack',sector:'san_nicolas'}).lastError);
 s=assign(s,3,'active');s=assign(s,10,'active');s=order(s,{type:'travel',sector:'ensenada'});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[3].energy,20);
 s=order(s,{type:'visitSector'});assert.ok(dispatch(s,{type:'assignCare',operativeId:3,assignment:'rest'}).lastError);s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:86400});assert.equal(s.operativeState[3].hp,30);assert.equal(s.operativeState[3].energy,20);
});

test('recovery excludes traveling staff even when advancing the hourly subsystem directly',()=>{
 const s=medicalTeam(),before=structuredClone(s.operativeState);advanceMedicalCare(s,rosterFor(s),{traveling:[3,10]});assert.deepEqual(s.operativeState,before);
});

test('unattended bleeding can kill and dead personnel cannot be healed or reassigned',()=>{
 let s=initialCampaign();wound(s,3,{hp:1,bleeding:4,bandaged:0});s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].alive,false);assert.equal(s.operativeState[3].hp,0);assert.ok(!s.squad.includes(3));assert.ok(s.squads.every(q=>!q.members.includes(3)));assert.ok(dispatch(s,{type:'assignCare',operativeId:3,assignment:'patient'}).lastError);
 s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[3].hp,0);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('medical supply purchase costs money, preserves wounds and requires a local supplied workshop',()=>{
 let s=medicalTeam();const money=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',operativeId:10,quantity:5});assert.equal(s.resources.treasury,money-MEDICAL_KIT_PRICE*5);assert.equal(s.operativeState[10].medkits,7);assert.equal(s.operativeState[3].hp,30);
 for(const quantity of [-1,0,1.5,21])assert.ok(dispatch(s,{type:'purchaseMedicalSupplies',operativeId:10,quantity}).lastError);
 s.resources.treasury=0;const before=JSON.stringify(s);assert.ok(dispatch(s,{type:'purchaseMedicalSupplies',operativeId:10}).lastError);assert.equal(JSON.stringify(s),before);
});

test('campaign health and personal medical supplies persist through battle reports and redeployment',()=>{
 let s=initialCampaign();wound(s,3,{hp:35,bleeding:7,bandaged:0,energy:44});s.operativeState[10].medkits=1;s=order(s,{type:'visitSector'});
 const request=s.pendingBattle,unit=request.squad.find(o=>o.id===3);assert.equal(unit.bleeding,7);assert.equal(unit.hp,35);assert.equal(unit.energy,44);assert.equal(request.squad.find(o=>o.id===10).medkits,1);
 const battle=enterSector(request);Object.assign(battle.units.find(u=>u.id==='3'),{hp:33,bleeding:5,bandaged:0,energy:36});battle.units.find(u=>u.id==='10').medkits=0;const reports=battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}));
 s=order(s,{type:'leaveSector',battleId:request.id,sectorState:battle,survivors:reports});s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});const returned=s.pendingBattle.squad.find(o=>o.id===3);assert.equal(returned.hp,33);assert.equal(returned.bleeding,5);assert.equal(returned.energy,36);assert.equal(s.pendingBattle.squad.find(o=>o.id===10).medkits,0);
});

test('conquest reports preserve bandaged wounds and depleted medkits',()=>{
 let s=order(marchToFront(initialCampaign(),{type:'attack',sector:'san_nicolas'}),{type:'attack',sector:'san_nicolas'});const survivors=s.pendingBattle.squad.map(u=>({...u,hp:30,bleeding:0,bandaged:u.maxHp-30,energy:42,medkits:0}));
 s=order(s,scriptedBattleReport(s,{units:survivors}));assert.equal(s.operativeState[3].medkits,0);assert.equal(s.operativeState[3].bandaged,s.operativeState[3].maxHp-30);assert.equal(s.operativeState[3].energy,42);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('legacy saves migrate medical fields and interrupted recovery resumes deterministically',()=>{
 const old=initialCampaign();old.operativeState[3].hp=30;for(const record of Object.values(old.operativeState))for(const key of ['maxHp','bleeding','bandaged','energy','medkits','assignment','recoveryHours'])delete record[key];
 let s=restoreCampaign(JSON.stringify(old));assert.equal(s.operativeState[3].bandaged,s.operativeState[3].maxHp-30);assert.equal(s.operativeState[3].medkits,2);assert.equal(s.operativeState[3].assignment,'active');s=assign(s,3,'rest');s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[3].recoveryHours,4);assert.deepEqual(order(s,{type:'wait',hours:2}),order(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:2}));
});

test('malformed medical assignments, wounds and supplies reject without changing the source',()=>{
 for(const [key,value] of [['assignment','hospital'],['assignment',null],['maxHp',1000],['maxHp',null],['bleeding',-1],['bleeding',101],['bandaged',100],['medkits',-1],['medkits',1.5],['medkits',null],['recoveryHours',6]]){const s=initialCampaign();s.operativeState[3][key]=value;assert.throws(()=>restoreCampaign(serializeCampaign(s)),`${key}: ${value}`);}
 let s=initialCampaign();const before=serializeCampaign(s);const next=dispatch(s,{type:'assignCare',operativeId:3,assignment:'hospital'});assert.ok(next.lastError);assert.equal(serializeCampaign(s),before);
 s=order(s,{type:'visitSector'});const tampered=structuredClone(s);tampered.operativeState[3].assignment='rest';assert.throws(()=>restoreCampaign(serializeCampaign(tampered)));
 const wrongSupply=structuredClone(s);wrongSupply.pendingBattle.squad[0].medkits=-1;assert.throws(()=>restoreCampaign(serializeCampaign(wrongSupply)));
});
