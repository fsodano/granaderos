import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';

// Discover/open the actual chest, then move only reachable known quantities.
// A depleted local cache cannot be restocked by this helper.
export function collectPhysicalCacheItems(state,operativeId,selector,requested){
 assert.ok(Number.isSafeInteger(requested)&&requested>0);
 let s=state;const cacheId=FINITE_SECTOR_CACHES[s.location]?.chest;
 assert.ok(cacheId,'this location has an actual finite authored cache');
 const chest=s.sectorStates[s.location]?.props?.find(prop=>prop.id===cacheId);
 if(!chest?.open||!chest.knownToPlayer){
  const field=visit(s),carrier=field.battle.units.filter(unit=>unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.asleep&&(unit.energy??100)>10).sort((a,b)=>(b.energy??100)-(a.energy??100))[0];assert.ok(carrier,'a real awake carrier is required to discover the finite cache');
  const pair=takeFiniteCache(field,carrier.id,[],{cacheId});s=leaveFiniteCache(pair);
 }
 let collected=0;
 while(collected<requested){
  const model=sectorInventoryModel(s,s.location,rosterFor(s),operativeId);
  const row=model.entries.find(row=>row.reachable&&row.count>0&&Object.entries(selector).every(([key,value])=>JSON.parse(row.expected)[key]===value));
  if(!row)break;
  const stack=JSON.parse(row.expected);let count=Math.min(row.count,requested-collected);
  while(count>0){try{applyItemQuantity(model.personal,{...stack,count});break;}catch{count--;}}
  if(!count)break;
  s=order(s,{type:'sectorInventory',sector:s.location,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});collected+=count;
 }
 assert.ok(collected>0,`the reachable finite cache has no carried capacity or remaining ${JSON.stringify(selector)}`);
 return {campaign:saved({campaign:s}).campaign,collected};
}
