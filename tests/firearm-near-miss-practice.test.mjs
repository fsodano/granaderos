import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceFirearmNearMiss} from '../game/firearm-near-miss-practice.js';
import {fieldPractice,validateTraining} from '../game/skill-training.js';
import {WEAPONS} from '../game/firearm-definitions.js';

// Isolated resolved-shot receipts test eligibility; the lifecycle file proves
// real enemy discharge, presentation, campaign return and save admission.
function receipt(player={}){
 const target={id:'p',side:'player',x:8,y:3,hp:100,maxHp:100,energy:100,agility:75,wisdom:50,stance:'standing',practiceSeed:0,skillPractice:{agility:39},...player};
 const attacker={id:'e',side:'enemy',x:1,y:3,hp:100,stance:'standing',weapon:1800,loaded:0,ap:0};
 const state={width:16,height:8,seed:123,log:['Existing report'],units:[target,attacker],tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',elevation:0}))};
 const flight={victimId:null,bodyImpacts:[],terminal:{impact:{x:15,y:3,height:1.1},termination:'edge'}};
 return {state,target,attacker,flight,event:{attacker,source:attacker,target,weapon:WEAPONS[1800],flight,hit:false,discharged:true,damagedBodies:new Set()}};
}
const unchanged=r=>{const before=structuredClone(r.state);assert.equal(practiceFirearmNearMiss(r.state,r.event),0);assert.deepEqual(r.state,before);};

test('one real near-miss receipt uses ordinary separate agility practice without health, combat RNG or notices',()=>{
 const r=receipt(),expected=structuredClone(r.target),before=structuredClone(r.state);fieldPractice(expected,'agility',1);
 assert.equal(practiceFirearmNearMiss(r.state,r.event),1);assert.deepEqual(r.target,expected);assert.equal(r.target.agility,76);assert.equal(r.target.skillPractice.agility,0);
 assert.deepEqual(r.state,{...before,units:[expected,before.units[1]]});assert.doesNotThrow(()=>validateTraining(r.target));
 const earned=structuredClone(r.state);assert.equal(practiceFirearmNearMiss(r.state,r.event),0);assert.deepEqual(r.state,earned);
});

test('unpaid, jammed, friendly, non-firearm, cone, hit and detached-player receipts grant nothing',()=>{
 for(const change of [r=>{r.event.discharged=false;},r=>{delete r.event.discharged;},r=>{r.event.hit=true;},r=>{r.attacker.jammed=true;},r=>{r.attacker.side='player';},r=>{r.event.source={...r.attacker};},r=>{r.event.target={...r.target};},r=>{r.event.weapon=WEAPONS[1807];},r=>{r.event.weapon={...WEAPONS[1800],loadPattern:'cone'};},r=>{r.event.weapon={id:'bronze4',range:80,damage:85};},r=>{r.flight.victimId='p';},r=>{r.flight.bodyImpacts=[{victimKind:'unit',victimId:'other'},{victimKind:'unit',victimId:'p'}];}]){const r=receipt();change(r);unchanged(r);}
});

test('a typed NPC with the same ID cannot be mistaken for the intended soldier',()=>{
 const r=receipt();r.flight.bodyImpacts=[{victimKind:'npc',victimId:'p'}];r.flight.victimKind='npc';r.flight.victimId='p';
 assert.equal(practiceFirearmNearMiss(r.state,r.event),1);
});

test('compatible authored single-ball firearms can teach while redirected actual injuries cannot',()=>{
 const authored=receipt();authored.event.weapon={...WEAPONS[1800],id:'authored-smoothbore',template:1800};assert.equal(practiceFirearmNearMiss(authored.state,authored.event),1);
 const redirected=receipt();redirected.flight.bodyImpacts=[{victimKind:'unit',victimId:'bodyguard'}];redirected.event.damagedBodies.add('unit:p');unchanged(redirected);
 const absent=receipt();delete absent.event.damagedBodies;unchanged(absent);
 const typed=receipt();typed.event.damagedBodies.add('npc:p');assert.equal(practiceFirearmNearMiss(typed.state,typed.event),1);
});

test('dead, critical, unconscious, routed, bound, knocked-down and absent targets gain nothing',()=>{
 for(const patch of [{hp:0},{hp:14},{energy:0},{unconscious:true},{routed:true},{bound:true},{captured:true},{entangled:2},{knockedDown:true},{surrendered:true},{departure:{edge:'E'}},{fled:true}])unchanged(receipt(patch));
});

test('physical termination before the target, remote rays and wrong heights cannot create practice',()=>{
 for(const change of [r=>{r.flight.terminal.impact.x=6;},r=>{r.flight.terminal.impact.x=8;},r=>{r.target.y=5;},r=>{r.flight.terminal.impact.height=8;},r=>{r.flight.terminal.impact.height=-3;},r=>{r.target.stance='prone';},r=>{r.target.tacticalLevel=1;r.state.upperSurfaces=[{x:8,y:3,tacticalLevel:1,elevation:3}];},r=>{r.flight.terminal.impact.height=NaN;},r=>{r.flight.terminal.impact.x=r.attacker.x;r.flight.terminal.impact.y=r.attacker.y;}]){const r=receipt();change(r);unchanged(r);}
});

test('the terminal ray takes priority over the first collision alias',()=>{
 const stopped=receipt();stopped.flight.impact={x:15,y:3,height:1.1};stopped.flight.terminal.impact.x=6;unchanged(stopped);
 const passed=receipt();passed.flight.impact={x:4,y:3,height:1.2};passed.flight.victimId='other';passed.flight.bodyImpacts=[{victimKind:'unit',victimId:'other'}];assert.equal(practiceFirearmNearMiss(passed.state,passed.event),1);
});

test('only an eligible paid receipt is marked, and a failed practice roll still consumes its one attempt',()=>{
 const r=receipt();r.event.discharged=false;unchanged(r);r.event.discharged=true;assert.equal(practiceFirearmNearMiss(r.state,r.event),1);
 const failed=receipt({wisdom:10});assert.equal(practiceFirearmNearMiss(failed.state,failed.event),0);assert.notEqual(failed.target.practiceSeed,0);assert.equal(failed.target.skillPractice.agility,39);
 const after=structuredClone(failed.state);assert.equal(practiceFirearmNearMiss(failed.state,failed.event),0);assert.deepEqual(failed.state,after);
});

test('the existing minimum aptitude, Wisdom, forty-credit threshold and lifetime caps apply',()=>{
 for(const patch of [{agility:0},{agility:34},{agility:100},{trainedStats:{agility:10}}])unchanged(receipt(patch));
 const novice=receipt({agility:35,wisdom:100,skillPractice:{agility:0}});assert.equal(practiceFirearmNearMiss(novice.state,novice.event),0);assert.equal(novice.target.agility,35);assert.equal(novice.target.skillPractice.agility,1);
 const final=receipt({agility:99,wisdom:100,practiceSeed:1972,trainedStats:{agility:9}});assert.equal(practiceFirearmNearMiss(final.state,final.event),1);assert.equal(final.target.agility,100);assert.equal(final.target.trainedStats.agility,10);
});
