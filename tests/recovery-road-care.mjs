import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {hiringArrivalReason} from '../game/hiring-arrivals.js';
import {careRules,strategicBleedingPercent} from '../game/campaign-care-rules.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {sleepOrderReason} from '../game/sleep.js';
import {collectRouteItems,discoverRouteCache} from './finite-route-equipment.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {doctorRate} from '../game/medical-care.js';

// Continue from actual recapture survivors. Local qualified doctors work first;
// a paid medic is booked only where the real patients have no available doctor.
export function recoverRecapturedRoad(start){
 const inputCapture=recordRouteStrategicEvidence({helper:'recoverRecapturedRoad',stage:'preparation-input',campaign:start});
 let c=decodeSave(encodeSave(start)).campaign;
 const prior=structuredClone(c),events=[];
 try{
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
  const inventory=model();
  recordRouteStrategicEvidence({helper:'recoverRecapturedRoad',stage:'medical-supply-input',campaign:c,inputCapture,context:{operativeId:medic.id,sector:at,inventory}});
  let row=inventory.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');
  if(!row){
   const donor=localIds(at).find(id=>id!==medic.id&&c.operativeState[id].medkits>0);
   if(donor!==undefined){order({type:'sectorInventory',sector:at,operativeId:donor,direction:'drop',item:'medkits',count:1});row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');}
  }
  if(row)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  else {
   let found;
   const beforeDiscovery=[c.hour,c.secondOfHour??0];c=discoverRouteCache(c,medic.id);
   events.push({event:'finiteCareCacheChecked',operativeId:medic.id,sector:at,before:beforeDiscovery,after:[c.hour,c.secondOfHour??0],campaign:structuredClone(c)});
   try{found=collectRouteItems(c,medic.id,{item:'medkits'},6);}
   catch(error){
    if(!error.message.startsWith('finite local equipment or carrying room is exhausted:'))throw error;
    const need=wounded().filter(id=>id!==medic.id&&operativeLocation(c,id)===at).reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(medic,c)),0);
    const kept=living(),inspectionSeconds=c.hour*3600+(c.secondOfHour??0),inspectionBound=24*3600;
    for(const id of kept){
     let contract=c.contracts[id];
     while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=inspectionSeconds+inspectionBound){
      const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
      assert.equal(quote.available,true,quote.reason);
      order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
      assert.equal(c.resources.treasury,cash-quote.price);contract=c.contracts[id];
      assert.equal(contractExpiresSeconds(contract),quote.expiresAt*3600+(quote.expiresSecond??0));
     }
    }
    found=recoverVisibleRouteDressings(c,medic.id,Math.max(1,Math.min(6,need)));
    const finish=found.campaign.hour*3600+(found.campaign.secondOfHour??0);
    assert.ok(finish>=inspectionSeconds&&finish-inspectionSeconds<=inspectionBound,'The actual finite inspection must retain its bounded clock.');
    for(const id of kept){const expiry=contractExpiresSeconds(found.campaign.contracts[id]);assert.ok(found.campaign.recruited.includes(id)&&found.campaign.operativeState[id].alive&&(expiry===null||expiry>finish),'The actual inspection must retain every serving survivor.');}
    assert.ok(found.collected>0,'The real clinic physician needs an admitted finite dressing before another care hour.');
    events.push(found.evidence);
   }
   c=found.campaign;events.push({event:'finiteCareCollection',operativeId:medic.id,sector:at,quantity:found.collected,hour:c.hour});
  }
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
     const candidate=rosterFor(c).filter(op=>op.medical>=careRules(c).minimumSkill&&civicStatus(c,op.id).available&&contractQuote(c,op,'day').price<=c.resources.treasury).sort((a,b)=>0-0||b.medical-a.medical)[0];
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
 }catch(error){recordRouteStrategicEvidence({helper:'recoverRecapturedRoad',stage:'preparation-failure',campaign:c,inputCapture,context:{events},error});throw error;}
}
