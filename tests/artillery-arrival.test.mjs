import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const anchors={N:{x:10,y:0},E:{x:19,y:8},S:{x:10,y:15},W:{x:0,y:8}};
for(const edge of Object.keys(anchors))test(`new artillery arrives with its crew on the ${edge} boundary`,()=>{
 const request={id:`guns-${edge}`,sector:'uspallata',hour:12,seed:127,exploration:true,enemies:[],squad:[{id:7,weapon:1801,entryReason:'arrival',entryEdge:edge,entryAnchor:anchors[edge]}],artillery:[{id:'new-1',type:'bronze4',side:'player',loaded:true,ammo:3},{id:'new-2',type:'bronze4',side:'player',loaded:false,ammo:2},{id:'resident',type:'bronze4',side:'player',loaded:false,ammo:1,x:7,y:7,stationed:true}]};
 const terrain=createBattle([],{width:24,height:16,tiles:Array.from({length:384},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[]});
 const b=enterSector(request,terrain),crew=b.units.find(u=>u.id==='7');
 for(const gun of b.artillery.filter(g=>!g.stationed)){assert.ok(edge==='N'?gun.y<=2:edge==='S'?gun.y>=b.height-3:edge==='E'?gun.x>=b.width-3:gun.x<=2);assert.ok(Math.hypot(gun.x-crew.x,gun.y-crew.y)<=3);assert.notDeepEqual({x:gun.x,y:gun.y},{x:crew.x,y:crew.y});}
 assert.notDeepEqual({x:b.artillery[0].x,y:b.artillery[0].y},{x:b.artillery[1].x,y:b.artillery[1].y});
 assert.deepEqual(b.artillery.map(g=>[g.id,g.loaded,g.ammo]),[['new-1',true,3],['new-2',false,2],['resident',false,1]]);
 assert.deepEqual(b.artillery.find(g=>g.id==='resident'),request.artillery[2]);
 assert.equal(b.elapsedSeconds,0);assert.deepEqual(validateBattleSnapshot(structuredClone(b)).artillery,b.artillery);
});

test('a full squad and three guns fit the narrow eastern mountain approach',()=>{
 const squad=Array.from({length:6},(_,i)=>({id:i+1,weapon:1800,entryReason:'arrival',entryEdge:'E',entryAnchor:anchors.E}));
 const artillery=Array.from({length:3},(_,i)=>({id:`piece-${i}`,type:'bronze4',side:'player',loaded:true,ammo:6}));
 const b=enterSector({id:'narrow-entry',sector:'uspallata',hour:12,seed:3401709397,squad,artillery,enemies:[]},null,{placement:true});
 const objects=[...b.units.filter(u=>u.side==='player'),...b.artillery];
 assert.equal(new Set(objects.map(u=>`${u.x},${u.y}`)).size,9);
 for(const gun of b.artillery)assert.ok(gun.x>=b.width-3);
 assert.deepEqual(validateBattleSnapshot(structuredClone(b)).artillery,b.artillery);
});
