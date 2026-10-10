import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote,contractRenewalQuote} from '../game/contracts.js';
import {lowMoraleRenewalStatus} from '../game/morale-renewal.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity,handRecord} from '../game/tactical-inventory.js';
import {availableAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {WEAPONS} from '../game/data.js';
import {decodeSave,encodeSave} from '../game/save.js';

const conditionKeys=['hp','maxHp','alive','bleeding','bandaged','energy','fatigue','morale','location','residentPosition','residentSector','residentScene','asleep'];
const condition=r=>Object.fromEntries(conditionKeys.filter(key=>Object.hasOwn(r,key)).map(key=>[key,structuredClone(r[key])]));
const stackKey=stack=>`${stack.item}:${stack.weapon??stack.outfit??stack.ammoType??''}:${stack.instanceId??''}`;
const sorted=stacks=>[...stacks].sort((a,b)=>stackKey(a).localeCompare(stackKey(b)));

// Replace a real renewal refusal before the next paid march. The former
// soldier leaves normally, with every exact item retained in Córdoba.
export function relieveStockCuyoService(start,fieldIds,{horizonHours=96,report=()=>{}}={}){
 const before=structuredClone(start);let c=decodeSave(encodeSave(start)).campaign;const field=[...fieldIds],receipts=[],orders=[];
 const clock=()=>c.hour*3600+(c.secondOfHour??0),live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.ok(Number.isSafeInteger(horizonHours)&&horizonHours>0&&horizonHours<=168);assert.equal(c.location,'cordoba');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.ok(field.length>0&&new Set(field).size===field.length&&field.every(id=>live().includes(id)&&operativeLocation(c,id)==='cordoba'&&!operativeInTransit(c,id)));
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);orders.push(structuredClone(action));};
 const retain=()=>{
  for(const id of live()){
   let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock()));
   while(expiry!==null&&expiry<=clock()+2*3600){
    const q=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],money=c.resources.treasury;assert.equal(q.available,true,q.reason);assert.ok(money>=q.price);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,money-q.price);assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);expiry=contractExpiresSeconds(c.contracts[id]);report({event:'stockCuyoServiceRenewal',id,price:q.price,hour:c.hour,second:c.secondOfHour??0});
   }
  }
 };
 const refusals=field.filter(id=>{const op=rosterFor(c).find(op=>op.id===id),expiry=contractExpiresSeconds(c.contracts[id]);return expiry!==null&&expiry<=clock()+horizonHours*3600&&lowMoraleRenewalStatus(c,op).blocked;});
 for(const id of refusals){
  const old=rosterFor(c).find(op=>op.id===id),state=c.operativeState[id],reason=contractRenewalQuote(c,old,'day').reason;
  assert.ok(reason&&lowMoraleRenewalStatus(c,old).blocked);assert.equal(operativeLocation(c,id),'cordoba');assert.equal(operativeInTransit(c,id),false);
  const model=sectorInventoryModel(c,'cordoba',rosterFor(c),id);assert.equal(model.carriedReason,null);const kit=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count).stack),collector=field.find(candidate=>candidate!==id&&c.operativeState[candidate].hp>=15&&!c.operativeState[candidate].asleep);assert.notEqual(collector,undefined);
  const oldKeys=new Set(sectorInventoryModel(c,'cordoba',rosterFor(c),collector).entries.map(row=>row.key)),priorCondition=condition(state),cash=c.resources.treasury,at=clock();
  order({type:'dismiss',id});assert.ok(!c.recruited.includes(id));assert.equal(c.contracts[id],undefined);assert.deepEqual(condition(c.operativeState[id]),priorCondition);assert.equal(c.resources.treasury,cash);assert.equal(clock(),at);
  const returned=sectorInventoryModel(c,'cordoba',rosterFor(c),collector).entries.filter(row=>!oldKeys.has(row.key));assert.deepEqual(sorted(returned.map(row=>JSON.parse(row.expected))),sorted(kit),'Ordinary dismissal returns every exact stack once.');
  const replacement=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],q=contractQuote(c,op,'week');return op.id>=100&&op.id<1000&&op.id!==id&&!c.recruited.includes(op.id)&&!c.hiringArrivals.some(arrival=>arrival.operativeId===op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&!q.permanent&&q.available&&q.total<=c.resources.treasury-2000;})
   .sort((a,b)=>contractQuote(c,a,'week').total-contractQuote(c,b,'week').total||b.marksmanship-a.marksmanship||a.id-b.id)[0];assert.ok(replacement,'The actual treasury and current availability must fund a paid relief.');
  const quote=contractQuote(c,replacement,'week'),booked=clock(),arrivalHours=hiringTravelHours(c,replacement.id),paid=c.resources.treasury;
  order({type:'recruitCivic',id:replacement.id,term:'week',destination:'cordoba'});assert.equal(c.resources.treasury,paid-quote.total);
  for(let h=0;!c.recruited.includes(replacement.id)&&h<=arrivalHours;h++){retain();order({type:'wait',hours:1});assert.equal(c.pendingEncounter,null);}
  assert.ok(c.recruited.includes(replacement.id));assert.equal(operativeLocation(c,replacement.id),'cordoba');assert.equal(clock()-booked,arrivalHours*3600);assert.equal(c.contracts[replacement.id].started*3600+(c.contracts[replacement.id].startedSecond??0),clock());
  const inventory=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),replacement.id),returnedKeys=new Set(returned.map(row=>row.key));
  const gun=inventory().entries.find(row=>returnedKeys.has(row.key)&&row.reachable&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0);assert.ok(gun,'An actual reachable returned firearm must equip the relief.');
  const gunRecord=JSON.parse(gun.expected),ownedBefore=new Set(inventory().carried.map(row=>row.inventoryKey));
  order({type:'sectorInventory',sector:'cordoba',operativeId:replacement.id,direction:'take',sourceKey:gun.key,expected:gun.expected,count:1});const carried=inventory().carried.find(row=>row.inventoryKey&&!ownedBefore.has(row.inventoryKey)&&JSON.parse(row.expected).weapon===gunRecord.weapon);assert.ok(carried);
  order({type:'sectorInventory',sector:'cordoba',operativeId:replacement.id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'primary'});
  const equipped=handRecord(inventory().personal,'primary');for(const [key,value]of Object.entries(gunRecord))if(!['item','count'].includes(key))assert.deepEqual(equipped[key],value);
  const family=weaponAmmoType(gunRecord.weapon),ammo=inventory().entries.find(row=>returnedKeys.has(row.key)&&row.reachable&&JSON.parse(row.expected).ammoType===family);assert.ok(ammo,'The returned firearm needs its actual compatible reserve.');const ammoBefore=availableAmmunition(c.operativeState[replacement.id],family);
  order({type:'sectorInventory',sector:'cordoba',operativeId:replacement.id,direction:'take',sourceKey:ammo.key,expected:ammo.expected,count:ammo.count});assert.equal(availableAmmunition(c.operativeState[replacement.id],family),ammoBefore+ammo.count);
  field[field.indexOf(id)]=replacement.id;const receipt={dismissed:id,replacement:replacement.id,reason,returned:returned.map(row=>({key:row.key,stack:JSON.parse(row.expected)})),condition:priorCondition,price:quote.price,guarantee:quote.guarantee,total:quote.total,booked,arrival:clock(),arrivalHours,gunSource:gun.key,gun:gunRecord,ammoSource:ammo.key,family,ammoCount:ammo.count};receipts.push(receipt);report({event:'stockCuyoServiceRelief',...receipt,hour:c.hour,second:c.secondOfHour??0,campaign:structuredClone(c)});
 }
 assert.equal(field.length,fieldIds.length);for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(start,before);c=decodeSave(encodeSave(c)).campaign;assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return {campaign:c,field,receipts,orders};
}
