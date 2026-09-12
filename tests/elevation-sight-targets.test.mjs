import test from 'node:test';
import assert from 'node:assert/strict';
import {elevationSightClear} from '../game/sight-geometry.js';
import {projectileFlight,projectilePath} from '../game/projectile-cover.js';

const roof=(x,y=3)=>({id:`roof:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0});
const actor=(id,x,tacticalLevel=0)=>({id,x,y:3,tacticalLevel,hp:100,side:id==='observer'?'player':'enemy',stance:'standing'});
const field=()=>({width:10,height:7,tiles:Array.from({length:70},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),upperSurfaces:[roof(4)],props:[],units:[]});
const closedDoor=s=>Object.assign(s.tiles[34],{type:'door',doorId:'door',open:false,blocked:true,blocksSight:true});

test('the selected door face is visible while generic points and actors stay blocked by the door',()=>{
 const s=field(),door=closedDoor(s),observer=actor('observer',3),behind=actor('behind',5),inside=actor('inside',4),before=structuredClone(s);
 assert.equal(elevationSightClear(s,observer,door),true);
 assert.equal(elevationSightClear(s,observer,{...door}),true,'a public copy of the actual terrain may be selected');
 assert.equal(elevationSightClear(s,observer,{x:4,y:3}),false);
 assert.equal(elevationSightClear(s,observer,inside),false);
 assert.equal(elevationSightClear(s,observer,{...inside,type:'door'}),false,'actor attributes cannot borrow an object exemption');
 assert.equal(elevationSightClear(s,observer,behind),false);
 assert.equal(elevationSightClear(s,observer,{...door,type:'window'}),false);
 assert.equal(elevationSightClear(s,observer,{...door,doorId:'different-door'}),false);
 assert.deepEqual(s,before);
 const inner=Object.assign(s.tiles[35],{type:'door',doorId:'inner-door',open:false,blocked:true,blocksSight:true});
 assert.equal(elevationSightClear(s,observer,inner),false,'selecting a second door does not exempt the first');
});

test('seeing a door face does not change bullet resistance or grant a shot through it',()=>{
 const s=field(),door=closedDoor(s),observer=actor('observer',3),behind=actor('behind',5);s.units=[observer,behind];
 assert.equal(elevationSightClear(s,observer,door),true);
 assert.equal(projectilePath(s,observer,door,{damage:20}).blocked,true);
 const blocked=projectileFlight(s,observer,behind,{damage:20});assert.equal(blocked.blocked,true);assert.equal(blocked.victimId,null);
 Object.assign(door,{open:true,blocked:false,blocksSight:false});
 assert.equal(elevationSightClear(s,observer,behind),true);
 assert.equal(projectileFlight(s,observer,behind,{damage:20}).victimId,'behind');
});

test('a terminal slab still hides a same-column soldier, the roof surface and an object above it',()=>{
 const s=field(),observer=actor('observer',4),above=actor('above',4,1),chest={id:'upper-chest',type:'chest',x:4,y:3,tacticalLevel:1,obstacleHeight:2};s.props=[chest];
 assert.equal(elevationSightClear(s,observer,above),false);
 assert.equal(elevationSightClear(s,observer,s.upperSurfaces[0]),false,'selecting the actual roof does not exempt its slab');
 assert.equal(elevationSightClear(s,observer,chest),false);
 assert.equal(elevationSightClear(s,above,observer),false);
 assert.equal(projectileFlight({...s,units:[observer,above]},observer,above,{damage:10000}).blocked,true);
});

test('only the selected chest can expose its face, including the far side of its footprint',()=>{
 const s=field();s.upperSurfaces=Array.from({length:5},(_,i)=>roof(i+3));
 const observer=actor('observer',7,1),chest={id:'chest',type:'chest',x:4,y:3,tacticalLevel:1,footprint:{width:2,height:1},obstacleHeight:2};s.props=[chest];
 assert.equal(elevationSightClear(s,observer,chest),true);
 assert.equal(elevationSightClear(s,observer,{...chest,x:5}),true,'a clicked footprint cell identifies the same physical object');
 assert.equal(elevationSightClear(s,observer,{x:4,y:3,tacticalLevel:1}),false);
 assert.equal(elevationSightClear(s,observer,{...chest,id:'other'}),false);
 assert.equal(elevationSightClear(s,observer,{...chest,type:'barrels'}),false);
 assert.equal(elevationSightClear(s,observer,{...chest,x:3}),false,'the object ID cannot expose a point behind its footprint');
 assert.equal(elevationSightClear(s,observer,actor('behind',3,1)),false);
 s.props.push({id:'screen',type:'barrels',x:6,y:3,tacticalLevel:1,obstacleHeight:2});
 assert.equal(elevationSightClear(s,observer,chest),false,'a different object still blocks sight to the selected chest');
});
