import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {attendYatasto} from './mission-helpers.mjs';

// Reinforce and position the real survivors before the arriving counterattack.
export function prepareHiredNorthernDefense(start){
 let c=structuredClone(start);
 const order=a=>{if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null);c=n;}}const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;};

// Keep the actual hired force; local officers are not unlocked yet.

const candidates=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&contractQuote(c,o,'week').price<=200).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(o=>o.id);
for(const id of candidates)order({type:'recruitCivic',id,term:'week',destination:'cordoba'});
const until=c.hour+6;for(let h=0;c.hour<until&&h<20;h++)order({type:'wait',hours:1});
const field=rosterFor(c).filter(o=>c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].location==='cordoba').sort((a,b)=>b.marksmanship-a.marksmanship).map(o=>o.id),groups=[];
for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),name:'Defensa de Córdoba',sector:'cordoba'});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:groups[0]});let p=visit(c),b=p.battle;
const cells=b.upperSurfaces.filter(t=>!t.blocked).sort((a,d)=>Math.hypot(a.x-b.width*.5,a.y-b.height*.5)-Math.hypot(d.x-b.width*.5,d.y-b.height*.5)||a.y-d.y||a.x-d.x);
const act=a=>{b=actBattle(b,a);assert.equal(b.lastError,null,JSON.stringify(a)+b.lastError);};
for(const id of c.squad){let u=b.units.find(u=>u.id===String(id));act({type:'movement',unitId:u.id,movement:'walk'});u=b.units.find(u=>u.id===String(id));const dest=cells.find(p=>!b.units.some(v=>v.id!==u.id&&v.hp>0&&sameCell(v,p))&&getReachable(b,u,{stopAt:cell=>sameCell(cell,p)}).length);assert.ok(dest);act({type:'move',unitId:u.id,...spacePoint(dest)});act({type:'stance',unitId:u.id,stance:'crouched'});}
c=leave(sync({campaign:p.campaign,battle:b}));
order({type:'fortify',sector:'cordoba'});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;!c.pendingEncounter&&h<144;h++)order({type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');
order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 return c;
}

// A courier brings officers and paid dressings back before the next raid.
export function prepareNorthernOfficerRelief(start){
 let c=structuredClone(start);
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
const order=a=>{if(a.type==='assignCare'&&c.operativeState[a.operativeId].assignment===a.assignment)return;if(a.type==='wait')for(const id of live()){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(c.lastError,null);}}c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const travel=at=>{const id=c.activeSquadId;order({type:'travel',sector:at,queue:true,mode:'posta'});for(let h=0;h<36&&c.squads.find(q=>q.id===id).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(c.location,at);};

 for(const id of live())order({type:'assignCare',operativeId:id,assignment:'rest'});
 order({type:'transport',mode:'posta'});
 order({type:'createSquad',ids:[114],name:'Enlace provincial',sector:'tucuman'});order({type:'assignCare',operativeId:114,assignment:'active'});travel('cordoba');
 c=meetRecruits(c,['quiroga','paz'],114);
 order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});order({type:'purchaseMedicalSupplies',operativeId:114,quantity:20});
 travel('tucuman');order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy'],114);
 order({type:'sectorInventory',sector:'tucuman',operativeId:114,direction:'drop',item:'medkits',count:20});
 const model=id=>sectorInventoryModel(c,'tucuman',rosterFor(c),id);
 for(const id of [139,1]){const row=model(id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits'&&r.count>=10);assert.ok(row);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:10});}
 const officers=[9,11,1],field=[...officers,...live().filter(id=>!officers.includes(id)&&c.operativeState[id].location==='tucuman'&&c.operativeState[id].hp===c.operativeState[id].maxHp&&c.operativeState[id].morale>=30)];
 assert.ok(field.length>=8,'the officers need actual fit survivors as support');
 for(let h=0;h<36&&field.some(id=>c.operativeState[id].fatigue||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){
  assert.equal(c.pendingEncounter,null);for(const id of live())order({type:'assignCare',operativeId:id,assignment:c.operativeState[id].hp<c.operativeState[id].maxHp?'patient':'rest'});order({type:'wait',hours:1});
 }
 for(const id of field){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),name:'Columna con oficiales',sector:'tucuman'});const p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=finishReloadsBeforeMarch(c);}
 return prepareFinalAssault(c,{staging:'tucuman',target:'salta',fieldIds:field});
}

// Stabilize the actual critical survivor before the envoy carries the agreement.
export function completeHiredNorthernMission(start){
 let c=structuredClone(start),prior=structuredClone(start);
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};

 order({type:'createSquad',ids:[11,129,102,9,117,133],sector:'salta',name:'Socorro de Salta'});
 const p=visit(c),aid=autoBandageBattle(p.battle);c=leave(sync({campaign:p.campaign,battle:aid.battle}));assert.ok(c.operativeState[102].hp>=15);assert.equal(c.operativeState[102].bleeding,0);
 order({type:'diplomacy',kind:'northPact'});
 order({type:'squad',ids:[11]});order({type:'travel',sector:'tucuman',mode:'posta'});assert.equal(c.location,'tucuman');c=attendYatasto(c);
 assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.equal(c.operativeState[1000].alive,false);for(const [id,r] of Object.entries(prior.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[10].alive,prior.operativeState[10].alive);assert.equal(c.operativeState[57].hp,88);assert.ok(!c.recruited.includes(57));assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);

 return c;
}
