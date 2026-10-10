import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {createBattle,actBattle,getReachable,teamCanSee,firearmShotOptions} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {combatOrder} from './opening-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

const actor=state=>state.units.find(unit=>unit.id==='shooter');
const friendlyRisk=option=>Boolean(option?.interveningFriendly||option?.shots?.some(shot=>shot.interveningFriendly));
function forecast(state,unit,action){
 if(action?.type!=='fire')return null;
 const target=state.units.find(unit=>unit.id===action.targetId);
 return firearmShotOptions(state,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
}
const knownView=(state,unit)=>({...state,units:state.units.filter(other=>other.side===unit.side||teamCanSee(state,unit.side,other)),npcs:(state.npcs??[]).filter(other=>teamCanSee(state,unit.side,other))});
const finite=unit=>Object.fromEntries(['hp','maxHp','bandaged','bleeding','weapon','loaded','ammo','ammunition','ammunitionChoice','medkits','condition','inventory','offHand'].map(key=>[key,unit[key]]));

// Declared flat tactical arena, not an earned campaign or victory receipt.
// Initial weapons, ammunition and actors are explicit test input. Only an
// ordinary paid native movement order is executed; no turn loop is run.
function lane({privateBodies=false}={}){
 const width=22,height=12;
 return createBattle([
  {id:'shooter',x:2,y:3,weapon:1802,loaded:1,ammo:2,stance:'prone',marksmanship:100,dexterity:100,agility:100},
  {id:'friend',x:5,y:3,weapon:1800,stance:'standing'},
 ],{
  width,height,seed:45,
  tiles:Array.from({length:width*height},(_,index)=>({x:index%width,y:Math.floor(index/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'behind-friend',x:8,y:3,hp:100,stance:'standing',patrol:false,overwatch:false},...(privateBodies?[{id:'private-opponent',x:20,y:10,hp:100,weapon:1800,loaded:1,ammo:2,patrol:false,overwatch:false}]:[])],
  npcs:privateBodies?[{id:'private-npc',name:'Habitante no observado',x:21,y:10,hp:100}]:[],
 });
}

test('the genuine retained blocked-shot state selects the native known-view move without executing a campaign order',t=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-known-friendly-fire.save.json.gz',import.meta.url))),proof=JSON.parse(readFileSync(new URL('./fixtures/northern-known-friendly-fire.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const {campaign,battle}=decodeSave(raw.toString()),before=structuredClone({campaign,battle}),unit=battle.units.find(actor=>actor.id==='142');
 const original=combatOrder(battle,unit);assert.equal(original?.type,'fire');assert.equal(friendlyRisk(forecast(battle,unit,original)),true);
 const visible=battle.units.filter(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.unconscious&&!target.surrendered&&!target.routed&&teamCanSee(battle,unit.side,target));
 assert.ok(visible.length>0);
 assert.equal(visible.flatMap(target=>firearmShotOptions(battle,unit,target,4)).filter(option=>option.chance>=25&&!friendlyRisk(option)).length,0,'the ranked safe-shot path has no alternative');
 const native=chooseEnemyAction(knownView(battle,unit),unit);
 assert.deepEqual(native,{type:'move',unitId:'142',x:35,y:11,tacticalLevel:0});
 for(const controller of [northernCombatOrder,tucumanCombatOrder])assert.deepEqual(controller(battle,unit),native);
 const route=getReachable(knownView(battle,unit),unit).find(point=>sameCell(point,native));
 assert.ok(route);assert.equal(route.cost,39);assert.equal(route.path.length,2);assert.ok(route.cost<=unit.ap);
 assert.deepEqual({campaign,battle},before,'all genuine input fields remain unchanged');
 t.diagnostic(JSON.stringify({case:'retained-Mendoza-pure-selection',scope:'official paired input; zero actions executed; no outcome claim',fixtureSha256:proof.sha256,original,originalForecast:forecast(battle,unit,original),selected:native,quotedAP:route.cost,availableAP:unit.ap,path:route.path,inputUnchanged:true}));
});

test('a known friendly block admits one paid native move with finite load and exact validated JSON replay',t=>{
 const state=lane(),before=structuredClone(state),unit=actor(state),original=combatOrder(state,unit);
 assert.equal(friendlyRisk(forecast(state,unit,original)),true);
 const action=northernCombatOrder(state,unit);
 assert.deepEqual(action,{type:'move',unitId:'shooter',x:3,y:2});
 assert.deepEqual(action,chooseEnemyAction(knownView(state,unit),unit));
 assert.deepEqual(tucumanCombatOrder(state,unit),action);
 const route=getReachable(knownView(state,unit),unit).find(point=>sameCell(point,action));assert.ok(route);assert.equal(route.cost,23);
 const next=actBattle(state,action),moved=actor(next);
 assert.equal(next.lastError,null);assert.equal(next.status,'active');
 assert.deepEqual(spacePoint(moved),spacePoint(action));assert.equal(moved.ap,unit.ap-route.cost);
 assert.deepEqual(finite(moved),finite(unit),'a movement action cannot supply health, weapon condition or ammunition');
 assert.ok(moved.energy<unit.energy,'native movement retains its energy cost');
 assert.ok(next.elapsedSeconds>state.elapsedSeconds,'native movement advances the tactical clock');
 for(const other of state.units.filter(other=>other.id!==unit.id)){const result=next.units.find(actor=>actor.id===other.id);assert.deepEqual(finite(result),finite(other));assert.deepEqual(spacePoint(result),spacePoint(other));assert.equal(result.ap,other.ap);}
 assert.deepEqual(state,before,'planning and execution preserve the input');
 const resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(state))),replayed=actBattle(resumed,northernCombatOrder(resumed,actor(resumed)));
 assert.deepEqual(replayed,next,'validated JSON round-trip repeats every result field; this is not an official campaign save');
 assert.doesNotThrow(()=>validateBattleSnapshot(next));
 t.diagnostic(JSON.stringify({case:'paid-native-lane-move',scope:'declared tactical input; one move plus exact replay; no turn loop or campaign result',action,path:route.path,apBefore:unit.ap,apAfter:moved.ap,paidAP:unit.ap-moved.ap,elapsedBefore:state.elapsedSeconds,elapsedAfter:next.elapsedSeconds,energyBefore:unit.energy,energyAfter:moved.energy,finiteBefore:finite(unit),finiteAfter:finite(moved),inputUnchanged:true,jsonRoundTripExact:true}));
});

test('private opponent and civilian changes cannot redirect the blocked-shot fallback',t=>{
 const state=lane({privateBodies:true}),before=structuredClone(state),unit=actor(state),hidden=state.units.find(other=>other.id==='private-opponent'),npc=state.npcs.find(other=>other.id==='private-npc');
 assert.equal(teamCanSee(state,'player',hidden),false);assert.equal(teamCanSee(state,'player',npc),false);
 const action=northernCombatOrder(state,unit);assert.deepEqual(action,{type:'move',unitId:'shooter',x:3,y:2});
 const changed=structuredClone(state);
 Object.assign(changed.units.find(other=>other.id===hidden.id),{x:20,y:11,hp:61,weapon:1813,loaded:0,ammo:7,medical:80,medkits:1});
 Object.assign(changed.npcs.find(other=>other.id===npc.id),{x:21,y:11,hp:40,name:'Otro dato privado'});
 assert.equal(teamCanSee(changed,'player',changed.units.find(other=>other.id===hidden.id)),false);assert.equal(teamCanSee(changed,'player',changed.npcs.find(other=>other.id===npc.id)),false);
 assert.deepEqual(knownView(changed,actor(changed)),knownView(state,unit),'the public chooser input is exactly unchanged');
 const changedBefore=structuredClone(changed);
 for(const controller of [northernCombatOrder,tucumanCombatOrder])assert.deepEqual(controller(changed,actor(changed)),controller(state,unit));
 assert.deepEqual(state,before);assert.deepEqual(changed,changedBefore);
 t.diagnostic(JSON.stringify({case:'private-occupant-invariance',scope:'declared hidden-input perturbation; zero actions executed',privateOpponentBefore:{id:hidden.id,x:hidden.x,y:hidden.y,hp:hidden.hp,weapon:hidden.weapon,loaded:hidden.loaded,ammo:hidden.ammo},privateOpponentAfter:changed.units.find(other=>other.id===hidden.id),privateNpcBefore:npc,privateNpcAfter:changed.npcs.find(other=>other.id===npc.id),action,publicInputExact:true,inputUnchanged:true}));
});
