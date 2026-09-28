import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultProfile} from '../game/character-profile.js';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {fight} from './coastal-route-driver.mjs';
import {order,visit,leave,saved,sync} from './local-contract-fixture.mjs';

const profile=()=>({...defaultProfile(),classId:'soldado',attributes:{maxHp:85,agility:75,dexterity:75,strength:55,leadership:35,wisdom:35,marksmanship:85,mechanical:35,explosives:35,medical:35}});
const stock=()=>initialCampaign(8,defaultContentPackage());
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const actorStates=b=>b.units.filter(u=>u.side==='player').map(({id,hp,bleeding,medkits,routed})=>({id,hp,bleeding,medkits,routed}));

function recruitCabral(s){
 let p=visit(s);const npc=p.battle.npcs.find(n=>n.operativeId===3),actor=p.battle.units.find(u=>u.hp>0),spot=getReachable(p.battle,actor).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot);
 if(spot.cost)p=tactical(p,{type:'move',unitId:actor.id,x:spot.x,y:spot.y});
 s=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:Number(actor.id),approach:'recruit',sectorState:p.battle});
 const record=s.pendingBattle.squad.find(u=>u.id===3);assert.ok(record);
 // Same civilian-to-squad projection as the mounted game; the recruitment order
 // provides the complete actor and retains the resident's actual health/location.
 p.battle.npcs=p.battle.npcs.filter(n=>n.id!==npc.id);p.battle.units.push({...createBattle([record],{width:p.battle.width,height:p.battle.height,exploration:true,enemies:[]}).units[0],x:npc.x,y:npc.y});
 return saved({campaign:leave(saved({campaign:s,battle:p.battle}))}).campaign;
}

export function freshCoastalRoute(kind,{onCheckpoint}={}){
 let s=stock();const notes=[],dead=new Set();
 assert.deepEqual(Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'),['retiro']);assert.equal(s.resources.treasury,3200);assert.deepEqual(s.recruited,[]);
 if(kind==='created'){
  s=order(s,{type:'createOfficer',name:'Isabel del Norte',profile:profile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
  assert.equal(s.resources.treasury,3200);assert.equal(s.contracts[1000].paid,0);s=recruitCabral(s);
 }else assert.equal(kind,'hired');
 const first=kind==='created'?[110,136,141,120]:[110,114,136,141,120,131];
 for(const id of first)s=order(s,{type:'recruitCivic',id,term:'week'});
 assert.equal(s.hiringArrivals.length,first.length);assert.ok(first.every(id=>!s.recruited.includes(id)));
 s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;
 assert.ok(first.every(id=>s.recruited.includes(id)&&s.contracts[id].started===6));notes.push({stage:'ready',hour:s.hour,funds:s.resources.treasury,squad:[...s.squad]});
 for(const sector of ['buenos_aires','san_nicolas','san_lorenzo']){
  s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const {battle,orders,actions}=fight(request,previous);assert.equal(battle.status,'victory',`${kind}: ${sector}`);
  // Replay every legal order with the normal campaign clock. Reload halfway
  // through the real engagement, then verify its deterministic final state.
  let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);
  const battleNotes={sector,actions,turns:battle.turn,hour:p.campaign.hour,second:p.campaign.secondOfHour,funds:p.campaign.resources.treasury,units:actorStates(battle)};
  for(const u of battle.units.filter(u=>u.side==='player'&&!u.missionAlly&&u.hp===0))dead.add(Number(u.id));
  if(sector==='san_lorenzo')assert.ok(battle.units.some(u=>u.id==='57'&&u.missionAlly&&u.hp>0));
  p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){
   const current=p.battle.units.find(u=>u.id===actor.id);if(current.medkits&&(current.bleeding||current.hp<current.maxHp-15))p=tactical(p,{type:'heal',unitId:actor.id});
  }
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
  s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);
  for(const id of dead){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'week'}).lastError);}
  notes.push({...battleNotes,settledFunds:s.resources.treasury,phase:s.phase,deaths:[...dead]});onCheckpoint?.(sector,s,notes);
  if(sector!=='san_lorenzo'){
   const available=[131,136,141,137,113,124,112,108].filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)),replacements=available.slice(0,6-s.squad.length);
   assert.ok(hiringArrivalOptions(s).some(o=>o.id===s.location));const location=s.location;
   for(const id of replacements)s=order(s,{type:'recruitCivic',id,term:'week',destination:location});
   if(replacements.length){assert.ok(replacements.every(id=>!s.recruited.includes(id)));s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;assert.ok(replacements.every(id=>s.recruited.includes(id)&&s.operativeState[id].location===location));}
  }
 }
 assert.equal(s.phase,2);assert.equal(s.flags.sanLorenzo,true);assert.equal(s.missions.san_lorenzo.completed,true);assert.equal(s.missionAllies.san_lorenzo.hp>0,true);assert.equal(s.pendingBattle,null);assert.ok(s.resources.treasury>0);assert.ok(dead.size>0);assert.equal(s.completed,false);
 return {campaign:s,notes};
}
