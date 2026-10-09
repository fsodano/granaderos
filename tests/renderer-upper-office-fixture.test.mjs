import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUpperOfficeBattle} from '../web/app/renderer-sandbox/upper-office-fixture.js';
import {actBattle,canSee,climbPreview} from '../game/tactical.js';
import {validateTacticalSpace,sameCell} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {roomDecorProfile} from '../game/room-dressing.js';
const actor=(battle,id='office-climber')=>battle.units.find(unit=>unit.id===id);
const order=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null);validateBattleSnapshot(JSON.parse(JSON.stringify(next)));return next;};
test('upper-office fixture uses valid authored room cells, wood support and normal observers',()=>{
 const battle=createUpperOfficeBattle();validateTacticalSpace(battle);validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));assert.equal(battle.mode,'exploration');
 const building=battle.buildings[0],room=building.rooms.find(room=>room.tacticalLevel===1);assert.equal(room.cells.length,25);assert.equal(roomDecorProfile(building,room).floor,'wood');
 for(const cell of room.cells){const surface=battle.upperSurfaces.find(surface=>sameCell(surface,cell));assert.equal(surface.roomId,room.id);assert.equal(surface.buildingId,building.id);assert.equal(surface.elevation,3);assert.equal(surface.blocked,false);}
 assert.ok(battle.revealedRooms.includes(room.id));assert.ok(canSee(battle,actor(battle,'office-watch'),battle.climbLinks[0].to));
 const source=readFileSync(new URL('../web/app/renderer-sandbox/upper-office-fixture.js',import.meta.url),'utf8');assert.equal(/revealedRooms|visibilityOverride|cursorLevel|deferContact/.test(source),false);
});
test('the normal climb, upper walk, closed-cover return and descent preserve all floor inputs',()=>{
 const original=createUpperOfficeBattle();const surfaces=structuredClone(original.upperSurfaces),links=structuredClone(original.climbLinks),tiles=structuredClone(original.tiles),buildings=structuredClone(original.buildings);
 const link=original.climbLinks[0],preview=climbPreview(original,actor(original),{linkId:link.id});assert.equal(preview.valid,true,preview.reason);
 let battle=order(original,{type:'climb',unitId:'office-climber',linkId:link.id});assert.equal(actor(battle).tacticalLevel,1);
 battle=order(battle,{type:'move',unitId:'office-climber',x:6,y:6,tacticalLevel:1});
 battle=order(battle,{type:'move',unitId:'office-climber',...link.to});
 battle=order(battle,{type:'climb',unitId:'office-climber',linkId:link.id});assert.equal(actor(battle).tacticalLevel,0);assert.ok(sameCell(actor(battle),link.from));
 assert.deepEqual(battle.upperSurfaces,surfaces);assert.deepEqual(battle.climbLinks,links);assert.deepEqual(battle.tiles,tiles);assert.deepEqual(battle.buildings,buildings);assert.deepEqual(original,createUpperOfficeBattle());
});
