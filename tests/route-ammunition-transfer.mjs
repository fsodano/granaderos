import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {order} from './local-contract-fixture.mjs';

// Share existing carried reserve through visible drop and pickup controls.
// Chamber contents stay with each weapon; no ammunition is issued here.
export function transferRouteAmmunition(start,{sector=start.location,recipientId,donorIds,family,count,execute=order,report=()=>{}}){
 assert.ok(AMMUNITION_FAMILIES[family]&&Number.isSafeInteger(count)&&count>0);
 const before=structuredClone(start),transactions=[];let s=start,remaining=count;
 const model=id=>sectorInventoryModel(s,sector,rosterFor(s),id);
 for(const donorId of donorIds){
  if(!remaining)break;if(donorId===recipientId)continue;
  const donor=model(donorId),recipient=model(recipientId);
  const carried=donor.carried.find(row=>row.count>0&&row.item===`inventory:ammo:${AMMUNITION_FAMILIES[family].type}`);
  if(!carried)continue;
  const amount=Math.min(remaining,carried.count),donorReserve=ammoCount(donor.personal,family),recipientReserve=ammoCount(recipient.personal,family),known=new Set(recipient.entries.map(row=>row.key)),cash=s.resources.treasury,hour=s.hour,second=s.secondOfHour;
  const drop={type:'sectorInventory',sector,operativeId:donorId,direction:'drop',item:carried.item,count:amount};s=execute(s,drop);
  const row=model(recipientId).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).ammoType===AMMUNITION_FAMILIES[family].type);
  assert.ok(row,'The actual shared reserve must remain a reachable finite ground stack.');assert.equal(row.count,amount);
  const take={type:'sectorInventory',sector,operativeId:recipientId,direction:'take',sourceKey:row.key,expected:row.expected,count:amount};s=execute(s,take);
  assert.equal(ammoCount(model(donorId).personal,family),donorReserve-amount);assert.equal(ammoCount(model(recipientId).personal,family),recipientReserve+amount);
  assert.equal(model(donorId).personal.loaded,donor.personal.loaded);assert.equal(model(recipientId).personal.loaded,recipient.personal.loaded);
  assert.equal(s.resources.treasury,cash);assert.equal(s.hour,hour);assert.equal(s.secondOfHour,second);
  const transaction={donorId,recipientId,family,count:amount,sourceKey:row.key,source:JSON.parse(row.expected),actions:[drop,take]};transactions.push(transaction);report({event:'routeFiniteAmmoShared',...transaction});remaining-=amount;
 }
 assert.equal(remaining,0,'Actual donor reserve must cover the requested finite transfer.');assert.deepEqual(start,before);
 return {campaign:s,transactions,transferred:count};
}
