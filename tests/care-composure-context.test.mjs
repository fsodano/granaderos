import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(campaign,action)=>{
 const next=dispatchCampaign(campaign,action);
 assert.equal(next.lastError,null,next.lastError);
 return next;
};
function visit({older=false}={}){
 const content=defaultContentPackage();
 if(older)delete content.characters.find(person=>person.id==='person-130').abilities;
 let campaign=order(initialCampaign(42,content),{type:'recruitCivic',id:130,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});
 campaign=order(campaign,{type:'visitSector'});
 return decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));
}
const doctor=battle=>battle.units.find(unit=>unit.id==='130');
function report(pair,type){
 return {type,battleId:pair.campaign.pendingBattle.id,elapsedSeconds:pair.battle.elapsedSeconds,
  sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')};
}
function rejectsAtomically(pair,type){
 const before=structuredClone(pair.campaign),next=dispatchCampaign(pair.campaign,report(pair,type));
 assert.match(next.lastError,/habilidades/);
 assert.deepEqual({...next,lastError:null},before,'rejected capabilities cannot alter time, money, health or custody');
}

test('clock and return admit only the caregiver capability pinned to this campaign',()=>{
 const start=visit();
 assert.ok(doctor(start.battle).abilities.includes('care_composure'));
 assert.equal(dispatchCampaign(start.campaign,report(start,'syncTacticalTime')).lastError,null);
 assert.equal(dispatchCampaign(start.campaign,report(start,'leaveSector')).lastError,null);
 for(const change of [
  unit=>delete unit.abilities,
  unit=>unit.abilities=[],
  unit=>unit.abilities.push('quick_shot'),
  unit=>unit.abilities.push('care_composure'),
 ]){
  const invalid=structuredClone(start);change(doctor(invalid.battle));
  rejectsAtomically(invalid,'syncTacticalTime');
  rejectsAtomically(invalid,'leaveSector');
  assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)),/habilidades/);
 }
});

test('the settled clock fast path rejects a forged capability before changing either state',()=>{
 const start=visit(),first=syncBattleTime(start.campaign,start.battle);
 assert.equal(first.error,null);
 const settled=syncBattleTime(first.campaign,first.battle);
 assert.equal(settled.error,null);
 assert.equal(settled.campaign.sectors,first.campaign.sectors,'this ordinary clock checkpoint uses the settled path');
 const forged=structuredClone(settled.battle);doctor(forged).abilities=[];
 const before=structuredClone({campaign:settled.campaign,battle:forged});
 const denied=syncBattleTime(settled.campaign,forged);
 assert.match(denied.error,/habilidades/);
 assert.equal(denied.campaign,settled.campaign);
 assert.equal(denied.battle,forged);
 assert.deepEqual({campaign:settled.campaign,battle:forged},before);
});

test('an older pinned caregiver definition stays neutral through sync, save and return',()=>{
 const older=visit({older:true});
 assert.equal(doctor(older.battle).abilities,undefined);
 const synced=syncBattleTime(older.campaign,older.battle);
 assert.equal(synced.error,null);
 assert.equal(doctor(decodeSave(encodeSave(synced.campaign,synced.battle)).battle).abilities,undefined);
 const returned=order(older.campaign,report(older,'leaveSector'));
 assert.equal(returned.resources.treasury,older.campaign.resources.treasury);
 assert.deepEqual(returned.contracts,older.campaign.contracts);
 const reopened=order(returned,{type:'visitSector'});
 assert.equal(doctor(enterSector(reopened.pendingBattle,returned.sectorStates.retiro)).abilities,undefined);
 const forged=structuredClone(older);doctor(forged.battle).abilities=['care_composure'];
 rejectsAtomically(forged,'syncTacticalTime');
 rejectsAtomically(forged,'leaveSector');
});

test('stored resume capabilities are validated before restoration or any action can discard them',()=>{
 const pair=visit();pair.campaign.pendingBattle.resumeSnapshot=structuredClone(pair.battle);
 assert.doesNotThrow(()=>decodeSave(encodeSave(pair.campaign,pair.battle)));
 const clock={type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:pair.battle.elapsedSeconds};
 assert.equal(order(pair.campaign,clock).pendingBattle.resumeSnapshot,undefined);
 for(const change of [unit=>delete unit.abilities,unit=>unit.abilities.push('quick_shot')]){
  const invalid=structuredClone(pair);change(doctor(invalid.campaign.pendingBattle.resumeSnapshot));
  assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)),/habilidades/);
  const before=structuredClone(invalid.campaign),denied=dispatchCampaign(invalid.campaign,clock);
  assert.match(denied.lastError,/habilidades/);
  assert.deepEqual({...denied,lastError:null},before);
  rejectsAtomically(invalid,'leaveSector');
  const synced=syncBattleTime(invalid.campaign,invalid.battle);
  assert.match(synced.error,/habilidades/);
  assert.equal(synced.campaign,invalid.campaign);assert.equal(synced.battle,invalid.battle);
 }
 const older=visit({older:true});older.campaign.pendingBattle.resumeSnapshot=structuredClone(older.battle);
 assert.doesNotThrow(()=>decodeSave(encodeSave(older.campaign,older.battle)));
 assert.equal(order(older.campaign,{...clock,battleId:older.campaign.pendingBattle.id}).pendingBattle.resumeSnapshot,undefined);
});
