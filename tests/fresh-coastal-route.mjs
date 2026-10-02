import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFinalAssault,restoreFinalMorale} from './final-campaign-route.mjs';
import {contractQuote} from '../game/contracts.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,refillCost,firearmRepairCost,isSupplied} from '../game/campaign.js';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';
import {primaryAmmoTypeFor} from '../game/ammo-types.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';

// Continue from the real mountain campaign. Travel and renewal retain their cost.
export function prepareFreshCoastalCommand(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 const field=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.ok(field.includes(57)&&field.length<=5,'the living command must leave a place for the recruit');
 order({type:'squad',ids:field});
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

function preparePaidCoastalAssault(start,target,{prepareAffordableSupport=false,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 let protectedIds=[];
 const order=a=>{if(a.type==='wait')for(const id of protectedIds){let q=c.contracts[id];while(c.recruited.includes(id)&&q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];}}c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 // Recover actual living officers, then buy finite equipment before hiring
 // short-term support. No fixed list may bring an earlier casualty back.
const regulars=c.squad.filter(id=>c.contracts[id]?.expiresAt===null);
for(const id of c.squad.filter(id=>!regulars.includes(id))){
 assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp,'care for short-term survivors before their service ends');
 assert.equal(c.operativeState[id].bleeding,0);
}
assert.ok(regulars.length,'the savings wait needs a command that remains in service');
order({type:'squad',ids:regulars});
const patients=regulars.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),doctors=rosterFor(c).filter(o=>regulars.includes(o.id)&&!patients.includes(o.id)&&o.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,patients.length).map(o=>o.id);
for(const operativeId of regulars)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<96&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 assert.equal(c.pendingEncounter,null);
 for(const operativeId of doctors){if(!c.operativeState[operativeId].medkits)order({type:'purchaseMedicalSupplies',operativeId,quantity:1});order({type:'assignCare',operativeId,assignment:'doctor'});}
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 order({type:'wait',hours:1});
}
for(const operativeId of regulars){assert.equal(c.operativeState[operativeId].hp,c.operativeState[operativeId].maxHp);order({type:'assignCare',operativeId,assignment:'rest'});}
for(let h=0;h<1400&&c.resources.treasury<16000;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(c.resources.treasury>=16000);
const recruits=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].hp===c.operativeState[o.id].maxHp&&contractQuote(c,o,'day').available&&(!prepareAffordableSupport||contractQuote(c,o,'day').price<=100)).sort((a,b)=>c.operativeState[b.id].morale-c.operativeState[a.id].morale||b.marksmanship-a.marksmanship).slice(0,6).map(o=>o.id);
assert.equal(recruits.length,6);const field=[...regulars,...recruits];
if(prepareAffordableSupport){for(const id of recruits)order({type:'recruitCivic',id,term:'day'});protectedIds=recruits;for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});assert.ok(recruits.every(id=>c.recruited.includes(id)));for(const operativeId of recruits)order({type:'assignCare',operativeId,assignment:'rest'});}
const rearm=field.filter(id=>c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon));
for(const id of rearm){for(let h=0;h<48&&!c.merchants.retiro.stock[1801];h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}order({type:'purchaseEquipment',item:1801});if(prepareAffordableSupport&&!rosterFor(c).find(op=>op.id===id).blade){for(let h=0;h<48&&!c.merchants.retiro.stock[1813];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1813});order({type:'equip',operativeId:id,slot:'blade',itemId:1813});}}
for(let n=0;n<2;n++){for(let h=0;h<48&&!c.merchants.retiro.stock.bronze4;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}order({type:'purchaseEquipment',item:'bronze4'});}
for(let h=0;h<24&&c.hour%24!==14;h++)order({type:'wait',hours:1});
if(!prepareAffordableSupport)for(const id of recruits)order({type:'recruitCivic',id,term:'day'});
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(recruits.every(id=>c.recruited.includes(id)),'coastal replacements must arrive before receiving equipment');
for(const operativeId of rearm)order({type:'equip',operativeId,slot:'weapon',itemId:1801});
if(prepareAffordableSupport)for(const operativeId of [...recruits].sort((a,b)=>rosterFor(c).find(op=>op.id===b).medical-rosterFor(c).find(op=>op.id===a).medical))for(const slot of ['headwear','outfit','legwear']){
 if(c.operativeState[operativeId][slot]?.condition>0)continue;
 const model=sectorInventoryModel(c,'retiro',rosterFor(c),operativeId),row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).kind==='outfit'&&JSON.parse(r.expected).outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot]&&JSON.parse(r.expected).condition>0);if(!row)continue;const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},keys=new Set(model.carried.map(r=>r.inventoryKey));
 order({type:'sectorInventory',sector:'retiro',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const now=sectorInventoryModel(c,'retiro',rosterFor(c),operativeId),item=now.carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(item);const{item:sourceItem,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(item.expected),record);assert.equal(now.entries.find(r=>r.key===row.key)?.count??0,row.count-1);order({type:'sectorInventory',sector:'retiro',operativeId,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot});assert.deepEqual(c.operativeState[operativeId][slot],record);assert.deepEqual({hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},before);c=decodeSave(encodeSave(c)).campaign;report({event:'earlyFiniteClothing',operativeId,slot,key:row.key,record,sourceCount:row.count,remaining:row.count-1,...before});
}

order({type:'squad',ids:field.slice(0,6)});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo del puerto',ids:field.slice(6),sector:'retiro'});const support=c.activeSquadId;
c=supplyRouteAmmunition(c,field,{target:12}).campaign;
order({type:'configureArtillery',types:[]});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
if(target==='buenos_aires'){
 if(prepareAffordableSupport){
 for(const operativeId of recruits)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<240&&recruits.some(id=>c.operativeState[id].morale<50);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(recruits.every(id=>c.operativeState[id].morale>=50),'actual affordable paid rest must restore morale');
 }
 // Rehired survivors retain their actual fatigue. Waiting at the assembly
 // point on active duty does not provide the rest needed before this assault.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){
  for(const id of recruits){const contract=c.contracts[id];if(contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  order({type:'wait',hours:1});
 }
 for(const operativeId of field){assert.equal(c.operativeState[operativeId].fatigue,0);assert.equal(c.operativeState[operativeId].energy,100);order({type:'assignCare',operativeId,assignment:'active'});}
}
if(prepareAffordableSupport)report({event:'earlyPaidReadiness',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field:field.map(id=>({id,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price})),support:recruits});
order({type:'configureArtillery',types:['bronze4','bronze4']});
if(target==='ensenada')for(const id of [main,support]){order({type:'selectSquad',id});order({type:'travel',sector:'buenos_aires',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:target,queue:true,mode:'posta'});}
for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
for(let h=0;h<24&&c.hour%24!==6;h++){for(const id of recruits){const contract=c.contracts[id];if(contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}order({type:'wait',hours:1});}
order({type:'beginAssault',sector:target});assert.equal(c.pendingBattle.squad.length,field.length);const battle=enterSector(c.pendingBattle,c.sectorStates[target]);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}

export const prepareFreshEnsenadaAssault=start=>preparePaidCoastalAssault(start,'ensenada');

export function recruitFreshNavalCommand(start){
 let funded=decodeSave(encodeSave(start)).campaign;
 const order=action=>{funded=dispatchCampaign(funded,action);assert.equal(funded.lastError,null,JSON.stringify(action)+funded.lastError);};
 order({type:'selectSquad',id:funded.squads.find(q=>q.members.includes(57)).id});
 // Keep two recruitment places. Other survivors remain at their real sector.
 order({type:'squad',ids:[57]});
 const paidForeign=rosterFor(funded).filter(op=>{
  const r=funded.operativeState[op.id],contract=funded.contracts[op.id];
  return op.foreign&&funded.recruited.includes(op.id)&&r.alive&&!r.captured&&contract?.kind!=='patriot'&&(r.lastMoralePayAt===null||funded.hour-r.lastMoralePayAt>=24);
 }).sort((a,b)=>contractQuote(funded,a,'day').price-contractQuote(funded,b,'day').price);
 for(const op of paidForeign){
  if(funded.reputation.foreign>=30)break;
  order({type:'renewContract',id:op.id,term:'day',expectedExpiresAt:funded.contracts[op.id].expiresAt});
 }
 assert.ok(funded.reputation.foreign>=30,'actual foreign service payments must earn the naval reputation requirement');
 const c=meetRecruits(funded,['brown','bouchard'],57);
 assert.ok(c.recruited.includes(5)&&c.recruited.includes(6));
 assert.ok(c.operativeState[57].alive);assert.equal(c.defeated,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSantaFeAssault(start,{report=()=>{},includeLightGun=false}={}){
 // The coast can leave named officers dead. Recover the real survivors and
 // select affordable, living support without recreating the former squad.
 let c=recoverFreshPort(start,{hospital:'cordoba'});
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 // Long recovery needs affordable continuing service. A costly relief doctor
 // can finish the current treatment without joining the next field contract.
 const field=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba'&&(c.contracts[id]?.kind==='patriot'||contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price<=100);}).slice(0,6);
 assert.ok(field.includes(57));
 order({type:'squad',ids:field});
 c=restoreFinalMorale(c);
 const candidates=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],quote=contractQuote(c,op,'day');return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&quote.available&&quote.price<=100;}).sort((a,b)=>b.marksmanship-a.marksmanship);
 for(const op of candidates.slice(0,6-field.length)){order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});field.push(op.id);}
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 order({type:'squad',ids:field});
 c=restoreFinalMorale(c);
 for(const operativeId of field){
  const primary=rosterFor(c).find(op=>op.id===operativeId);
  if(c.operativeState[operativeId].weaponDropped||!primaryAmmoTypeFor(primary)){
   const model=sectorInventoryModel(c,c.location,rosterFor(c),operativeId);
   const row=model.entries.filter(r=>{const stack=JSON.parse(r.expected);return r.reachable&&stack.item==='weapon'&&stack.weapon===1801&&stack.condition>0;}).sort((a,b)=>b.condition-a.condition||Number(b.loaded)-Number(a.loaded)||a.key.localeCompare(b.key))[0];
   if(row){
    const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury,stock:structuredClone(c.merchants[c.location].stock),contracts:structuredClone(c.contracts)},keys=new Set(model.carried.map(r=>r.inventoryKey));
    order({type:'sectorInventory',sector:c.location,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    const now=sectorInventoryModel(c,c.location,rosterFor(c),operativeId),item=now.carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot==='primary'&&e.valid));assert.ok(item);
    const{item:sourceItem,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(item.expected),record,'local rearming retains the complete finite weapon record');
    assert.equal(now.entries.find(r=>r.key===row.key)?.count??0,row.count-1,'each recovered rifle leaves its actual source once');
    order({type:'sectorInventory',sector:c.location,operativeId,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
    assert.deepEqual({hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury,stock:c.merchants[c.location].stock,contracts:c.contracts},before,'local recovery preserves paid terms, time, money and supplier stock');
    report({event:'santaFeFinitePrimaryRecovered',operativeId,sourceKey:row.key,record,hour:c.hour,second:c.secondOfHour});
   }else{
    const rifle=equipmentCatalog(c).find(item=>item.id===1801);assert.ok(rifle);const key=equipmentKey(rifle);
    for(let h=0;h<48&&!c.merchants[c.location].stock[key];h++){
     assert.ok(isSupplied(c,c.location),'the actual supplier must remain supplied while stock replenishes');assert.equal(c.pendingEncounter,null);
     for(const id of field){let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+1){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}}
     order({type:'wait',hours:1});
    }
    assert.ok(c.merchants[c.location].stock[key]>0,'a bounded real restock must provide the replacement rifle');
    const cash=c.resources.treasury,stock=c.merchants[c.location].stock[key],armory=c.armory[key]??0;
    order({type:'purchaseEquipment',item:key});assert.equal(c.resources.treasury,cash-rifle.price);assert.equal(c.merchants[c.location].stock[key],stock-1);assert.equal(c.armory[key],armory+1);
    order({type:'equip',operativeId,slot:'weapon',itemId:key});assert.equal(c.armory[key],armory);
   }
  }
  if(refillCost(c.operativeState[operativeId]))order({type:'resupply',operativeId});
  if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 c=supplyRouteAmmunition(c,field,{target:15}).campaign;
 order({type:'configureArtillery',types:[]});c=finishReloadsBeforeMarch(c);
 order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});
 report({event:'freshSantaFePreparation',campaign:c,field});
 c=prepareSantaFeBatteries(c,field,{report,includeLightGun});
 const lightStock=c.armory.swivel??0;
 c=prepareFinalAssault(c,{staging:'cordoba',target:'santa_fe',fieldIds:field});
 if(includeLightGun){
  assert.ok(lightStock>0,'the selected light gun must be actual unused stock');
  assert.equal(c.armory.swivel,lightStock-1,'the assault issues exactly one finite light piece');
  assert.equal(c.pendingBattle.artillery.filter(gun=>!gun.stationed&&gun.type==='swivel').length,1);
  report({event:'freshSantaFeLightIssued',before:lightStock,after:c.armory.swivel});
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 const battle=enterSector(c.pendingBattle,c.sectorStates.santa_fe);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}

// Keep the light reserve, but buy two heavier guns for the occupied city.
// Finite merchant stock, contract expiry and the time of day remain active.
export function prepareSantaFeBatteries(start,field,{report=()=>{},includeLightGun=false}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{
  if(action.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+action.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(c.lastError,null,c.lastError);}}
  c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);
 };
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let gun=0;gun<2;gun++){
  for(let hour=0;hour<48&&!c.merchants.cordoba.stock.bronze4;hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  const before=c.resources.treasury,stock=c.merchants.cordoba.stock.bronze4;
  order({type:'purchaseEquipment',item:'bronze4'});
  assert.equal(c.merchants.cordoba.stock.bronze4,stock-1);
  assert.ok(c.resources.treasury<before);
  report({event:'santaFeBatteryPurchase',hour:c.hour,cost:before-c.resources.treasury});
 }
 if(includeLightGun)assert.ok((c.armory.swivel??0)>0,'the coordinated battery needs its paid light reserve');
 order({type:'configureArtillery',types:['bronze4','bronze4',...(includeLightGun?['swivel']:[])]});
 for(let hour=0;hour<48&&(c.hour%24!==6||field.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;}));hour++)order({type:'wait',hours:1});
 assert.equal(c.hour%24,6);
 for(const operativeId of field){const r=c.operativeState[operativeId];assert.equal(r.fatigue,0);assert.equal(r.energy,100);assert.equal(r.asleep,false);order({type:'assignCare',operativeId,assignment:'active'});}
 return c;
}

// Stabilize the surviving command with carried supplies and paid patient contracts.
export function recoverFreshPort(start,{hospital='retiro',report=()=>{},fieldIds}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...new Set(fieldIds??[...c.sectorStates.ensenada.units.filter(u=>u.side==='player'&&u.hp>0).map(u=>Number(u.id)),...c.recruited.filter(id=>['ensenada','buenos_aires'].includes(c.operativeState[id].location)),5,6])].filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured);
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const order=a=>{
  // Retain the actual treating doctors as well as their patients. Otherwise
  // a healthy paid doctor can depart while an injured survivor still needs care.
  if(a.type==='wait')for(const id of new Set([...patients,...field.filter(id=>c.recruited.includes(id)&&c.operativeState[id].assignment==='doctor')])){
   const contract=c.contracts[id];
   if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){
    const cash=c.resources.treasury,next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;
    report({event:'careRenewal',operativeId:id,assignment:c.operativeState[id].assignment,hour:c.hour,cost:cash-c.resources.treasury,previousExpiresAt:contract.expiresAt,expiresAt:c.contracts[id].expiresAt});
   }
  }
  // Shop supplies are finite. Keep paying for patients and doctors while
  // an exhausted medical stock replenishes through the ordinary clock.
  if(a.type==='purchaseMedicalSupplies'){
   for(let h=0;h<48&&dispatchCampaign(c,a).lastError==='La maestranza no tiene suficientes vendas.';h++){
    assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
   }
  }
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
  for(let offset=0;offset<local.length;offset+=6){order({type:'createSquad',name:'Regreso del puerto',ids:local.slice(offset,offset+6),sector:at});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});if(at!==hospital)order({type:'travel',sector:hospital,queue:true,mode:'posta'});}
 }
 for(let h=0;h<48&&groups.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of patients)assert.equal(c.operativeState[id].location,hospital);
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
export function prepareFreshBlockadeAssault(start,options={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const ready=op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&c.contracts[op.id]?.kind==='patriot'&&r.alive&&!r.captured&&r.location==='retiro'&&r.hp===r.maxHp&&!r.bleeding;};
 const roster=rosterFor(c),field=c.squad.filter(id=>ready(roster.find(op=>op.id===id)));
 for(const op of roster.filter(op=>ready(op)&&!field.includes(op.id)).sort((a,b)=>b.medical-a.medical||b.marksmanship-a.marksmanship))if(field.length<5)field.push(op.id);
 assert.ok(field.includes(57)&&field.includes(5)&&field.includes(6),'the actual recovered naval command leads the return');
 c=dispatchCampaign(c,{type:'squad',ids:field});assert.equal(c.lastError,null);
 return preparePaidCoastalAssault(c,'buenos_aires',options);
}
