import {firstAidPlan} from '../game/first-aid.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,isSupplied,civicStatus} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,createBattle,getReachable} from '../game/tactical.js';
import {artilleryCount} from '../game/economy.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';
import {fight} from './cuyo-route-driver.mjs';
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const dead=s=>Object.entries(s.operativeState).filter(([,v])=>!v.alive).map(([id])=>Number(id));
function workshop(s){for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const next=dispatchCampaign(s,{type,operativeId:id});if(!next.lastError){assert.ok(next.resources.treasury<s.resources.treasury);s=next;}}return s;}
function musket(s,id){const before=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:'firearm-1801',quantity:1});assert.equal(s.resources.treasury,before-230);const instance=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(instance);return order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:instance.id});}
function approach(p,npc,{medical=false}={}){
 const roster=rosterFor(p.campaign),actor=p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious&&(!medical||u.medkits>0)).sort((a,b)=>roster.find(o=>o.id===Number(b.id)).leadership-roster.find(o=>o.id===Number(a.id)).leadership)[0];
 const spot=getReachable(p.battle,actor).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot,npc.id);
 return {pair:spot.cost?tactical(p,{type:'move',unitId:actor.id,x:spot.x,y:spot.y}):p,actorId:actor.id};
}
function incorporate(s,id,{earlyCommanderCheck=false}={}){
 if(id===57&&s.squad.length===6){const resting=[...s.squad].sort((a,b)=>s.operativeState[a].hp-s.operativeState[b].hp)[0];s=order(s,{type:'squad',ids:s.squad.filter(other=>other!==resting)});assert.equal(s.operativeState[resting].location,s.location);}
 let p=visit(s);const npc=p.battle.npcs.find(n=>n.operativeId===id);assert.ok(npc&&npc.hp>0);
 if(npc.bleeding){const medic=approach(p,npc,{medical:true});p=tactical(medic.pair,{type:'heal',unitId:medic.actorId,targetId:npc.id});assert.equal(p.battle.npcs.find(n=>n.id===npc.id).bleeding,0);}
 const {pair,actorId}=approach(p,p.battle.npcs.find(n=>n.id===npc.id));p=pair;
 const campaign=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:Number(actorId),approach:'recruit',sectorState:p.battle}),record=campaign.pendingBattle.squad.find(u=>u.id===id),current=p.battle.npcs.find(n=>n.id===npc.id);
 assert.ok(campaign.recruited.includes(id));p.battle.npcs=p.battle.npcs.filter(n=>n.id!==npc.id);if(record)p.battle.units.push({...createBattle([record],{width:p.battle.width,height:p.battle.height,exploration:true,enemies:[]}).units[0],x:current.x,y:current.y});p=saved({campaign,battle:p.battle});
 if(earlyCommanderCheck){const commander=p.battle.npcs.find(n=>n.operativeId===57),near=approach(p,commander);p=near.pair;const denied=dispatchCampaign(p.campaign,{type:'talkNPC',npcId:commander.id,unitId:Number(near.actorId),approach:'recruit',sectorState:p.battle});assert.match(denied.lastError,/preparativos/);assert.ok(!denied.recruited.includes(57));}
 return saved({campaign:leave(p)}).campaign;
}
export function freshCuyoRoute({onCheckpoint}={}){
 const prefix=freshNorthernRoute();let s=prefix.campaign;const notes=[];
 for(const sector of Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'))s=order(s,{type:'fortify',sector});
 s=order(s,{type:'travel',sector:'cordoba'});s=order(s,{type:'recruitCivic',id:108,term:'week',destination:'cordoba'});s=order(s,{type:'wait',hours:6});s=workshop(s);
 for(const id of s.squad)if(rosterFor(s).find(o=>o.id===id).weapon!==1802)s=musket(s,id);
 s=saved({campaign:s}).campaign;assert.equal(s.hour,120);assert.equal(s.resources.treasury,2416);
 for(const sector of ['mendoza','uspallata','los_patos']){
  if(sector==='los_patos'){
   // The mountain casualties need replacements from the controlled reception
   // site. Pay their contracts and muskets, then return along the actual road.
   s=order(s,{type:'travel',sector:'mendoza'});s=order(s,{type:'wait',hours:24});const relief=[125,103,127,112,104,117,139].filter(id=>civicStatus(s,id).available).slice(0,6-s.squad.length);
   for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:'mendoza'});if(relief.length)s=order(s,{type:'wait',hours:6});s=workshop(s);for(const id of relief)s=musket(s,id);s=order(s,{type:'travel',sector:'uspallata'});
   notes.push({stage:'mountain-relief',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,relief,squad:[...s.squad]});onCheckpoint?.('mountain-relief',s,notes);
  }
  onCheckpoint?.(`approach-${sector}`,s,notes);s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const {battle,orders,actions}=fight(request,previous,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(battle.status,'victory',sector);let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.deepEqual(p.battle.npcs,battle.npcs);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){const u=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(u,u).valid)p=tactical(p,{type:'heal',unitId:u.id});}
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));assert.equal(s.operativeState[2].alive,true);assert.equal(s.operativeState[57].alive,true);
  notes.push({stage:sector,hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],actions,turns:battle.turn,deaths:dead(s),engineerHp:s.operativeState[2].hp,commanderHp:s.operativeState[57].hp});
  if(sector==='mendoza'){
   s=incorporate(s,2,{earlyCommanderCheck:true});assert.equal(s.operativeState[2].bleeding,0);s=order(s,{type:'foundry'});s=order(s,{type:'diplomacy',kind:'parliament'});s=order(s,{type:'squad',ids:s.squad.filter(id=>id!==2)});assert.equal(s.operativeState[2].location,'mendoza');
   assert.ok(hiringArrivalOptions(s).some(o=>o.id==='mendoza'));for(const id of [134,111])s=order(s,{type:'recruitCivic',id,term:'week',destination:'mendoza'});
   assert.ok([134,111].every(id=>!s.recruited.includes(id)));s=order(s,{type:'wait',hours:6});assert.ok([134,111].every(id=>s.recruited.includes(id)));s=workshop(s);for(const id of [134,111])s=musket(s,id);
  }
  s=saved({campaign:order(s,{type:'fortify',sector})}).campaign;onCheckpoint?.(sector,s,notes);
 }
 assert.equal(s.phase,3);assert.equal(s.flags.armyFunded,false);assert.equal(artilleryCount(s),0);assert.ok(!s.recruited.includes(57));
 for(const id of s.squad)if(s.contracts[id].expiresAt!==null&&s.contracts[id].expiresAt<s.hour+73)s=order(s,{type:'renewContract',id,term:'week'});const money=s.resources.treasury;s=order(s,{type:'wait',hours:72});assert.equal(s.resources.treasury-money,2520);assert.ok(s.squad.length>0);
 const before=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:'swivel',quantity:3});s=order(s,{type:'fundArmy'});assert.equal(s.resources.treasury,before-4200);assert.equal(artilleryCount(s),3);assert.equal(s.phase,4);assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);
 s=saved({campaign:s}).campaign;notes.push({stage:'funded',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,phase:s.phase,artillery:artilleryCount(s)});onCheckpoint?.('funded',s,notes);
 s=order(s,{type:'travel',sector:'mendoza'});s=incorporate(s,57);assert.equal(s.contracts[57].expiresAt,null);assert.equal(s.contracts[57].paid,0);assert.ok(s.squad.includes(57));assert.equal(s.operativeState[57].hp,88);assert.equal(s.operativeState[2].alive,true);assert.equal(s.operativeState[1000].alive,false);assert.equal(s.defeated,false);assert.equal(s.completed,false);assert.equal(s.pendingBattle,null);assert.ok(s.resources.treasury>0);
 notes.push({stage:'commander',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,phase:s.phase,squad:[...s.squad],deaths:dead(s),engineerHp:s.operativeState[2].hp,commanderHp:s.operativeState[57].hp});onCheckpoint?.('commander',s,notes);
 return {campaign:s,notes,prefix:prefix.notes};
}
