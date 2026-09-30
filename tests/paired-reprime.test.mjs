import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,reprimePlan,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';

const second=patch=>({weapon:1806,loaded:1,condition:67,jammed:true,count:1,weight:1.2,instanceId:'left-reprime',name:'Pistola familiar',...patch});
function field(patch={},options={}){
 const s=createBattle([{id:'p',x:2,y:2,weapon:1805,weaponInstanceId:'right-reprime',loaded:1,ammo:4,jammed:true,priming:5,offHand:second(),...patch}],{
  width:24,height:8,seed:45,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'e',x:22,y:6,patrol:false,overwatch:false,weapon:1813,loaded:0,ammo:0}],...options,
 });s.units[0].ap=patch.ap??100;return s;
}
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const physical=s=>({...s,lastError:null,log:[]});
const prime=s=>{const n=actBattle(s,{type:'reprime',unitId:'p'});assert.equal(n.lastError,null,n.lastError);assert.doesNotThrow(()=>restore(n));return n;};

test('both physically held pans consume independent AP with implicit ignition kit while retaining every charge and gun',()=>{
 const s=field(),before=structuredClone(s),u=s.units[0];
 assert.deepEqual(reprimePlan(u,s).hands,['primary','offhand']);assert.equal(actionCosts(s,u).reprime,30);
 const n=prime(s),v=n.units[0];assert.equal(v.ap,70);assert.equal(v.priming,undefined);assert.equal(v.jammed,false);
 assert.deepEqual(v.offHand,{...u.offHand,jammed:false});
 for(const key of ['weapon','loaded','condition','weaponInstanceId','weaponFittings','inventory','ammo','flints'])assert.deepEqual(v[key],u[key],key);
 assert.deepEqual(n.smoke,s.smoke);assert.equal(n.seed,s.seed);assert.deepEqual(s,before);assert.match(n.log.at(-1),/ambas pistolas/);
 assert.deepEqual(prime(restore(s)),n);
});

test('a failed second pistol is serviced without swapping a ready main gun',()=>{
 const s=field({jammed:false}),u=s.units[0];assert.deepEqual(reprimePlan(u,s).hands,['offhand']);
 const n=prime(s),v=n.units[0];assert.equal(v.ap,85);assert.equal(v.priming,undefined);assert.equal(v.jammed,false);
 assert.equal(v.weaponInstanceId,u.weaponInstanceId);assert.equal(v.loaded,1);assert.equal(v.offHand.loaded,1);assert.equal(v.offHand.jammed,false);
 assert.match(n.log.at(-1),/segunda mano/);
});

test('one affordable gun is completed first and the remaining gun needs a separate paid order',()=>{
 for(const ap of [15,29,30]){
  const s=field({ap}),n=prime(s),both=ap===30;
  assert.equal(n.units[0].jammed,false);assert.equal(n.units[0].offHand.jammed,!both);
  assert.equal(n.units[0].ap,ap-(both?30:15));assert.equal(n.units[0].priming,undefined);
  if(!both){assert.match(n.log.at(-1),/todavía necesita/);const ready=restore(n);ready.units[0].ap=15;
   const done=prime(ready);assert.equal(done.units[0].offHand.jammed,false);assert.equal(done.units[0].ap,0);assert.equal(done.units[0].priming,undefined);}
 }
 const one=prime(field({priming:0}));assert.equal(one.units[0].priming,undefined);assert.equal(one.units[0].offHand.jammed,false);assert.equal(one.units[0].ap,70);
 const rejected=actBattle(one,{type:'reprime',unitId:'p'});assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(one));
});

test('unaffordable and invalid orders do not spend time or one of the loaded charges',()=>{
 for(const patch of [{ap:14},{activeSlot:'blade',blade:1813},{activeSlot:'medical'},{weaponDropped:true},{knockedDown:true},{energy:0,unconscious:true}]){
  const s=field(patch),n=actBattle(s,{type:'reprime',unitId:'p'});assert.ok(n.lastError,JSON.stringify(patch));assert.deepEqual(physical(n),physical(s));
 }
});

test('pocketed, two-handed, broken, and non-pistol secondary equipment never joins priming',()=>{
 for(const patch of [{leftHandItem:null},{weapon:1800},{offHand:second({condition:0})},{offHand:second({weapon:1813,loaded:0})}]){
  const s=field(patch),before=structuredClone(s.units[0].offHand),n=prime(s);
  assert.deepEqual(n.units[0].offHand,before);assert.equal(n.units[0].priming,undefined);assert.equal(n.units[0].ap,85);
 }
});

test('exploration and specialist costs use the same plan without spending combat AP',()=>{
 for(const traits of [[],['gunsmith_artillerist']]){
  const s=field({ap:0,traits},{exploration:true,enemies:[]}),cost=traits.length?20:30;
  const n=prime(s);assert.equal(n.units[0].ap,0);assert.equal(n.units[0].priming,undefined);assert.equal(n.elapsedSeconds-s.elapsedSeconds,Math.ceil(cost*.06));
  assert.equal(n.units[0].loaded,1);assert.equal(n.units[0].offHand.loaded,1);assert.equal(n.units[0].offHand.jammed,false);
 }
 const skilled=prime(field({traits:['gunsmith_artillerist'],ap:20}));assert.equal(skilled.units[0].ap,0);assert.equal(skilled.units[0].priming,undefined);
});

test('AI services a failed held second pistol outside contact and keeps a ready primary shot in contact',()=>{
 const s=field({x:22,y:6},{enemies:[{id:'e',x:2,y:2,facing:2,weapon:1805,loaded:1,jammed:false,priming:2,offHand:second({instanceId:'enemy-left'}),patrol:false,overwatch:false}]});
 const enemy=s.units[1];assert.deepEqual(chooseEnemyAction(s,enemy),{type:'reprime',unitId:'e'});
 const n=endTurn(s),v=n.units.find(u=>u.id==='e');assert.equal(v.offHand.jammed,false);assert.equal(v.priming,undefined);assert.equal(v.loaded,1);assert.equal(v.offHand.loaded,1);
 assert.deepEqual(endTurn(restore(s)),n);
 const contact=structuredClone(s);Object.assign(contact.units[0],{x:7,y:2});assert.equal(chooseEnemyAction(contact,contact.units[1]).type,'fire');
 for(const priming of [0,2]){
  const empty=structuredClone(s);Object.assign(empty.units[1],{loaded:0,ammo:4,priming});
  assert.equal(chooseEnemyAction(empty,empty.units[1]).type,'reload','a failed spare does not delay loading the main gun');
 }
});
