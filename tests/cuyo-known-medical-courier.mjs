import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const medicalRows=(s,sector,id)=>sectorInventorySites(s,sector).flatMap(site=>
 sectorInventoryModel(s,site.id,rosterFor(s),id).entries
  .filter(row=>JSON.parse(row.expected).item==='medkits').map(row=>({...row,siteId:site.id})));
const knownTotal=(s,sector,id)=>medicalRows(s,sector,id).reduce((sum,row)=>sum+row.count,0);

// The caller supplies its ordinary paid-retained orders. This helper reads
// only discovered inventory rows, then physically carries them between towns.
// A new encounter or an unavailable path remains a real route interruption.
export function collectKnownCuyoDressings(read,order,physicianId,requested,{report=()=>{}}={}){
 const start=read(),clinic=operativeLocation(start,physicianId),previous=start.activeSquadId;
 assert.ok(Number.isSafeInteger(requested)&&requested>0&&requested<=1000);
 assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 assert.equal(start.sectors[clinic]?.owner,'patriot','The actual clinic must be controlled.');
 assert.equal(start.routes.posta,true,'The actual posta network must already be available.');
 assert.ok(start.recruited.includes(physicianId)&&start.operativeState[physicianId].alive&&!start.operativeState[physicianId].captured);
 const local=start.recruited.filter(id=>operativeLocation(start,id)===clinic&&start.operativeState[id].alive&&!start.operativeState[id].captured);
 assert.ok(local.every(id=>start.operativeState[id].hp>=15&&!start.operativeState[id].bleeding),
  'Stabilize actual local acute patients before a medical supply trip.');
 const sources=Object.keys(start.sectors).filter(at=>at!==clinic&&start.sectors[at].owner==='patriot')
  .map(at=>({at,known:knownTotal(start,at,physicianId)})).filter(source=>source.known>=requested);
 assert.ok(sources.length,'No known controlled finite medical source can supply this actual request.');
 const carrier=rosterFor(start).filter(op=>{
  const r=start.operativeState[op.id];
  return op.id!==physicianId&&local.includes(op.id)&&!operativeInTransit(start,op.id)&&r.hp===r.maxHp&&!r.asleep&&r.assignment==='active'&&(r.energy??100)>50;
 }).sort((a,b)=>start.operativeState[b.id].energy-start.operativeState[a.id].energy||b.strength-a.strength||a.id-b.id)[0];
 assert.ok(carrier,'An actual healthy awake local carrier must fetch the known stock.');
 const home=start.squads.find(q=>q.members.includes(carrier.id)&&!q.journey),assignment=start.operativeState[carrier.id].assignment;
 assert.ok(home,'The actual carrier must have a stationary home squad.');
 const oldCarried=start.operativeState[carrier.id].medkits??0,oldDoctor=start.operativeState[physicianId].medkits??0,receipts=[];
 order({type:'createSquad',name:'Vendas para Cuyo',ids:[carrier.id],sector:clinic});
 const courier=read().activeSquadId;
 const candidates=sources.map(source=>({...source,quote:previewStrategicRoute(read(),courier,source.at,'posta')}))
  .filter(source=>source.quote.valid).sort((a,b)=>a.quote.hours-b.quote.hours||a.at.localeCompare(b.at));
 const source=candidates[0];assert.ok(source,'A current ordinary route must reach the known medical source.');
 const travel=destination=>{
  const quote=previewStrategicRoute(read(),courier,destination,'posta');
  assert.equal(quote.valid,true,quote.reason);assert.ok(quote.hours>0&&quote.hours<=48,'The known-source courier must have a bounded current trip.');
  const began=clock(read());order(quote.action);
  assert.equal(clock(read()),began,'A queued courier departure must not advance time.');
  let zeroTimeNotices=0;
  for(let h=0;read().squads.find(q=>q.id===courier)?.journey&&h<64;h++){
   assert.equal(read().pendingEncounter,null,'Resolve the actual courier encounter before continuing.');
   assert.equal(read().pendingBattle,null);
   const before=clock(read());order({type:'wait',hours:1});const elapsed=clock(read())-before;
   assert.ok(elapsed>=0&&elapsed<=3600,'A normal courier wait cannot exceed its requested hour.');
   zeroTimeNotices=elapsed===0?zeroTimeNotices+1:0;
   assert.ok(zeroTimeNotices<3,'The actual courier stopped on repeated zero-time notices.');
  }
  assert.ok(!read().squads.find(q=>q.id===courier)?.journey,'The actual quoted courier journey must finish.');
  assert.equal(operativeLocation(read(),carrier.id),destination);assert.equal(read().location,destination);
  assert.equal(read().pendingEncounter,null);assert.equal(read().pendingBattle,null);
  receipts.push({event:'cuyoKnownCourierArrival',carrier:carrier.id,destination,quote,departedSeconds:began,arrivedSeconds:clock(read())});
 };
 const departure=clock(read());travel(source.at);
 let remaining=requested;
 while(remaining){
  const s=read(),model=site=>sectorInventoryModel(s,site,rosterFor(s),carrier.id);
  const row=medicalRows(s,source.at,carrier.id).filter(row=>row.reachable&&row.count>0)
   .sort((a,b)=>b.count-a.count||a.siteId.localeCompare(b.siteId)||a.key.localeCompare(b.key))[0];
  assert.ok(row,'The known source must still be physically reachable at the actual arrival.');
  const count=Math.min(remaining,row.count),pool=knownTotal(s,source.at,carrier.id),carried=s.operativeState[carrier.id].medkits??0;
  applyItemQuantity(model(row.siteId).personal,{...JSON.parse(row.expected),count});
  order({type:'sectorInventory',sector:row.siteId,operativeId:carrier.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(read().operativeState[carrier.id].medkits,carried+count);
  assert.equal(knownTotal(read(),source.at,carrier.id),pool-count,'A compacted container row must still debit the exact same-site medical pool.');
  receipts.push({event:'cuyoKnownCourierPickup',carrier:carrier.id,source:source.at,siteId:row.siteId,sourceKey:row.key,expected:row.expected,count,knownBefore:pool,knownAfter:pool-count});
  remaining-=count;
 }
 travel(clinic);
 order({type:'assignToSquad',operativeId:carrier.id,squadId:home.id});
 if(read().squads.find(q=>q.id===home.id).members.some((id,index)=>id!==home.members[index])){
  order({type:'selectSquad',id:home.id});order({type:'squad',ids:home.members});
 }
 if(assignment!=='active')order({type:'assignCare',operativeId:carrier.id,assignment});
 if(read().activeSquadId!==previous)order({type:'selectSquad',id:previous});
 order({type:'sectorInventory',sector:clinic,operativeId:carrier.id,direction:'drop',item:'medkits',count:requested});
 let delivered=0;
 while(delivered<requested){
  const s=read(),row=medicalRows(s,clinic,physicianId).find(row=>row.reachable&&row.count>0);
  assert.ok(row,'The actual physician must reach the finite returned dressings.');
  const count=Math.min(requested-delivered,row.count);
  applyItemQuantity(sectorInventoryModel(s,row.siteId,rosterFor(s),physicianId).personal,{...JSON.parse(row.expected),count});
  order({type:'sectorInventory',sector:row.siteId,operativeId:physicianId,direction:'take',sourceKey:row.key,expected:row.expected,count});delivered+=count;
 }
 assert.equal(read().operativeState[carrier.id].medkits,oldCarried);
 assert.equal(read().operativeState[physicianId].medkits,oldDoctor+requested);
 assert.equal(read().activeSquadId,previous);assert.equal(read().location,clinic);
 receipts.push({event:'cuyoKnownCourierReturned',carrier:carrier.id,physician:physicianId,clinic,source:source.at,count:requested,elapsedSeconds:clock(read())-departure,campaign:read()});
 // Success summaries describe only the completed physical transfer.
 for(const receipt of receipts)report(receipt);
 return read();
}
