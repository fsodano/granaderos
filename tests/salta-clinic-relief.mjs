import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {careAssignmentReason,doctorRate} from '../game/medical-care.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {actBattle,canSee,getReachable,knownArtillery,lootSearchPreview,lootPreview,lookPreview,climbPreview,movementStepCost} from '../game/tactical.js';
import {nearbyLootOptions} from '../game/ja2-hud.js';
import {spacePoint,sameCell,sameSurface} from '../game/tactical-space.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {visibleMedicalPatrolStep} from './route-visible-medical-remains.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;

// Return only explicit actual survivors. The physician stays at the depot;
// every dressing, service extension and travel tick remains a Native order.
export function returnSaltaClinicRelief(start,ids,{destination='tucuman',deadlineSeconds=clock(start)+72*3600,protectedTerms={},resolveEncounter,report=()=>{}}={}){
 assert.ok(Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length&&ids.every(Number.isSafeInteger));
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>clock(start));
 const inputCapture=recordRouteStrategicEvidence({helper:'returnSaltaClinicRelief',stage:'preparation-input',campaign:start,context:{ids,destination,deadlineSeconds,protectedTerms}});
 let campaign=saved(start);const before=structuredClone(start),source=operativeLocation(campaign,ids[0]),previous=campaign.activeSquadId;
 const cohort=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),orders=[],renewals=[],collections=[],ticks=[],encounters=[];
 try{
 const present=id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&!operativeInTransit(campaign,id);
 assert.notEqual(source,destination);assert.ok(ids.every(id=>present(id)&&operativeLocation(campaign,id)===source));
 const check=()=>{
  assert.ok(clock(campaign)<=deadlineSeconds,'The actual clinic relief exceeds the unchanged 72-hour preparation deadline.');
  assert.ok(cohort.every(id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured),'Clinic relief must retain every actual serving survivor.');
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false,'Clinic relief cannot restore a death.');
 };
 const settle=()=>{
  if(!campaign.pendingEncounter)return;
  assert.ok(typeof resolveEncounter==='function','Resolve the actual clinic-relief encounter before continuing.');
  const encounter=structuredClone(campaign.pendingEncounter),at=clock(campaign);campaign=resolveEncounter(campaign);
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.ok(clock(campaign)>=at);encounters.push(encounter);check();
 };
 const order=action=>{
  settle();assert.equal(campaign.pendingBattle,null);check();const from=clock(campaign),cash=campaign.resources.treasury;
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);
  orders.push({action:structuredClone(action),from,to:clock(campaign),treasuryBefore:cash,treasuryAfter:campaign.resources.treasury});check();settle();
 };
 const retain=seconds=>{
  assert.ok(clock(campaign)+seconds<=deadlineSeconds,'The requested real clinic work must fit the remaining preparation time.');
  settle();for(const id of cohort){
   let contract=campaign.contracts[id],expiry=contractExpiresSeconds(contract);assert.ok(contract&&(expiry===null||expiry>clock(campaign)),'Clinic relief needs current actual service.');
   while(expiry!==null&&expiry<=clock(campaign)+seconds){
    const term=protectedTerms[id]?.term??contract.term,quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),term);
    assert.equal(quote.available,true,quote.reason);if(protectedTerms[id])assert.equal(quote.price,protectedTerms[id].paid,'The actual original guard quote must retain its original paid term.');
    const action={type:'renewContract',id,term,expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0},cash=campaign.resources.treasury;
    order(action);assert.equal(campaign.resources.treasury,cash-quote.price);assert.equal(campaign.contracts[id].paid,quote.price);
    renewals.push({id,term,quote,action});contract=campaign.contracts[id];const next=contractExpiresSeconds(contract);assert.ok(next>expiry);expiry=next;
   }
  }
 };
 settle();assert.equal(campaign.pendingBattle,null);
 for(const [id,expected]of Object.entries(protectedTerms)){assert.equal(campaign.contracts[id]?.term,expected.term);assert.equal(campaign.contracts[id]?.paid,expected.paid);}
 const doctor=rosterFor(campaign).filter(op=>!ids.includes(op.id)&&present(op.id)&&operativeLocation(campaign,op.id)===source&&!careAssignmentReason(campaign,op,'doctor')).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 assert.ok(doctor,'A supplied actual local physician must remain as the depot defender.');const doctorId=doctor.id;
 assert.ok(!campaign.operativeState[doctorId].weaponDropped&&rosterFor(campaign).find(op=>op.id===doctorId).weapon,'The remaining depot physician must retain a real weapon.');
 const takeKnown=()=>{
  const found=sectorInventorySites(campaign,source).map(site=>({site,model:sectorInventoryModel(campaign,site.id,rosterFor(campaign),doctorId)})).map(({site,model})=>({site,model,row:model.entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits')})).find(row=>row.row);
  if(!found)return false;const {site,row}=found,count=Math.min(4,row.count),carried=campaign.operativeState[doctorId].medkits;
  order({type:'sectorInventory',sector:site.id,operativeId:doctorId,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(campaign.operativeState[doctorId].medkits,carried+count);collections.push({kind:'known-stock',site:site.id,key:row.key,expected:row.expected,count});return true;
 };
 let cacheInspected=false,waypoint=0,looking=0,discoveryActions=0;const inspected=new Set();
 const discoverLinen=()=>{
  assert.ok(ids.every(id=>campaign.operativeState[id].bleeding===0),'Stop actual bleeding before the physician searches for linen.');
  if(!cacheInspected){
   cacheInspected=true;retain(Math.min(6*3600,deadlineSeconds-clock(campaign)));
   const at=clock(campaign),cash=campaign.resources.treasury;campaign=discoverRouteCache(campaign,doctorId);check();settle();
   collections.push({kind:'cache-discovery',from:at,to:clock(campaign)});assert.equal(campaign.resources.treasury,cash);
   if(takeKnown())return;
  }
  // Short visits keep current terms paid. Paths use only public map cells and
  // visible bodies. Hidden corpse contents never select a destination.
  for(let visit=0;visit<12&&!campaign.operativeState[doctorId].medkits;visit++){
   retain(3700);order({type:'createSquad',ids:[doctorId],sector:source,name:'Lino del socorro'});order({type:'assignCare',operativeId:doctorId,assignment:'active'});order({type:'visitSector'});
   let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[source]);const at=clock(campaign),steps=[],unitId=String(doctorId),actor=()=>battle.units.find(u=>u.id===unitId);
   const perform=action=>{
    const oldClock=clock(campaign);battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
    const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);campaign=next.campaign;battle=next.battle;check();steps.push(structuredClone(action));discoveryActions++;
    assert.ok(clock(campaign)-oldClock<=60,'One bounded public discovery action must not spend an unquoted hour.');
   };
   const xs=Array.from({length:Math.ceil((battle.width-6)/6)},(_,i)=>Math.min(battle.width-2,6+i*6)),ys=Array.from({length:Math.ceil((battle.height-6)/6)},(_,i)=>Math.max(1,battle.height-6-i*6)),waypoints=ys.flatMap((y,row)=>(row%2?[...xs].reverse():xs).map(x=>({x,y,tacticalLevel:0}))),directions=[[0,-2],[2,0],[0,2],[-2,0]];
   for(let attempt=0;attempt<96&&discoveryActions<600&&clock(campaign)-at<3600&&!actor().medkits;attempt++){
    const unit=actor();assert.ok(unit.hp>=15&&!unit.unconscious&&!unit.asleep&&unit.energy>15,'The actual physician must remain fit to recover linen.');
    const visible=battle.units.filter(body=>body.id!==unitId&&body.hp<=0&&!body.departure&&!inspected.has(body.id)&&canSee(battle,unit,body)).map(body=>({body,quote:lootSearchPreview(battle,unit,spacePoint(body))})).filter(row=>row.quote.valid).sort((a,b)=>a.quote.movePa-b.quote.movePa||String(a.body.id).localeCompare(String(b.body.id)));
    let target=visible[0]?.body,route=visible[0]?.quote.path;
    if(target&&!route.length){
     const option=nearbyLootOptions(battle,unit,spacePoint(target)).find(row=>row.action.targetId===target.id&&row.action.item==='medkits');inspected.add(target.id);
     if(!option)continue;let count=Math.min(4,option.count);while(count&&!lootPreview(battle,unit,{...option.action,count}).valid)count--;
     if(!count)continue;const old=target.medkits;perform({...option.action,unitId,count});assert.equal(battle.units.find(u=>u.id===target.id).medkits,old-count);collections.push({kind:'observed-body',bodyId:target.id,count,before:old,after:old-count});continue;
    }
    if(!target){
     if(looking<directions.length){const [dx,dy]=directions[looking++],point={x:Math.max(0,Math.min(battle.width-1,unit.x+dx)),y:Math.max(0,Math.min(battle.height-1,unit.y+dy)),tacticalLevel:unit.tacticalLevel??0};if(lookPreview(battle,unit,point).valid)perform({type:'look',unitId,...point});continue;}
     if(waypoint>=waypoints.length)break;target=waypoints[waypoint];if(sameSurface(unit,target)&&Math.hypot(unit.x-target.x,unit.y-target.y)<=1){waypoint++;continue;}
     route=visibleMedicalPatrolStep(battle,unit,target)?.path;if(!route?.length){waypoint++;continue;}
    }
    const view={...battle,units:battle.units.filter(u=>u.side==='player'||canSee(battle,unit,u)),artillery:knownArtillery(battle,unit)},reachable=getReachable(view,unit);let cost=0,from=unit,last=null;
    for(const point of route.slice(0,3)){
     const next=movementStepCost(view,unit,from,point);if(cost+next>20)break;
     if(point.kind==='climb'){if(!last){const action={type:'climb',unitId,linkId:point.linkId};assert.equal(climbPreview(battle,unit,action).valid,true);perform(action);}break;}
     cost+=next;from=point;last=point;
    }
    if(last){const actual=reachable.find(p=>sameCell(p,last));assert.ok(actual&&actual.cost<=20);perform({type:'move',unitId,...spacePoint(actual)});}
    else if(!route[0]||route[0].kind!=='climb'){waypoint++;continue;}looking=0;
   }
   campaign=dispatchCampaign(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.equal(campaign.lastError,null);check();settle();
   collections.push({kind:'observed-discovery',from:at,to:clock(campaign),steps});campaign=saved(campaign);
   if(takeKnown())return;
   if(waypoint>=waypoints.length||discoveryActions>=600)break;
  }
  assert.ok(campaign.operativeState[doctorId].medkits>0,'The actual public search found no reachable finite linen for the clinic relief.');
 };
 const unhealed=()=>ids.filter(id=>campaign.operativeState[id].bleeding||campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 let zeroTime=0;
 for(let hour=0;unhealed().length&&hour<72;hour++){
  retain(3601);assert.ok(ids.every(id=>present(id)&&operativeLocation(campaign,id)===source));
  if(!campaign.operativeState[doctorId].medkits){if(!takeKnown())discoverLinen();}
  const op=rosterFor(campaign).find(op=>op.id===doctorId);assert.equal(careAssignmentReason(campaign,op,'doctor'),'');
  for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:unhealed().includes(operativeId)?'patient':'rest'});
  order({type:'assignCare',operativeId:doctorId,assignment:'doctor'});
  const at=clock(campaign),kits=campaign.operativeState[doctorId].medkits,patients=ids.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}));order({type:'wait',hours:1});
  const elapsed=clock(campaign)-at;zeroTime=elapsed===0?zeroTime+1:0;assert.ok(zeroTime<3,'Clinic relief stopped after three consecutive zero-time notices.');
  if(elapsed>0){const spent=kits-campaign.operativeState[doctorId].medkits;assert.ok(spent>0,'Actual clinic care must consume owned dressings.');ticks.push({from:at,to:clock(campaign),doctor:doctorId,rate:doctorRate(op,campaign),spent,patients,after:ids.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))});}
 }
 assert.deepEqual(unhealed(),[],'Finite clinic care must fully heal the actual relief before departure.');
 order({type:'assignCare',operativeId:doctorId,assignment:'rest'});
 order({type:'createSquad',ids,sector:source,name:'Relevo de la clínica'});for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 retain(3601);for(const id of ids)if(campaign.operativeState[id].weaponDropped)campaign=recoverRoutePrimary(campaign,id,{report});campaign=finishReloadsBeforeMarch(campaign,{report});check();settle();
 const mode=campaign.routes.posta?'posta':'march',quote=previewStrategicRoute(campaign,campaign.activeSquadId,destination,mode);assert.equal(quote.valid,true,quote.reason);
 retain((quote.hours+1)*3600);const departure=clock(campaign),journeySquad=campaign.activeSquadId;order(quote.action);
 for(let attempt=0;campaign.squads.find(q=>q.id===journeySquad).journey&&attempt<72;attempt++){retain(3601);order({type:'wait',hours:1});}
 assert.equal(campaign.squads.find(q=>q.id===journeySquad).journey,undefined);assert.ok(ids.every(id=>present(id)&&operativeLocation(campaign,id)===destination));
 assert.ok(ids.every(id=>campaign.operativeState[id].hp===campaign.operativeState[id].maxHp&&campaign.operativeState[id].bleeding===0),'The actual relief must arrive alive and fully healed.');
 assert.ok(present(doctorId)&&operativeLocation(campaign,doctorId)===source,'The real serving physician remains as the depot defender.');
 assert.ok(campaign.operativeState[doctorId].hp>=15&&!campaign.operativeState[doctorId].bleeding);assert.ok(!campaign.operativeState[doctorId].weaponDropped);
 if(campaign.squads.find(q=>q.id===previous)?.members.length)order({type:'selectSquad',id:previous});
 const receipt={event:'saltaClinicRelief',ids:[...ids],doctor:doctorId,source,destination,orders,renewals,collections,ticks,encounters,quote,departureSeconds:departure,arrivalSeconds:clock(campaign),startSeconds:clock(start),endSeconds:clock(campaign),deadlineSeconds,treasuryBefore:start.resources.treasury,treasuryAfter:campaign.resources.treasury};
 assert.deepEqual(start,before);campaign=saved(campaign);report(receipt);recordRouteStrategicEvidence({helper:'returnSaltaClinicRelief',stage:'route-checkpoint',campaign,inputCapture,context:{receipt}});return {campaign,receipt};
 }catch(error){recordRouteStrategicEvidence({helper:'returnSaltaClinicRelief',stage:'preparation-failure',campaign,inputCapture,error,context:{source,destination,ids,orders,renewals,collections,ticks,encounters,deadlineSeconds}});throw error;}
}
