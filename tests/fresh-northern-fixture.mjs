import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {prepareHiredNorthernDefense,prepareNorthernOfficerRelief,completeHiredNorthernMission} from './fresh-northern-command.mjs';
import {prepareFreshTucumanAssault} from './fresh-campaign-route.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {assignedMountainBatteryController} from './mountain-battery-driver.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {prepareLocalOpening} from './local-opening-care-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {marchToFront,completeTestTravel} from './campaign-test-helpers.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {prepareNorthernSupport} from './northern-support-fixture.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';

const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deadIds=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

export function freshNorthernRoute({onCheckpoint,report=()=>{},routeKind='created',coastalCheckpoint,openingCheckpoint}={}){
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
  }else if(['tucumanRecoveryFortified','tucumanRestRecovery'].includes(event.event)){
   notes.push({...event,stage:event.event});
  }
  report(event);
 };
 const tucuman=fightNorthernSector(prepareFreshTucumanAssault(defense.campaign,{report:recoveryReport,recovery:routeKind==='stock'?'rest':'doctor'}),'tucuman',{controller:tucumanCombatOrder,report});
 s=tucuman.campaign;notes.push({...tucuman.summary,deaths:deadIds(s),defense:defense.summary});onCheckpoint?.('tucuman',s,notes);
 const reliefCampaign=prepareNorthernOfficerRelief(s,{report}),saltaInitial=enterSector({...reliefCampaign.pendingBattle,hour:reliefCampaign.hour,secondOfHour:reliefCampaign.secondOfHour??0},reliefCampaign.sectorStates.salta);
 // Bind the real two-person battery to capable issued bodies. The controller
 // uses this list only to choose roles; every order resolves on the full field.
 const crewScene={...saltaInitial,units:saltaInitial.units.filter(unit=>unit.side!=='player'||unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.surrendered&&!unit.departure&&!unit.fled&&!unit.asleep&&!unit.knockedDown&&!unit.entangled&&(unit.energy??100)>0)};
 const salta=fightNorthernSector(reliefCampaign,'salta',{controller:routeKind==='stock'?cautiousCombatOrder:assignedMountainBatteryController(crewScene),report});
 s=salta.campaign;notes.push({...salta.summary,deaths:deadIds(s)});onCheckpoint?.('salta',s,notes);
 s=completeHiredNorthernMission(s,{report});
 assert.equal(s.flags.northPact,true);assert.equal(s.flags.partisanSupply,true);assert.ok(isSupplied(s,'salta'));assert.equal(s.pendingBattle,null);
 const ending={stage:'yatasto',hour:s.hour,second:s.secondOfHour,phase:s.phase,funds:s.resources.treasury,squad:[...s.squad],deaths:deadIds(s)};notes.push(ending);onCheckpoint?.('yatasto',s,notes);
 return {campaign:s,notes,prefix:prefix.notes};
}
