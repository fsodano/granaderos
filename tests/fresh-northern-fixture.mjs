import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {prepareLocalOpening} from './local-opening-care-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {marchToFront,completeTestTravel} from './campaign-test-helpers.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {hasWorkshop} from '../game/campaign-headquarters.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';

const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deadIds=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

export function freshNorthernRoute({onCheckpoint}={}){
 const prefix=freshCoastalRoute('created');let s=prefix.campaign;const notes=[];
 // San Lorenzo leaves actual casualties. Keep surviving contracts, pay for
 // relief, recover finite rifles and finish care before the northern assault.
 for(const id of s.squad)if(s.contracts[id]?.expiresAt!=null&&s.contracts[id].expiresAt<s.hour+72)s=order(s,{type:'renewContract',id,term:'week',expectedExpiresAt:s.contracts[id].expiresAt});
 const relief=[115,123,114,137,113,124,112,108,139,111].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)).slice(0,6-s.squad.length);
 for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);
 const rearm=state=>{const depot=visit(state),rearmed=equipOpeningRifles(depot.battle,state.squad);return leave(sync({campaign:depot.campaign,battle:rearmed.battle}));};
 s=prepareLocalOpening(rearm(s),{buyWeapons:false}).campaign;
 const field=s.activeSquadId,supportIds=[119,127,103,104,111,140].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id));assert.equal(supportIds.length,6);
 for(const id of supportIds)s=order(s,{type:'recruitCivic',id,term:'week',destination:s.location});
 s=advanceCampaignHours(s,6);s=order(s,{type:'createSquad',ids:supportIds,name:'Apoyo de Córdoba',sector:s.location});const support=s.activeSquadId;s=rearm(s);
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=finishReloadsBeforeMarch(s);}
 for(const id of [field,support]){s=order(s,{type:'selectSquad',id});s=order(s,{type:'attack',sector:'cordoba',queue:true});}
 for(let hour=0;hour<24&&![field,support].every(id=>s.squads.find(q=>q.id===id)?.journey?.status==='ready');hour++)s=order(s,{type:'wait',hours:1});
 s=order(s,{type:'beginAssault',sector:'cordoba'});assert.equal(s.pendingBattle.squad.length,12);
 for(const sector of ['cordoba','tucuman','salta']){
  if(!s.pendingBattle){s=finishReloadsBeforeMarch(s);s=marchToFront(s,{type:'attack',sector});s=order(s,{type:'attack',sector});}assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  // Use the shared floor-aware squad controller and record every order for
  // replay. Interruptions retain their actual participants and AP budgets.
  const {battle,orders,actions}=fight(request,previous,{controller:hiredAssaultOrder});assert.equal(battle.status,'victory',sector);
  let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);
  const before=p.campaign.resources.treasury;const record={sector,actions,turns:battle.turn,hour:p.campaign.hour,second:p.campaign.secondOfHour,units:battle.units.filter(u=>u.side==='player').map(({id,hp,bleeding,medkits,routed})=>({id,hp,bleeding,medkits,routed}))};
  p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){
   const current=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(current,current).valid)p=tactical(p,{type:'heal',unitId:actor.id});
  }
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));
  const deaths=deadIds(s);for(const id of deaths){assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
  // A routed support squad may be selected at its retreat destination. Keep
  // that evacuation real, and select the surviving local field command.
  const local=s.squads.find(q=>q.location===sector&&q.members.some(id=>s.operativeState[id].alive&&!s.operativeState[id].captured));assert.ok(local,'the victory must retain a living local field command');
  s=order(s,{type:'selectSquad',id:local.id});
  if(hasWorkshop(s,s.location))for(const id of s.squad)for(const type of ['resupply','repairWeapon']){
   const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}
  }
  const candidates=[115,123,114,137,113,124,112,134,139,108,111,117,121,126,129,133,130].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=candidates.slice(0,6-s.squad.length);
  assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const at=s.location;
  for(const id of replacements)s=order(s,{type:'recruitCivic',id,term:'week',destination:at});
  if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===at));}
  s=rearm(s);
  if(hasWorkshop(s,s.location))for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}}
  s=supplyRouteAmmunition(s,s.squad).campaign;
  notes.push({...record,fundsBeforeSettlement:before,fundsAfterReplacements:s.resources.treasury,replacements,deaths});onCheckpoint?.(sector,s,notes);
 }
 const paid=s.resources.treasury;s=order(s,{type:'diplomacy',kind:'northPact'});s=order(s,{type:'diplomacy',kind:'partisanSupply'});assert.equal(s.resources.treasury,paid-550);
 s=completeTestTravel(s,{sector:'tucuman'});assert.equal(s.location,'tucuman');assert.equal(s.phase,2);s=order(s,{type:'visitMission',mission:'yatasto'});
 let p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},s.sceneStates.yatasto)});
 assert.ok(dispatchCampaign(s,{type:'finishMission',battleId:s.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')}).lastError);
 for(const npcId of ['yatasto-belgrano','yatasto-san-martin','yatasto-san-martin']){
  const npc=p.battle.npcs.find(n=>n.id===npcId),actor=p.battle.units.find(u=>u.side==='player'&&u.hp>0&&!u.unconscious),spot=getReachable(p.battle,actor).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot,npcId);
  if(spot.cost)p=tactical(p,{type:'move',unitId:actor.id,x:spot.x,y:spot.y});
  const campaign=order(p.campaign,{type:'talkNPC',npcId,approach:'mission',unitId:Number(actor.id),sectorState:p.battle});p=saved({campaign,battle:p.battle});
 }
 const finished={type:'finishMission',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
 s=saved({campaign:order(p.campaign,finished)}).campaign;assert.ok(dispatchCampaign(s,finished).lastError);
 assert.equal(s.phase,3);assert.equal(s.missions.yatasto.completed,true);assert.equal(s.flags.northPact,true);assert.equal(s.flags.partisanSupply,true);assert.ok(isSupplied(s,'salta'));assert.equal(s.operativeState[1000].alive,false);assert.equal(s.operativeState[10].alive,false);assert.equal(s.operativeState[57].hp,88);assert.ok(!s.recruited.includes(57));assert.equal(s.defeated,false);assert.equal(s.completed,false);assert.equal(s.pendingBattle,null);
 const ending={stage:'yatasto',hour:s.hour,second:s.secondOfHour,phase:s.phase,funds:s.resources.treasury,squad:[...s.squad],deaths:deadIds(s)};notes.push(ending);onCheckpoint?.('yatasto',s,notes);
 return {campaign:s,notes,prefix:prefix.notes};
}
