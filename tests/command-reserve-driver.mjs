import assert from 'node:assert/strict';
import {actBattle} from '../game/tactical.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Place the arriving force at its normal issued positions, then pay for one
// actor's actual boundary exit. Settlement must retain the departure record.
export function withdrawCommandToRear(initial,unitId,destination){
 return start=>{
  let battle=start;
  const model=sectorDeploymentModel(start);assert.ok(model);
  for(const arrival of model.units){
   const unit=initial.units.find(unit=>unit.id===arrival.id);assert.ok(unit);
   battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[unit.id],x:unit.x,y:unit.y});
   assert.equal(battle.lastError,null,battle.lastError);
  }
  battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});
  assert.equal(battle.lastError,null,battle.lastError);
  const exit=battle.exits.find(exit=>exit.destination===destination);assert.ok(exit);
  battle=actBattle(battle,{type:'exit',unitIds:[String(unitId)],exitId:exit.id});
  assert.equal(battle.lastError,null,battle.lastError);
  assert.equal(battle.units.find(unit=>unit.id===String(unitId)).departure.destination,destination);
  return battle;
 };
}

// A boundary departure leaves the actor at the real destination without a
// squad. Form a new one and pay for the return before local conversations.
export function rejoinCommandAfterExit(start,unitId,sector){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const record=campaign.operativeState[unitId];
 assert.ok(record.alive&&!record.captured);
 for(const action of [
  {type:'createSquad',name:'Regreso del mando',ids:[unitId],sector:record.location},
  ...(record.location===sector?[]:[{type:'travel',sector,mode:'posta'}]),
 ]){
  campaign=dispatchCampaign(campaign,action);
  assert.equal(campaign.lastError,null,campaign.lastError);
 }
 assert.equal(campaign.location,sector);
 assert.equal(campaign.operativeState[unitId].location,sector);
 assert.ok(campaign.squad.includes(unitId));
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return campaign;
}

// Place the actual heavy crew beside its issued gun through the authorized
// entry cells. The light gun has one living named operator, and any commander
// arrival stays at the farthest legal entry position behind both pieces.
export function deployHighPassBattery(start,{lightId='147',reserveId='57'}={}){
 let battle=start;const model=sectorDeploymentModel(start);assert.ok(model);
 const heavy=battle.artillery.find(g=>g.side==='player'&&g.type==='field8'),light=battle.artillery.find(g=>g.side==='player'&&g.type==='swivel');assert.ok(heavy&&light);
 const command=model.units.find(u=>u.id===String(reserveId)),infantry=model.units.filter(u=>u.id!==String(reserveId));
 assert.ok(infantry.length>=4,'the battery requires four real arriving field soldiers');
 assert.ok(infantry.some(u=>u.id===String(lightId)),'the light operator must actually arrive');
 const occupied=new Set();
 // The packed light gun can share its closest entry cell with a heavy-crew
 // contact cell. Reserve the three heavy contact positions first, then give
 // the light operator the remaining adjacent cell; one person cannot staff
 // both guns at once.
 const lightOperator=infantry.find(unit=>unit.id===String(lightId));
 const heavyCandidates=infantry.filter(unit=>unit!==lightOperator),heavyCrew=heavyCandidates.slice(0,3),spare=heavyCandidates.slice(3);
 for(const unit of [...(command?[command]:[]),...heavyCrew,lightOperator,...spare]){
  const options=model.entryCells[unit.edge].filter(point=>!occupied.has(`${point.x},${point.y}`)),gun=unit.id===String(lightId)?light:heavy;
  const distance=(point,piece)=>Math.hypot(point.x-piece.x,point.y-piece.y);
  options.sort((a,b)=>unit.id===String(reserveId)?Math.min(distance(b,heavy),distance(b,light))-Math.min(distance(a,heavy),distance(a,light))||a.y-b.y:distance(a,gun)-distance(b,gun)||a.y-b.y);
  const point=options[0];assert.ok(point);
  battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[unit.id],x:point.x,y:point.y});assert.equal(battle.lastError,null,battle.lastError);
  occupied.add(`${point.x},${point.y}`);
 }
 battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null,battle.lastError);
 return battle;
}
