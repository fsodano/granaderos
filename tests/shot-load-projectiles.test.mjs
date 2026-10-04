import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,weaponFor,firearmFlightPreview,firearmVolleyPreview,firearmShotOptions,shotChance,actionCosts,teamCanSee} from '../game/tactical.js';
import {shotLoadFlight,shotLoadForecast,shotLoadChance,shotLoadScatter,SHOT_LOAD_PATTERN} from '../game/shot-load.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {fieldPractice} from '../game/skill-training.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {initialCampaign} from '../game/campaign.js';
import {order,visit,saved,sync,leave} from './local-contract-fixture.mjs';
import {ammoCount} from '../game/ammo-types.js';
import {targetPreview} from '../game/ja2-hud.js';

const tiles=(width=14,height=8)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false,blocksSight:false}));
const enemy=(id='e',x=4,y=3,extra={})=>({id,x,y,weapon:1813,hp:100,maxHp:100,morale:100,patrol:false,overwatch:false,...extra});
const field=(player={},extra={})=>createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1807,loaded:1,ammo:2,condition:100,marksmanship:100,wisdom:100,dexterity:100,...player}],{width:14,height:8,seed:45,tiles:tiles(),enemies:[enemy()],...extra});
const body=(state,id='p')=>state.units.find(u=>u.id===id);
const shot={type:'fire',unitId:'p',targetId:'e',aim:4};
const replay=(state,action=shot)=>{
 const before=structuredClone(state),next=actBattle(state,action),shown=presentedActBattle(state,action);
 assert.equal(next.lastError,null,next.lastError);assert.deepEqual(shown.state,next);assert.deepEqual(state,before);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(state))),action),next);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
 assert.equal(next.shotLoad,undefined);assert.equal(next.pellets,undefined);
 return {next,shown};
};

test('nine finite weighted rays share one load and spend cover force in physical order',()=>{
 const s=field(),u=body(s),t=body(s,'e'),w=weaponFor(u),flight=shotLoadFlight(s,u,t,w),before=structuredClone(s);
 assert.equal(flight.pellets.length,9);assert.equal(new Set(flight.pellets.map(p=>p.index)).size,9);
 assert.ok(Math.abs(SHOT_LOAD_PATTERN.reduce((n,p)=>n+p.weight,0)-1)<1e-12);
 for(const pellet of flight.pellets){
  assert.ok(Math.hypot(pellet.flight.destination.x-u.x,pellet.flight.destination.y-u.y)<=w.range+1e-10);
  assert.ok(pellet.flight.bodyImpacts.every(hit=>hit.incomingImpact<=w.damage/9+1e-10));
  assert.equal(new Set(pellet.flight.bodyImpacts.map(h=>`${h.victimKind}:${h.victimId}`)).size,pellet.flight.bodyImpacts.length);
 }
 const hay=structuredClone(s);hay.props=[{id:'hay',type:'hay',x:2,y:0,footprint:{width:1,height:8},obstacleHeight:10,blocksSight:false}];
 const weakened=shotLoadFlight(hay,body(hay),body(hay,'e'),w);
 assert.ok(weakened.bodyImpacts.length>0);for(const impact of weakened.bodyImpacts)assert.ok(Math.abs(impact.incomingImpact-(w.damage/9-3))<1e-10);
 hay.props[0].material='wood';const stopped=shotLoadFlight(hay,body(hay),body(hay,'e'),w);
 assert.equal(stopped.bodyImpacts.length,0);assert.ok(stopped.pellets.every(p=>p.flight.terminal.blocked&&p.flight.terminal.remainingImpact===0));
 const raised=structuredClone(s);body(raised).tacticalLevel=1;body(raised,'e').tacticalLevel=1;
 raised.upperSurfaces=[{id:'source',x:1,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false},{id:'target',x:4,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false},{id:'sill',x:3,y:3,tacticalLevel:1,elevation:4.1,type:'floor',kind:'roof',blocked:false}];
 const layered=shotLoadFlight(raised,body(raised),body(raised,'e'),w);
 assert.ok(layered.pellets.some(p=>p.flight.terminal.termination==='slab'));assert.ok(layered.bodyImpacts.some(h=>h.victimId==='e'),'higher rays can clear the same slab');
 const scatter=shotLoadScatter(u,t);assert.ok(Math.abs(scatter.reduce((n,p)=>n+p.weight,0)-1)<1e-12);assert.equal(scatter.find(p=>p.point.x===t.x+1&&p.point.y===t.y).weight,2/9);
 assert.deepEqual(s,before);
});

test('foreground shielding survives its actual death and forecast agrees without roster-dependent draws',()=>{
 const s=field({}, {enemies:[enemy('front',4,3,{hp:15}),enemy('e',6,3)]}),u=body(s),t=body(s,'e');
 assert.equal(shotChance(s,u,t,4),0);assert.equal(firearmFlightPreview(s,u,t).blocked,true);
 const {next,shown}=replay(s);assert.equal(body(next,'front').hp,0);assert.equal(body(next,'e').hp,100);
 assert.deepEqual(shown.frames.flatMap(f=>f.impacts).map(i=>i.unitId),['front']);
 assert.equal(body(next).loaded,0);assert.equal(body(next).ammo,2);assert.equal(body(next).condition,99);
 assert.equal(body(next).ap,u.ap-actionCosts(s,u,t).fire-4*actionCosts(s,u,t).aim);assert.equal(next.elapsedSeconds,6);assert.equal(next.smoke.length,1);assert.equal(next.seed,2711868186);
 const withRemote=structuredClone(s);withRemote.npcs=[{id:'remote',name:'Fuera del alcance',x:12,y:7,hp:100}];
 const other=actBattle(withRemote,shot);assert.equal(other.seed,next.seed);assert.equal(other.npcs[0].hp,100);assert.deepEqual(other.units,next.units);
});

test('fractional pellets aggregate before injury rounding and teach once per actual recipient',()=>{
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1807),damage:1};
 const s=field({marksmanship:95,weaponMetadata:weaponMetadata(definition),practiceSeed:0,skillPractice:{marksmanship:0}}, {enemies:[enemy('e',2,3)]});
 const flight=shotLoadFlight(s,body(s),body(s,'e'),weaponFor(body(s)));
 assert.equal(flight.bodyImpacts.length,9);assert.ok(flight.bodyImpacts.every(h=>h.incomingImpact===1/9&&h.hitLocation==='torso'));
 const {next,shown}=replay(s),expected=structuredClone(body(s));fieldPractice(expected,'marksmanship',4);
 assert.equal(body(next,'e').hp,99);assert.deepEqual(shown.frames.flatMap(f=>f.impacts).map(i=>i.damage),[1]);
 assert.equal(body(next).practiceSeed,expected.practiceSeed);assert.deepEqual(body(next).skillPractice,expected.skillPractice);
 const preview=firearmVolleyPreview(s,body(s),body(s,'e'),4).shots[0];assert.ok(preview.expectedForce<=1);assert.ok(preview.damageFactor<=1);assert.ok(preview.expectedDamage>0&&preview.expectedDamage<=1);
});

test('separate typed bodies on different rays retain actual injury and civilian intent',()=>{
 const s=field({}, {npcs:[{id:'e',name:'Vecino visible',x:3,y:4,hp:100,maxHp:100,stance:'standing'}]}),risk=firearmBystanderRisk(s,body(s),body(s,'e'));
 assert.equal(risk.direct[0].kind,'npc');assert.equal(risk.direct[0].id,'e');
 // Collection identity is defensive physical behavior. The save schema still
 // rejects a scene that assigns the same public ID to a soldier and resident.
 const next=actBattle(s,shot),shown=presentedActBattle(s,shot);assert.equal(next.lastError,null);assert.deepEqual(shown.state,next);assert.throws(()=>validateBattleSnapshot(s));assert.equal(body(next,'e').hp,69);assert.equal(next.npcs[0].hp,69);
 assert.deepEqual(new Set(shown.frames.flatMap(f=>f.impacts).map(i=>`${i.victimKind??'unit'}:${i.unitId}`)),new Set(['unit:e','npc:e']));
 assert.ok(next.npcs[0].civilianHarm.incidents.every(i=>i.intentional===false));
});

test('a physically contacted guard cannot redirect a later group, but its own distinct pellet regions remain real',()=>{
 const s=field({marksmanship:95,skillPractice:{marksmanship:0},practiceSeed:0},{enemies:[enemy('guard',3,4,{abilities:['bodyguard']}),enemy('e',4,3,{leadership:95})]});
 const unprotected=structuredClone(s);body(unprotected,'e').leadership=30;const baseline=actBattle(unprotected,shot),{next,shown}=replay(s),expected=structuredClone(body(s));fieldPractice(expected,'marksmanship',6);
 assert.equal(body(next,'guard').hp,body(baseline,'guard').hp);assert.equal(body(next,'e').hp,body(baseline,'e').hp);
 assert.ok(body(next,'guard').hp<100&&body(next,'e').hp<100);assert.equal(body(next,'guard').ap,100);assert.equal(body(next,'guard').interceptTurn,0);assert.doesNotMatch(next.log.join(' '),/se interpone/);
 assert.equal(body(next).practiceSeed,expected.practiceSeed);assert.deepEqual(body(next).skillPractice,expected.skillPractice);
 for(const id of ['guard','e'])assert.equal(shown.frames.flatMap(f=>f.impacts).filter(i=>i.unitId===id).reduce((sum,i)=>sum+i.damage,0),100-body(next,id).hp);
});

test('unknown room bodies neither alter forecasts and warnings nor expose actual injury metadata',()=>{
 const s=field({}, {npcs:[{id:'secret',name:'Habitante secreto',x:3,y:4,hp:100,roomId:'unrevealed'}]}),clean=structuredClone(s);clean.npcs=[];
 assert.equal(teamCanSee(s,'player',s.npcs[0]),true,'interior admission is distinct from geometric sight');
 assert.deepEqual(firearmVolleyPreview(s,body(s),body(s,'e'),4),firearmVolleyPreview(clean,body(clean),body(clean,'e'),4));
 assert.deepEqual(firearmBystanderRisk(s,body(s),body(s,'e')),firearmBystanderRisk(clean,body(clean),body(clean,'e')));
 const {next,shown}=replay(s),empty=presentedActBattle(clean,shot);assert.ok(next.npcs[0].hp<100);assert.doesNotMatch(next.log.join(' '),/Habitante secreto/);
 assert.deepEqual(shown.frames.filter(f=>f.shotVisual).map(f=>f.shotVisual),empty.frames.filter(f=>f.shotVisual).map(f=>f.shotVisual));
 for(const frame of shown.frames){assert.ok(!frame.impacts.some(i=>i.unitId==='secret'));assert.ok(frame.targetPoint?.id!=='secret');}
 const riskState=field({}, {enemies:[enemy('e',6,3),enemy('private',3,4,{roomId:'unrevealed'})],npcs:[{id:'visible',name:'Vecino visible',x:5,y:4,hp:100}]});
 const onlyKnown=structuredClone(riskState);onlyKnown.units=onlyKnown.units.filter(u=>u.id!=='private');
 assert.deepEqual(firearmBystanderRisk(riskState,body(riskState),body(riskState,'e')),firearmBystanderRisk(onlyKnown,body(onlyKnown),body(onlyKnown,'e')));
 assert.ok(firearmBystanderRisk(onlyKnown,body(onlyKnown),body(onlyKnown,'e')).direct.some(b=>b.id==='visible'));
 const privateCover=structuredClone(onlyKnown);privateCover.props=[{id:'secret-cover',type:'barrels',x:3,y:0,footprint:{width:1,height:8},obstacleHeight:10,projectileResistance:1000,blocksSight:false,roomId:'unrevealed'}];
 assert.deepEqual(firearmVolleyPreview(privateCover,body(privateCover),body(privateCover,'e')),firearmVolleyPreview(onlyKnown,body(onlyKnown),body(onlyKnown,'e')));
 assert.deepEqual(firearmBystanderRisk(privateCover,body(privateCover),body(privateCover,'e')),firearmBystanderRisk(onlyKnown,body(onlyKnown),body(onlyKnown,'e')));
 for(const weapon of [1807,1800]){
  body(privateCover).weapon=weapon;body(onlyKnown).weapon=weapon;
  assert.deepEqual(targetPreview(privateCover,body(privateCover),body(privateCover,'e'),{mode:'fire'}),targetPreview(onlyKnown,body(onlyKnown),body(onlyKnown,'e'),{mode:'fire'}));
 }
 body(privateCover).weapon=1807;
 const stopped=actBattle(privateCover,shot);assert.equal(body(stopped,'e').hp,100);assert.equal(stopped.npcs[0].hp,100,'private cover still stops real pellets');
 for(const resistance of [100,24]){
  const ball=field({weapon:1801},{enemies:[enemy('e',7,3)],props:[{id:'private-chest',type:'chest',x:4,y:3,roomId:'private',blocksSight:false,obstacleHeight:2,projectileResistance:resistance}]}),{next,shown}=replay(ball);
  assert.doesNotMatch(next.log.join(' '),/cobertura|private-chest/);
  for(const frame of shown.frames){if(frame.shotVisual){assert.notEqual(frame.shotVisual.impact.x,3.5);assert.notEqual(frame.shotVisual.material,'wood');}}
  if(resistance===100){assert.equal(body(next,'e').hp,100);assert.ok(shown.frames.every(f=>f.impacts.length===0));}
  else{assert.ok(body(next,'e').hp<100);assert.equal(shown.frames.flatMap(f=>f.impacts).reduce((sum,i)=>sum+i.damage,0),100-body(next,'e').hp);}
 }
});

test('mixed paired shots retain original mounted height while actual fallen bodies change intersections',()=>{
 const s=field({x:2,y:2,weapon:1805,condition:81,ammo:8,offHand:{weapon:1808,count:1,loaded:2,condition:100,ammunitionChoice:'ammoShot',instanceId:'second'}},{width:20,height:8,tiles:tiles(20,8),seed:127,enemies:[enemy('e',5,2,{mounted:true}),enemy('reserve',18,6)]});
 for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;
 const action={...shot,hitLocation:'legs'},height=absoluteBodyHeight(s,body(s,'e'),'legs'),{next,shown}=replay(s,action),flights=shown.frames.filter(f=>f.type==='projectile');
 assert.equal(body(next,'e').hp,70);assert.equal(body(next,'e').mounted,false);assert.equal(body(next,'e').knockedDown,true);assert.equal(next.seed,366914888);
 assert.equal(flights.length,2);assert.equal(flights[1].shotVisual.spread,true);assert.equal(flights[1].shotVisual.impact.height,height);assert.equal(flights[1].state.units.find(u=>u.id==='e').hp,70);
 assert.deepEqual(shown.frames.flatMap(f=>f.impacts).map(i=>i.damage),[30]);assert.equal(body(next).loaded,0);assert.equal(body(next).offHand.loaded,1);assert.equal(body(next).offHand.condition,99);assert.equal(body(next).offHand.instanceId,'second');assert.equal(next.smoke.length,2);assert.equal(next.elapsedSeconds,6);
 const jammed=structuredClone(s);body(jammed).offHand.condition=0;const rejected=actBattle(jammed,action);assert.deepEqual(body(rejected).offHand,body(jammed).offHand,'an unusable second hand never joins the paid order');
});

test('enemy shot decisions use the same observed pellet force and avoid known friendly lanes',()=>{
 const s=field({x:6,y:3,weapon:1800,loaded:0},{enemies:[enemy('shooter',1,3,{weapon:1807,loaded:1,ammo:0,marksmanship:100,facing:2}),enemy('friend',3,4)]});
 const u=body(s,'shooter'),t=body(s),before=structuredClone(s),options=firearmShotOptions(s,u,t);
 assert.ok(options.some(o=>o.interveningFriendly));const plan=chooseEnemyAction(s,u);assert.ok(plan?.type!=='fire'||!options.find(o=>o.aim===(plan.aim??0)&&o.hitLocation===(plan.hitLocation??'torso'))?.interveningFriendly);
 const alone=structuredClone(s);alone.units=alone.units.filter(u=>u.id!=='friend');body(alone).ap=0;const accepted=chooseEnemyAction(alone,body(alone,'shooter'));assert.ok(['move','stance','fire'].includes(accepted.type));
 const presented=presentedEndTurn(alone);assert.deepEqual(presented.state,endTurn(alone));assert.ok(body(presented.state).hp<100);assert.equal(body(presented.state,'shooter').loaded,0);assert.deepEqual(s,before);
 const prediction=firearmVolleyPreview(alone,body(alone,'shooter'),body(alone),0).shots[0];assert.ok(Number.isFinite(prediction.expectedDamage)&&prediction.expectedDamage>0);
 const privateShooter=field({x:3,y:3,weapon:1800,loaded:0},{enemies:[enemy('hidden',1,3,{name:'Tirador secreto',roomId:'unrevealed',weapon:1807,loaded:1,ammo:0,marksmanship:100,facing:2})]});body(privateShooter).ap=0;
 const hidden=presentedEndTurn(privateShooter);assert.deepEqual(hidden.state,endTurn(privateShooter));assert.ok(body(hidden.state).hp<100);assert.doesNotMatch(hidden.state.log.join(' '),/Tirador secreto/);
 assert.ok(hidden.frames.every(f=>f.unitId!=='hidden'&&!f.shotVisual));assert.ok(hidden.frames.some(f=>f.impacts.some(i=>i.unitId==='p')));
});

test('a normal paid shot-load hire keeps finite cartridges through real shot, full save, return and reentry',()=>{
 let campaign=order(initialCampaign(8),{type:'recruitCivic',id:100,term:'week'});campaign=order(campaign,{type:'wait',hours:6});let pair=visit(campaign);
 const u=pair.battle.units.find(u=>u.id==='100'),cash=pair.campaign.resources.treasury,initial=u.loaded+ammoCount(u),point={x:u.x===0?1:u.x-1,y:u.y};
 assert.equal(weaponFor(u).loadPattern,'cone');assert.equal(initial,10);const action={type:'firePoint',unitId:u.id,...point};
 const initialPair=saved(pair),result=presentedActBattle(initialPair.battle,action);assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(initialPair.battle,action));
 pair=saved(sync({campaign:initialPair.campaign,battle:result.state}));const fired=pair.battle.units.find(u=>u.id==='100');assert.equal(fired.loaded+ammoCount(fired),initial-1);assert.equal(pair.campaign.resources.treasury,cash);assert.ok(pair.battle.elapsedSeconds>initialPair.battle.elapsedSeconds);
 campaign=leave(pair);pair=visit(campaign);const returned=pair.battle.units.find(u=>u.id==='100');assert.equal(returned.loaded+ammoCount(returned),initial-1);assert.equal(pair.campaign.resources.treasury,cash);assert.equal(pair.battle.pellets,undefined);assert.deepEqual(saved(pair),pair);
});
