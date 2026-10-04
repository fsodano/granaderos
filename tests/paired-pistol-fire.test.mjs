import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,firearmVolleyPreview,firearmShotOptions,shotChance,endTurn} from '../game/tactical.js';
import {pairedPistol} from '../game/paired-fire.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
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
 assert.equal(v.ap,89);assert.equal(v.loaded,0);assert.equal(v.condition,80);assert.equal(v.offHand.jammed,true);assert.equal(v.offHand.loaded,2);assert.equal(v.offHand.condition,57);assert.equal(v.ammo,8);
 assert.equal(v.weaponInstanceId,'first');assert.equal(v.offHand.instanceId,'second');assert.equal(v.offHand.name,'De familia');assert.equal(v.offHand.weapon,1808);assert.equal(v.weapon,1805);assert.equal(n.smoke.length,1);assert.equal(v.weaponReady,true);assert.deepEqual(s,before);
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
test('both single-ball pistols retain the admitted ray after death, knockdown or unhorsing, including elevated fire and a seeded miss',()=>{
 const pair={marksmanship:100,offHand:second({condition:100})},enemy=extra=>({id:'e',x:5,y:2,patrol:false,overwatch:false,...extra}),reserve={id:'reserve',x:18,y:6,patrol:false,overwatch:false};
 const roof=Array.from({length:160},(_,i)=>({id:`roof:${i}`,x:i%20,y:Math.floor(i/20),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const cases=[
  {name:'death',s:field(pair,{enemies:[enemy({hp:20})]}),location:'torso',hp:0,damage:[20],seed:366914888},
  {name:'standing legs',s:field(pair),location:'legs',hp:48,damage:[30,22],seed:4258295815},
  {name:'mounted legs',s:field(pair,{enemies:[enemy({mounted:true}),reserve]}),location:'legs',hp:70,damage:[30],seed:366914888},
  {name:'roof legs',s:field({...pair,tacticalLevel:1},{upperSurfaces:roof,enemies:[enemy({tacticalLevel:1}),reserve]}),location:'legs',hp:48,damage:[30,22],seed:4258295815},
  // Seed11 hits the mounted legs first, then misses with the second pistol.
  // Its scatter is (4,3), still aimed at the original mounted leg height1.1.
  {name:'scattered second ball',s:field({...pair,marksmanship:25},{seed:11,enemies:[enemy({mounted:true}),reserve]}),location:'legs',hp:74,damage:[26],seed:3082576147,scatter:{x:4,y:3}}
 ];
 for(const c of cases){
  const before=structuredClone(c.s),target=c.s.units[1],action={unitId:'p',type:'fire',targetId:'e',aim:4,hitLocation:c.location},n=fire(c.s,action),shown=presentedActBattle(c.s,action);
  assert.deepEqual(shown.state,n,c.name);assert.deepEqual(c.s,before,c.name);
  assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(c.s))),action),n,c.name);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n,c.name);
  const flights=shown.frames.filter(f=>f.type==='projectile'&&f.shotVisual&&f.shotVisual.discharge!==false),injuries=shown.frames.flatMap(f=>f.impacts);
  assert.equal(flights.length,2,c.name);assert.deepEqual(injuries.map(i=>[i.unitId,i.damage]),c.damage.map(d=>['e',d]),c.name);
  assert.equal(flights[0].state.units[1].hp,target.hp,c.name);assert.equal(flights[1].state.units[1].hp,target.hp-c.damage[0],c.name);
  const sourceHeight=absoluteBodyHeight(c.s,c.s.units[0],'muzzle'),aimHeight=absoluteBodyHeight(c.s,target,c.location);
  for(let i=0;i<flights.length;i++){
   const visual=flights[i].shotVisual,aim=i===1&&c.scatter?c.scatter:target,slope=(aimHeight-sourceHeight)/(aim.x-2);
   assert.deepEqual(visual.source,{x:2,y:2,tacticalLevel:c.s.units[0].tacticalLevel??0,height:sourceHeight},c.name);
   assert.ok(Math.abs(visual.impact.height-sourceHeight-slope*(visual.impact.x-2))<1e-10,`${c.name}: original absolute aim height`);
   assert.ok(Math.abs(visual.impact.y-2-(aim.y-2)/(aim.x-2)*(visual.impact.x-2))<1e-10,`${c.name}: original horizontal aim`);
  }
  const shooter=n.units[0];assert.equal(n.units[1].hp,c.hp,c.name);assert.equal(shooter.ap,80);assert.equal(shooter.loaded,0);assert.equal(shooter.offHand.loaded,1);assert.equal(shooter.ammo,8);
  assert.equal(shooter.condition,80);assert.equal(shooter.offHand.condition,99);assert.equal(shooter.weaponInstanceId,'first');assert.equal(shooter.offHand.instanceId,'second');assert.equal(n.smoke.length,2);assert.equal(n.elapsedSeconds,6);assert.equal(n.seed,c.seed,c.name);
  if(c.hp===0){assert.equal(n.status,'victory');assert.equal(shown.frames.find(f=>f.type==='impact').state.units[1].hp,0);}
  else{assert.equal(n.units[1].knockedDown,true);assert.equal(n.units[1].stance,'prone');assert.equal(n.units[1].mounted,false);}
  if(c.damage.length===1){assert.equal(flights[1].shotVisual.outcome,'cover');assert.equal(flights[1].shotVisual.material,'earth');assert.equal(flights[1].shotVisual.impact.height,0);}
  if(c.scatter)assert.ok(n.log.some(line=>line.includes('falla con la mano secundaria (52%)')));
 }
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
