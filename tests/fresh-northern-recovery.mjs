import {meetRecruits} from './campaign-recruitment-route.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {createBattle} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';

// Continue the actual wounded survivor at Buenos Aires. Recruitment hydration
// uses the same createBattle record and NPC position as the application's talk handler.
export function recoverFreshNorthernDoctor(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'selectSquad',id:c.squads.find(s=>s.members.includes(122)).id});order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
order({type:'assignCare',operativeId:1000,assignment:'doctor'});order({type:'assignCare',operativeId:122,assignment:'patient'});order({type:'wait',hours:1});order({type:'squad',ids:[1000]});order({type:'assignCare',operativeId:1000,assignment:'active'});order({type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates.buenos_aires);
for(const npcId of ['paroissien','dorrego']){b=approachNPC(b,'1000',npcId);const sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;order({type:'talkNPC',unitId:1000,npcId,approach:'recruit',sectorState:b});const id=c.lastConversation.operativeId,npc=b.npcs.find(n=>n.id===npcId),record=c.pendingBattle.squad.find(o=>o.id===id);b.npcs=b.npcs.filter(n=>n.id!==npcId);if(record){const unit=createBattle([record],{width:b.width,height:b.height,enemies:[],exploration:true}).units.find(u=>u.side==='player');b.units.push({...unit,x:npc.x,y:npc.y});}}
const sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
order({type:'assignCare',operativeId:10,assignment:'doctor'});order({type:'assignCare',operativeId:1000,assignment:'doctor'});
for(let i=0;i<20&&c.operativeState[122].hp<15;i++)order({type:'wait',hours:1});
assert.ok(c.operativeState[122].hp>=15);
order({type:'sectorInventory',sector:'buenos_aires',operativeId:4,direction:'drop',item:'medkits',count:1});
order({type:'sectorInventory',sector:'buenos_aires',operativeId:122,direction:'drop',item:'medkits',count:8});
for(const row of sectorInventoryModel(c,'buenos_aires',rosterFor(c),10).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits'))order({type:'sectorInventory',sector:'buenos_aires',operativeId:10,direction:'take',sourceKey:row.key,expected:row.expected,count:row.count});
order({type:'assignCare',operativeId:10,assignment:'doctor'});
for(let i=0;i<30&&c.operativeState[122].hp<c.operativeState[122].maxHp;i++)order({type:'wait',hours:1});assert.equal(c.operativeState[122].hp,c.operativeState[122].maxHp);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function reuniteFreshNorthernSquad(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'squad',ids:[1000,10,4,122]});
for(let leg=0;leg<6&&c.location!=='cordoba';leg++){
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
 for(const id of [122,126]){const ct=c.contracts[id];if(ct.expiresAt-c.hour<60)order({type:'renewContract',id,term:'week',expectedExpiresAt:ct.expiresAt});}
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});
 assert.equal(c.pendingEncounter,null);
}
assert.equal(c.location,'cordoba');c=meetRecruits(c,['quiroga','paz']);
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'tucuman'});assert.equal(c.pendingEncounter,null);assert.equal(c.location,'tucuman');
const main=c.activeSquadId;order({type:'createSquad',name:'Apoyo de los oficiales',ids:[9,11,126]});const support=c.activeSquadId;order({type:'selectSquad',id:main});order({type:'squad',ids:[1000,10,4,122]});order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy']);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSaltaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const squads=c.squads.filter(q=>q.members.length).map(q=>q.id),ids=c.squads.flatMap(q=>q.members);
for(const id of ids){const model=()=>sectorInventoryModel(c,'tucuman',rosterFor(c),id);
 const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));
 if(row&&![1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));if(count)order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 order({type:'assignCare',operativeId:id,assignment:'rest'});
}
for(let i=0;i<24&&ids.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
for(const id of squads){order({type:'selectSquad',id});order({type:'attack',sector:'salta',queue:true});}for(let i=0;i<30&&!squads.every(id=>c.squads.find(q=>q.id===id)?.journey?.status==='ready');i++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'salta'});
assert.equal(c.pendingBattle.squad.length,8);return c;
}
