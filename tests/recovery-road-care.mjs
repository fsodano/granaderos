import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringArrivalReason,hiringTravelHours} from '../game/hiring-arrivals.js';
import {careRules,strategicBleedingPercent} from '../game/campaign-care-rules.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {sleepOrderReason} from '../game/sleep.js';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Continue from actual recapture survivors. Local qualified doctors work first;
// a paid medic is booked only where the real patients have no available doctor.
export function recoverRecapturedRoad(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const prior=structuredClone(c),events=[];
 const living=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id));
 const wounded=()=>living().filter(id=>{const r=c.operativeState[id];return r.hp<r.maxHp||r.bleeding;});
 const order=a=>{
  if(['wait','travel'].includes(a.type))for(const id of living()){
   const until=(c.hour+(a.type==='wait'?a.hours:24))*3600+(c.secondOfHour??0);let contract=c.contracts[id];
   while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=until){
    const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;contract=c.contracts[id];
   }
  }
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;events.push({action:a,hour:c.hour,funds:c.resources.treasury});
 };
 const assign=(id,assignment)=>{if(c.operativeState[id].assignment!==assignment)order({type:'assignCare',operativeId:id,assignment});};
 const localIds=at=>living().filter(id=>operativeLocation(c,id)===at);
 const selectLocal=(at,ids)=>{
  const squad=c.squads.find(q=>q.location===at&&!q.journey&&q.members.some(id=>ids.includes(id)));
  if(squad)order({type:'selectSquad',id:squad.id});
  else order({type:'createSquad',ids:ids.slice(0,6),sector:at,name:'Puesto sanitario'});
 };
 const doctors=(at,patients)=>rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id];
  return localIds(at).includes(op.id)&&op.medical>=careRules(c).minimumSkill&&r.hp>=15&&!r.bleeding&&r.energy>10&&(!r.asleep||!sleepOrderReason(c,op.id,false))&&patients.some(id=>id!==op.id);
 }).sort((a,b)=>Number(patients.includes(a.id))-Number(patients.includes(b.id))||b.medical-a.medical);
 const supply=medic=>{
  const at=operativeLocation(c,medic.id),model=()=>sectorInventoryModel(c,at,rosterFor(c),medic.id);
  let row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');
  if(!row){
   const donor=localIds(at).find(id=>id!==medic.id&&c.operativeState[id].medkits>0);
   if(donor!==undefined){order({type:'sectorInventory',sector:at,operativeId:donor,direction:'drop',item:'medkits',count:1});row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');}
  }
  if(row)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  else {const found=collectRouteItems(c,medic.id,{item:'medkits'},6);c=found.campaign;events.push({event:'finiteCareCollection',operativeId:medic.id,sector:at,quantity:found.collected,hour:c.hour});}
 };
 for(const id of living())assign(id,wounded().includes(id)?'patient':'rest');
 for(let hour=0;hour<100&&wounded().length;hour++){
  assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
  for(const at of [...new Set(wounded().map(id=>operativeLocation(c,id)))]){
   const ids=localIds(at),patients=wounded().filter(id=>operativeLocation(c,id)===at);if(!patients.length)continue;
   selectLocal(at,ids);let medic=doctors(at,patients)[0];
   if(!medic){
    let arrival=c.hiringArrivals.find(a=>a.destination===at&&rosterFor(c).find(op=>op.id===a.operativeId)?.medical>=careRules(c).minimumSkill);
    if(!arrival){
     assert.equal(hiringArrivalReason(c,at),null,`a doctor needs a legal arrival at ${at}`);
     const candidate=rosterFor(c).filter(op=>op.medical>=careRules(c).minimumSkill&&civicStatus(c,op.id).available&&contractQuote(c,op,'day').price<=c.resources.treasury).sort((a,b)=>hiringTravelHours(c,a.id)-hiringTravelHours(c,b.id)||b.medical-a.medical)[0];
     assert.ok(candidate,`a paid available doctor must reach ${at}`);order({type:'recruitCivic',id:candidate.id,term:'day',destination:at});arrival=c.hiringArrivals.find(a=>a.operativeId===candidate.id);
    }
    if(arrival)for(const id of patients){const r=c.operativeState[id],hours=Math.max(0,arrival.dueAt-c.hour);assert.ok(r.hp>Math.ceil(r.bleeding*strategicBleedingPercent(c)/100)*hours,`patient ${id} needs immediate first aid before waiting for a hire`);}
    continue;
   }
   if(c.operativeState[medic.id].asleep)order({type:'setSleep',operativeId:medic.id,asleep:false});
   if(!c.operativeState[medic.id].medkits)supply(medic);
   for(const id of ids)assign(id,id===medic.id?'doctor':patients.includes(id)?'patient':'rest');
  }
  order({type:'wait',hours:1});
 }
 assert.deepEqual(wounded(),[]);
 for(const [id,r]of Object.entries(prior.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 for(const id of prior.recruited.filter(id=>prior.operativeState[id].alive))assert.ok(c.operativeState[id].alive,`care must preserve ${id}`);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {campaign:c,events};
}
