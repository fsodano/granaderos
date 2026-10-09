import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';

// Prepare actual local defenders before a raid. Roof cells are authored public
// map geometry; movement, climbing, reloads and the clock use ordinary orders.
export function stageRouteRoofDefenders(start,ids,{report=()=>{}}={}){
 assert.ok(ids.length);let c=decodeSave(encodeSave(start)).campaign;const sector=c.operativeState[ids[0]].location,previous=c.activeSquadId,actions=[],startSeconds=c.hour*3600+(c.secondOfHour??0);
 assert.ok(ids.length&&ids.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===sector&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding&&!c.operativeState[id].asleep));
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const squads=c.squads.filter(q=>q.location===sector&&!q.journey&&q.members.some(id=>ids.includes(id))).map(q=>q.id),positions=[],reserved=new Set(),cellKey=point=>`${point.tacticalLevel??0}:${point.x}:${point.y}`;
 assert.ok(ids.every(id=>c.squads.some(q=>squads.includes(q.id)&&q.members.includes(id))),'every defender belongs to an actual local squad');
 for(const squadId of squads){
  order({type:'selectSquad',id:squadId});const assignments=c.squad.map(id=>({id,assignment:c.operativeState[id].assignment}));
  for(const {id}of assignments)order({type:'assignCare',operativeId:id,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});order({type:'visitSector'});
  let battle=enterSector(c.pendingBattle,c.sectorStates[sector]);
  const roofs=battle.upperSurfaces.filter(point=>!point.blocked).sort((a,b)=>Math.hypot(a.x-battle.width/2,a.y-battle.height/2)-Math.hypot(b.x-battle.width/2,b.y-battle.height/2)||a.y-b.y||a.x-b.x);
  const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);actions.push(action);};
  for(const id of c.squad.filter(id=>ids.includes(id))){const unitId=String(id);act({type:'movement',unitId,movement:'walk'});
   const unit=battle.units.find(unit=>unit.id===unitId),destination=roofs.find(point=>!reserved.has(cellKey(point))&&!battle.units.some(other=>other.id!==unitId&&other.hp>0&&sameCell(other,point))&&getReachable(battle,unit,{stopAt:cell=>sameCell(cell,point)}).some(cell=>sameCell(cell,point)));assert.ok(destination,'a local defender needs actual reachable roof cover');
   for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++){const before=spacePoint(battle.units.find(unit=>unit.id===unitId));act({type:'move',unitId,...spacePoint(destination)});assert.notDeepEqual(spacePoint(battle.units.find(unit=>unit.id===unitId)),before);}
   assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});reserved.add(cellKey(destination));positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});
  }
  const synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(unit=>unit.side==='player')});
  for(const {id,assignment}of assignments)if(assignment!=='active'&&(!['doctor','militia_doctor'].includes(assignment)||c.operativeState[id].medkits>0&&c.operativeState[id].energy>10))order({type:'assignCare',operativeId:id,assignment});
 }
 if(c.activeSquadId!==previous)order({type:'selectSquad',id:previous});
 assert.equal(reserved.size,ids.length,'local squads retain distinct actual roof cells');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 const evidence={event:'routeRoofDefenders',sector,ids,positions,actions,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-startSeconds};report(evidence);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.ok(evidence.elapsedSeconds>=0);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
