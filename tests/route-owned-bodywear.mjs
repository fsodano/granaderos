import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

// Complete missing worn protection from the person's real pockets or known
// local loot. Each ordinary pickup/equip keeps the complete physical record.
export function recoverRouteBodywear(start,ids,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start);
 for(const id of ids)for(const slot of ['headwear','outfit','legwear']){
  if(c.operativeState[id][slot]?.condition>0)continue;
  const sector=operativeLocation(c,id),model=()=>sectorInventoryModel(c,sector,rosterFor(c),id),kind={headwear:'hat',outfit:'poncho',legwear:'trousers'}[slot];
  assert.equal(model().reason,null);assert.equal(Number(model().personal.id),id);
  const matches=record=>record.kind==='outfit'&&record.outfit===kind&&record.condition>0;
  const usable=row=>row.inventoryKey&&row.expected&&matches(JSON.parse(row.expected))&&row.equip.some(choice=>choice.slot===slot&&choice.valid);
  let carried=model().carried.find(usable),source=null;
  const cash=c.resources.treasury,clock=[c.hour,c.secondOfHour];
  if(!carried){
   source=model().entries.filter(row=>row.reachable&&matches(JSON.parse(row.expected))).sort((a,b)=>JSON.parse(b.expected).condition-JSON.parse(a.expected).condition)[0];
   assert.ok(source,`The actual river soldier ${id} needs finite local ${slot}.`);
   c=dispatchCampaign(c,{type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});assert.equal(c.lastError,null);
   carried=model().carried.find(usable);assert.ok(carried);
   const {item,...record}=JSON.parse(source.expected);assert.deepEqual(JSON.parse(carried.expected),record);assert.equal(model().entries.find(row=>row.key===source.key)?.count??0,source.count-1);
  }
  const record=JSON.parse(carried.expected);
  c=dispatchCampaign(c,{type:'sectorInventory',sector,operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});assert.equal(c.lastError,null);assert.deepEqual(c.operativeState[id][slot],record);
  assert.equal(c.resources.treasury,cash);assert.deepEqual([c.hour,c.secondOfHour],clock);
  report({event:'routeFiniteBodywearRecovered',id,sector,slot,sourceKey:source?.key??null,record});
 }
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(start,before);return decodeSave(encodeSave(c)).campaign;
}
