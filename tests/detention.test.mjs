import test from 'node:test';import assert from 'node:assert/strict';
import {detentionManifest,placeDetainedPrisoners,validateDetainedPrisoner} from '../game/detention.js';
import {createBattle} from '../game/tactical.js';
import {advanceNpc} from '../game/npc-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const roster=[{id:112,name:'Médico',maxHp:64},{id:122,name:'Cirujano',maxHp:65}];
const captive=(extra={})=>({captured:true,alive:true,capturedSector:'tucuman',capturedAt:18,hp:11,maxHp:64,energy:30,bleeding:2,bandaged:40,inventory:{weapon:{weapon:1801,count:1}},medkits:8,...extra});
const campaign=()=>({operativeState:{112:captive(),122:captive({capturedSector:'cordoba'})}});
function field(){return createBattle([{id:'p',x:1,y:1}],{width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0,...(i%12>=7&&Math.floor(i/12)>=3?{roomId:'guardroom'}:{})})),enemies:[{id:'guard',x:8,y:4}],npcs:[]});}
test('detention manifest preserves exact local identities and wounds without copying confiscated equipment',()=>{
 const s=campaign(),before=structuredClone(s),m=detentionManifest(s,roster,'tucuman');assert.equal(m.length,1);assert.equal(m[0].id,'captive:112:18');assert.equal(m[0].hp,11);assert.equal(m[0].maxHp,64);assert.equal(m[0].energy,30);assert.equal(m[0].bleeding,2);assert.equal(m[0].bandaged,40);assert.equal(m[0].unconscious,true);assert.equal(m[0].inventory,undefined);assert.equal(m[0].medkits,undefined);assert.deepEqual(s,before);
 m[0].hp=1;assert.equal(s.operativeState[112].hp,11);s.operativeState[112].alive=false;assert.deepEqual(detentionManifest(s,roster,'tucuman'),[]);
});
test('detention placement uses distinct walkable room tiles, preserves the source and survives tactical validation',()=>{
 const s=campaign();s.operativeState[122]=captive({maxHp:65,hp:50,bleeding:0,bandaged:15});const b=field(),before=structuredClone(b),next=placeDetainedPrisoners(b,detentionManifest(s,roster,'tucuman'));
 assert.deepEqual(b,before);assert.equal(next.npcs.length,2);assert.notDeepEqual([next.npcs[0].x,next.npcs[0].y],[next.npcs[1].x,next.npcs[1].y]);
 for(const n of next.npcs){assert.ok(next.tiles.find(t=>t.x===n.x&&t.y===n.y).roomId);assert.ok(!next.units.some(u=>u.x===n.x&&u.y===n.y));}
 assert.doesNotThrow(()=>validateBattleSnapshot(next));const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(next)));assert.deepEqual(restored.npcs,next.npcs);
});
test('detained conscious soldiers cannot roam or follow a forged escort order before being freed',()=>{
 const s=campaign();s.operativeState[112]=captive({hp:60,bleeding:0,bandaged:4});const b=placeDetainedPrisoners(field(),detentionManifest(s,roster,'tucuman')),n=b.npcs[0],at=[n.x,n.y];n.escort={leaderId:'p',waiting:false};for(let i=0;i<8;i++)advanceNpc(b,n);assert.deepEqual([n.x,n.y],at);assert.deepEqual(n.lastMovePath,[]);
});
test('duplicate prisoners, forged identity and duplicated custody equipment are rejected',()=>{
 const m=detentionManifest(campaign(),roster,'tucuman');assert.throws(()=>placeDetainedPrisoners(field(),[m[0],m[0]]));
 for(const patch of [{id:'captive:122:18'},{weapon:1801},{inventory:{}},{medkits:1},{detention:{...m[0].detention,freed:'yes'}},{detention:{...m[0].detention,sector:'invented'}}])assert.throws(()=>validateDetainedPrisoner({...m[0],...patch}));
});
