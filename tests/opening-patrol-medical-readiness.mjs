import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

export const OPENING_PATROL_DRESSINGS=2;
// Two actual linen dressings permit an initial first-aid stroke and one further
// stroke. Preparation uses public local property; the original patrol still
// determines its own wounds, deaths, captivity and remaining supplies.
export function prepareOpeningPatrolMedicalReadiness(start,{report=()=>{},onCheckpoint}={}){
 const original=structuredClone(start),field=[...start.squad],priorDead=Object.keys(start.operativeState).filter(id=>!start.operativeState[id].alive);
 let campaign=decodeSave(encodeSave(start)).campaign;const orders=[],takes=[],donations=[];
 assert.equal(campaign.location,'cordoba');assert.equal(campaign.sectors.cordoba.owner,'patriot');
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);assert.equal(field.length,4);
 const inventory=id=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);
 const medicalRows=id=>inventory(id).entries.filter(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits');
 const validate=()=>{
  assert.deepEqual(start,original);assert.deepEqual(campaign.squad,field);
  assert.equal(campaign.resources.treasury,start.resources.treasury);
  assert.equal(campaign.hour,start.hour);assert.equal(campaign.secondOfHour,start.secondOfHour);
  for(const id of priorDead)assert.equal(campaign.operativeState[id].alive,false);
  for(const id of field){const before=start.operativeState[id],after=campaign.operativeState[id];for(const key of ['hp','maxHp','bleeding','energy','fatigue','alive','captured','location','assignment'])assert.deepEqual(after[key],before[key]);}
 };
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);orders.push(structuredClone(action));validate();};
 for(const operativeId of field){
  const actor=campaign.operativeState[operativeId];assert.ok(actor.alive&&!actor.captured&&actor.location==='cordoba');
  assert.equal(inventory(operativeId).reason,null);
  while(campaign.operativeState[operativeId].medkits<OPENING_PATROL_DRESSINGS){
   let row=medicalRows(operativeId)[0];
   if(!row){
    // Qualified rear physicians retain two pieces for their own immediate aid.
    const donor=rosterFor(campaign).filter(op=>!field.includes(op.id)&&campaign.recruited.includes(op.id)&&op.medical>=70&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured&&campaign.operativeState[op.id].location==='cordoba'&&campaign.operativeState[op.id].medkits>OPENING_PATROL_DRESSINGS&&!inventory(op.id).reason).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
    assert.ok(donor,'Actual reachable local linen or a qualified physician’s carried surplus is required.');
    const missing=OPENING_PATROL_DRESSINGS-campaign.operativeState[operativeId].medkits,before=campaign.operativeState[donor.id].medkits,count=Math.min(missing,before-OPENING_PATROL_DRESSINGS);
    order({type:'sectorInventory',sector:'cordoba',operativeId:donor.id,direction:'drop',item:'medkits',count});
    assert.equal(campaign.operativeState[donor.id].medkits,before-count);donations.push({donorId:donor.id,count,before,after:campaign.operativeState[donor.id].medkits});
    row=medicalRows(operativeId)[0];assert.ok(row,'The actual donation must become public reachable local property.');
   }
   const count=Math.min(OPENING_PATROL_DRESSINGS-campaign.operativeState[operativeId].medkits,row.count),before=campaign.operativeState[operativeId].medkits,sourceBefore=row.count,medicalPoolBefore=medicalRows(operativeId).reduce((sum,entry)=>sum+entry.count,0);
   order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});
   // Empty container stacks are removed; their index may now name a different
   // item. Check the actual medical pool debit and only retain the old stack
   // key while its original medical stack still has units.
   const sourceAfter=sourceBefore===count?0:medicalRows(operativeId).find(entry=>entry.key===row.key)?.count??0,medicalPoolAfter=medicalRows(operativeId).reduce((sum,entry)=>sum+entry.count,0);
   assert.equal(medicalPoolAfter,medicalPoolBefore-count);assert.equal(sourceAfter,sourceBefore-count);assert.equal(campaign.operativeState[operativeId].medkits,before+count);
   const receipt={operativeId,sourceKey:row.key,expected:row.expected,count,sourceBefore,sourceAfter,medicalPoolBefore,medicalPoolAfter,carriedBefore:before,carriedAfter:campaign.operativeState[operativeId].medkits};takes.push(receipt);report({event:'openingPatrolFiniteDressings',...receipt});
  }
 }
 for(const id of field)assert.ok(campaign.operativeState[id].medkits>=OPENING_PATROL_DRESSINGS);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);validate();onCheckpoint?.('opening-patrol-medical-ready',structuredClone(campaign));
 return {campaign,receipt:{policy:{perPatrolMember:OPENING_PATROL_DRESSINGS,doctorMinimumRetained:OPENING_PATROL_DRESSINGS},field,orders,takes,donations,totalTaken:takes.reduce((sum,row)=>sum+row.count,0),cost:start.resources.treasury-campaign.resources.treasury,elapsedSeconds:0}};
}
