import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSaveTerrain} from '../game/save-terrain.js';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {applyCivilianHarm,civilianIncidents} from '../game/civilian-harm.js';
import {migrateCivilianHealth} from '../game/civilian-health.js';
import {encountersFor} from '../game/encounters.js';
import {YATASTO_NPCS} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {PATIENT,PATIENT_ID,order,act,sync,saved,npc,record,aid,finish,paidVisit as visit,wound,hirePatient} from './campaign-medical-fixture.mjs';

const critical=(battle,source='player')=>wound(battle,{damage:npc(battle).hp-1,source});
const restored=campaign=>record(campaign).health.civilianFirstAid?.hpRestored??0;
function legacySave(campaign,battle){
 const raw=JSON.parse(encodeSave(campaign,battle));delete raw.campaign.civilianState;
 const owners=[raw.battle,raw.campaign.pendingBattle,...Object.values(raw.campaign.sectorStates),...Object.values(raw.campaign.sceneStates)].filter(Boolean);
 for(const owner of owners)for(const n of owner.npcs??[]){const max=n.maxHp??100;if(n.hp>0)n.hp=100-(max-n.hp);delete n.maxHp;delete n.civilianHealthVersion;}
 return raw;
}

test('two finite strokes stabilize a critical resident exactly once through save and reentry without erasing refusal',()=>{
 let {campaign,battle}=visit();assert.equal(npc(battle).hp,campaign.operativeState[PATIENT_ID].maxHp);critical(battle);
 const receipts=structuredClone(civilianIncidents(npc(battle))),energy=npc(battle).energy,linen=battle.units[0].medkits;
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[PATIENT_ID].hp,1);
 battle=aid(battle);assert.equal(npc(battle).hp,11);assert.equal(npc(battle).civilianFirstAid.hpRestored,10);assert.equal(npc(battle).unconscious,true);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[PATIENT_ID].hp,11);assert.equal(restored(campaign),10);
 ({campaign,battle}=saved({campaign,battle}));const partial=structuredClone(campaign);({campaign,battle}=sync(campaign,battle));assert.deepEqual(campaign,partial);
 battle=aid(battle);assert.equal(npc(battle).hp,15);assert.equal(npc(battle).civilianFirstAid.hpRestored,14);assert.equal(npc(battle).unconscious,false);assert.equal(npc(battle).energy,energy);
 assert.equal(npc(battle).stance,'prone');assert.equal(battle.units[0].medkits,linen-2);assert.deepEqual(civilianIncidents(npc(battle)),receipts);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[PATIENT_ID].hp,15);assert.equal(campaign.operativeState[PATIENT_ID].bandaged,55);assert.equal(restored(campaign),14);
 const stable=structuredClone(campaign);({campaign,battle}=sync(campaign,battle));assert.deepEqual(campaign,stable);
 const redundant=actBattle(battle,{type:'useItem',unitId:'112',targetId:PATIENT,targetKind:'npc'});assert.ok(redundant.lastError);assert.equal(redundant.units[0].medkits,linen-2);
 campaign=saved({campaign:finish(campaign,battle)}).campaign;campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle).hp,15);assert.equal(npc(battle).civilianFirstAid.hpRestored,14);assert.equal(campaign.operativeState[PATIENT_ID].hp,15);
 const refusal=dispatchCampaign(campaign,{type:'talkNPC',unitId:112,npcId:PATIENT,approach:'recruit',term:'week',sectorState:battle});assert.match(refusal.lastError,/Me heriste/);
 assert.equal(refusal.resources.treasury,campaign.resources.treasury);assert.equal(record(refusal).inService,undefined);assert.ok(saved({campaign,battle}));
});

test('stabilized environmental wounds transfer once to paid local service with the same health and finite supplies',()=>{
 let {campaign,battle}=visit();critical(battle,'unknown');({campaign,battle}=sync(campaign,battle));battle=aid(aid(battle));({campaign,battle}=sync(campaign,battle));
 const health=structuredClone(record(campaign).health),linen=battle.units[0].medkits;
 assert.equal(health.hp,15);assert.equal(health.civilianFirstAid.hpRestored,14);assert.deepEqual(civilianIncidents(health),[]);
 ({campaign,battle}=hirePatient(campaign,battle));assert.equal(record(campaign).inService,true);assert.deepEqual(record(campaign).health,health);
 const soldier=battle.units.find(u=>u.id===String(PATIENT_ID));assert.equal(soldier.hp,15);assert.equal(soldier.bleeding,0);assert.equal(soldier.bandaged,55);assert.equal(npc(battle),undefined);assert.equal(battle.units[0].medkits,linen);
 campaign=saved({campaign:finish(campaign,battle)}).campaign;campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle),undefined);assert.equal(battle.units.find(u=>u.id===String(PATIENT_ID)).hp,15);assert.equal(restored(campaign),14);assert.ok(saved({campaign,battle}));
});

test('acknowledged stabilization cannot be removed, repeated, or used to hide a later injury',()=>{
 let {campaign,battle}=visit();critical(battle);({campaign,battle}=sync(campaign,battle));battle=aid(battle);({campaign,battle}=sync(campaign,battle));
 const raw=JSON.parse(encodeSave(campaign,battle));
 for(const change of [n=>delete n.civilianFirstAid,n=>n.civilianFirstAid.hpRestored=9,n=>n.civilianFirstAid.version=2,n=>n.civilianFirstAid.extra=true,n=>n.civilianFirstAid.hpRestored=-1,n=>n.civilianFirstAid.hpRestored=Infinity,n=>n.maxHp=100,n=>delete n.civilianHealthVersion,n=>{delete n.civilianHealthVersion;delete n.maxHp;},n=>n.hp=12,n=>{n.hp=40;n.civilianFirstAid.hpRestored=39;n.bleeding=0;n.bandaged=n.maxHp-40;n.unconscious=false;delete n.bleedSource;}]){
  const bad=structuredClone(raw);change(npc(bad.battle));assert.throws(()=>decodeSave(JSON.stringify(bad)));assert.ok(syncBattleTime(campaign,bad.battle).error);
 }
 for(const change of [c=>c.civilianState.version=3,c=>delete record(c).health.civilianFirstAid,c=>record(c).health.civilianFirstAid.hpRestored=9,c=>record(c).health.hp=12]){const bad=structuredClone(raw);change(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 wound(battle,{damage:2});({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[PATIENT_ID].hp,9);assert.equal(restored(campaign),10);
 assert.ok(syncBattleTime(campaign,structuredClone(raw.battle)).error,'an old higher-HP snapshot has no new paid gain');
 battle=aid(battle);({campaign,battle}=sync(campaign,battle));assert.equal(npc(battle).hp,15);assert.equal(campaign.operativeState[PATIENT_ID].hp,15);assert.equal(restored(campaign),16);
});

test('legacy implicit health migrates once with exact historical harm receipts in a live save and sector return',()=>{
 let {campaign,battle}=visit();wound(battle);({campaign,battle}=sync(campaign,battle));
 const raw=legacySave(campaign,battle);
 // Old receipts described a 100-point body. Preserve those numbers while
 // translating the physical body to this authored 70-point service scale.
 for(const owner of [raw.battle,raw.campaign.pendingBattle,...Object.values(raw.campaign.sectorStates)]){
  const patient=npc(owner);if(patient?.civilianHarm){patient.civilianHarm.incidents[0].hpBefore=100;patient.civilianHarm.incidents[0].hpAfter=80;}
 }
 const receipts=structuredClone(civilianIncidents(npc(raw.battle))),loaded=decodeSave(JSON.stringify(raw));
 const compact=structuredClone(raw);compactSaveTerrain(compact);compact.schema=2;assert.deepEqual(decodeSave(JSON.stringify(compact)),loaded);
 assert.equal(npc(loaded.battle).maxHp,70);assert.equal(npc(loaded.battle).hp,50);assert.equal(loaded.campaign.operativeState[PATIENT_ID].hp,50);assert.deepEqual(civilianIncidents(npc(loaded.battle)),receipts);
 assert.deepEqual(saved(loaded),loaded);const entered=enterSector(loaded.campaign.pendingBattle,structuredClone(raw.battle));
 assert.equal(npc(entered).hp,50);assert.equal(npc(entered).maxHp,70);assert.deepEqual(civilianIncidents(npc(entered)),receipts);
 campaign=finish(loaded.campaign,loaded.battle);const restored=restoreCampaign(JSON.stringify(campaign));assert.equal(npc(restored.sectorStates.buenos_aires).hp,50);
});

test('ordinary and named nonrecruitable residents keep the 100-point scale',()=>{
 assert.equal(migrateCivilianHealth({id:'old-resident',hp:14.5}).hp,14.5,'generic legacy health does not round up for free');
 const campaign=initialCampaign(8),ordinary=encountersFor(campaign,'retiro').find(n=>n.operativeId===undefined);
 assert.equal(ordinary.maxHp,100);assert.equal(ordinary.hp,100);assert.ok(YATASTO_NPCS.every(n=>n.operativeId===undefined));
 const medic={id:'medic',side:'player',name:'Sanitario',x:2,y:2,hp:70,maxHp:70,medical:94,medkits:2,weapon:1800,activeSlot:'medical'};
 for(const resident of [ordinary,YATASTO_NPCS[0]]){
  let battle=createBattle([medic],{width:6,height:6,exploration:true,tiles:Array.from({length:36},(_,i)=>({x:i%6,y:Math.floor(i/6),type:'grass',blocked:false,cover:0})),npcs:[{...resident,x:3,y:2,hp:14.5,energy:100,unconscious:true,stance:'prone',civilianWoundVersion:1,bleeding:0,bandaged:0}]});
  battle=act(battle,{type:'useItem',unitId:'medic',targetId:resident.id,targetKind:'npc'});assert.equal(battle.npcs[0].hp,15);assert.equal(battle.npcs[0].civilianFirstAid.hpRestored,.5);assert.equal(battle.npcs[0].bandaged,85);assert.equal(battle.units[0].medkits,1);
  const forged=structuredClone(battle);Object.assign(forged.npcs[0],{hp:40,unconscious:false,bandaged:60,civilianFirstAid:{version:1,hpRestored:26}});assert.throws(()=>validateBattleSnapshot(forged));
 }
});

test('a later soldier death does not rewrite the retained civilian treatment history or create a second body',()=>{
 let {campaign,battle}=visit();wound(battle,{source:'unknown'});battle=aid(battle);({campaign,battle}=sync(campaign,battle));
 const civilianHealth=structuredClone(record(campaign).health);({campaign,battle}=hirePatient(campaign,battle));
 campaign=finish(campaign,battle);campaign=order(campaign,{type:'travel',sector:'retiro'});campaign=order(campaign,{type:'visitSector'});
 const request=campaign.pendingBattle;
 // The later soldier death is the casualty input, reported through the
 // regular tactical boundary. It must not become a second civilian death.
 battle=createBattle(request.squad.map((u,i)=>({...u,x:2,y:2+i,...(Number(u.id)===PATIENT_ID?{hp:0,bleeding:0}:{})})),{...request});
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 campaign=finish(campaign,battle);assert.equal(campaign.operativeState[PATIENT_ID].alive,false);assert.equal(record(campaign).inService,true);
 assert.deepEqual(record(campaign).health,civilianHealth);assert.equal(npc(campaign.sectorStates.buenos_aires),undefined);
 const loaded=saved({campaign}).campaign;assert.equal(loaded.operativeState[PATIENT_ID].hp,0);assert.deepEqual(record(loaded).health,civilianHealth);assert.deepEqual(saved({campaign:loaded}).campaign,loaded);
});

test('older stable named wounds migrate without fictional bleeding or retrospective blame',()=>{
 let {campaign,battle}=visit();({campaign,battle}=sync(campaign,battle));const old=legacySave(campaign,battle);npc(old.battle).hp=80;
 const loaded=decodeSave(JSON.stringify(old));assert.equal(npc(loaded.battle).hp,50);assert.equal(npc(loaded.battle).bleeding,undefined);assert.deepEqual(civilianIncidents(npc(loaded.battle)),[]);
 const pair=sync(loaded.campaign,loaded.battle);assert.equal(pair.campaign.operativeState[PATIENT_ID].hp,50);assert.equal(pair.campaign.operativeState[PATIENT_ID].bleeding,0);assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);assert.ok(saved(pair));
});

function practiceHealth(campaign){
 campaign=order(campaign,{type:'assignWork',operativeId:PATIENT_ID,assignment:'practice',skill:'maxHp'});
 // Prior accumulated practice is input; the last point uses a real hour.
 Object.assign(campaign.operativeState[PATIENT_ID],{skillPractice:{maxHp:39},trainingCredit:999});campaign=restoreCampaign(JSON.stringify(campaign));
 return order(campaign,{type:'wait',hours:1});
}

test('later soldier health training preserves the retired civilian history through repeated saves',()=>{
 let {campaign,battle}=visit();wound(battle,{source:'unknown'});battle=aid(battle);({campaign,battle}=sync(campaign,battle));({campaign,battle}=hirePatient(campaign,battle));campaign=finish(campaign,battle);
 const historical=structuredClone(record(campaign)),maximum=campaign.operativeState[PATIENT_ID].maxHp;
 campaign=practiceHealth(campaign);assert.equal(campaign.operativeState[PATIENT_ID].maxHp,maximum+1);assert.deepEqual(record(campaign),historical);
 const loaded=saved({campaign});assert.equal(loaded.campaign.operativeState[PATIENT_ID].maxHp,maximum+1);assert.deepEqual(record(loaded.campaign),historical);assert.deepEqual(saved(loaded),loaded);
});

test('a pristine local contact can train in service and return on the current health scale',()=>{
 let {campaign,battle}=visit();({campaign,battle}=sync(campaign,battle));const before=structuredClone(npc(battle));
 assert.equal(before.civilianWoundVersion,undefined);assert.deepEqual(civilianIncidents(record(campaign).health),[]);
 ({campaign,battle}=hirePatient(campaign,battle));campaign=finish(campaign,battle);campaign=practiceHealth(campaign);
 assert.equal(campaign.operativeState[PATIENT_ID].maxHp,before.maxHp+1);
 campaign=order(campaign,{type:'dismiss',id:PATIENT_ID});campaign=saved({campaign}).campaign;assert.deepEqual(saved({campaign}).campaign,campaign);
 campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle).maxHp,campaign.operativeState[PATIENT_ID].maxHp);assert.equal(npc(battle).hp,campaign.operativeState[PATIENT_ID].hp);
 assert.deepEqual(civilianIncidents(npc(battle)),[]);assert.equal(record(campaign).inService,undefined);({campaign,battle}=sync(campaign,battle));assert.ok(saved({campaign,battle}));
});
