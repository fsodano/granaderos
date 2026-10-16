import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {careRules} from '../game/campaign-care-rules.js';
import {doctorRate} from '../game/medical-care.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const stable=r=>r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed&&!r.surrendered&&!r.asleep&&r.energy>10;

// A current clinic plan can share its own finite linen without searching or
// borrowing another duty. Each donating patient keeps enough for their own
// remaining care at the slowest eligible physician's current rate.
export function shareNorthernClinicDressing(start,operativeId,{sector,planIds,patients,doctors,deadlineSeconds,report=()=>{}}){
 const before=structuredClone(start),orders=[],takes=[],donations=[],startSeconds=clock(start);
 let campaign=start;
 const receipt=reason=>({operativeId,sector,planIds,patients,doctors,deadlineSeconds,startSeconds,endSeconds:clock(campaign),orders,takes,donations,reason,supplied:reason==='clinic-pool'||reason==='already-supplied',deferred:reason==='other-supplied-doctor',internal:true});
 const finish=reason=>{assert.deepEqual(start,before);const result=receipt(reason);return {campaign,supplied:result.supplied,deferred:result.deferred,receipt:result};};
 const check=()=>{
  assert.equal(campaign.defeated,false);assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
  assert.ok(Number.isSafeInteger(deadlineSeconds)&&clock(campaign)<=deadlineSeconds,'The clinic pool uses the existing care deadline.');
  assert.equal(clock(campaign),startSeconds,'Inventory handover cannot add or reset care time.');
  for(const id of planIds){const r=campaign.operativeState[id],expiry=contractExpiresSeconds(campaign.contracts[id]);assert.ok(campaign.recruited.includes(id)&&r?.alive&&!r.captured&&campaign.contracts[id]&&(expiry===null||expiry>clock(campaign)),'Every current clinic member must still be serving.');}
 };
 const order=action=>{
  check();const next=dispatchCampaign(campaign,action);campaign=next;orders.push({kind:'campaign',action:structuredClone(action),at:clock(campaign)});
  assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);check();
 };
 try{
  for(const ids of [planIds,patients,doctors])assert.ok(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(Number.isSafeInteger));
  assert.ok(patients.every(id=>planIds.includes(id))&&doctors.every(id=>planIds.includes(id))&&doctors.includes(operativeId));
  check();assert.equal(campaign.location,sector);assert.equal(campaign.sectors[sector]?.owner,'patriot');
  const roster=rosterFor(campaign),local=id=>operativeLocation(campaign,id)===sector&&!operativeInTransit(campaign,id);
  assert.ok(patients.every(id=>{const r=campaign.operativeState[id];return local(id)&&r.hp>=15&&!r.bleeding;}),'Stop actual acute wounds before this stable clinic handover.');
  const eligible=doctors.map(id=>roster.find(op=>op.id===id)).filter(op=>op&&local(op.id)&&stable(campaign.operativeState[op.id])&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp&&op.medical>=careRules(campaign).minimumSkill&&!patients.includes(op.id));
  assert.ok(eligible.some(op=>op.id===operativeId),'Use an actual eligible physician from this clinic plan.');
  if(campaign.operativeState[operativeId].medkits>0)return finish('already-supplied');
  // Use an already supplied eligible clinician before funding optional help.
  // Recompute this from the current plan after each actual paid care hour.
  if(eligible.some(op=>op.id!==operativeId&&campaign.operativeState[op.id].medkits>0))return finish('other-supplied-doctor');
  const rate=Math.min(...eligible.map(op=>doctorRate(op,campaign)));
  const donors=patients.filter(id=>id!==operativeId&&local(id)&&stable(campaign.operativeState[id])&&campaign.operativeState[id].hp<campaign.operativeState[id].maxHp&&campaign.operativeState[id].assignment==='patient')
   .map(id=>{const r=campaign.operativeState[id],reserve=Math.ceil((r.maxHp-r.hp)/rate);return {id,reserve,surplus:r.medkits-reserve};})
   .filter(row=>row.surplus>0).sort((a,b)=>b.surplus-a.surplus||a.id-b.id);
  const donor=donors.find(row=>{const model=sectorInventoryModel(campaign,sector,roster,row.id);return model.operativeId===row.id&&!model.reason;});
  if(!donor)return finish('no-clinic-surplus');
  const recipient=sectorInventoryModel(campaign,sector,roster,operativeId);
  assert.equal(recipient.operativeId,operativeId);assert.equal(recipient.reason,null,recipient.reason);
  applyItemQuantity(recipient.personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});
  const knownKeys=new Set(recipient.entries.map(row=>row.key)),donorBefore=campaign.operativeState[donor.id].medkits;
  order({type:'sectorInventory',sector,operativeId:donor.id,direction:'drop',item:'medkits',count:1});
  assert.equal(campaign.operativeState[donor.id].medkits,donorBefore-1);assert.ok(campaign.operativeState[donor.id].medkits>=donor.reserve);
  const donation={id:donor.id,count:1,internal:true,reserve:donor.reserve,before:donorBefore,after:donorBefore-1};donations.push(donation);
  report({event:'northernClinicDressingDropped',donation,receipt:receipt('dropped')});
  const current=sectorInventoryModel(campaign,sector,rosterFor(campaign),operativeId);
  const parcel=current.entries.filter(row=>!knownKeys.has(row.key)&&JSON.parse(row.expected).item==='medkits');
  assert.equal(parcel.length,1,'The actual patient drop must create exactly one new finite parcel.');
  const row=parcel[0];assert.equal(row.count,1);assert.equal(row.reachable,true,row.reason);
  order({type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  assert.equal(campaign.operativeState[operativeId].medkits,1);assert.equal(campaign.operativeState[donor.id].medkits,donorBefore-1);
  assert.ok(!sectorInventoryModel(campaign,sector,rosterFor(campaign),operativeId).entries.some(entry=>entry.key===row.key),'The handed-over parcel must be consumed exactly once.');
  takes.push({count:1,sourceKey:row.key,expected:row.expected,sourceKind:'clinic-pool'});
  for(const id of planIds){for(const key of ['hp','bleeding','assignment','residentPosition'])assert.deepEqual(campaign.operativeState[id][key],start.operativeState[id][key]);}
  assert.deepEqual(campaign.squads,start.squads);assert.deepEqual(campaign.squad,start.squad);assert.equal(campaign.activeSquadId,start.activeSquadId);assert.deepEqual(campaign.contracts,start.contracts);assert.equal(campaign.resources.treasury,start.resources.treasury);
  report({event:'northernClinicDressingShared',receipt:receipt('clinic-pool')});return finish('clinic-pool');
 }catch(error){
  if(error&&typeof error==='object'){error.campaign??=campaign;error.battle??=null;error.northernClinicDressingPool=receipt('refused');}
  throw error;
 }
}
