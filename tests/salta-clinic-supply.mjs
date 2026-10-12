import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {operativeInTransit,operativeLocation} from '../game/squads.js';
import {collectRouteItems} from './finite-route-equipment.mjs';

// Allocate actual local dressings before assigning the selected doctors.
// A selected physician's remaining kit is reserved for that same care tick.
export function supplySaltaClinicDoctors(start,doctors){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const protectedDoctors=new Set(doctors),sector='tucuman',actions=[],receipts=[];
 assert.equal(protectedDoctors.size,doctors.length);
 const local=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector;});
 assert.ok(doctors.every(id=>local.includes(id)),'Every selected doctor must actually serve at the local clinic.');
 const inventory=id=>sectorInventoryModel(campaign,sector,rosterFor(campaign),id);
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);};
 let gatheredDressings=0,donatedDressings=0;
 for(const id of doctors){
  if(campaign.operativeState[id].medkits)continue;
  let source=inventory(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!source){
   const donor=local.find(other=>!protectedDoctors.has(other)&&campaign.operativeState[other].medkits>0&&!inventory(other).reason);
   if(donor===undefined){const found=collectRouteItems(campaign,id,{item:'medkits'},1);campaign=found.campaign;gatheredDressings+=found.collected;receipts.push({doctor:id,kind:'local-recovery',count:found.collected});continue;}
   const carried=campaign.operativeState[donor].medkits;
   order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});
   assert.equal(campaign.operativeState[donor].medkits,carried-1);donatedDressings++;
   source=inventory(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   receipts.push({doctor:id,kind:'donation',donor,count:1});
  }
  assert.ok(source,'The doctor must reach the actual dressing.');
  const carried=campaign.operativeState[id].medkits;
  order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
  assert.equal(campaign.operativeState[id].medkits,carried+1);assert.equal(inventory(id).entries.find(row=>row.key===source.key)?.count??0,source.count-1);gatheredDressings++;
 }
 assert.ok(doctors.every(id=>campaign.operativeState[id].medkits>0),'All selected doctors must retain a finite dressing before assignment.');
 return {campaign,gatheredDressings,donatedDressings,actions,receipts};
}
