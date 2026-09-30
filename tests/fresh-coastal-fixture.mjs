import {travelLegHours} from '../game/squad-travel.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {approachNPC} from './approach-npc.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultProfile} from '../game/character-profile.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {fight as cautiousFight} from './cuyo-route-driver.mjs';
import {prepareLocalOpening} from './local-opening-care-fixture.mjs';
import {order,visit,leave,saved,sync} from './local-contract-fixture.mjs';

const profile=()=>({...defaultProfile(),classId:'soldado',attributes:{maxHp:85,agility:75,dexterity:75,strength:55,leadership:35,wisdom:35,marksmanship:85,mechanical:35,explosives:35,medical:35}});
const stock=()=>initialCampaign(8,defaultContentPackage());
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const actorStates=b=>b.units.filter(u=>u.side==='player').map(({id,hp,bleeding,medkits,routed})=>({id,hp,bleeding,medkits,routed}));

function recruitLocal(s,id=3){
 let p=visit(s);const npc=p.battle.npcs.find(n=>n.operativeId===id),actor=p.battle.units.find(u=>u.hp>=15&&!u.unconscious&&!u.routed);assert.ok(npc);assert.ok(actor);
 p=sync({campaign:p.campaign,battle:approachNPC(p.battle,actor.id,npc.id)});
 s=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:Number(actor.id),approach:'recruit',sectorState:p.battle});
 const record=s.pendingBattle.squad.find(u=>u.id===id);assert.ok(record);
 // Same civilian-to-squad projection as the mounted game; the recruitment order
 // provides the complete actor and retains the resident's actual health/location.
 p.battle.npcs=p.battle.npcs.filter(n=>n.id!==npc.id);p.battle.units.push({...createBattle([record],{width:p.battle.width,height:p.battle.height,exploration:true,enemies:[]}).units[0],x:npc.x,y:npc.y});
 return saved({campaign:leave(saved({campaign:s,battle:p.battle}))}).campaign;
}

export function freshCoastalRoute(kind,{onCheckpoint,onReplayFailure}={}){
 let s=stock();const notes=[],dead=new Set();
 assert.deepEqual(Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'),['retiro']);assert.equal(s.resources.treasury,3200);assert.deepEqual(s.recruited,[]);
 if(kind==='created'||kind==='local'){
  const chosen=profile();if(kind==='local'){chosen.attributes.strength=40;chosen.attributes.leadership=50;}
  s=order(s,{type:'createOfficer',name:'Isabel del Norte',profile:chosen,answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
  assert.equal(s.resources.treasury,3200);assert.equal(s.contracts[1000].paid,0);s=recruitLocal(s);
 }else assert.equal(kind,'hired');
 if(kind==='local'){
  s=order(s,{type:'purchaseEquipment',item:'firearm-1801',quantity:1});const gun=s.armoryItems.find(i=>i.itemMetadata?.contentWeapon?.template===1801);
  s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:'firearm-1801',instanceId:gun.id});assert.equal(s.resources.treasury,2960);assert.equal(s.operativeState[1000].ammo+s.operativeState[1000].carriedLoaded,10);
 }
 const first=kind==='local'?[]:kind==='created'?[110,136,141,120]:[110,114,136,141,120,131];
 for(const id of first)s=order(s,{type:'recruitCivic',id,term:'week'});
 assert.equal(s.hiringArrivals.length,first.length);assert.ok(first.every(id=>!s.recruited.includes(id)));
 s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;
 assert.ok(first.every(id=>s.recruited.includes(id)&&s.contracts[id].started===6));notes.push({stage:'ready',hour:s.hour,funds:s.resources.treasury,squad:[...s.squad]});
 for(const sector of ['buenos_aires','san_nicolas','san_lorenzo']){
  if(kind==='local'&&sector==='san_nicolas'){
   // The twelve-hour approach must arrive in daylight. The small local force
   // cannot scout this town as if night visibility were the daytime range.
   const wait=(12-travelLegHours(s.location,sector)-s.hour%24+48)%24;if(wait)s=advanceCampaignHours(s,wait);
  }
  if(kind==='local'&&sector!=='buenos_aires')s=finishReloadsBeforeMarch(s);
  s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const {battle,orders,actions}=cautiousFight(request,previous,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true,holdPosition:sector==='san_lorenzo'?(kind==='local'?['10','57']:['57']):[]});assert.equal(battle.status,'victory',`${kind}: ${sector}; ${JSON.stringify(battle.units.filter(u=>u.hp>0&&!u.routed&&!u.unconscious).map(({id,side,x,y,hp,energy,loaded,ammo})=>({id,side,x,y,hp,energy,loaded,ammo})))}`);
  // Replay every legal order with the normal campaign clock. Reload halfway
  // through the real engagement, then verify its deterministic final state.
  let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){
   try{p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
   catch(error){onReplayFailure?.({sector,index:i,action:orders[i],before:p});throw error;}
  }
  assert.deepEqual(p.battle.units,battle.units);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);
  const battleNotes={sector,actions,turns:battle.turn,hour:p.campaign.hour,second:p.campaign.secondOfHour,funds:p.campaign.resources.treasury,units:actorStates(battle)};
  for(const u of battle.units.filter(u=>u.side==='player'&&!u.missionAlly&&u.hp===0))dead.add(Number(u.id));
  if(sector==='san_lorenzo')assert.ok(battle.units.some(u=>u.id==='57'&&u.missionAlly&&u.hp>0));
  p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){
   const current=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(current,current).valid){p=tactical(p,{type:'weapon',unitId:actor.id,slot:'medical'});p=tactical(p,{type:'heal',unitId:actor.id});}
  }
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);
  for(const id of dead){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'week'}).lastError);}
  notes.push({...battleNotes,settledFunds:s.resources.treasury,phase:s.phase,deaths:[...dead]});onCheckpoint?.(sector,s,notes);
  if(kind==='local'&&sector==='buenos_aires'){
   s=recruitLocal(s,4);s=recruitLocal(s,10);const recovery=prepareLocalOpening(s);s=recovery.campaign;
   notes.push({stage:'local-recovery',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],...recovery.care});onCheckpoint?.('local-recovery',s,notes);
  }
  if(kind==='local'&&sector==='san_nicolas'){
   const recovery=prepareLocalOpening(s,{buyWeapons:false});s=recovery.campaign;
   const daylight=s.hour%24;if(daylight<6||daylight>=20)s=order(s,{type:'wait',hours:daylight<6?6-daylight:30-daylight});
   notes.push({stage:'local-final-recovery',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],...recovery.care});onCheckpoint?.('local-final-recovery',s,notes);
  }
  if(kind!=='local'&&sector!=='san_lorenzo'){
   const available=[131,136,141,137,113,124,112,108].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=available.slice(0,6-s.squad.length);
   assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const location=s.location;
   for(const id of replacements)s=order(s,{type:'recruitCivic',id,term:'week',destination:location});
   if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===location));}
   // Replacements may arrive with short guns. Recover rifles left by this
   // actual battle through ordinary approach, pickup and equipment orders.
   const depot=visit(s),rearmed=equipOpeningRifles(depot.battle,s.squad);
   s=leave(sync({campaign:depot.campaign,battle:rearmed.battle}));
   s=prepareLocalOpening(s,{buyWeapons:false}).campaign;
  }
 }
 assert.equal(s.phase,2);assert.equal(s.flags.sanLorenzo,true);assert.equal(s.missions.san_lorenzo.completed,true);assert.equal(s.missionAllies.san_lorenzo.hp>0,true);assert.equal(s.pendingBattle,null);assert.ok(s.resources.treasury>0);assert.ok(dead.size>0);assert.equal(s.completed,false);
 if(kind==='local'){
  assert.equal(s.hiringArrivals.length,0);assert.ok(Object.keys(s.contracts).every(id=>[1000,3,4,10].includes(Number(id))));
  assert.ok(s.recruited.every(id=>[1000,3,4,10].includes(id)));
 }
 return {campaign:s,notes};
}
