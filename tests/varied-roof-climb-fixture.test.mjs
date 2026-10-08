import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOF_CLIMB_CASES,createVariedRoofClimbBattle} from '../web/app/renderer-sandbox/varied-roof-climb-fixture.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
for(const item of ROOF_CLIMB_CASES)test(`${item.id}: compiled paid ascent and return retain cells, height, AP and supplies`,()=>{
 const before=createVariedRoofClimbBattle(item.id),snapshot=structuredClone(before),id='height-climber',unit=s=>s.units.find(u=>u.id===id),start=unit(before),link=before.climbLinks.find(l=>l.id==='climb-house:climb:height-access');
 assert.equal(before.mode,'combat');assert.equal(start.ap,100);assert.equal(start.energy,100);assert.equal(before.tiles.find(t=>t.x===start.x&&t.y===start.y).elevation,item.base);assert.equal(before.upperSurfaces.find(s=>s.x===link.to.x&&s.y===link.to.y).elevation,item.base+item.height);assert.ok(Math.abs(link.to.x-link.from.x)+Math.abs(link.to.y-link.from.y)<=1);
 const result=presentedActBattle(before,{type:'climb',unitId:id,linkId:link.id}),up=result.state;assert.deepEqual(before,snapshot);assert.equal(up.lastError,null);assert.ok(result.frames.some(f=>f.type==='step'));assert.deepEqual({x:unit(up).x,y:unit(up).y,tacticalLevel:unit(up).tacticalLevel},link.to);assert.equal(unit(up).ap,80);assert.equal(unit(up).energy,88);
 const down=actBattle(up,{type:'climb',unitId:id,linkId:link.id});assert.equal(down.lastError,null);assert.deepEqual({x:unit(down).x,y:unit(down).y,tacticalLevel:unit(down).tacticalLevel},link.from);assert.equal(unit(down).ap,65);assert.equal(unit(down).energy,80);assert.equal(unit(down).weapon,start.weapon);assert.equal(unit(down).ammo,start.ammo);assert.equal(unit(down).loaded,start.loaded);
});
