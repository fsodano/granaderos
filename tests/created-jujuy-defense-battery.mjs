import assert from 'node:assert/strict';
import {actBattle,getReachable,artilleryContact,teamCanSee,stanceCost,interruptInitiative} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {targetPreview} from '../game/ja2-hud.js';
import {hasCharacterAbility} from '../game/character-abilities.js';
import {syncBattleTime} from '../game/time.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {stableCrewController} from './stable-crew-driver.mjs';

// Pay for local command support, keep actual gun crews, and resolve the
// existing stable controller's quiet null order with its public search.
export function createdSupportedJujuyBattery(ready,{report=()=>{}}={}){
 assert.equal(ready.pendingBattle.squad.length,5);
 assert.equal(ready.pendingBattle.enemies.length,30);
const expectedIds=['57','7','6','147','135'].sort(),preparations=[];
const kitKeys=['hp','maxHp','bleeding','bandaged','weapon','weaponDefinition','weaponMetadata','blade','bladeDefinition','bladeMetadata','condition','bladeCondition','weaponFittings','bladeFittings','weaponFittingPattern','bladeFittingPattern','weaponInstanceId','bladeInstanceId','loaded','ammo','ammunitionVersion','ammunition','ammunitionCounts','reloadProgress','jammed','inventory','headwear','outfit','legwear','offHand','equipmentCursor','pocketOrder','medkits','rations','torches','boleadoras','toolkitPoints','morale'];
const kit=u=>Object.fromEntries(kitKeys.filter(k=>Object.hasOwn(u,k)).map(k=>[k,structuredClone(u[k])]));
function deploy(b){
 assert.equal(b.deployment,undefined);assert.equal(b.mode,'exploration');
 const before=structuredClone(b),command=b.units.find(u=>u.id==='57'),known=playerKnownBattle(b);
 assert.equal(hasCharacterAbility(command,'strategic_command'),true);
 assert.deepEqual(b.units.filter(u=>u.side==='player'&&u.hp>0&&!u.departure).map(u=>u.id).sort(),expectedIds);
 const point={x:53,y:24,tacticalLevel:0},ground=known.tiles.find(t=>t.x===point.x&&t.y===point.y&&(t.tacticalLevel??0)===0);
 assert.ok(ground&&!ground.blocked,'the proposed rear position is known accessible ground');
 const reachable=getReachable(b,command),route=reachable.find(p=>p.x===point.x&&p.y===point.y&&(p.tacticalLevel??0)===0);
 assert.ok(route);assert.equal(route.cost,80);
 const pathVisibility=route.path.map(p=>({...p,currentKnown:known.tiles.some(t=>t.x===p.x&&t.y===p.y&&(t.tacticalLevel??0)===(p.tacticalLevel??0))}));
 // Select the known friendly destination through its public cursor preview.
 // The engine owns the route, including any occluded cell on that route.
 const preview=targetPreview(b,command,point,{mode:'move',reachable});assert.equal(preview.valid,true);
 const action={type:'move',unitId:'57',...point},n=actBattle(b,action);assert.equal(n.lastError,null,n.lastError);
 const moved=n.units.find(u=>u.id==='57');assert.deepEqual({x:moved.x,y:moved.y,tacticalLevel:moved.tacticalLevel??0},point,'the real move must reach the supported rear position');
 assert.deepEqual(n.artillery,b.artillery,'the ordinary commander move changes no gun record');
 for(const u of b.units.filter(u=>u.side==='player')){
  const v=n.units.find(v=>v.id===u.id);assert.deepEqual(kit(v),kit(u));
  assert.ok(v.ap<=u.ap);assert.ok(v.energy<=u.energy);
  if(u.id!=='57')assert.deepEqual({x:v.x,y:v.y,tacticalLevel:v.tacticalLevel??0},{x:u.x,y:u.y,tacticalLevel:u.tacticalLevel??0});
 }
 assert.ok(moved.energy<command.energy);assert.ok(n.elapsedSeconds>b.elapsedSeconds);
 const supported=n.units.filter(u=>u.side==='player'&&u.hp>0&&!u.departure&&u.id!=='57').map(u=>({id:u.id,distance:Math.hypot(u.x-moved.x,u.y-moved.y),initiative:interruptInitiative(n,u)}));
 assert.ok(supported.every(u=>u.distance<=6));
 assert.ok(n.artillery.filter(g=>g.side==='player').every(g=>!artilleryContact(n,moved,g)),'command support does not substitute a gun operator');
 const pair=syncBattleTime(ready,n);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(restored.battle,pair.battle);
 const receipt={action,preview,pathCost:route.cost,path:pathVisibility,elapsedSeconds:n.elapsedSeconds-b.elapsedSeconds,energyBefore:command.energy,energyAfter:moved.energy,apBefore:command.ap,apAfter:moved.ap,ground,supported,guns:n.artillery.filter(g=>g.side==='player').map(g=>({id:g.id,x:g.x,y:g.y,loaded:g.loaded,ammo:g.ammo})),mode:n.mode,phase:n.phase};
 if(preparations.length)assert.deepEqual(receipt,preparations[0]);preparations.push(receipt);
 assert.deepEqual(b,before);report({event:'paidKnownRearCommandSupport',...receipt});
 return n;
}
const stable=stableCrewController(),searchOrders=[];
// This is the existing coastalSearchController quadrant fallback. Preserve
// valid stable orders and the protected command; search only the real gap.
const controller=(battle,unit)=>{
 const a=stable(battle,unit),action=unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(a?.type)?null:a;
 if(action||unit.id==='57'||battle.turn<20||battle.phase!=='player'||battle.units.some(other=>other.side!==unit.side&&other.hp>=15&&!other.routed&&!other.unconscious&&!other.surrendered&&!other.departure&&teamCanSee(battle,unit.side,other)))return action;
 const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((battle.turn-20)/4)%corners.length];
 const goal={x:Math.floor(battle.width*corner[0]),y:Math.floor(battle.height*corner[1])},distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);
 if(distance(unit)<=3)return null;
 let search=null;
 if(unit.stance!=='standing'&&unit.ap>=stanceCost(unit,'standing'))search={type:'stance',unitId:unit.id,stance:'standing'};
 else{
  const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
  const point=getReachable(view,unit).filter(point=>point.cost>0&&point.cost<=Math.min(30,unit.ap-20)&&distance(point)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];
  search=point?{type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0}:null;
 }
 if(search){searchOrders.push({turn:battle.turn,mode:battle.mode,phase:battle.phase,id:unit.id,stable:null,goal,action:search});if(searchOrders.length<=12)report({event:'publicNullOrderQuadrantSearch',...searchOrders.at(-1)});}
 return search;
};
 return {deploy,controller};
}
