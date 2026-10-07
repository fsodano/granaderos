import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCHITECTURE_REVIEW_TEMPLATES,ARCHITECTURE_REVIEW_ROOFS,createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {BUILDING_TEMPLATES} from '../game/map-templates.js';
import {entranceFrame} from '../game/building-profile.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {propBlocksAt} from '../game/props.js';
import {actBattle} from '../game/tactical.js';

test('the playable catalogue covers fourteen compiled templates, three views and four actual rotations',()=>{
 assert.deepEqual(ARCHITECTURE_REVIEW_TEMPLATES.map(item=>item.id),Object.keys(BUILDING_TEMPLATES));
 const before=structuredClone(BUILDING_TEMPLATES);let checked=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const exterior=createArchitectureReviewBattle(id,rotation,'exterior'),building=exterior.buildings[0],frame=entranceFrame(building),guard=exterior.units[0],original=BUILDING_TEMPLATES[id].building;
  assert.equal(building.kind,original.kind);assert.equal(building.width,rotation%180?original.height:original.width);assert.equal(building.height,rotation%180?original.width:original.height);
  assert.deepEqual({x:guard.x,y:guard.y},frame.at(frame.doorU,-2));assert.deepEqual(exterior.revealedRooms,[]);assert.ok(exterior.tiles.filter(tile=>tile.type==='door').every(tile=>!tile.open));
  for(const view of ['exterior','partial','interior']){
   const battle=view==='exterior'?exterior:createArchitectureReviewBattle(id,rotation,view),unit=battle.units[0],room=battle.buildings[0].rooms.find(room=>room.cells.some(cell=>cell.x===unit.x&&cell.y===unit.y));
   assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),`${id}/${rotation}/${view}`);
   assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.equal(battle.mode,'exploration');assert.equal(battle.units.length,1);assert.equal(battle.lastError,null);
   assert.ok(!propBlocksAt(battle,unit.x,unit.y));
   if(view==='partial'){assert.ok(room,'guard actually entered the room');assert.deepEqual(battle.revealedRooms,[room.id]);}
   if(view==='interior')assert.deepEqual(new Set(battle.revealedRooms),new Set(battle.buildings[0].rooms.map(room=>room.id)));
   if(view!=='exterior'){assert.ok(battle.elapsedSeconds>0,'preparation uses normal timed exploration orders');assert.ok(battle.tiles.some(tile=>tile.type==='door'&&tile.open),'the reducer opens the main door');}
   checked++;
  }
 }
 assert.equal(checked,168);assert.deepEqual(BUILDING_TEMPLATES,before,'review does not alter source maps or campaign assets');
});

test('catalogue views reset deterministically and can continue through ordinary movement orders',()=>{
 for(const view of ['exterior','partial','interior']){
  const id=`catalog:palacio:90:${view}`,battle=createRendererSandboxBattle(id),again=createRendererSandboxBattle(id),unit=battle.units[0];
  assert.deepEqual(again,battle);assert.notEqual(again,battle);assert.notEqual(again.tiles,battle.tiles);
  const adjacent=battle.tiles.find(tile=>Math.abs(tile.x-unit.x)+Math.abs(tile.y-unit.y)===1&&!tile.blocked&&!propBlocksAt(battle,tile.x,tile.y));assert.ok(adjacent);
  const before=structuredClone(battle),next=actBattle(battle,{type:'move',unitId:unit.id,x:adjacent.x,y:adjacent.y});
  assert.equal(next.lastError,null);assert.equal(next.units[0].x,adjacent.x);assert.equal(next.units[0].y,adjacent.y);assert.deepEqual(battle,before);assert.doesNotThrow(()=>validateBattleSnapshot(next));
 }
 assert.throws(()=>createArchitectureReviewBattle('missing'),/Unknown building template/);
 assert.throws(()=>createArchitectureReviewBattle('casa',45),/Unknown building rotation/);
 assert.throws(()=>createArchitectureReviewBattle('casa',0,'fake'),/Unknown building view/);
 assert.throws(()=>createArchitectureReviewBattle('casa',0,'exterior','fake'),/Unknown building roof/);
});

test('visible catalogue roof states retain compiled structure and ordinary room entry through four rotations',()=>{
 const before=structuredClone(BUILDING_TEMPLATES);let checked=0;
 assert.deepEqual(ARCHITECTURE_REVIEW_ROOFS.map(roof=>roof.id),['original','terrace','slab','roof-route']);
 for(const id of ['capilla','casa','herreria'])for(const rotation of [0,90,180,270])for(const roof of ['terrace','slab','roof-route'])for(const view of ['exterior','partial','interior']){
  const battle=createRendererSandboxBattle(`catalog:${id}:${rotation}:${view}:${roof}`),b=battle.buildings[0],source=BUILDING_TEMPLATES[id].building;
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));assert.equal(b.kind,source.kind);assert.equal(b.roof,roof==='slab'?source.roof:'terrace');
  for(const finish of ['wallFinish','roofFinish','doorStyle','windowStyle'])assert.equal(b[finish],source[finish],'the roof review must retain authored finishes');
  if(roof==='terrace')assert.equal(battle.upperSurfaces,undefined);
  else{assert.equal(battle.upperSurfaces.length,b.width*b.height);assert.ok(battle.upperSurfaces.every(surface=>surface.elevation===3&&surface.kind==='roof'&&surface.blocked===(roof==='slab')));if(roof==='slab')assert.ok(battle.upperSurfaces.every(surface=>surface.obstacleHeight===0));assert.equal(battle.climbLinks.length,roof==='roof-route'?1:0);}
  if(view==='exterior')assert.deepEqual(battle.revealedRooms,[]);else{assert.ok(battle.elapsedSeconds>0);assert.ok(battle.tiles.some(tile=>tile.type==='door'&&tile.open));assert.equal(battle.revealedRooms.length,view==='partial'?1:b.rooms.length);}
  checked++;
 }
 assert.equal(checked,108);assert.deepEqual(BUILDING_TEMPLATES,before);
});

test('accessible catalogue roofs support real ascent, roof movement and descent with ordinary orders',()=>{
 for(const id of ['capilla','casa','herreria'])for(const rotation of [0,90,180,270]){
  let battle=createArchitectureReviewBattle(id,rotation,'exterior','roof-route');const unitId=battle.units[0].id,link=battle.climbLinks[0];
  const order=action=>{const before=structuredClone(battle),next=actBattle(battle,{unitId,...action});assert.equal(next.lastError,null);assert.deepEqual(battle,before);assert.doesNotThrow(()=>validateBattleSnapshot(next));battle=next;};
  order({type:'move',...link.from});order({type:'climb',linkId:link.id});assert.equal(battle.units[0].tacticalLevel,1);assert.equal(battle.units[0].x,link.to.x);assert.equal(battle.units[0].y,link.to.y);
  const next=battle.upperSurfaces.find(surface=>Math.abs(surface.x-link.to.x)+Math.abs(surface.y-link.to.y)===1);assert.ok(next);order({type:'move',x:next.x,y:next.y,tacticalLevel:1});order({type:'move',...link.to});order({type:'climb',linkId:link.id});
  assert.equal(battle.units[0].tacticalLevel,0);assert.equal(battle.units[0].x,link.from.x);assert.equal(battle.units[0].y,link.from.y);assert.ok(battle.elapsedSeconds>0);
 }
});

test('a blocked metric roof cell still rejects movement when its visible obstacle height is zero',()=>{
 let battle=createArchitectureReviewBattle('capilla',0,'exterior','roof-route');const unitId=battle.units[0].id,link=battle.climbLinks[0];
 battle={...battle,upperSurfaces:battle.upperSurfaces.map(surface=>({...surface,blocked:surface.x!==link.to.x||surface.y!==link.to.y,obstacleHeight:0}))};assert.doesNotThrow(()=>validateBattleSnapshot(battle));
 for(const action of [{type:'move',...link.from},{type:'climb',linkId:link.id}]){battle=actBattle(battle,{unitId,...action});assert.equal(battle.lastError,null);}
 const blocked=battle.upperSurfaces.find(surface=>surface.blocked&&Math.abs(surface.x-link.to.x)+Math.abs(surface.y-link.to.y)===1);assert.ok(blocked);const before=structuredClone(battle),next=actBattle(battle,{type:'move',unitId,x:blocked.x,y:blocked.y,tacticalLevel:1});
 assert.ok(next.lastError);assert.deepEqual(battle,before);assert.deepEqual({x:next.units[0].x,y:next.units[0].y,tacticalLevel:next.units[0].tacticalLevel},link.to);assert.ok(next.upperSurfaces.find(surface=>surface.id===blocked.id).blocked);assert.doesNotThrow(()=>validateBattleSnapshot(next));
});
