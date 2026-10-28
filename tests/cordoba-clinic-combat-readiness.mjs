import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../packages/game/campaign.js';
import {canReassignOperative,operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {contractQuote,contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {hiringArrivalReason} from '../packages/game/hiring-arrivals.js';
import {immediateRecruitmentExpectation} from './immediate-recruitment-fixture.mjs';
import {careRules} from '../packages/game/campaign-care-rules.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {WEAPONS} from '../packages/game/data.js';
import {artilleryProfile} from '../packages/game/artillery-definitions.js';
import {enterSector} from '../packages/game/world.js';
import {actBattle,getReachable,climbPreview,artilleryContact,artilleryCrewPlan,lookPreview,environmentPreview} from '../packages/game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../packages/game/tactical-space.js';
import {wallEdgeCells,wallEdgeId} from '../packages/game/wall-geometry.js';
import {chooseArtilleryAction} from '../packages/game/tactical-ai-artillery.js';
import {syncBattleTime} from '../packages/game/time.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {assertRouteEquipmentDebit} from './route-equipment-inventory-receipt.mjs';
import {attemptCollectRouteItems,knownRouteMedicalSources,authoredRouteMedicalDiscoveries,collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import {publicRouteView} from './route-infantry-progress.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0),clinical=r=>['doctor','patient','militia_doctor','militia_patient'].includes(r.assignment);
const local=(c,id)=>canReassignOperative(c,id)&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&!c.contracts[id]?.departurePending;
const fit=(c,id)=>{const r=c.operativeState[id];return local(c,id)&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&!r.routed&&!r.surrendered;};
const guns=c=>(c.sectorStates[sector]?.artillery??[]).filter(g=>g.side==='player'&&(g.loaded||g.ammo>0)&&(g.tacticalLevel??0)===0);
const post=(c,id)=>{const r=c.operativeState[id];return r.residentSector===sector&&(r.residentScene??null)===null?r.residentPosition:null;};
const near=(a,b)=>a&&b&&sameSurface(a,b)&&!sameCell(a,b)&&Math.hypot(a.x-b.x,a.y-b.y)<=1.5;

// Only this caller opts in. Other route donation policies keep their existing
// rules. A prescribed rear physician retains one actual carried dressing.
export const cordobaClinicDonationCount=(c,id,reserveId,requested=4)=>Math.min(requested,Math.max(0,c.operativeState[id].medkits-(id===reserveId?1:0)));

// An ordinary local discovery can succeed without finding linen. Retain that
// accepted prefix explicitly; do not catch a collector assertion and resume an
// older clock. Remote collection starts only from current public finite stock
// or a still-undiscovered authored cache. Any Native refusal is terminal.
export function collectCordobaClinicDressings(start,id,requested,{finalizeGroundCrew,...options}={}){
 let c=start;
 try{
  const localResult=attemptCollectRouteItems(c,id,{item:'medkits'},requested);c=localResult.campaign;
  assert.equal(c.pendingEncounter,null,'Resolve the actual local discovery encounter before another supply query.');assert.equal(c.pendingBattle,null);
  // A completed local discovery can replace the latest scene with another
  // home. Re-earn current crew contact before any courier wait, never after
  // an interruption or by treating saved nearby coordinates as occupancy.
  if(finalizeGroundCrew){assert.equal(typeof finalizeGroundCrew,'function');c=finalizeGroundCrew(c);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);}
  if(localResult.supplied)return {...localResult,campaign:c,source:'local'};
  const known=knownRouteMedicalSources(c,sector),discoveries=known.length?[]:authoredRouteMedicalDiscoveries(c,sector);
  if(!known.length&&!discoveries.length)return {campaign:c,collected:0,supplied:false,source:null};
  const result=collectRouteMedicalSupplies(c,id,requested,options);c=result.campaign;assert.ok(result.collected>0);return {...result,supplied:true,source:'courier'};
 }catch(error){if(error&&typeof error==='object')error.campaign??=c;throw error;}
}

// Existing complete ground crews retain their earned posts when the recovery
// caller restages other survivors. This does not create a crew or move a gun.
export function cordobaClinicGroundCrew(c){
 const roster=rosterFor(c),assigned=new Set();
 for(const gun of guns(c)){
  const members=roster.filter(op=>!assigned.has(op.id)&&fit(c,op.id)&&op.medical<60&&!clinical(c.operativeState[op.id])&&near(post(c,op.id),gun))
   .sort((a,b)=>a.id-b.id).slice(0,artilleryProfile(c,gun).crew);
  if(members.length===artilleryProfile(c,gun).crew)for(const op of members)assigned.add(op.id);
 }
 return [...assigned];
}

// Actual nearby nonclinical people operate the actual finite gun. Native
// artillery selection keeps its current crew/AP, sight and friendly-fire rules.
// Everyone else retains the existing clinic roof policy.
export function cordobaClinicDefenseOrder(battle,unit){
 const view=publicRouteView(battle,unit),targets=view.units.filter(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.fled);
 if(unit.side==='player'&&unit.medical<60&&!clinical(unit)&&!unit.routed&&!unit.unconscious&&!unit.surrendered){
  const action=chooseArtilleryAction(view,unit,targets);
  if(action){
   const gun=action.artilleryId&&view.artillery.find(g=>g.id===action.artilleryId),plan=gun&&artilleryCrewPlan(view,unit,gun,1,true);
   if(!gun||plan&&!plan.reason&&plan.crew.every(id=>{const member=view.units.find(other=>other.id===id);return member.medical<60&&!clinical(member);}))return action;
  }
  const crew=view.artillery.some(g=>g.side===unit.side&&(g.loaded||g.ammo>0)&&artilleryContact(view,unit,g)&&!artilleryCrewPlan(view,unit,g,1,true).reason);
  if(crew&&!targets.some(other=>sameSurface(unit,other)&&Math.hypot(unit.x-other.x,unit.y-other.y)<=2.5))return null;
 }
 return northernClinicDefenseOrder(battle,unit);
}

// Re-evaluate this real rear before each care interval or outward supply trip.
// One carried dressing is reserved on a second fit physician. A shortage is an
// explicit result for the existing courier policy, never a stock refill.
export function refreshCordobaClinicReadiness(start,treatingId=null,{deadlineSeconds,report=()=>{},allowPaidRelief=false,usedReliefIds=new Set(),revalidateGroundCrew=false}={}){
 let c=start,battle=null;const began=clock(c),until=Math.min(deadlineSeconds,began+3600),selected=c.activeSquadId;
 const orders=[],renewals=[],primaries=[],transfers=[],positions=[],homes=[],assignments=[],hires=[];
 const receipt={treatingId,deadlineSeconds,until,startSeconds:began,orders,renewals,primaries,transfers,positions,hires,doctorId:null,supplied:false,crewIds:[],gunId:null,...(revalidateGroundCrew?{revalidateGroundCrew:true,entryCrew:null}:{})};
 const check=()=>{assert.equal(c.pendingEncounter,null,'An actual encounter stops clinic readiness.');assert.equal(c.defeated,false);assert.ok(Number.isSafeInteger(deadlineSeconds)&&clock(c)<=until,'Clinic readiness uses only its original care deadline and one paid visit hour.');if(battle){assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.equal(battle.mode,'exploration','Actual contact stops clinic preparation.');}else assert.equal(c.pendingBattle,null);};
 const order=action=>{
  check();assert.ok(orders.length<600,'Clinic preparation has one finite order budget.');const from=clock(c),cash=c.resources.treasury;
  c=dispatchCampaign(c,action);orders.push({kind:'campaign',action:structuredClone(action),from,to:clock(c),cost:cash-c.resources.treasury});assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);
  if(action.type==='leaveSector')battle=null;
  if(action.type==='visitSector'){battle=enterSector(c.pendingBattle,c.sectorStates[sector]);const pair=syncBattleTime(c,battle);c=pair.campaign;battle=pair.battle;assert.equal(pair.error,null);}
  check();
 };
 const act=(action,seconds=6)=>{
  check();assert.ok(orders.length<600);assert.ok(clock(c)+seconds<=until,'The next real crew step exceeds the original clinic deadline.');const from=clock(c);
  battle=actBattle(battle,action);orders.push({kind:'battle',action:structuredClone(action),from,to:from,cost:0});assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  const pair=syncBattleTime(c,battle);c=pair.campaign;battle=pair.battle;orders.at(-1).to=clock(c);assert.equal(pair.error,null);check();
 };
 try{
  check();
  assert.equal(typeof revalidateGroundCrew,'boolean');
  if(treatingId===null)assert.ok(!c.recruited.some(id=>local(c,id)&&['doctor','militia_doctor'].includes(c.operativeState[id].assignment)),'An absent treating physician means no current local treatment.');
  else assert.ok(local(c,treatingId),'The actual treating/courier doctor must still be local and serving.');
  const locals=()=>c.recruited.filter(id=>local(c,id)),model=id=>sectorInventoryModel(c,sector,rosterFor(c),id);
  // Do not discover hidden equipment or resurrect a dropped primary. Existing
  // pockets and positive reachable public rows are the only admitted sources.
  for(const id of locals().filter(id=>fit(c,id)&&c.operativeState[id].weaponDropped)){
   const m=model(id),firearm=row=>row.expected&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0;
   assert.ok(m.carried.some(row=>firearm(row)&&row.equip?.some(option=>option.slot==='primary'&&option.valid))||m.entries.some(row=>row.reachable&&row.count>0&&firearm(row)),'A dropped rear primary needs actual reachable known finite custody.');
   c=recoverRoutePrimary(c,id,{report});check();primaries.push(id);
  }
  const existing=cordobaClinicGroundCrew(c);
  let physician=rosterFor(c).filter(op=>op.id!==treatingId&&!existing.includes(op.id)&&fit(c,op.id)&&op.medical>=careRules(c).minimumSkill&&['active','rest'].includes(c.operativeState[op.id].assignment))
   .sort((a,b)=>Number(c.operativeState[b.id].medkits>0)-Number(c.operativeState[a.id].medkits>0)||b.medical-a.medical||a.id-b.id)[0];
  const hireUnusedReserve=()=>{
   if(!allowPaidRelief||hiringArrivalReason(c,sector))return null;
   const candidate=rosterFor(c).map(op=>({op,r:c.operativeState[op.id],quote:contractQuote(c,op,'day')})).filter(({op,r,quote})=>!usedReliefIds.has(op.id)&&!c.recruited.includes(op.id)&&!c.contracts[op.id]&&!c.hiringArrivals.some(arrival=>arrival.operativeId===op.id)&&r.alive&&!r.captured&&!r.serviceEquipmentReturn&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&!r.routed&&!r.surrendered&&r.medkits>0&&op.medical>=careRules(c).minimumSkill&&['active','rest'].includes(r.assignment)&&!quote.permanent&&quote.available&&quote.total<=c.resources.treasury&&civicStatus(c,op.id).available)
    .sort((a,b)=>a.quote.total-b.quote.total||b.op.medical-a.op.medical||a.op.id-b.op.id)[0];
   if(!candidate)return null;
   // Select a real stationary home if the selected courier is already away.
   // The Native arrival may join that home's existing vacancy; do not rewrite it.
   if(c.squads.find(q=>q.id===c.activeSquadId)?.journey){const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.length);if(!home)return null;order({type:'selectSquad',id:home.id});}
   const {op,quote}=candidate,arrival=immediateRecruitmentExpectation(c,op,'day',quote,sector),before=clock(c),cash=c.resources.treasury,kits=c.operativeState[op.id].medkits;
   order({type:'recruitCivic',id:op.id,term:'day',destination:sector});usedReliefIds.add(op.id);
   const hire={id:op.id,quote:structuredClone(quote),arrival,debited:cash-c.resources.treasury};hires.push(hire);
   assert.equal(clock(c),before);assert.equal(hire.debited,quote.total);assert.equal(arrival.travelHours,0);
   assert.ok(local(c,op.id)&&c.recruited.filter(id=>id===op.id).length===1);assert.equal(c.hiringArrivals.some(row=>row.operativeId===op.id),false);
   const contract=c.contracts[op.id];assert.equal(contract.kind,'paid');assert.equal(contract.term,'day');assert.equal(contract.paid,quote.price);assert.equal(contract.started*3600+(contract.startedSecond??0),before);assert.equal(contractExpiresSeconds(contract),before+quote.hours*3600);assert.equal(c.operativeState[op.id].medkits,kits,"Only this unused physician's actual finite carried stock is admitted.");
   // A full selected home cannot admit the real arrival automatically.
   // Keep that paid physician in an existing stationary local vacancy before
   // the unchanged restaging guard requires every survivor's actual home.
   if(!c.squads.some(q=>q.members.includes(op.id))){
    const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.length<6);
    assert.ok(home,'The paid clinic reserve needs an existing local squad seat.');
    order({type:'assignToSquad',squadId:home.id,operativeId:op.id});
    assert.ok(c.squads.find(q=>q.id===home.id).members.includes(op.id));
   }
   if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
   return rosterFor(c).find(person=>person.id===op.id);
  };
  if(!physician)physician=hireUnusedReserve();
  if(!physician){receipt.reason='no-fit-reserve-physician';receipt.endSeconds=clock(c);report({event:'cordobaClinicReadiness',receipt});return {campaign:c,receipt};}
  if(!c.operativeState[physician.id].medkits){
   const donor=locals().filter(id=>id!==physician.id&&fit(c,id)&&c.operativeState[id].assignment!=='patient'&&c.operativeState[id].medkits>(id===treatingId?1:0)).sort((a,b)=>c.operativeState[b].medkits-c.operativeState[a].medkits||a-b)[0];
   if(donor!==undefined){const before=c.operativeState[donor].medkits;order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});assert.equal(c.operativeState[donor].medkits,before-1);transfers.push({donor,count:1});}
   const source=sectorInventorySites(c,sector).map(site=>{const model=sectorInventoryModel(c,site.id,rosterFor(c),physician.id);return {site:site.id,model,row:model.entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits')};}).find(source=>source.row);
   if(source){const before=c.operativeState[physician.id].medkits;order({type:'sectorInventory',sector:source.site,operativeId:physician.id,direction:'take',sourceKey:source.row.key,expected:source.row.expected,count:1});assert.equal(c.operativeState[physician.id].medkits,before+1);assertRouteEquipmentDebit(source.model,sectorInventoryModel(c,source.site,rosterFor(c),physician.id),source.row);transfers.push({recipient:physician.id,site:source.site,sourceKey:source.row.key,count:1});}
  }
  if(!c.operativeState[physician.id].medkits)physician=hireUnusedReserve()??physician;
  receipt.doctorId=physician.id;
  receipt.supplied=c.operativeState[physician.id].medkits>0;
  if(!receipt.supplied){receipt.reason='finite-reserve-empty';receipt.endSeconds=clock(c);report({event:'cordobaClinicReadiness',receipt});return {campaign:c,receipt};}
  if(existing.length&&!revalidateGroundCrew){receipt.crewIds=existing;receipt.reason='existing-ground-crew';receipt.endSeconds=clock(c);report({event:'cordobaClinicReadiness',receipt});return {campaign:c,receipt};}
  const expectedHomes=structuredClone(c.squads);
  const candidates=rosterFor(c).filter(op=>op.id!==treatingId&&op.id!==physician.id&&fit(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].morale>=30&&op.medical<60&&!clinical(c.operativeState[op.id])&&c.squads.some(q=>q.location===sector&&!q.journey&&q.members.includes(op.id)))
   .sort((a,b)=>a.marksmanship-b.marksmanship||a.id-b.id);
  const orderedGuns=guns(c).sort((a,b)=>artilleryProfile(c,a).crew-artilleryProfile(c,b).crew||String(a.id).localeCompare(String(b.id)));
  const savedCrew=revalidateGroundCrew&&existing.length?orderedGuns.map(gun=>({gun,ids:existing.filter(id=>near(post(c,id),gun)).slice(0,artilleryProfile(c,gun).crew)})).find(row=>row.ids.length===artilleryProfile(c,row.gun).crew):null;
  const gun=savedCrew?.gun??orderedGuns.find(g=>artilleryProfile(c,g).crew<=candidates.length);
  if(!gun){receipt.reason='no-complete-ground-crew';receipt.endSeconds=clock(c);report({event:'cordobaClinicReadiness',receipt});return {campaign:c,receipt};}
  const ids=savedCrew?.ids??candidates.slice(0,artilleryProfile(c,gun).crew).map(op=>op.id),otherPosts=locals().filter(id=>!ids.includes(id)).map(id=>post(c,id)).filter(Boolean);
  receipt.crewIds=ids;receipt.gunId=gun.id;
  for(const id of c.recruited){if(!c.operativeState[id].alive||c.operativeState[id].captured)continue;let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'Readiness cannot restart expired service.');for(let n=0;expiry!==null&&expiry<=until;n++){
   assert.ok(n<2);const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);assert.ok(cash>=quote.price);
   order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);const next=contractExpiresSeconds(c.contracts[id]);assert.equal(next,expiry+quote.hours*3600);renewals.push({id,quote,expiryBefore:expiry,expiryAfter:next});expiry=next;
  }}
  homes.push(...c.squads.filter(q=>q.members.some(id=>ids.includes(id))).map(q=>structuredClone(q)));assignments.push(...ids.map(id=>({id,assignment:c.operativeState[id].assignment})));
  const home=homes[0];order({type:'selectSquad',id:home.id});order({type:'squad',ids});for(const id of ids)order({type:'assignCare',operativeId:id,assignment:'active'});order({type:'visitSector'});
  let actualGun=battle.artillery.find(g=>g.id===gun.id);assert.ok(actualGun,'The visit must admit the same actual finite cannon.');const initialGun=structuredClone(actualGun),initialGuns=revalidateGroundCrew?structuredClone(battle.artillery):null,reserved=[...otherPosts];
  const entryPlan=revalidateGroundCrew?artilleryCrewPlan(battle,battle.units.find(u=>u.id===String(ids[0])),actualGun,1,true):null;
  if(revalidateGroundCrew)receipt.entryCrew={reason:entryPlan.reason,crew:[...entryPlan.crew],positions:ids.map(id=>({id,...spacePoint(battle.units.find(u=>u.id===String(id)))})),npcs:battle.npcs.map(npc=>({id:npc.id,...spacePoint(npc)}))};
  let currentPosts=null;const steps=new Map(ids.map(id=>[id,0]));
  const currentActor=id=>battle.units.find(u=>u.id===String(id));
  const paidStep=(id,point)=>{
   assert.ok(steps.get(id)<64,'Door access and final placement share the original 64 paid movement steps per crew member.');
   const unit=currentActor(id),from=spacePoint(unit),route=getReachable(publicRouteView(battle,unit),unit,{stopAt:p=>sameCell(p,point)})[0],step=route?.path[0];assert.ok(step,'The actual cannon crew still needs an open paid route.');
   if(!sameSurface(unit,step)){const quote=climbPreview(battle,unit,{linkId:step.linkId});assert.equal(quote.valid,true,quote.reason);act({type:'climb',unitId:unit.id,linkId:step.linkId},quote.seconds);}else act({type:'move',unitId:unit.id,...spacePoint(step)});
   steps.set(id,steps.get(id)+1);assert.notDeepEqual(spacePoint(currentActor(id)),from);
  };
  // Only current-entry revalidation uses this plan. A retained coordinate is
  // not occupancy. Keep every still-valid current post before choosing a new
  // actual reachable contact cell, and never commandeer another home's post.
  const contactChoices=(piece,id,exclusive=false)=>{
   const others=battle.artillery.filter(other=>other.id!==piece.id&&other.side==='player'&&(other.loaded||other.ammo>0)),unit=currentActor(id),view=publicRouteView(battle,unit);
   return getReachable(view,unit).filter(point=>(point.tacticalLevel??0)===0&&!sameCell(point,piece)&&!otherPosts.some(other=>sameCell(point,other))&&artilleryContact(view,{...unit,...spacePoint(point)},piece)&&(!exclusive||others.every(other=>!artilleryContact(view,{...unit,...spacePoint(point)},other))))
    .sort((a,b)=>Number(sameCell(unit,b))-Number(sameCell(unit,a))||a.cost-b.cost||a.y-b.y||a.x-b.x);
  };
  const contactPosts=(piece,exclusive=false)=>{
   const choices=ids.map(id=>contactChoices(piece,id,exclusive));
   const choose=(index,posts)=>{if(index===ids.length)return posts;for(const point of choices[index])if(!posts.some(other=>sameCell(point,other))){const result=choose(index+1,[...posts,{id:ids[index],...spacePoint(point)}]);if(result)return result;}return null;};
   return choose(0,[]);
  };
  if(revalidateGroundCrew&&entryPlan.reason){
   for(const id of ids)act({type:'movement',unitId:String(id),movement:'walk'});
   // A closed authored wall can make the nearest entry fallback lose contact.
   // Use the same public unlocked-door approach as finite cache collection.
   // Each step is paid/re-quoted in the actual scene; NPCs keep normal priority.
   const openAccess=piece=>{
    const building=battle.buildings.find(row=>piece.x>=row.x&&piece.x<row.x+row.width&&piece.y>=row.y&&piece.y<row.y+row.height);if(!building)return false;
    const approaches=ids.flatMap(id=>{const unit=currentActor(id),view=publicRouteView(battle,unit),reach=getReachable(view,unit);return view.wallEdges.filter(edge=>edge.buildingId===building.id&&edge.type==='door'&&!edge.open&&!edge.locked&&!edge.jammed&&!edge.destroyed).flatMap(door=>{
     const spot=reach.filter(point=>wallEdgeCells(door).some(cell=>sameCell(point,cell))).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];return spot?[{id,door,spot}]:[];
    });}).sort((a,b)=>a.spot.cost-b.spot.cost||String(a.door.doorId??wallEdgeId(a.door)).localeCompare(String(b.door.doorId??wallEdgeId(b.door)))||a.id-b.id);
    const approach=approaches[0];if(!approach)return false;
    const {id,door,spot}=approach;if(!sameCell(currentActor(id),spot)){paidStep(id,spot);return true;}
    const doorId=door.doorId??wallEdgeId(door),current=()=>battle.wallEdges.find(edge=>(edge.doorId??wallEdgeId(edge))===doorId),facing=wallEdgeCells(current()).find(point=>!sameCell(point,currentActor(id)));
    const look=lookPreview(battle,currentActor(id),facing);if(look.valid&&look.pa>0)act({type:'look',unitId:String(id),...spacePoint(facing)});
    if(!current().open){const quote=environmentPreview(battle,currentActor(id),{kind:'door',id:doorId},'open');assert.equal(quote.valid,true,quote.reason);act({type:'door',unitId:String(id),doorId,open:true});assert.equal(current().open,true);}
    // Opening faces the actual leaf. Pay to inspect the known piece again
    // before public reachability can admit its currently occupied posts.
    const inspect=lookPreview(battle,currentActor(id),piece);if(inspect.valid&&inspect.pa>0)act({type:'look',unitId:String(id),...spacePoint(piece)});return true;
   };
   // A real crew member can occupy the sole open entrance. Let that member
   // reach an actual contact post before requiring both routes to be free.
   // Retain an already-valid contact; do not move it merely to retry a plan.
   const advanceContact=(piece,exclusive)=>{
    for(const id of ids){
     const choices=contactChoices(piece,id,exclusive);if(choices.some(point=>sameCell(point,currentActor(id))))continue;
     const destination=choices[0];if(!destination)continue;
     while(!sameCell(currentActor(id),destination))paidStep(id,destination);
     const unit=currentActor(id),view=publicRouteView(battle,unit);assert.equal(artilleryContact(view,unit,piece),true);
     if(exclusive)for(const other of battle.artillery.filter(other=>other.id!==piece.id&&other.side==='player'&&(other.loaded||other.ammo>0)))assert.equal(artilleryContact(view,unit,other),false);
     return true;
    }
    return false;
   };
   const tryPiece=(piece,exclusive)=>{
    for(;;){const plan=contactPosts(piece,exclusive);if(plan)return plan;if(advanceContact(piece,exclusive))continue;if(!openAccess(piece))return null;}
   };
   currentPosts=tryPiece(actualGun,false);
   if(!currentPosts){
    // An already-owned second piece is a fallback, never a new gun or charge.
    // Both same crew members must have exclusive real contact so an earlier
    // partial crew cannot claim one of them in the existing battery policy.
    for(const candidate of orderedGuns.filter(piece=>piece.id!==actualGun.id&&artilleryProfile(c,piece).crew===ids.length)){
     const piece=battle.artillery.find(row=>row.id===candidate.id);if(!piece||!publicRouteView(battle,currentActor(ids[0])).artillery.some(row=>row.id===piece.id))continue;
     const plan=tryPiece(piece,true);if(!plan)continue;receipt.originalGunId=actualGun.id;receipt.gunId=piece.id;actualGun=piece;currentPosts=plan;break;
    }
   }
   assert.ok(currentPosts,'The same actual crew needs a complete reachable contact plan for an existing finite cannon.');
  }
  for(const id of ids){const unitId=String(id),actor=()=>battle.units.find(u=>u.id===unitId);
   if(entryPlan&&!entryPlan.reason){positions.push({id,...spacePoint(actor())});continue;}
   if(!currentPosts)act({type:'movement',unitId,movement:'walk'});
   const view=publicRouteView(battle,actor()),destination=currentPosts?.find(point=>point.id===id)??getReachable(view,actor()).filter(p=>(p.tacticalLevel??0)===0&&near(p,actualGun)&&!reserved.some(other=>sameCell(p,other))&&artilleryContact(view,{...actor(),...spacePoint(p)},actualGun)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(destination,'A complete actual crew needs distinct reachable adjacent ground posts.');
   for(let n=0;!sameCell(actor(),destination);n++){
    if(currentPosts)paidStep(id,destination);else{
     assert.ok(n<64);const from=spacePoint(actor()),route=getReachable(publicRouteView(battle,actor()),actor(),{stopAt:p=>sameCell(p,destination)})[0],step=route?.path[0];assert.ok(step,'The actual cannon crew still needs an open paid route.');
     if(!sameSurface(actor(),step)){const quote=climbPreview(battle,actor(),{linkId:step.linkId});assert.equal(quote.valid,true,quote.reason);act({type:'climb',unitId,linkId:step.linkId},quote.seconds);}else act({type:'move',unitId,...spacePoint(step)});
     assert.notDeepEqual(spacePoint(actor()),from);
    }
   }
   if(currentPosts)assert.equal(artilleryContact(publicRouteView(battle,actor()),actor(),actualGun),true,'Every final paid post needs actual current Native contact.');
   if(actor().stance!=='crouched')act({type:'stance',unitId,stance:'crouched'});const point={id,...spacePoint(actor())};positions.push(point);reserved.push(point);
  }
  assert.equal(artilleryCrewPlan(battle,battle.units.find(u=>u.id===String(ids[0])),actualGun,1,true).reason,null);
  if(receipt.originalGunId)for(const id of ids)for(const other of battle.artillery.filter(piece=>piece.id!==actualGun.id&&piece.side==='player'&&(piece.loaded||piece.ammo>0)))assert.equal(artilleryContact(publicRouteView(battle,currentActor(id)),currentActor(id),other),false,'A fallback crew cannot also be claimed by another charged cannon.');
  if(revalidateGroundCrew)assert.deepEqual(battle.artillery,initialGuns,'Preparation cannot move, reload or refill any existing cannon.');else assert.deepEqual(actualGun,initialGun,'Preparation cannot move, reload or refill the existing cannon.');
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
  for(const original of homes){order({type:'selectSquad',id:original.id});order({type:'squad',ids:original.members});}for(const row of assignments)order({type:'assignCare',operativeId:row.id,assignment:row.assignment});if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  assert.deepEqual(c.squads,expectedHomes,'Preparation preserves all real homes and journeys after any actual paid arrival.');for(const id of start.recruited.filter(id=>!ids.includes(id)))assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition,'Other actual clinic/roof posts remain exact.');
  for(const [id,r]of Object.entries(start.operativeState)){assert.equal(c.operativeState[id].alive,r.alive);assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive)assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  assert.ok(c.operativeState[physician.id].medkits>0);receipt.endSeconds=clock(c);receipt.reason='paid-ground-crew';assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'cordobaClinicReadiness',receipt});return {campaign:c,receipt};
 }catch(error){if(error&&typeof error==='object'){error.campaign??=c;error.battle??=battle;error.pair??={campaign:error.campaign,battle:error.battle};error.cordobaClinicReadiness=receipt;}throw error;}
}
