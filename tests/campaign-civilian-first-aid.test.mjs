import test from 'node:test';
import assert from 'node:assert/strict';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {dispatchCampaign} from '../game/campaign.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {hasPendingCivilianHarm} from '../game/campaign-civilian-harm.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {PATIENT,PATIENT_ID,order,act,sync,saved,npc,record,aid,finish,paidVisit,wound,hirePatient} from './campaign-medical-fixture.mjs';

const save=campaign=>saved({campaign}).campaign;
function repeatSync(campaign,battle){
 const before=structuredClone(campaign),again=sync(campaign,battle);
 assert.deepEqual(again.campaign,before,'repeated medical sync does not subtract wounds or consume supplies again');return again;
}
const revisit=campaign=>{campaign=order(campaign,{type:'visitSector'});return {campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location])};};

test('paid first aid keeps player-inflicted wounds and refusal through save and reentry',()=>{
 let {campaign,battle}=paidVisit();wound(battle);
 assert.equal(npc(battle).hp,50);assert.equal(npc(battle).bleeding,2);assert.equal(npc(battle).bandaged,0);
 assert.equal(Object.hasOwn(playerKnownBattle(battle).npcs.find(n=>n.id===PATIENT),'bleedSource'),false);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[PATIENT_ID].hp,50);assert.equal(campaign.operativeState[PATIENT_ID].bleeding,2);
 ({campaign,battle}=repeatSync(campaign,battle));
 const before=structuredClone(npc(battle)),supplies=battle.units[0].medkits,loyalty=campaign.sectors.buenos_aires.loyalty;
 battle=aid(battle);
 assert.equal(npc(battle).hp,before.hp);assert.equal(npc(battle).energy,before.energy);assert.equal(npc(battle).unconscious,before.unconscious);
 assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bandaged,20);assert.equal(npc(battle).bleedSource,undefined);assert.equal(npc(battle).civilianWoundVersion,1);
 assert.equal(battle.units[0].medkits,supplies-1);assert.deepEqual(civilianIncidents(npc(battle)),civilianIncidents(before));
 assert.equal(hasPendingCivilianHarm(campaign,battle),true);
 ({campaign,battle}=sync(campaign,battle));({campaign,battle}=repeatSync(campaign,battle));
 assert.equal(campaign.operativeState[PATIENT_ID].hp,50);assert.equal(campaign.operativeState[PATIENT_ID].bleeding,0);assert.equal(campaign.operativeState[PATIENT_ID].bandaged,20);
 assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty);assert.equal(campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);
 ({campaign,battle}=saved({campaign,battle}));campaign=save(finish(campaign,battle));assert.equal(campaign.operativeState[112].medkits,supplies-1);
 ({campaign,battle}=revisit(campaign));assert.equal(npc(battle).hp,50);assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bandaged,20);
 for(const approach of ['friendly','recruit']){
  const before=structuredClone(campaign),refusal=dispatchCampaign(campaign,{type:'talkNPC',unitId:112,npcId:PATIENT,approach,term:'week',sectorState:battle});
  assert.match(refusal.lastError,/Me heriste/);assert.deepEqual({...refusal,lastError:null},before);
 }
 campaign=finish(campaign,battle);assert.ok(dispatchCampaign(campaign,{type:'recruitCivic',id:PATIENT_ID,term:'week'}).lastError,'the bulletin cannot bypass a local refusal');
 assert.equal(record(campaign).inService,undefined);assert.deepEqual(civilianIncidents(record(campaign).health),civilianIncidents(before));
});

test('unattributed wounds survive local hiring, dismissal and rehire without invented blame or healing',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{source:'unknown'});
 ({campaign,battle}=sync(campaign,battle));({campaign,battle}=repeatSync(campaign,battle));
 assert.equal(campaign.operativeState[PATIENT_ID].hp,50);assert.equal(campaign.operativeState[PATIENT_ID].bleeding,2);assert.equal(campaign.operativeState[PATIENT_ID].bandaged,0);
 assert.deepEqual(civilianIncidents(record(campaign).health),[]);assert.equal(campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);
 ({campaign,battle}=saved({campaign,battle}));({campaign,battle}=hirePatient(campaign,battle));
 const health=structuredClone(campaign.operativeState[PATIENT_ID]);assert.equal(record(campaign).inService,true);
 assert.equal(health.hp,50);assert.equal(health.bleeding,2);assert.equal(health.bandaged,0);assert.equal(npc(battle),undefined);
 assert.equal(battle.units.find(u=>u.id===String(PATIENT_ID)).hp,health.hp);
 campaign=save(finish(campaign,battle));campaign=order(campaign,{type:'dismiss',id:PATIENT_ID});campaign=save(campaign);
 ({campaign,battle}=revisit(campaign));assert.equal(npc(battle).hp,health.hp);assert.equal(npc(battle).bleeding,2);assert.equal(npc(battle).bandaged,0);
 assert.equal(record(campaign).inService,undefined);assert.deepEqual(civilianIncidents(npc(battle)),[]);
 // Rehiring requires a real local conversation. Any elapsed approach time
 // must retain its damage; it cannot restore the earlier healthier snapshot.
 ({campaign,battle}=hirePatient(campaign,battle));assert.ok(campaign.operativeState[PATIENT_ID].hp<=health.hp);
 assert.equal(campaign.operativeState[PATIENT_ID].bleeding,2);assert.equal(campaign.operativeState[PATIENT_ID].bandaged,0);
 assert.equal(campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);assert.ok(saved({campaign,battle}));
});

test('first aid to an ordinary resident persists without a service record or health gain',()=>{
 let {campaign,battle}=paidVisit({sector:'retiro',target:'local-retiro'});wound(battle,{target:'local-retiro',source:'unknown'});
 const hp=npc(battle,'local-retiro').hp,treasury=campaign.resources.treasury;
 battle=act(battle,{type:'useItem',unitId:'112',targetId:'local-retiro',targetKind:'npc'});({campaign,battle}=sync(campaign,battle));({campaign,battle}=saved({campaign,battle}));
 campaign=save(finish(campaign,battle));({campaign,battle}=revisit(campaign));
 const resident=npc(battle,'local-retiro');assert.equal(resident.hp,hp);assert.equal(resident.bleeding,0);assert.equal(resident.bandaged,100-hp);assert.equal(resident.civilianWoundVersion,1);
 assert.equal(resident.operativeId,undefined);assert.equal(campaign.civilianState.people['npc-local-retiro'].health.hp,hp);
 assert.equal(campaign.resources.treasury,treasury);assert.equal(campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);assert.deepEqual(saved({campaign,battle}),{campaign,battle});
});

test('invalid wounds and altered canonical health reject at save and report boundaries',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{source:'unknown'});({campaign,battle}=sync(campaign,battle));
 const raw=JSON.parse(encodeSave(campaign,battle));
 for(const change of [n=>n.bleeding=-1,n=>n.bleeding=11,n=>n.bleeding=1.5,n=>n.bandaged=-1,n=>n.bandaged=21,n=>n.civilianWoundVersion=2,n=>delete n.civilianWoundVersion,n=>delete n.bleedSource,n=>n.bleedSource.intentional=true,n=>n.bleedSource.extra=true]){
  const bad=structuredClone(raw);change(npc(bad.battle));assert.throws(()=>decodeSave(JSON.stringify(bad)));
  const before=structuredClone(campaign),report=dispatchCampaign(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:bad.battle,survivors:bad.battle.units.filter(u=>u.side==='player')});assert.ok(report.lastError);assert.deepEqual(campaign,before);
 }
 for(const change of [s=>s.civilianState.version=3,s=>record(s).health.hp++,s=>record(s).health.bleeding=0,s=>record(s).extra=true]){const bad=structuredClone(raw);change(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 const treated=aid(battle),pair=sync(campaign,treated),downgraded=JSON.parse(encodeSave(pair.campaign,pair.battle));
 delete npc(downgraded.battle).civilianWoundVersion;assert.throws(()=>decodeSave(JSON.stringify(downgraded)));
 campaign=finish(campaign,battle);const returned=JSON.parse(encodeSave(campaign));
 for(const change of [s=>record(s).health.hp++,s=>npc(s.sectorStates.buenos_aires).bandaged=99]){const bad=structuredClone(returned);change(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
});

test('a delayed civilian death retains its absent attacker across sector reentry exactly once',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{damage:npc(battle).hp-4});({campaign,battle}=sync(campaign,battle));campaign=save(finish(campaign,battle));
 const loyalty=campaign.sectors.buenos_aires.loyalty;campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=order(campaign,{type:'squad',ids:[110]});
 ({campaign,battle}=revisit(campaign));assert.equal(battle.units.some(u=>u.id==='112'),false);assert.equal(npc(battle).bleedSource.attackerId,'112');
 battle=act(battle,{type:'rest'});assert.equal(npc(battle).hp,0);assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bleedSource,undefined);assert.equal(civilianIncidents(npc(battle)).at(-1).attackerId,'112');
 for(const change of [event=>event.attackerId='other-attacker',event=>event.intentional=false]){
  const bad=structuredClone(battle),before=structuredClone(campaign);change(civilianIncidents(npc(bad)).at(-1));assert.ok(syncBattleTime(campaign,bad).error);assert.deepEqual(campaign,before);
 }
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty-10);assert.equal(campaign.operativeState[PATIENT_ID].alive,false);
 ({campaign,battle}=repeatSync(campaign,battle));({campaign,battle}=saved({campaign,battle}));campaign=save(finish(campaign,battle));
 assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty-10);assert.equal(civilianIncidents(record(campaign).health).length,2);
});

test('a former local recruit returns with current soldier wounds and cannot heal from a stale civilian cache',()=>{
 let {campaign,battle}=paidVisit();({campaign,battle}=hirePatient(campaign,battle));
 // A new soldier wound is this scenario input. The report, dismissal and
 // local rehire must preserve the service body instead of the pristine cache.
 Object.assign(battle.units.find(u=>u.id===String(PATIENT_ID)),{hp:60,bleeding:2,bandaged:3});
 campaign=save(finish(campaign,battle));const wounded=structuredClone(campaign.operativeState[PATIENT_ID]);assert.equal(wounded.hp,60);
 campaign=order(campaign,{type:'dismiss',id:PATIENT_ID});({campaign,battle}=revisit(campaign));
 assert.equal(npc(battle).hp,60);assert.equal(npc(battle).civilianWoundVersion,1);assert.equal(npc(battle).bleeding,2);assert.equal(npc(battle).bandaged,3);
 const stale=structuredClone(battle);Object.assign(npc(stale),{hp:70,bleeding:0,bandaged:0});delete npc(stale).bleedSource;
 assert.ok(syncBattleTime(campaign,stale).error);assert.equal(campaign.operativeState[PATIENT_ID].hp,60);
 ({campaign,battle}=sync(campaign,battle));assert.equal(hasPendingCivilianHarm(campaign,battle),false);assert.deepEqual(saved({campaign,battle}),{campaign,battle});
 ({campaign,battle}=hirePatient(campaign,battle));assert.ok(campaign.operativeState[PATIENT_ID].hp<=60);assert.equal(campaign.operativeState[PATIENT_ID].bleeding,2);assert.equal(campaign.operativeState[PATIENT_ID].bandaged,3);
});

test('automatic civilian care retains named health, finite dressings and refusal through campaign saves',()=>{
 let {campaign,battle}=paidVisit();wound(battle);({campaign,battle}=sync(campaign,battle));
 const kits=battle.units[0].medkits,report=autoBandageBattle(battle);
 assert.deepEqual(report.treatedIds,[`npc:${PATIENT}`]);assert.equal(report.untreated.length,0);battle=report.battle;assert.equal(battle.units[0].medkits,kits-1);
 ({campaign,battle}=sync(campaign,battle));({campaign,battle}=repeatSync(campaign,battle));const health=structuredClone(campaign.operativeState[PATIENT_ID]);
 assert.equal(health.bleeding,0);assert.ok(health.bandaged>0);({campaign,battle}=saved({campaign,battle}));
 campaign=save(finish(campaign,battle));({campaign,battle}=revisit(campaign));
 assert.equal(npc(battle).hp,health.hp);assert.equal(npc(battle).bandaged,health.bandaged);assert.ok(civilianIncidents(npc(battle)).some(e=>e.side==='player'));
 assert.equal(battle.units.find(u=>u.id==='112').medkits,kits-1);
 assert.match(dispatchCampaign(campaign,{type:'talkNPC',unitId:112,npcId:PATIENT,approach:'recruit',term:'week',sectorState:battle}).lastError,/Me heriste/);
});
