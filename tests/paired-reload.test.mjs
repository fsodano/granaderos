import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,reloadPlan} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {tacticalInputAction} from '../game/ja2-hud.js';

const second=(patch={})=>({weapon:1806,loaded:0,condition:57,jammed:false,count:1,weight:1.2,instanceId:'left-gun',name:'Recuerdo',...patch});
function field(patch={},sector={}){
 const s=createBattle([{id:'p',name:'Tirador',x:2,y:2,weapon:1805,loaded:0,ammo:8,condition:81,weaponInstanceId:'right-gun',offHand:second(),...patch}],{
  width:24,height:8,seed:45,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',x:22,y:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}],...sector,
 });s.units[1]&&(s.units[1].ap=0);return s;
}
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const reload=s=>{const n=actBattle(s,{type:'reload',unitId:'p'});assert.equal(n.lastError,null,n.lastError);assert.doesNotThrow(()=>restore(n));return n;};
const total=u=>u.loaded+u.offHand.loaded+u.ammo;

test('R loads both held pistols in main-first order and pays both real loading costs',()=>{
 const s=field(),before=structuredClone(s),plan=reloadPlan(s.units[0],s);
 assert.equal(plan.pa,60);assert.deepEqual(plan.hands.map(h=>[h.hand,h.rounds,h.pa]),[['primary',1,32],['offhand',1,28]]);
 const n=reload(s),u=n.units[0];assert.equal(u.ap,40);assert.equal(u.loaded,1);assert.equal(u.offHand.loaded,1);assert.equal(u.ammo,6);assert.equal(u.priming,48);
 assert.equal(u.condition,81);assert.equal(u.weaponInstanceId,'right-gun');assert.deepEqual(u.offHand,{...before.units[0].offHand,loaded:1});
 assert.equal(total(u),8);assert.deepEqual(s,before);assert.equal(n.seed,s.seed);assert.deepEqual(n.smoke,[]);assert.match(n.log.at(-1),/ambas pistolas/);
});

test('an unaffordable second load preserves leftover AP and R can then continue that gun over turns',()=>{
 let s=field({weapon:1808,offHand:second({weapon:1808,weight:1.3})});
 const plan=reloadPlan(s.units[0],s);assert.equal(plan.pa,55);assert.equal(plan.offhandPending,true);assert.equal(plan.hands.length,1);
 s=reload(s);assert.equal(s.units[0].ap,45);assert.equal(s.units[0].loaded,2);assert.equal(s.units[0].offHand.loaded,0);assert.equal(s.units[0].offHand.reloadProgress,undefined);assert.equal(s.units[0].ammo,6);
 s=reload(restore(s));assert.equal(s.units[0].ap,0);assert.equal(s.units[0].offHand.loaded,1);assert.ok(s.units[0].offHand.reloadProgress>0);assert.equal(s.units[0].ammo,5);
 const pending=reloadPlan(s.units[0],s);assert.equal(pending.totalPA,10);s.units[0].ap=10;s=reload(restore(s));
 assert.equal(s.units[0].ap,0);assert.equal(s.units[0].offHand.loaded,2);assert.equal(s.units[0].offHand.reloadProgress,undefined);assert.equal(s.units[0].ammo,4);assert.equal(total(s.units[0]),8);
});

test('the second gun joins exactly at the affordable boundary without using carried AP early',()=>{
 for(const ap of [59,60]){
  const s=field();s.units[0].ap=ap;const n=reload(s),u=n.units[0];
  assert.equal(u.loaded,1);assert.equal(u.offHand.loaded,ap===60?1:0);assert.equal(u.ap,ap===60?0:27);assert.equal(u.ammo,ap===60?6:7);
 }
});

test('finite cartridges are allocated to the first gun before either second barrel',()=>{
 for(const ammo of [1,2,3,4]){
  const s=field({weapon:1808,ammo,offHand:second({weapon:1808,weight:1.3})},{exploration:true,enemies:[]});s.units[0].ap=0;
  const n=reload(s),u=n.units[0];assert.equal(u.loaded,Math.min(2,ammo));assert.equal(u.offHand.loaded,Math.max(0,ammo-2));assert.equal(u.ammo,0);assert.equal(u.ap,0);assert.equal(total(u),ammo);
  assert.equal(u.reloadProgress,undefined);assert.equal(u.offHand.reloadProgress,undefined);
 }
});

test('each gun retains its own unfinished loading and the primary cannot overwrite the second',()=>{
 const s=field({reloadProgress:.5,offHand:second({weapon:1808,loaded:1,reloadProgress:.5,weight:1.3})});s.units[0].ap=30;
 const n=reload(s),u=n.units[0];assert.equal(u.ap,0);assert.equal(u.loaded,1);assert.equal(u.offHand.loaded,2);assert.equal(u.ammo,6);assert.equal(u.reloadProgress,undefined);assert.equal(u.offHand.reloadProgress,undefined);
 const partial=field({offHand:second({reloadProgress:.25})});partial.units[0].ap=18;const first=reload(partial);
 assert.equal(first.units[0].reloadProgress,18/32);assert.deepEqual(first.units[0].offHand,partial.units[0].offHand);assert.equal(first.units[0].ammo,8);
});

test('a full main gun permits partial second-hand loading with exact reserve and saved work',()=>{
 let s=field({loaded:1,ammo:1,offHand:second({weapon:1808,weight:1.3})});s.units[0].ap=10;s=reload(s);
 assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].offHand.loaded,0);assert.equal(s.units[0].ammo,1);assert.equal(s.units[0].offHand.reloadProgress,10/27.5);assert.equal(s.units[0].reloadProgress,undefined);
 s=restore(s);s.units[0].ap=18;s=reload(s);assert.equal(s.units[0].offHand.loaded,1);assert.equal(s.units[0].ammo,0);assert.equal(s.units[0].offHand.reloadProgress,undefined);
 assert.equal(s.units[0].condition,81);assert.equal(s.units[0].offHand.condition,57);
});

test('pocketed, failed, broken and nonpistol second weapons never consume reload supplies',()=>{
 for(const patch of [{leftHandItem:null},{weapon:1800},{offHand:second({jammed:true})},{offHand:second({condition:0})},{offHand:second({weapon:1813,weight:1})}]){
  const s=field(patch),old=structuredClone(s.units[0].offHand),n=reload(s);assert.deepEqual(n.units[0].offHand,old);assert.equal(n.units[0].ammo,7);assert.equal(n.units[0].loaded,1);
 }
});

test('zero AP, blocked actors, absent ammunition and failed primary reject the whole reload',()=>{
 for(const patch of [{ap:0},{ammo:0},{jammed:true},{activeSlot:'blade',blade:1813},{knockedDown:true},{energy:0,unconscious:true}]){
  const s=field();Object.assign(s.units[0],patch);const n=actBattle(s,{type:'reload',unitId:'p'});assert.ok(n.lastError);
  assert.deepEqual({...n,log:[],lastError:null},{...s,log:[],lastError:null});
 }
});

test('empty-fire input loads both guns without firing and exploration charges only elapsed time',()=>{
 const s=field({weapon:1808,offHand:second({weapon:1808,weight:1.3})},{exploration:true,enemies:[]});s.units[0].ap=7;
 const order=tacticalInputAction(s,s.units[0],{type:'firePoint',unitId:'p',x:10,y:2,aim:4});assert.equal(order.type,'reload');
 const n=actBattle(s,order);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,7);assert.equal(n.units[0].loaded,2);assert.equal(n.units[0].offHand.loaded,2);assert.equal(n.units[0].ammo,4);
 assert.equal(n.elapsedSeconds-s.elapsedSeconds,7);assert.deepEqual(n.smoke,[]);assert.equal(n.seed,s.seed);assert.doesNotMatch(n.log.at(-1),/\d+ PA/);assert.deepEqual(actBattle(restore(s),order),n);
});

test('prone stance and the gunsmith trait affect each pistol loading rate',()=>{
 const s=field({stance:'prone',movementMode:'prone',traits:['gunsmith_artillerist']});
 const plan=reloadPlan(s.units[0],s);assert.deepEqual(plan.hands.map(h=>h.pa),[41,36]);const n=reload(s);assert.equal(n.units[0].ap,23);assert.equal(n.units[0].ammo,6);
});

test('a genuine enemy reload interrupt saves both loads and never repeats paid work',()=>{
 const s=field({x:5,y:2,facing:0,agility:100},{enemies:[{id:'e',x:5,y:5,facing:0,weapon:1805,loaded:0,ammo:4,offHand:second({instanceId:'enemy-left'}),patrol:false}]});s.units[1].ap=60;
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const enemy=paused.units[1];
 assert.equal(enemy.ap,0);assert.equal(enemy.loaded,1);assert.equal(enemy.offHand.loaded,1);assert.equal(enemy.ammo,2);
 const restored=restore(paused);assert.deepEqual(endTurn(restored),endTurn(paused));assert.equal(endTurn(restored).units[1].ammo,2);
});
