import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable,artilleryContact,teamCanSee} from '../game/tactical.js';
import {coastalSearchController} from './coastal-search-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';

// Keep the actual doctor in the rear and move the commander toward the
// existing gun crews through a public route. The guns retain their positions.
export function createdJujuyContinuingDefense(ready,{report=()=>{}}={}){
 const initial=enterSector(ready.pendingBattle,ready.sectorStates.jujuy);
 const people=initial.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure);
 const doctor=people.filter(u=>u.id!=='57'&&u.medical>=60).sort((a,b)=>a.marksmanship-b.marksmanship||a.id.localeCompare(b.id))[0];assert.ok(doctor);
 const crews=people.filter(u=>!['57',doctor.id].includes(u.id));assert.equal(crews.length,3);
 const kit=u=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','medkits','ammo','loaded','weapon','condition','inventory','headwear','outfit','legwear'].filter(k=>Object.hasOwn(u,k)).map(k=>[k,structuredClone(u[k])]));
 const deploy=start=>{
  let battle=start;const before=structuredClone(start),orders=[];
  const move=(id,x,y)=>{
   const unit=battle.units.find(u=>u.id===id),view={...battle,units:battle.units.filter(u=>u.side==='player'||teamCanSee(battle,'player',u))};
   assert.ok(getReachable(view,unit).some(p=>p.x===x&&p.y===y&&(p.tacticalLevel??0)===0),'the actual public route must reach its own formation');
   const action={type:'move',unitId:id,x,y},next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);battle=next;orders.push(action);
  };
  const command=battle.units.find(u=>u.id==='57');assert.ok(command);
  const view={...battle,units:battle.units.filter(u=>u.side==='player'||teamCanSee(battle,'player',u))};
  const reach=getReachable(view,command).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&!battle.artillery.some(g=>g.side==='player'&&artilleryContact(battle,{...command,...p},g)));
  const maximumDistance=p=>Math.max(...crews.map(u=>Math.hypot(p.x-u.x,p.y-u.y)));
  const point=reach.sort((a,b)=>maximumDistance(a)-maximumDistance(b)||a.cost-b.cost)[0];assert.ok(point);
  move(command.id,point.x,point.y);
  const physician=battle.units.find(u=>u.id===doctor.id),exit=battle.exits.find(e=>e.destination==='salta'&&e.edge==='E');assert.ok(exit);
  move(physician.id,battle.width-1,physician.y);
  const exitOrder={type:'exit',unitIds:[physician.id],exitId:exit.id};battle=actBattle(battle,exitOrder);assert.equal(battle.lastError,null,battle.lastError);orders.push(exitOrder);
  assert.equal(battle.units.find(u=>u.id===doctor.id).departure.destination,'salta');
  assert.deepEqual(battle.artillery,before.artillery,'command support and the real rear exit issue no gun or charge');
  for(const unit of before.units.filter(u=>u.side==='player'))assert.deepEqual(kit(battle.units.find(v=>v.id===unit.id)),kit(unit),'ordinary preparation preserves actual health, supplies and equipment');
  assert.ok(battle.elapsedSeconds>before.elapsedSeconds);assert.deepEqual(start,before);
  report({event:'createdJujuyRearDefensePrepared',orders,point:{x:point.x,y:point.y},pathCost:point.cost,elapsedSeconds:battle.elapsedSeconds-before.elapsedSeconds,doctorId:doctor.id});
  return battle;
 };
 const search=coastalSearchController(deploy(initial));
 const controller=(battle,unit)=>{
  const action=search(battle,unit);
  if(unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type))return null;
  if(action?.type==='fire'){const shot=northernCombatOrder(battle,unit);if(shot?.type==='fire')return shot;}
  return action;
 };
 return {deploy,controller};
}
