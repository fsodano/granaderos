import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,ignitionRisk,reprimePlan} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {unitAmmunitionByType} from '../game/campaign-ammunition.js';

const field=(exploration=false)=>createBattle([{id:'p',x:2,y:2,weapon:1800,loaded:1,ammo:3,condition:60,priming:0,flints:0}],{width:24,height:8,seed:45,exploration,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false})),enemies:exploration?[]:[{id:'e',x:22,y:6,weapon:1800,loaded:1,ammo:3,jammed:true,priming:0,patrol:false,overwatch:false}]});
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};

test('zero legacy ignition stock neither changes misfire risk nor prevents paid field maintenance',()=>{
 for(const exploring of [false,true]){
  const s=field(exploring),u=s.units[0],before=unitAmmunitionByType(u);
  assert.equal(ignitionRisk(s,{...u,priming:0}),ignitionRisk(s,{...u,priming:50}));
  assert.ok(!inventoryUsage(u).slots.some(slot=>['priming','flints'].includes(slot.entry?.item)));
  const n=actBattle(s,{type:'repair',unitId:'p'});assert.equal(n.lastError,null);assert.equal(n.units[0].condition,90);assert.deepEqual(unitAmmunitionByType(n.units[0]),before);
  assert.equal(n.units[0].flints,undefined);assert.equal(n.units[0].priming,undefined);
  if(exploring){assert.equal(n.units[0].ap,u.ap);assert.ok(n.elapsedSeconds>s.elapsedSeconds);}else assert.ok(n.units[0].ap<u.ap);
 }
});

test('AI clears a jam without a loose powder stock and retains its ammunition',()=>{
 const s=field(),enemy=s.units[1],before=unitAmmunitionByType(enemy);
 assert.equal(reprimePlan(enemy,s).hands.length,1);assert.equal(chooseEnemyAction(s,enemy).type,'reprime');
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(n.units[1].jammed,false);assert.deepEqual(unitAmmunitionByType(n.units[1]),before);
});

test('retired workshop replenishment cannot issue supplies or change ignition stock',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:110,term:'week'});const u=s.operativeState[110];Object.assign(u,{priming:0,flints:0,rations:0,torches:0});
 assertTradeRejected(s,{type:'resupply',operativeId:110});assert.equal(s.operativeState[110].rations,0);assert.equal(s.operativeState[110].torches,0);

});

test('an active legacy save removes obsolete cursor and pocket stock without changing cartridges or named objects',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro),u=b.units.find(v=>v.id==='110'),ammo=unitAmmunitionByType(u);
 const wire=JSON.parse(encodeSave(s,b)),old=wire.battle.units.find(v=>v.id==='110');
 Object.assign(old,{priming:2,flints:1,equipmentCursor:{stack:{item:'priming',count:2}},pocketOrder:[...(old.pocketOrder??[]),{item:'flints',index:0,slot:11}]});
 wire.campaign.operativeState[110].priming=2;wire.campaign.operativeState[110].flints=1;
 wire.battle.groundItems.push({id:'old-flints',type:'flints',count:1,x:old.x,y:old.y});
 const first=decodeSave(JSON.stringify(wire)),second=decodeSave(encodeSave(first.campaign,first.battle)),v=second.battle.units.find(v=>v.id==='110');
 assert.deepEqual(unitAmmunitionByType(v),ammo);assert.equal(v.equipmentCursor,undefined);assert.equal(v.priming,undefined);assert.equal(v.flints,undefined);assert.ok(!v.pocketOrder.some(p=>p.item==='flints'));assert.ok(!second.battle.groundItems.some(g=>g.id==='old-flints'));assert.deepEqual(second,first);
});
