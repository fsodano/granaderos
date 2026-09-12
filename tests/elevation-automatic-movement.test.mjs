import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,stanceCost,environmentUsePreview,lookPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {geometryCells} from '../game/sight-geometry.js';
const tiles=()=>Array.from({length:400},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
const roof=(x=4)=>Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:x+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
const access=x=>({id:'access',kind:'climb',from:{x:x-1,y:4,tacticalLevel:0},to:{x,y:4,tacticalLevel:1}});
const field=(players,extra={})=>createBattle(players,{width:40,height:10,tiles:tiles(),upperSurfaces:roof(),climbLinks:[access(4)],seed:45,exploration:true,enemies:[],...extra});

test('ambient patrols climb to their authored roof post without AP or route metadata on the actor',()=>{
 const b=field([{id:'p',x:0,y:0}],{upperSurfaces:roof(24),climbLinks:[access(24)],enemies:[{id:'a',x:23,y:4,patrolOrigin:{x:24,y:4,tacticalLevel:1},overwatch:false}]}),before=structuredClone(b),n=actBattle(b,{type:'ambient'}),u=n.units[1];
 assert.equal(n.lastError,null);assert.equal(n.mode,'exploration');assert.deepEqual([u.x,u.y,u.tacticalLevel],[24,4,1]);assert.equal(u.energy,88);assert.equal(u.ap,b.units[1].ap);assert.equal(n.elapsedSeconds,6);
 for(const key of ['kind','linkId','from','cost','path'])assert.equal(u[key],undefined,key);
 assert.deepEqual(b,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('ambient roof scouts pay the roof walking energy and keep downstairs occupancy independent',()=>{
 const b=field([{id:'m',militia:true,x:4,y:4,tacticalLevel:1},{id:'p',x:5,y:4}],{upperSurfaces:Array.from({length:51},(_,i)=>({id:`wide:${i}`,x:4+i%17,y:4+Math.floor(i/17),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}))});
 for(const t of b.tiles) t.type='mud';
 const n=actBattle(b,{type:'ambient'}),u=n.units[0];assert.equal(u.tacticalLevel,1);assert.notDeepEqual([u.x,u.y],[4,4]);assert.equal(u.energy,99);assert.equal(u.ap,b.units[0].ap);assert.deepEqual(n.units[1],b.units[1]);assert.equal(u.kind,undefined);
});

test('a routed crouching soldier stands, descends and reaches only the ground exit',()=>{
 const b=field([{id:'router',x:4,y:4,tacticalLevel:1,routed:true,weaponDropped:true,loaded:0,stance:'crouched',movementMode:'crouch'},{id:'p',x:20,y:8}],{exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'S',entryAnchor:{x:14,y:15}}]}),n=endTurn(b),u=n.units[0];
 assert.equal(u.stance,'standing');assert.equal(u.tacticalLevel,0);assert.equal(u.departure?.edge,'W');assert.equal(u.ap,b.units[0].ap);assert.equal(u.energy,88);
 assert.ok(u.fleePath.some(p=>p.kind==='climb'&&p.tacticalLevel===0));assert.equal(n.elapsedSeconds,Math.max(1,Math.ceil(stanceCost(b.units[0],'standing')*.06))+4+12);assert.equal(u.weaponDropped,true);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('a roof touching the map edge cannot become a ground exit without a descent',()=>{
 const b=field([{id:'router',x:0,y:4,tacticalLevel:1,routed:true,weaponDropped:true,loaded:0},{id:'p',x:20,y:8}],{upperSurfaces:roof(0),climbLinks:[],exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'S',entryAnchor:{x:14,y:15}}]}),n=endTurn(b),u=n.units[0];
 assert.equal(u.surrendered,true);assert.equal(u.departure,undefined);assert.equal(u.tacticalLevel,1);
});

test('a tall selected chest exposes its own face to the equipped-object approach',()=>{
 const b=field([{id:'p',x:5,y:4,tacticalLevel:1}],{props:[{id:'tall-chest',type:'chest',x:6,y:4,tacticalLevel:1,obstacleHeight:2,blocksMovement:true,open:false,locked:false,contents:[]}]}),preview=environmentUsePreview(b,b.units[0],{kind:'container',id:'tall-chest'},'open');
 assert.equal(preview.valid,true);const n=actBattle(b,{type:'environment',unitId:'p',kind:'container',id:'tall-chest',verb:'open'});assert.equal(n.lastError,null);assert.equal(n.props[0].open,true);
 assert.equal(lookPreview(b,b.units[0],{x:9,y:4,tacticalLevel:1}).valid,false,'look does not target a nonexistent upper surface');
});

test('height geometry rejects unsafe or unbounded rays and keeps vertical rays finite',()=>{
 for(const b of [{x:Infinity,y:0},{x:Number.MAX_SAFE_INTEGER+1,y:0},{x:9000,y:0}])assert.throws(()=>geometryCells({x:0,y:0},b),RangeError);
 assert.equal(geometryCells({x:4,y:4,tacticalLevel:0},{x:4,y:4,tacticalLevel:1}).length,1);
});
