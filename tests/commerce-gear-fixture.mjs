import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {addEquipment} from '../game/stored-equipment.js';
import {equipmentKey} from '../game/equipment-catalog.js';
import {changeAmmo,AMMO_TYPES} from '../game/ammo-types.js';
import {makeGrenadeStack,isGrenadeStack} from '../game/grenades.js';
import {syncCarriedAmmunition} from '../game/physical-ammunition.js';

// Authored finite property for isolated custody/equipment scenarios. These
// helpers do not execute a purchase or alter a new-player route constructor.
export function withStoredGear(state,item,quantity=1){const next=structuredClone(state);addEquipment(next,item,quantity);return next;}
export function withCarriedAmmo(state,operativeId,family,quantity){
 assert.ok(Number.isSafeInteger(quantity)&&quantity>0);const next=structuredClone(state),record=next.operativeState[operativeId],operative=rosterFor(next).find(row=>row.id===operativeId);
 assert.ok(record&&operative);changeAmmo(record,family,quantity);syncCarriedAmmunition(record,operative.weapon);return next;
}
export function withStoredAmmo(state,sector,family,quantity){
 assert.ok(Object.hasOwn(AMMO_TYPES,family)&&Number.isSafeInteger(quantity)&&quantity>0);const next=structuredClone(state);next.ammunitionStores[sector]??={};const total=(next.ammunitionStores[sector][family]??0)+quantity;assert.ok(total<=1_000_000);next.ammunitionStores[sector][family]=total;return next;
}
export function asLegacyMerchantGear(state,instanceId,sector=state.location){
 const next=structuredClone(state),index=next.armoryItems.findIndex(row=>row.id===instanceId);assert.ok(index>=0);const [item]=next.armoryItems.splice(index,1);
 next.armory[equipmentKey(item)]--;next.merchants[sector].usedItems.push(item);return next;
}
export function assertTradeRejected(state,action){
 const before=structuredClone(state),next=dispatchCampaign(state,action);assert.match(next.lastError,/comercio de equipo/);
 assert.deepEqual({...next,lastError:state.lastError},before);assert.deepEqual(state,before);return next;
}

export function withCarriedGrenades(state,operativeId,quantity){
 assert.ok(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=6);const next=structuredClone(state),record=next.operativeState[operativeId];assert.ok(record);record.inventory??={};const old=record.inventory['grenade:arsenal'];assert.ok(!old||isGrenadeStack(old));const count=(old?.count??0)+quantity;assert.ok(count<=6);record.inventory['grenade:arsenal']=old?{...old,count}:makeGrenadeStack('arsenal',count);return next;
}

export function withCarriedRepairKit(state,operativeId,points=100){
 assert.ok(Number.isSafeInteger(points)&&points>0&&points<=100);const next=structuredClone(state),record=next.operativeState[operativeId];assert.ok(record);record.inventory??={};assert.equal(record.inventory['fixture:repair-kit'],undefined);record.inventory['fixture:repair-kit']={kind:'repair-kit',name:'Juego de herramientas',count:1,weight:2,repairPoints:points};return next;
}
