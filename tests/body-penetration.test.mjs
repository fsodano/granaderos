import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,weaponFor,firearmFlightPreview,firearmShotOptions,firearmVolleyPreview,shotChance,teamCanSee} from '../game/tactical.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {penetratingFirearmDamage} from '../game/combat-balance.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {fieldPractice} from '../game/skill-training.js';

const field=(seed=11,extra={})=>createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1801,marksmanship:100,ammo:2,condition:100}],{width:30,height:8,seed,tiles:Array.from({length:240},(_,i)=>({x:i%30,y:Math.floor(i/30),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[{id:'e',name:'Primer guardia',x:7,y:3,morale:100,patrol:false,overwatch:false},{id:'behind',name:'Segundo guardia',x:9,y:3,morale:100,patrol:false,overwatch:false}],...extra});
const action={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'torso'};
const body=(s,id)=>s.units.find(u=>u.id===id);
const wall=(s,x,material)=>Object.assign(s.tiles.find(t=>t.x===x&&t.y===3),{type:'wall',material,blocked:true,blocksSight:false,obstacleHeight:2});

test('one finite named shot can pass through a body and cause a smaller real downstream injury with saved replay',()=>{
 const s=field(),before=structuredClone(s),n=actBattle(s,action),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
 assert.equal(n.lastError,null);assert.equal(body(n,'e').hp,51);assert.equal(body(n,'behind').hp,79);
 assert.equal(body(n,'p').loaded,0);assert.equal(body(n,'p').ammo,body(s,'p').ammo);assert.equal(body(n,'p').ap,69);assert.equal(body(n,'p').condition,99);assert.equal(n.elapsedSeconds,6);
 assert.deepEqual(s,before);assert.deepEqual(actBattle(restored,action),n);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
 const empty=field();empty.units=empty.units.filter(u=>u.id!=='behind');const baseline=actBattle(empty,action);
 for(const key of ['ap','loaded','ammo','condition','lastTargetId','lastShotPosition'])assert.deepEqual(body(n,'p')[key],body(baseline,'p')[key]);
 assert.equal(n.seed,baseline.seed,'the same ball uses one damage draw and the same one possible body-passage roll');
});

test('failed seeded body passage lodges the ball without a downstream injury',()=>{
 const s=field(45),n=actBattle(s,action);
 assert.equal(body(n,'e').hp,45);assert.equal(body(n,'behind').hp,100);assert.equal(n.seed,1432815537);
 assert.equal(body(n,'p').loaded,0);assert.equal(n.elapsedSeconds,6);
 const stopped=projectileFlight(s,body(s,'p'),body(s,'e'),weaponFor(body(s,'p')),'torso',{resolveBody:()=>false});
 assert.equal(stopped.bodyImpacts.length,1);assert.equal(stopped.bodyImpacts[0].continued,false);assert.equal(stopped.terminal.remainingImpact,0);assert.equal(stopped.terminal.termination,'body');
});

test('a real bodyguard redirects the first injury and is not injured again by the later ray intersection',()=>{
 const s=field(11,{enemies:[{id:'e',x:7,y:3,leadership:95,morale:100,patrol:false,overwatch:false},{id:'guard',x:8,y:3,abilities:['bodyguard'],morale:100,patrol:false,overwatch:false}]}),n=actBattle(s,action),shown=presentedActBattle(s,action);
 assert.equal(body(n,'e').hp,100);assert.equal(body(n,'guard').hp,51);assert.equal(body(n,'guard').ap,92);assert.equal(body(n,'guard').interceptTurn,1);assert.equal(body(n,'p').loaded,0);
 assert.deepEqual(shown.state,n);assert.deepEqual(shown.frames.flatMap(frame=>frame.impacts).map(hit=>[hit.unitId,hit.damage]),[['guard',49]]);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),n);
});

test('a guard already struck by this ball cannot intercept its later commander hit',()=>{
 const s=field(11,{enemies:[{id:'guard',x:7,y:3,abilities:['bodyguard'],morale:100,patrol:false,overwatch:false},{id:'commander',x:8,y:3,leadership:95,morale:100,patrol:false,overwatch:false}]}),a={...action,targetId:'guard'};
 Object.assign(body(s,'p'),{marksmanship:80,skillPractice:{marksmanship:0},practiceSeed:0});const before=structuredClone(s),expectedLearning=structuredClone(body(s,'p'));
 fieldPractice(expectedLearning,'marksmanship',6); // One discharge and two distinct eligible injuries, two attempts each.
 const n=actBattle(s,a),shown=presentedActBattle(s,a);
 assert.equal(n.lastError,null);assert.equal(body(n,'guard').hp,51);assert.equal(body(n,'commander').hp,79);assert.equal(body(n,'guard').ap,100);assert.equal(body(n,'guard').interceptTurn,0);
 assert.deepEqual(shown.frames.flatMap(frame=>frame.impacts).map(hit=>[hit.unitId,hit.damage]),[['guard',49],['commander',21]]);
 const injuryFrames=shown.frames.filter(frame=>frame.impacts.length);assert.equal(body(injuryFrames[0].state,'commander').hp,100);assert.equal(body(injuryFrames[1].state,'guard').hp,51);
 assert.equal(body(n,'p').practiceSeed,expectedLearning.practiceSeed);assert.deepEqual(body(n,'p').skillPractice,expectedLearning.skillPractice);assert.equal(body(n,'p').loaded,0);assert.equal(body(n,'p').ammo,body(s,'p').ammo);assert.equal(body(n,'p').ap,69);assert.equal(body(n,'p').condition,99);assert.equal(n.elapsedSeconds,6);assert.equal(n.smoke.length,1);assert.equal(n.seed,322324079);
 assert.deepEqual(s,before);assert.deepEqual(shown.state,n);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),a),n);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('location fire uses the same finite lead-ball penetration and paid action',()=>{
 const s=field(),a={type:'firePoint',unitId:'p',x:7,y:3,aim:4},n=actBattle(s,a);
 assert.equal(n.lastError,null);assert.equal(body(n,'e').hp,51);assert.equal(body(n,'behind').hp,79);assert.equal(body(n,'p').loaded,0);assert.equal(body(n,'p').ap,69);assert.equal(n.elapsedSeconds,6);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),a),n);
});

test('body resistance and cover spend force in collision order and later cover cannot protect an earlier hit',()=>{
 const clear=field(),between=field(),before=field();wall(between,8,'wood');wall(before,5,'wood');
 const clearN=actBattle(clear,action),betweenN=actBattle(between,action),beforeN=actBattle(before,action);
 assert.equal(body(betweenN,'e').hp,body(clearN,'e').hp);assert.equal(body(betweenN,'behind').hp,100);assert.ok(body(beforeN,'e').hp>body(clearN,'e').hp);assert.equal(body(beforeN,'behind').hp,100);
 const path=projectileFlight(between,body(between,'p'),body(between,'e'),weaponFor(body(between,'p')));
 assert.equal(path.bodyImpacts[0].incomingImpact,52);assert.equal(path.bodyImpacts[0].remainingImpact,22);assert.equal(path.bodyImpacts.length,1);assert.equal(path.terminal.blocked,true);assert.equal(path.terminal.remainingImpact,0);assert.equal(path.terminal.termination,'cover');assert.equal(path.terminal.impact.x,7.5);
 const weak=field();wall(weak,8,'hay');const force=projectileFlight(weak,body(weak,'p'),body(weak,'e'),{damage:120,range:20});
 assert.ok(force.bodyImpacts[1].incomingImpact<force.bodyImpacts[0].remainingImpact);
 const hit=force.bodyImpacts[1];assert.ok(penetratingFirearmDamage(120,hit,0)<120);assert.equal(penetratingFirearmDamage(120,hit,0),90,'turning cover damage off cannot return the first body’s 30 spent force');
 assert.ok(penetratingFirearmDamage(120,hit)<penetratingFirearmDamage(120,hit,0));
});

test('three typed body intersections accumulate force and reach probability without repeated body injury',()=>{
 const s=field();s.npcs=[{id:'e',name:'Civil distinto',x:8,y:3,hp:100,stance:'standing'}];
 const trace=projectileFlight(s,body(s,'p'),body(s,'e'),{damage:120,range:20});
 assert.deepEqual(trace.bodyImpacts.map(h=>[h.victimKind,h.victimId]),[['unit','e'],['npc','e'],['unit','behind']]);
 assert.deepEqual(trace.bodyImpacts.map(h=>h.incomingImpact),[120,90,60]);assert.equal(trace.bodyImpacts[0].reachChance,1);assert.equal(trace.bodyImpacts[1].reachChance,.95);assert.ok(Math.abs(trace.bodyImpacts[2].reachChance-.665)<1e-12);
 assert.equal(new Set(trace.bodyImpacts.map(h=>`${h.victimKind}:${h.victimId}`)).size,3);assert.equal(trace.bodyImpacts.at(-1).remainingImpact,30);assert.equal(trace.terminal.remainingImpact,0);assert.equal(trace.terminal.termination,'ground');
 const live=field(11,{npcs:[{id:'e',name:'Civil distinto',x:9,y:3,hp:100}],enemies:[{id:'e',x:7,y:3,morale:100,patrol:false,overwatch:false}]});const n=actBattle(live,action);
 assert.equal(body(n,'e').hp,51);assert.equal(n.npcs[0].hp,79,'a soldier ID does not exclude a distinct civilian with the same ID');
});

test('body-region resistance stays on the original ray and ground or real floor stops later passage',()=>{
 const s=field(),attacker=body(s,'p'),target=body(s,'e'),w=weaponFor(attacker);
 const head=projectileFlight(s,attacker,target,w,'head'),legs=projectileFlight(s,attacker,target,w,'legs');
 assert.equal(head.bodyImpacts[0].bodyResistance,15);assert.equal(legs.bodyImpacts[0].bodyResistance,23);assert.equal(legs.terminal.termination,'ground');assert.equal(legs.bodyImpacts.length,2);assert.equal(legs.terminal.impact.height,0);
 const raised=field();body(raised,'p').tacticalLevel=1;body(raised,'e').tacticalLevel=1;raised.units=raised.units.filter(u=>u.id!=='behind');
 raised.upperSurfaces=[{id:'source',x:1,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0},{id:'target',x:7,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0},{id:'floor',x:9,y:3,tacticalLevel:1,elevation:4.1,type:'floor',kind:'roof',blocked:false,cover:0}];
 const floor=projectileFlight(raised,body(raised,'p'),body(raised,'e'),w);assert.equal(floor.bodyImpacts.length,1);assert.equal(floor.terminal.termination,'slab');assert.equal(floor.terminal.blocked,true);
});

test('named and paired forecasts show conditional selected-target reach without drawing RNG',()=>{
 const s=field(),attacker=body(s,'p'),target=body(s,'behind'),before=structuredClone(s);
 const forecast=firearmFlightPreview(s,attacker,target),hit=forecast.bodyImpacts.find(h=>h.victimId==='behind');assert.equal(hit.reachChance,.32);assert.equal(hit.damageFactor,22/52);
 assert.equal(shotChance(s,attacker,target,4),30);const option=firearmShotOptions(s,attacker,target,4).find(o=>o.aim===4&&o.hitLocation==='torso');assert.equal(option.chance,30);assert.equal(option.conditional,true);assert.equal(option.damageFactor,22/52);
 const pistol={...attacker,weapon:1805,offHand:{weapon:1808,count:1,weight:1.3,loaded:1,condition:100},activeSlot:'primary'},volley=firearmVolleyPreview(s,pistol,target,4);
 assert.equal(volley.paired,true);assert.equal(volley.shots.length,2);assert.ok(volley.shots.every(shot=>shot.chance>0&&shot.chance<=95&&shot.conditional));assert.deepEqual(firearmShotOptions(s,pistol,target,4).find(o=>o.aim===4&&o.hitLocation==='torso').shots,volley.shots);assert.deepEqual(s,before);
});

test('known downstream allies are warned and enemy AI avoids both sides of a penetrating lane',()=>{
 const s=field();body(s,'behind').side='player';const p=body(s,'p'),e=body(s,'e');
 assert.ok(firearmBystanderRisk(s,p,e).direct.some(h=>h.id==='behind'));
 const enemy=field();Object.assign(body(enemy,'p'),{side:'enemy'});Object.assign(body(enemy,'e'),{side:'player'});const actor=body(enemy,'p');enemy.phase='enemy';
 const options=firearmShotOptions(enemy,actor,body(enemy,'e'),0);assert.ok(options.some(o=>o.chance>0&&o.interveningFriendly));
 assert.notEqual(chooseEnemyAction(enemy,actor)?.type,'fire');
 body(enemy,'behind').x=5;assert.ok(firearmShotOptions(enemy,actor,body(enemy,'e'),0).some(o=>o.conditional&&o.interveningFriendly));assert.notEqual(chooseEnemyAction(enemy,actor)?.type,'fire');
});

test('a poor shot behind a body retains its truthful positive sub-one-percent forecast',()=>{
 const s=field();Object.assign(body(s,'p'),{marksmanship:0,shock:20});const attacker=body(s,'p'),target=body(s,'behind'),before=structuredClone(s);
 const clear=structuredClone(s);clear.units=clear.units.filter(u=>u.id!=='e');assert.equal(shotChance(clear,body(clear,'p'),body(clear,'behind'),0),1,'ordinary accuracy is one percent before the body-passage chance');
 const chance=shotChance(s,attacker,target,0);assert.equal(chance,.32);assert.ok(chance>0&&chance<1);
 const option=firearmShotOptions(s,attacker,target,0).find(o=>o.hitLocation==='torso');assert.equal(option.chance,chance);assert.equal(option.conditional,true);assert.equal(option.reachChance,.32);assert.deepEqual(s,before);
});

test('hidden body passage changes actual harm without changing observation-only forecasts or bystander warnings',()=>{
 const s=field(11,{npcs:[{id:'hidden',name:'Oculto',x:12,y:3,hp:100,stance:'prone'}],enemies:[{id:'e',x:15,y:3,stance:'prone',patrol:false,overwatch:false,morale:100}]});Object.assign(body(s,'p'),{stance:'prone',movementMode:'prone'});Object.assign(s.tiles.find(t=>t.x===12&&t.y===3),{type:'forest',cover:100,concealment:100});const empty=structuredClone(s);empty.npcs=[];
 assert.equal(teamCanSee(s,'player',s.npcs[0]),false);assert.equal(teamCanSee(s,'player',body(s,'e')),true);
 assert.deepEqual(firearmFlightPreview(s,body(s,'p'),body(s,'e')),firearmFlightPreview(empty,body(empty,'p'),body(empty,'e')));assert.equal(shotChance(s,body(s,'p'),body(s,'e'),4),shotChance(empty,body(empty,'p'),body(empty,'e'),4));assert.deepEqual(firearmBystanderRisk(s,body(s,'p'),body(s,'e')),firearmBystanderRisk(empty,body(empty,'p'),body(empty,'e')));
 const n=actBattle(s,action);assert.ok(n.npcs[0].hp<100);assert.ok(body(n,'e').hp<100);assert.ok(!n.log.some(line=>/atraviesa un cuerpo|Oculto/.test(line)),'an observed reduced injury cannot reveal the hidden prior body');assert.deepEqual(presentedActBattle(s,action).state,n);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),n);
});
