import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {freshCuyoRoute} from './fresh-cuyo-fixture.mjs';
import {fight} from './cuyo-route-driver.mjs';
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deaths=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
function renew(s,hours){for(const id of s.squad)if(s.contracts[id].expiresAt!==null&&s.contracts[id].expiresAt<s.hour+hours){const before=s.resources.treasury;s=order(s,{type:'renewContract',id,term:id===128||id===142?'day':'week'});assert.ok(s.resources.treasury<before);}return s;}
function workshop(s){for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:id});if(!n.lastError){assert.ok(n.resources.treasury<s.resources.treasury);s=n;}}return s;}

export function freshHistoricalEnding({onCheckpoint}={}){
 const prefix=freshCuyoRoute();let s=workshop(renew(prefix.campaign,60));const notes=[];
 s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});const instance=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(instance);s=order(s,{type:'equip',operativeId:57,slot:'weapon',itemId:'firearm-1801',instanceId:instance.id});assert.equal(s.resources.treasury,87);
 for(const [via,sector] of [['cordoba','santa_fe'],['buenos_aires','ensenada'],[null,'jujuy'],[null,'humahuaca']]){
  if(sector==='jujuy'){
   s=order(s,{type:'travel',sector:'cordoba'});s=workshop(s);s=order(s,{type:'travel',sector:'salta'});s=order(s,{type:'wait',hours:24});assert.ok(hiringArrivalOptions(s).some(o=>o.id==='salta'));
   const before=s.resources.treasury;for(const id of [128,142])s=order(s,{type:'recruitCivic',id,term:'day',destination:'salta'});assert.equal(s.resources.treasury,before-2780);assert.ok([128,142].every(id=>!s.recruited.includes(id)));s=order(s,{type:'wait',hours:6});assert.ok([128,142].every(id=>s.recruited.includes(id)&&s.contracts[id].started===s.hour&&s.contracts[id].expiresAt===s.hour+24));
   notes.push({stage:'northern-relief',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad]});onCheckpoint?.('relief',s,notes);
  }else s=renew(s,sector==='humahuaca'?25:60);
  if(via)s=order(s,{type:'travel',sector:via});s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const {battle,orders,actions}=fight(request,previous,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(battle.status,'victory',sector);let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.deepEqual(p.battle.npcs,battle.npcs);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);assert.equal(p.campaign.completed,false,'victory waits for campaign settlement');p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){const u=p.battle.units.find(u=>u.id===actor.id);if(u.medkits&&(u.bleeding||u.hp<u.maxHp-15))p=tactical(p,{type:'heal',unitId:u.id});}
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));assert.equal(s.operativeState[57].alive,true);assert.equal(s.completed,sector==='humahuaca');
  notes.push({stage:sector,hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],actions,turns:battle.turn,deaths:deaths(s),commanderHp:s.operativeState[57].hp,completed:s.completed});onCheckpoint?.(sector,s,notes);
  if(!s.completed)s=order(s,{type:'fortify',sector});
 }
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);assert.equal(s.blockade,false);assert.equal(s.phase,4);assert.equal(Object.keys(s.sectors).length,13);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));assert.equal(s.operativeState[57].hp,88);assert.ok(s.recruited.includes(57));assert.equal(s.contracts[57].expiresAt,null);assert.equal(s.resources.treasury,2931);for(const id of [1000,123,142])assert.equal(s.operativeState[id].alive,false);
 return {campaign:s,notes,prefix:prefix.notes};
}
