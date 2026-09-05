import test from 'node:test';
import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {OPERATIVES} from '../game/data.js';
test('re-entering a sector retains breaches and dropped gear without duplicating the squad',()=>{
 const request={sector:'retiro',exploration:true,squad:OPERATIVES.filter(o=>[3,4].includes(o.id)),enemies:[],npcs:[{id:'guide',name:'Guía',x:1,y:4}]};
 const first=enterSector(request);const wall=first.tiles.find(t=>t.type==='wall');wall.blocked=false;wall.type='stone';
 first.groundItems=[{id:'bolas-1',x:3,y:3,count:1,type:'boleadoras'}];
 first.units[0].x=2;first.units[0].y=4;
 const returned=enterSector(request,first);
 assert.equal(returned.tiles.find(t=>t.x===wall.x&&t.y===wall.y).blocked,false);
 assert.deepEqual(returned.groundItems,first.groundItems);assert.equal(returned.units.length,2);
 assert.equal(returned.units[0].x,2);assert.equal(returned.mode,'exploration');assert.equal(returned.status,'active');
 assert.equal(new Set([...returned.units,...returned.npcs].map(p=>`${p.x},${p.y}`)).size,3);
});
test('a newly occupied cleared sector receives fresh defenders while unfinished enemies persist',()=>{
 const request={sector:'san_nicolas',squad:[OPERATIVES.find(o=>o.id===3)],enemies:[{id:'enemy-0',hp:80,maxHp:80,weapon:1800}]};
 const first=enterSector(request);first.units.find(u=>u.side==='enemy').hp=40;
 assert.equal(enterSector(request,first).units.find(u=>u.side==='enemy').hp,40);
 first.sectorCleared=true;assert.equal(enterSector(request,first).units.find(u=>u.side==='enemy').hp,80);
});
