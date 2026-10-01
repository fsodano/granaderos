import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,actionCosts,firearmVolleyPreview,firearmShotOptions,shotChance,endTurn} from '../game/tactical.js';
import {pairedPistol} from '../game/paired-fire.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createOfficerRecord,defaultProfile,rosterFor} from '../game/recruitment.js';
import {characterProfile} from '../game/characters.js';
const second=(extra={})=>({count:1,weapon:1808,weight:1.3,loaded:2,condition:57,jammed:false,instanceId:'second',name:'De familia',...extra});
const field=(patch={},sector={})=>{const s=createBattle([{id:'p',name:'Tirador',x:2,y:2,facing:2,weapon:1805,loaded:1,ammo:8,condition:81,weaponInstanceId:'first',marksmanship:85,offHand:second(),...patch}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:2,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}],...sector});for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;};
const fire=(s,a={})=>{const n=actBattle(s,{unitId:'p',type:'fire',targetId:'e',...a});assert.equal(n.lastError,null,n.lastError);assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;};
const reject=(s,a)=>{const n=actBattle(s,{unitId:'p',type:'fire',targetId:'e',...a});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.deepEqual(n.smoke,s.smoke);};

test('one aiming order spends the slower pistol cost once and consumes exact independent charges',()=>{
 const s=field(),u=s.units[0],c=actionCosts(s,u,s.units[1]),before=structuredClone(s);
 assert.equal(c.fire,8);assert.equal(c.aim,3);const n=fire(s,{aim:1}),v=n.units[0];
 assert.equal(v.ap,89);assert.equal(v.loaded,0);assert.equal(v.condition,80);assert.equal(v.offHand.loaded,1);assert.equal(v.offHand.condition,56);assert.equal(v.ammo,8);
 assert.equal(v.weaponInstanceId,'first');assert.equal(v.offHand.instanceId,'second');assert.equal(v.offHand.name,'De familia');assert.equal(v.offHand.weapon,1808);assert.equal(v.weapon,1805);assert.equal(n.smoke.length,2);assert.equal(v.weaponReady,true);assert.deepEqual(s,before);
});
test('readiness, mixed aim costs, turning and prone setup are included once and reject the whole pair if unaffordable',()=>{
 for(const patch of [{},{weaponReady:true},{facing:6},{stance:'prone',movementMode:'prone',facing:6},{mounted:true,horse:true}]){
  const s=field(patch),u=s.units[0],cost=actionCosts(s,u,s.units[1]);assert.equal(cost.fire,cost.setup+cost.discharge);u.ap=cost.fire+cost.aim-1;const aim={type:'firePoint',targetId:undefined,x:5,y:2,aim:1};reject(s,aim);u.ap++;
  const n=fire(s,aim);assert.equal(n.units[0].ap,0);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].offHand.loaded,n.units[0].offHand.jammed?2:1);
 }
});
test('only the physical usable pistol in the second hand joins fire; stowed, empty, failed and broken guns stay untouched',()=>{
 for(const patch of [{leftHandItem:null},{activeSlot:'blade',blade:1813},{offHand:second({loaded:0,reloadProgress:.5})},{offHand:second({jammed:true})},{offHand:second({condition:0})},{weapon:1800}]){
  const s=field(patch),u=s.units[0];assert.equal(pairedPistol(u),null);
  if(u.activeSlot==='blade'){reject(s,{});continue;}
  const old=structuredClone(u.offHand),n=fire(s);assert.deepEqual(n.units[0].offHand,old);assert.equal(n.smoke.length,1);
 }
 for(const patch of [{loaded:0},{jammed:true}]){const s=field(patch);assert.equal(pairedPistol(s.units[0]),null);reject(s,{});}
});
test('a double-barrel pair consumes one charge per gun and the next ready pair costs less',()=>{
 const s=field({weapon:1808,loaded:2,condition:100,marksmanship:35,offHand:second({condition:100})},{seed:1});
 const n=fire(s,{type:'firePoint',targetId:undefined,x:12,y:2}),v=n.units[0];assert.equal(v.loaded,1);assert.equal(v.offHand.loaded,1);assert.equal(actionCosts(n,v,{x:12,y:2}).fire,6);
 const after=fire(n,{type:'firePoint',targetId:undefined,x:12,y:2});assert.equal(after.units[0].loaded,0);assert.equal(after.units[0].offHand.loaded,0);assert.equal(after.units[0].ap,86);assert.equal(after.units[0].ammo,8);
});
test('each pistol has its own accuracy, and the ambidextrous specialty removes only the paired penalty',()=>{
 const s=field(),u=s.units[0],t=s.units[1],pair=firearmVolleyPreview(s,u,t),trained=firearmVolleyPreview(s,{...u,traits:['ambidextrous']},t);
 assert.equal(pair.paired,true);assert.equal(pair.shots.length,2);assert.notEqual(pair.shots[0].chance,pair.shots[1].chance);
 for(let i=0;i<2;i++)assert.equal(trained.shots[i].chance,Math.min(95,pair.shots[i].chance+20));
 assert.equal(shotChance(s,u,t),pair.shots[0].chance);assert.deepEqual(firearmShotOptions(s,u,t,0)[0].shots,pair.shots);
 const solo={...u,leftHandItem:null};assert.equal(shotChance(s,solo,t),shotChance(s,{...solo,traits:['ambidextrous']},t));
 const answers={origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue',specialty:'ambidextrous',temperament:'steady'},profile=defaultProfile(),op=createOfficerRecord('Elena Testigo',answers,profile);
 assert.ok(op.traits.includes('ambidextrous'));assert.ok(!op.traits.includes('expert_rider'));assert.ok(characterProfile(op).skills.some(s=>s.startsWith('Ambidiestro')));assert.equal(op.ridingSkill,55);assert.deepEqual(rosterFor({officer:{name:op.name,answers,profile}}).find(u=>u.id===1000).traits,op.traits);
});
test('main and second-hand ignition failures keep only their own charges and do not cancel the other shot',()=>{
 const found={};for(let seed=1;seed<1000&&Object.keys(found).length<3;seed++){
  const s=field({condition:30,offHand:second({condition:30})},{seed,weather:{rain:20,humidity:5}}),n=fire(s,{type:'firePoint',targetId:undefined,x:12,y:2}),v=n.units[0];
  const key=`${v.jammed}:${v.offHand.jammed}`;if(key==='false:false')continue;found[key]=true;
  assert.equal(v.loaded,v.jammed?1:0);assert.equal(v.offHand.loaded,v.offHand.jammed?2:1);assert.equal(v.condition,v.jammed?30:29);assert.equal(v.offHand.condition,v.offHand.jammed?30:29);assert.equal(v.ap,s.units[0].ap-actionCosts(s,s.units[0],{x:12,y:2}).fire);assert.equal(v.ammo,8);
 }
 assert.deepEqual(Object.keys(found).sort(),['false:true','true:false','true:true']);
});
test('both shots retain the original aim and spend their loads when the first kills or knocks down the target',()=>{
 const lethal=field({marksmanship:100},{enemies:[{id:'e',x:5,y:2,hp:20,patrol:false,overwatch:false}]}),dead=fire(lethal,{aim:4});
 assert.equal(dead.units[1].hp,0);assert.equal(dead.status,'victory');assert.equal(dead.units[0].loaded,0);assert.equal(dead.units[0].offHand.loaded,1);assert.equal(dead.smoke.length,2);
 const legs=field({marksmanship:100}),n=fire(legs,{hitLocation:'legs',aim:4});assert.equal(n.units[1].knockedDown,true);assert.equal(n.units[0].offHand.loaded,1);assert.equal(n.smoke.length,2);
 const prone=field({}, {enemies:[{id:'e',x:5,y:2,stance:'prone',movementMode:'prone',patrol:false,overwatch:false}]});reject(prone,{hitLocation:'head'});fire(prone,{hitLocation:'torso'});
});
test('exploration spends handling time without AP, and JSON restoration repeats the entire paired order',()=>{
 const s=field({ap:17},{exploration:true,enemies:[]});s.units[0].ap=17;
 const action={type:'firePoint',targetId:undefined,x:12,y:2,aim:2};const n=fire(s,action);assert.equal(n.units[0].ap,17);assert.equal(n.elapsedSeconds,1);assert.equal(n.units[0].ammo,8);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(fire(restored,action),n);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(n))));
});
test('a genuine saved interrupt uses its remaining AP for the whole pair before enemy continuation',()=>{
 const s=field({x:1,y:1,marksmanship:100},{width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:7,y:1,weapon:1809}],seed:45});s.units[0].ap=25;s.units[1].ap=24;
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),cost=actionCosts(paused,paused.units[0],paused.units[1]).fire;
 const n=fire(paused),r=fire(restored);assert.deepEqual(n,r);assert.equal(n.units[0].ap,25-cost);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].offHand.loaded,1);assert.equal(n.elapsedSeconds,paused.elapsedSeconds);assert.deepEqual(endTurn(n),endTurn(r));
});
