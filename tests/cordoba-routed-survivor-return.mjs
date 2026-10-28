import assert from 'node:assert/strict';
import {dispatchCampaign} from '../packages/game/campaign.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {worldOwner} from '../packages/game/world-cells.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {strategicBleedingPercent} from '../packages/game/campaign-care-rules.js';
import {contractExpiresSeconds} from '../packages/game/contracts.js';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {stabilizeCordobaFirstDefense} from './cordoba-first-defense-care.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);

// A real tactical departure can be unassigned when all eight squad records
// already exist. Reuse a vacant record; do not prescribe rest on neutral land.
export function returnRoutedCordobaSurvivors(start,{deadlineSeconds,report=()=>{}}={}){
 let c=start;const original=structuredClone(start),cohort=living(c),selected=c.activeSquadId;
 const receipt={event:'cordobaRoutedSurvivorReturn',deadlineSeconds,startSeconds:clock(c),endSeconds:clock(c),departures:[],orders:[],renewals:[],journeys:[],care:null,completed:false};
 const limit=seconds=>assert.ok(Number.isSafeInteger(deadlineSeconds)&&clock(c)+seconds<=deadlineSeconds,'The actual return and care must fit the original recovery deadline.');
 const preserve=()=>{for(const id of cohort)assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured,`The actual return must preserve serving survivor ${id}.`);};
 const order=action=>{
  limit(action.type==='wait'?action.hours*3600:0);const from=clock(c),cash=c.resources.treasury,next=dispatchCampaign(c,action);
  receipt.orders.push({kind:'campaign',action:structuredClone(action),from,to:clock(next),cost:cash-next.resources.treasury,accepted:next.lastError===null});
  if(next.lastError){const error=Error(next.lastError);error.campaign=next;throw error;}
  c=next;receipt.endSeconds=clock(c);limit(0);
  assert.equal(c.pendingEncounter,null,'An actual encounter must be resolved before the return continues.');assert.equal(c.pendingBattle,null);preserve();return c;
 };
 const retain=()=>{
  const quote=quoteMountainServiceBudget(c,{keepIds:living(c),horizonSeconds:clock(c)+3601});assert.equal(quote.available,true,quote.reason);
  for(const row of quote.entries)for(let n=0;n<row.renewals;n++){
   const contract=c.contracts[row.id],expiry=contractExpiresSeconds(contract);
   order({type:'renewContract',id:row.id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
   assert.ok(contractExpiresSeconds(c.contracts[row.id])>expiry);receipt.renewals.push({id:row.id,quote:row.quote});
  }
 };
 try{
  assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(worldOwner(c,'cordoba'),'patriot');limit(0);
  receipt.departures=cohort.filter(id=>{const r=c.operativeState[id];return !operativeInTransit(c,id)&&worldOwner(c,operativeLocation(c,id))==='neutral'&&r.arrival?.fromSector==='cordoba';});
  if(!receipt.departures.length){receipt.completed=true;return {campaign:c,receipt};}
  recordRouteStrategicEvidence({helper:'returnRoutedCordobaSurvivors',stage:'preparation-input',campaign:c,context:{receipt}});
  for(const origin of new Set(receipt.departures.map(id=>operativeLocation(c,id)))){
   const atOrigin=receipt.departures.filter(id=>operativeLocation(c,id)===origin);
   for(let offset=0;offset<atOrigin.length;offset+=6){
    const ids=atOrigin.slice(offset,offset+6),otherGroups=structuredClone(c.squads.filter(q=>q.members.length&&!q.members.some(id=>ids.includes(id))));
    for(const id of ids){const r=c.operativeState[id];assert.ok(r.hp>=15&&!r.asleep&&r.energy>10,'A rural survivor must remain capable of the ordinary return.');}
    let home=c.squads.find(q=>!q.journey&&q.location===origin&&q.members.length===ids.length&&q.members.every(id=>ids.includes(id)));
    if(!home){assert.ok(c.squads.some(q=>!q.members.length&&!q.journey),'The real departed survivors need an existing vacant squad record.');order({type:'createSquad',sector:origin,ids,name:'Regreso de supervivientes'});home=c.squads.find(q=>q.id===c.activeSquadId);}
    if(c.activeSquadId!==home.id)order({type:'selectSquad',id:home.id});
    for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
    const quote=previewStrategicRoute(c,home.id,'cordoba','march');assert.equal(quote.valid,true,quote.reason);assert.equal(quote.action.type,'travel');assert.ok(quote.hours>0&&quote.hours<=48);limit(quote.hours*3600+(ids.some(id=>c.operativeState[id].bleeding>0)?3600:0));
    // Reserve actual hourly wound loss through arrival. This is a refusal
    // guard, never a projected health value adopted into the campaign.
    for(const id of ids){const r=c.operativeState[id],loss=Math.ceil(r.bleeding*strategicBleedingPercent(c)/100)*(Math.ceil(quote.hours)+1);assert.ok(r.hp-loss>=15,'The ordinary return needs finite field aid before this wound can travel safely.');}
    const journey={squadId:home.id,origin,ids,quote:structuredClone(quote),startSeconds:clock(c),arrivalSeconds:null};receipt.journeys.push(journey);order(quote.action);
    for(let waits=0;c.squads.find(q=>q.id===home.id)?.journey&&waits<48;waits++){
     limit(3600);for(const id of cohort){const r=c.operativeState[id];assert.ok(r.hp>Math.ceil(r.bleeding*strategicBleedingPercent(c)/100),'Every actual survivor must survive the next ordinary travel hour.');}retain();order({type:'wait',hours:1});
     const current=c.squads.find(q=>q.id===home.id);assert.ok(!current.journey||current.journey.status==='moving','A paused or blocked real return must be handled before recovery continues.');
    }
    assert.equal(c.squads.find(q=>q.id===home.id)?.journey,undefined);assert.ok(ids.every(id=>operativeLocation(c,id)==='cordoba'));journey.arrivalSeconds=clock(c);
    for(const group of otherGroups){const current=c.squads.find(q=>q.id===group.id);assert.deepEqual(current?.members,group.members,'Returning survivors cannot borrow another squad.');if(!group.journey)assert.deepEqual(current,group,'Returning survivors cannot move another stationary squad.');}
   }
  }
  const acute=cohort.filter(id=>{const r=c.operativeState[id];return operativeLocation(c,id)==='cordoba'&&(r.bleeding>0||r.hp<15);});
  if(acute.length){
   const began=c,boundary={kind:'cordobaFirstDefenseCare',from:clock(c),to:null,cost:null,receipt:null,nativeOrderTape:null,completed:false};receipt.care=boundary;
   // The existing care leaf owns its real orders. Its nested tape is not
   // invented here; only a normal successful return becomes the next state.
   const result=stabilizeCordobaFirstDefense(c,{deadlineSeconds,report});c=result.campaign;boundary.to=clock(c);boundary.cost=began.resources.treasury-c.resources.treasury;boundary.receipt=result.receipt;boundary.completed=true;limit(0);preserve();
  }
  if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  for(const [id,r]of Object.entries(original.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  assert.deepEqual(start,original);receipt.endSeconds=clock(c);receipt.completed=true;report(receipt);return {campaign:c,receipt};
 }catch(error){
  // Nested refused outputs remain raw diagnostic references. Do not query,
  // save, dispatch or continue from them, and preserve the exact thrown error.
  error.campaign??=c;error.cordobaRoutedSurvivorReturn=receipt;
  recordRouteStrategicEvidence({helper:'returnRoutedCordobaSurvivors',stage:'preparation-failure',campaign:c,context:{receipt,nestedCampaign:error.campaign??null,nestedBattle:error.battle??null},error});throw error;
 }
}
