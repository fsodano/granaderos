import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {advanceNpc,hearNpcNoise,runCivilianPhase} from '../game/npc-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=()=>createBattle([{id:'p',x:8,y:3}],{width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],exploration:true,npcs:[{id:'escort',name:'Enlace',x:2,y:3,escort:{leaderId:'p',waiting:false}}]});
const at=n=>[n.x,n.y];
test('escort follows with finite civilian movement and stops beside its leader',()=>{
 const s=field(),n=s.npcs[0],before=structuredClone(s.units);
 advanceNpc(s,n,16);assert.equal(n.lastMovePath.length,2);assert.deepEqual(at(n),[4,3]);assert.equal(n.ai.activity,'following');
 for(let i=0;i<4;i++)advanceNpc(s,n);assert.deepEqual(at(n),[7,3]);assert.equal(n.ai.activity,'waiting');assert.deepEqual(s.units,before);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('escort waits for an absent, dead, unconscious, departed or routed leader and honors a wait order',()=>{
 for(const patch of [{id:'other'},{hp:0},{unconscious:true},{departure:{}},{routed:true},{energy:0}]){
  const s=field();Object.assign(s.units[0],patch);advanceNpc(s,s.npcs[0]);assert.deepEqual(at(s.npcs[0]),[2,3]);assert.equal(s.npcs[0].ai.activity,'waiting');
 }
 const s=field();s.npcs[0].escort.waiting=true;advanceNpc(s,s.npcs[0]);assert.deepEqual(at(s.npcs[0]),[2,3]);
});
test('locked routes block escorts; opening the route permits paid door passage without overlap',()=>{
 const s=field();for(const tile of s.tiles.filter(t=>t.x===5))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});
 const door=s.tiles.find(t=>t.x===5&&t.y===3);Object.assign(door,{type:'door',open:false,locked:true});
 advanceNpc(s,s.npcs[0]);assert.deepEqual(at(s.npcs[0]),[2,3]);door.locked=false;
 advanceNpc(s,s.npcs[0],24);assert.deepEqual(at(s.npcs[0]),[4,3]);assert.equal(door.open,true);
 advanceNpc(s,s.npcs[0],24);assert.deepEqual(at(s.npcs[0]),[7,3]);assert.notDeepEqual(at(s.npcs[0]),at(s.units[0]));
});
test('danger takes precedence over escort waiting and following, then the saved order resumes',()=>{
 const s=field(),n=s.npcs[0];hearNpcNoise(s,{x:1,y:3},'fire',10);advanceNpc(s,n);assert.ok(['hiding','fleeing'].includes(n.ai.activity));assert.equal(n.escort.leaderId,'p');
 s.elapsedSeconds=60;advanceNpc(s,n);assert.ok(['following','waiting'].includes(n.ai.activity));
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));runCivilianPhase(s);runCivilianPhase(restored);assert.deepEqual(restored.npcs,s.npcs);
});
test('malformed escort directives cannot enter a saved tactical state',()=>{
 for(const escort of [{leaderId:'p'},{leaderId:'',waiting:false},{leaderId:'p',waiting:0},{leaderId:'p',waiting:false,teleport:true}]){
  const s=field();s.npcs[0].escort=escort;assert.throws(()=>validateBattleSnapshot(s));
 }
});

test('restrained and knocked-down escorts cannot be pulled along by a leader',()=>{
 for(const condition of ['entangled','knockedDown']){const s=field(),n=s.npcs[0];n[condition]=true;n.stance='prone';advanceNpc(s,n);assert.deepEqual(at(n),[2,3]);assert.equal(n.stance,'prone');assert.deepEqual(n.lastMovePath,[]);}
});
