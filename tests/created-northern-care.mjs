import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {supplyRouteDressings} from './route-dressings.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {BLADES} from '../game/tactical.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {doctorRate} from '../game/medical-care.js';
import {contractQuote} from '../game/contracts.js';

export function recoverNorthernLocalKit(start,{doctorId=135,report=()=>{}}={}){
 let c=start;const clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},contracts=structuredClone(c.contracts),before142=structuredClone(c.operativeState[142]);
 const order=a=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);c=n;};
 const model=id=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const sources=model(doctorId).entries.filter(row=>row.key.includes(JSON.stringify(['serviceReturn',before142.serviceEquipmentReturn.id]).slice(0,-1)));
 assert.equal(sources.length,7,'the actual expired elite left five physical kit items, compatible cartridges and dressings');
 for(const source of sources){
  const before=model(doctorId),keys=new Set(before.carried.filter(row=>row.inventoryKey).map(row=>row.inventoryKey));assert.equal(source.reachable,true,source.reason);
  const stack=JSON.parse(source.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:doctorId,direction:'take',sourceKey:source.key,expected:source.expected,count:source.count});
  const after=model(doctorId);assert.equal(after.entries.find(row=>row.key===source.key)?.count??0,0,'the exact former-carrier source is fully debited once');
  const slot=stack.kind==='outfit'?({hat:'headwear',poncho:'outfit',trousers:'legwear'})[stack.outfit]:stack.weapon===1801?'primary':BLADES[stack.weapon]?'blade':null;
  if(slot){
   const carried=after.carried.find(row=>row.inventoryKey&&!keys.has(row.inventoryKey)&&row.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(carried);
   const {item,...record}=stack;assert.deepEqual(JSON.parse(carried.expected),record);
   order({type:'sectorInventory',sector:'cordoba',operativeId:doctorId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});
   if(['primary','blade'].includes(slot))assert.deepEqual(JSON.parse(model(doctorId).carried.find(row=>row.item===slot).store.expected),stack);
   else assert.deepEqual(c.operativeState[doctorId][slot],record);
  }
  report({event:'northernActualExpiredKit',operativeId:doctorId,sourceKey:source.key,count:source.count,stack});
 }
 assert.equal(c.operativeState[142].serviceEquipmentReturn,undefined,'fully collected gear clears only the exact retired owner');
 assert.equal(c.recruited.includes(142),false);assert.equal(c.operativeState[142].alive,true);
 for(const key of ['hp','maxHp','bleeding','morale','energy','fatigue','location'])assert.deepEqual(c.operativeState[142][key],before142[key]);
 for(const operativeId of c.recruited.filter(id=>id!==57&&c.operativeState[id].alive&&c.operativeState[id].location==='cordoba'))for(const slot of ['headwear','outfit','legwear']){
  if(c.operativeState[operativeId][slot]?.condition>0)continue;
  const before=model(operativeId),keys=new Set(before.carried.map(row=>row.inventoryKey)),kind=({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot],row=before.entries.filter(row=>row.reachable&&JSON.parse(row.expected).kind==='outfit'&&JSON.parse(row.expected).outfit===kind&&JSON.parse(row.expected).condition>0).sort((a,b)=>(JSON.parse(b.expected).condition??0)-(JSON.parse(a.expected).condition??0)||a.key.localeCompare(b.key))[0];assert.ok(row,'a real local spare body item must exist');
  order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const after=model(operativeId),carried=after.carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(carried);
  const {item,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(carried.expected),record);assert.equal(after.entries.find(r=>r.key===row.key)?.count??0,row.count-1);
  order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});assert.deepEqual(c.operativeState[operativeId][slot],record);
  report({event:'northernActualBodyKit',operativeId,slot,sourceKey:row.key,record});
 }
 assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);assert.deepEqual(c.contracts,contracts);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export function recoverActualNorthernLocal(start,{doctorId=135,activateAfterCare=true,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(c),ids=[...c.squad],events=[];
 const order=a=>{
  if(a.type==='wait')for(const id of ids){while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});}}
  const money=c.resources.treasury,quote=a.type==='renewContract'?contractQuote(c,rosterFor(c).find(o=>o.id===a.id),'day'):null,next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+' '+next.lastError);c=next;
  if(quote){assert.equal(c.resources.treasury,money-quote.price);assert.equal(c.contracts[a.id].expiresAt,quote.expiresAt);}
  events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:money-c.resources.treasury});
 };
 for(const id of ids)while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+2)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
 order({type:'visitSector'});const initial=enterSector(c.pendingBattle,c.sectorStates[c.location]),medicalBefore=initial.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),aid=autoBandageBattle(initial);
 assert.equal(aid.battle.lastError,null);const uses=aid.steps.filter(a=>a.type==='useItem').length;
 assert.equal(aid.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),medicalBefore-uses);
 const pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 for(const id of ids){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
 const patients=ids.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),rate=doctorRate(rosterFor(c).find(o=>o.id===doctorId),c),needed=patients.reduce((n,id)=>n+c.operativeState[id].maxHp-c.operativeState[id].hp,0);
 report({event:'northernActualBandaging',aidDressings:uses,patients,rate,needed,stock:ids.map(id=>({id,hp:c.operativeState[id].hp,medkits:c.operativeState[id].medkits}))});
 const target=Math.ceil(needed/rate)+2,inventory=()=>sectorInventoryModel(c,c.location,rosterFor(c),doctorId);
 for(let attempt=0;attempt<100&&c.operativeState[doctorId].medkits<target;attempt++){
  let row=inventory().entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!row){
   const donorId=ids.find(id=>id!==doctorId&&!patients.includes(id)&&c.operativeState[id].hp>=15&&(c.operativeState[id].medkits??0)>0);
   if(donorId===undefined){
    c=supplyRouteDressings(c,doctorId,target,{report});continue;
   }
   const quantity=Math.min(c.operativeState[donorId].medkits,target-c.operativeState[doctorId].medkits),donorBefore=c.operativeState[donorId].medkits,keys=new Set(inventory().entries.map(r=>r.key)),clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
   order({type:'sectorInventory',sector:c.location,operativeId:donorId,direction:'drop',item:'medkits',count:quantity});assert.equal(c.operativeState[donorId].medkits,donorBefore-quantity);
   row=inventory().entries.find(r=>!keys.has(r.key)&&r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row,'the healer must reach the exact finite donation');assert.equal(row.count,quantity);assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);
   report({event:'northernFiniteCareDonation',donorId,quantity,remaining:donorBefore-quantity,sourceKey:row.key});
  }
  const carriedBefore=c.operativeState[doctorId].medkits,count=Math.min(row.count,target-c.operativeState[doctorId].medkits),clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};order({type:'sectorInventory',sector:c.location,operativeId:doctorId,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(inventory().entries.find(r=>r.key===row.key)?.count??0,row.count-count);assert.equal(c.operativeState[doctorId].medkits,carriedBefore+count);assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);
  report({event:'northernFiniteCareKit',operativeId:doctorId,sourceKey:row.key,count,remaining:row.count-count});
 }
 assert.ok(c.operativeState[doctorId].medkits>=target);
 const kits=c.operativeState[doctorId].medkits;
 for(const id of ids)order({type:'assignCare',operativeId:id,assignment:patients.includes(id)?'patient':id===doctorId&&patients.length?'doctor':'rest'});
 for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){assert.equal(c.pendingEncounter,null,'resolve an actual invasion before elapsed local care');order({type:'wait',hours:1});}
 for(const id of ids){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'rest'});}
 for(let h=0;h<48&&ids.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of ids){assert.equal(c.operativeState[id].energy,100);assert.equal(c.operativeState[id].fatigue,0);assert.equal(c.operativeState[id].asleep,false);if(activateAfterCare)order({type:'assignCare',operativeId:id,assignment:'active'});}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.equal(c.operativeState[5].alive,true);assert.equal(c.operativeState[5].location,'tucuman');assert.equal(c.operativeState[142].alive,true);assert.equal(c.recruited.includes(142),false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'northernActualLocalRecovery',site:c.location,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,patients,doctorId,aidSteps:aid.steps,aidDressings:uses,careDressings:kits-c.operativeState[doctorId].medkits,events});
 return c;
}
