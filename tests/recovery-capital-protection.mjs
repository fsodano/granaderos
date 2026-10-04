import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {outfitSlot} from '../game/outfits.js';

export function equipRecoveryCapitalProtection(start,field,{report=()=>{}}={}){
 let c=start;
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 for(const operativeId of field)for(const slot of ['headwear','outfit','legwear']){
  const sector=c.operativeState[operativeId].location;assert.equal(c.sectors[sector]?.owner,'patriot','protection is recovered only at the actual friendly location');
  if(c.operativeState[operativeId][slot]?.condition>0)continue;
  let model=sectorInventoryModel(c,sector,rosterFor(c),operativeId);
  const usable=row=>row.inventoryKey&&row.equip?.some(e=>e.slot===slot&&e.valid);
  let carried=model.carried.find(usable);
  if(!carried){
   const row=model.entries.filter(row=>{const record=JSON.parse(row.expected);return row.reachable&&record.kind==='outfit'&&outfitSlot(record)===slot&&record.condition>0;}).sort((a,b)=>b.condition-a.condition||a.key.localeCompare(b.key))[0];
   if(!row)continue;
   const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
   order({type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   model=sectorInventoryModel(c,sector,rosterFor(c),operativeId);carried=model.carried.find(usable);assert.ok(carried);
   const {item,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(carried.expected),record);assert.equal(model.entries.find(item=>item.key===row.key)?.count??0,row.count-1);
   assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before);
   report({event:'recoveryCapitalProtectionRecovered',operativeId,sector,slot,sourceKey:row.key,sourceCount:row.count,remaining:row.count-1,record,...before});
  }
  const record=JSON.parse(carried.expected);order({type:'sectorInventory',sector,operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});assert.deepEqual(c.operativeState[operativeId][slot],record);
 }
 return c;
}
