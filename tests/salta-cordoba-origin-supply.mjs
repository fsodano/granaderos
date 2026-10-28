import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../packages/game/campaign.js';
import {contractQuote,contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {hiringArrivalReason} from '../packages/game/hiring-arrivals.js';
import {operativeLocation,operativeInTransit,canReassignOperative} from '../packages/game/squads.js';
import {careAssignmentIssue} from '../packages/game/medical-care.js';
import {carriedAmmunition} from '../packages/game/campaign-ammunition.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../packages/game/tactical-inventory.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {TRANSPORT_NETWORKS} from '../packages/game/transport-network.js';
import {tooTiredToMarch} from '../packages/game/march-fatigue.js';
import {enterSector} from '../packages/game/world.js';
import {actBattle,getReachable,climbPreview,hasLineOfSight} from '../packages/game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../packages/game/tactical-space.js';
import {atHand} from '../packages/game/tactical-planning-space.js';
import {syncBattleTime} from '../packages/game/time.js';
import {publicRouteView} from './route-infantry-progress.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {clinicCareChange} from './salta-clinic-supply.mjs';

const source='cordoba',destination='tucuman',clock=c=>c.hour*3600+(c.secondOfHour??0);
const serving=(c,id)=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured&&c.contracts[id]&&(contractExpiresSeconds(c.contracts[id])===null||contractExpiresSeconds(c.contracts[id])>clock(c));
const fit=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&!r.routed&&!r.unconscious&&!r.surrendered&&!tooTiredToMarch(r);};

// The caller supplies its current joint rear/field offer plan. This helper pays
// one of those rear offers once, delivers owned linen first, then brings that
// actual hire back to its rear duty. It neither searches nor selects a force.
export function courierSaltaCordobaOriginDressings(start,{holderId,carrierId,requestedCount,paidOffers,fieldOffers,deadlineSeconds,resolveEncounter,report=()=>{}}={}){
 const before=structuredClone(start),selected=start.activeSquadId,groups=structuredClone(start.squads),oldIds=[...start.recruited],intended=oldIds.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),orders=[],renewals=[],journeys=[],visits=[],care=[],externalTransitions=[],capacityChecks=[],relayTransfers=[];
 const oldPosts=intended.filter(id=>start.operativeState[id].residentPosition).map(id=>({id,post:structuredClone(start.operativeState[id].residentPosition)})),oldDuties=new Map(intended.map(id=>[id,start.operativeState[id].assignment]));
 let campaign=start,battle=null,home=null,funding=null,hire=null,doctorId=null,pickup=null,delivery=null,relayPlan=null,sourcePost=null,visitUntil=null,remainingReserve=null;
 const parcel={item:'medkits',count:requestedCount,weight:SUPPLY_ITEMS.medkits.weight};
 const model=(id,at=operativeLocation(campaign,id))=>sectorInventoryModel(campaign,at,rosterFor(campaign),id);
 const check=()=>{
  assert.equal(campaign.defeated,false);assert.ok(clock(campaign)<=deadlineSeconds,'The Córdoba-origin delivery uses the same absolute clinical deadline.');
  if(remainingReserve!==null)assert.ok(campaign.resources.treasury>=remainingReserve,'Keep all unpaid rear/field costs and the original250.');
  for(const id of intended){assert.ok(serving(campaign,id),'Keep actual old service through the paid delivery.');assert.equal(operativeLocation(campaign,id),operativeLocation(start,id),'No original defender becomes the courier.');assert.equal(campaign.operativeState[id].assignment,oldDuties.get(id),'Keep every original clinical and rear duty.');}
  for(const {id,post}of oldPosts)assert.deepEqual(campaign.operativeState[id].residentPosition,post,'Keep every original physical post.');
  if(hire)assert.ok(serving(campaign,carrierId));
  for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 };
 const settle=()=>{
  if(!campaign.pendingEncounter)return;
  assert.equal(battle,null,'A real interruption stops the open delivery visit.');assert.equal(typeof resolveEncounter,'function','Resolve the actual delivery encounter before continuing.');
  const transition={beforeOrderIndex:orders.length,before:{campaign:structuredClone(campaign),battle:null},orderTape:null,scope:'External resolver orders are outside the courier tape.'};
  try{campaign=resolveEncounter(campaign,{deadlineSeconds});transition.after={campaign:structuredClone(campaign),battle:null};transition.completed=true;}
  catch(error){if(error?.campaign)campaign=error.campaign;if(error?.battle)battle=error.battle;transition.after={campaign:structuredClone(campaign),battle:campaign.pendingBattle?.id===battle?.battleId?structuredClone(battle):null};transition.completed=false;externalTransitions.push(transition);throw error;}
  externalTransitions.push(transition);check();assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 };
 const dispatch=action=>{
  const old=campaign;campaign=dispatchCampaign(campaign,action);const row={kind:'campaign',action:structuredClone(action),from:clock(old),to:clock(campaign),cost:old.resources.treasury-campaign.resources.treasury,accepted:campaign.lastError===null,lastError:campaign.lastError};orders.push(row);
  if(row.accepted&&action.type==='recruitCivic'&&action.id===carrierId){hire={id:carrierId,quote:funding.carrierQuote,debit:row.cost,atSeconds:clock(campaign)};assert.equal(hire.debit,hire.quote.total);}
  if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);check();
 };
 const retain=until=>{
  assert.ok(until<=deadlineSeconds);
  for(const id of [...intended,...(hire?[carrierId]:[])])for(let n=0;;n++){
   const expiry=contractExpiresSeconds(campaign.contracts[id]);if(expiry===null||expiry>until)break;assert.ok(n<4);
   const quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),contract=campaign.contracts[id];assert.equal(quote.available,true,quote.reason);
   dispatch({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});renewals.push({id,quote});assert.equal(campaign.pendingEncounter,null,'A real renewal interruption stops the delivery.');
  }
 };
 const order=action=>{
  settle();check();assert.equal(battle,null);const seconds=action.type==='wait'?action.hours*3600:0;assert.ok(clock(campaign)+seconds<=deadlineSeconds);
  retain(Math.min(deadlineSeconds,clock(campaign)+Math.max(3600,seconds+1)));dispatch(action);if(action.type!=='visitSector')settle();
 };
 const actor=()=>battle?.units.find(u=>u.id===String(carrierId));
 const capacity=(id,personal,stage)=>{
  try{applyItemQuantity(structuredClone(personal),parcel);capacityChecks.push({id,stage,available:true});return true;}
  catch(error){capacityChecks.push({id,stage,available:false,reason:error.message});throw error;}
 };
 const reservedAt=at=>oldPosts.filter(row=>operativeLocation(campaign,row.id)===at);
 const clearPath=(path,at)=>path.every(p=>!reservedAt(at).some(row=>sameCell(row.post,p)));
 // This graph contains only current own resident-post facts. No actor is
 // inserted into a battle or moved by the graph. Native inventory confirms
 // every physical drop/take later, from the same real default sector scene.
 const relayGraph=stage=>{
  const snapshot=campaign.sectorStates[destination],nodes=[];
  for(const op of rosterFor(campaign)){
   const id=op.id,r=campaign.operativeState[id],endpoint=id===doctorId;
   if(!serving(campaign,id)||operativeInTransit(campaign,id)||operativeLocation(campaign,id)!==destination||!fit(campaign,id)||!r.residentPosition||r.residentSector!==destination||(r.residentScene??null)!==null)continue;
   if(!endpoint&&(!canReassignOperative(campaign,id)||!['active','rest'].includes(r.assignment)||campaign.militiaTraining?.some(row=>row.trainerId===id)))continue;
   if(endpoint&&r.assignment!=='doctor')continue;
   const view=model(id,destination);assert.equal(view.operativeId,id);assert.equal(view.carriedReason,null,view.carriedReason);
   try{capacity(id,view.personal,stage);}catch(error){if(endpoint)throw error;continue;}
   nodes.push({id,post:structuredClone(r.residentPosition),ownDressings:r.medkits});
  }
  assert.ok(nodes.some(node=>node.id===doctorId),'The fixed current doctor needs capacity for the full real parcel.');
  const paths=new Map([[doctorId,[doctorId]]]),queue=[doctorId];
  while(queue.length){const toId=queue.shift(),to=nodes.find(node=>node.id===toId);assert.ok(to,'Every queued relay node must exist in the actual graph.');
   for(const from of nodes){if(paths.has(from.id)||!sameSurface(from.post,to.post)||!atHand(from.post,to.post)||!hasLineOfSight(snapshot,from.post,to.post))continue;paths.set(from.id,[from.id,...paths.get(to.id)]);queue.push(from.id);}}
  return {nodes,paths};
 };
 const beginVisit=()=>{
  assert.ok(clock(campaign)+3600<=deadlineSeconds);retain(clock(campaign)+3600);visitUntil=clock(campaign)+3600;order({type:'visitSector'});
  battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;visits.push({sector:campaign.location,initial:structuredClone(battle),actions:[],movementSteps:0});check();
 };
 const act=(action,seconds=6)=>{
  assert.ok(clock(campaign)+seconds<=visitUntil&&clock(campaign)+seconds<=deadlineSeconds);const old=campaign,row={kind:'battle',action:structuredClone(action),from:clock(old),to:clock(old),cost:0};
  battle=actBattle(battle,action);orders.push(row);visits.at(-1).actions.push(structuredClone(action));assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;row.to=clock(campaign);row.cost=old.resources.treasury-campaign.resources.treasury;if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));
  check();assert.ok(clock(campaign)<=visitUntil,'The actual synchronized visit remains within its retained hour.');assert.equal(campaign.pendingEncounter,null,'A real raid stops the actual visit.');assert.equal(battle.mode,'exploration');assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.ok(actor()?.hp>0&&!actor().departure&&!actor().routed&&!actor().unconscious);
 };
 const movementStep=(action,seconds=6)=>{assert.ok(visits.at(-1).movementSteps<128,'The actual visit shares one 128-step movement and climb budget.');visits.at(-1).movementSteps++;act(action,seconds);};
 const walkTo=(goal,{groundOnly=false}={})=>{
  if(actor().stance!=='standing'||actor().movementMode!=='walk')act({type:'movement',unitId:String(carrierId),movement:'walk'});
  while(!sameCell(actor(),goal)){
   const view=publicRouteView(battle,actor()),path=getReachable(view,actor(),{stopAt:p=>sameCell(p,goal)})[0]?.path;assert.ok(path?.length&&clearPath(path,campaign.location),'The actual delivery needs a current public path outside all old reserved posts.');const step=path[0],from=spacePoint(actor());
   if(groundOnly)assert.ok(path.every(point=>(point.tacticalLevel??0)===0),'The alternative access needs a current public ground-only path.');
   if(!sameSurface(actor(),step)){const quote=climbPreview(view,actor(),{linkId:step.linkId});assert.equal(quote.valid,true,quote.reason);movementStep({type:'climb',unitId:String(carrierId),linkId:step.linkId},quote.seconds);}else movementStep({type:'move',unitId:String(carrierId),...spacePoint(step)});
   assert.notDeepEqual(spacePoint(actor()),from);
  }assert.ok(sameCell(actor(),goal));
 };
 const approach=post=>{
  const view=publicRouteView(battle,actor()),reserved=reservedAt(campaign.location),goal=getReachable(view,actor()).filter(p=>atHand(p,post)&&hasLineOfSight(view,p,post)&&!reserved.some(row=>sameCell(row.post,p))&&clearPath(p.path,campaign.location)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  assert.ok(goal,'The arriving body must earn real access to the fixed holder or doctor.');walkTo(spacePoint(goal));assert.ok(atHand(actor(),post)&&hasLineOfSight(publicRouteView(battle,actor()),actor(),post));
 };
 const leave=()=>{
  const returned=structuredClone(battle);dispatch({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});battle=null;visits.at(-1).returned=returned;settle();
 };
 const transfer=(fromId,toId,at,reserve)=>{
  const donor=model(fromId,at),recipient=model(toId,at);assert.equal(donor.operativeId,fromId);assert.equal(donor.reason,null,donor.reason);assert.equal(recipient.operativeId,toId);assert.equal(recipient.reason,null,recipient.reason);applyItemQuantity(recipient.personal,parcel);
  assert.ok(campaign.operativeState[fromId].medkits>=requestedCount+reserve,'Forward only the received parcel and preserve the donor\'s own stock.');const fromPost=campaign.operativeState[fromId].residentPosition,toPost=campaign.operativeState[toId].residentPosition;assert.ok(sameSurface(fromPost,toPost)&&atHand(fromPost,toPost)&&hasLineOfSight(campaign.sectorStates[at],fromPost,toPost),'Every fixed-post edge needs actual Native adjacency and line of sight.');
  const counts=new Map(recipient.entries.filter(row=>JSON.parse(row.expected).item==='medkits').map(row=>[row.key,row.count])),fromBefore=campaign.operativeState[fromId].medkits,toBefore=campaign.operativeState[toId].medkits,rows=[],receipt={fromId,toId,sector:at,requestedCount,count:0,fromBefore,toBefore,rows,tapeStartIndex:orders.length,atSeconds:clock(campaign)};
  if(at===source)pickup=receipt;else{relayTransfers.push(receipt);if(toId===doctorId)delivery=receipt;}
  order({type:'sectorInventory',sector:at,operativeId:fromId,direction:'drop',item:'medkits',count:requestedCount});let remaining=requestedCount;
  while(remaining){const view=model(toId,at),row=view.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>(counts.get(row.key)??0));assert.ok(row,'Re-quote the actual dropped or merged parcel.');const count=Math.min(remaining,row.count-(counts.get(row.key)??0));applyItemQuantity(view.personal,{...JSON.parse(row.expected),count});order({type:'sectorInventory',sector:at,operativeId:toId,direction:'take',sourceKey:row.key,expected:row.expected,count});rows.push({sourceKey:row.key,expected:row.expected,count});remaining-=count;receipt.count+=count;receipt.atSeconds=clock(campaign);}
  assert.equal(campaign.operativeState[fromId].medkits,fromBefore-requestedCount);assert.equal(campaign.operativeState[toId].medkits,toBefore+requestedCount);return receipt;
 };
 const travel=at=>{
  const quote=previewStrategicRoute(campaign,home.id,at,'posta');assert.equal(quote.valid,true,quote.reason);assert.equal(quote.action.type,'travel');assert.ok(quote.hours>0&&quote.hours<=48);assert.ok(clock(campaign)+(quote.hours+1)*3600<=deadlineSeconds);
  const from=clock(campaign);order(quote.action);let zero=0;for(let n=0;campaign.squads.find(q=>q.id===home.id).journey&&n<64;n++){const previous=clock(campaign);order({type:'wait',hours:1});zero=clock(campaign)===previous?zero+1:0;assert.ok(zero<3);}
  assert.ok(!campaign.squads.find(q=>q.id===home.id).journey);assert.equal(operativeLocation(campaign,carrierId),at);journeys.push({quote,from,to:clock(campaign)});
 };
 try{
  assert.ok(Number.isSafeInteger(holderId)&&Number.isSafeInteger(carrierId)&&Number.isSafeInteger(requestedCount)&&requestedCount>0);assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(start));assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
  assert.equal(start.sectors[source]?.owner,'patriot');assert.equal(start.sectors[destination]?.owner,'patriot');assert.ok(serving(start,holderId)&&!operativeInTransit(start,holderId)&&operativeLocation(start,holderId)===source);assert.ok(start.operativeState[holderId].medkits>=requestedCount+1);assert.ok(start.operativeState[holderId].residentPosition);
  const held=model(holderId,source);assert.equal(held.operativeId,holderId);assert.equal(held.reason,null,held.reason);assert.equal(hiringArrivalReason(start,source),null);
  assert.ok(Array.isArray(paidOffers)&&paidOffers.length&&Array.isArray(fieldOffers)&&fieldOffers.length);const roster=rosterFor(start),ids=[...paidOffers,...fieldOffers].map(row=>row.op?.id??row.id);assert.equal(new Set(ids).size,ids.length,'Rear and later field offers must be distinct.');
  const quoteRows=(rows,term)=>rows.map(row=>{const op=roster.find(op=>op.id===(row.op?.id??row.id));assert.ok(op&&fit(start,op.id)&&civicStatus(start,op.id).available);assert.equal(0,0);const quote=contractQuote(start,op,term);assert.equal(quote.available,true,quote.reason);assert.equal(quote.permanent,false);assert.deepEqual(quote,row.quote,'Re-quote each current planned offer before spending.');return {op,quote};});
  const rear=quoteRows(paidOffers,'week'),field=quoteRows(fieldOffers,'day'),chosen=rear.find(row=>row.op.id===carrierId);assert.ok(chosen,'The actual carrier must be one current planned rear hire.');assert.ok(clock(start)+chosen.quote.hours*3600>deadlineSeconds,'The real paid rear week covers the shared deadline.');
  assert.ok(start.operativeState[carrierId].medkits>=1,'The known offered carrier must already own one dressing.');capacity(carrierId,carriedAmmunition(chosen.op,start.operativeState[carrierId]),'offered-carrier-before-booking');
  home=groups.find(q=>q.location===source&&!q.journey&&q.members.includes(holderId));assert.ok(home&&home.members.length<6);assert.equal(home.members.some(id=>operativeInTransit(start,id)),false);
  const doctors=roster.filter(op=>serving(start,op.id)&&operativeLocation(start,op.id)===destination&&!operativeInTransit(start,op.id)&&fit(start,op.id)&&start.operativeState[op.id].assignment==='doctor'&&[undefined,'no_medkits'].includes(careAssignmentIssue(start,op,'doctor')?.code)&&start.operativeState[op.id].residentPosition).sort((a,b)=>b.medical-a.medical||a.id-b.id);doctorId=doctors[0]?.id;assert.ok(doctorId!==undefined,'Start a real fit local doctor before any source journey.');relayGraph('current-clinic-before-booking');
  // Before booking, the real local holder supplies only the route geometry.
  // No unbooked actor is inserted into service. The actual new carrier must
  // re-quote each leg after its real hire, squad order and network purchase.
  assert.equal(start.operativeState[holderId].assignment,'active');
  const setupCost=start.routes.posta?0:TRANSPORT_NETWORKS.find(mode=>mode.id==='posta').cost,planned={...start,routes:{...start.routes,posta:true},squads:start.squads.map(q=>q.id===home.id?{...q,members:[holderId]}:{...q,members:[...q.members]})};
  const outward=previewStrategicRoute(planned,home.id,destination,'posta');assert.equal(outward.valid,true,outward.reason);const returnDraft={...planned,squads:planned.squads.map(q=>q.id===home.id?{...q,location:destination}:q)},returning=previewStrategicRoute(returnDraft,home.id,source,'posta');assert.equal(returning.valid,true,returning.reason);
  assert.ok(clock(start)+(outward.hours+returning.hours+3)*3600<=deadlineSeconds,'The two real legs and three retained visits must fit the same deadline.');
  const rearCost=rear.reduce((n,row)=>n+row.quote.total,0),fieldCost=field.reduce((n,row)=>n+row.quote.total,0),fieldReserve=250,travelFees=(outward.path.length+returning.path.length-2)*10;
  funding={...quoteMountainServiceBudget(start,{keepIds:intended,horizonSeconds:deadlineSeconds,fixedCost:rearCost+fieldCost+fieldReserve+setupCost+travelFees}),rearCost,fieldCost,fieldReserve,setupCost,travelFees,outward,returning,routeGeometryActorId:holderId,carrierQuote:chosen.quote};assert.equal(funding.available,true,funding.reason);remainingReserve=rearCost+fieldCost+fieldReserve;
  if(campaign.activeSquadId!==home.id)order({type:'selectSquad',id:home.id});
  // Account for this payment before the common guard; do not reserve the same
  // already-paid hire a second time. Native still owns the actual debit.
  remainingReserve-=chosen.quote.total;order({type:'recruitCivic',id:carrierId,term:'week',destination:source});assert.ok(hire);assert.equal(hire.debit,chosen.quote.total);
  assert.ok(serving(campaign,carrierId)&&fit(campaign,carrierId)&&canReassignOperative(campaign,carrierId)&&!operativeInTransit(campaign,carrierId)&&operativeLocation(campaign,carrierId)===source);assert.ok(campaign.operativeState[carrierId].medkits>=1,'Keep the new carrier\'s actual own dressing.');assert.ok(contractExpiresSeconds(campaign.contracts[carrierId])>deadlineSeconds);
  const actualCarrier=model(carrierId,source);assert.equal(actualCarrier.operativeId,carrierId);assert.equal(actualCarrier.carriedReason,null,actualCarrier.carriedReason);capacity(carrierId,actualCarrier.personal,'actual-hire-before-visit');relayGraph('current-clinic-after-booking');
  order({type:'squad',ids:[carrierId]});if(campaign.operativeState[carrierId].assignment!=='active')order({type:'assignCare',operativeId:carrierId,assignment:'active'});if(setupCost)order({type:'transport',mode:'posta'});
  beginVisit();approach(start.operativeState[holderId].residentPosition);sourcePost=spacePoint(actor());leave();transfer(holderId,carrierId,source,1);
  travel(destination);let graph=relayGraph('actual-arrival-before-handoff');beginVisit();
  const contacts=(view,quoted)=>{const reachable=quoted.filter(point=>clearPath(point.path,destination)&&!reservedAt(destination).some(row=>sameCell(row.post,point))),choices=[];
   for(const node of graph.nodes){const path=graph.paths.get(node.id);if(!path)continue;for(const point of reachable)if(sameSurface(point,node.post)&&atHand(point,node.post)&&hasLineOfSight(view,point,node.post))choices.push({node,path,point});}
   return choices.sort((a,b)=>a.point.cost-b.point.cost||a.path.length-b.path.length||a.node.id-b.node.id||a.point.y-b.point.y||a.point.x-b.point.x);
  };
  let view=publicRouteView(battle,actor()),quoted=getReachable(view,actor()),choices=contacts(view,quoted);
  const contactReceipt={initialContactCount:choices.length,initialReachable:quoted.map(point=>({point:spacePoint(point),cost:point.cost,crossesOldPost:!clearPath(point.path,destination)})),approach:null,finalContactCount:choices.length};visits.at(-1).relayContact=contactReceipt;
  if(!choices.length&&(actor().tacticalLevel??0)===0){
   // A global shortest path can cross an old saved post. Pay one existing
   // alternative access, then ask Native again from the actual roof arrival.
   const access=(view.climbLinks??[]).filter(link=>(link.from.tacticalLevel??0)===0&&link.to.tacticalLevel>0&&!reservedAt(destination).some(row=>sameCell(row.post,link.to))).map(link=>({link,route:quoted.find(point=>sameCell(point,link.from)),landing:quoted.find(point=>sameCell(point,link.to))})).filter(row=>row.route&&row.landing&&row.route.path.every(point=>(point.tacticalLevel??0)===0)&&clearPath(row.route.path,destination)).sort((a,b)=>a.route.cost-b.route.cost||String(a.link.id).localeCompare(String(b.link.id)))[0];
   if(access){
    const approach=contactReceipt.approach={link:structuredClone(access.link),groundQuote:structuredClone(access.route),arrivedAt:null,climbQuote:null,completed:false};walkTo(access.link.from,{groundOnly:true});approach.arrivedAt=spacePoint(actor());
    const quote=climbPreview(publicRouteView(battle,actor()),actor(),{linkId:access.link.id});approach.climbQuote=structuredClone(quote);assert.ok(quote.valid&&sameCell(quote.destination,access.link.to),'The actual alternative arrival needs its fresh Native climb quote.');movementStep({type:'climb',unitId:String(carrierId),linkId:access.link.id},quote.seconds);assert.ok(sameCell(actor(),access.link.to));approach.completed=true;
    view=publicRouteView(battle,actor());quoted=getReachable(view,actor());choices=contacts(view,quoted);contactReceipt.finalContactCount=choices.length;
   }
  }
  const chosenRelay=choices[0];assert.ok(chosenRelay,'The real arriving carrier needs an actual public contact to the fixed-post relay.');
  walkTo(spacePoint(chosenRelay.point));relayPlan={ids:[carrierId,...chosenRelay.path],posts:chosenRelay.path.map(id=>graph.nodes.find(node=>node.id===id)),contact:spacePoint(actor())};leave();
  graph=relayGraph('actual-returned-before-handoff');const fixed=chosenRelay.path.map(id=>graph.nodes.find(node=>node.id===id));
  assert.ok(fixed.every(Boolean)&&fixed.every((node,i)=>!i||sameSurface(fixed[i-1].post,node.post)&&atHand(fixed[i-1].post,node.post)&&hasLineOfSight(campaign.sectorStates[destination],fixed[i-1].post,node.post)),'The chosen fixed-post chain must remain admitted after the actual visit.');relayPlan.posts=fixed;
  const carrierOwn=campaign.operativeState[carrierId].medkits-requestedCount;assert.ok(carrierOwn>=1);
  for(let i=0;i<chosenRelay.path.length;i++){const fromId=i?chosenRelay.path[i-1]:carrierId,toId=chosenRelay.path[i],reserve=i?graph.nodes.find(node=>node.id===fromId).ownDressings:carrierOwn;transfer(fromId,toId,destination,reserve);assert.equal(campaign.operativeState[fromId].medkits,reserve,'Each relay body retains its actual own stock after forwarding only the received parcel.');}
  delivery.clinicStockBeforeDelivery=delivery.toBefore;delivery.clinicStockAfterDelivery=campaign.operativeState[doctorId].medkits;
  travel(source);beginVisit();walkTo(sourcePost);leave();order({type:'squad',ids:[...home.members,carrierId]});if(campaign.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  const expected=groups.map(q=>q.id===home.id?{...q,members:[...q.members,carrierId]}:q);assert.deepEqual(campaign.squads,expected,'Old homes are preserved; only the genuine new rear hire is added to its actual home.');check();assert.deepEqual(start,before);
  const receipt={holderId,carrierId,doctorId,requestedCount,deliveredCount:delivery.count,remainingCarrierDressings:campaign.operativeState[carrierId].medkits,hire,funding,remainingReserve,pickup,delivery,relayPlan,relayTransfers,capacityChecks,sourcePost,orders,renewals,journeys,visits,care,externalTransitions,startSeconds:clock(start),endSeconds:clock(campaign),deadlineSeconds,restored:true};report({event:'saltaCordobaOriginSupply',receipt});return {campaign,receipt};
 }catch(error){
  if(error?.campaign)campaign=error.campaign;if(error?.battle)battle=error.battle;
  for(const receipt of [pickup,...relayTransfers].filter(Boolean)){const takes=orders.slice(receipt.tapeStartIndex).filter(row=>row.accepted&&row.action.type==='sectorInventory'&&row.action.sector===receipt.sector&&row.action.operativeId===receipt.toId&&row.action.direction==='take');receipt.count=takes.reduce((n,row)=>n+row.action.count,0);if(takes.length)receipt.atSeconds=takes.at(-1).to;}
  const actualBattle=campaign.pendingBattle?.id===battle?.battleId?battle:null,receipt={holderId,carrierId,doctorId,requestedCount,deliveredCount:delivery?.count??0,remainingCarrierDressings:campaign.operativeState[carrierId]?.medkits??null,hire,funding,remainingReserve,pickup,delivery,relayPlan,relayTransfers,capacityChecks,sourcePost,orders,renewals,journeys,visits,care,externalTransitions,startSeconds:clock(start),endSeconds:clock(campaign),deadlineSeconds,restored:false};
  if(error&&typeof error==='object'){error.campaign=campaign;error.battle=actualBattle;error.saltaCordobaOriginSupply=receipt;}throw error;
 }
}
