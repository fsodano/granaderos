import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {fightNorthernSector} from './northern-route.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {actBattle,getReachable,artilleryContact,artilleryReloadPreview} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {contractQuote} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';

// A supplied front needs real relief and local care before a new enemy column.
// Hiring, movement, loading, fortification and battle settlement use public orders.
export function holdSurvivorSalta(start,{report=()=>{}}={}){
let c=decodeSave(encodeSave(start)).campaign;assert.equal(c.location,'salta');assert.equal(c.sectors.salta.owner,'patriot');
const roster=rosterFor(c),retained=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
const relief=roster.filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].morale>=10).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,2).map(op=>op.id);
assert.equal(relief.length,2,'the front needs two actually available healthy paid relief soldiers');
const courier=roster.filter(op=>op.id>=100&&op.id<1000&&!relief.includes(op.id)&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&op.medical>=20&&contractQuote(c,op,'day').price<=100).sort((a,b)=>b.medical-a.medical)[0]?.id;
assert.ok(courier,'a living affordable supplied doctor must join the real rear courier');retained.push(courier,...relief);
const events=[];
const order=a=>{if(a.type==='wait')for(const id of retained){const q=c.contracts[id];if(c.recruited.includes(id)&&c.operativeState[id].alive&&q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours)order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});}const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);events.push({action:a,hour:n.hour,cost:c.resources.treasury-n.resources.treasury});c=n;};
for(const id of relief){order({type:'recruitCivic',id,term:'day',destination:'salta'});order({type:'assignCare',operativeId:id,assignment:'rest'});}
for(const gun of c.sectorStates.salta.artillery){if(gun.ammo<6)order({type:'supplyArtillery',sector:'salta',gunId:gun.id,count:6-gun.ammo});}
while(c.sectors.salta.fort<3)order({type:'fortify',sector:'salta'});order({type:'configureArtillery',types:[]});
order({type:'createSquad',sector:'cordoba',name:'Socorro al frente',ids:[57]});order({type:'recruitCivic',id:courier,term:'day'});order({type:'squad',ids:[57,courier]});
for(const operativeId of[57,courier]){const quantity=Math.min(8,c.merchants.cordoba.supplies.medkits);if(quantity)order({type:'purchaseMedicalSupplies',operativeId,quantity});}
c=supplyRouteAmmunition(c,[57,courier],{target:24}).campaign;order({type:'configureArtillery',types:[]});c=finishReloadsBeforeMarch(c);
for(const operativeId of[57,courier])order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'salta',mode:'posta',queue:true});const incoming=c.activeSquadId;
let emplaced=false;for(let h=0;h<48;h++){
 if(!emplaced&&!c.pendingEncounter&&!c.squads.find(q=>q.id===incoming).journey&&retained.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding)){
  order({type:'createSquad',sector:'salta',ids:retained.filter(id=>![57,courier].includes(id)),name:'Batería adelantada'});for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'active'});order({type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates.salta);
  const act=a=>{const n=actBattle(b,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);b=n;};
  for(const gunId of b.artillery.filter(g=>g.side==='player'&&!g.loaded&&g.ammo>0).map(g=>g.id)){
   for(let attempt=0;attempt<12&&!b.artillery.find(g=>g.id===gunId).loaded;attempt++){
    const gun=b.artillery.find(g=>g.id===gunId);const actors=b.units.filter(u=>u.side==='player'&&retained.includes(Number(u.id))&&u.hp>=15&&!u.routed&&!u.departure&&!u.unconscious).sort((a,z)=>Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(z.x-gun.x,z.y-gun.y));
    const ready=actors.find(u=>artilleryReloadPreview(b,u,gun).valid);
    if(ready){act({type:'artilleryReload',unitId:ready.id,artilleryId:gun.id});continue;}
    const crewNeeded=gun.type==='swivel'?1:gun.type==='field8'?3:2;
    const crew=actors.slice(0,crewNeeded);
    let moved=false;
    for(const original of crew){const u=b.units.find(u=>u.id===original.id);
     if(u.mounted){act({type:'mount',unitId:u.id});moved=true;break;}
     if(u.stance==='prone'){act({type:'stance',unitId:u.id,stance:'crouched'});moved=true;break;}
     if(artilleryContact(b,u,gun))continue;
     const cells=getReachable(b,u).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(b,{...u,...p},gun)).sort((a,z)=>a.cost-z.cost||a.y-z.y||a.x-z.x);
     assert.ok(cells.length,'a live crew reaches the actual stationed gun');const p=cells[0];act({type:'move',unitId:u.id,x:p.x,y:p.y,tacticalLevel:0});moved=true;break;
    }
    assert.ok(moved,'the actual finite artillery reload makes progress');
   }
   assert.ok(b.artillery.find(g=>g.id===gunId).loaded,'the real crew loads every supplied piece before the raid');
  }
  const synced=syncBattleTime(c,b);assert.equal(synced.error,null);c=synced.campaign;b=synced.battle;order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});emplaced=true;
 }
 if(c.pendingEncounter){
  const e=c.pendingEncounter;assert.equal(e.sector,'salta');order({type:'respondToEncounter',groupId:e.groupId,choice:'tactical'});
  const deployed=new Set(c.pendingBattle.squad.map(u=>String(u.id)));
  const result=fightNorthernSector(c,e.sector,{controller:stableCrewController(),report});c=result.campaign;
  assert.equal(c.enemyGroups.find(g=>g.id===e.groupId).status,'defeated');
  for(const unit of result.summary.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(c.operativeState[unit.id].alive,false,'actual defense casualties remain permanent');
  for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  report({event:'survivorSaltaHeld',hour:c.hour,treasury:c.resources.treasury,relief,courier,events,casualties:result.summary.units.filter(u=>deployed.has(u.id)&&u.side==='player'&&u.hp<=0).map(u=>Number(u.id))});return c;
 }
 const local=retained.filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='salta');
 const wounded=local.filter(id=>c.operativeState[id].bleeding||c.operativeState[id].hp<c.operativeState[id].maxHp);

 const eligible=rosterFor(c).filter(op=>local.includes(op.id)&&op.medical>=20&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&c.operativeState[op.id].medkits>0).sort((a,b)=>b.medical-a.medical);
 const doctors=eligible.slice(0,2).map(op=>op.id);if(wounded.length&&wounded.every(id=>doctors.includes(id)))doctors.splice(doctors.indexOf(wounded.at(-1)),1);
 for(const operativeId of local)order({type:'assignCare',operativeId,assignment:doctors.includes(operativeId)&&wounded.length?'doctor':wounded.includes(operativeId)?'patient':'rest'});
 order({type:'wait',hours:1});
}

assert.fail("the actual northern column must reach the supplied defended front");
}
