import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {WEAPONS} from '../game/data.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {transportPath} from '../game/logistics.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {workAssignmentReason} from '../game/assignments.js';
import {cellTravelPlan} from '../game/world-cells.js';

// Public collection at the actual person's location. Temporarily return a
// local squad to service only when it must physically discover its cache.
export function discoverRouteCache(state,operativeId){
 let s=state;const sector=operativeLocation(s,operativeId),cacheId=FINITE_SECTOR_CACHES[sector]?.chest;
 if(!cacheId)return s;
 const chest=s.sectorStates[sector]?.props?.find(prop=>prop.id===cacheId);
 if(chest?.open&&chest.knownToPlayer)return s;
 const previous=s.activeSquadId;
 if(s.location!==sector){const local=s.squads.find(q=>q.location===sector&&q.members.length&&!q.journey);assert.ok(local,'an actual local squad must discover the cache');s=order(s,{type:'selectSquad',id:local.id});}
 const assignments=s.squad.map(id=>({id,assignment:s.operativeState[id].assignment??'active'}));
 assert.ok(assignments.every(row=>['active','doctor','militia_doctor','patient','rest'].includes(row.assignment)),'finish actual training or repair work before visiting the cache');
 for(const {id}of assignments)s=order(s,{type:'assignCare',id,assignment:'active'});
 const pair=visit(s),carrier=pair.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.asleep&&(u.energy??100)>10).sort((a,b)=>b.energy-a.energy)[0];assert.ok(carrier,'a real awake carrier must reach the cache');
 s=leaveFiniteCache(takeFiniteCache(pair,carrier.id,[],{cacheId}));
 for(const {id,assignment}of assignments)if(assignment!=='active'&&(!['doctor','militia_doctor'].includes(assignment)||s.operativeState[id].medkits>0))s=order(s,{type:'assignCare',id,assignment});
 if(previous!==s.activeSquadId)s=order(s,{type:'selectSquad',id:previous});
 return s;
}

export function collectRouteItems(state,operativeId,selector,requested){
 assert.ok(Number.isSafeInteger(requested)&&requested>0);
 let s=state,collected=0;const sector=operativeLocation(s,operativeId);
 const take=()=>{
  while(collected<requested){
   // A completed mission keeps its own physical loot under the same locality.
   // Use only admitted sites and each scene's normal access checks.
   const source=sectorInventorySites(s,sector).map(site=>{
    const model=sectorInventoryModel(s,site.id,rosterFor(s),operativeId),row=model.entries.find(row=>row.reachable&&row.count>0&&Object.entries(selector).every(([key,value])=>JSON.parse(row.expected)[key]===value));
    return row?{siteId:site.id,model,row}:null;
   }).find(Boolean);
   if(!source)break;const {siteId,model,row}=source,stack=JSON.parse(row.expected);let count=Math.min(row.count,requested-collected);
   while(count>0){try{applyItemQuantity(model.personal,{...stack,count});break;}catch{count--;}}
   if(!count)break;
   s=order(s,{type:'sectorInventory',sector:siteId,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});collected+=count;
  }
 };
 take();if(collected<requested){s=discoverRouteCache(s,operativeId);take();}
 assert.ok(collected>0,`finite local equipment or carrying room is exhausted: ${sector} ${JSON.stringify(selector)}`);
 return {campaign:saved({campaign:s}).campaign,collected};
}

export function recoverRouteFirearm(state,operativeId){
 let s=state;
 if(!s.operativeState[operativeId].weaponDropped)return s;
 s=discoverRouteCache(s,operativeId);const sector=operativeLocation(s,operativeId),model=()=>sectorInventoryModel(s,sector,rosterFor(s),operativeId);
 let gun=model().carried.find(row=>row.expected&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0&&row.equip?.some(option=>option.slot==='primary'&&option.valid));
 if(!gun){const row=model().entries.find(row=>row.reachable&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0);assert.ok(row,'a lost gun must be replaced by actual reachable finite equipment');
  const stack=JSON.parse(row.expected);s=order(s,{type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});gun=model().carried.find(row=>row.expected&&JSON.parse(row.expected).weapon===stack.weapon&&JSON.parse(row.expected).instanceId===stack.instanceId);
 }
 assert.ok(gun);return order(s,{type:'sectorInventory',sector,operativeId,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
}

export function repairRouteFirearms(state,ids,{maxHours=48}={}){
 // Primary mechanical work restores wear. Ignition failures remain for the
 // ordinary paid reprime in finishReloadsBeforeMarch.
 let s=state;const targets=()=>ids.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].weaponDropped&&s.operativeState[id].condition<100);
 for(let hour=0;targets().length&&hour<maxHours;hour++){
  let target=targets()[0];const site=operativeLocation(s,target);
  let roster=rosterFor(s),mechanic=roster.filter(op=>s.recruited.includes(op.id)&&s.operativeState[op.id].alive&&!s.operativeState[op.id].captured&&operativeLocation(s,op.id)===site&&op.mechanical>=20&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&s.operativeState[op.id].energy>10).sort((a,b)=>Number(repairMaterialPoints(s.operativeState[b.id])>0)-Number(repairMaterialPoints(s.operativeState[a.id])>0)||b.mechanical-a.mechanical)[0];assert.ok(mechanic,'actual repair needs a qualified available local mechanic');
  if(!repairMaterialPoints(s.operativeState[mechanic.id]))s=collectRouteItems(s,mechanic.id,{kind:'repair-kit'},1).campaign;
  // Cache discovery spends real time. Other work may finish the target,
  // and the selected carrier may no longer be awake or able to work.
  target=targets()[0];if(target===undefined)continue;
  const assignedToTarget=op=>{const r=s.operativeState[op.id];return r.assignment==='repair'&&r.repairTargetId===target&&r.repairScope!=='equipment';};
  roster=rosterFor(s);mechanic=roster.filter(op=>op.mechanical>=20&&!workAssignmentReason(s,op,'repair',{targetId:target,repairScope:'primary'},roster)).sort((a,b)=>Number(assignedToTarget(b))-Number(assignedToTarget(a))||b.mechanical-a.mechanical)[0];
  assert.ok(mechanic,'actual repair needs a current target and an awake local mechanic with finite materials');
  s=order(s,{type:'assignWork',operativeId:mechanic.id,assignment:'repair',targetId:target,repairScope:'primary'});const before=repairMaterialPoints(s.operativeState[mechanic.id]);s=advanceCampaignHours(s,1);assert.ok(repairMaterialPoints(s.operativeState[mechanic.id])<before,'real repair must consume carried material');s=order(s,{type:'assignCare',id:mechanic.id,assignment:'active'});
 }
 assert.deepEqual(targets(),[],'the actual finite repair plan must finish before departure');return s;
}


// When a clinic has exhausted its actual local stock, a paid doctor can carry
// dressings from another controlled cache. Patients stay in their real clinic;
// the journey, rest, contract extensions and source debit are ordinary orders.
export function collectRouteMedicalSupplies(start,operativeId,requested,{report=()=>{},resolveEncounter}={}){
 try{return collectRouteItems(start,operativeId,{item:'medkits'},requested);}
 catch(error){if(!error.message.startsWith('finite local equipment or carrying room is exhausted:'))throw error;}
 let s=start;const clinic=operativeLocation(s,operativeId),previous=s.activeSquadId,home=s.squads.find(q=>q.members.includes(operativeId)&&!q.journey),assignment=s.operativeState[operativeId].assignment;
 assert.ok(s.recruited.includes(operativeId)&&s.operativeState[operativeId].alive,'the actual courier must be serving');
 assert.ok(s.recruited.filter(id=>operativeLocation(s,id)===clinic&&s.operativeState[id].alive).every(id=>!s.operativeState[id].bleeding),'stabilize local bleeding patients before their doctor leaves for dressings');
 const sources=Object.entries(FINITE_SECTOR_CACHES).filter(([at])=>at!==clinic&&s.sectors[at]?.owner==='patriot'&&transportPath(s,clinic,at)).map(([at,cache])=>{
  const local=s.recruited.find(id=>s.operativeState[id].alive&&operativeLocation(s,id)===at),known=local===undefined?[]:sectorInventoryModel(s,at,rosterFor(s),local).entries.filter(row=>JSON.parse(row.expected).item==='medkits'),chest=s.sectorStates[at]?.props.find(prop=>prop.id===cache.chest);
  const available=known.filter(row=>row.kind!=='container').reduce((sum,row)=>sum+row.count,0)+(chest?chest.contents.filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0):cache.medical);
  return {at,available,path:transportPath(s,clinic,at)};
 }).filter(source=>source.available>0).sort((a,b)=>b.available-a.available||a.path.length-b.path.length);
 const source=sources[0];assert.ok(source,'no controlled finite medical source remains for an actual courier');
 const outward=cellTravelPlan({...s,location:clinic},source.at),returning=cellTravelPlan({...s,location:source.at},clinic);
 assert.equal(outward.reason,null);assert.equal(returning.reason,null);
 const horizon=(outward.hours+returning.hours+24)*3600,now=s.hour*3600+(s.secondOfHour??0);
 for(const id of s.recruited.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured)){
  let contract=s.contracts[id];while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=now+horizon){
   const cash=s.resources.treasury;s=order(s,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});report({event:'medicalCourierRenewal',id,cost:cash-s.resources.treasury,hour:s.hour});contract=s.contracts[id];
  }
 }
 if(home)s=order(s,{type:'selectSquad',id:home.id});s=order(s,{type:'assignCare',id:operativeId,assignment:'active'});
 if(!home||home.members.length>1)s=order(s,{type:'createSquad',ids:[operativeId],name:'Vendas recuperadas',sector:clinic});
 const travel=at=>{
  for(let leg=0;leg<32;leg++){
   s=completeTestTravel(s,{sector:at});
   if(s.pendingEncounter){
    assert.ok(typeof resolveEncounter==='function','resolve the actual medical courier encounter before continuing care');
    report({event:'medicalCourierEncounter',operativeId,clinic,destination:at,encounter:structuredClone(s.pendingEncounter),hour:s.hour,secondOfHour:s.secondOfHour??0});
    s=resolveEncounter(s);
    assert.equal(s.pendingEncounter,null,'the actual medical courier encounter must finish before travel resumes');
    assert.equal(s.pendingBattle,null);assert.ok(s.operativeState[operativeId].alive&&!s.operativeState[operativeId].captured,'the actual courier must survive and remain free');
    continue;
   }
   assert.equal(s.pendingBattle,null);assert.equal(s.location,at);assert.ok(s.recruited.includes(operativeId),'the real courier must remain under paid service');return;
  }
  assert.fail('the actual medical courier journey must finish within the bounded encounter plan');
 };
 const departure=s.hour*3600+(s.secondOfHour??0);travel(source.at);
 const found=collectRouteItems(s,operativeId,{item:'medkits'},requested);s=found.campaign;travel(clinic);
 if(home&&!s.squads.find(q=>q.id===home.id).members.includes(operativeId))s=order(s,{type:'assignToSquad',operativeId,squadId:home.id});
 if(assignment!=='active')s=order(s,{type:'assignCare',id:operativeId,assignment});
 if(s.activeSquadId!==previous)s=order(s,{type:'selectSquad',id:previous});
 report({event:'finiteMedicalCourier',operativeId,clinic,source:source.at,quantity:found.collected,elapsedSeconds:s.hour*3600+(s.secondOfHour??0)-departure});
 return {campaign:saved({campaign:s}).campaign,collected:found.collected};
}
