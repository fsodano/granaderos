import test from 'node:test';
import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {OPERATIVES} from '../game/data.js';
import {actBattle, canSee, getReachable, teamCanSee} from '../game/tactical.js';
test('re-entering a sector retains breaches and dropped gear without duplicating the squad',()=>{
 for(const compactLayout of [false,true]){
  const request={sector:'retiro',compactLayout,exploration:true,squad:OPERATIVES.filter(o=>[3,4].includes(o.id)),enemies:[],npcs:[{id:'guide',name:'Guía',x:1,y:4}]};
  let first=enterSector(request);const resident=first.units[0],initialAmmo=resident.ammo;
  first=actBattle(first,{type:'drop',unitId:resident.id,item:'ammo',count:1});assert.equal(first.lastError,null);
  const gear=first.groundItems[0];assert.equal(gear.knownToPlayer,true);assert.equal(teamCanSee(first,'player',gear),true);
  const destination=getReachable(first,first.units[0]).find(cell=>Math.abs(cell.x-resident.x)+Math.abs(cell.y-resident.y)===1&&!first.tiles.find(t=>t.x===cell.x&&t.y===cell.y).buildingId&&canSee(first,{...first.units[0],...cell},gear));
  assert.ok(destination,'the generated deployment has an accessible adjacent position with sight of the dropped item');
  first=actBattle(first,{type:'move',unitId:resident.id,x:destination.x,y:destination.y});assert.equal(first.lastError,null);
  assert.equal(canSee(first,first.units[0],gear),true);
  const wall=first.tiles.find(t=>t.type==='wall');Object.assign(wall,{blocked:false,blocksSight:false,type:'stone',cover:0});
  const saved=structuredClone(first);
  const returned=enterSector({...request,squad:first.units.map(u=>({...u,entryReason:'resident'}))},first);
  assert.deepEqual(returned.tiles.find(t=>t.x===wall.x&&t.y===wall.y),wall);
  assert.deepEqual(returned.groundItems,saved.groundItems);assert.equal(returned.groundItems.length,1);
  assert.equal(returned.units.length,2);assert.equal(new Set(returned.units.map(u=>u.id)).size,2);
  assert.deepEqual(returned.units.map(({id,x,y,ammo})=>({id,x,y,ammo})),saved.units.map(({id,x,y,ammo})=>({id,x,y,ammo})));
  assert.equal(returned.units[0].ammo+returned.groundItems[0].count,initialAmmo);
  assert.equal(teamCanSee(returned,'player',returned.groundItems[0]),true);
  assert.equal(returned.mode,'exploration');assert.equal(returned.status,'active');
  assert.equal(new Set([...returned.units,...returned.npcs].map(p=>`${p.x},${p.y}`)).size,3);
  assert.deepEqual(first,saved);
 }
});
test('a newly occupied cleared sector receives fresh defenders while unfinished enemies persist',()=>{
 const request={sector:'san_nicolas',squad:[OPERATIVES.find(o=>o.id===3)],enemies:[{id:'enemy-0',hp:80,maxHp:80,weapon:1800}]};
 const first=enterSector(request);first.units.find(u=>u.side==='enemy').hp=40;
 assert.equal(enterSector(request,first).units.find(u=>u.side==='enemy').hp,40);
 first.sectorCleared=true;assert.equal(enterSector(request,first).units.find(u=>u.side==='enemy').hp,80);
});
