import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,shotChance,firearmFlightPreview,teamCanSee} from '../game/tactical.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {targetPreview} from '../game/ja2-hud.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field(extra={}){
 const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1800,marksmanship:100,loaded:1,condition:100,experienceLevel:1}],{width:14,height:8,seed:45,tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),enemies:[{id:'e',name:'Objetivo',x:7,y:3,overwatch:false,patrol:false,experienceLevel:1}],...extra});
 for(const u of s.units)u.ap=100;return s;
}
function body(s,extra={}){const u={...structuredClone(s.units[0]),id:'friend',name:'Interpuesto',x:4,y:3,...extra};s.units.push(u);return u;}
const fire=(s,extra={})=>actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:4,...extra});

test('a named-target shot hits the first upright ally, spends one charge and retains the target',()=>{
 const s=field();body(s);const before=structuredClone(s),n=fire(s);
 assert.equal(n.lastError,null);assert.ok(n.units[2].hp<100);assert.equal(n.units[1].hp,100);
 assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ap,64);assert.equal(n.units[0].condition,99);assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[0].lastTargetId,'e');assert.ok(n.log.some(l=>l.includes('hiere a Interpuesto')));assert.deepEqual(s,before);
});

test('a visible intervening body warns without cancelling a deliberate shot',()=>{
 const s=field();body(s);const before=structuredClone(s),p=targetPreview(s,s.units[0],s.units[1],{mode:'fire',aim:4});
 assert.equal(p.valid,true);assert.equal(p.pa,36);assert.equal(p.chance,0);assert.match(p.coverNote,/combatiente.*trayectoria/);assert.deepEqual(s,before);
});

test('cover before the first body stops damage while cover behind it cannot protect it',()=>{
 const s=field();body(s);const wall=x=>Object.assign(s.tiles.find(t=>t.x===x&&t.y===3),{type:'wall',material:'stone',blocked:true,blocksSight:false});
 wall(5);const n=fire(s);assert.ok(n.units[2].hp<100);assert.equal(n.units[1].hp,100);
 wall(3);const stopped=fire(s);assert.equal(stopped.units[2].hp,100);assert.equal(stopped.units[0].loaded,0);
});

test('prone, dead and departed bodies do not intercept an upright torso trajectory',()=>{
 for(const patch of [{stance:'prone',movementMode:'prone'},{hp:0},{departure:{edge:'E'}}]){
  const s=field();body(s,patch);const n=fire(s);assert.equal(n.units[2].hp,s.units[2].hp);assert.ok(n.units[1].hp<100);
 }
});

test('an unconscious body can intercept a low shot and retains shared wound effects',()=>{
 const s=field();Object.assign(s.units[0],{stance:'prone',movementMode:'prone'});Object.assign(s.units[1],{stance:'prone',movementMode:'prone'});
 body(s,{unconscious:true,energy:0,hp:50,stance:'prone'});const n=fire(s);
 assert.equal(n.units[1].hp,100);assert.ok(n.units[2].hp<50);assert.equal(n.units[2].unconscious,true);
});

test('selected body regions remain the actual hit region on an unobstructed target',()=>{
 for(const stance of ['standing','crouched','prone'])for(const hitLocation of ['head','torso','legs']){
  const s=field();Object.assign(s.units[1],{stance,movementMode:{standing:'walk',crouched:'crouch',prone:'prone'}[stance]});
  const n=fire(s,{hitLocation});assert.equal(n.units[1].lastHitLocation,hitLocation);assert.ok(n.units[1].hp<100);
 }
});

test('a seeded miss can hit an ally outside the intended line with no extra charge or AP',()=>{
 const s=field({seed:3});s.units[0].marksmanship=0;body(s,{x:8,y:4});const n=fire(s,{aim:0});
 assert.equal(n.units[1].hp,100);assert.ok(n.units[2].hp<100);assert.equal(n.units[0].ap,88);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].condition,99);
 assert.ok(n.log.some(l=>l.includes('hiere a Interpuesto')));assert.ok(n.log.some(l=>l.includes('sin acertar al punto elegido')));
});

test('hidden bodies do not change forecasts or disclose their identity after an accidental impact',()=>{
 const s=field({seed:3});s.units[0].marksmanship=0;body(s,{id:'hidden',name:'Secreto',side:'enemy',x:8,y:4,overwatch:false});
 Object.assign(s.tiles.find(t=>t.x===5&&t.y===4),{type:'wall',blocked:true,blocksSight:true,material:'wood'});
 const empty=structuredClone(s);empty.units.pop();assert.equal(teamCanSee(s,'player',s.units[2]),false);
 assert.deepEqual(targetPreview(s,s.units[0],s.units[1],{mode:'fire'}),targetPreview(empty,empty.units[0],empty.units[1],{mode:'fire'}));
 const n=fire(s,{aim:0});assert.ok(n.units[2].hp<100);assert.ok(!n.log.some(l=>l.includes('Secreto')));
});

test('an unseen intervening enemy does not change the named-target hit forecast',()=>{
 const s=field({night:true});s.units[0].x=0;s.units[1].x=10;s.lights=[{id:'lamp',x:10,y:3,radius:1,intensity:1,turns:10}];
 body(s,{id:'hidden',name:'Secreto',side:'enemy',x:7,y:3,overwatch:false});const empty=structuredClone(s);empty.units.pop();
 assert.equal(teamCanSee(s,'player',s.units[1]),true);assert.equal(teamCanSee(s,'player',s.units[2]),false);
 assert.equal(shotChance(s,s.units[0],s.units[1],4),shotChance(empty,empty.units[0],empty.units[1],4));
 assert.deepEqual(firearmFlightPreview(s,s.units[0],s.units[1]),firearmFlightPreview(empty,empty.units[0],empty.units[1]));
 const n=fire(s);assert.ok(n.units[2].hp<100);assert.equal(n.units[1].hp,100);assert.ok(!n.log.some(l=>l.includes('Secreto')));
});

test('enemy shot selection avoids its own intervening soldier and uses a clear target',()=>{
 const s=field();Object.assign(s.units[0],{x:8,y:3,loaded:0});Object.assign(s.units[1],{x:1,y:3,facing:2,ap:12,loaded:1});
 body(s,{id:'ally',side:'enemy',x:4,y:3,ap:0,patrol:false,medkits:0});body(s,{id:'clear',x:8,y:6,loaded:0});
 const a=chooseEnemyAction(s,s.units[1]);assert.equal(a.type,'fire');assert.equal(a.targetId,'clear');
 s.units[0].ap=0;s.units[3].ap=0;const n=endTurn(s);assert.equal(n.units[2].hp,100);
});

test('flight is deterministic across body ordering and diagonal corner touches',()=>{
 const s=field();Object.assign(s.units[0],{x:1,y:1});Object.assign(s.units[1],{x:3,y:3});body(s,{x:2,y:1});
 const w={damage:58};const direct=projectileFlight(s,s.units[0],s.units[1],w);assert.equal(direct.victimId,'e');
 const reordered={...s,units:[...s.units].reverse()};assert.deepEqual(projectileFlight(reordered,s.units[0],s.units[1],w),direct);
});

test('miss collisions survive save replay and a rejected shot has no random or physical effects',()=>{
 const s=field({seed:3});s.units[0].marksmanship=0;body(s,{x:8,y:4});
 assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{aim:0}),fire(s,{aim:0}));
 s.units[0].loaded=0;const n=fire(s);assert.ok(n.lastError);
 for(const key of ['units','seed','elapsedSeconds','smoke','phase'])assert.deepEqual(n[key],s[key],key);
});

test('close shots at critical or unconscious targets use their fallen body height',()=>{
 for(const patch of [{hp:10},{hp:50,unconscious:true,energy:0},{hp:50,knockedDown:true}])for(const hitLocation of ['head','torso','legs']){
  const s=field();Object.assign(s.units[1],{x:2,...patch});const n=fire(s,{hitLocation});
  assert.ok(n.units[1].hp<s.units[1].hp);assert.equal(n.units[1].lastHitLocation,hitLocation);
 }
});

test('a miss retains the fallen target height instead of redirecting toward a standing bystander',()=>{
 const s=field({seed:3});s.units[0].marksmanship=0;Object.assign(s.units[1],{unconscious:true,energy:0});body(s,{x:8,y:4});
 const n=fire(s,{aim:0});assert.equal(n.units[1].hp,100);assert.ok(n.units[2].hp<100);assert.equal(n.units[2].lastHitLocation,'legs');
});


test('a failed accuracy roll cannot hit the intended body when scatter crosses its cell',()=>{
 const s=field({seed:20});s.units[0].marksmanship=0;const n=fire(s,{aim:0});
 assert.equal(n.units[1].hp,100);assert.equal(n.units[0].loaded,0);assert.ok(n.log.some(l=>l.includes('sin acertar al punto elegido')));
});
