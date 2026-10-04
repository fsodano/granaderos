import assert from 'node:assert/strict';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {actBattle} from '../game/tactical.js';
import {recoveryBronzeContactController} from './recovery-paid-battery-driver.mjs';

// This paid column has eight real arrivals and two bronze guns. Place its
// support close to the battery, using only owned positions and legal entry
// cells. The existing contact policy keeps a usable crew crouched together.
export function createdLosPatosBattery(){
 function deploy(start){
  let battle=start;const model=sectorDeploymentModel(start);assert.ok(model);
  const guns=start.artillery.filter(g=>g.side==='player'&&!g.stationed);
  assert.equal(guns.length,2);assert.ok(guns.every(g=>g.type==='bronze4'));
  const center=Math.floor(guns.reduce((sum,g)=>sum+g.y,0)/guns.length),occupied=new Set();
  // Keep the donor between the two actual doctors before any advance, and
  // retain the other infantry close enough to screen the translated crew.
  const rows=[['7',3],['116',2],['122',4],['11',1],['138',0],['124',-1],['102',-2],['133',5]];
  assert.equal(model.units.length,rows.length);
  for(const [id,offset]of rows){
   const row=model.units.find(u=>u.id===id);assert.ok(row);assert.equal(row.edge,'E');
   const desired={x:start.width-1,y:center+offset};
   const point=model.entryCells[row.edge].filter(p=>!occupied.has(`${p.x},${p.y}`))
    .sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y)||a.y-b.y)[0];assert.ok(point);
   battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});assert.equal(battle.lastError,null,battle.lastError);occupied.add(`${point.x},${point.y}`);
  }
  battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null,battle.lastError);
  assert.deepEqual(battle.artillery,guns);
  const stock=battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0);
  assert.equal(battle.units.find(u=>u.id==='7').medkits,10);
  for(const targetId of ['116','122']){
   const doctor=battle.units.find(u=>u.id===targetId);assert.ok(doctor.medical>=60);assert.equal(doctor.medkits,0);
   battle=actBattle(battle,{type:'transferSupply',unitId:'7',targetId,item:'medkits',count:5});assert.equal(battle.lastError,null,battle.lastError);
   assert.equal(battle.units.find(u=>u.id===targetId).medkits,5);
  }
  assert.equal(battle.units.find(u=>u.id==='7').medkits,0);
  assert.equal(battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),stock);
  assert.deepEqual(battle.artillery,guns);
  return battle;
 }
 return {deploy,controller:recoveryBronzeContactController({holdCommand:false})};
}
