import assert from 'node:assert/strict';
import {actBattle,getReachable,artilleryContact} from '../game/tactical.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {spacePoint} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {withdrawCommandToRear} from './command-reserve-driver.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';

// The actual gun crews fight while the living commander and
// physician pay for their issued boundary exits to the friendly rear sector.
export function createdSaltaReserveDeployment(initial,{commanderId='57',doctorId='135',destination='tucuman'}={}){
 const commander=initial.units.find(u=>u.id===String(commanderId)),doctor=initial.units.find(u=>u.id===String(doctorId));
 assert.ok(commander?.side==='player'&&commander.hp>=15&&!commander.departure);
 assert.ok(doctor?.side==='player'&&doctor.hp>=15&&doctor.medical>=60&&!doctor.departure);
 assert.notEqual(commander.id,doctor.id);
 const withdraw=withdrawCommandToRear(initial,commander.id,destination);
 return start=>{
  let battle=withdraw(start);
  const exit=battle.exits.find(e=>e.destination===destination);assert.ok(exit);
  battle=actBattle(battle,{type:'exit',unitIds:[doctor.id],exitId:exit.id});
  assert.equal(battle.lastError,null,battle.lastError);
  assert.equal(battle.units.find(u=>u.id===doctor.id).departure.destination,destination);
  return battle;
 };
}

// After capture, return the actual field operators to their southern guns
// before the strategic counterattack. Movement, stances, and loading consume
// their normal exploration time; the rear party keeps its real location.
export function stageCreatedSaltaBattery(start,{reserveIds=['57','135'],report=()=>{}}={}){
 const original=structuredClone(start);assert.equal(start.pendingBattle,null);assert.equal(start.location,'salta');
 let campaign=dispatchCampaign(start,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.salta);
 const initialSeconds=battle.startSeconds+battle.elapsedSeconds;
 const rounds=battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0),moves=[];
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);};
 const guns=battle.artillery.filter(g=>g.side==='player').sort((a,b)=>b.y-a.y||a.x-b.x);
 const ids=battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.departure&&!reserveIds.map(String).includes(u.id)).sort((a,b)=>b.marksmanship-a.marksmanship).map(u=>u.id);
 assert.ok(guns.length&&ids.length>=Math.max(...guns.map(gun=>artilleryProfile(battle,gun).crew)),'The actual field operators must meet each owned type’s crew requirement.');
 for(const gun of guns)for(const id of ids.slice(0,artilleryProfile(battle,gun).crew)){
  let unit=battle.units.find(u=>u.id===id);if(unit.stance!=='standing')act({type:'stance',unitId:id,stance:'standing'});
  unit=battle.units.find(u=>u.id===id);
  const point=getReachable(battle,unit).filter(p=>Math.hypot(p.x-gun.x,p.y-gun.y)<=1.5).sort((a,b)=>Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(b.x-gun.x,b.y-gun.y)||a.cost-b.cost)[0];assert.ok(point);
  if(point.path.length)act({type:'move',unitId:id,...spacePoint(point)});
  act({type:'stance',unitId:id,stance:'crouched'});
  unit=battle.units.find(u=>u.id===id);assert.ok(artilleryContact(battle,unit,gun));
  if(!unit.loaded&&unit.ammo)act({type:'reload',unitId:id});
  moves.push({id,artilleryId:gun.id,x:unit.x,y:unit.y});
 }
 assert.equal(battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0),rounds,'ordinary loading conserves carried ammunition');
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null,pair.error);
 campaign=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,original);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'createdSaltaGunCrewReady',campaign,moves,elapsedSeconds:pair.battle.startSeconds+pair.battle.elapsedSeconds-initialSeconds});
 return campaign;
}
