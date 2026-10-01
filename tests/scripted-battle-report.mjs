import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {propBlocksAt} from '../game/props.js';
// Subsystem-only boundary fixture: place each able participant on an open
// authorized boundary, then pay the real reducer's exit cost. This does not
// claim to test the approach route or replace the real opening playthrough.
export function scriptedWithdrawal(value){
 let battle=structuredClone(value);battle.phase='player';battle.mode='combat';delete battle.interrupt;delete battle.enemyTurn;delete battle.reactionStack;
 for(const u of battle.units.filter(u=>u.side==='enemy'))u.ap=0;
 const exit=battle.exits[0];if(!exit)throw Error('The withdrawal fixture has no authorized exit.');
 for(const id of battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.surrendered&&!u.departure).map(u=>u.id)){
  const u=battle.units.find(u=>u.id===id),cell=battle.tiles.find(t=>boundaryMatches(battle,t,exit.edge)&&!t.blocked&&!propBlocksAt(battle,t.x,t.y)&&!battle.units.some(v=>v.id!==id&&!v.departure&&v.x===t.x&&v.y===t.y));
  if(!cell)throw Error('The withdrawal fixture has no open boundary cell.');Object.assign(u,{x:cell.x,y:cell.y});
  battle=actBattle(battle,{type:'exit',unitIds:[id],exitId:exit.id});if(battle.lastError)throw Error(battle.lastError);
 }
 if(battle.status!=='retreat')throw Error('The withdrawal fixture did not physically finish.');return battle;
}
// Subsystem fixtures may script a combat result. They must still return the
// complete deployed force and canonical tactical state; this is not a play bot.
export function scriptedBattleReport(campaign,{outcome='victory',units=[]}={}){
 const request=campaign.pendingBattle;let battle=enterSector({...request,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0},campaign.sectorStates[request.sector]);
 for(const patch of units){const u=battle.units.find(u=>String(u.id)===String(patch.id));if(!u)throw Error('Scripted report references an undeployed unit.');Object.assign(u,patch,{id:String(u.id)});u.bandaged=Math.max(0,Math.min(u.bandaged??0,u.maxHp-u.hp));u.unconscious=u.hp>0&&(u.hp<15||u.energy<=0);if(u.hp<=0){u.bleeding=0;u.bandaged=0;u.ap=0;}}
 if(outcome==='victory')for(const u of battle.units.filter(u=>u.side==='enemy'))Object.assign(u,{hp:0,bleeding:0,bandaged:0,unconscious:false,ap:0});
 if(outcome==='defeat')for(const u of battle.units.filter(u=>u.side==='player'&&u.hp>=15)){u.routed=true;u.surrendered=true;if(!u.weaponDropped){battle.droppedWeapons.push({unitId:u.id,x:u.x,y:u.y,weapon:u.weapon,loaded:u.loaded,condition:u.condition});u.weaponDropped=true;u.loaded=0;}u.ap=0;}
 for(const unit of battle.units)refreshMilitaryCondition(unit);
 if(outcome==='retreat')battle=scriptedWithdrawal(battle);else battle.status=outcome;
 battle.sectorCleared=outcome==='victory';battle.phase='player';delete battle.interrupt;delete battle.enemyTurn;delete battle.reactionStack;
 return {type:'battleResult',battleId:request.id,outcome,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};
}
