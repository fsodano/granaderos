import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {fight} from './cuyo-route-driver.mjs';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
export function issuedBattery(content){
 const d=content?structuredClone(content):defaultContentPackage();d.rules.startingTreasury=10000;d.startingTerritory.buenos_aires={owner:'patriot',loyalty:65};
 for(const id of [110,114,136,141,120,131])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 let s=initialCampaign(8,d);for(const id of [110,114,136,141,120,131])s=order(s,{type:'recruitCivic',id,term:'week'});
 const money=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:'swivel'});assert.equal(s.resources.treasury,money-400);
 // Wait through the first night before departure; the ordinary travel clock
 // then starts this real assault in daylight.
 s=order(s,{type:'wait',hours:6});s=order(s,{type:'travel',sector:'buenos_aires'});return order(s,{type:'attack',sector:'san_nicolas'});
}
let won;
export function wonBattery(content){
 if(!content&&won)return structuredClone(won);
 const s=issuedBattery(content),result=fight({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},null,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(result.battle.status,'victory');assert.ok(result.actions>0);
 const p=saved(sync({campaign:s,battle:result.battle}));const resultCampaign=saved({campaign:order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;if(!content)won=resultCampaign;return structuredClone(resultCampaign);
}
export function fireStationed(p){
 const gun=p.battle.artillery[0];let approach;
 for(const u of p.battle.units.filter(u=>u.side==='player'&&!u.militia&&u.hp>=15&&!u.unconscious&&!u.routed)){
  const spot=getReachable(p.battle,u).filter(q=>Math.hypot(q.x-gun.x,q.y-gun.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];if(spot&&(!approach||spot.cost<approach.spot.cost))approach={u,spot};
 }
 assert.ok(approach);let b=p.battle;if(approach.spot.cost)b=actBattle(b,{type:'move',unitId:approach.u.id,x:approach.spot.x,y:approach.spot.y});assert.equal(b.lastError,null);
 // Fire at a nearby empty exterior point. This spends an actual loaded shot;
 // it does not edit cannon state or assign a combat outcome.
 const target=b.tiles.filter(t=>!t.blocked&&!t.buildingId&&Math.hypot(t.x-gun.x,t.y-gun.y)>=2&&Math.hypot(t.x-gun.x,t.y-gun.y)<=4&&!b.units.some(u=>Math.hypot(u.x-t.x,u.y-t.y)<2)&&!b.npcs.some(u=>Math.hypot(u.x-t.x,u.y-t.y)<2))[0];assert.ok(target);
 b=actBattle(b,{type:'artillery',unitId:approach.u.id,artilleryId:gun.id,x:target.x,y:target.y,mode:'solid'});assert.equal(b.lastError,null);assert.equal(b.artillery[0].loaded,false);return saved(sync({campaign:p.campaign,battle:b}));
}
