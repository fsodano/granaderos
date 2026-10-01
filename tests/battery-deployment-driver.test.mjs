import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {deployBatteryFlanks,deployInfantryLine} from './battery-deployment-driver.mjs';

test('battery arrival places the crew together and infantry on both legal flanks without changing supplies',()=>{
 const squad=[1000,139,144,107,141].map((id,i)=>({id:String(id),x:23,y:4+i,weapon:1805,loaded:1,ammo:5,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:8}}));
 const b=createBattle(squad,{width:24,height:16,seed:45,exploration:true,deferContact:true,enemies:[]});
 assert.equal(beginSectorDeployment(b,{squad}),true);
 const before=structuredClone(b),next=deployBatteryFlanks(b);
 assert.deepEqual(b,before);assert.equal(next.deploymentComplete,true);assert.equal(next.elapsedSeconds,0);
 for(const u of next.units){assert.equal(u.x,23);assert.equal(u.loaded,1);assert.equal(u.ammo,5);assert.equal(u.hp,b.units.find(v=>v.id===u.id).hp);}
 const p=id=>next.units.find(u=>u.id===String(id));
 assert.ok(Math.abs(p(1000).y-p(139).y)<=1);
 assert.ok(p(144).y<p(1000).y);assert.ok(p(141).y>p(139).y);
});

test('infantry spread uses every actual squad arrival edge and retains combat supplies',()=>{
 const squad=[['125','N'],['128','N'],['132','E'],['57','E']].map(([id,entryEdge])=>({id,x:23,y:4,weapon:1805,loaded:1,ammo:5,entryReason:'arrival',entryEdge,entryAnchor:entryEdge==='N'?{x:10,y:0}:{x:19,y:8}}));
 const b=createBattle(squad,{width:24,height:16,seed:45,exploration:true,deferContact:true,enemies:[]});
 assert.equal(beginSectorDeployment(b,{squad}),true);
 const before=structuredClone(b),next=deployInfantryLine(b);
 assert.deepEqual(b,before);assert.equal(next.deploymentComplete,true);assert.equal(next.elapsedSeconds,0);
 for(const u of next.units){
  assert.equal(u[u.entryEdge==='N'?'y':'x'],u.entryEdge==='N'?0:23);
  const original=b.units.find(v=>v.id===u.id);
  for(const key of ['hp','ap','ammo','loaded','morale'])assert.equal(u[key],original[key]);
 }
 const p=id=>next.units.find(u=>u.id===id);
 assert.ok(Math.abs(p('125').x-p('128').x)>5);
 assert.ok(Math.abs(p('132').y-p('57').y)>5);
});
