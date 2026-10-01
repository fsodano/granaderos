import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {withdrawCommandToRear} from './command-reserve-driver.mjs';

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
