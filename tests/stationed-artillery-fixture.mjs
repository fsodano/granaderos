import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {needsCollapseRecovery} from '../game/fatigue.js';
import {tooTiredToMarch} from '../game/march-fatigue.js';
import {fight} from './battery-field-driver.mjs';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
import {contentFixtureCache} from './content-fixture-cache.mjs';
import {withStoredGear} from './commerce-gear-fixture.mjs';
export function issuedBattery(content){
 const d=content?structuredClone(content):defaultContentPackage();d.rules.startingTreasury=10000;d.startingTerritory.buenos_aires={owner:'patriot',loyalty:65};
 for(const id of [110,114,136,141,120,131])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 let s=initialCampaign(8,d);for(const id of [110,114,136,141,120,131])s=order(s,{type:'recruitCivic',id,term:'week'});
 // Declared finite isolated battery stock, issued once by ordinary deployment.
 const money=s.resources.treasury;s=withStoredGear(s,'swivel');assert.equal(s.resources.treasury,money);
 // Wait through the first night before departure; the ordinary travel clock
 // then starts this real assault in daylight.
 s=order(s,{type:'wait',hours:6});s=order(s,{type:'travel',sector:'buenos_aires'});
 // Stage for two hours after the march. Recovery, light, casualties and the
 // victory below all follow ordinary orders; no combat result is fabricated.
 s=order(s,{type:'wait',hours:2});return order(s,{type:'attack',sector:'san_nicolas'});
}
export const wonBattery=contentFixtureCache(content=>{
 const s=issuedBattery(content),result=fight({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},null,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(result.battle.status,'victory');assert.ok(result.actions>0);
 const p=saved(sync({campaign:s,battle:result.battle}));return saved({campaign:order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;
});
export function fireStationed(p){
 const gun=p.battle.artillery[0];let approach;
 for(const u of p.battle.units.filter(u=>u.side==='player'&&!u.militia&&u.hp>=15&&!u.unconscious&&!u.routed)){
  const spot=getReachable(p.battle,u).filter(q=>Math.hypot(q.x-gun.x,q.y-gun.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];if(spot&&(!approach||spot.cost<approach.spot.cost))approach={u,spot};
 }
 assert.ok(approach);let b=p.battle;if(approach.spot.cost)b=actBattle(b,{type:'move',unitId:approach.u.id,x:approach.spot.x,y:approach.spot.y});assert.equal(b.lastError,null);
 // The real victory can spend the loaded shot. Prepare the next shot using
 // only the surviving reserve; loading cannot create ammunition.
 if(!b.artillery.find(piece=>piece.id===gun.id).loaded){
  const remaining=b.artillery.find(piece=>piece.id===gun.id).ammo;
  b=actBattle(b,{type:'artilleryReload',unitId:approach.u.id,artilleryId:gun.id});assert.equal(b.lastError,null);
  const loaded=b.artillery.find(piece=>piece.id===gun.id);assert.equal(loaded.loaded,true);assert.equal(loaded.ammo,remaining-1);
 }
 // Fire at a nearby empty exterior point. This spends an actual loaded shot;
 // it does not edit cannon state or assign a combat outcome.
 const target=b.tiles.filter(t=>!t.blocked&&!t.buildingId&&Math.hypot(t.x-gun.x,t.y-gun.y)>=2&&Math.hypot(t.x-gun.x,t.y-gun.y)<=4&&!b.units.some(u=>Math.hypot(u.x-t.x,u.y-t.y)<2)&&!b.npcs.some(u=>Math.hypot(u.x-t.x,u.y-t.y)<2))[0];assert.ok(target);
 b=actBattle(b,{type:'artillery',unitId:approach.u.id,artilleryId:gun.id,x:target.x,y:target.y,mode:'solid'});assert.equal(b.lastError,null);assert.equal(b.artillery[0].loaded,false);return saved(sync({campaign:p.campaign,battle:b}));
}

// Depleted-boundary tests must spend the actual retained stock. A real victory
// can end before the gun fires, so its starting loaded round cannot be assumed.
export function exhaustStationed(pair){
 const initial=pair.battle.artillery[0],count=Number(initial.loaded)+initial.ammo;
 assert.ok(Number.isInteger(count)&&count>0,'the retained piece must own a finite charge to spend');
 let next=pair;
 for(let shot=0;shot<count;shot++){
  const before=structuredClone(next.battle.artillery.find(piece=>piece.id===initial.id));
  next=fireStationed(next);
  const after=next.battle.artillery.find(piece=>piece.id===initial.id);
  assert.ok(after);assert.equal(after.loaded,false);
  assert.equal(Number(after.loaded)+after.ammo,Number(before.loaded)+before.ammo-1);
  assert.equal(after.ammo,before.ammo-(before.loaded?0:1));
 }
 assert.equal(next.battle.artillery.find(piece=>piece.id===initial.id).ammo,0);
 return next;
}

// Travel may end with exhausted soldiers asleep. Wait for real recovery, then
// issue wake orders before another departure; never edit fatigue or sleep state.
export function wakeBatteryCrew(state){
 let s=state;
 for(let attempt=0;attempt<48;attempt++){
  for(const id of s.squad)if(tooTiredToMarch(s.operativeState[id])&&!s.operativeState[id].asleep)s=order(s,{type:'setSleep',operativeId:id,asleep:true});
  const sleeping=s.squad.filter(id=>s.operativeState[id]?.alive&&s.operativeState[id].asleep);
  if(!sleeping.length)return s;
  for(const id of sleeping)if(!needsCollapseRecovery(s.operativeState[id])&&!tooTiredToMarch(s.operativeState[id]))s=order(s,{type:'setSleep',operativeId:id,asleep:false});
  if(s.squad.every(id=>!s.operativeState[id].asleep))return s;
  s=advanceCampaignHours(s,1);
 }
 assert.fail('The battery crew did not recover after 48 actual hours.');
}
