import test from 'node:test';
import assert from 'node:assert/strict';
import {NERVOUS_ISOLATION_SHOCK,NERVOUS_ISOLATION_RADIUS,NERVOUS_ISOLATION_MORALE,nervousIsolationStatus,applyNervousIsolation} from '../game/nervous-isolation.js';
import {createBattle,actBattle,endTurn,presentedEndTurn,shotChance,interruptInitiative,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {runBattleJob} from '../game/battle-job.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {legacyCharacterAbilities,hasCharacterAbility} from '../game/character-abilities.js';

const person={id:'130',name:'Ángela Cejas',side:'player',abilities:['nervous_isolation'],hp:100,energy:100,x:1,y:3,morale:49,shock:6};
const companion={id:'110',side:'player',hp:100,energy:100,x:5,y:3};
const notices=b=>b.log.filter(line=>line.includes('siente temor al quedar sin apoyo.'));
const actor=b=>b.units.find(unit=>unit.id==='130');
const restore=b=>validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
function finishRound(before){
 let next=endTurn(before),declines=0;
 while(next.turn===before.turn&&next.status==='active'&&declines++<8){
  assert.equal(next.phase,'interrupt','only a real interruption can pause this declared enemy turn');
  const restored=restore(next),ordinary=endTurn(next);assert.deepEqual(endTurn(restored),ordinary);next=ordinary;
 }
 assert.equal(next.turn,before.turn+1);return next;
}
// Declared low-morale engine checkpoint, not an earned campaign event. The
// first enemy budget is deliberately zero before initial admission. Later
// movement, turns and shots use ordinary reducers and retain finite stock.
function field({unit={},friends=[],enemyX=12,width=20,height=12,quiet=0}={}){
 const b=createBattle([{...person,weapon:1800,marksmanship:85,facing:2,...unit},...friends],{
  width,height,seed:45,hour:12,deferContact:true,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',x:enemyX,y:3,agility:10,experienceLevel:1,weapon:1800,loaded:0,ammo:0,patrol:false,overwatch:false}],
 });
 b.units.find(unit=>unit.id==='e').ap=0;b.quietCombatTurns=quiet;
 return restore(b);
}

test('pure isolation has exact morale, radius and surface boundaries without private-world inputs',()=>{
 assert.equal(NERVOUS_ISOLATION_SHOCK,2);assert.equal(NERVOUS_ISOLATION_RADIUS,4);assert.equal(NERVOUS_ISOLATION_MORALE,50);
 const state={units:[person]},before=structuredClone(state);
 assert.deepEqual(nervousIsolationStatus(state,person),{eligible:true,active:true,reason:'isolated',addedShock:2});
 for(const morale of [50,80,100])assert.equal(nervousIsolationStatus(state,{...person,morale}).reason,'morale');
 assert.equal(nervousIsolationStatus(state,{...person,morale:49.999}).active,true);
 assert.equal(nervousIsolationStatus({units:[person,companion]},person).reason,'companion');
 assert.equal(nervousIsolationStatus({units:[person,{...companion,x:5.000001}]},person).active,true);
 assert.equal(nervousIsolationStatus({units:[person,{...companion,tacticalLevel:1}]},person).active,true);
 for(const other of [{...companion,militia:true},{...companion,missionAlly:true}])assert.equal(nervousIsolationStatus({units:[person,other]},person).reason,'companion');
 const privateState={...state,npcs:[{...companion,roomId:'unrevealed'}],units:[person,{...companion,id:'hidden',side:'enemy',roomId:'unrevealed'}]};
 assert.deepEqual(nervousIsolationStatus(privateState,person),nervousIsolationStatus(state,person));
 assert.deepEqual(state,before);
});

test('only capable owned actors fear isolation and only capable military companions relieve it',()=>{
 const states=[{hp:14},{hp:0},{energy:0},{unconscious:true},{asleep:true},{knockedDown:true},{routed:true},{fled:true},{captured:true},{captive:true},{bound:true},{detained:true},{entangled:true},{departure:{}},{surrendered:true}];
 for(const altered of states){
  assert.equal(nervousIsolationStatus({units:[person]},{...person,...altered}).eligible,false,JSON.stringify(altered));
  assert.equal(nervousIsolationStatus({units:[person,{...companion,...altered}]},person).active,true,JSON.stringify(altered));
 }
 for(const altered of [{side:'enemy'},{militia:true},{missionAlly:true},{id:'borrowed'},{id:'0130'},{abilities:[]},{abilities:undefined},{abilities:'nervous_isolation'},{morale:NaN},{shock:21}])assert.equal(nervousIsolationStatus({units:[person]},{...person,...altered}).eligible,false);
 assert.equal(nervousIsolationStatus({units:[person,{...companion,hp:15,energy:.01}]},person).active,false);
});

test('application clips ordinary shock only and neither invalid nor noncombat application pays anything',()=>{
 const unit={...person,shock:19.25},state={mode:'combat',status:'active',seed:45,elapsedSeconds:6,units:[unit]},before=structuredClone(state);
 assert.equal(applyNervousIsolation(state,unit),.75);assert.equal(unit.shock,20);
 const expected=structuredClone(before);expected.units[0].shock=20;assert.deepEqual(state,expected);
 assert.equal(applyNervousIsolation(state,unit),0);assert.deepEqual(state,expected);
 for(const mode of ['exploration','combat'])for(const status of ['active','victory','defeat','retreat']){
  if(mode==='combat'&&status==='active')continue;
  const u={...person},s={mode,status,units:[u]},copy=structuredClone(s);assert.equal(applyNervousIsolation(s,u),0);assert.deepEqual(s,copy);
 }
});

test('a real new combat turn applies fear after decay and preserves exact costs, RNG and replay',()=>{
 const b=field(),source=structuredClone(b),legacy=field({unit:{abilities:undefined}});
 assert.equal(actor(b).shock,6);assert.equal(actor(b).nervousIsolationWarned,undefined);
 const after=endTurn(b),plain=endTurn(legacy);assert.equal(after.lastError,null);assert.equal(after.turn,2);assert.equal(after.elapsedSeconds,6);
 assert.equal(actor(after).shock,5);assert.equal(actor(plain).shock,3);assert.equal(actor(after).nervousIsolationWarned,true);assert.equal(notices(after).length,1);
 const comparable=structuredClone(after);delete actor(comparable).abilities;delete actor(comparable).nervousIsolationWarned;actor(comparable).shock=actor(plain).shock;comparable.log=comparable.log.filter(line=>!line.includes('siente temor al quedar sin apoyo.'));
 assert.deepEqual(comparable,plain,'only the authored shock and named informational notice differ');
 const plainChance=shotChance(plain,actor(plain),plain.units.find(u=>u.id==='e')),fearChance=shotChance(after,actor(after),after.units.find(u=>u.id==='e'));
 assert.equal(plainChance,53);assert.equal(fearChance,43);assert.equal(plainChance-fearChance,10,'both actual forecasts are clear of the1/95 clamps');
 assert.equal(interruptInitiative(plain,actor(plain))-interruptInitiative(after,actor(after)),4);
 assert.deepEqual(presentedEndTurn(b).state,after);assert.deepEqual(runBattleJob({battle:b,kind:'turn'}),after);assert.deepEqual(restore(after),after);assert.deepEqual(b,source);
 const action={type:'fire',unitId:'130',targetId:'e'},beforeShot=structuredClone(after),cost=actionCosts(after,actor(after),after.units.find(u=>u.id==='e')).fire,shot=actBattle(after,action);
 assert.equal(shot.lastError,null);assert.equal(actor(shot).ap,actor(after).ap-cost);assert.equal(actor(shot).loaded,0);assert.equal(actor(shot).condition,99);assert.equal(actor(shot).shock,5);assert.equal(notices(shot).length,1);
 assert.deepEqual(actBattle(restore(beforeShot),action),shot,'saved continuation pays the same finite shot');
 const paused=endTurn(after);assert.equal(paused.phase,'interrupt');assert.equal(paused.turn,after.turn);assert.equal(actor(paused).shock,5,'an interrupted enemy phase has no new player-turn fear');
 const later=endTurn(paused);assert.equal(actor(later).shock,4.5);assert.equal(notices(later).length,1);assert.deepEqual(endTurn(restore(paused)),later);assert.deepEqual(finishRound(restore(after)),later);
});

test('paid regrouping stops the next fear increase without refunding existing shock',()=>{
 const b=field({friends:[{...companion,name:'Acosta',x:1,y:9,weapon:1800}]}),afraid=endTurn(b);
 assert.equal(actor(afraid).shock,5);assert.equal(notices(afraid).length,1);
 const before=structuredClone(afraid),move={type:'move',unitId:'110',x:1,y:6},joined=actBattle(afraid,move);
 assert.equal(joined.lastError,null);assert.ok(joined.units.find(u=>u.id==='110').ap<before.units.find(u=>u.id==='110').ap);assert.equal(actor(joined).shock,5);
 assert.equal(nervousIsolationStatus(joined,actor(joined)).reason,'companion');
 const next=finishRound(joined);assert.equal(actor(next).shock,2.5);assert.equal(notices(next).length,1);
 assert.deepEqual(finishRound(restore(actBattle(restore(before),move))),next);
});

test('all companions recover before fear is tested, independently of roster order',()=>{
 const friend={...companion,name:'Acosta',x:3,y:3,energy:0,weapon:1800};
 const one=field({friends:[friend]}),two=structuredClone(one);two.units.reverse();
 assert.equal(nervousIsolationStatus(one,actor(one)).active,true,'the initial exhausted companion cannot supply support');
 const a=endTurn(one),b=endTurn(two);
 for(const result of [a,b]){assert.equal(actor(result).shock,3);assert.equal(actor(result).nervousIsolationWarned,undefined);assert.equal(result.units.find(u=>u.id==='110').energy,20);assert.equal(notices(result).length,0);}
 assert.deepEqual([...a.units].sort((a,b)=>a.id.localeCompare(b.id)),[...b.units].sort((a,b)=>a.id.localeCompare(b.id)));
});

test('a quiet round ending combat adds no fear and an old omitted capability remains neutral',()=>{
 const b=field({enemyX:46,width:48,height:16,quiet:1}),after=endTurn(b);
 assert.equal(after.mode,'exploration');assert.equal(actor(after).shock,3);assert.equal(notices(after).length,0);assert.equal(actor(after).nervousIsolationWarned,undefined);
 const old=field({unit:{abilities:undefined}});assert.equal(actor(endTurn(old)).shock,3);assert.deepEqual(legacyCharacterAbilities(130),[]);assert.equal(hasCharacterAbility({id:130},'nervous_isolation'),false);
 const content=defaultContentPackage();assert.deepEqual(content.characters.find(c=>c.id==='person-130').abilities,['care_composure','nervous_isolation']);assert.deepEqual(validateContentPackage(content),[]);
 const neutral=structuredClone(content);neutral.characters.find(c=>c.id==='person-130').abilities=['care_composure'];assert.deepEqual(validateContentPackage(neutral),[],'older explicit capability lists stay valid');
});

test('one-time notice metadata admits only its explicit owned source and survives JSON restoration',()=>{
 const valid=endTurn(field());assert.equal(actor(restore(valid)).nervousIsolationWarned,true);
 for(const value of [false,null,0,'true',{},[]]){const invalid=structuredClone(valid);actor(invalid).nervousIsolationWarned=value;assert.throws(()=>restore(invalid),/aislamiento/);}
 for(const change of [u=>delete u.abilities,u=>u.militia=true,u=>u.missionAlly=true,u=>u.side='enemy',u=>u.id='borrowed']){const invalid=structuredClone(valid);change(actor(invalid));assert.throws(()=>restore(invalid),/aislamiento/);}
 const npc=structuredClone(valid);npc.npcs.push({id:'resident',name:'Vecina',x:2,y:5,hp:100,nervousIsolationWarned:true});assert.throws(()=>restore(npc),/aislamiento/);
});
