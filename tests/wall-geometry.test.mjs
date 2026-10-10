import test from 'node:test';
import assert from 'node:assert/strict';
import {wallEdgeCenter,wallEdgeEndpoints,wallEdgeCells,wallEdgesBetween,wallMovementBlocked,normalizeBuildingWalls,buildingEdgeRooms} from '../game/wall-geometry.js';

test('grid edges have exact shared-cell planes and incident cells',()=>{
  assert.deepEqual(wallEdgeCenter({x:3,y:4,axis:'x'}),{x:3,y:3.5,tacticalLevel:0});
  assert.deepEqual(wallEdgeEndpoints({x:3,y:4,axis:'y'}),[{x:2.5,y:3.5,tacticalLevel:0},{x:2.5,y:4.5,tacticalLevel:0}]);
  assert.deepEqual(wallEdgeCells({x:3,y:4,axis:'y'}),[{x:2,y:4,tacticalLevel:0},{x:3,y:4,tacticalLevel:0}]);
});
test('an edge blocks only crossing and reads live door and destruction state',()=>{
  const edge={id:'leaf',x:3,y:4,axis:'y',type:'door',open:false},s={wallEdges:[edge]},a={x:2,y:4},b={x:3,y:4};
  assert.deepEqual(wallEdgesBetween(s,a,b),[edge]);
  assert.deepEqual(wallEdgesBetween(s,b,a),[edge]);
  assert.equal(wallMovementBlocked(s,a,b),true);
  assert.equal(wallMovementBlocked(s,a,{x:2,y:5}),false);
  edge.open=true;assert.equal(wallMovementBlocked(s,a,b),false);
  edge.open=false;edge.locked=true;assert.equal(wallMovementBlocked(s,a,b,{openDoors:true}),true);
  edge.destroyed=true;assert.equal(wallMovementBlocked(s,a,b),false);
  assert.equal(wallMovementBlocked(s,{...a,tacticalLevel:1},{...b,tacticalLevel:1}),false);
});
test('each of the four edges at a diagonal corner prevents a shortcut',()=>{
  for(const edge of [{x:3,y:2,axis:'y'},{x:2,y:3,axis:'x'},{x:3,y:3,axis:'x'},{x:3,y:3,axis:'y'}]){
    const s={wallEdges:[{...edge,type:'wall'}]},a={x:2,y:2},b={x:3,y:3};
    assert.equal(wallMovementBlocked(s,a,b),true,JSON.stringify(edge));
    assert.equal(wallMovementBlocked(s,b,a),true);
  }
});
test('legacy outer walls become a closed shell with all footprint cells usable',()=>{
  const b={id:'b',x:1,y:1,width:5,height:5,rooms:[{id:'room',name:'Sala',cells:[{x:2,y:2}]}],walls:[]};
  for(let y=1;y<=5;y++)for(let x=1;x<=5;x++)if(x===1||x===5||y===1||y===5)b.walls.push({x,y,type:'wall'});
  const walls=normalizeBuildingWalls(b),rooms=buildingEdgeRooms(b,walls);
  assert.equal(walls.length,20);assert.equal(rooms.length,1);assert.equal(rooms[0].cells.length,25);assert.equal(rooms[0].id,'room');
  const s={wallEdges:walls};
  for(let x=1;x<=5;x++)for(const [a,z] of [[{x,y:0},{x,y:1}],[{x,y:5},{x,y:6}]])assert.equal(wallMovementBlocked(s,a,z),true);
  for(let y=1;y<=5;y++)for(const [a,z] of [[{x:0,y},{x:1,y}],[{x:5,y},{x:6,y}]])assert.equal(wallMovementBlocked(s,a,z),true);
});
test('legacy internal partitions remain joined to the expanded perimeter',()=>{
  const b={id:'b',x:1,y:1,width:7,height:7,walls:[]};
  for(let y=1;y<=7;y++)for(let x=1;x<=7;x++)if(x===1||x===7||y===1||y===7||x===4)b.walls.push({x,y,type:'wall'});
  const walls=normalizeBuildingWalls(b),rooms=buildingEdgeRooms(b,walls);
  assert.equal(rooms.length,2);assert.equal(rooms.reduce((n,r)=>n+r.cells.length,0),49);
  for(let y=1;y<=7;y++)assert.equal(wallMovementBlocked({wallEdges:walls},{x:4,y},{x:5,y}),true);
});
