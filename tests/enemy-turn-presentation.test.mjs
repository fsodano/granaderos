import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedEndTurn,teamCanSee} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {OPERATIVES} from '../game/campaign.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
const map={width:28,height:8,tiles:Array.from({length:224},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',blocked:false,cover:0})),seed:45};

test('the actual San Lorenzo enemy turn records visible steps and attacks before their consequences without changing its result',()=>{
 const s=enterSector({hour:8,squad:OPERATIVES.filter(x=>[3,4,7,10].includes(x.id)).map(x=>({...x,horse:true})),id:'san_lorenzo',biome:'river',seed:18130203,enemyCount:4}),before=structuredClone(s),r=presentedEndTurn(s);
 assert.deepEqual(r.state,endTurn(s));assert.deepEqual(s,before);assert.ok(r.frames.length>1);assert.ok(r.frames.some(f=>f.type==='prepare'&&f.action==='fire'));
 let previous=s;
 for(const f of r.frames){
  for(const id of f.visibleIds){const u=f.state.units.find(u=>u.id===id);assert.ok(u.side==='player'||teamCanSee(f.state,'player',u));}
  if(f.type==='step'){const a=previous.units.find(u=>u.id===f.unitId),b=f.state.units.find(u=>u.id===f.unitId);assert.ok(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=1);}
  previous=f.state;
 }
 assert.strictEqual(r.frames[0].state.tiles,r.frames[1].state.tiles,'unchanged map data is shared');

});
test('unseen movement has no presentation frames and unknown shooters are not exposed by a visible injury',()=>{
 const s=createBattle([{id:'p',x:1,y:1,facing:6}],{...map,enemies:[{id:'e',x:25,y:5,patrol:false}]});
 const r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.equal(r.frames.length,0);
 const r2=captureBattlePresentation(s,()=>{const n=structuredClone(s);n.units[1].x--;recordBattleFrame(n,{type:'step',unitId:'e'});n.units[0].hp-=5;recordBattleFrame(n,{type:'result',unitId:'e',action:'fire'});return n;},(s,u)=>teamCanSee(s,'player',u));assert.equal(r2.frames.length,1);assert.equal(r2.frames[0].unitId,null);assert.ok(!r2.frames[0].visibleIds.includes('e'));assert.equal(r2.frames[0].state.units[0].hp,s.units[0].hp-5);
});
test('presentation snapshots preserve old terrain and earlier injuries and do not survive as save fields',()=>{
 const s=createBattle([{id:'p',x:1,y:1}],{...map,enemies:[{id:'e',x:7,y:1}]});
 const r=captureBattlePresentation(s,()=>{const n=structuredClone(s);recordBattleFrame(n,{type:'prepare',unitId:'p',action:'fire'});n.tiles[0].blocked=true;n.units[0].hp-=5;recordBattleFrame(n,{type:'result',unitId:'p',action:'fire'});return n;},()=>true);
 assert.equal(r.frames[0].state.tiles[0].blocked,false);assert.equal(r.frames[1].state.tiles[0].blocked,true);assert.equal(r.frames[0].state.units[0].hp,s.units[0].hp);assert.equal(r.frames[1].state.units[0].hp,s.units[0].hp-5);assert.equal(r.state.frames,undefined);assert.equal(r.state.presentationVisibleIds,undefined);
});

test('a successful shot is shown before its injury, with the original result unchanged',()=>{
 const s=createBattle([{id:'p',x:1,y:1,weapon:1801}],{...map,enemies:[{id:'e',x:7,y:1,weapon:1801,marksmanship:70,morale:100}]});const r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));
 const hit=r.frames.findIndex((f,i)=>i>0&&f.type==='impact'&&f.action==='fire'&&f.state.units.some((u,j)=>u.hp<r.frames[i-1].state.units[j].hp));assert.ok(hit>1);assert.equal(r.frames[hit-1].type,'projectile');assert.equal(r.frames[hit-1].action,'fire');assert.equal(r.frames[hit-2].type,'prepare');assert.ok(r.frames[hit-1].shotVisual);
});


test('visible movement pauses at the real interrupt and resumes without repeating time or enemy AP',()=>{
 const source=createBattle([{id:'p',x:1,y:1,marksmanship:100}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:7,y:1,weapon:1809}]});
 source.units[0].ap=20;source.units[1].ap=24;
 const paused=presentedEndTurn(source);assert.deepEqual(paused.state,endTurn(source));assert.equal(paused.state.phase,'interrupt');
 const steps=paused.frames.filter(frame=>frame.type==='step');assert.equal(steps.length,1);assert.equal(steps[0].state.units[1].x,6);
 assert.equal(paused.state.units[1].ap,16);assert.equal(paused.state.elapsedSeconds,6);
 for(const shoot of [false,true]){
  const next=shoot?actBattle(paused.state,{type:'useItem',unitId:'p',targetId:'e'}):paused.state;
  const resumed=presentedEndTurn(structuredClone(next));assert.deepEqual(resumed.state,endTurn(next));
  assert.equal(resumed.state.phase,'player');assert.equal(resumed.state.elapsedSeconds,6);
  assert.ok(resumed.state.units[1].ap<=16);assert.equal(resumed.state.enemyTurn,undefined);
 }
});
