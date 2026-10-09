import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {getReachable,teamCanSee,actBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {order} from './local-contract-fixture.mjs';
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
export function paidCasualty(seed=8){
 if(cached.has(seed))return structuredClone(cached.get(seed));
 // Author an already wounded hire without first-aid stock. Ordinary enemy
 // attacks cause the casualty; the fixture does not assign a death or outcome.
 const content=defaultContentPackage(),wounded=content.characters.find(c=>c.id==='person-110');wounded.startingCondition={hp:25,energy:100,fatigue:0,bleeding:0,bandaged:0};wounded.startingSupplies={medkits:0,rations:2,torches:2,boleadoras:0};
 let s=initialCampaign(seed,content);
 for(const id of [110,114,136,141,120,131])s=order(s,{type:'recruitCivic',id,term:'day'});
 s=order(s,{type:'wait',hours:6});s=order(s,{type:'attack',sector:'buenos_aires'});
 const request=s.pendingBattle;assert.equal(request.squad.find(u=>u.id===110).hp,25);
 const result=fight(request,null,{controller:coordinatedOrder}),battle=result.battle;
 assert.equal(battle.status,'victory');
 const victim=battle.units.find(u=>u.side==='player'&&u.hp===0&&s.contracts[u.id]?.paid>0);
 assert.ok(victim,'custody checks require an actual paid casualty, without forcing a particular person to die');
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
 const id=Number(victim.id);assert.equal(s.operativeState[id].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].recruited,true);const checkpoint={campaign:s,id};cached.set(seed,checkpoint);return structuredClone(checkpoint);
}
