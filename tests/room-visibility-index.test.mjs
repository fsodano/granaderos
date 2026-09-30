import test from 'node:test';
import assert from 'node:assert/strict';
import {roomAt,isInteriorVisible} from '../game/tactical-visibility.js';
import {sameCell,surfaceAt,tacticalLevel} from '../game/tactical-space.js';
import {buildSectorMap} from '../game/maps.js';
import {placeBuilding} from '../game/buildings.js';
import {createBattle,actBattle,visibleRooms} from '../game/tactical.js';

// The uncached scan is an independent oracle for membership and disclosure.
const scanRoom=(state,point)=>(state.buildings??[]).flatMap(building=>building.rooms??[]).find(room=>room.cells?.some(cell=>sameCell({...cell,tacticalLevel:cell.tacticalLevel??room.tacticalLevel??0},{...point,x:Math.round(point.x),y:Math.round(point.y)})));
function scanVisible(state,point,revealed){
 const room=scanRoom(state,point),tile=surfaceAt(state,{...point,x:Math.round(point.x),y:Math.round(point.y)});
 const tagged=point.roomId&&(state.buildings??[]).flatMap(b=>b.rooms??[]).find(r=>r.id===point.roomId);
 const inherited=tacticalLevel(point)>0&&tagged&&!tagged.cells?.some(cell=>tacticalLevel({...cell,tacticalLevel:cell.tacticalLevel??tagged.tacticalLevel??0})===tacticalLevel(point));
 const id=room?.id??tile?.roomId??(inherited?undefined:point.roomId);
 return id?revealed.has(id):point.buildingId&&(!tacticalLevel(point)||tile?.kind!=='roof')?false:true;
}
const room=(id,x=2,level)=>({id,...(level===undefined?{}:{tacticalLevel:level}),cells:[{x,y:2}]});
const stateFor=rooms=>({width:8,height:6,tiles:Array.from({length:48},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false})),buildings:[{id:'house',rooms}]});

test('indexed rooms retain first-match order, rounded points and explicit or inherited physical floors',()=>{
 const first=room('first'),second=room('second'),upper=room('upper',2,1);
 upper.cells.push({x:3,y:2,tacticalLevel:0});
 const state=stateFor([first,second,upper]);
 for(const point of [{x:2,y:2},{x:2.49,y:1.51},{x:2,y:2,tacticalLevel:0},{x:2,y:2,tacticalLevel:1},{x:3,y:2},{x:3,y:2,tacticalLevel:1},{x:2.5,y:2,tacticalLevel:1}])assert.equal(roomAt(state,point),scanRoom(state,point));
 assert.equal(roomAt(state,{x:2,y:2}),first);assert.equal(roomAt(state,{x:2,y:2,tacticalLevel:1}),upper);
 assert.equal(roomAt(state,{x:3,y:2}),upper);assert.equal(roomAt(state,{x:3,y:2,tacticalLevel:1}),undefined);
});

test('room additions, same-array reordering and replaced topology invalidate first-match membership',()=>{
 const a=room('a'),b=room('b'),state=stateFor([a,b]),point={x:2,y:2};
 assert.equal(roomAt(state,point),a);state.buildings[0].rooms.reverse();assert.equal(roomAt(state,point),b);
 state.buildings[0].rooms.push(room('new',3));assert.equal(roomAt(state,{x:3,y:2}).id,'new');state.buildings[0].rooms.pop();assert.equal(roomAt(state,{x:3,y:2}),undefined);
 b.cells=[{x:4,y:2}];assert.equal(roomAt(state,point),a);assert.equal(roomAt(state,{x:4,y:2}),b);
 b.cells.push({x:5,y:2});assert.equal(roomAt(state,{x:5,y:2}),b);
 b.tacticalLevel=1;assert.equal(roomAt(state,{x:4,y:2}),undefined);assert.equal(roomAt(state,{x:4,y:2,tacticalLevel:1}),b);
 state.buildings.push({id:'other',rooms:[room('other')]});state.buildings.reverse();assert.equal(roomAt(state,point).id,'other');
 state.buildings[0].rooms=[room('replacement')];assert.equal(roomAt(state,point).id,'replacement');
 const fresh=structuredClone(state);fresh.buildings[0].rooms[0].cells[0].x=6;
 assert.equal(roomAt(fresh,{x:6,y:2}).id,'replacement');assert.equal(roomAt(state,{x:6,y:2}),undefined);assert.equal(roomAt(fresh,point).id,'a','later rooms still match after the first room moves');
});

test('tagged ground rooms cannot hide a roof, while separate upper rooms remain undisclosed',()=>{
 const down=room('down'),up=room('up',3,1),state=stateFor([down,up]);
 state.upperSurfaces=[2,3,4].map(x=>({id:`roof:${x}`,x,y:2,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',buildingId:'house'}));
 const roof={x:2,y:2,tacticalLevel:1,buildingId:'house',roomId:'down'},inside={x:3,y:2,tacticalLevel:1,buildingId:'house'};
 assert.equal(isInteriorVisible(state,roof,new Set()),true);assert.equal(isInteriorVisible(state,inside,new Set()),false);assert.equal(isInteriorVisible(state,inside,new Set(['up'])),true);
 assert.equal(isInteriorVisible(state,{x:4,y:2,buildingId:'house',roomId:'unknown'},new Set()),false);
 down.id='renamed';assert.equal(isInteriorVisible(state,{x:4,y:2,tacticalLevel:1,roomId:'renamed'},new Set()),true);
 assert.equal(isInteriorVisible(state,{x:4,y:2,tacticalLevel:1,roomId:'down'},new Set()),false,'a stale unknown tag stays hidden');
});

test('real doors and breaches change disclosure on fresh snapshots after the room index is warmed',()=>{
 const ground=Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
 const built=placeBuilding(ground,{id:'house',x:4,y:2,width:6,height:6,doors:[{id:'door',x:6,y:2}]});
 for(const action of [{type:'door',doorId:'door'},{type:'breach',x:6,y:2}]){
  const state=createBattle([{id:'p',x:6,y:1}],{width:20,height:12,tiles:built.tiles,buildings:[built.building],exploration:true,enemies:[]}),inside={x:6,y:3};
  assert.equal(roomAt(state,inside).id,'house:interior');assert.equal(isInteriorVisible(state,inside,new Set(visibleRooms(state))),false);
  const next=actBattle(state,{unitId:'p',...action});assert.equal(next.lastError,null);assert.equal(next.tiles.find(t=>t.x===6&&t.y===2).blocked,false);
  assert.equal(isInteriorVisible(next,inside,new Set(visibleRooms(next))),true);assert.equal(isInteriorVisible(state,inside,new Set(visibleRooms(state))),false);
 }
});

test('all actual BA and Tucumán ground and upper cells match the uncached visibility scan',()=>{
 for(const sector of ['buenos_aires','tucuman']){
  const state=buildSectorMap({sector,squad:[],enemies:[],exploration:true}),rooms=state.buildings.flatMap(b=>b.rooms??[]);
  const reveals=[new Set(),new Set(rooms.filter((_,i)=>i%2).map(r=>r.id)),new Set(rooms.map(r=>r.id))];
  for(const point of [...state.tiles,...state.upperSurfaces]){
   assert.equal(roomAt(state,point),scanRoom(state,point));assert.equal(roomAt(state,{...point,x:point.x+.2,y:point.y-.2}),scanRoom(state,point));
   for(const revealed of reveals)assert.equal(isInteriorVisible(state,point,revealed),scanVisible(state,point,revealed),`${sector} ${point.x},${point.y},${tacticalLevel(point)}`);
  }
 }
});
