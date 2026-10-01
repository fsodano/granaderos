import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneTerrainCache} from '../game/scene-terrain.js';
import {enterSector} from '../game/world.js';
import {tileIllumination} from '../game/tactical.js';
test('unchanged scenery survives cloned battle ticks without retaining actor or campaign state',()=>{
 const read=createSceneTerrainCache(),s=enterSector({sector:'buenos_aires',squad:[{id:3}],enemies:[],exploration:true,hour:0});
 const first=read(s),next=structuredClone(s);next.units[0].x++;next.turn++;next.npcs=[{id:'civilian',x:2,y:2}];
 assert.equal(read(next),first);assert.equal('units' in first,false);assert.equal('npcs' in first,false);assert.equal('log' in first,false);
});
test('scenery refreshes for doors, damage, roofs, furniture, lights, weather lighting and map changes',()=>{
 const s=enterSector({sector:'buenos_aires',squad:[{id:3}],enemies:[],exploration:true,hour:0});
 for(const change of [s=>s.tiles[0].blocked=!s.tiles[0].blocked,s=>s.buildings[0].rooms[0].cells.pop(),s=>s.props[0].x++,s=>s.upperSurfaces[0].elevation++,s=>s.lights.push({x:1,y:1,radius:5}),s=>s.night=!s.night,s=>s.sceneId='different']){
  const read=createSceneTerrainCache(),first=read(s),next=structuredClone(s);change(next);assert.notEqual(read(next),first);assert.equal(read(structuredClone(next)),read(next));
 }
});
test('a torch countdown retains identical scenery until its light changes or expires',()=>{
 const read=createSceneTerrainCache(),s=enterSector({sector:'retiro',squad:[{id:110}],enemies:[],exploration:true,hour:0});
 const actor=s.units[0];s.lights=[{x:actor.x,y:actor.y,type:'torch',radius:5,intensity:.8,turns:3,remainingSeconds:1206}];
 const first=read(s),next=structuredClone(s);next.lights[0].remainingSeconds-=12;next.lights[0].turns=2;
 assert.equal(read(next),first,'elapsed fuel must not rebuild buildings and ground');
 for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)assert.equal(tileIllumination(first,actor.x+dx,actor.y+dy),tileIllumination(next,actor.x+dx,actor.y+dy));
 assert.equal(s.lights[0].turns,3,'render cache must not change the simulation');
 for(const change of [s=>s.lights[0].turns=0,s=>s.lights[0].extinguished=true,s=>s.lights[0].x++,s=>s.lights[0].intensity=.4,s=>s.lights=[]]){
  const changed=structuredClone(next);change(changed);assert.notEqual(read(changed),first);read(next);
 }
});
