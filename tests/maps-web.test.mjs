import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {OPERATIVES} from '../game/data.js';
const key=t=>`${t.x},${t.y}`;
function path(map,a,b,forbidden=new Set()){
 const queue=[[a]],seen=new Set([key(a)]);
 while(queue.length){const p=queue.shift(),last=p.at(-1);if(last.x===b.x&&last.y===b.y)return p;
 for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=last.x+dx,y=last.y+dy,t=map.tiles[y*map.width+x];if(x>=0&&x<map.width&&y>=0&&y<map.height&&t&&!t.blocked&&!seen.has(key(t))&&!forbidden.has(key(t))){seen.add(key(t));queue.push([...p,t]);}}}return null;
}
test('all fifteen authored maps have unique deterministic layouts',()=>{
 assert.equal(MAP_IDS.length,15);const signatures=new Set();for(const sector of MAP_IDS){const req={sector,squad:OPERATIVES.slice(0,6),difficulty:4,cannons:3};const a=buildSectorMap(req),b=buildSectorMap(req);assert.deepEqual(a,b);assert.equal(a.tiles.length,320);assert.equal(new Set(a.tiles.map(key)).size,320);signatures.add(JSON.stringify(a.tiles));}assert.equal(signatures.size,15);
});
test('maximum normal deployments and artillery are collision-free, unblocked and connected',()=>{
 for(const sector of MAP_IDS){const map=buildSectorMap({sector,squad:OPERATIVES.slice(0,6),difficulty:4,cannons:3}),all=[...map.squad,...map.enemies,...map.artillery];assert.equal(new Set(all.map(key)).size,all.length,sector);
 for(const unit of all){assert.equal(map.tiles[unit.y*map.width+unit.x].blocked,false,`${sector}:${key(unit)}`);assert.ok(path(map,map.squad[0],unit),`${sector}: disconnected spawn ${key(unit)}`);}}
});
test('San Lorenzo convent has an enterable interior, windows and independent double doors',()=>{
 const map=buildSectorMap({sector:'san_lorenzo',squad:OPERATIVES.slice(0,6)}),d=map.decor[0];assert.equal(d.type,'convent');assert.equal(d.asset,'/art/convent.png');
 const interior=map.tiles.filter(t=>t.buildingId==='san_lorenzo:building');assert.equal(interior.length,d.width*d.height);
 const floor=interior.filter(t=>t.type==='floor');assert.equal(floor.length,(d.width-2)*(d.height-2));assert.ok(floor.every(t=>!t.blocked));
 const doors=interior.filter(t=>t.type==='door');assert.equal(doors.length,2);assert.notEqual(doors[0].doorId,doors[1].doorId);assert.equal(doors[0].y,doors[1].y);assert.equal(Math.abs(doors[0].x-doors[1].x),1);
 assert.ok(interior.some(t=>t.type==='window'&&t.blocked&&!t.blocksSight));
});
test('San Lorenzo has two independent charge avenues around the convent',()=>{
 const map=buildSectorMap({sector:'san_lorenzo'});const north=path(map,{x:2,y:2},{x:15,y:2}),south=path(map,{x:2,y:13},{x:15,y:13});assert.ok(north);assert.ok(south);assert.ok(north.every(p=>p.y<5));assert.ok(south.every(p=>p.y>=11));const blockedNorth=new Set(north.map(key));assert.ok(path(map,{x:2,y:13},{x:15,y:13},blockedNorth));
});
test('river sectors retain impassable connected eastern water boundaries',()=>{
 for(const sector of ['ensenada','san_nicolas','santa_fe','san_lorenzo']){const map=buildSectorMap({sector});for(let y=0;y<map.height;y++){const t=map.tiles[y*map.width+19];assert.equal(t.type,'water');assert.equal(t.blocked,true);}assert.ok(map.enemies.every(e=>e.x<18));}
});
test('Andean cliffs constrain a connected pass and defensive choke',()=>{
 for(const sector of ['uspallata','los_patos','humahuaca']){const map=buildSectorMap({sector,squad:OPERATIVES.slice(0,3)});assert.ok(map.tiles.filter(t=>t.blocked).length>=100);assert.ok(path(map,map.squad[0],map.enemies[0]));assert.equal(map.tiles[0].blocked,true);assert.equal(map.tiles.at(-1).blocked,true);}
});
test('unknown maps reject rather than silently substitute a generic battlefield',()=>{assert.throws(()=>buildSectorMap({sector:'not_a_sector'}));});

test('tactical engine consumes authored tiles and troop positions without a generic wall',async()=>{
 const {createBattle,getReachable}=await import('../game/tactical.js');
 for(const sector of MAP_IDS){const map=buildSectorMap({sector,squad:OPERATIVES.slice(0,3),difficulty:2}),battle=createBattle(map.squad,map);assert.deepEqual(battle.tiles,map.tiles);for(const op of map.squad){const unit=battle.units.find(u=>u.id===String(op.id));assert.equal(unit.x,op.x);assert.equal(unit.y,op.y);assert.ok(getReachable(battle,unit).length>1,`${sector}: immobile troop`);}}
});
