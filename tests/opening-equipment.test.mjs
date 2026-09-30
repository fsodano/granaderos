import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {handRecord} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {equipOpeningRifles} from './opening-equipment.mjs';

const supplies={ammo:0,priming:0,flints:0,rations:0,medkits:0,torches:0,boleadoras:0};
const field=(players,enemies=[])=>createBattle(players.map(unit=>({...supplies,...unit})),{width:16,height:10,exploration:true,hour:12,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),enemies:enemies.map(unit=>({...supplies,...unit}))});

test('a surviving original rifle squad keeps its guns without requiring casualties',()=>{
 const state=field([{id:1000,x:2,y:3,weapon:1802},{id:114,x:3,y:3,weapon:1800,weaponInstanceId:'living-rifle'},{id:123,x:4,y:3,weapon:1801}]);
 const before=structuredClone(state),result=equipOpeningRifles(state,[1000,114,123]);
 assert.deepEqual(result.battle,before);assert.deepEqual(state,before);assert.deepEqual(result.transfers,[]);assert.deepEqual(result.unfilled,[]);
});

test('an original short-gun survivor can equip an actual enemy rifle while the friendly rifleman lives',()=>{
 const state=field([{id:1000,x:2,y:3,weapon:1803,loaded:1,condition:63,weaponInstanceId:'replacement-carbine'},{id:114,x:2,y:4,weapon:1800,weaponInstanceId:'living-rifle'}],[{id:'enemy-body',x:6,y:3,hp:0,weapon:1801,loaded:1,ammo:7,condition:57,weaponInstanceId:'captured-rifle'}]);
 const before=structuredClone(state),incoming=handRecord(state.units.find(u=>u.id==='enemy-body'),'primary'),outgoing=handRecord(state.units[0],'primary');
 const result=equipOpeningRifles(state,[1000]),receiver=result.battle.units.find(u=>u.id==='1000');
 assert.deepEqual(state,before);assert.equal(result.transfers.length,1);assert.equal(result.transfers[0].sourceSide,'enemy');
 assert.deepEqual(handRecord(receiver,'primary'),incoming);assert.ok(Object.values(receiver.inventory).some(item=>item.instanceId===outgoing.instanceId&&item.loaded===outgoing.loaded&&item.condition===outgoing.condition));
 assert.equal(result.battle.units.find(u=>u.id==='114').weaponInstanceId,'living-rifle');
 assert.deepEqual(result.battle.units.map(u=>u.hp),state.units.map(u=>u.hp));
 assert.ok(result.battle.elapsedSeconds>state.elapsedSeconds);assert.equal(receiver.ap,state.units[0].ap);
 assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
 const repeated=equipOpeningRifles(result.battle,[1000]);assert.deepEqual(repeated.battle,result.battle);assert.deepEqual(repeated.transfers,[]);
});

test('actual friendly remains still supply one replacement without duplicating the recovered rifle',()=>{
 const state=field([{id:137,x:2,y:3,weapon:1803},{id:114,x:3,y:3,hp:0,weapon:1800,weaponInstanceId:'fallen-rifle'}]);
 const result=equipOpeningRifles(state,[137,137]);
 assert.equal(result.transfers.length,1);assert.equal(result.transfers[0].sourceId,'114');
 assert.equal(result.battle.units.find(u=>u.id==='114').weaponDropped,true);
 assert.equal(result.battle.units.find(u=>u.id==='137').weaponInstanceId,'fallen-rifle');
 assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
});

test('a missing source never strips a living owner or invents a replacement rifle',()=>{
 const state=field([{id:131,x:2,y:3,weapon:1803},{id:114,x:3,y:3,weapon:1800,weaponInstanceId:'living-rifle'}]),before=structuredClone(state);
 const result=equipOpeningRifles(state,[131]);
 assert.deepEqual(result.battle,before);assert.deepEqual(state,before);assert.deepEqual(result.transfers,[]);assert.deepEqual(result.unfilled,['131']);
});
