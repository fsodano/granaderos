import {prepareFinalAssault} from './final-campaign-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {ammoResourceKey} from '../game/campaign-ammunition.js';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,refillCost,firearmRepairCost} from '../game/campaign.js';

export function prepareFreshTucumanRecapture(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 // Bring the surviving field command and Mendoza reserves to the actual
 // Córdoba garrison. Wounded officers remain patients during assembly.
 const incoming=[];
 for(const [sector,ids]of [['santa_fe',[2,57]],['mendoza',[0,11]]]){
  for(const id of ids){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].location,sector);}
  order({type:'createSquad',name:'Reunión del Norte',ids,sector});incoming.push(c.activeSquadId);
  for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 }
 order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(10)).id});
 if(c.operativeState[10].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:10,quantity:10-c.operativeState[10].medkits});
 order({type:'assignCare',operativeId:10,assignment:'doctor'});order({type:'assignCare',operativeId:1000,assignment:'patient'});
 for(let h=0;h<72&&(incoming.some(id=>c.squads.find(q=>q.id===id).journey)||c.operativeState[1000].hp<c.operativeState[1000].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  if(!c.operativeState[10].medkits)order({type:'purchaseMedicalSupplies',operativeId:10,quantity:1});
  order({type:'wait',hours:1});
 }
 assert.equal(c.operativeState[1000].hp,c.operativeState[1000].maxHp);
 const mainIds=[2,57,0,11,9,10],supportIds=[134,132,111],field=[...mainIds,...supportIds];
 for(const id of mainIds){assert.equal(c.operativeState[id].location,'cordoba');assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);order({type:'assignCare',operativeId:id,assignment:'rest'});}
 for(let h=0;h<48&&(c.hour%24!==6||mainIds.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 for(const id of supportIds){assert.ok(c.operativeState[id].alive);order({type:'recruitCivic',id,term:'day'});}
 order({type:'squad',ids:mainIds});const main=c.activeSquadId;
 order({type:'createSquad',name:'Apoyo del Norte',ids:supportIds,sector:'cordoba'});const support=c.activeSquadId;
 const needed={};for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 if(c.operativeState[10].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:10,quantity:10-c.operativeState[10].medkits});
 for(const id of [main,support]){
  order({type:'selectSquad',id});
  for(const operativeId of c.squad){if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'active'});}
  c=finishReloadsBeforeMarch(c);
 }
 order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'tucuman',queue:true,mode:'posta'});}
 for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'tucuman'});
 assert.equal(c.pendingBattle.squad.length,field.length);assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

function prepareNorthernReturnMarch(start,{from,target,reserveGun=false}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...new Set(start.sectorStates[from].units.filter(u=>u.side==='player'&&u.hp>0).map(u=>Number(u.id)))].filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===from);
 assert.ok(field.includes(2)&&field.includes(57));
 const order=a=>{
  if(a.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;
 };
 const groups=[];
 for(let offset=0;offset<field.length;offset+=6){order({type:'createSquad',name:'Reabastecimiento del Norte',ids:field.slice(offset,offset+6),sector:from});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});}
 for(let h=0;h<24&&groups.some(id=>c.squads.find(q=>q.id===id).journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of field){assert.equal(c.operativeState[id].location,'cordoba');assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);}
 const needed={};for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 if(c.operativeState[10].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:10,quantity:10-c.operativeState[10].medkits});
 for(const id of groups){order({type:'selectSquad',id});for(const operativeId of c.squad){if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'rest'});}}
 for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 for(const id of groups){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
 for(let piece=0;piece<(reserveGun?2:1);piece++){for(let h=0;h<25&&!c.merchants.cordoba.stock.swivel;h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:'swivel'});}order({type:'configureArtillery',types:['swivel']});
 for(const id of groups){order({type:'selectSquad',id});order({type:'travel',sector:from,queue:true,mode:'posta'});}
 for(let h=0;h<24&&groups.some(id=>c.squads.find(q=>q.id===id).journey);h++)order({type:'wait',hours:1});
 for(const id of groups){order({type:'selectSquad',id});order({type:'attack',sector:target,queue:true,mode:'posta'});}
 for(let h=0;h<24&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:target});
 assert.equal(c.pendingBattle.squad.length,field.length);assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export const prepareFreshSaltaRecapture=start=>prepareNorthernReturnMarch(start,{from:'tucuman',target:'salta'});
export const prepareFreshJujuyAssault=start=>prepareNorthernReturnMarch(start,{from:'salta',target:'jujuy',reserveGun:true});

export function prepareFreshFinalColumn(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 let retained=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='jujuy');
 const order=a=>{
  if(a.type==='wait')for(const id of retained){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;
 };
 assert.ok(retained.includes(2)&&retained.includes(57));assert.ok(retained.length<=6);
 order({type:'squad',ids:retained});order({type:'visitSector'});
 const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates.jujuy)),pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 retained=retained.filter(id=>c.operativeState[id].alive);assert.ok(retained.includes(57));
 for(const id of retained){assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15);order({type:'assignCare',operativeId:id,assignment:'active'});}
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 for(let h=0;h<48&&c.squads.find(q=>q.id===c.activeSquadId).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.location,'cordoba');
 const patients=retained.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);assert.ok(!patients.includes(57));
 if(!c.operativeState[57].medkits)order({type:'purchaseMedicalSupplies',operativeId:57,quantity:1});
 order({type:'assignCare',operativeId:57,assignment:'doctor'});for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let h=0;h<72&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  if(!c.operativeState[57].medkits)order({type:'purchaseMedicalSupplies',operativeId:57,quantity:1});
  order({type:'wait',hours:1});
 }
 for(const id of retained)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
 for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&(c.hour%24!==6||retained.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 const field=[1000,134,145,139,140,103];
 for(const id of [145,139,140,103]){assert.ok(c.operativeState[id].alive);order({type:'recruitCivic',id,term:'day'});retained.push(id);}
 order({type:'squad',ids:field});
 for(const operativeId of field.filter(id=>c.operativeState[id].weaponDropped)){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
 const needed={};for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 for(const operativeId of field){assert.equal(c.operativeState[operativeId].hp,c.operativeState[operativeId].maxHp);if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'active'});}
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:['swivel']});
 report({stage:'finalResupply',campaign:c});
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export const prepareFreshHumahuacaAssault=start=>prepareFinalAssault(start,{staging:'jujuy',target:'humahuaca'});
