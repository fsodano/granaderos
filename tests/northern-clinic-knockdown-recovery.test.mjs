import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,stanceCost,teamCanSee,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint} from '../game/tactical-space.js';
import {northernCombatOrder,northernClinicDefenseOrder} from './northern-route.mjs';
import {stockNorthernSaltaController} from './fresh-northern-fixture.mjs';

// Declared tactical arena, not a campaign victory receipt. The initial actor is
// a conscious stable survivor already knocked down on a plain roof. This uses
// the native prepared-knockdown convention from campaign-battery-driver.test.
// Only an ordinary actBattle stance order may clear the declared condition.
function field({ap,knockedDown=true,quiet=false}={}){
 const width=12,height=6,upperSurfaces=[];
 for(let y=1;y<=3;y++)for(let x=1;x<=8;x++)upperSurfaces.push({
  id:`roof:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',
  blocked:false,cover:20,blocksSight:false,material:'stone',
 });
 const state=createBattle([{
  id:'guard',name:'Guardia de clínica',x:2,y:2,tacticalLevel:1,facing:2,
  hp:75,maxHp:100,bandaged:25,bleeding:0,energy:80,morale:100,
  stance:'prone',movementMode:'prone',knockedDown,weapon:1800,loaded:1,ammo:4,
  medical:0,medkits:0,patrol:false,overwatch:false,
 }],{
  width,height,seed:45,hour:12,exploration:quiet,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  upperSurfaces,climbLinks:[],
  enemies:quiet?[]:[{
   id:'contact',name:'Contacto declarado',x:7,y:2,tacticalLevel:1,facing:6,
   weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,morale:100,patrol:false,overwatch:false,
  }],
 });
 // A declared starting AP budget controls admission; no order grants AP.
 if(ap!==undefined)state.units.find(unit=>unit.id==='guard').ap=ap;
 return validateBattleSnapshot(state);
}
const guard=state=>state.units.find(unit=>unit.id==='guard');
const finite=unit=>Object.fromEntries(['hp','maxHp','bandaged','bleeding','energy','weapon','loaded','ammo','medkits','condition'].map(key=>[key,unit[key]]));

test('a knocked-down roof clinic guard admits the exact native recovery and pays its full AP cost',t=>{
 const state=field({ap:12}),before=structuredClone(state),actor=guard(state);
 assert.equal(state.mode,'combat');assert.equal(state.turn,1);assert.equal(actor.knockedDown,true);
 assert.equal(teamCanSee(state,'player',state.units.find(unit=>unit.id==='contact')),true);
 const native=northernCombatOrder(state,actor);
 assert.deepEqual(native,{type:'stance',unitId:'guard',stance:'standing'});
 const action=northernClinicDefenseOrder(state,actor);
 assert.deepEqual(action,native,'roof holding must admit this required native recovery');
 assert.deepEqual(state,before,'planning cannot change the input, posture, AP or supplies');
 assert.equal(stanceCost(actor,'standing'),12);
 const next=actBattle(state,action),recovered=guard(next);
 assert.equal(next.lastError,null);assert.equal(recovered.knockedDown,false);
 assert.equal(recovered.stance,'standing');assert.equal(recovered.movementMode,'walk');
 assert.equal(recovered.ap,actor.ap-stanceCost(actor,'standing'));
 assert.deepEqual(spacePoint(recovered),spacePoint(actor),'recovery stays at the actual roof cell');
 assert.deepEqual(finite(recovered),finite(actor),'recovery cannot grant health, supplies, ammunition or condition');
 assert.deepEqual(next.units.find(unit=>unit.id==='contact'),state.units.find(unit=>unit.id==='contact'));
 assert.ok(next.elapsedSeconds>state.elapsedSeconds,'the ordinary order retains native elapsed time');
 assert.deepEqual(state,before,'native execution must preserve its input');
 const resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(actBattle(resumed,northernClinicDefenseOrder(resumed,guard(resumed))),next,'validated JSON round-trip repeats the exact native result; this is not an official campaign save');
 assert.doesNotThrow(()=>validateBattleSnapshot(next));
 t.diagnostic(JSON.stringify({case:'paid-roof-knockdown-recovery',scope:'declared initial knockdown/AP arena; validated JSON round-trip only',apBefore:actor.ap,apAfter:recovered.ap,paidAP:actor.ap-recovered.ap,elapsedBefore:state.elapsedSeconds,elapsedAfter:next.elapsedSeconds,cellBefore:spacePoint(actor),cellAfter:spacePoint(recovered),finiteBefore:finite(actor),finiteAfter:finite(recovered),knockedDownBefore:actor.knockedDown,knockedDownAfter:recovered.knockedDown,inputUnchanged:true,jsonRoundTripExact:true}));
});

test('one AP short still refuses recovery and an explicit native order spends nothing',t=>{
 const state=field({ap:11}),before=structuredClone(state);
 assert.equal(stanceCost(guard(state),'standing'),12);
 assert.equal(northernCombatOrder(state,guard(state)),null);
 assert.equal(northernClinicDefenseOrder(state,guard(state)),null);
 assert.deepEqual(state,before);
 const rejected=actBattle(state,{type:'stance',unitId:'guard',stance:'standing'});
 assert.ok(rejected.lastError);
 const {log:oldLog,lastError:oldError,...oldState}=state;
 const {log:newLog,lastError:newError,...newState}=rejected;
 assert.deepEqual(newState,oldState,'native rejection cannot spend AP, time, health or supplies');
 assert.equal(guard(rejected).knockedDown,true);
 assert.deepEqual(state,before);
 t.diagnostic(JSON.stringify({case:'one-AP-short-native-refusal',apBefore:guard(state).ap,apAfter:guard(rejected).ap,requiredAP:stanceCost(guard(state),'standing'),elapsedBefore:state.elapsedSeconds,elapsedAfter:rejected.elapsedSeconds,finiteBefore:finite(guard(state)),finiteAfter:finite(guard(rejected)),knockedDownAfter:guard(rejected).knockedDown,lastError:rejected.lastError,atomicRefusal:true}));
});

test('an ordinary prone roof guard still holds through an early quiet turn',t=>{
 const state=field({knockedDown:false,quiet:true}),before=structuredClone(state);
 assert.equal(state.turn,1);assert.equal(guard(state).knockedDown,false);
 assert.deepEqual(northernCombatOrder(state,guard(state)),{type:'stance',unitId:'guard',stance:'standing'});
 assert.equal(northernClinicDefenseOrder(state,guard(state)),null,'the exception admits required knockdown recovery only');
 assert.deepEqual(state,before);
 t.diagnostic(JSON.stringify({case:'ordinary-roof-hold-unchanged',knockedDown:false,turn:state.turn,nativeAction:northernCombatOrder(state,guard(state)),clinicAction:null,inputUnchanged:true}));
});


// Declared wounded tactical input, not an earned campaign or ending. The
// controller must respect the same native knockdown and paid slot rules as UI.
function woundedMedic({activeSlot='primary',ap=80}={}){
 const state=createBattle([{
  id:'medic',name:'Sanitario de Salta',x:2,y:2,hp:75,maxHp:100,
  bleeding:2,bandaged:0,medical:60,medkits:1,energy:80,morale:100,
  stance:'prone',movementMode:'prone',knockedDown:true,activeSlot,
  weapon:1800,loaded:1,ammo:0,patrol:false,overwatch:false,
 }],{
  width:8,height:8,seed:45,hour:12,
  tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'contact',x:7,y:7,weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false}],
 });
 state.units.find(unit=>unit.id==='medic').ap=ap;
 return validateBattleSnapshot(state);
}
const medic=state=>state.units.find(unit=>unit.id==='medic');

test('the stock Salta medic pays native recovery before selecting dressings, with exact replay and finite aid',()=>{
 const state=woundedMedic(),before=structuredClone(state),controller=stockNorthernSaltaController(state),actor=medic(state);
 const recovery=controller(state,actor);
 assert.deepEqual(recovery,{type:'stance',unitId:'medic',stance:'standing'});
 assert.deepEqual(state,before,'Choosing recovery cannot change posture, wounds, AP or stock.');
 const stood=actBattle(state,recovery);assert.equal(stood.lastError,null);
 assert.equal(medic(stood).ap,actor.ap-stanceCost(actor,'standing'));assert.equal(medic(stood).knockedDown,false);
 assert.deepEqual(finite(medic(stood)),finite(actor),'Standing cannot grant health or supplies.');
 const selection=controller(stood,medic(stood));assert.deepEqual(selection,{type:'weapon',unitId:'medic',slot:'medical'});
 const selected=actBattle(stood,selection);assert.equal(selected.lastError,null);
 assert.equal(medic(selected).ap,medic(stood).ap-actionCosts(stood,medic(stood)).weapon);
 assert.deepEqual(finite(medic(selected)),finite(medic(stood)));
 const aid=controller(selected,medic(selected));assert.deepEqual(aid,{type:'useItem',unitId:'medic',targetId:'medic'});
 const treated=actBattle(selected,aid);assert.equal(treated.lastError,null);
 assert.equal(medic(treated).ap,medic(selected).ap-actionCosts(selected,medic(selected),medic(selected)).heal);
 assert.equal(medic(treated).hp,actor.hp);assert.equal(medic(treated).bleeding,0);assert.equal(medic(treated).medkits,0);
 for(const key of ['loaded','ammo','weapon','condition'])assert.equal(medic(treated)[key],actor[key]);
 assert.ok(treated.elapsedSeconds>state.elapsedSeconds);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(state)));
 for(const action of [recovery,selection,aid]){replay=actBattle(replay,action);assert.equal(replay.lastError,null);}
 assert.deepEqual(replay,treated,'Every paid order replays from the same validated tactical input.');
 assert.deepEqual(state,before);
});

test('stock Salta keeps already-held adjacent aid available while unpaid recovery remains atomic',()=>{
 const holding=woundedMedic({activeSlot:'medical'}),before=structuredClone(holding),controller=stockNorthernSaltaController(holding);
 const aid=controller(holding,medic(holding));assert.deepEqual(aid,{type:'useItem',unitId:'medic',targetId:'medic'});
 const treated=actBattle(holding,aid);assert.equal(treated.lastError,null);assert.equal(medic(treated).knockedDown,true);
 assert.equal(medic(treated).hp,medic(holding).hp);assert.equal(medic(treated).bleeding,0);assert.equal(medic(treated).medkits,0);
 assert.deepEqual(holding,before);
 const poor=woundedMedic({ap:11}),unchanged=structuredClone(poor);
 assert.equal(stanceCost(medic(poor),'standing'),12);
 assert.equal(stockNorthernSaltaController(poor)(poor,medic(poor)),null);
 assert.deepEqual(poor,unchanged);
 const rejected=actBattle(poor,{type:'stance',unitId:'medic',stance:'standing'});assert.ok(rejected.lastError);
 assert.deepEqual(rejected.units,poor.units);assert.equal(rejected.elapsedSeconds,poor.elapsedSeconds);
});
