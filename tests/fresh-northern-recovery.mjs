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
