import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,firearmRepairCost} from '../game/campaign.js';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {holdSurvivorSalta} from './forward-survivor-route.mjs';
import {prepareSurvivorJujuy} from './forward-survivor-advance.mjs';
// Recover and rearm the actual survivors through paid contracts, finite shops
// and public travel orders. No named casualty is required for the next march.
export function prepareSurvivorMarch(start,{staging,target,report=()=>{}}){
 if(target==='jujuy'){
  assert.equal(staging,'salta');
  return prepareSurvivorJujuy(holdSurvivorSalta(start,{report}),{report});
 }
 let c=structuredClone(start);
 const retained=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),field=retained.filter(id=>id!==57);
 const order=a=>{
  if(a.type==='wait')for(const id of retained){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;}}
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 // Keep healthy escorts under contract during the ordinary evacuation.
 for(const id of retained)while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<c.hour+96)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
 // Critical survivors receive local hourly care before any evacuation time.
 // A tactical doctor walking across the field can arrive too late to help.
 for(let h=0;h<24;h++){
  const urgent=retained.filter(id=>{const r=c.operativeState[id];return r.bleeding||r.hp<15;});
  if(!urgent.length)break;
  for(const at of new Set(urgent.map(id=>c.operativeState[id].location))){
   const patients=urgent.filter(id=>c.operativeState[id].location===at);
   const doctors=rosterFor(c).filter(o=>retained.includes(o.id)&&!urgent.includes(o.id)&&o.medical>=20&&c.operativeState[o.id].location===at&&c.operativeState[o.id].medkits>0&&c.operativeState[o.id].energy>10).sort((a,b)=>b.medical-a.medical).slice(0,patients.length);
   assert.ok(doctors.length,'a living local doctor with carried supplies must stabilize the wounded');
   for(const doctor of doctors)order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
   for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
  }
  order({type:'wait',hours:1});
  assert.ok(retained.every(id=>c.operativeState[id].alive),'urgent care must preserve each actual survivor');
 }
 assert.ok(retained.every(id=>!c.operativeState[id].bleeding&&c.operativeState[id].hp>=15));
 c=recoverFreshPort(c,{hospital:'cordoba',fieldIds:retained});
 report({stage:'care',hour:c.hour,treasury:c.resources.treasury,field});
 assert.ok(field.length>=2&&field.length<=6);
 order({type:'createSquad',name:'Columna del Norte',ids:field,sector:'cordoba'});
 const rifle=equipmentKey(equipmentCatalog(c).find(i=>i.id===1801));
 for(const operativeId of field){
  const op=rosterFor(c).find(o=>o.id===operativeId);
  if(c.operativeState[operativeId].weaponDropped||![1800,1801,1802].includes(op.weapon)){
   for(let h=0;h<48&&!c.merchants.cordoba.stock[rifle];h++)order({type:'wait',hours:1});
   order({type:'purchaseEquipment',item:rifle});order({type:'equip',operativeId,slot:'weapon',itemId:rifle});
  }
  if(firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});
 }
 c=supplyRouteAmmunition(c,field,{target:16}).campaign;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(const operativeId of field)if(c.operativeState[operativeId].medkits<10){
  const supply={type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits};
  for(let h=0;h<48&&dispatchCampaign(c,supply).lastError==='La maestranza no tiene suficientes vendas.';h++)order({type:'wait',hours:1});
  order(supply);
 }
 order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const count=Math.min(3,Math.floor(field.length/2));
 for(let n=0;n<count;n++){
  for(let h=0;h<48&&!c.merchants.cordoba.stock.bronze4;h++)order({type:'wait',hours:1});
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100));h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:Array(count).fill('bronze4')});
 report({stage:'supplied',hour:c.hour,treasury:c.resources.treasury,field,campaign:c});
 c=prepareFinalAssault(c,{staging,target,fieldIds:field});
 assert.equal(c.operativeState[57].location,'cordoba');
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}
