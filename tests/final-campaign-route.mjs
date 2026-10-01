import {baseMorale} from '../game/morale.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,refillCost,firearmRepairCost} from '../game/campaign.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {ammoResourceKey} from '../game/campaign-ammunition.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {decodeSave,encodeSave} from '../game/save.js';

// Advance a supplied column through friendly provinces, then stage the real
// adjacent assault. Short contracts are renewed with their actual expiry.
export function prepareFinalAssault(start,{staging,target,fieldIds=start.squad}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...fieldIds];
 const order=action=>{
  if(action.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+action.hours){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 const origin=c.location,groups=[];
 for(let offset=0;offset<field.length;offset+=6){
  order({type:'createSquad',name:'Columna final',ids:field.slice(offset,offset+6),sector:origin});groups.push(c.activeSquadId);
  if(origin!==staging)order({type:'travel',sector:staging,queue:true,mode:'posta'});
 }
 for(let h=0;h<48&&groups.some(id=>c.squads.find(q=>q.id===id).journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of groups){
  order({type:'selectSquad',id});assert.equal(c.location,staging);
  order({type:'attack',sector:target,queue:true,mode:'posta'});
 }
 for(let h=0;h<24&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:target});
 assert.equal(c.pendingBattle.sector,target);assert.equal(c.pendingBattle.squad.length,field.length);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export function reinforceFinalColumn(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const fieldIds=[...c.squad,104,127,144];
 const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;};
 assert.equal(c.location,'cordoba');
 for(const id of [104,127,144]){
  assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
  order({type:'recruitCivic',id,term:'day'});
  if(c.operativeState[id].weaponDropped){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId:id,slot:'weapon',itemId:1801});}
 }
 const needed={};
 for(const op of rosterFor(c).filter(op=>fieldIds.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,15-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 for(const operativeId of [1000,139])if(c.operativeState[operativeId].medkits<10)order({type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits});
 for(let offset=0;offset<fieldIds.length;offset+=6){
  order({type:'createSquad',name:'Refuerzos finales',ids:fieldIds.slice(offset,offset+6),sector:'cordoba'});
  for(const operativeId of c.squad){if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'active'});}
  c=finishReloadsBeforeMarch(c);
 }
 assert.ok(c.resources.treasury>=0);assert.equal(c.operativeState[57].location,'cordoba');
 return {campaign:c,fieldIds};
}

export function recoverFinalVeterans(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const returning=[1000,139,144],patients=[107,141],fieldIds=[...returning,...patients];
 const order=action=>{
  if(action.type==='wait')for(const id of fieldIds){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+action.hours){const renewed=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(renewed.lastError,null,renewed.lastError);c=renewed;}}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 for(const id of returning){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].location,'jujuy');assert.equal(c.operativeState[id].bleeding,0);}
 order({type:'createSquad',name:'Veteranos del Norte',ids:returning,sector:'jujuy'});const column=c.activeSquadId;
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 order({type:'createSquad',name:'Hospital de Córdoba',ids:[57],sector:'cordoba'});
 for(const id of patients){assert.ok(c.operativeState[id].alive);order({type:'recruitCivic',id,term:'day'});order({type:'assignCare',operativeId:id,assignment:'patient'});}
 order({type:'assignCare',operativeId:57,assignment:'doctor'});
 for(let h=0;h<180&&(c.squads.find(q=>q.id===column).journey||patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp));h++){
  assert.equal(c.pendingEncounter,null);
  const doctors=[57,...(!c.squads.find(q=>q.id===column).journey?[139,1000]:[])];
  for(const operativeId of doctors){if(!c.operativeState[operativeId].medkits)order({type:'purchaseMedicalSupplies',operativeId,quantity:1});order({type:'assignCare',operativeId,assignment:'doctor'});}
  order({type:'wait',hours:1});
 }
 for(const id of fieldIds){assert.equal(c.operativeState[id].location,'cordoba');assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);}
 order({type:'createSquad',name:'Veteranos recuperados',ids:fieldIds,sector:'cordoba'});
 for(const operativeId of fieldIds){
  if(c.operativeState[operativeId].weaponDropped){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
  order({type:'assignCare',operativeId,assignment:'rest'});
 }
 for(let h=0;h<48&&(c.hour%24!==6||fieldIds.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 const needed={};for(const op of rosterFor(c).filter(op=>fieldIds.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,15-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 for(const operativeId of [1000,139])if(c.operativeState[operativeId].medkits<10)order({type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits});
 for(const operativeId of fieldIds){if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'active'});}
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:['bronze4']});
 assert.ok(c.operativeState[57].alive);assert.equal(c.operativeState[57].location,'cordoba');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function restoreFinalMorale(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...c.squad],roster=rosterFor(c);
 const target=id=>baseMorale(roster.find(o=>o.id===id));
 const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;};
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<600&&(field.some(id=>c.operativeState[id].morale<target(id))||c.hour%24!==6);h++){
  assert.equal(c.pendingEncounter,null);
  for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  order({type:'wait',hours:1});
 }
 for(const id of field){assert.ok(c.operativeState[id].morale>=target(id));assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].fatigue,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function supplyFinalGrenades(start){
 let c=decodeSave(encodeSave(start)).campaign;const ids=[...c.squad];
 const order=action=>{
  if(action.type==='wait')for(const id of ids){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+1){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 const travel=sector=>{order({type:'travel',sector,queue:true,mode:'posta'});for(let h=0;h<48&&c.squads.find(q=>q.id===c.activeSquadId).journey;h++)order({type:'wait',hours:1});assert.equal(c.location,sector);};
 travel('mendoza');
 for(const operativeId of [1000,144,141])order({type:'purchaseGrenades',grenadeType:'arsenal',operativeId,quantity:2});
 travel('cordoba');
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&(c.hour%24!==6||ids.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 assert.equal(c.merchants.mendoza.grenades.arsenal,0);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
