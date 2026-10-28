import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {isContractOperative} from '../game/content-character-ids.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringArrivalReason,hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {immediateRecruitmentExpectation} from './immediate-recruitment-fixture.mjs';
import {canReassignOperative,operativeLocation} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// Prepare one real local medical reserve before the remote field column moves.
// Progress is an in-memory receipt for this call chain, never a saved battle or
// a campaign input to adopt. The actual campaign remains the sole authority.
export function prepareNorthernRoadMedicalReserve(start,{sector='tucuman',keepServing,progress=null,report=()=>{}}={}){
 const before=structuredClone(start),orders=[],renewals=[];
 let c=start,battle=null,plan=progress?structuredClone(progress):null;
 const selected=plan?.selectedSquadId??start.activeSquadId;
 const stopped=()=>c.pendingEncounter?'pending-encounter':c.pendingBattle?'pending-battle':c.defeated?'campaign-defeated':null;
 const local=()=>c.recruited.filter(id=>canReassignOperative(c,id)&&operativeLocation(c,id)===sector);
 const fit=id=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&!r.routed&&!r.unconscious&&r.energy>10;};
 const doctors=()=>rosterFor(c).filter(op=>local().includes(op.id)&&fit(op.id)&&op.medical>=20).sort((a,b)=>b.medical-a.medical||a.id-b.id);
 const finish=reason=>{
  assert.deepEqual(start,before);
  const result={campaign:c,ready:!reason,reason:reason??null,orders,renewals,progress:plan,reliefId:plan?.id??null};
  report({event:'northernRoadMedicalPreparation',...structuredClone(result)});return result;
 };
 const execute=action=>{
  const from=clock(c),cash=c.resources.treasury;c=dispatchCampaign(c,action);
  orders.push({kind:'campaign',action:structuredClone(action),from,to:clock(c),cost:cash-c.resources.treasury});
  assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);
 };
 const retain=until=>{
  // Local posts and the recipient keep their existing duty during this short
  // preparation, even when the caller retains a smaller later travel cohort.
  const ids=[...new Set([...(keepServing??c.recruited),...local(),...(plan&&c.recruited.includes(plan.id)?[plan.id]:[])])];
  for(const id of ids){
   const r=c.operativeState[id];if(!r?.alive||r.captured||!c.recruited.includes(id))continue;
   let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'The actual reserve duty must still be serving.');
   for(let n=0;expiry!==null&&expiry<=until;n++){
    assert.ok(n<8,'Reserve preparation has a bounded arrival interval.');
    const op=rosterFor(c).find(o=>o.id===id),quote=contractRenewalQuote(c,op,'day'),contract=c.contracts[id];
    assert.equal(quote.available,true,quote.reason);assert.ok(quote.price<=c.resources.treasury,'Insufficient treasury for required reserve service.');
    execute({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
    renewals.push({id,quote:structuredClone(quote)});expiry=contractExpiresSeconds(c.contracts[id]);
    if(stopped())return stopped();
   }
  }
  return null;
 };
 try{
  if(stopped())return finish(stopped());
  if(!plan){
   if(c.sectors[sector]?.owner!=='patriot'||!c.enemyGroups.some(g=>g.target===sector&&g.status==='marching')||!local().length)return finish(null);
   if(doctors().some(op=>c.operativeState[op.id].medkits>0))return finish(null);
   const recipient=doctors().find(op=>c.operativeState[op.id].medkits===0);
   if(!recipient)return finish('No healthy empty local physician for the reserve donation.');
   const recipientModel=sectorInventoryModel(c,sector,rosterFor(c),recipient.id);
   if(recipientModel.operativeId!==recipient.id||recipientModel.reason)return finish(recipientModel.reason??'The local physician has no current inventory admission.');
   try{applyItemQuantity(recipientModel.personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});}catch(error){return finish(error.message);}
   const admission=hiringArrivalReason(c,sector);if(admission)return finish(admission);
   const candidates=rosterFor(c).filter(op=>isContractOperative(c,op)&&civicStatus(c,op.id).available&&fit(op.id)&&op.medical>=60&&c.operativeState[op.id].medkits>=2)
    .map(op=>({op,quote:contractQuote(c,op,'week')})).filter(row=>row.quote.available&&!row.quote.permanent&&row.quote.price>0)
    .sort((a,b)=>a.quote.total-b.quote.total||b.op.medical-a.op.medical||a.op.id-b.op.id);
   const chosen=candidates.find(row=>row.quote.total<=c.resources.treasury);
   if(!chosen)return finish(candidates.length?'Insufficient treasury for paid reserve medicine.':'No available healthy supplied paid reserve physician.');
   const {op,quote}=chosen,arrival=immediateRecruitmentExpectation(c,op,'week',quote,sector);
   plan={id:op.id,recipientId:recipient.id,selectedSquadId:selected,hire:{quote:structuredClone(quote),arrival},donation:null,staging:null};
   execute({type:'recruitCivic',id:op.id,term:'week',destination:sector});
   assert.equal(orders.at(-1).cost,quote.total);
   if(stopped())return finish(stopped());
  }
  assert.ok(Number.isSafeInteger(plan.id)&&Number.isSafeInteger(plan.recipientId)&&plan.id!==plan.recipientId);
  for(let attempt=0;!c.recruited.includes(plan.id);attempt++){
   if(stopped())return finish(stopped());
   const queued=c.hiringArrivals.find(a=>a.operativeId===plan.id);assert.ok(queued&&queued.destination===sector,'The paid reserve needs its actual pending local arrival.');
   assert.deepEqual(queued.operativeId,plan.hire.arrival.operativeId);
   assert.ok(attempt<240&&hireArrivalDueSeconds(queued)-clock(c)<=168*3600,'The actual medic arrival must remain bounded.');
   const interruption=retain(clock(c)+3600);if(interruption)return finish(interruption);
   execute({type:'wait',hours:1});
  }
  if(stopped())return finish(stopped());
  assert.ok(local().includes(plan.id)&&fit(plan.id),'The relief physician must actually arrive healthy and free.');
  const medic=rosterFor(c).find(op=>op.id===plan.id);assert.ok(medic.medical>=60);
  if(!plan.donation){
   assert.ok(doctors().some(op=>op.id===plan.recipientId)&&c.operativeState[plan.recipientId].medkits===0,'Donate only to the actual empty local physician.');
   assert.ok(c.operativeState[plan.id].medkits>=2,'Keep one actual dressing on the relief physician.');
   const donor=sectorInventoryModel(c,sector,rosterFor(c),plan.id),recipient=sectorInventoryModel(c,sector,rosterFor(c),plan.recipientId);
   assert.equal(donor.operativeId,plan.id);assert.equal(donor.reason,null);assert.equal(recipient.operativeId,plan.recipientId);assert.equal(recipient.reason,null);
   applyItemQuantity(recipient.personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});
   const stock=c.operativeState[plan.id].medkits+c.operativeState[plan.recipientId].medkits,known=new Set(recipient.entries.map(row=>row.key));
   execute({type:'sectorInventory',sector,operativeId:plan.id,direction:'drop',item:'medkits',count:1});
   const dropped=sectorInventoryModel(c,sector,rosterFor(c),plan.recipientId).entries.find(row=>!known.has(row.key)&&JSON.parse(row.expected).item==='medkits');
   assert.ok(dropped,'The accepted Native drop must expose its actual finite source.');
   plan.donation={donor:plan.id,recipient:plan.recipientId,count:1,stock,sourceKey:dropped.key,completed:false};
   if(stopped())return finish(stopped());
  }
  if(!plan.donation.completed){
   const row=sectorInventoryModel(c,sector,rosterFor(c),plan.recipientId).entries.find(row=>row.key===plan.donation.sourceKey&&row.reachable&&JSON.parse(row.expected).item==='medkits');
   assert.ok(row,'The local physician needs a real public route to the donated dressing.');
   execute({type:'sectorInventory',sector,operativeId:plan.recipientId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   assert.equal(c.operativeState[plan.id].medkits+c.operativeState[plan.recipientId].medkits,plan.donation.stock);assert.ok(c.operativeState[plan.id].medkits>=1);
   plan.donation={...plan.donation,sourceKey:row.key,completed:true};
   if(stopped())return finish(stopped());
  }
  if(!plan.staging){
   // The whole visit is bounded to one real hour. Retain current duties before
   // entering: Native refuses strategic renewals while a visit is open.
   const interruption=retain(clock(c)+3600);if(interruption)return finish(interruption);
   const stagingDeadline=clock(c)+3600;
   const posts=local().filter(id=>id!==plan.id&&c.operativeState[id].residentPosition).map(id=>({id,position:structuredClone(c.operativeState[id].residentPosition)}));
   const roofs=posts.filter(row=>row.position.tacticalLevel>0);
   execute({type:'createSquad',ids:[plan.id],sector,name:'Sanitario del camino'});
   if(stopped())return finish(stopped());
   execute({type:'assignCare',operativeId:plan.id,assignment:'active'});
   if(stopped())return finish(stopped());
   execute({type:'visitSector'});battle=enterSector(c.pendingBattle,c.sectorStates[sector]);
   const initial=structuredClone(battle),unitId=String(plan.id),actor=()=>battle.units.find(u=>u.id===unitId),steps=[];
   const reachable=getReachable(battle,actor()).filter(point=>point.tacticalLevel>0&&!posts.some(row=>sameCell(row.position,point)));
   const points=reachable.map(point=>({...point,neighbors:roofs.filter(row=>sameSurface(row.position,point)&&Math.hypot(row.position.x-point.x,row.position.y-point.y)<=1.5).length})).sort((a,b)=>b.neighbors-a.neighbors||a.cost-b.cost||a.y-b.y||a.x-b.x);
   const destination=points[0];assert.ok(destination&&(!roofs.length||destination.neighbors>0),'The relief needs an actual vacant reachable roof post beside its local guard.');
   const act=action=>{
    // A standing forward walk takes at most five seconds per level step and
    // six per climb. This conservative quote cannot spend past paid service.
    const path=action.type==='move'?getReachable(battle,actor(),{stopAt:point=>sameCell(point,action)})[0]?.path:null;
    if(action.type==='move')assert.ok(path,'The actual staging step needs its current public path.');
    const seconds=path?path.length*6:6;assert.ok(clock(c)+seconds<=stagingDeadline,'The actual reserve visit must finish inside its retained hour.');
    battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
    const synced=syncBattleTime(c,battle);assert.equal(synced.error,null,synced.error);c=synced.campaign;battle=synced.battle;
    steps.push(action);orders.push({kind:'battle',action:structuredClone(action)});
    assert.equal(c.pendingEncounter,null,'A real encounter must stop reserve staging.');assert.equal(c.defeated,false);
    assert.equal(battle.mode,'exploration');assert.equal(battle.phase,'player');assert.equal(battle.status,'active');
    assert.ok(clock(c)<=stagingDeadline);
   };
   act({type:'movement',unitId,movement:'walk'});
   for(let step=0;!sameCell(actor(),destination)&&step<64;step++){
    const from=spacePoint(actor());act({type:'move',unitId,...spacePoint(destination)});assert.notDeepEqual(spacePoint(actor()),from);
   }
   assert.ok(sameCell(actor(),destination));act({type:'stance',unitId,stance:'crouched'});
   const returned=structuredClone(battle);execute({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});battle=null;
   plan.staging={initial,steps,returned,position:structuredClone(c.operativeState[plan.id].residentPosition)};
   for(const post of posts)assert.deepEqual(c.operativeState[post.id].residentPosition,post.position,'Every old paid resident post remains unchanged.');
   if(stopped())return finish(stopped());
  }
  execute({type:'assignCare',operativeId:plan.id,assignment:'rest'});
  if(stopped())return finish(stopped());
  if(c.activeSquadId!==selected)execute({type:'selectSquad',id:selected});
  if(stopped())return finish(stopped());
  assert.ok(c.operativeState[plan.id].medkits>=1);assert.equal(c.operativeState[plan.id].assignment,'rest');
  return finish(null);
 }catch(error){
  error.campaign=c;error.reservePreparation={orders,renewals,progress:plan,...(battle?{battle}: {})};
  throw error;
 }
}
