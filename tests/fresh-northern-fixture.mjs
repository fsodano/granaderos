import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {prepareHiredNorthernDefense,prepareNorthernOfficerRelief,completeHiredNorthernMission} from './fresh-northern-command.mjs';
import {prepareFreshTucumanAssault} from './fresh-campaign-route.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {prepareStockTucumanReadiness} from './stock-tucuman-readiness.mjs';
import {mountainBatteryOrder,assignedMountainBatteryController} from './mountain-battery-driver.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {prepareLocalOpening} from './local-opening-care-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {marchToFront,completeTestTravel} from './campaign-test-helpers.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {prepareNorthernSupport} from './northern-support-fixture.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,stanceCost,firearmShotOptions,teamCanSee,actionCosts,lookPreview} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {wallMovementBlocked} from '../game/wall-geometry.js';
import {townIncomeSources} from '../game/town-income.js';
import {hasWorkshop} from '../game/campaign-headquarters.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deadIds=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

// Choose another affordable public body-region preview before firing through
// a known friendly lane. Keep low-chance fire held without reading NPC data.
export function northernClearShotOrder(battle,unit){
 const action=hiredAssaultOrder(battle,unit);if(action?.type!=='fire')return action;
 const safe=option=>option.chance>=35&&!option.interveningFriendly&&!option.shots?.some(shot=>shot.interveningFriendly);
 const target=battle.units.find(other=>other.id===action.targetId),requested=firearmShotOptions(battle,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
 if(requested&&safe(requested))return action;
 const visible=battle.units.filter(other=>other.side!==unit.side&&other.hp>0&&!other.departure&&!other.unconscious&&!other.routed&&!other.surrendered&&teamCanSee(battle,unit.side,other));
 const choices=visible.flatMap(target=>{
  const costs=actionCosts(battle,unit,target),aim=Math.min(4,Math.floor((unit.ap-costs.fire)/costs.aim));
  return aim<0?[]:firearmShotOptions(battle,unit,target,aim).filter(option=>option.aim<=aim&&safe(option)).map(option=>({target,option}));
 }).sort((a,b)=>b.option.expectedDamage-a.option.expectedDamage||b.option.chance-a.option.chance);
 if(!choices.length)return null;
 const {target:alternative,option}=choices[0];return {type:'fire',unitId:unit.id,targetId:alternative.id,aim:option.aim,hitLocation:option.hitLocation};
}

// The actual local paid physician heals the actual wounded cohort. Carried
// dressings come first; known finite bodies/chests supply the remaining work.
export function recoverNorthernLocalPatients(start,{report=()=>{}}={}){
 let s=saved({campaign:start}).campaign;const sector=s.location,local=s.recruited.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&s.operativeState[id].location===sector),patients=local.filter(id=>s.operativeState[id].hp<s.operativeState[id].maxHp);
 if(!patients.length)return s;
 const doctor=rosterFor(s).filter(op=>local.includes(op.id)&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'the real local patients need an available paid physician');
 const initialStock=local.reduce((total,id)=>total+s.operativeState[id].medkits,0),cash=s.resources.treasury,startSeconds=s.hour*3600+(s.secondOfHour??0),transfers=[];let individualCare=false;
 const campaignOrder=action=>{
  if(action.type==='wait')for(const id of s.recruited.filter(id=>s.operativeState[id].alive)){const contract=s.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=s.hour+action.hours){const quote=contractQuote(s,rosterFor(s).find(op=>op.id===id),'day'),before=s.resources.treasury;s=order(s,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(before-s.resources.treasury,quote.price);}}
  s=order(s,action);
 };
 for(const operativeId of local)campaignOrder({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<48&&patients.some(id=>s.operativeState[id].hp<s.operativeState[id].maxHp);hour++){
  assert.equal(s.pendingEncounter,null,'resolve an actual raid before local wound care');assert.equal(s.pendingBattle,null);
  if(s.operativeState[doctor.id].asleep){campaignOrder({type:'wait',hours:1});continue;}
  if(!s.operativeState[doctor.id].medkits){
   const donor=local.find(id=>id!==doctor.id&&s.operativeState[id].medkits&&!sectorInventoryModel(s,sector,rosterFor(s),id).reason);
   if(donor!==undefined){
    const before=s.operativeState[donor].medkits,count=Math.min(before,4);campaignOrder({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});
    const row=sectorInventoryModel(s,sector,rosterFor(s),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);campaignOrder({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(s.operativeState[donor].medkits,before-count);transfers.push({donor,count});
   }else{
    if(!individualCare){individualCare=true;for(const operativeId of local)campaignOrder({type:'assignCare',operativeId,assignment:'rest'});}
    const row=sectorInventoryModel(s,sector,rosterFor(s),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'remaining care needs an actual known reachable finite dressing source');
    const before=s.operativeState[doctor.id].medkits,count=Math.min(row.count,12);campaignOrder({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(s.operativeState[doctor.id].medkits,before+count);transfers.push({source:row.key,count});
   }
  }
  campaignOrder({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  const selected=patients.filter(id=>s.operativeState[id].hp<s.operativeState[id].maxHp).sort((a,b)=>s.operativeState[a].hp/s.operativeState[a].maxHp-s.operativeState[b].hp/s.operativeState[b].maxHp)[0];
  for(const operativeId of patients)campaignOrder({type:'assignCare',operativeId,assignment:s.operativeState[operativeId].hp<s.operativeState[operativeId].maxHp&&(!individualCare||operativeId===selected)?'patient':'rest'});
  campaignOrder({type:'wait',hours:1});for(const id of patients)assert.ok(s.operativeState[id].alive,'the actual local patients must survive their finite paid care');
 }
 for(const id of patients){assert.equal(s.operativeState[id].hp,s.operativeState[id].maxHp);assert.equal(s.operativeState[id].bleeding,0);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(s.operativeState[id].alive,false);
 const stock=local.reduce((total,id)=>total+s.operativeState[id].medkits,0);report({event:'northernLocalCare',sector,doctor:doctor.id,patients,hour:s.hour,second:s.secondOfHour??0,elapsedSeconds:s.hour*3600+(s.secondOfHour??0)-startSeconds,paid:cash-s.resources.treasury,transfers,dressingsUsed:initialStock+transfers.filter(row=>row.source).reduce((sum,row)=>sum+row.count,0)-stock});
 return saved({campaign:s}).campaign;
}

// Both real crew members lower their profile while the gun has finite charges.
// A spent piece leaves posture decisions to the ordinary infantry policy.
export function northernOfficerSaltaOrder(battle,unit,artilleryId){
 const chargedGun=battle.artillery.some(gun=>gun.id===artilleryId&&gun.side===unit.side&&(gun.loaded||gun.ammo>0));
 if(chargedGun&&['9','11'].includes(unit.id)&&unit.stance==='standing'&&!unit.knockedDown&&!unit.entangled&&unit.ap>=stanceCost(unit,'crouched'))return {type:'stance',unitId:unit.id,stance:'crouched'};
 return mountainBatteryOrder(battle,unit,{leaderId:'9',helperId:'11',artilleryId,keepCrewTogether:true,screenDistance:3});
}

// Native edge approaches need a clear crew lane and scout sightings. Reuse the
// mobile battery policy so a living assistant stays with the finite gun.
export const northernOfficerSaltaController=initial=>coastalBatteryController(initial,{sharedArtillerySight:true});

// Keep the finite field medic in a supporting posture with dressings ready.
// The mobile crew and infantry retain their ordinary paid orders.
export function stockNorthernSaltaController(initial){
 const battery=coastalBatteryController(initial,{sharedArtillerySight:true});
 const medic=initial.units.filter(unit=>unit.side==='player'&&unit.hp>=15&&unit.medkits>0&&unit.medical>0).sort((a,b)=>b.medical-a.medical)[0]?.id;
 return (battle,unit)=>{
  if(unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure&&unit.bleeding>0&&unit.medical>0&&unit.medkits>0){
   const costs=actionCosts(battle,unit,unit);
   if(unit.activeSlot==='medical'&&unit.ap>=costs.heal)return {type:'useItem',unitId:unit.id,targetId:unit.id};
   if(unit.activeSlot!=='medical'&&unit.ap>=costs.weapon+costs.heal)return {type:'weapon',unitId:unit.id,slot:'medical'};
  }
  const normal=battery(battle,unit);
  if(battle.mode==='combat'&&unit.id===medic&&!unit.knockedDown&&!unit.entangled){
   if(normal?.type==='stance'&&normal.stance==='standing')return unit.activeSlot!=='medical'&&unit.medkits>0&&unit.ap>=actionCosts(battle,unit).weapon?{type:'weapon',unitId:unit.id,slot:'medical'}:null;
   if(unit.activeSlot==='medical'&&normal?.type==='weapon'&&normal.slot==='primary')return null;
  }
  return normal;
 };
}

// Stabilize the surviving local patient before any rifle/cache walk.
// A paid arrival cannot undo a death that already happened during its journey.
export function stabilizeNorthernRelief(start,{report=()=>{}}={}){
 let s=saved({campaign:start}).campaign;
 const patients=s.squad.filter(id=>s.operativeState[id].alive&&(s.operativeState[id].bleeding>0||s.operativeState[id].hp<15));
 for(let hour=0;hour<12&&patients.some(id=>s.operativeState[id].bleeding);hour++){
  const doctor=rosterFor(s).filter(op=>s.squad.includes(op.id)&&s.operativeState[op.id].alive&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'an actual awake local medic must bandage the arriving survivor');
  if(!s.operativeState[doctor.id].medkits){
   const donor=s.squad.find(id=>id!==doctor.id&&s.operativeState[id].medkits>0&&!sectorInventoryModel(s,s.location,rosterFor(s),id).reason);assert.ok(donor,'a real local dressing must stop the bleeding before an equipment walk');
   s=order(s,{type:'sectorInventory',sector:s.location,operativeId:donor,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(s,s.location,rosterFor(s),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);s=order(s,{type:'sectorInventory',sector:s.location,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  }
  s=order(s,{type:'assignCare',operativeId:doctor.id,assignment:'doctor'});for(const operativeId of patients.filter(id=>s.operativeState[id].bleeding))s=order(s,{type:'assignCare',operativeId,assignment:'patient'});
  const before=s.operativeState[doctor.id].medkits;s=advanceCampaignHours(s,1);assert.ok(s.operativeState[doctor.id].medkits<before);for(const id of patients)assert.ok(s.operativeState[id].alive,'a remaining living patient must survive actual local bandaging');
 }
 for(const id of patients)assert.equal(s.operativeState[id].bleeding,0);
 for(const operativeId of s.squad)s=order(s,{type:'assignCare',operativeId,assignment:'active'});
 if(patients.some(id=>s.operativeState[id].hp<15)){
  const pair=visit(s),aid=autoBandageBattle(pair.battle);s=leave(sync({campaign:pair.campaign,battle:aid.battle}));
  for(const id of patients){assert.ok(s.operativeState[id].alive&&s.operativeState[id].hp>=15);assert.equal(s.operativeState[id].bleeding,0);}
  report({event:'actualNorthernOpeningAid',elapsedSeconds:aid.elapsedSeconds,steps:aid.steps,patients:patients.map(id=>({id,hp:s.operativeState[id].hp}))});
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(s.operativeState[id].alive,false);
 return saved({campaign:s}).campaign;
}

// The paid rear physician meets the port administrator before future salaries
// exhaust the field treasury. Public sweep points reveal the moving NPC first.
export function meetNorthernRearPort(start,operativeId,{report=()=>{}}={}){
 recordRouteStrategicEvidence({helper:'meetNorthernRearPort',stage:'preparation-input',campaign:start,context:{operativeId}});
 let s=saved({campaign:start}).campaign;const before=structuredClone(start),previous=s.activeSquadId,record=s.operativeState[operativeId],assignment=record.assignment,source=townIncomeSources(s).find(source=>source.id==='buenos_aires');
 assert.ok(source.controlled);if(source.activated)return s;
 assert.ok(s.recruited.includes(operativeId)&&record.alive&&!record.captured&&record.hp>=15&&!record.asleep&&record.location==='buenos_aires');assert.equal(s.pendingEncounter,null);assert.equal(s.pendingBattle,null);
 const rear=s.squads.find(squad=>squad.location==='buenos_aires'&&squad.members.includes(operativeId)&&!squad.journey);
 s=order(s,rear?{type:'selectSquad',id:rear.id}:{type:'createSquad',ids:[operativeId],name:'Administración de retaguardia',sector:'buenos_aires'});s=order(s,{type:'assignCare',operativeId,assignment:'active'});
 let p=visit(s);const unitId=String(operativeId),actions=[],actor=()=>p.battle.units.find(unit=>unit.id===unitId),observed=()=>playerKnownBattle(p.battle).npcs.find(npc=>npc.id===source.representative.npcId),act=action=>{p=tactical(p,action);actions.push(action);};
 const scan=()=>{for(const [dx,dy]of [[5,0],[0,5],[-5,0],[0,-5]]){const target={x:Math.max(0,Math.min(p.battle.width-1,actor().x+dx)),y:Math.max(0,Math.min(p.battle.height-1,actor().y+dy)),tacticalLevel:actor().tacticalLevel??0};if(lookPreview(p.battle,actor(),target).valid)act({type:'look',unitId,...target});if(observed())break;}};
 const reachable=()=>{const known=playerKnownBattle(p.battle),view={...p.battle,npcs:p.battle.npcs.filter(npc=>known.npcs.some(row=>row.id===npc.id))};return getReachable(view,actor()).filter(point=>(point.tacticalLevel??0)===0);};
 const goals=[[.5,.5],[.25,.25],[.75,.25],[.75,.75],[.25,.75],[.5,.5]].map(([x,y])=>({x:Math.floor(p.battle.width*x),y:Math.floor(p.battle.height*y),tacticalLevel:0}));
 for(const goal of goals){
  for(let step=0;step<24&&!observed();step++){
   assert.ok(actor().energy>=15,'the actual physician needs energy for the public port sweep');
   scan();
   if(observed())break;
   const distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);if(distance(actor())<=2)break;
   const spot=reachable().filter(point=>point.cost>0&&distance(point)<distance(actor())).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];if(!spot)break;
   const prior=spacePoint(actor());act({type:'move',unitId,...spacePoint(spot)});assert.ok(!sameCell(actor(),prior));
  }
  if(observed())break;
 }
 // The centre and quarter points miss edge neighbourhoods at night. Inspect
 // every public map edge with gaps no larger than the native six-cell sight
 // range. Goals depend only on map dimensions, never an unseen NPC position.
 const inset=Math.min(2,Math.floor((Math.min(p.battle.width,p.battle.height)-1)/2)),axis=(start,end)=>{const values=[];for(let n=start;n<=end;n+=6)values.push(n);if(values.at(-1)!==end)values.push(end);return values;},xs=axis(inset,p.battle.width-1-inset),ys=axis(inset,p.battle.height-1-inset);
 const perimeter=[...xs.map(x=>({x,y:ys[0]})),...ys.slice(1).map(y=>({x:xs.at(-1),y})),...xs.slice(0,-1).reverse().map(x=>({x,y:ys.at(-1)})),...ys.slice(1,-1).reverse().map(y=>({x:xs[0],y}))];
 for(const goal of perimeter){
  if(observed())break;
  for(let step=0;step<p.battle.width*p.battle.height&&!observed();step++){
   assert.ok(actor().energy>=15,'the actual physician needs energy for the public perimeter sweep');scan();if(observed())break;
   const distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y),spot=reachable().sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];if(!spot?.path.length)break;
   const prior=spacePoint(actor());act({type:'move',unitId,...spacePoint(spot.path[0])});assert.ok(!sameCell(actor(),prior));
  }
 }
 assert.ok(observed(),'a public map sweep must reveal the actual representative');const firstObserved={hour:p.campaign.hour,second:p.campaign.secondOfHour,npc:structuredClone(observed())};
 let remembered=structuredClone(observed()),searching=false,searchGoal=0;const reacquisitions=[],searchGoals=[...goals,...perimeter];
 const contiguous=(point,target)=>sameSurface(point,target)&&Math.abs(point.x-target.x)+Math.abs(point.y-target.y)<=1&&!wallMovementBlocked(p.battle,point,target);
 for(let step=0;step<120;step++){
  scan();const npc=observed();if(npc){remembered=structuredClone(npc);searching=false;if(contiguous(actor(),npc))break;}
  // A wall can occlude a previously visible window resident on the way to
  // the open door. Follow only the last public point, then reacquire them.
  let spot=searching?null:reachable().filter(point=>contiguous(point,remembered)&&!sameCell(point,remembered)).sort((a,b)=>a.cost-b.cost)[0];
  if(!npc&&!spot?.path.length){
   // Civilian routines keep moving while each paid approach step resolves.
   // Reaching an empty remembered contact resumes the public map sweep;
   // it does not expose or follow the resident's current hidden position.
   if(!searching){reacquisitions.push({lastSeen:spacePoint(remembered),from:spacePoint(actor()),hour:p.campaign.hour,second:p.campaign.secondOfHour});searching=true;searchGoal=0;}
   for(;searchGoal<searchGoals.length;searchGoal++){
    const goal=searchGoals[searchGoal],distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);
    if(distance(actor())<=2)continue;
    spot=reachable().sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];if(spot?.path.length)break;
   }
  }
  if(!spot?.path.length)recordRouteStrategicEvidence({helper:'meetNorthernRearPort',stage:'approach-refusal',campaign:p.campaign,context:{operativeId,remembered,actor:actor(),observed:observed(),spot,battle:p.battle}});
  assert.ok(spot?.path.length,'the last observed representative needs a public reachable approach');act({type:'move',unitId,...spacePoint(spot.path[0])});
  const seen=observed();if(seen)remembered=structuredClone(seen);
 }
 assert.ok(observed());assert.ok(contiguous(actor(),observed()));assert.equal(p.campaign.pendingEncounter,null);
 s=order(p.campaign,{type:'talkNPC',npcId:observed().id,unitId:operativeId,approach:'direct',sectorState:p.battle});assert.equal(s.lastConversation.outcome,'incomeActivated');s=leave(saved({campaign:s,battle:p.battle}));
 if(assignment!=='active')s=order(s,{type:'assignCare',operativeId,assignment});s=order(s,{type:'selectSquad',id:previous});
 assert.equal(s.resources.treasury,start.resources.treasury,'the conversation cannot grant retroactive income');assert.equal(s.operativeState[operativeId].medkits,record.medkits);assert.deepEqual(start,before);for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(s.operativeState[id].alive,false);
 report({event:'northernRearPortAgreement',operativeId,firstObserved,reacquisitions,actions,receipt:structuredClone(s.townIncome.activations[source.id]),daily:townIncomeSources(s).find(row=>row.id===source.id).daily,elapsedSeconds:s.hour*3600+(s.secondOfHour??0)-start.hour*3600-(start.secondOfHour??0),cash:s.resources.treasury});
 return saved({campaign:s}).campaign;
}

function freshCreatedNorthernRoute({onCheckpoint,report=()=>{},coastalCheckpoint,openingCheckpoint}={}){
 const prefix=coastalCheckpoint??freshCoastalRoute('created',{onCheckpoint,report,openingCheckpoint});let s=prefix.campaign;const notes=[];
 const stagingUnits=ids=>ids.map(id=>{const r=s.operativeState[id];return {id,hp:r.hp,alive:r.alive,captured:r.captured,location:r.location,energy:r.energy,fatigue:r.fatigue,asleep:r.asleep,morale:r.morale,contract:s.contracts[id]};});
 // San Lorenzo leaves actual casualties. Keep surviving contracts, pay for
 // relief, recover finite rifles and finish care before the northern assault.
 // Count the actual local living veterans before booking the column.
 const localVeterans=s.squad.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&s.operativeState[id].location===s.location);assert.ok(localVeterans.length,'a real surviving local veteran must lead the northern relief');
 s=order(s,{type:'squad',ids:localVeterans});
 for(const id of s.squad)if(s.contracts[id]?.expiresAt!=null&&s.contracts[id].expiresAt<s.hour+72)s=order(s,{type:'renewContract',id,term:'week',expectedExpiresAt:s.contracts[id].expiresAt});
 // Hire the available physician first so the actual wounded veterans have
 // competent paid care before filling the remaining infantry positions.
 const relief=[112,115,123,114,137,113,124,108,139,111].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)).slice(0,6-s.squad.length);
 for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);s=stabilizeNorthernRelief(s,{report});
 const rearm=state=>{const depot=visit(state),rearmed=equipOpeningRifles(depot.battle,state.squad);return leave(sync({campaign:depot.campaign,battle:rearmed.battle}));};
 s=prepareLocalOpening(rearm(s),{buyWeapons:false}).campaign;
 const missing=6-s.squad.length,lateRelief=[115,123,114,137,113,124,108,139,111].filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.recruited.includes(id)&&contractQuote(s,rosterFor(s).find(op=>op.id===id),'week').available).slice(0,missing);assert.equal(lateRelief.length,missing,'only a real vacant local slot can receive a paid replacement');
 for(const id of lateRelief){const quote=contractQuote(s,rosterFor(s).find(op=>op.id===id),'week'),cash=s.resources.treasury;s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});assert.equal(cash-s.resources.treasury,quote.price);assert.ok(!s.recruited.includes(id));}
 if(lateRelief.length){s=advanceCampaignHours(s,6);for(const id of lateRelief){assert.ok(s.recruited.includes(id));assert.equal(s.operativeState[id].location,s.location);}s=rearm(s);}
 assert.equal(s.squad.length,6,'the real recovered field and paid replacements must fill the first column');
 report({event:'fieldRecovered',hour:s.hour,ids:s.squad,units:stagingUnits(s.squad)});
 const field=s.activeSquadId,supportIds=[119,127,103,104,111,140,100,101,102,105,106,117,118,121,122,126,129,130,133,134].filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.recruited.includes(id)).slice(0,6);assert.equal(supportIds.length,6);
 for(const id of supportIds)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);s=order(s,{type:'createSquad',ids:supportIds,name:'Apoyo de Córdoba',sector:s.location});const support=s.activeSquadId;s=rearm(s);
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=finishReloadsBeforeMarch(s);}
 // A routed casualty can reach Buenos Aires before a doctor could return
 // from Córdoba. Book the rear clinic before the columns start their march.
 const rearPhysician=[146,...rosterFor(s).filter(op=>op.medical>=70).sort((a,b)=>b.medical-a.medical).map(op=>op.id)].find(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.recruited.includes(id)&&!s.hiringArrivals.some(arrival=>arrival.operativeId===id)&&contractQuote(s,rosterFor(s).find(op=>op.id===id),'week').available);assert.ok(rearPhysician,'the rear clinic needs an available paid physician');
 const rearQuote=contractQuote(s,rosterFor(s).find(op=>op.id===rearPhysician),'week'),rearCash=s.resources.treasury;
 s=order(s,{type:'recruitCivic',id:rearPhysician,term:'week',destination:'buenos_aires'});
 const rearArrival=s.hiringArrivals.find(arrival=>arrival.operativeId===rearPhysician);assert.ok(rearArrival);assert.equal(rearArrival.destination,'buenos_aires');assert.equal(rearArrival.travelHours,6);assert.equal(rearCash-s.resources.treasury,rearQuote.price);assert.ok(!s.recruited.includes(rearPhysician));
 report({event:'rearClinicBooked',id:rearPhysician,cost:rearQuote.price,bookedAt:rearArrival.bookedAt,dueAt:rearArrival.dueAt,destination:rearArrival.destination});
 report({event:'columnsLoaded',hour:s.hour,squads:s.squads,units:stagingUnits([...s.squads.find(q=>q.id===field).members,...supportIds])});
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=order(s,{type:'attack',sector:'cordoba',queue:true});}
 for(let hour=0;hour<24&&![field,support].every(id=>s.squads.find(q=>q.id===id)?.journey?.status==='ready');hour++)s=order(s,{type:'wait',hours:1});
 assert.ok(s.recruited.includes(rearPhysician));assert.equal(s.operativeState[rearPhysician].location,'buenos_aires');assert.equal(s.contracts[rearPhysician].started,rearArrival.dueAt);
 s=order(s,{type:'assignCare',operativeId:rearPhysician,assignment:'doctor'});
 report({event:'columnsArrived',hour:s.hour,squads:s.squads,units:stagingUnits([...s.squads.find(q=>q.id===field).members,...supportIds])});
 s=order(s,{type:'beginAssault',sector:'cordoba'});assert.equal(s.pendingBattle.squad.length,12);onCheckpoint?.('cordoba-ready',s,notes);
 for(const sector of ['cordoba']){
  const support=sector==='tucuman'?prepareNorthernSupport(s,sector):null;
  if(support)s=support.campaign;
  if(!s.pendingBattle){s=finishReloadsBeforeMarch(s);s=marchToFront(s,{type:'attack',sector});s=order(s,{type:'attack',sector});}assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  // Use the shared floor-aware squad controller and record every order for
  // replay. Interruptions retain their actual participants and AP budgets.
  const {battle,orders,actions}=fight(request,previous,{controller:northernClearShotOrder});assert.equal(battle.status,'victory',sector);
  let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);
  const before=p.campaign.resources.treasury;const record={sector,actions,turns:battle.turn,hour:p.campaign.hour,second:p.campaign.secondOfHour,support:support&&{ids:support.ids,cost:support.cost},units:battle.units.filter(u=>u.side==='player').map(({id,hp,bleeding,medkits,routed})=>({id,hp,bleeding,medkits,routed}))};
  p=tactical(p,{type:'explore'});
  const criticalAid=autoBandageBattle(p.battle);p=sync({campaign:p.campaign,battle:criticalAid.battle});report({event:'northernPostBattleAid',sector,elapsedSeconds:criticalAid.elapsedSeconds,steps:criticalAid.steps});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){
   const current=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(current,current).valid)p=tactical(p,{type:'heal',unitId:actor.id});
  }
  p=saved(p);const battleReport={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,battleReport)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,battleReport).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));
  const deaths=deadIds(s);for(const id of deaths){assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
  // A routed support squad may be selected at its retreat destination. Keep
  // that evacuation real, and select the surviving local field command.
  const local=s.squads.find(q=>q.location===sector&&q.members.some(id=>s.operativeState[id].alive&&!s.operativeState[id].captured));assert.ok(local,'the victory must retain a living local field command');
  s=order(s,{type:'selectSquad',id:local.id});
  if(sector!=='cordoba'){
   const survivors=s.recruited.filter(id=>{const r=s.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp>=15;});
   s=order(s,{type:'squad',ids:survivors.slice(0,6)});
  }
  if(hasWorkshop(s,s.location))for(const id of s.squad)for(const type of ['resupply','repairWeapon']){
   const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}
  }
  const affordable=rosterFor(s).filter(o=>o.id>=100&&contractQuote(s,o,'week').price<=routeHiringCeiling(s,200)).sort((a,b)=>contractQuote(s,a,'week').price-contractQuote(s,b,'week').price||a.id-b.id).map(o=>o.id);
  const candidates=[...new Set([115,123,114,137,113,124,112,134,139,108,111,117,121,126,129,133,130,...affordable])].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=candidates.slice(0,6-s.squad.length);
  assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const at=s.location;
  for(const id of replacements){const quote=contractQuote(s,rosterFor(s).find(op=>op.id===id),'week'),cash=s.resources.treasury;assert.ok(quote.available,quote.reason);s=order(s,{type:'recruitCivic',id,term:'week',destination:at});assert.equal(cash-s.resources.treasury,quote.price);}
  if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:advanceCampaignHours(s,6)}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===at));}
  s=rearm(s);
  if(hasWorkshop(s,s.location))for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}}
  s=supplyRouteAmmunition(s,s.squad).campaign;
  s=recoverNorthernLocalPatients(s,{report});
  s=meetNorthernRearPort(s,rearPhysician,{report});
  notes.push({...record,fundsBeforeSettlement:before,fundsAfterReplacements:s.resources.treasury,replacements,deaths});onCheckpoint?.(sector,s,notes);
 }
 const readyDefense=prepareHiredNorthernDefense(s);onCheckpoint?.('cordoba-defense-ready',readyDefense,notes);
 const defense=fightNorthernSector(readyDefense,'cordoba',{controller:cautiousCombatOrder});onCheckpoint?.('cordoba-defense',defense.campaign,notes);
 const readyTucuman=prepareFreshTucumanAssault(defense.campaign,{artillerySupport:true});onCheckpoint?.('tucuman-ready',readyTucuman,notes);
 const tucuman=fightNorthernSector(readyTucuman,'tucuman',{controller:coastalBatteryController(enterSector(readyTucuman.pendingBattle,readyTucuman.sectorStates.tucuman),{sharedArtillerySight:true})});
 s=tucuman.campaign;notes.push({...tucuman.summary,deaths:deadIds(s),defense:defense.summary});onCheckpoint?.('tucuman',s,notes);
 const readySalta=prepareNorthernOfficerRelief(s,{report}),gun=readySalta.pendingBattle.artillery.find(piece=>piece.side==='player');assert.ok(gun,'the northern crew must deploy the actually recovered and transported gun');onCheckpoint?.('salta-ready',readySalta,notes);
 const salta=fightNorthernSector(readySalta,'salta',{controller:northernOfficerSaltaController(enterSector(readySalta.pendingBattle,readySalta.sectorStates.salta))});
 s=salta.campaign;notes.push({...salta.summary,deaths:deadIds(s)});onCheckpoint?.('salta',s,notes);
 s=completeHiredNorthernMission(s,{report});
 assert.equal(s.flags.northPact,true);assert.equal(s.flags.partisanSupply,true);assert.ok(isSupplied(s,'salta'));assert.equal(s.pendingBattle,null);
 const ending={stage:'yatasto',hour:s.hour,second:s.secondOfHour,phase:s.phase,funds:s.resources.treasury,squad:[...s.squad],deaths:deadIds(s)};notes.push(ending);onCheckpoint?.('yatasto',s,notes);
 return {campaign:s,notes,prefix:prefix.notes};
}

// Preserve each route's native battle controller, staffing and recovery work.
export function freshNorthernRoute(options={}){
 const routeKind=options.routeKind??'created';
 assert.ok(['created','stock'].includes(routeKind),'the northern campaign needs an authored route kind');
 return routeKind==='stock'?freshStockNorthernRoute({...options,routeKind}):freshCreatedNorthernRoute(options);
}

function freshStockNorthernRoute({onCheckpoint,report=()=>{},routeKind='created',coastalCheckpoint,openingCheckpoint}={}){
 const prefix=coastalCheckpoint??freshCoastalRoute(routeKind,{onCheckpoint,report,openingCheckpoint});let s=prefix.campaign;const notes=[];
 const stagingUnits=ids=>ids.map(id=>{const r=s.operativeState[id];return {id,hp:r.hp,alive:r.alive,captured:r.captured,location:r.location,energy:r.energy,fatigue:r.fatigue,asleep:r.asleep,morale:r.morale,contract:s.contracts[id]};});
 if(routeKind==='stock'&&s.squad.some(id=>s.operativeState[id].bleeding>0)){
  const patients=s.squad.filter(id=>s.operativeState[id].bleeding>0),doctor=rosterFor(s).filter(o=>s.squad.includes(o.id)&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&!s.operativeState[o.id].asleep&&o.medical>0).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living local doctor must stabilize the actual wounded before waiting for relief');
  const found=collectRouteItems(s,doctor.id,{item:'medkits'},patients.length);s=found.campaign;assert.equal(found.collected,patients.length,'the actual local bodies must supply each field dressing');
  const p=visit(s),aid=autoBandageBattle(p.battle);s=leave(sync({campaign:p.campaign,battle:aid.battle}));s=saved({campaign:s}).campaign;
  assert.ok(patients.every(id=>s.operativeState[id].alive&&s.operativeState[id].bleeding===0),'paid local aid must finish before the six-hour relief wait');
  notes.push({stage:'stock-northern-field-aid',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,doctorId:doctor.id,dressings:found.collected,orders:aid.steps,units:stagingUnits(patients)});onCheckpoint?.('stock-northern-field-aid',s,notes);report({event:'stockNorthernFieldAid',...notes.at(-1)});
 }
 // San Lorenzo leaves actual casualties. Keep surviving contracts, pay for
 // relief, recover finite rifles and finish care before the northern assault.
 for(const id of s.squad)if(s.contracts[id]?.expiresAt!=null&&s.contracts[id].expiresAt<s.hour+72)s=order(s,{type:'renewContract',id,term:'week',expectedExpiresAt:s.contracts[id].expiresAt});
 // Hire the available physician first so the actual wounded veterans have
 // competent paid care before filling the remaining infantry positions.
 const relief=[112,115,123,114,137,113,124,108,139,111].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)).slice(0,6-s.squad.length);
 for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);
 const rearm=state=>{const depot=visit(state),rearmed=equipOpeningRifles(depot.battle,state.squad);return leave(sync({campaign:depot.campaign,battle:rearmed.battle}));};
 const recovery=prepareLocalOpening(rearm(s),{buyWeapons:false,recovery:routeKind==='stock'?'rest':'doctor'});s=recovery.campaign;
 report({event:'northernOpeningRecovery',...recovery.care,hour:s.hour,second:s.secondOfHour,treasury:s.resources.treasury});
 report({event:'fieldRecovered',hour:s.hour,ids:s.squad,units:stagingUnits(s.squad)});
 const field=s.activeSquadId,supportIds=[119,127,103,104,111,140,100,101,102,105,106,117,118,121,122,126,129,130,133,134].filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.recruited.includes(id)).slice(0,6);assert.equal(supportIds.length,6);
 for(const id of supportIds)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);s=order(s,{type:'createSquad',ids:supportIds,name:'Apoyo de Córdoba',sector:s.location});const support=s.activeSquadId;s=rearm(s);
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=finishReloadsBeforeMarch(s);}
 report({event:'columnsLoaded',hour:s.hour,squads:s.squads,units:stagingUnits([...s.squads.find(q=>q.id===field).members,...supportIds])});
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=order(s,{type:'attack',sector:'cordoba',queue:true});}
 for(let hour=0;hour<24&&![field,support].every(id=>s.squads.find(q=>q.id===id)?.journey?.status==='ready');hour++)s=order(s,{type:'wait',hours:1});
 report({event:'columnsArrived',hour:s.hour,squads:s.squads,units:stagingUnits([...s.squads.find(q=>q.id===field).members,...supportIds])});
 s=order(s,{type:'beginAssault',sector:'cordoba'});assert.equal(s.pendingBattle.squad.length,12);
 for(const sector of ['cordoba']){
  const support=sector==='tucuman'?prepareNorthernSupport(s,sector):null;
  if(support)s=support.campaign;
  if(!s.pendingBattle){s=finishReloadsBeforeMarch(s);s=marchToFront(s,{type:'attack',sector});s=order(s,{type:'attack',sector});}assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  // Use the shared floor-aware squad controller and record every order for
  // replay. Interruptions retain their actual participants and AP budgets.
  const {battle,orders,actions}=fight(request,previous,{controller:hiredAssaultOrder});assert.equal(battle.status,'victory',sector);
  let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);
  const before=p.campaign.resources.treasury;const record={sector,status:battle.status,actions,turns:battle.turn,hour:p.campaign.hour,second:p.campaign.secondOfHour,support:support&&{ids:support.ids,cost:support.cost},units:battle.units.filter(u=>u.side==='player').map(({id,hp,bleeding,medkits,routed})=>({id,hp,bleeding,medkits,routed}))};
  p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){
   const current=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(current,current).valid)p=tactical(p,{type:'heal',unitId:actor.id});
  }
  p=saved(p);const resultReport={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,resultReport)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,resultReport).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));
  const deaths=deadIds(s);for(const id of deaths){assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
  // A routed support squad may be selected at its retreat destination. Keep
  // that evacuation real, and select the surviving local field command.
  const local=s.squads.find(q=>q.location===sector&&q.members.some(id=>s.operativeState[id].alive&&!s.operativeState[id].captured));assert.ok(local,'the victory must retain a living local field command');
  s=order(s,{type:'selectSquad',id:local.id});
  if(sector!=='cordoba'){
   const survivors=s.recruited.filter(id=>{const r=s.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp>=15;});
   s=order(s,{type:'squad',ids:survivors.slice(0,6)});
  }
  const affordable=rosterFor(s).filter(o=>o.id>=100&&contractQuote(s,o,'week').price<=routeHiringCeiling(s,200)).sort((a,b)=>contractQuote(s,a,'week').price-contractQuote(s,b,'week').price||a.id-b.id).map(o=>o.id);
  const candidates=[...new Set([115,123,114,137,113,124,112,134,139,108,111,117,121,126,129,133,130,...affordable])].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=candidates.slice(0,6-s.squad.length);
  assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const at=s.location;
  for(const id of replacements)s=order(s,{type:'recruitCivic',id,term:'week',destination:at});
  if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===at));}
  s=rearm(s);
  s=supplyRouteAmmunition(s,s.squad).campaign;
  notes.push({...record,fundsBeforeSettlement:before,fundsAfterReplacements:s.resources.treasury,replacements,deaths});onCheckpoint?.(sector,s,notes);report({event:'northernBattleSettled',...notes.at(-1)});
 }
 const defense=fightNorthernSector(prepareHiredNorthernDefense(s),'cordoba',{controller:cautiousCombatOrder,report});
 onCheckpoint?.('cordoba-defense',defense.campaign,[...notes,defense.summary]);
 const recoveryReport=event=>{
  if(event.event==='tucumanRecoveryDefense'){
   const record={...event.summary,stage:'recovery-defense',groupId:event.groupId,deaths:deadIds(event.campaign)};
   notes.push(record);onCheckpoint?.('tucuman-recovery-defense',event.campaign,notes);
  }else if(event.event==='tucumanRecoveryInterrupted'&&event.rest){
   notes.push({event:event.event,stage:'recovery-rest-interruption',groupId:event.groupId,sector:event.sector,hour:event.hour,second:event.second,rest:structuredClone(event.rest)});
  }else if(['tucumanRecoveryFortified','tucumanRestRecovery'].includes(event.event)){
   notes.push({...event,stage:event.event});
  }
  report(event);
 };
 const ready=prepareFreshTucumanAssault(defense.campaign,{report:recoveryReport,recovery:routeKind==='stock'?'rest':'doctor',prepareDeparture:routeKind==='stock'?recovered=>{
  const prepared=prepareStockTucumanReadiness(recovered,{report}),receipt=prepared.receipt;
  notes.push({stage:'stock-tucuman-readiness',hour:prepared.campaign.hour,second:prepared.campaign.secondOfHour,paid:receipt.paid,rear:receipt.rear,hireCost:receipt.paidHireCost,renewalCost:receipt.renewalCost,gun:receipt.gun});
  return prepared.campaign;
 }:null});
 const controller=routeKind==='stock'?coastalBatteryController(enterSector(ready.pendingBattle,ready.sectorStates.tucuman),{sharedArtillerySight:true}):tucumanCombatOrder;
 const tucuman=fightNorthernSector(ready,'tucuman',{controller,report});
 s=tucuman.campaign;notes.push({...tucuman.summary,deaths:deadIds(s),defense:defense.summary});onCheckpoint?.('tucuman',s,notes);
 const reliefCampaign=prepareNorthernOfficerRelief(s,{report,routeKind}),saltaInitial=enterSector({...reliefCampaign.pendingBattle,hour:reliefCampaign.hour,secondOfHour:reliefCampaign.secondOfHour??0},reliefCampaign.sectorStates.salta);
 // Bind the real two-person battery to capable issued bodies. The controller
 // uses this list only to choose roles; every order resolves on the full field.
 const crewScene={...saltaInitial,units:saltaInitial.units.filter(unit=>unit.side!=='player'||unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.surrendered&&!unit.departure&&!unit.fled&&!unit.asleep&&!unit.knockedDown&&!unit.entangled&&(unit.energy??100)>0)};
 const salta=fightNorthernSector(reliefCampaign,'salta',{controller:routeKind==='stock'?stockNorthernSaltaController(saltaInitial):assignedMountainBatteryController(crewScene),report});
 s=salta.campaign;notes.push({...salta.summary,deaths:deadIds(s)});onCheckpoint?.('salta',s,notes);
 s=completeHiredNorthernMission(s,{report,routeKind});
 assert.equal(s.flags.northPact,true);assert.equal(s.flags.partisanSupply,true);assert.ok(isSupplied(s,'salta'));assert.equal(s.pendingBattle,null);
 const ending={stage:'yatasto',hour:s.hour,second:s.secondOfHour,phase:s.phase,funds:s.resources.treasury,squad:[...s.squad],deaths:deadIds(s)};notes.push(ending);onCheckpoint?.('yatasto',s,notes);
 return {campaign:s,notes,prefix:prefix.notes};
}
