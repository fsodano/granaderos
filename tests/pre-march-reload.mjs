import assert from 'node:assert/strict';
import {WEAPONS} from '../game/data.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,reloadCost} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

// A route controller must finish an unfinished gun through real equipment and
// reload orders. Returning to the map cannot finish the job for the player.
export function finishReloadsBeforeMarch(start,{report=()=>{}}={}){
 const roster=rosterFor(start),ids=start.squad.filter(id=>{const r=start.operativeState[id],capacity=WEAPONS[roster.find(u=>u.id===id)?.weapon]?.capacity??0;return !r.weaponDropped&&r.carriedLoaded!==undefined&&r.carriedLoaded<capacity;});
 if(!ids.length)return start;
 let campaign=dispatchCampaign(start,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
 const before=battle.elapsedSeconds,rounds=battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0);
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);};
 for(const id of ids){
  let unit=battle.units.find(u=>u.id===String(id));
  if(unit.activeSlot!=='primary')act({type:'weapon',unitId:unit.id,slot:'primary'});
  unit=battle.units.find(u=>u.id===String(id));if(unit.jammed)act({type:'reprime',unitId:unit.id});
  unit=battle.units.find(u=>u.id===String(id));const cost=reloadCost(unit,battle),ammo=unit.ammo,loaded=unit.loaded;
  act({type:'reload',unitId:unit.id});unit=battle.units.find(u=>u.id===String(id));
  assert.equal(unit.reloadProgress,undefined);assert.equal(unit.ammo+unit.loaded,ammo+loaded);
  report({event:'finishedReload',id,paidPAEquivalent:cost,loaded:unit.loaded,ammo:unit.ammo});
 }
 assert.equal(battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0),rounds);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;
 campaign=dispatchCampaign(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.ok(battle.elapsedSeconds>before);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return campaign;
}
