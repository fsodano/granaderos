import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

// Empty an actual local former-carrier return before rehiring. Public
// collection and drop retain every stack; no item is issued a second time.
export function collectReturnedServiceKit(start,sector,carrierIds,{report=()=>{}}={}){
 let c=start;
 const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;};
 const owners=()=>Object.entries(c.operativeState).filter(([,unit])=>unit.alive&&unit.serviceEquipmentReturn?.sectorId===sector).map(([id])=>Number(id));
 for(const id of owners())for(let step=0;step<128&&c.operativeState[id].serviceEquipmentReturn;step++){
  const marker=c.operativeState[id].serviceEquipmentReturn;let transferred=false;
  for(const operativeId of carrierIds){
   const model=sectorInventoryModel(c,marker.siteId,rosterFor(c),operativeId);
   const row=model.entries.find(row=>row.kind==='serviceReturn'&&row.reachable&&JSON.parse(row.key)[1]===marker.id);
   if(row){
    const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},counts=new Map(model.carried.map(row=>[row.item,row.count]));
    for(const count of [...new Set([row.count,1])]){
     const next=dispatchCampaign(c,{type:'sectorInventory',sector:marker.siteId,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});if(next.lastError)continue;c=next;
     const received=sectorInventoryModel(c,marker.siteId,rosterFor(c),operativeId).carried.find(row=>row.count>(counts.get(row.item)??0));assert.ok(received);
     order({type:'sectorInventory',sector:marker.siteId,operativeId,direction:'drop',item:received.item,count});
     const {id:itemId,type,x,y,tacticalLevel,knownToPlayer,heldBy,...stored}=c.sectorStates[marker.siteId].groundItems.at(-1);const {item:sourceKind,...sourceRecord}=JSON.parse(row.expected),{item:storedKind,...storedRecord}=stored;assert.deepEqual(storedRecord,{...sourceRecord,count},'collection and placement retain the complete physical item record');
     assert.equal(sectorInventoryModel(c,marker.siteId,rosterFor(c),operativeId).entries.find(item=>item.key===row.key)?.count??0,row.count-count);
     assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before);
     report({event:'returnedServiceKitCollected',id,operativeId,sourceKey:row.key,itemId,count,sourceCount:row.count,remaining:row.count-count,record:stored,...before});transferred=true;break;
    }
   }else{
    const repair=model.repairReserves.find(row=>row.reachable&&JSON.parse(row.key)[1]===marker.id);if(!repair)continue;
    const before=c.operativeState[operativeId].toolkitPoints??0;
    order({type:'sectorInventory',sector:marker.siteId,operativeId,direction:'takeRepairPoints',sourceKey:repair.key,expected:repair.expected,count:repair.repairPoints});
    assert.equal(c.operativeState[operativeId].toolkitPoints,before+repair.repairPoints);report({event:'returnedServiceRepairCollected',id,operativeId,sourceKey:repair.key,count:repair.repairPoints});transferred=true;
   }
   if(transferred)break;
  }
  assert.ok(transferred,`actual local recipients must collect ${id}'s returned equipment`);
 }
 for(const id of owners())assert.equal(c.operativeState[id].serviceEquipmentReturn,undefined);
 return c;
}
