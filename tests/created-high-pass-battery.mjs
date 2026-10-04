import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {deployHighPassBattery} from './command-reserve-driver.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {heavyContactCrewController} from './stable-crew-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {finiteBatteryDriver} from './finite-battery-driver.mjs';

// All three heavy-gun actors keep their real posts while approaching. The
// third member is a helper as well; he cannot scout away from the rigid crew.
export function createdHighPassBattery(ready,{reserveCommand=true,report=()=>{}}={}){
 const request=ready.pendingBattle,state=ready.sectorStates.humahuaca;
 assert.equal(request.sector,'humahuaca');
 const initial=enterSector(request,state),arrivals=new Set(request.squad.map(unit=>String(unit.id)));
 const actualGuns=initial.artillery.filter(gun=>gun.side==='player'&&!gun.stationed);
 if(!actualGuns.some(gun=>gun.type==='swivel')||!actualGuns.some(gun=>gun.type==='field8')){
  const base=finiteBatteryDriver(initial,{gunIds:actualGuns.map(gun=>gun.id),reserveIds:reserveCommand?['57']:[],report});
  return {...base,deploy:start=>{
   let battle=base.deploy(start);if(!reserveCommand)return battle;
   const exit=battle.exits.find(item=>item.destination==='jujuy');assert.ok(exit);
   const action={type:'exit',unitIds:['57'],exitId:exit.id};battle=actBattle(battle,action);assert.equal(battle.lastError,null,battle.lastError);
   report({event:'createdHighPassRearReserved',action,elapsedSeconds:battle.elapsedSeconds});return battle;
  }};
 }
 const infantry=initial.units.filter(unit=>arrivals.has(unit.id)&&unit.side==='player'&&unit.id!=='57'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure);
 assert.equal(infantry.length,4,'the real column needs three heavy crew and a separate light operator');
 const light=infantry.toSorted((a,b)=>b.marksmanship-a.marksmanship||Number(a.id)-Number(b.id))[0];
 const heavyIds=infantry.filter(unit=>unit.id!==light.id).map(unit=>unit.id);
 const leader=infantry.filter(unit=>heavyIds.includes(unit.id)).toSorted((a,b)=>b.marksmanship-a.marksmanship||Number(a.id)-Number(b.id))[0];
 const heavy=initial.artillery.find(g=>g.side==='player'&&g.type==='field8'),swivel=initial.artillery.find(g=>g.side==='player'&&g.type==='swivel');assert.ok(heavy&&swivel);
 const deploy=start=>{
  let battle=deployHighPassBattery(start,{lightId:light.id});
  if(reserveCommand){
   const before=structuredClone(battle),exit=battle.exits.find(item=>item.destination==='jujuy'&&item.edge==='E');assert.ok(exit);
   const action={type:'exit',unitIds:['57'],exitId:exit.id};battle=actBattle(battle,action);assert.equal(battle.lastError,null,battle.lastError);
   assert.equal(battle.units.find(unit=>unit.id==='57').departure.destination,'jujuy');
   assert.deepEqual(battle.artillery,before.artillery);
   for(const unit of before.units){const next=battle.units.find(actor=>actor.id===unit.id);for(const key of ['hp','maxHp','bleeding','loaded','ammo','medkits','weapon','condition','inventory','headwear','outfit','legwear'])assert.deepEqual(next[key],unit[key]);}
   assert.ok(battle.elapsedSeconds>before.elapsedSeconds);
   report({event:'createdHighPassRearReserved',action,elapsedSeconds:battle.elapsedSeconds-before.elapsedSeconds});
  }
  return battle;
 };
 const contact=heavyContactCrewController();
 const controller=(battle,unit)=>{
  if(unit.id==='57'&&reserveCommand)return null;
  if(battle.mode==='exploration'&&heavyIds.includes(unit.id))return mountainBatteryOrder(battle,unit,{
   leaderId:leader.id,helperId:unit.id===leader.id?heavyIds.find(id=>id!==leader.id):unit.id,
   artilleryId:heavy.id,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true,
  });
  if(battle.mode==='exploration'&&unit.id===light.id)return mountainBatteryOrder(battle,unit,{
   leaderId:light.id,helperId:'none',artilleryId:swivel.id,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true,
  });
  const action=contact(battle,unit);
  if(action?.type==='fire'){const preview=northernCombatOrder(battle,unit);if(preview?.type==='fire')return preview;}
  return action;
 };
 return {deploy,controller};
}
