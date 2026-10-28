import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus,contractQuote} from '../packages/game/campaign.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {operativeLocation} from '../packages/game/squads.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {extractItemQuantity} from '../packages/game/tactical-inventory.js';

// A former serving veteran may be hired again only after a real local actor
// collects all the equipment that veteran left behind. Never clear the marker.
export function prepareCoastalReinforcements(start,{excluded=[],count=1,stageReturnedItems=false,report=()=>{}}={}){
 assert.ok(Number.isInteger(count)&&count>=0&&count<=12);
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),reinforcements=[],receipts=[];
 const healthy=op=>{const r=c.operativeState[op.id];return op.id>=100&&op.id<1000&&!excluded.includes(op.id)&&!reinforcements.includes(op.id)&&!c.recruited.includes(op.id)&&r.alive&&!r.captured&&!r.bleeding&&r.hp===r.maxHp&&r.morale>=50;};
 const sorted=rows=>rows.sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||a.id-b.id);
 for(let n=0;n<count;n++){
  let candidate=sorted(rosterFor(c).filter(op=>healthy(op)&&civicStatus(c,op.id).available&&contractQuote(c,op,'day').available&&!contractQuote(c,op,'day').permanent))[0];
  if(!candidate){
   candidate=sorted(rosterFor(c).filter(op=>healthy(op)&&c.operativeState[op.id].serviceEquipmentReturn))[0];
   assert.ok(candidate,'A requested coastal reinforcement needs an actual healthy available veteran or reachable returned equipment.');
   const marker=structuredClone(c.operativeState[candidate.id].serviceEquipmentReturn),owner=structuredClone(c.operativeState[candidate.id]),clock=[c.hour,c.secondOfHour,c.resources.treasury],contracts=structuredClone(c.contracts),orders=[];
   const owns=row=>row.key.startsWith(JSON.stringify(['serviceReturn',marker.id]).slice(0,-1)+',');
   const collectors=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===marker.sectorId).sort((a,b)=>a.id-b.id);
   const collector=collectors.find(op=>{const m=sectorInventoryModel(c,marker.siteId,rosterFor(c),op.id);return !m.reason&&Number(m.personal?.id)===op.id&&[...m.entries.filter(owns),...m.repairReserves.filter(owns)].length>0&&[...m.entries.filter(owns),...m.repairReserves.filter(owns)].every(row=>row.reachable);});
   assert.ok(collector,'A living serving actor must physically reach the exact former-carrier equipment.');
   const model=()=>sectorInventoryModel(c,marker.siteId,rosterFor(c),collector.id),items=model().entries.filter(owns).map(row=>({...row})),repair=model().repairReserves.filter(owns).map(row=>({...row}));
   for(const original of [...items,...repair]){
    const isRepair=original.repairPoints!==undefined,row=(isRepair?model().repairReserves:model().entries).find(row=>row.key===original.key);assert.ok(row?.reachable,row?.reason);
    const carriedBefore=new Set(model().carried.filter(row=>row.inventoryKey).map(row=>row.inventoryKey));
    const action={type:'sectorInventory',sector:marker.siteId,operativeId:collector.id,direction:isRepair?'takeRepairPoints':'take',sourceKey:row.key,expected:row.expected,count:isRepair?row.repairPoints:row.count};
    const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;orders.push(action);
    assert.equal((isRepair?model().repairReserves:model().entries).find(row=>row.key===original.key)?.[isRepair?'repairPoints':'count']??0,0,'The exact returned source must be fully collected once.');
    if(stageReturnedItems&&!isRepair){
     const source=JSON.parse(row.expected),carried=model().carried.find(item=>item.inventoryKey&&!carriedBefore.has(item.inventoryKey))??model().carried.find(item=>item.item===source.item);
     assert.ok(carried,'The collector must hold the exact returned item before putting it down.');
     const payload=extractItemQuantity(model().personal,carried.item,row.count).stack;
     // Pickup names the carried inventory slot. All physical fields remain
     // equal to the returned source before the public drop order.
     for(const[key,value]of Object.entries(source))if(key!=='item')assert.deepEqual(payload[key],value,`The collected return retains ${key}.`);
     const groundBefore=new Set((c.sectorStates[marker.siteId]?.groundItems??[]).map(item=>item.id));
     const drop={type:'sectorInventory',sector:marker.siteId,operativeId:collector.id,direction:'drop',item:carried.item,count:row.count};
     const dropped=dispatchCampaign(c,drop);assert.equal(dropped.lastError,null,JSON.stringify(drop)+': '+dropped.lastError);c=dropped;orders.push(drop);
     const parcel=c.sectorStates[marker.siteId].groundItems.find(item=>!groundBefore.has(item.id));assert.ok(parcel);
     for(const[key,value]of Object.entries(payload))assert.deepEqual(parcel[key],value,`The local returned parcel retains ${key}.`);
    }
   }
   assert.equal(c.operativeState[candidate.id].serviceEquipmentReturn,undefined,'Only actual full collection may release this veteran for rehire.');
   for(const field of ['alive','hp','maxHp','bleeding','morale','energy','fatigue','location'])assert.deepEqual(c.operativeState[candidate.id][field],owner[field]);
   assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],clock);assert.deepEqual(c.contracts,contracts);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);
   const receipt={event:'coastalReturnedHireEquipment',operativeId:candidate.id,collectorId:collector.id,site:marker.siteId,marker,items:items.map(row=>({key:row.key,count:row.count,record:JSON.parse(row.expected)})),repair:repair.map(row=>({key:row.key,points:row.repairPoints})),orders,hour:c.hour,secondOfHour:c.secondOfHour??0};receipts.push(receipt);report(receipt);
  }
  assert.equal(civicStatus(c,candidate.id).available,true,civicStatus(c,candidate.id).reason);assert.equal(contractQuote(c,candidate,'day').available,true,contractQuote(c,candidate,'day').reason);assert.equal(contractQuote(c,candidate,'day').permanent,false);
  reinforcements.push(candidate.id);
 }
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(start,before);return {campaign:decodeSave(encodeSave(c)).campaign,reinforcements,receipts};
}
