import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {finiteBatteryDriver} from './finite-battery-driver.mjs';
import {createdFinalCapitalBattery} from './created-capital-return.mjs';
import {createdFiveSupportCapitalBattery} from './created-final-capital-battery.mjs';

// Explicit existing field equipment isolates the mixed-type controller. It
// does not provide property to a campaign or claim any fresh route victory.
function staged(count=5,placement=true){
 const squad=Array.from({length:count},(_,index)=>({id:index===0?'57':String(index),name:`Crew ${index}`,weapon:1801,x:0,y:index+2,hp:60,maxHp:85,medkits:2,loaded:1,ammo:3,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:8}}));
 const artillery=[{id:'owned-light',type:'swivel',x:2,y:4,loaded:true,ammo:0},{id:'owned-bronze',type:'bronze4',x:2,y:8,loaded:true,ammo:1},{id:'owned-heavy',type:'field8',x:2,y:12,loaded:false,ammo:2}];
 const battle=createBattle(squad,{width:32,height:24,exploration:true,deferContact:true,artillery,enemies:[],seed:13});
 if(placement)assert.equal(beginSectorDeployment(battle,{squad}),true);return battle;
}

test('mixed created capital policies place actual arrivals and preserve finite gun records and wounds',()=>{
 const start=staged(),before=structuredClone(start),initial=staged(5,false),ids=start.artillery.map(gun=>gun.id);
 for(const policy of [finiteBatteryDriver(initial),createdFinalCapitalBattery(initial),createdFiveSupportCapitalBattery(initial,{arrivalIds:ids})]){
  const deployed=policy.deploy(start);assert.equal(deployed.deploymentComplete,true);assert.deepEqual(deployed.artillery,start.artillery);
  for(const unit of start.units){const actual=deployed.units.find(row=>row.id===unit.id);for(const key of ['hp','maxHp','bleeding','ammo','loaded','medkits','condition','inventory'])assert.deepEqual(actual[key],unit[key]);}
  assert.equal(deployed.artillery.reduce((sum,gun)=>sum+gun.ammo+Number(gun.loaded),0),5);
  assert.deepEqual(policy.deploy(start),deployed,'Entry preparation replays deterministically.');
  for(const unit of deployed.units){const action=policy.controller(deployed,unit);if(action){const next=actBattle(deployed,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);assert.ok(next.elapsedSeconds>=deployed.elapsedSeconds);}}
 }
 assert.deepEqual(start,before);
});

test('the actual mixed battery rejects insufficient crew before any placement or state change',()=>{
 const start=staged(2),before=structuredClone(start);
 assert.throws(()=>finiteBatteryDriver(start),/crew requirement/);assert.deepEqual(start,before);
});
