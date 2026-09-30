import {autoBandageBattle} from '../game/auto-bandage.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {ammoResourceKey} from '../game/campaign-ammunition.js';
import {doctorRate} from '../game/medical-care.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,refillCost,firearmRepairCost} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';

// Continue from the real mountain campaign. Travel and renewal retain their cost.
export function prepareFreshCoastalCommand(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 order({type:'squad',ids:[2,7,8,57]});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'retiro',mode:'posta'});
 assert.equal(c.location,'retiro');assert.ok(c.hour>before.hour);
 c=meetRecruits(c,['cabral'],57);
 assert.ok(c.recruited.includes(3));assert.equal(c.conversations.cabral.lastApproach,'recruit');
 assert.ok(c.operativeState[57].alive);assert.equal(c.completed,false);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function prepareFreshEnsenadaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(a.type==='wait'&&c.contracts[105]?.expiresAt!==null&&c.contracts[105]?.expiresAt<=c.hour+a.hours){const contract=c.contracts[105],next=dispatchCampaign(c,{type:'renewContract',id:105,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
 };
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<1400&&c.resources.treasury<16000;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(let i=0;i<3;i++){for(let h=0;h<25&&!c.merchants.retiro.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});}
// The returning scout retains his real wounds after a contract expires.
// Hire him early enough for paid care before signing the short elite contracts.
order({type:'recruitCivic',id:105,term:'day'});
const patient=c.operativeState[105],doctor=rosterFor(c).find(op=>op.id===8);
const dressings=Math.ceil((patient.maxHp-patient.hp)/doctorRate(doctor))+Number(patient.bleeding>0);
const shortfall=Math.max(0,dressings-c.operativeState[8].medkits);
if(shortfall)order({type:'purchaseMedicalSupplies',operativeId:8,quantity:shortfall});
if(dressings){
 order({type:'assignCare',operativeId:8,assignment:'doctor'});order({type:'assignCare',operativeId:105,assignment:'patient'});
 for(let h=0;h<48&&c.operativeState[105].hp<c.operativeState[105].maxHp;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[105].hp,c.operativeState[105].maxHp);assert.equal(c.operativeState[105].bleeding,0);
}
for(let i=0;i<24&&c.hour%24!==14;i++)order({type:'wait',hours:1});
for(const id of [109,138,128,106,135])order({type:'recruitCivic',id,term:'day'});
order({type:'squad',ids:[7,8,2,57,3,105]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo del puerto',ids:[109,138,128,106,135],sector:'retiro'});const support=c.activeSquadId;
for(const operativeId of [2,57,3])order({type:'equip',operativeId,slot:'weapon',itemId:1801});
const field=[7,8,2,57,3,105,109,138,128,106,135],needed={};
for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.retiro?.[ammoResourceKey(ammoType)]??0));for(let remaining=quantity;remaining>0;remaining-=60)order({type:'purchaseAmmunition',ammoType,quantity:Math.min(60,remaining)});}
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
order({type:'purchaseEquipment',item:'bronze4'});order({type:'configureArtillery',types:['bronze4']});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'buenos_aires',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'ensenada',queue:true,mode:'posta'});}
for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});for(let h=0;h<24&&c.hour%24!==6;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'ensenada'});
 assert.equal(c.pendingBattle.squad.length,11);
 return c;
}

export function recruitFreshNavalCommand(start){
 let funded=dispatchCampaign(start,{type:'selectSquad',id:start.squads.find(q=>q.members.includes(57)).id});assert.equal(funded.lastError,null);
 for(const offer of ['supplies','materials']){funded=dispatchCampaign(funded,{type:'contraband',offer});assert.equal(funded.lastError,null);}
 assert.ok(funded.reputation.foreign>=30);assert.equal(funded.shipments.length,start.shipments.length+2);
 const c=meetRecruits(funded,['brown','bouchard'],57);
 assert.ok(c.recruited.includes(5)&&c.recruited.includes(6));
 assert.ok(c.operativeState[57].alive);assert.equal(c.defeated,false);
 for(const id of [3,118])assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSantaFeAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 const field=[2,6,57];for(const id of field)assert.ok(c.operativeState[id].alive);
 order({type:'squad',ids:field});for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'retiro',mode:'posta'});
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20);
 assert.ok(doctors.length);
 for(const op of doctors){const needed=Math.max(0,5-c.operativeState[op.id].medkits);if(needed)order({type:'purchaseMedicalSupplies',operativeId:op.id,quantity:needed});order({type:'assignCare',operativeId:op.id,assignment:'doctor'});}
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let h=0;h<72&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  for(const op of doctors)if(!c.operativeState[op.id].medkits)order({type:'purchaseMedicalSupplies',operativeId:op.id,quantity:1});
  order({type:'wait',hours:1});
 }
 for(const id of field){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 if(c.operativeState[2].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:2,quantity:10-c.operativeState[2].medkits});
 if(c.resources.ammo_musket_75<30)order({type:'purchaseAmmunition',ammoType:'musket_75',quantity:30-c.resources.ammo_musket_75});
 for(const operativeId of field){if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'rest'});}
 for(let h=0;h<48&&(c.hour%24!==18||field.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
 for(const id of [128,142,146]){assert.ok(c.operativeState[id].alive);order({type:'recruitCivic',id,term:'day'});field.push(id);}
 order({type:'squad',ids:field});
 const needed={};for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.retiro?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});
 order({type:'travel',sector:'san_nicolas',queue:true,mode:'posta'});
 for(let h=0;h<36&&c.squads.find(q=>q.id===c.activeSquadId).journey;h++)order({type:'wait',hours:1});
 order({type:'attack',sector:'santa_fe',queue:true,mode:'posta'});
 for(let h=0;h<24&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'santa_fe'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),field);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// Stabilize the surviving command with carried supplies and paid patient contracts.
export function recoverFreshPort(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...new Set([...c.sectorStates.ensenada.units.filter(u=>u.side==='player'&&u.hp>0).map(u=>Number(u.id)),...c.recruited.filter(id=>['ensenada','buenos_aires'].includes(c.operativeState[id].location)),5,6])].filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured);
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const order=a=>{
  if(a.type==='wait')for(const id of patients){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;
 };
 // Routed survivors may be in a different province. Stop their bleeding at
 // their real location before advancing any evacuation clock.
 for(const at of new Set(patients.filter(id=>c.operativeState[id].bleeding).map(id=>c.operativeState[id].location))){
  const local=field.filter(id=>c.operativeState[id].location===at);
  assert.ok(local.length<=6,'the actual first-aid party must fit a squad');
  order({type:'createSquad',name:'Socorro del puerto',ids:local,sector:at});order({type:'visitSector'});
  const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates[at])),pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
  for(const id of local)assert.equal(c.operativeState[id].bleeding,0);
 }
 const groups=[];
 for(const at of new Set(field.map(id=>c.operativeState[id].location))){
  const local=field.filter(id=>c.operativeState[id].location===at);
  for(let offset=0;offset<local.length;offset+=6){order({type:'createSquad',name:'Regreso del puerto',ids:local.slice(offset,offset+6),sector:at});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});if(at!=='retiro')order({type:'travel',sector:'retiro',queue:true,mode:'posta'});}
 }
 for(let h=0;h<48&&groups.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of patients)assert.equal(c.operativeState[id].location,'retiro');
 const command=c.squads.find(q=>q.members.includes(57));assert.ok(command);order({type:'selectSquad',id:command.id});
 const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&c.recruited.includes(op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&op.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,Math.max(1,patients.length));
 assert.ok(doctors.length,'a healthy survivor must provide care');
 for(const doctor of doctors){if(!c.operativeState[doctor.id].medkits)order({type:'purchaseMedicalSupplies',operativeId:doctor.id,quantity:1});order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});}
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let h=0;h<72&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  for(const doctor of doctors)if(!c.operativeState[doctor.id].medkits)order({type:'purchaseMedicalSupplies',operativeId:doctor.id,quantity:1});
  order({type:'wait',hours:1});
 }
 for(const id of patients){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}


// Rebuild paid support and lift the actual naval occupation before the northern road.
export function prepareFreshBlockadeAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 const mainIds=[2,8,57,5,6],supportIds=[109,138,128,135],field=[...mainIds,...supportIds];
 for(const id of field){assert.ok(c.operativeState[id].alive,`operative ${id} must survive to deploy`);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);}
 // Keep the remote garrisons in place. The recovered naval command is already
 // at Retiro; an order to travel to its current sector is not a valid march.
 for(const id of mainIds)assert.equal(c.operativeState[id].location,'retiro');
 order({type:'squad',ids:mainIds});
 for(const operativeId of mainIds)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<1200&&c.resources.treasury<16000;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(c.resources.treasury>=16000);
 for(const operativeId of [5,6]){for(let h=0;h<25&&!c.merchants.retiro.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
 for(let h=0;h<24&&c.hour%24!==14;h++)order({type:'wait',hours:1});
 for(const id of supportIds)order({type:'recruitCivic',id,term:'day'});
 for(const operativeId of supportIds.filter(id=>c.operativeState[id].weaponDropped)){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
 order({type:'squad',ids:mainIds});const main=c.activeSquadId;
 order({type:'createSquad',name:'Apoyo del bloqueo',ids:supportIds,sector:'retiro'});const support=c.activeSquadId;
 for(const operativeId of [135,8]){const needed=Math.max(0,15-c.operativeState[operativeId].medkits);if(needed)order({type:'purchaseMedicalSupplies',operativeId,quantity:needed});}
 const needed={};
 for(const op of rosterFor(c).filter(op=>field.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)needed[type]=(needed[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type));}
 for(const [ammoType,amount]of Object.entries(needed)){const quantity=Math.max(0,amount-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.retiro?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
 order({type:'purchaseEquipment',item:'bronze4'});order({type:'configureArtillery',types:['bronze4']});
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'buenos_aires',queue:true,mode:'posta'});}
 for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id)?.journey?.status==='ready');h++)order({type:'wait',hours:1});
 for(let h=0;h<24&&c.hour%24!==6;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'buenos_aires'});
 assert.equal(c.pendingBattle.squad.length,field.length);
 for(const unit of c.pendingBattle.squad){assert.ok(unit.loaded>0,`operative ${unit.id} needs a loaded firearm`);assert.ok(unit.ammo>=8,`operative ${unit.id} needs reserve rounds`);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}
