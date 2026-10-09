import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import {createRendererSandboxBattle,RENDERER_SCENARIOS} from '../web/app/renderer-sandbox/fixtures.js';
import {createFurnishingsDetailBattle,createFurnishingsDetailReview} from '../web/app/renderer-sandbox/furnishings-detail-fixture.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {actBattle} from '../game/tactical.js';
import {PROP_TYPES,propBlocksAt,propCells,propPlacementError} from '../game/props.js';
import {roomAt} from '../game/tactical-visibility.js';
import {roomDressings} from '../game/room-dressing.js';
const {Scene}=await import('../web/node_modules/three/build/three.module.js');
const {presentWorld}=await import('../web/lib/three/presentation.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482;
function admitted(battle){
 const guard=battle.units[0],terrain={tiles:battle.tiles,buildings:battle.buildings,props:battle.props,night:battle.night};
 return presentWorld(battle,terrain,[guard],new Set(battle.revealedRooms),[{key:`unit:${guard.id}`,kind:'unit',actor:guard}],0);
}
function order(battle,action){
 const before=structuredClone(battle),next=actBattle(battle,action);assert.equal(next.lastError,null,`${JSON.stringify(action)}: ${next.lastError}`);assert.deepEqual(battle,before);
 assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));return next;
}

test('furniture detail choices create repeatable valid snapshots and keep the seven-prop scene exact',()=>{
 for(const view of ['interior','exterior']){
  const battle=createFurnishingsDetailBattle(view),again=createFurnishingsDetailBattle(view);assert.deepEqual(again,battle);assert.notEqual(again,battle);assert.notEqual(again.units[0],battle.units[0]);assert.notEqual(again.props,battle.props);assert.notEqual(again.buildings[0].rooms,battle.buildings[0].rooms);
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));assert.equal(battle.mode,'exploration');assert.equal(battle.status,'active');assert.equal(battle.units[0].stance,'standing');assert.equal(battle.units[0].activeSlot,'unarmed');
 }
 assert.deepEqual(createRendererSandboxBattle('furnishings-detail'),createFurnishingsDetailBattle());assert.deepEqual(createRendererSandboxBattle('furnishings-detail:exterior'),createFurnishingsDetailBattle('exterior'));
 assert.equal(RENDERER_SCENARIOS.find(item=>item.label==='Mobiliario').id,'furnishings-detail');
 const original=createRendererSandboxBattle('furnishings');assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),'23a4c1bf53af0942720cdcfa699404a319fcac37fd02d59f3972ad2cf1448570');
 assert.deepEqual(original.props.map(prop=>prop.type),['table','bench','bed','chest','barrels','hay','cart']);assert.throws(()=>createFurnishingsDetailBattle('forced'),/Unknown furniture review view/);
});

test('the recorded room visits replay only ordinary adjacent movement and door orders',()=>{
 const review=createFurnishingsDetailReview();let battle=createFurnishingsDetailBattle('exterior');assert.deepEqual(battle.revealedRooms,[]);assert.equal(review.visits.length,7);
 for(const visit of review.visits){
  const before=[...battle.revealedRooms];
  for(const action of visit.actions){
   const guard=battle.units[0];assert.ok(['move','door'].includes(action.type));
   if(action.type==='move')assert.equal(Math.abs(guard.x-action.x)+Math.abs(guard.y-action.y),1,'each review move is one normal step');
   else{const door=battle.tiles.find(tile=>tile.doorId===action.doorId);assert.ok(door&&!door.open&&action.open);assert.equal(Math.abs(guard.x-door.x)+Math.abs(guard.y-door.y),1,'doors are opened from an adjacent free cell');}
   battle=order(battle,action);
  }
  assert.deepEqual({x:battle.units[0].x,y:battle.units[0].y},visit.destination);assert.equal(roomAt(battle,battle.units[0]).id,visit.roomId);assert.deepEqual(battle.revealedRooms.filter(id=>!before.includes(id)),visit.newlyRevealed);
 }
 assert.deepEqual(battle,review.battle);assert.equal(battle.revealedRooms.length,6);assert.equal(battle.elapsedSeconds,117);
 assert.deepEqual(review.visits.slice(0,6).map(visit=>visit.newlyRevealed),review.visits.slice(0,6).map(visit=>[visit.roomId]));
 assert.equal(review.visits.flatMap(visit=>visit.actions).filter(action=>action.type==='door').length,6);assert.equal(review.visits.flatMap(visit=>visit.actions).filter(action=>action.type==='move').length,37);
});

test('unvisited rooms omit their furniture in the same ordinary admission path',()=>{
 const review=createFurnishingsDetailReview(),before=structuredClone(review.battle);let battle=createFurnishingsDetailBattle('exterior');
 assert.equal(admitted(battle).terrain.props.length,0,'the closed house must disclose no contents');
 for(const action of review.visits[0].actions)battle=order(battle,action);
 assert.deepEqual(battle.revealedRooms,['furnishings-detail-house:office']);const first=admitted(battle).terrain.props;
 assert.deepEqual(first.map(prop=>prop.type),['shelf','candle','rug']);assert.ok(first.every(prop=>prop.roomId===battle.revealedRooms[0]));assert.ok(!first.some(prop=>['bed','hearth','washstand','sacks'].includes(prop.type)));
 const shown=admitted(review.battle),types=new Set(shown.terrain.props.map(prop=>prop.type));for(const type of ['table','bench','bed','chest','washstand','hearth','shelf','pottery','sacks','rug'])assert.ok(types.has(type),`${type} must use normal visible prop admission`);
 assert.ok(shown.terrain.props.some(prop=>prop.type==='shelf'&&prop.purpose==='kitchen'));for(const purpose of ['office','archive'])assert.ok(shown.terrain.props.some(prop=>prop.type==='shelf'&&prop.purpose===purpose));
 assert.equal(shown.terrain.props.find(prop=>prop.id==='detail-chest-open').open,true);assert.equal(shown.terrain.props.find(prop=>prop.id==='detail-chest-closed').open,false);
 const world=createSectorWorld(new Scene(),{tileMetres:T,assetUrl:path=>path});world.update(shown);assert.equal(world.inspect().semanticIds.filter(id=>id.startsWith('prop:')).length,shown.terrain.props.length);
 world.update(admitted(createFurnishingsDetailBattle('exterior')));assert.equal(world.inspect().semanticIds.filter(id=>id.startsWith('prop:')).length,0);world.dispose();assert.deepEqual(review.battle,before);
});

test('fixture furniture has legal sides and door approaches, while dressing stays on free room floor',()=>{
 const battle=createFurnishingsDetailBattle(),before=structuredClone(battle),guard=battle.units[0],roomCells=new Map(battle.buildings[0].rooms.flatMap(room=>room.cells.map(cell=>[`${cell.x},${cell.y}`,room.id])));
 assert.ok(battle.props.every(prop=>PROP_TYPES.includes(prop.type)),'snapshot furniture types must stay unchanged');assert.ok(!propBlocksAt(battle,guard.x,guard.y));assert.equal(Math.abs(guard.x-5)+Math.abs(guard.y-8),1,'the standing guard must end beside the bed');
 for(const prop of battle.props)assert.equal(propPlacementError({...battle,props:battle.props.filter(item=>item.id!==prop.id)},prop),null,prop.id);
 const occupied=new Set(battle.props.flatMap(propCells).map(cell=>`${cell.x},${cell.y}`));
 for(const prop of roomDressings(battle)){
  const tile=battle.tiles.find(tile=>tile.x===prop.x&&tile.y===prop.y);assert.ok(tile&&!tile.blocked&&tile.type==='floor');assert.equal(roomCells.get(`${prop.x},${prop.y}`),prop.roomId);assert.ok(!occupied.has(`${prop.x},${prop.y}`));assert.equal(prop.blocksMovement,false);
 }
 battle.tiles.filter(tile=>tile.type==='door').forEach(door=>assert.ok(battle.tiles.some(tile=>Math.abs(tile.x-door.x)+Math.abs(tile.y-door.y)===1&&!tile.blocked&&!propBlocksAt(battle,tile.x,tile.y))));
 assert.deepEqual(battle,before);
});

test('a continued review can move, operate the entrance and return with normal orders',()=>{
 const trace=createFurnishingsDetailReview().visits;let battle=createFurnishingsDetailBattle('exterior');for(const action of trace[0].actions)battle=order(battle,action);
 const guardId=battle.units[0].id,entrance='furnishings-detail-house:entrance';
 for(const point of [{x:11,y:14},{x:11,y:15},{x:11,y:16},{x:11,y:17}])battle=order(battle,{type:'move',unitId:guardId,...point});
 battle=order(battle,{type:'door',unitId:guardId,doorId:entrance,open:false});assert.ok(battle.tiles.find(tile=>tile.doorId===entrance).blocked);
 const failed=actBattle(battle,{type:'move',unitId:guardId,x:11,y:16});assert.ok(failed.lastError);assert.deepEqual({x:failed.units[0].x,y:failed.units[0].y},{x:11,y:17});
 battle=order(battle,{type:'door',unitId:guardId,doorId:entrance,open:true});battle=order(battle,{type:'move',unitId:guardId,x:11,y:16});battle=order(battle,{type:'move',unitId:guardId,x:11,y:15});assert.equal(roomAt(battle,battle.units[0]).id,'furnishings-detail-house:office');
});
