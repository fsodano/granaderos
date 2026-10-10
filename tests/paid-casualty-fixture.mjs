import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {northernClearShotOrder} from './fresh-northern-fixture.mjs';
import {getReachable,teamCanSee,actBattle,endTurn,actionCosts,meleePreview} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {order,visit} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
const cached=new Map();
function coordinatedOrder(battle,unit){
 const action=cautiousCombatOrder(battle,unit);
 if(action?.type!=='move'||battle.mode!=='exploration')return action;
 // Short reconnaissance legs let the healthy firing line catch up before
 // contact. Path choices include only the squad and observed occupants.
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,'player',other))},reachable=getReachable(view,unit),destination=reachable.find(point=>sameCell(point,action));
 if(!destination||destination.cost<=16)return action;
 const next=[...destination.path].reverse().map(point=>reachable.find(cell=>sameCell(cell,point))).find(point=>point?.cost>0&&point.cost<=16);
 return next?{type:'move',unitId:unit.id,...spacePoint(next)}:null;
}
function retainedCasualtyOrder(battle,unit){
 let action=northernClearShotOrder(battle,unit);
 if(unit.knockedDown||unit.entangled)return action;
 // Subdue a badly wounded visible opponent with empty hands. The approach,
 // hand change and strikes all use their actual routes and action costs.
 const target=action?.type==='fire'?battle.units.find(other=>other.id===action.targetId):null;
 if(target?.hp<=30){
  const plan=meleePreview(battle,{...unit,activeSlot:'unarmed'},target,{approach:true}),prepare=unit.activeSlot==='unarmed'?0:actionCosts(battle,unit).weapon;
  action=plan.valid&&plan.pa+prepare<=unit.ap?(prepare?{type:'weapon',unitId:unit.id,slot:'unarmed'}:plan.movePa?{type:'move',unitId:unit.id,...plan.destination}:{type:'melee',unitId:unit.id,targetId:target.id}):null;
 }
 if(unit.activeSlot!=='unarmed')return action;
 const wounded=battle.units.filter(other=>other.side!==unit.side&&other.hp>=15&&other.hp<=30&&!other.unconscious&&!other.routed&&!other.surrendered&&!other.departure&&teamCanSee(battle,unit.side,other))
  .sort((a,b)=>Math.hypot(unit.x-a.x,unit.y-a.y)-Math.hypot(unit.x-b.x,unit.y-b.y))[0];
 if(!wounded)return unit.ap>=actionCosts(battle,unit).weapon?{type:'weapon',unitId:unit.id,slot:'primary'}:null;
 const plan=meleePreview(battle,unit,wounded,{approach:true});
 return plan.valid?(plan.movePa?{type:'move',unitId:unit.id,...plan.destination}:{type:'melee',unitId:unit.id,targetId:wounded.id}):null;
}
export function paidCasualty(seed=8,{toolkit=false}={}){
 const key=`${seed}:${toolkit}`;if(cached.has(key))return structuredClone(cached.get(key));
 // Author an already wounded hire without first-aid stock. Ordinary enemy
 // attacks cause the casualty; the fixture does not assign a death or outcome.
 const content=defaultContentPackage(),wounded=content.characters.find(c=>c.id==='person-110');wounded.startingCondition={hp:25,energy:100,fatigue:0,bleeding:0,bandaged:0};wounded.startingSupplies={medkits:0,rations:2,torches:2,boleadoras:0};
 let s=initialCampaign(seed,content);
 for(const id of [110,114,136,141,120,131])s=order(s,{type:'recruitCivic',id,term:'day'});
 s=order(s,{type:'wait',hours:6});
 if(toolkit){
  // The unchanged default policy produces an actual paid casualty: 120.
  // Before combat he acquires one real finite toolkit. Enemy attacks still
  // decide his survival and the outcome; no corpse or outcome is assigned.
  s=leaveFiniteCache(takeFiniteCache(visit(s),120,[{kind:'repair-kit',count:1}]));
  assert.equal(repairMaterialPoints(s.operativeState[120]),100);
  assert.equal(s.sectorStates.retiro.props.find(prop=>prop.id===FINITE_SECTOR_CACHES.retiro.chest).contents.some(item=>item.kind==='repair-kit'),false);
 }
 s=order(s,{type:'attack',sector:'buenos_aires'});
 const request=s.pendingBattle;assert.equal(request.squad.find(u=>u.id===110).hp,25);
 const result=fight(request,null,{controller:seed===42?retainedCasualtyOrder:coordinatedOrder}),battle=result.battle;
 assert.equal(battle.status,'victory');
 const victim=battle.units.find(u=>u.side==='player'&&u.hp===0&&s.contracts[u.id]?.paid>0);
 assert.ok(victim,'custody checks require an actual paid casualty, without forcing a particular person to die');
 if(toolkit){const holder=battle.units.find(unit=>unit.id==='120');assert.equal(holder.hp,0,'the witnessed toolkit transfer needs the actual pre-combat carrier to fall');assert.equal(repairMaterialPoints(holder),100);}
 let replay=enterSector(request);
 for(let index=0;index<result.orders.length;index++){
  const action=result.orders[index];
  if(action.type==='fire')assert.equal(teamCanSee(replay,'player',replay.units.find(unit=>unit.id===action.targetId)),true);
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null,JSON.stringify(action));
  if(index===Math.floor(result.orders.length/2))replay=validateBattleSnapshot(JSON.parse(JSON.stringify(replay)));
 }
 assert.deepEqual(replay,battle,'the real casualty and victory replay exactly across a tactical save');
 const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 s=order(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 for(const casualty of restored.battle.units.filter(unit=>unit.side==='player'&&unit.hp===0))assert.equal(s.operativeState[casualty.id].alive,false);
 const id=Number(victim.id);assert.equal(s.operativeState[id].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].recruited,true);const checkpoint={campaign:s,id};cached.set(key,checkpoint);return structuredClone(checkpoint);
}
