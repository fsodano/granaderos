import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,teamCanSee,artilleryCosts} from '../game/tactical.js';
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';

function field({spotter=true}={}){
 const crew=[{id:'gunner',x:2,y:5,facing:2},{id:'helper',x:3,y:4,facing:2}];
 if(spotter)crew.push({id:'spotter',x:22,y:3,facing:2});
 return createBattle(crew,{width:40,height:10,hour:12,seed:45,
  tiles:Array.from({length:400},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass'})),
  enemies:[{id:'target',x:30,y:5,facing:6,patrol:false,overwatch:false}],
  artillery:[{id:'gun',side:'player',type:'bronze4',x:3,y:5,facing:0,loaded:true,ammo:1}],
 });
}
const targets=b=>b.units.filter(v=>v.side==='enemy'&&teamCanSee(b,'player',v));
const plan=b=>teamArtilleryOrder(b,b.units.find(u=>u.id==='gunner'),targets(b));

test('a player battery fires at a current teammate sighting with real crew costs and a finite load',()=>{
 const b=field(),before=structuredClone(b),gunner=b.units.find(u=>u.id==='gunner'),target=b.units.find(u=>u.id==='target');
 assert.equal(canSee(b,gunner,target),false);
 assert.equal(teamCanSee(b,'player',target),true);
 assert.equal(chooseArtilleryAction(b,gunner,targets(b)),null,'enemy autonomy still requires personal sight');
 const action=plan(b);assert.equal(action?.type,'artillery');assert.equal(action.x,target.x);assert.equal(action.y,target.y);
 assert.deepEqual(b,before,'planning cannot change the battle');
 const next=actBattle(b,action);assert.equal(next.lastError,null);
 assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,b.artillery[0].ammo);
 assert.ok(next.units.find(u=>u.id===target.id).hp<target.hp);
 const cost=artilleryCosts(b,gunner,b.artillery[0]).fire;
 for(const id of ['gunner','helper'])assert.equal(next.units.find(u=>u.id===id).ap,b.units.find(u=>u.id===id).ap-cost);
 assert.deepEqual(actBattle(structuredClone(b),action),next,'saved input reproduces the same result');
});

test('a player battery cannot target an unseen actor or borrow missing crew action points',()=>{
 const hidden=field({spotter:false});assert.deepEqual(targets(hidden),[]);assert.equal(plan(hidden),null);
 const short=field();short.units.find(u=>u.id==='helper').ap=0;assert.equal(plan(short),null);
 const empty=field();empty.artillery[0].loaded=false;empty.artillery[0].ammo=0;assert.equal(plan(empty),null);
});

test('the shared sighting includes friendly and civilian bodies along the shot',()=>{
 const friendly=field();friendly.units.find(u=>u.id==='spotter').x=24;friendly.units.find(u=>u.id==='spotter').y=5;
 assert.equal(plan(friendly),null);
 const civilian=field();civilian.npcs=[{id:'resident',name:'Vecino',x:25,y:5,hp:100}];
 assert.equal(canSee(civilian,civilian.units[0],civilian.npcs[0]),false);
 assert.equal(teamCanSee(civilian,'player',civilian.npcs[0]),true);
 assert.equal(plan(civilian),null);
});
