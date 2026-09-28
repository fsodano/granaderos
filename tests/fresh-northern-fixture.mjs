import {firstAidPlan} from '../game/first-aid.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {hasWorkshop} from '../game/campaign-headquarters.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './coastal-route-driver.mjs';
import {order,saved,sync} from './local-contract-fixture.mjs';

const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deadIds=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

export function freshNorthernRoute({onCheckpoint}={}){
 const prefix=freshCoastalRoute('created');let s=prefix.campaign;const notes=[];
 for(const sector of ['cordoba','tucuman','salta']){
  s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  // Forest AP costs must not make the controller refuse every unseen forward
  // step. Actual movement still pays the ordinary terrain cost and energy.
  const {battle,orders,actions}=fight(request,previous,{scoutCostWeight:.01});assert.equal(battle.status,'victory',sector);
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
  if(hasWorkshop(s,s.location))for(const id of s.squad)for(const type of ['resupply','repairWeapon']){
   const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}
  }
  const candidates=[115,123,114,137,113,124,112,108,139,111].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=candidates.slice(0,6-s.squad.length);
  assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const at=s.location;
  for(const id of replacements)s=order(s,{type:'recruitCivic',id,term:'week',destination:at});
  if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===at));}
  notes.push({...record,fundsBeforeSettlement:before,fundsAfterReplacements:s.resources.treasury,replacements,deaths});onCheckpoint?.(sector,s,notes);
 }
 const paid=s.resources.treasury;s=order(s,{type:'diplomacy',kind:'northPact'});s=order(s,{type:'diplomacy',kind:'partisanSupply'});assert.equal(s.resources.treasury,paid-550);
 s=order(s,{type:'travel',sector:'tucuman'});assert.equal(s.location,'tucuman');assert.equal(s.phase,2);s=order(s,{type:'visitMission',mission:'yatasto'});
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
