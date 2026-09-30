import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {meetLocalRecruit} from './campaign-test-helpers.mjs';

export function prepareMendozaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,action.type+': '+n.lastError);c=n;const {sectorState,survivors,...summary}=action;events.push({action:summary,hour:c.hour,second:c.secondOfHour});};
 assert.equal(c.hour,274);assert.equal(c.phase,3);assert.equal(c.location,'cordoba');
 order({type:'wait',hours:1});assert.equal(c.operativeState[122].energy,100);
 const r=sectorInventoryModel(c,'cordoba',rosterFor(c),142).entries.find(r=>r.reachable&&JSON.parse(r.expected).weapon===1801);assert.ok(r);
 order({type:'sectorInventory',sector:'cordoba',operativeId:142,direction:'take',sourceKey:r.key,expected:r.expected,count:1});
 order({type:'squad',ids:[105,109,115,142,122,116]});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 for(const operativeId of [122,116])order({type:'purchaseMedicalSupplies',operativeId,quantity:5});
 for(const id of c.recruited){const r=c.operativeState[id],t=c.contracts[id];if(r.alive&&t?.expiresAt!=null&&t.expiresAt-c.hour<=20)order({type:'renewContract',id,term:'day',expectedExpiresAt:t.expiresAt});}
 order({type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates.cordoba);const u=b.units.find(u=>u.id==='142'),key=Object.keys(u.inventory).find(k=>u.inventory[k].weapon===1801);assert.ok(key);
 b=actBattle(b,{type:'equipLoot',unitId:'142',inventoryKey:key});assert.equal(b.lastError,null);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {campaign:c,events};
}

export function prepareMendozaRelief(start){
 let c=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,action.type+': '+n.lastError);c=n;const {sectorState,survivors,...summary}=action;events.push({action:summary,hour:c.hour,second:c.secondOfHour});};
 assert.equal(c.hour,287);assert.equal(c.location,'cordoba');const prisoner=structuredClone(c.operativeState[122]);assert.equal(prisoner.captured,true);
 order({type:'recruitCivic',id:139,term:'week'});order({type:'assignCare',operativeId:142,assignment:'patient'});order({type:'assignCare',operativeId:139,assignment:'doctor'});order({type:'wait',hours:1});assert.equal(c.operativeState[142].bleeding,0);
 order({type:'purchaseMedicalSupplies',operativeId:139,quantity:5});
 for(let n=0;c.operativeState[142].hp<c.operativeState[142].maxHp&&n<12;n++)order({type:'wait',hours:1});assert.equal(c.operativeState[142].hp,81);
 for(const operativeId of [142,139])order({type:'assignCare',operativeId,assignment:'rest'});
 for(let n=0;n<6;n++){if(c.contracts[142].expiresAt-c.hour<=2)order({type:'renewContract',id:142,term:'day',expectedExpiresAt:c.contracts[142].expiresAt});order({type:'wait',hours:1});}
 for(const id of [132,143,120,136,134])order({type:'recruitCivic',id,term:'day'});
 order({type:'squad',ids:[132,143,120,136,134,139]});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 assert.deepEqual(c.operativeState[122],prisoner);
 for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {campaign:c,events};
}

export function openMendozaFoundry(start){
 let c=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,action.type+': '+n.lastError);c=n;const {sectorState,survivors,...summary}=action;events.push({action:summary,hour:c.hour,second:c.secondOfHour});};
 assert.equal(c.sectors.mendoza.owner,'patriot');assert.equal(c.operativeState[122].captured,false);
 order({type:'assignCare',operativeId:120,assignment:'doctor'});order({type:'assignCare',operativeId:122,assignment:'patient'});order({type:'wait',hours:1});
 assert.equal(c.operativeState[122].bleeding,0);assert.equal(c.operativeState[122].hp,3);assert.equal(c.operativeState[120].medkits,start.operativeState[120].medkits-1);
 order({type:'squad',ids:[143]});c=meetLocalRecruit(c,{type:'recruit',id:2});assert.equal(c.lastError,null);assert.ok(c.recruited.includes(2));
 assert.equal(c.conversations.beltran.lastApproach,'recruit');
 const before=c.resources;order({type:'foundry'});assert.equal(c.resources.treasury,before.treasury-500);assert.equal(c.resources.copper,before.copper-20);
 const pact=c.resources;order({type:'diplomacy',kind:'parliament'});assert.equal(c.resources.treasury,pact.treasury-200);assert.equal(c.resources.textiles,pact.textiles-60);assert.equal(c.resources.sabres,pact.sabres-10);
 assert.equal(c.flags.foundry,true);assert.equal(c.flags.parliament,true);assert.equal(c.phase,3);assert.equal(c.completed,false);
 for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {campaign:c,events};
}
