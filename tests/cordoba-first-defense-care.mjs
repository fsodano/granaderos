import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {careAssignmentIssue} from '../game/medical-care.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {bookRouteHires,finishRouteHireArrivals} from './paid-route-hiring.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const saved=s=>decodeSave(encodeSave(s)).campaign;

// The first defense can wound the clinic while its courier is still away.
// Use known finite linen and real paid staff before that journey resumes.
export function stabilizeCordobaFirstDefense(start,{report=()=>{}}={}){
 let c=saved(start);const before=structuredClone(start),orders=[],hires=[],renewals=[],linen=[],ticks=[];
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.sectors.cordoba.owner,'patriot');
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);orders.push(structuredClone(action));};
 const local=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba';});
 const urgent=()=>local().filter(id=>{const r=c.operativeState[id];return r.bleeding>0||r.hp<15;});
 const cohort=local(),patients=urgent();
 const physicians=()=>rosterFor(c).filter(op=>local().includes(op.id)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id);
 const takeKnownLinen=doctor=>{
  const row=sectorInventoryModel(c,'cordoba',rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!row)return false;
  const count=Math.min(row.count,4),carried=c.operativeState[doctor.id].medkits;
  order({type:'sectorInventory',sector:'cordoba',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(c.operativeState[doctor.id].medkits,carried+count);linen.push({operativeId:doctor.id,sourceKey:row.key,expected:row.expected,count,kind:row.kind});return true;
 };
 for(let hour=0;urgent().length&&hour<12;hour++){
  assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
  let doctor=physicians()[0];assert.ok(doctor,'critical clinic care requires a living stable local physician');
  if(!c.operativeState[doctor.id].medkits&&!takeKnownLinen(doctor)){
   // Each profile is booked once. Its existing carried linen is finite.
   // A week covers treatment and the interrupted long walking courier trip.
   const replacement=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],quote=contractQuote(c,op,'week');return civicStatus(c,op.id).available&&!c.recruited.includes(op.id)&&r.alive&&!r.captured&&op.medical>=20&&r.medkits>0&&hiringTravelHours(c,op.id)===0&&quote.available&&quote.total<=c.resources.treasury;}).sort((a,b)=>contractQuote(c,a,'week').total-contractQuote(c,b,'week').total||b.medical-a.medical||a.id-b.id)[0];
   assert.ok(replacement,'known finite linen or an actual supplied paid medic is required before time resumes');
   const booked=bookRouteHires(c,[replacement.id],{term:'week',destination:'cordoba',report});c=finishRouteHireArrivals(booked.campaign,booked.hires,{minimumWaitHours:0,report});hires.push(...booked.hires);
   orders.push({type:'recruitCivic',id:replacement.id,term:'week',destination:'cordoba'});
   const count=c.operativeState[replacement.id].medkits;assert.ok(count>0);assert.equal(new Set(hires.map(h=>h.id)).size,hires.length);
   doctor=physicians()[0];
   if(doctor.id!==replacement.id&&!c.operativeState[doctor.id].medkits){
    const donor=sectorInventoryModel(c,'cordoba',rosterFor(c),replacement.id);assert.equal(donor.reason,null);
    const carried=c.operativeState[replacement.id].medkits+c.operativeState[doctor.id].medkits;
    order({type:'sectorInventory',sector:'cordoba',operativeId:replacement.id,direction:'drop',item:'medkits',count});
    assert.ok(takeKnownLinen(doctor),'the actual dropped linen must be reachable by the clinic physician');
    assert.equal(c.operativeState[replacement.id].medkits+c.operativeState[doctor.id].medkits,carried,'sharing linen cannot create supplies');
   }
  }
  assert.ok(!careAssignmentIssue(c,doctor,'doctor'),'the selected physician must have actual carried linen');
  for(const id of local())order({type:'assignCare',operativeId:id,assignment:urgent().includes(id)?'patient':'rest'});
  order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
   let expiry=contractExpiresSeconds(c.contracts[id]);
   while(expiry!==null&&expiry<=clock(c)+3601){
    const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);const extended=contractExpiresSeconds(c.contracts[id]);assert.ok(extended>expiry);renewals.push({id,quote});expiry=extended;
   }
  }
  c=saved(c);const began=clock(c),kits=c.operativeState[doctor.id].medkits;
  for(let notice=0;clock(c)===began&&notice<3;notice++){
   order({type:'wait',hours:1});assert.equal(c.pendingEncounter,null,'an actual interruption must be defended before clinic time continues');
   if(clock(c)===began)report({event:'cordobaFirstDefenseCareNotice',hour:c.hour,second:c.secondOfHour??0,assignmentAttention:structuredClone(c.assignmentAttention.notice),contractAttention:structuredClone(c.contractAttention.notice)});
  }
  assert.equal(clock(c)-began,3600);assert.equal(kits-c.operativeState[doctor.id].medkits,1,'one actual dressing treats one patient in this paid hour');
  assert.ok(cohort.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive),'urgent care must preserve every actual serving native survivor');
  const tick={hour:c.hour,second:c.secondOfHour??0,doctor:doctor.id,dressingsSpent:1,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))};ticks.push(tick);c=saved(c);report({event:'cordobaFirstDefenseCareTick',tick,campaign:structuredClone(c)});
  if(!c.operativeState[doctor.id].medkits)order({type:'assignCare',operativeId:doctor.id,assignment:'rest'});
 }
 assert.deepEqual(urgent(),[],'stabilize native bleeding and critical wounds before the courier continues');
 for(const id of local())order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}}
 const otherDeaths=Object.keys(before.operativeState).filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive).map(Number);assert.ok(otherDeaths.every(id=>!before.recruited.includes(id)));
 const receipt={event:'cordobaFirstDefenseCare',cohort,patients,hires,orders,renewals,linen,ticks,otherDeaths,dressingsSpent:ticks.length,startSeconds:clock(start),endSeconds:clock(c),treasuryBefore:start.resources.treasury,treasuryAfter:c.resources.treasury};
 assert.deepEqual(start,before);c=saved(c);report(receipt);return {campaign:c,receipt};
}
