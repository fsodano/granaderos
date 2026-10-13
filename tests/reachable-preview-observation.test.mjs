import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,teamCanSee} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
import {movementStep} from '../game/movement-step.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';

// Declared movement arenas only. No campaign, earned state or outcome.
function arena({kind='npc',level=0,observer=false,stationary=false}={}){
 const width=16,height=10,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const upperSurfaces=level?tiles.map(p=>({...p,id:`roof-${p.x}-${p.y}`,type:'floor',kind:'roof',tacticalLevel:1,elevation:3})):[];
 const squad=[{id:'p',x:1,y:2,facing:6,tacticalLevel:level},...(observer?[{id:'q',x:9,y:2,facing:6,tacticalLevel:level}]:[])];
 const body={id:'other',x:6,y:2,tacticalLevel:level};
 return createBattle(squad,{width,height,tiles,upperSurfaces,seed:45,exploration:true,deferContact:true,
  npcs:kind==='npc'?[{...body,name:'Vecino',...(stationary?{mission:'declared-meeting'}:{})}]:[],
  enemies:kind==='enemy'?[{...body,hp:80,maxHp:80,weapon:1800,loaded:0,ammo:0,patrol:false,overwatch:false}]:[]});
}
const body=b=>b.npcs[0]??b.units.find(u=>u.side==='enemy');
const actor=b=>b.units.find(u=>u.id==='p');
const preview=(battle,options={})=>runBattleJob({battle,kind:'reachable-preview',action:{unitId:'p',...options}});
const withoutOther=b=>{const copy=structuredClone(b);copy.npcs=[];copy.units=copy.units.filter(u=>u.side==='player');return copy;};

for(const kind of ['npc','enemy'])for(const level of [0,1])test(`a hidden ${kind} on level ${level} cannot disclose its cell through the worker route preview`,()=>{
 const b=arena({kind,level}),before=structuredClone(b),other=body(b),clear=withoutOther(b);
 assert.equal(canSee(b,actor(b),other),false);assert.equal(teamCanSee(b,'player',other),false);
 for(const options of [{},{previewBudget:true,movementIntent:'preserveFacing'}]){
  const rows=preview(b,options);assert.deepEqual(rows,preview(clear,options));
  assert.ok(rows.some(point=>sameCell(point,other)),'the public preview must not reveal the hidden physical blocker');
 }
 assert.deepEqual(b,before);
});

test('a civilian seen by a teammate blocks the public route even outside the selected soldier sight cone',()=>{
 const b=arena({observer:true}),before=structuredClone(b),other=body(b);
 assert.equal(canSee(b,actor(b),other),false);assert.equal(teamCanSee(b,'player',other),true);
 const rows=preview(b);assert.equal(rows.some(point=>sameCell(point,other)),false);
 for(const row of rows)for(const point of row.path)assert.equal(sameCell(point,other),false);
 assert.ok(preview(withoutOther(b)).some(point=>sameCell(point,other)));assert.deepEqual(b,before);
});

test('an own soldier remains a known blocker beyond the selected soldier sight',()=>{
 const b=arena({observer:true}),before=structuredClone(b),other=b.units.find(u=>u.id==='q');
 assert.equal(canSee(b,actor(b),other),false);
 assert.equal(preview(b).some(point=>sameCell(point,other)),false);assert.deepEqual(b,before);
});

test('a public route through an unseen civilian never authorizes physical overlap during direct or continued execution',()=>{
 // The ordinary meeting-speaker rule keeps this declared civilian in place.
 const b=arena({stationary:true}),before=structuredClone(b),request={type:'move',unitId:'p',x:12,y:2},other=body(b);
 const path=preview(b).find(point=>sameCell(point,request));assert.ok(path.path.some(point=>sameCell(point,other)));
 const direct=actBattle(b,request);assert.equal(direct.lastError,null);assert.deepEqual(spacePoint(actor(direct)),{x:5,y:2,tacticalLevel:0});
 let result=movementStep(b,request),steps=0;
 while(result.status==='moving'&&steps++<16)result=movementStep(result.state,request,result.continuation);
 assert.equal(result.status,'stopped');assert.deepEqual(spacePoint(actor(result.state)),spacePoint(actor(direct)));
 for(const state of [direct,result.state]){
  assert.equal(sameCell(actor(state),body(state)),false);assert.deepEqual(spacePoint(body(state)),spacePoint(other));
  assert.ok(state.elapsedSeconds>b.elapsedSeconds);assert.ok(actor(state).energy<actor(b).energy);
  for(const key of ['hp','loaded','ammo','inventory'])assert.deepEqual(actor(state)[key],actor(b)[key]);
  assert.equal(state.seed,b.seed);
 }
 assert.deepEqual(b,before);
});

test('an unknown selected actor has an empty public route',()=>{
 const b=arena(),before=structuredClone(b);
 assert.deepEqual(runBattleJob({battle:b,kind:'reachable-preview',action:{unitId:'missing'}}),[]);assert.deepEqual(b,before);
});
