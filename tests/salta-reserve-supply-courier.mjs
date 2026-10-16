import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {operativeLocation,operativeInTransit,canReassignOperative} from '../game/squads.js';
import {careAssignmentIssue} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';
import {tooTiredToMarch} from '../game/march-fatigue.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable,climbPreview,hasLineOfSight,lookPreview} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {atHand} from '../game/tactical-planning-space.js';
import {directionTo} from '../game/tactical-awareness.js';
import {syncBattleTime} from '../game/time.js';
import {publicRouteView} from './route-infantry-progress.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {clinicCareChange} from './salta-clinic-supply.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0),source='cordoba',destination='tucuman';
const serving=(c,id)=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured&&c.contracts[id]&&(contractExpiresSeconds(c.contracts[id])===null||contractExpiresSeconds(c.contracts[id])>clock(c));

// This carries an already collected parcel. It does not search, hire, credit
// remote stock to the clinic, or change the caller's clinical deadline.
export function courierSaltaReserveDressings(start,{holderId,requestedCount,deadlineSeconds,reservedPesos=0,resolveEncounter,report=()=>{}}={}){
 const before=structuredClone(start),selected=start.activeSquadId,groups=structuredClone(start.squads),orders=[],renewals=[],journeys=[],visits=[],care=[],encounters=[],externalTransitions=[];
 let campaign=start,battle=null,carrierId=null,visitUntil=null,home=null,courier=null,oldAssignment=null,oldPost=null,holderPost=null,funding=null,savedCarrierCondition={};
 const intended=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),posts=intended.filter(id=>start.operativeState[id].residentPosition).map(id=>({id,position:structuredClone(start.operativeState[id].residentPosition)}));
 const model=(id,at=operativeLocation(campaign,id))=>sectorInventoryModel(campaign,at,rosterFor(campaign),id);
 const parcel={item:'medkits',count:requestedCount,weight:SUPPLY_ITEMS.medkits.weight};
 const check=()=>{
  assert.equal(campaign.defeated,false);assert.ok(clock(campaign)<=deadlineSeconds,'The courier uses the original absolute clinical deadline.');assert.ok(campaign.resources.treasury>=reservedPesos,'The actual courier must retain the caller\'s known cash reserve.');
  assert.ok(intended.every(id=>serving(campaign,id)),'Every intended survivor must remain alive, free and in actual paid service.');
  assert.equal(operativeLocation(campaign,holderId),source,'The actual Córdoba holder must stay at the depot.');
  if(holderPost)assert.deepEqual(campaign.operativeState[holderId].residentPosition,holderPost,'The holder keeps its actual post.');
  for(const row of posts)if(row.id!==carrierId)assert.deepEqual(campaign.operativeState[row.id].residentPosition,row.position,'The courier preserves every other actual post.');
  for(const id of intended)if(id!==carrierId)assert.equal(campaign.operativeState[id].assignment,start.operativeState[id].assignment,'Only the courier changes its assigned duty.');
  for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 };
 const settle=()=>{
  if(!campaign.pendingEncounter)return;
  assert.equal(battle,null,'A real interruption stops the open courier visit.');
  assert.equal(typeof resolveEncounter,'function','Resolve the actual courier encounter before continuing.');
  const pending=structuredClone(campaign.pendingEncounter),transition={beforeOrderIndex:orders.length,before:{campaign:structuredClone(campaign),battle:null},orderTape:null,scope:'External resolver orders are outside the courier order tape.'};
  try{campaign=resolveEncounter(campaign,{deadlineSeconds});transition.after={campaign:structuredClone(campaign),battle:null};transition.completed=true;}
  catch(error){if(error?.campaign)campaign=error.campaign;if(error?.battle)battle=error.battle;transition.after={campaign:structuredClone(campaign),battle:campaign.pendingBattle?.id===battle?.battleId?structuredClone(battle):null};transition.completed=false;externalTransitions.push(transition);throw error;}
  externalTransitions.push(transition);encounters.push(pending);check();
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 };
 const dispatch=action=>{
  const old=campaign,cash=old.resources.treasury;campaign=dispatchCampaign(old,action);
  orders.push({kind:'campaign',action:structuredClone(action),from:clock(old),to:clock(campaign),cost:cash-campaign.resources.treasury});
  if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));
  assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);check();
 };
 const retain=until=>{
  check();assert.ok(until<=deadlineSeconds,'The next retained courier step must fit the original deadline.');
  for(const id of intended){let expiry=contractExpiresSeconds(campaign.contracts[id]);for(let n=0;expiry!==null&&expiry<=until;n++){
   assert.ok(n<4);const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);
   dispatch({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});renewals.push({id,quote});
   assert.ok(!campaign.pendingEncounter,'A real renewal interruption stops the courier.');expiry=contractExpiresSeconds(campaign.contracts[id]);
  }}
 };
 const order=action=>{
  settle();check();assert.equal(battle,null);
  const seconds=action.type==='wait'?action.hours*3600:0;assert.ok(clock(campaign)+seconds<=deadlineSeconds);
  retain(Math.min(deadlineSeconds,clock(campaign)+Math.max(3600,seconds+1)));dispatch(action);
  if(action.type!=='visitSector')settle();
 };
 const beginVisit=()=>{
  assert.ok(clock(campaign)+3600<=deadlineSeconds,'The courier needs its bounded real visit within the same deadline.');
  retain(clock(campaign)+3600);visitUntil=clock(campaign)+3600;order({type:'visitSector'});
  battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
  const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;
  visits.push({sector:campaign.location,initial:structuredClone(battle),actions:[]});check();
 };
 const actor=()=>battle.units.find(unit=>unit.id===String(carrierId));
 const act=(action,seconds=6)=>{
  check();assert.ok(clock(campaign)+seconds<=visitUntil&&clock(campaign)+seconds<=deadlineSeconds,'The paid courier step exceeds its retained visit bound.');
  const old=campaign,row={kind:'battle',action:structuredClone(action),from:clock(old),to:clock(old),cost:0};verifyCarrier();battle=actBattle(battle,action);orders.push(row);visits.at(-1).actions.push(structuredClone(action));assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;row.to=clock(campaign);row.cost=old.resources.treasury-campaign.resources.treasury;if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));check();
  assert.equal(campaign.pendingEncounter,null,'A real raid stops the paid courier visit.');assert.ok(campaign.pendingBattle);assert.equal(battle.mode,'exploration');assert.equal(battle.status,'active');assert.equal(battle.phase,'player');
 };
 const verifyCarrier=()=>{const unit=actor();assert.ok(unit&&unit.hp>0&&!unit.departure&&!unit.routed&&!unit.unconscious&&!unit.asleep,'The actual courier must remain capable.');};
 const walkTo=goal=>{
  verifyCarrier();if(actor().movementMode!=='walk'||actor().stance!=='standing')act({type:'movement',unitId:String(carrierId),movement:'walk'});
  for(let n=0;!sameCell(actor(),goal)&&n<128;n++){
   const view=publicRouteView(battle,actor()),path=getReachable(view,actor(),{stopAt:point=>sameCell(point,goal)})[0]?.path;assert.ok(path?.length,'The actual courier needs a payable path to its destination.');
   const step=path[0],previous=spacePoint(actor());
   if(!sameSurface(actor(),step)){const quote=climbPreview(view,actor(),{linkId:step.linkId});assert.equal(quote.valid,true,quote.reason);act({type:'climb',unitId:String(carrierId),linkId:step.linkId},quote.seconds);}
   else act({type:'move',unitId:String(carrierId),...spacePoint(step)});
   assert.notDeepEqual(spacePoint(actor()),previous,'Every paid courier step makes actual progress.');
  }
  assert.ok(sameCell(actor(),goal),'The bounded courier path must actually finish.');
 };
 const leave=()=>{
  const returned=structuredClone(battle),action={type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')};
  dispatch(action);battle=null;visits.at(-1).returned=returned;settle();
 };
 const travel=at=>{
  if(campaign.activeSquadId!==courier.id)order({type:'selectSquad',id:courier.id});
  const quote=previewStrategicRoute(campaign,courier.id,at,'posta');assert.equal(quote.valid,true,quote.reason);assert.equal(quote.action.type,'travel');assert.ok(quote.hours>0&&quote.hours<=48);
  assert.ok(clock(campaign)+quote.hours*3600+3600<=deadlineSeconds,'The current journey and final visit must fit the original deadline.');
  const from=clock(campaign);order(quote.action);let zero=0;
  for(let n=0;campaign.squads.find(q=>q.id===courier.id).journey&&n<64;n++){
   const previous=clock(campaign);order({type:'wait',hours:1});zero=clock(campaign)===previous?zero+1:0;assert.ok(zero<3,'Repeated zero-time notices stop the courier.');
  }
  assert.ok(!campaign.squads.find(q=>q.id===courier.id).journey);assert.equal(operativeLocation(campaign,carrierId),at);journeys.push({quote,from,to:clock(campaign)});
 };
 try{
  assert.ok(Number.isSafeInteger(holderId)&&Number.isSafeInteger(requestedCount)&&requestedCount>0&&requestedCount<=1000);assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(start));assert.ok(Number.isSafeInteger(reservedPesos)&&reservedPesos>=0);
  assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);assert.ok(serving(start,holderId)&&!operativeInTransit(start,holderId)&&operativeLocation(start,holderId)===source);
  assert.equal(start.sectors[source]?.owner,'patriot');assert.equal(start.sectors[destination]?.owner,'patriot');assert.ok(start.operativeState[holderId].medkits>=requestedCount+1,'The holder needs the complete admitted parcel and its own reserve.');
  const held=model(holderId,source);assert.equal(held.operativeId,holderId);assert.equal(held.reason,null,held.reason);holderPost=structuredClone(start.operativeState[holderId].residentPosition);assert.ok(holderPost,'The stock holder needs an actual stationary depot post.');
  const candidates=rosterFor(start).filter(op=>{
   const r=start.operativeState[op.id];if(!serving(start,op.id)||operativeLocation(start,op.id)!==destination||operativeInTransit(start,op.id)||!canReassignOperative(start,op.id)||r.hp!==r.maxHp||r.bleeding||r.asleep||r.routed||r.unconscious||r.surrendered||tooTiredToMarch(r)||!['active','rest'].includes(r.assignment)||!r.residentPosition||r.residentPosition.tacticalLevel<=0||start.militiaTraining?.some(row=>row.trainerId===op.id))return false;
   const quote=model(op.id,destination);if(quote.operativeId!==op.id||quote.reason)return false;try{applyItemQuantity(quote.personal,parcel);return true;}catch{return false;}
  }).sort((a,b)=>start.operativeState[b.id].energy-start.operativeState[a.id].energy||b.strength-a.strength||a.id-b.id);
  const carrier=candidates[0];assert.ok(carrier,'An actual fit nonclinical roof carrier needs room for the full parcel.');carrierId=carrier.id;home=groups.find(q=>q.members.includes(carrierId)&&!q.journey);courier=groups.find(q=>q.location===destination&&!q.journey&&!q.members.length);assert.ok(home&&courier,'Reuse a real empty local group; do not create a ninth squad.');
  oldAssignment=start.operativeState[carrierId].assignment;oldPost=structuredClone(start.operativeState[carrierId].residentPosition);
  const oldBody=start.sectorStates[destination]?.units.find(unit=>unit.id===String(carrierId)&&unit.side==='player'&&unit.hp>0&&!unit.departure),record=start.operativeState[carrierId];
  for(const key of ['stance','movementMode','activeSlot','activeTool','activeSupply','activeItem','facing','stealthMode'])if((record[key]??oldBody?.[key])!==undefined)savedCarrierCondition[key]=structuredClone(record[key]??oldBody[key]);
  const setupCost=start.routes.posta?0:TRANSPORT_NETWORKS.find(mode=>mode.id==='posta').cost;
  // Preview only the intended zero-time squad/active orders and the paid
  // network. These small route drafts are never adopted as campaign state.
  const planned={...start,routes:{...start.routes,posta:true},operativeState:{...start.operativeState,[carrierId]:{...start.operativeState[carrierId],assignment:'active'}},squads:start.squads.map(q=>q.id===courier.id?{...q,members:[carrierId]}:{...q,members:q.members.filter(id=>id!==carrierId)})};
  const outward=previewStrategicRoute(planned,courier.id,source,'posta');assert.equal(outward.valid,true,outward.reason);
  const returnPlan={...planned,squads:planned.squads.map(q=>q.id===courier.id?{...q,location:source}:q)},returning=previewStrategicRoute(returnPlan,courier.id,destination,'posta');assert.equal(returning.valid,true,returning.reason);
  const routeHours=outward.hours+returning.hours,travelFees=(outward.path.length+returning.path.length-2)*10;
  assert.ok(clock(start)+(routeHours+2)*3600<=deadlineSeconds,'The ordinary roundtrip and two bounded visits must fit the existing deadline.');
  funding={...quoteMountainServiceBudget(start,{keepIds:intended,horizonSeconds:deadlineSeconds,fixedCost:setupCost+travelFees+reservedPesos}),reservedPesos,setupCost,travelFees,outward,returning};assert.equal(funding.available,true,funding.reason);
  order({type:'selectSquad',id:courier.id});order({type:'squad',ids:[carrierId]});if(oldAssignment!=='active')order({type:'assignCare',operativeId:carrierId,assignment:'active'});if(setupCost)order({type:'transport',mode:'posta'});
  travel(source);
  // Reach a real adjacent post before dropping the parcel. This also covers a
  // roof holder without moving that sole defender or editing its coordinates.
  beginVisit();verifyCarrier();const view=publicRouteView(battle,actor()),reserved=posts.filter(row=>row.id!==carrierId&&operativeLocation(campaign,row.id)===source),goal=getReachable(view,actor()).filter(point=>atHand(point,holderPost)&&hasLineOfSight(view,point,holderPost)&&!reserved.some(row=>sameCell(row.position,point))).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(goal,'The arriving courier needs actual public access to the fixed stock holder.');walkTo(spacePoint(goal));leave();
  const donor=model(holderId,source),recipient=model(carrierId,source);assert.equal(donor.operativeId,holderId);assert.equal(donor.reason,null,donor.reason);assert.equal(recipient.operativeId,carrierId);assert.equal(recipient.reason,null,recipient.reason);applyItemQuantity(recipient.personal,parcel);
  assert.ok(atHand(campaign.operativeState[carrierId].residentPosition,holderPost),'The parcel is dropped only after the carrier earns physical access.');assert.ok(campaign.operativeState[holderId].medkits>=requestedCount+1);
  const pool=new Map(recipient.entries.filter(row=>JSON.parse(row.expected).item==='medkits').map(row=>[row.key,row.count]));const holderBefore=campaign.operativeState[holderId].medkits,carriedBefore=campaign.operativeState[carrierId].medkits;
  order({type:'sectorInventory',sector:source,operativeId:holderId,direction:'drop',item:'medkits',count:requestedCount});
  let remaining=requestedCount;const transfers=[];
  while(remaining){const current=model(carrierId,source),row=current.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>(pool.get(row.key)??0));assert.ok(row,'Re-quote the actual new or merged finite parcel.');const count=Math.min(remaining,row.count-(pool.get(row.key)??0));applyItemQuantity(current.personal,{...JSON.parse(row.expected),count});order({type:'sectorInventory',sector:source,operativeId:carrierId,direction:'take',sourceKey:row.key,expected:row.expected,count});transfers.push({sourceKey:row.key,expected:row.expected,count});remaining-=count;}
  assert.equal(campaign.operativeState[holderId].medkits,holderBefore-requestedCount);assert.ok(campaign.operativeState[holderId].medkits>=1);assert.equal(campaign.operativeState[carrierId].medkits,carriedBefore+requestedCount);
  travel(destination);beginVisit();walkTo(oldPost);
  if(savedCarrierCondition.activeSlot!==undefined&&['activeSlot','activeTool','activeSupply','activeItem'].some(key=>actor()[key]!==savedCarrierCondition[key]))act({type:'weapon',unitId:String(carrierId),slot:savedCarrierCondition.activeSlot,...(savedCarrierCondition.activeTool!==undefined?{toolKey:savedCarrierCondition.activeTool}:{}),...(savedCarrierCondition.activeSupply!==undefined?{supplyKey:savedCarrierCondition.activeSupply}:{}),...(savedCarrierCondition.activeItem!==undefined?{item:savedCarrierCondition.activeItem}:{})});
  if(savedCarrierCondition.movementMode!==undefined&&actor().movementMode!==savedCarrierCondition.movementMode)act({type:'movement',unitId:String(carrierId),movement:savedCarrierCondition.movementMode});
  if(savedCarrierCondition.stance!==undefined&&actor().stance!==savedCarrierCondition.stance)act({type:'stance',unitId:String(carrierId),stance:savedCarrierCondition.stance});
  if(savedCarrierCondition.facing!==undefined&&actor().facing!==savedCarrierCondition.facing){const view=publicRouteView(battle,actor()),point=[...(view.upperSurfaces??[]),...view.tiles].find(point=>sameSurface(actor(),point)&&!sameCell(actor(),point)&&directionTo(actor(),point)===savedCarrierCondition.facing&&lookPreview(view,actor(),point).valid);assert.ok(point,'The courier needs an actual Native look to restore its recorded facing.');act({type:'look',unitId:String(carrierId),...spacePoint(point)});}
  if(savedCarrierCondition.stealthMode!==undefined&&actor().stealthMode!==savedCarrierCondition.stealthMode)act({type:'stealth',unitId:String(carrierId),enabled:savedCarrierCondition.stealthMode},0);
  for(const [key,value]of Object.entries(savedCarrierCondition))assert.deepEqual(actor()[key],value,'Restore the actual recorded carrier '+key+' through Native orders.');leave();
  order({type:'assignToSquad',operativeId:carrierId,squadId:home.id});order({type:'selectSquad',id:home.id});order({type:'squad',ids:home.members});if(oldAssignment!=='active'){assert.equal(careAssignmentIssue(campaign,rosterFor(campaign).find(op=>op.id===carrierId),oldAssignment),null);order({type:'assignCare',operativeId:carrierId,assignment:oldAssignment});}if(campaign.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  assert.deepEqual(campaign.squads,groups);assert.deepEqual(campaign.operativeState[carrierId].residentPosition,oldPost);assert.equal(campaign.operativeState[carrierId].medkits,carriedBefore+requestedCount);check();assert.deepEqual(start,before);
  const receipt={holderId,carrierId,requestedCount,deadlineSeconds,reservedPesos,savedCarrierCondition,startSeconds:clock(start),endSeconds:clock(campaign),setupCost,funding,orders,renewals,journeys,visits,care,encounters,externalTransitions,transfers,restored:true};report({event:'saltaReserveSupplyCourier',receipt});return {campaign,receipt};
 }catch(error){
  if(error?.campaign)campaign=error.campaign;if(error?.battle)battle=error.battle;
  const actualBattle=campaign.pendingBattle?.id===battle?.battleId?battle:null,receipt={holderId,carrierId,requestedCount,deadlineSeconds,reservedPesos,startSeconds:clock(start),endSeconds:clock(campaign),funding,orders,renewals,journeys,visits,care,encounters,externalTransitions,restored:false,...(battle?{lastBattle:battle}:{})};
  if(error&&typeof error==='object'){error.campaign=campaign;error.battle=actualBattle;error.saltaReserveSupplyCourier=receipt;}throw error;
 }
}
