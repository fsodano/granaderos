import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,artilleryCrewPlan} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {withdrawCommandToRear,deployHighPassBattery} from './command-reserve-driver.mjs';

test('a rear withdrawal deploys only arriving soldiers and preserves retained casualties',()=>{
 const squad=['107','143'].map((id,i)=>({id,x:0,y:5+i,weapon:1801,loaded:1,ammo:5,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:5}}));
 const battle=createBattle(squad,{width:24,height:16,seed:45,exploration:true,deferContact:true,enemies:[]});
 battle.units.push({...structuredClone(battle.units[0]),id:'old-casualty',hp:0,ap:0,maxAP:0,x:8,y:8,entryReason:'retained'});
 battle.exits=[{id:'rear-exit',destination:'cordoba',x:0,y:5,edge:'W',cells:Array.from({length:16},(_,y)=>({x:0,y}))}];
 assert.equal(beginSectorDeployment(battle,{squad}),true);
 const before=structuredClone(battle),next=withdrawCommandToRear(battle,107,'cordoba')(battle);
 assert.deepEqual(battle,before);
 assert.equal(next.deploymentComplete,true);
 assert.equal(next.units.find(unit=>unit.id==='107').departure.destination,'cordoba');
 assert.deepEqual(next.units.find(unit=>unit.id==='old-casualty'),before.units.find(unit=>unit.id==='old-casualty'));
 const staying=next.units.find(unit=>unit.id==='143');
 assert.equal(staying.departure,undefined);assert.equal(staying.ammo,5);assert.equal(staying.loaded,1);
});

test('a packed high-pass entry gives the heavy and light guns separate complete crews',()=>{
 for(const ids of [['145','57','132','109','118'],['145','132','109','118','143']]){
 const squad=ids.map((id,i)=>({id,x:23,y:5+i,weapon:1801,loaded:1,ammo:5,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:8}}));
 const tiles=Array.from({length:24*16},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
 const battle=createBattle(squad,{width:24,height:16,tiles,seed:45,exploration:true,deferContact:true,enemies:[],artillery:[
  {id:'heavy',type:'field8',side:'player',x:22,y:7,loaded:true,ammo:6},
  {id:'light',type:'swivel',side:'player',x:22,y:6,loaded:true,ammo:6},
 ]});
 assert.equal(beginSectorDeployment(battle,{squad}),true);
 const before=structuredClone(battle),next=deployHighPassBattery(battle,{lightId:'145'});
 assert.deepEqual(battle,before);assert.equal(next.deploymentComplete,true);
 const heavy=next.artillery.find(g=>g.id==='heavy'),light=next.artillery.find(g=>g.id==='light');
 for(const id of ['132','109','118']){
  const crew=artilleryCrewPlan(next,next.units.find(u=>u.id===id),heavy,0);
  assert.equal(crew.reason,null);assert.deepEqual([...crew.crew].sort(),['109','118','132']);
 }
 const crew=artilleryCrewPlan(next,next.units.find(u=>u.id==='145'),light,0);
 assert.equal(crew.reason,null);assert.deepEqual(crew.crew,['145']);
 assert.deepEqual(next.artillery,before.artillery);assert.equal(next.elapsedSeconds,before.elapsedSeconds);assert.equal(next.seed,before.seed);
 for(const unit of next.units){const old=before.units.find(u=>u.id===unit.id);for(const key of ['hp','ap','loaded','ammo','medkits','morale','energy'])assert.deepEqual(unit[key],old[key]);}
 }
});
