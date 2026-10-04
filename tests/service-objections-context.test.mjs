import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {addIssuedConductObserver} from '../game/service-objections.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {preparedConductArena,performConductEvent,executePaidConductRoute,conductStep,conductWitness,conductCivilian} from './conduct-objections-fixture.mjs';
import {localPackage,readyLocal,localNPC,localId,talk,order,saved,leave} from './local-contract-fixture.mjs';

const report=(pair,type='syncTacticalTime')=>({type,battleId:pair.campaign.pendingBattle.id,
 elapsedSeconds:pair.battle.elapsedSeconds,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(actor=>actor.side==='player')});
function atomicDenial(pair,action){
 const before=structuredClone(pair.campaign),denied=dispatchCampaign(pair.campaign,action);
 assert.match(denied.lastError,/objeción|incidente civil|observadores/i);
 assert.deepEqual({...denied,lastError:null},before);
}

test('a new saved objection must have its real issued civilian death evidence',()=>{
 const start=preparedConductArena().start;
 assert.deepEqual(start.battle.conductObserverIds,[107]);
 for(const receipt of [
  {kind:'civilian-killing',civilianKey:'npc-local-buenos_aires',attackerId:'100'},
  {kind:'civilian-killing',civilianKey:'npc-missing-person',attackerId:'100'},
 ]){
  const invalid=structuredClone(start);conductWitness(invalid.battle).serviceObjection=receipt;
  atomicDenial(invalid,report(invalid));atomicDenial(invalid,report(invalid,'battleResult'));
  assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)),/objeción|incidente civil/i);
 }
});

test('earned objection and observer authority survive successive full checkpoints and reject edits',()=>{
 const earned=performConductEvent(preparedConductArena().start).pair;
 assert.ok(conductWitness(earned.battle).serviceObjection);
 assert.equal(conductCivilian(earned.battle).hp,0);
 const accepted=syncBattleTime(earned.campaign,earned.battle);assert.equal(accepted.error,null);
 assert.doesNotThrow(()=>decodeSave(encodeSave(accepted.campaign,accepted.battle)));
 for(const edit of [
  pair=>delete conductWitness(pair.battle).serviceObjection,
  pair=>conductWitness(pair.battle).serviceObjection.attackerId='107',
  pair=>conductWitness(pair.battle).serviceObjection.civilianKey='npc-missing-person',
  pair=>delete pair.battle.conductObserverIds,
  pair=>pair.battle.conductObserverIds=[100],
 ]){
  const invalid=structuredClone(earned);edit(invalid);
  atomicDenial(invalid,report(invalid));
  atomicDenial(invalid,report(invalid,'battleResult'));
  assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)),/objeción|incidente civil/i);
 }
});

test('the settled clock rejects forged objection evidence before spending time',()=>{
 const start=preparedConductArena().start,first=syncBattleTime(start.campaign,start.battle);
 assert.equal(first.error,null);const settled=syncBattleTime(first.campaign,first.battle);assert.equal(settled.error,null);
 assert.equal(settled.campaign.sectors,first.campaign.sectors,'the neutral checkpoint uses the settled clock');
 const forged=structuredClone(settled.battle);conductWitness(forged).serviceObjection={kind:'civilian-killing',civilianKey:'npc-local-buenos_aires',attackerId:'100'};
 const before=structuredClone({campaign:settled.campaign,battle:forged}),denied=syncBattleTime(settled.campaign,forged);
 assert.match(denied.error,/objeción|incidente civil/i);assert.equal(denied.campaign,settled.campaign);assert.equal(denied.battle,forged);
 assert.deepEqual({campaign:settled.campaign,battle:forged},before);
});

test('a saved resume cannot authorize its own unsupported receipt or discard an unreturned event',()=>{
 const start=preparedConductArena().start,forged=structuredClone(start);
 forged.campaign.pendingBattle.resumeSnapshot=structuredClone(forged.battle);
 conductWitness(forged.campaign.pendingBattle.resumeSnapshot).serviceObjection={kind:'civilian-killing',civilianKey:'npc-local-buenos_aires',attackerId:'100'};
 const clock=pair=>({type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:pair.battle.elapsedSeconds});
 atomicDenial(forged,clock(forged));atomicDenial(forged,report(forged));
 assert.throws(()=>decodeSave(encodeSave(forged.campaign,forged.battle)),/objeción|incidente civil/i);
 const sameResume=structuredClone(forged);sameResume.battle=structuredClone(sameResume.campaign.pendingBattle.resumeSnapshot);
 atomicDenial(sameResume,report(sameResume));
 const earned=performConductEvent(start).pair;earned.campaign.pendingBattle.resumeSnapshot=structuredClone(earned.battle);
 assert.doesNotThrow(()=>decodeSave(encodeSave(earned.campaign,earned.battle)));
 atomicDenial(earned,clock(earned));
 assert.equal(dispatchCampaign(earned.campaign,report(earned)).lastError,null);
});

test('settled campaign evidence cannot silently remove or replace a conduct objection',()=>{
 const returned=executePaidConductRoute(preparedConductArena().start).returned;
 assert.ok(returned.operativeState[107].serviceObjection);
 for(const edit of [
  campaign=>delete campaign.operativeState[107].serviceObjection,
  campaign=>campaign.operativeState[107].serviceObjection.attackerId='107',
  campaign=>delete campaign.civilianState.people['npc-local-buenos_aires'],
 ]){
  const invalid=structuredClone(returned);edit(invalid);
  assert.throws(()=>decodeSave(encodeSave(invalid)),/objeción|incidente civil|habitantes|lealtad/i);
 }
});

test('a real paid local recruit joins observation authority and can sync, save and return',()=>{
 const content=localPackage();content.characters.find(person=>person.id==='alma-contract').abilities=['civilian_conscience'];
 const before=readyLocal(undefined,content),npc=localNPC(before.battle),cash=before.campaign.resources.treasury;
 assert.equal(before.battle.conductObserverIds,undefined);
 const campaign=order(before.campaign,talk(before,'day')),id=localId(campaign),issued=campaign.pendingBattle.squad.find(actor=>actor.id===id);
 assert.equal(campaign.resources.treasury,cash-60);assert.equal(campaign.contracts[id].kind,'paid');
 const battle=structuredClone(before.battle),joined={...createBattle([issued],{width:battle.width,height:battle.height,exploration:true,enemies:[]}).units[0],x:npc.x,y:npc.y};
 battle.npcs=battle.npcs.filter(person=>person.id!==npc.id);battle.units.push(joined);addIssuedConductObserver(battle,joined);
 assert.deepEqual(battle.conductObserverIds,[id]);
 let actual=saved({campaign,battle});
 const looked=actBattle(actual.battle,{type:'look',unitId:String(id),x:Math.max(0,joined.x-1),y:joined.y});assert.equal(looked.lastError,null);
 const synced=syncBattleTime(actual.campaign,looked);assert.equal(synced.error,null);actual=saved({campaign:synced.campaign,battle:synced.battle});
 const returned=saved({campaign:leave(actual)}).campaign;
 assert.equal(returned.resources.treasury,cash-60);assert.equal(returned.operativeState[id].serviceObjection,undefined);
 assert.equal(returned.contracts[id].kind,'paid');assert.equal(returned.operativeState[id].hp,npc.hp);
});

test('a real conversation retains an unreturned objection before it acknowledges civilian death',()=>{
 let pair=preparedConductArena({nearbyContact:true}).start;
 pair=conductStep(pair,{type:'weapon',unitId:'100',slot:'blade'});
 const strike={type:'melee',unitId:'100',targetId:'local-buenos_aires',targetKind:'npc'};
 for(let n=0;n<3;n++)pair=conductStep(pair,strike);
 assert.equal(conductCivilian(pair.battle).hp,4);
 const battle=actBattle(pair.battle,strike);assert.equal(battle.lastError,null);assert.ok(conductWitness(battle).serviceObjection);
 const campaign=order(pair.campaign,{type:'talkNPC',npcId:'dorrego',approach:'friendly',unitId:107,sectorState:battle});
 assert.equal(campaign.conversations.dorrego.met,true);
 assert.deepEqual(campaign.pendingBattle.squad.find(actor=>actor.id===107).serviceObjection,conductWitness(battle).serviceObjection);
 assert.equal(campaign.civilianState.people['npc-local-buenos_aires'].health.hp,0);
 const sync=syncBattleTime(campaign,battle);assert.equal(sync.error,null);
 const resumed=saved({campaign:sync.campaign,battle:sync.battle});assert.deepEqual(conductWitness(resumed.battle).serviceObjection,conductWitness(battle).serviceObjection);
 assert.equal(resumed.campaign.operativeState[107].serviceObjection,undefined,'the accepted term continues without an invented early return');
});
