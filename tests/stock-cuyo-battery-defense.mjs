import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {fightNorthernSector,northernClinicDefenseOrder} from './northern-route.mjs';
import {relieveStockNorthernPatient} from './fresh-northern-command.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {careAssignmentReason} from '../game/medical-care.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {bookRouteHires} from './paid-route-hiring.mjs';

const expandedDefenseState=state=>{
 const copy=structuredClone(state);
 for(const [sector,scene]of Object.entries(copy.sectorStates))copy.sectorStates[sector]=expandCellScene(scene,state);
 return copy;
};
const savedDefenseState=state=>{
 const restored=decodeSave(encodeSave(state)).campaign;
 // Rural retained scenes use the lossless tile codec. Compare every expanded
 // tile and all campaign fields, then continue from the admitted save shape.
 assert.deepEqual(expandedDefenseState(restored),expandedDefenseState(state));
 assert.deepEqual(decodeSave(encodeSave(restored)).campaign,restored);
 return restored;
};

// Book an affordable existing guard before the crew's journey advances time.
// This leaves the arrival to the ordinary campaign clock and preserves the
// authored soldier, equipment, travel delay and start of paid service.
export function prepareStockCuyoBatteryGuard(start,{report=()=>{}}={}){
 const before=structuredClone(start);assert.equal(start.pendingEncounter,null);assert.equal(start.pendingBattle,null);
 const candidates=rosterFor(start).filter(op=>op.id>=100&&op.id<1000&&!start.recruited.includes(op.id)&&start.operativeState[op.id].alive&&!start.operativeState[op.id].captured).map(op=>({op,quote:contractQuote(start,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=start.resources.treasury).sort((a,b)=>b.op.marksmanship-a.op.marksmanship||a.quote.price-b.quote.price||a.op.id-b.op.id);
 const selected=candidates[0];assert.ok(selected,'An actual affordable guard must be available before the battery journey.');
 const action={type:'recruitCivic',id:selected.op.id,term:'day',destination:'cordoba'},booked=bookRouteHires(start,[selected.op.id],{term:'day',destination:'cordoba'}),campaign=booked.campaign,arrival=booked.hires[0].arrival;
 assert.equal(campaign.resources.treasury,start.resources.treasury-selected.quote.total);assert.deepEqual([campaign.hour,campaign.secondOfHour],[start.hour,start.secondOfHour]);assert.deepEqual(start,before);
 report({event:'stockCuyoBatteryGuardBooked',id:selected.op.id,price:selected.quote.price,action,arrival:structuredClone(arrival),hour:campaign.hour,second:campaign.secondOfHour??0});
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return {campaign,guardId:selected.op.id,quote:structuredClone(selected.quote),arrival:structuredClone(arrival)};
}

// Use the reserve's earned roof cover. Physicians can give adjacent finite aid,
// prepare their real firearm and search after contact clears. A supplied doctor
// must not remain an indefinite null hold after the other defenders fall.
export function stockCuyoBatteryDefenseOrder(battle,unit){
 const action=northernClinicDefenseOrder(battle,unit);
 // This rear carrier keeps the actual local linen reserve. Other supplied
 // guards give field aid; the carrier still fires, reloads and searches.
 if(unit.id==='101'&&(action?.type==='useItem'||action?.type==='weapon'&&action.slot==='medical'))return null;
 return action;
}

// An actual local Córdoba reserve resolves a raid while the gun crew is away.
// Every battle and care order retains the native outcome, time and supplies.
export function resolveStockCuyoBatteryEncounter(start,{report=()=>{}}={}){
 const before=structuredClone(start),active=start.activeSquadId,groupId=start.pendingEncounter?.groupId??start.pendingBattle?.defenseGroupId;
 let c=decodeSave(encodeSave(start)).campaign;
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),clock=()=>c.hour*3600+(c.secondOfHour??0);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const retain=hours=>{
  for(const id of live()){
   let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock()),'Actual living defense participants must still be serving.');
   while(expiry!==null&&expiry<=clock()+hours*3600){
    const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);expiry=contractExpiresSeconds(c.contracts[id]);
    report({event:'stockCuyoBatteryDefenseRenewal',id,price:quote.price,hour:c.hour,second:c.secondOfHour??0});
   }
  }
 };
 if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId,choice:'tactical'});}
 assert.equal(c.pendingBattle?.sector,'cordoba');assert.equal(c.pendingBattle.defenseGroupId,groupId);
 const result=fightNorthernSector(c,'cordoba',{controller:stockCuyoBatteryDefenseOrder,report});c=result.campaign;
 assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.defeated,false);
 report({event:'stockCuyoBatteryDefenseSettled',groupId,campaign:structuredClone(c)});
 const survivors=live().length,startSeconds=clock();
 // Keep the arrived local guard and surviving reserve in paid service while
 // the existing guns finish their remaining delivery journey.
 retain(24);
 const acute=()=>live().filter(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
 for(let batch=0;acute().length;batch++){
  assert.ok(batch<live().length,'Actual finite defense care must resolve each patient.');
  const patientId=acute().sort((a,b)=>c.operativeState[a].hp/Math.max(1,c.operativeState[a].bleeding)-c.operativeState[b].hp/Math.max(1,c.operativeState[b].bleeding))[0],sector=operativeLocation(c,patientId);
  const patients=acute().filter(id=>operativeLocation(c,id)===sector).slice(0,5),position=id=>c.operativeState[id].residentPosition??c.sectorStates[sector]?.units.find(unit=>unit.id===String(id));
  const target=position(patientId),distance=id=>{const point=position(id);return target&&point?(point.tacticalLevel??0)===(target.tacticalLevel??0)?Math.hypot(point.x-target.x,point.y-target.y):Infinity:Infinity;};
  const qualified=rosterFor(c).filter(op=>live().includes(op.id)&&operativeLocation(c,op.id)===sector&&!operativeInTransit(c,op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>0&&op.medical>0).sort((a,b)=>distance(a.id)-distance(b.id)||b.medical-a.medical||a.id-b.id);
  const alternate=qualified.filter(op=>![101,146].includes(op.id)),doctors=alternate.length?alternate:qualified;
  if(!doctors.length){c=relieveStockNorthernPatient(c,{patientId,report}).campaign;continue;}
  if(!c.operativeState[doctors[0].id].medkits){
   const doctor=doctors[0],target=2*patients.length;
   report({event:'stockCuyoBatteryDefenseMedicalSourceStarted',doctor:doctor.id,sector,campaign:structuredClone(c)});
   while(c.operativeState[doctor.id].medkits<target){
    const row=sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
    assert.ok(row,'The nearest actual physician needs reachable finite dressings before the acute approach.');
    const count=Math.min(row.count,target-c.operativeState[doctor.id].medkits),stock=c.operativeState[doctor.id].medkits;
    const action={type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count};order(action);
    assert.equal(c.operativeState[doctor.id].medkits,stock+count);assert.equal(sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.find(next=>next.key===row.key)?.count??0,row.count-count);
    report({event:'stockCuyoBatteryDefenseDressingsCollected',doctor:doctor.id,sector,sourceKey:row.key,count,action,beforeCount:row.count,afterCount:row.count-count});
   }
   report({event:'stockCuyoBatteryDefenseMedicalSourceReady',doctor:doctor.id,sector,campaign:structuredClone(c)});
  }
  // Include nearby supplied physicians, rather than replacing them with only
  // the most skilled distant doctor. A stable bleeding medic can use self aid.
  const group=[...new Set([...patients,...doctors.filter(op=>c.operativeState[op.id].medkits>0).map(op=>op.id)])].slice(0,6);
  order({type:'createSquad',ids:group,sector,name:'Socorro de la reserva'});for(const id of group)order({type:'assignCare',operativeId:id,assignment:'active'});
  const p=visit(c),stock=group.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),patientRecords=patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}));
  report({event:'stockCuyoBatteryDefenseAidStarted',sector,ids:group,campaign:structuredClone(p.campaign),battle:structuredClone(p.battle)});
  const aid=autoBandageBattle(p.battle);c=leave(sync({campaign:p.campaign,battle:aid.battle}));
  const used=aid.steps.filter(action=>action.type==='useItem').length;assert.equal(group.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),stock-used);
  for(const id of patients){assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15,`Actual timely first aid must stabilize ${id}.`);assert.equal(c.operativeState[id].bleeding,0);}
  assert.equal(c.pendingEncounter,null);c=savedDefenseState(c);
  report({event:'stockCuyoBatteryDefenseFirstAid',sector,ids:group,patientsBefore:patientRecords,patientsAfter:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding})),orders:aid.steps,dressingsUsed:used,elapsedSeconds:aid.elapsedSeconds,treatedIds:aid.treatedIds,stoppedReason:aid.stoppedReason,campaign:structuredClone(c)});
  for(const id of group)if(!careAssignmentReason(c,rosterFor(c).find(op=>op.id===id),'rest'))order({type:'assignCare',operativeId:id,assignment:'rest'});
 }
 order({type:'selectSquad',id:active});
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.equal(live().length,survivors,'Finite care cannot remove or replace an actual surviving defender.');
 assert.ok(c.encounterHistory.some(entry=>entry.groupId===groupId&&entry.outcome==='victory'));assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(start,before);
 c=decodeSave(encodeSave(c)).campaign;assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'stockCuyoBatteryDefenseComplete',groupId,turns:result.summary.turns,actions:result.summary.actions,battleSeconds:result.summary.elapsedSeconds,careSeconds:clock()-startSeconds,losses:before.recruited.filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive),hour:c.hour,second:c.secondOfHour??0,campaign:structuredClone(c)});
 return c;
}
