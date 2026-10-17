import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {actBattle,getReachable,climbPreview,artilleryContact,hasFirearm} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime,COMBAT_ROUND_SECONDS} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dailyTownIncome,townIncomeSources} from '../game/town-income.js';
import {careRules} from '../game/campaign-care-rules.js';
import {carriedAmmunition,unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {contractExpiresSeconds} from '../game/contracts.js';

// Prepare actual local defenders before a raid. Roof cells are authored public
// map geometry; movement, climbing, reloads and the clock use ordinary orders.
export function stageRouteRoofDefenders(start,ids,{report=()=>{},reservedPositions=[],bounded,landingGuardIds,physicianId,retainedRoofRifleId}={}){
 if(retainedRoofRifleId!==undefined)assert.ok(bounded,'A retained roof rifle can support only bounded physician staging.');
 if(bounded)return boundedRoofStaging(start,ids,{report,reservedPositions,...bounded,landingGuardIds,physicianId,retainedRoofRifleId});
 assert.ok(ids.length);let c=decodeSave(encodeSave(start)).campaign;const sector=c.operativeState[ids[0]].location,previous=c.activeSquadId,actions=[],startSeconds=c.hour*3600+(c.secondOfHour??0);
 const income=dailyTownIncome(c),incomeSources=structuredClone(townIncomeSources(c)),incomeActivations=structuredClone(c.townIncome.activations),paidDay=c.townIncome.lastPaidDay;
 assert.ok(ids.length&&ids.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===sector&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding&&!c.operativeState[id].asleep));
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const squads=c.squads.filter(q=>q.location===sector&&!q.journey&&q.members.some(id=>ids.includes(id))).map(q=>q.id),positions=[],reserved=new Set(),assigned=new Set(),cellKey=point=>`${point.tacticalLevel??0}:${point.x}:${point.y}`;
 // Clinic-only public access placement. The ordinary and bounded staging
 // paths retain their old destination policy when this option is absent.
 const landingPosts=[],landingTargets=new Map(),protectedPosts=new Map(),stationedCrew=new Map();let landingsPlanned=false;
 if(landingGuardIds!==undefined){
  assert.ok(Array.isArray(landingGuardIds)&&new Set(landingGuardIds).size===landingGuardIds.length&&landingGuardIds.every(id=>ids.includes(id)));
  for(const id of c.recruited){const r=c.operativeState[id],p=r.residentPosition;if(r.alive&&!r.captured&&operativeLocation(c,id)===sector&&!operativeInTransit(c,id)&&r.residentSector===sector&&(r.residentScene??null)===null&&(p?.tacticalLevel??0)>0){assert.ok(!protectedPosts.has(cellKey(p)),'Existing living roof owners need distinct actual posts.');protectedPosts.set(cellKey(p),{id,...spacePoint(p)});}}
 }
 // A separate squad visit may omit the earlier guards from battle.units.
 // Reserve only their actual already-paid resident posts; never add ghost
 // units, move an owner or invent a roof cell to change native collision.
 assert.ok(Array.isArray(reservedPositions));const inherited=[],owners=new Set();
 for(const point of reservedPositions){
  assert.ok(point&&typeof point==='object'&&!Array.isArray(point)&&Object.keys(point).every(key=>['id','x','y','tacticalLevel'].includes(key))&&Number.isInteger(point.id)&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&Number.isInteger(point.tacticalLevel)&&point.tacticalLevel>0,'a reserved upper post has one actual owner and physical cell');
  const body=c.operativeState[point.id],resident=body?.residentPosition,surface=surfaceAt(c.sectorStates[sector],point);
  assert.ok(c.recruited.includes(point.id)&&body?.alive&&body.hp>0&&!body.captured&&!operativeInTransit(c,point.id)&&operativeLocation(c,point.id)===sector&&!ids.includes(point.id)&&resident&&sameCell(resident,point),'a reservation is an existing local serving resident outside the new staging cohort');
  assert.ok(body.residentSector===sector&&(body.residentScene??null)===null,'a reserved guard post belongs to this actual default sector scene, not a coincident subscene');
  assert.ok(surface&&!surface.blocked&&surface.type==='floor'&&['roof','platform'].includes(surface.kind),'the actual reserved post belongs to an unchanged authored upper surface');
  assert.ok(!owners.has(point.id)&&!reserved.has(cellKey(point)),'reserved resident owners and cells are unique');owners.add(point.id);reserved.add(cellKey(point));inherited.push({id:point.id,...spacePoint(resident)});
 }

 assert.ok(ids.every(id=>c.squads.some(q=>squads.includes(q.id)&&q.members.includes(id))),'every defender belongs to an actual local squad');
 for(const squadId of squads){
  order({type:'selectSquad',id:squadId});const assignments=c.squad.map(id=>({id,assignment:c.operativeState[id].assignment}));
  for(const {id}of assignments)order({type:'assignCare',operativeId:id,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});order({type:'visitSector'});
  let battle=enterSector(c.pendingBattle,c.sectorStates[sector]);
  for(const point of inherited){const body=c.operativeState[point.id],surface=surfaceAt(battle,point);assert.ok(body.residentSector===c.pendingBattle.sector&&(body.residentScene??null)===(c.pendingBattle.sceneId??null),'the actual visit admits the same reserved resident scene');assert.ok(surface&&!surface.blocked&&surface.type==='floor'&&['roof','platform'].includes(surface.kind),'a reserved resident post retains its actual surface at native entry');}

  const roofs=battle.upperSurfaces.filter(point=>!point.blocked).sort((a,b)=>Math.hypot(a.x-battle.width/2,a.y-battle.height/2)-Math.hypot(b.x-battle.width/2,b.y-battle.height/2)||a.y-b.y||a.x-b.x);
  if(landingGuardIds!==undefined&&!landingsPlanned){
   assert.ok(roofs.length,'Public access placement needs an actual authored roof.');const anchor=roofs[0],seen=new Set();
   const landings=(battle.climbLinks??[]).flatMap(link=>{
    const [upper,lower]=(link.to.tacticalLevel??0)>(link.from.tacticalLevel??0)?[link.to,link.from]:[link.from,link.to],surface=surfaceAt(battle,upper);
    if((upper.tacticalLevel??0)<=(lower.tacticalLevel??0)||!sameSurface(anchor,upper)||Math.hypot(anchor.x-upper.x,anchor.y-upper.y)>4||!surface||surface.blocked||!['roof','platform'].includes(surface.kind)||seen.has(cellKey(upper)))return [];
    seen.add(cellKey(upper));return [{linkId:link.id,...spacePoint(upper)}];
   });
   assert.ok(landings.length,'The clinic roof needs its actual public access landings.');
   const roster=rosterFor(c);
   for(const id of ids){const r=c.operativeState[id],op=roster.find(op=>op.id===id),p=r.residentPosition;if(!p||r.residentSector!==sector||(r.residentScene??null)!==null||(p.tacticalLevel??0)!==0)continue;
    const body={...op,...r,id:String(id),side:'player',...spacePoint(p)};
    if(battle.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0)&&artilleryContact(battle,body,g))){const post={id,...spacePoint(p)};stationedCrew.set(id,post);protectedPosts.set(cellKey(post),post);}
   }
   const eligible=landingGuardIds.filter(id=>{
    const r=c.operativeState[id],op=roster.find(op=>op.id===id),actual=battle.units.find(u=>u.id===String(id)),body=actual??(r.residentPosition?{...op,...r,id:String(id),side:'player',...spacePoint(r.residentPosition)}:null);
    return r.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&!r.routed&&!r.surrendered&&!battle.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0)&&body&&artilleryContact(battle,body,g));
   }),used=new Set();
   for(const point of landings){const owner=protectedPosts.get(cellKey(point));if(owner){landingPosts.push({...point,id:owner.id,retained:true});used.add(owner.id);}}
   for(const point of landings.filter(point=>!protectedPosts.has(cellKey(point)))){
    const id=eligible.find(id=>!used.has(id));assert.notEqual(id,undefined,'Each vacant public clinic access needs an actual eligible rifle guard.');
    used.add(id);landingTargets.set(id,point);landingPosts.push({...point,id,retained:false});
   }
   for(const point of landingPosts)if(ids.includes(point.id))landingTargets.set(point.id,point);
   landingsPlanned=true;
  }
  const checkPlacement=()=>{if(landingGuardIds!==undefined){assert.equal(battle.status,'active');assert.equal(battle.mode,'exploration','Actual contact stops public landing preparation.');assert.equal(battle.phase,'player');assert.equal(c.pendingEncounter,null,'An actual raid stops public landing preparation.');}};
  const act=action=>{checkPlacement();battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);actions.push(action);if(landingGuardIds!==undefined){const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;checkPlacement();}};
  for(const id of c.squad.filter(id=>ids.includes(id))){const unitId=String(id);
   if(stationedCrew.has(id)){const post=stationedCrew.get(id),unit=battle.units.find(u=>u.id===unitId);assert.ok(sameCell(unit,post));reserved.add(cellKey(post));assigned.add(cellKey(post));positions.push({...post});continue;}
   act({type:'movement',unitId,movement:'walk'});
   const unit=battle.units.find(unit=>unit.id===unitId),oldPost=landingGuardIds!==undefined?[...protectedPosts.values()].find(point=>point.id===id):null,preferred=landingTargets.get(id)??oldPost;
   const choices=preferred?[preferred]:roofs,destination=landingGuardIds===undefined?roofs.find(point=>!reserved.has(cellKey(point))&&!battle.units.some(other=>other.id!==unitId&&other.hp>0&&sameCell(other,point))&&getReachable(battle,unit,{stopAt:cell=>sameCell(cell,point)}).some(cell=>sameCell(cell,point))):choices.find(point=>!reserved.has(cellKey(point))&&(!protectedPosts.has(cellKey(point))||protectedPosts.get(cellKey(point)).id===id)&&!landingPosts.some(post=>post.id!==id&&sameCell(post,point))&&!battle.units.some(other=>other.id!==unitId&&other.hp>0&&sameCell(other,point))&&(sameCell(unit,point)||getReachable(battle,unit,{stopAt:cell=>sameCell(cell,point)}).some(cell=>sameCell(cell,point)&&cell.path.every(step=>!protectedPosts.has(cellKey(step))||protectedPosts.get(cellKey(step)).id===id))));assert.ok(destination,'a local defender needs actual reachable roof cover');
   for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++){const before=spacePoint(battle.units.find(unit=>unit.id===unitId));act({type:'move',unitId,...spacePoint(destination)});assert.notDeepEqual(spacePoint(battle.units.find(unit=>unit.id===unitId)),before);}
   assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});reserved.add(cellKey(destination));assigned.add(cellKey(destination));positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});
  }
  const synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(unit=>unit.side==='player')});
  if(landingGuardIds!==undefined)assert.equal(c.pendingEncounter,null,'An actual raid stops public landing preparation.');
  for(const {id,assignment}of assignments)if(assignment!=='active'&&(!['doctor','militia_doctor'].includes(assignment)||c.operativeState[id].medkits>0&&c.operativeState[id].energy>10))order({type:'assignCare',operativeId:id,assignment});
 }
 if(c.activeSquadId!==previous)order({type:'selectSquad',id:previous});
 assert.equal(assigned.size,ids.length,'local squads retain distinct actual roof cells');
 for(const point of inherited)assert.ok(sameCell(c.operativeState[point.id].residentPosition,point),'an earlier guard keeps the actual reserved resident post');
 if(landingGuardIds!==undefined){
  for(const point of landingPosts){const r=c.operativeState[point.id];assert.ok(r.alive&&!r.captured&&sameCell(r.residentPosition,point),'Every public landing has its actual paid living owner.');}
  for(const point of protectedPosts.values())if(!landingTargets.has(point.id))assert.ok(sameCell(c.operativeState[point.id].residentPosition,point),'Other actual resident roof posts remain exact.');
  assert.deepEqual(c.squads,start.squads,'Public landing preparation preserves all actual homes and membership.');
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 const incomeDays=Math.floor(c.hour/24)-Math.floor(start.hour/24),incomeReceived=incomeDays*income;
 assert.deepEqual(townIncomeSources(c),incomeSources);assert.deepEqual(c.townIncome.activations,incomeActivations);assert.equal(dailyTownIncome(c),income);
 assert.equal(c.townIncome.lastPaidDay,incomeDays?Math.floor(c.hour/24):paidDay);
 assert.equal(c.resources.treasury,start.resources.treasury+incomeReceived,'Only the existing earned midnight income can change treasury during roof staging.');
 const evidence={event:'routeRoofDefenders',sector,ids,positions,...(inherited.length?{reservedPositions:inherited}:{}),...(landingGuardIds!==undefined?{landingPosts}:{}),actions,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-startSeconds,cost:0,incomeDays,incomeReceived,netCashChange:c.resources.treasury-start.resources.treasury};report(evidence);
 assert.ok(evidence.elapsedSeconds>=0);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Opt-in post-care staging keeps an actual synchronized pair at every paid
// step. The original staging path above retains its existing orders and sync.
// No reload, extra ammunition, care hour or new squad is supplied by this path.
function boundedRoofStaging(start,ids,{deadlineSeconds,report,reservedPositions,landingGuardIds,physicianId,retainedRoofRifleId}){
 const clock=c=>c.hour*3600+(c.secondOfHour??0),startSeconds=clock(start),until=Math.min(deadlineSeconds,startSeconds+3600);
 const before=structuredClone(start),selected=start.activeSquadId,sector=start.operativeState[ids[0]]?.location;
 const orders=[],positions=[],visits=[],replans=[],reserved=new Set(),publicPosts=[],cellKey=p=>`${p.tacticalLevel??0}:${p.x}:${p.y}`;
 let c=start,battle=null,steps=0,restored=false,refusedSync=null,physicianPost=null,physicianGroup=null,retainedRifleBefore=null;
 const groupRows=start.squads.filter(q=>q.location===sector&&!q.journey&&q.members.some(id=>ids.includes(id)));
 const maximumSteps=64*ids.length,maximumOrders=Math.min(600,66*ids.length+groupRows.reduce((n,q)=>n+2*q.members.length+3,0)+1);
 const receipt=()=>({sector,ids:[...ids],startSeconds,endSeconds:clock(c),deadlineSeconds,until,maximumSteps,maximumOrders,steps,orders,positions,visits,replans,restored,...(landingGuardIds===undefined?{}:{landingGuardIds,publicPosts}),...(physicianId===undefined?{}:{physicianId,physicianPost,physicianGroup}),...(retainedRoofRifleId===undefined?{}:{retainedRoofRifleId,retainedRifleBefore})});
 const retainedRifle=()=>{
  const id=retainedRoofRifleId,r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id),contract=c.contracts[id],point=reservedPositions.find(point=>point.id===id);
  assert.ok(point&&c.recruited.includes(id)&&op&&r?.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&contract&&!contract.departurePending&&(contractExpiresSeconds(contract)===null||contractExpiresSeconds(contract)>clock(c)),'The retained rifle needs actual current local service.');
  assert.ok(!ids.includes(id)&&point.tacticalLevel>0&&r.residentSector===sector&&(r.residentScene??null)===null&&sameCell(r.residentPosition,point)&&r.hp>=15&&!r.bleeding&&!r.routed&&!r.unconscious&&!r.surrendered&&!r.asleep&&r.energy>10&&op.medical<60&&['active','rest'].includes(r.assignment??'active'),'Only an actual fit nonclinical rifle may retain its exact old roof post.');
  const load=carriedAmmunition(op,r);assert.ok(hasFirearm(load)&&firearmServiceable(load)&&!load.jammed&&load.loaded+ammoCount(load)>0,'The retained rifle needs a real serviceable firearm and finite matching ammunition.');
  return {post:{id,...spacePoint(point)},assignment:r.assignment,weapon:structuredClone(load.weapon),condition:load.condition??100,ammunition:unitAmmunitionByType(load)};
 };
 const check=()=>{
  assert.equal(c.defeated,false);assert.equal(c.pendingEncounter,null,'A real encounter stops roof staging before another order.');
  assert.ok(clock(c)<=until,'Roof staging exhausted its existing hour or original care deadline.');
  if(battle){assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.equal(battle.mode,'exploration','Actual contact stops roof staging.');}
  else assert.equal(c.pendingBattle,null,'Finish the actual visit before another strategic order.');
  if(retainedRifleBefore)assert.deepEqual(retainedRifle(),retainedRifleBefore,'The existing rifle keeps its exact paid post, duty, firearm and ammunition.');
 };
 const order=action=>{
  check();assert.ok(orders.length<maximumOrders,'Roof staging has one finite shared order budget.');
  const from=clock(c),cash=c.resources.treasury;c=dispatchCampaign(c,action);
  const row={kind:'campaign',action:structuredClone(action),from,to:clock(c),cost:cash-c.resources.treasury};orders.push(row);
  assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);
  if(action.type==='leaveSector')battle=null;
  if(action.type==='visitSector'){
   battle=enterSector(c.pendingBattle,c.sectorStates[sector]);const pair=syncBattleTime(c,battle);if((landingGuardIds!==undefined||retainedRoofRifleId!==undefined)&&pair.error!==null){refusedSync=pair;assert.equal(pair.error,null);}c=pair.campaign;battle=pair.battle;assert.equal(pair.error,null);
  }
  check();
 };
 const act=(action,seconds=6)=>{
  check();assert.ok(orders.length<maximumOrders,'Roof staging has one finite shared order budget.');
  // The public-post option also reserves a possible separate contact round.
  assert.ok(clock(c)+seconds+(landingGuardIds===undefined&&retainedRoofRifleId===undefined?0:COMBAT_ROUND_SECONDS)<=until,'The next paid step exceeds the existing roof-staging deadline.');
  const from=clock(c),row={kind:'battle',action:structuredClone(action),from,to:from,cost:0};orders.push(row);
  battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  const pair=syncBattleTime(c,battle);if((landingGuardIds!==undefined||retainedRoofRifleId!==undefined)&&pair.error!==null){refusedSync=pair;assert.equal(pair.error,null);}c=pair.campaign;battle=pair.battle;row.to=clock(c);assert.equal(pair.error,null);check();
 };
 try{
  assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>startSeconds,'Restaging uses only the remaining original care deadline.');
  assert.ok(ids.length&&new Set(ids).size===ids.length);check();
  assert.ok(ids.every(id=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding&&!c.operativeState[id].asleep&&c.operativeState[id].energy>10),'Only actual stable local survivors can be restaged.');
  if(landingGuardIds!==undefined){
   assert.ok(Array.isArray(landingGuardIds)&&new Set(landingGuardIds).size===landingGuardIds.length&&landingGuardIds.every(id=>ids.includes(id)));
   const roster=rosterFor(c);
   assert.ok(landingGuardIds.every(id=>{const r=c.operativeState[id],op=roster.find(op=>op.id===id);return op.medical<60&&['active','rest'].includes(r.assignment??'active')&&!r.routed&&!r.unconscious&&!r.surrendered&&!r.weaponDropped&&hasFirearm({...op,...r})&&(r.residentPosition?.tacticalLevel??0)===0;}),'Only actual nonclinical new ground rifles may take public-access posts.');
  }
  if(physicianId!==undefined&&retainedRoofRifleId===undefined){
   const r=c.operativeState[physicianId],op=rosterFor(c).find(op=>op.id===physicianId);
   assert.ok(landingGuardIds?.length&&ids.includes(physicianId)&&!landingGuardIds.includes(physicianId)&&op?.medical>=careRules(c).minimumSkill&&r.medkits>0&&['active','rest'].includes(r.assignment??'active')&&(r.residentPosition?.tacticalLevel??0)===0,'Only a newly staged supplied physician may join the public rifle posts.');
  }
  if(retainedRoofRifleId!==undefined){
   assert.ok(ids.length===1&&ids[0]===physicianId&&landingGuardIds===undefined,'Only one new physician may join a retained roof rifle; new crew and rifle roles stay separate.');
   const r=c.operativeState[physicianId],op=rosterFor(c).find(op=>op.id===physicianId);assert.ok(op?.medical>=careRules(c).minimumSkill&&r.medkits>0&&['active','rest'].includes(r.assignment??'active')&&(r.residentPosition?.tacticalLevel??0)===0,'The newly staged local physician must have actual carried supplies.');
   retainedRifleBefore=retainedRifle();
  }
  const groups=c.squads.filter(q=>q.location===sector&&!q.journey&&q.members.some(id=>ids.includes(id))).map(q=>q.id);
  // Quote the physician's anchor from the actual physician in the first home.
  // The fixed group plan supplies no movement or authority for later homes.
  if(physicianId!==undefined)groups.sort((a,b)=>Number(c.squads.find(q=>q.id===b).members.includes(physicianId))-Number(c.squads.find(q=>q.id===a).members.includes(physicianId)));
  assert.ok(ids.every(id=>c.squads.some(q=>groups.includes(q.id)&&q.members.includes(id))),'Every survivor keeps an actual existing local home.');
  for(const point of reservedPositions){
   const r=c.operativeState[point.id],surface=surfaceAt(c.sectorStates[sector],point);
   assert.ok(c.recruited.includes(point.id)&&r?.alive&&!r.captured&&!operativeInTransit(c,point.id)&&operativeLocation(c,point.id)===sector&&!ids.includes(point.id)&&r.residentSector===sector&&(r.residentScene??null)===null&&sameCell(r.residentPosition,point)&&point.tacticalLevel>0&&surface&&!surface.blocked,'Reserve only an actual living local roof post in the same scene.');
   assert.ok(!reserved.has(cellKey(point)));reserved.add(cellKey(point));
  }
  for(const groupId of groups){
   order({type:'selectSquad',id:groupId});const assignments=c.squad.map(id=>({id,assignment:c.operativeState[id].assignment}));
   for(const {id}of assignments)order({type:'assignCare',operativeId:id,assignment:'active'});
   order({type:'visitSector'});const visit={groupId,initial:structuredClone(battle),positions:[],...(retainedRoofRifleId===undefined?{}:{initialCampaign:structuredClone(c)})};visits.push(visit);
   // Keep actual upward access cells open for later groups. An earlier paid
   // post must not close the only climb while survivors remain on the ground.
   const accessCells=new Set((battle.climbLinks??[]).flatMap(link=>{
    const from=link.from.tacticalLevel??0,to=link.to.tacticalLevel??0;
    return from===to?[]:[cellKey(from>to?link.from:link.to)];
   }));
   // This opt-in keeps rifle posts near real authored access without putting
   // a new final owner on its landing or one-cell exit apron. Other bodies
   // keep the old center ordering over the remaining actual roof cells.
   const publicAccess=landingGuardIds===undefined&&retainedRoofRifleId===undefined?[]:(battle.climbLinks??[]).flatMap(link=>{
    const [upper,lower]=(link.to.tacticalLevel??0)>(link.from.tacticalLevel??0)?[link.to,link.from]:[link.from,link.to],surface=surfaceAt(battle,upper);
    return (upper.tacticalLevel??0)>(lower.tacticalLevel??0)&&surface&&!surface.blocked&&['roof','platform'].includes(surface.kind)?[{id:link.id,...spacePoint(upper)}]:[];
   });
   const publicApron=point=>publicAccess.some(access=>sameSurface(access,point)&&Math.hypot(access.x-point.x,access.y-point.y)<=1.5);
   const roofs=battle.upperSurfaces.filter(p=>!p.blocked&&!accessCells.has(cellKey(p))&&!publicApron(p)).sort((a,b)=>Math.hypot(a.x-battle.width/2,a.y-battle.height/2)-Math.hypot(b.x-battle.width/2,b.y-battle.height/2)||a.y-b.y||a.x-b.x);
   const accessFor=point=>publicAccess.filter(access=>sameSurface(access,point)&&Math.hypot(access.x-point.x,access.y-point.y)<=4).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||a.y-b.y||a.x-b.x)[0];
   const nearAccess=landingGuardIds===undefined?[]:roofs.filter(accessFor).sort((a,b)=>{const aa=accessFor(a),bb=accessFor(b);return Math.hypot(a.x-aa.x,a.y-aa.y)-Math.hypot(b.x-bb.x,b.y-bb.y)||a.y-b.y||a.x-b.x;});
   const stagedIds=c.squad.filter(id=>ids.includes(id));if(physicianId!==undefined)stagedIds.sort((a,b)=>Number(b===physicianId)-Number(a===physicianId));
   for(const id of stagedIds){
    const unitId=String(id),actor=()=>battle.units.find(u=>u.id===unitId);act({type:'movement',unitId,movement:'walk'});
    const publicRifle=landingGuardIds?.includes(id),vacant=p=>!reserved.has(cellKey(p))&&!battle.units.some(u=>u.id!==unitId&&u.hp>0&&sameCell(u,p))&&(!physicianGroup||![physicianGroup.physician,...physicianGroup.rifles].some(post=>post.id!==id&&sameCell(post,p)));
    let destination;
    if(id===physicianId&&retainedRoofRifleId===undefined){
     // Plan the whole adjacent group before paying its first post. All cells
     // retain real public access and a clear landing apron. Later rifles still
     // need their own current Native quote from their actual selected home.
     const choices=getReachable(battle,actor()).filter(point=>roofs.some(roof=>sameCell(roof,point))&&vacant(point)).map(point=>({...point,rifles:nearAccess.filter(post=>!sameCell(post,point)&&sameSurface(post,point)&&Math.hypot(post.x-point.x,post.y-point.y)<=1.5&&vacant(post))})).filter(point=>point.rifles.length>=landingGuardIds.length).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);
     destination=choices[0];assert.ok(destination,'The supplied physician needs a complete reachable adjacent rifle group outside the public access apron.');
     physicianGroup={groupId,physician:{id,...spacePoint(destination)},rifles:landingGuardIds.map((rifle,index)=>({id:rifle,...spacePoint(destination.rifles[index])}))};
    }else if(id===physicianId){
     const guard=retainedRifleBefore.post,guardSurface=surfaceAt(battle,guard);
     assert.ok(guardSurface,'The retained rifle needs its actual current roof surface.');const guardCover=guardSurface.cover??0;
     // Protect the supplied physician from every public approach to this
     // authored roof. A retained guard never moves to make a post available.
     const accesses=publicAccess.filter(access=>sameSurface(access,guard)&&(guardSurface.buildingId!==undefined?surfaceAt(battle,access)?.buildingId===guardSurface.buildingId:Math.hypot(access.x-guard.x,access.y-guard.y)<=4));
     assert.ok(accesses.length,'The retained rifle needs identifiable public access to its actual roof.');
     const clearance=point=>Math.min(...accesses.map(access=>Math.hypot(point.x-access.x,point.y-access.y)-Math.hypot(guard.x-access.x,guard.y-access.y)));
     const choices=getReachable(battle,actor()).filter(point=>roofs.some(roof=>sameCell(roof,point))&&sameSurface(point,guard)&&(guardSurface.buildingId===undefined||surfaceAt(battle,point)?.buildingId===guardSurface.buildingId)&&Math.hypot(point.x-guard.x,point.y-guard.y)<=1.5&&vacant(point)&&(surfaceAt(battle,point)?.cover??0)>=guardCover&&clearance(point)>0&&!(battle.npcs??[]).some(npc=>(npc.hp??100)>0&&!npc.departure&&!npc.fled&&sameCell(npc,point))&&point.path.every(step=>!reserved.has(cellKey(step)))).sort((a,b)=>clearance(b)-clearance(a)||((surfaceAt(battle,b)?.cover??0)-(surfaceAt(battle,a)?.cover??0))||a.cost-b.cost||a.y-b.y||a.x-b.x);
     destination=choices[0];assert.ok(destination,'The new physician needs a currently reachable protected roof beside the exact retained rifle, behind every public access and outside its apron.');
     physicianGroup={groupId,physician:{id,...spacePoint(destination)},rifles:[{...guard}]};
    }else if(publicRifle&&physicianGroup){const planned=physicianGroup.rifles.find(post=>post.id===id);destination=planned&&nearAccess.find(p=>sameCell(p,planned)&&vacant(p)&&getReachable(battle,actor(),{stopAt:cell=>sameCell(cell,p)}).some(cell=>sameCell(cell,p)));}
    else destination=(publicRifle?nearAccess:roofs).find(p=>vacant(p)&&getReachable(battle,actor(),{stopAt:cell=>sameCell(cell,p)}).some(cell=>sameCell(cell,p)));
    assert.ok(destination,'The actual stable survivor needs a reachable vacant roof.');
    for(let leg=0;!sameCell(actor(),destination);leg++){
     assert.ok(leg<64&&steps<maximumSteps,'Roof staging has only the original finite walking allowance.');
     const from=spacePoint(actor());let route=getReachable(battle,actor(),{stopAt:p=>sameCell(p,destination)})[0];
     // A resident can enter a previously quoted post during paid walking.
     // Ordinary cover may change to another current vacant roof; fixed public
     // rifle/physician groups keep their existing destination requirements.
     if(!route?.path[0]&&landingGuardIds===undefined&&physicianId===undefined){
      const previous=spacePoint(destination);
      for(const point of roofs){
       if(!vacant(point)||sameCell(point,destination))continue;
       const current=getReachable(battle,actor(),{stopAt:p=>sameCell(p,point)})[0];
       if(!current?.path[0])continue;
       destination=point;route=current;replans.push({id,from,previous,destination:spacePoint(point)});break;
      }
     }
     const next=route?.path[0];assert.ok(next,'The actual paid roof route must still exist.');
     if(retainedRoofRifleId!==undefined)assert.ok(!reserved.has(cellKey(next)),'The physician cannot walk through an existing reserved roof body.');
     steps++;
     if(!sameSurface(actor(),next)){const quote=climbPreview(battle,actor(),{linkId:next.linkId});assert.equal(quote.valid,true,quote.reason);act({type:'climb',unitId,linkId:next.linkId},quote.seconds);}
     else act({type:'move',unitId,...spacePoint(next)}); // Native WALK, including diagonal stealth, takes at most six seconds per cell.
     assert.notDeepEqual(spacePoint(actor()),from,'Every paid step must make actual progress.');
    }
    if(actor().stance!=='crouched')act({type:'stance',unitId,stance:'crouched'});
    const post={id,...spacePoint(actor())};positions.push(post);visit.positions.push(post);reserved.add(cellKey(post));
    if(id===physicianId)physicianPost={...post,neighbors:[]};
    if(publicRifle){const access=accessFor(post);assert.ok(access&&!accessCells.has(cellKey(post)));publicPosts.push({...post,linkId:access.id,access:spacePoint(access)});}
    if(physicianPost)physicianPost.neighbors=[...publicPosts,...(retainedRifleBefore?[retainedRifleBefore.post]:[])].filter(point=>sameSurface(point,physicianPost)&&Math.hypot(point.x-physicianPost.x,point.y-physicianPost.y)<=1.5).map(point=>point.id);
   }
   visit.returned=structuredClone(battle);order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
   for(const {id,assignment}of assignments)if(c.operativeState[id].assignment!==assignment)order({type:'assignCare',operativeId:id,assignment});
  }
  if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  assert.deepEqual(c.squads,before.squads,'Restaging preserves every actual home and membership.');
  for(const point of reservedPositions)assert.ok(sameCell(c.operativeState[point.id].residentPosition,point),'An existing upper post must remain exact.');
  if(physicianId!==undefined){assert.ok(physicianGroup&&sameCell(physicianPost,physicianGroup.physician));assert.deepEqual(new Set(physicianPost.neighbors),new Set(retainedRoofRifleId===undefined?landingGuardIds:[retainedRoofRifleId]),'Every planned rifle needs its actual paid post beside the physician.');for(const post of physicianGroup.rifles)assert.ok(sameCell(c.operativeState[post.id].residentPosition,post));}
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  assert.equal(positions.length,ids.length);if(landingGuardIds!==undefined)assert.equal(publicPosts.length,landingGuardIds.length);assert.deepEqual(start,before);restored=true;report({event:'routeRoofDefenders',...receipt()});return {campaign:c,battle:null,receipt:receipt()};
 }catch(error){
  if(error&&typeof error==='object'){error.campaign=c;error.battle=battle;error.pair={campaign:c,battle};error.routeRoofDefenders=receipt();if(refusedSync)error.routeRoofRefusedSync=refusedSync;}
  throw error;
 }
}
