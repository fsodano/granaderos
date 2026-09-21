import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {applyCivilianHarm,civilianIncidents} from '../game/civilian-harm.js';
import {migrateCivilianHealth} from '../game/civilian-health.js';
import {hasPendingCivilianHarm} from '../game/campaign-civilian-harm.js';
import {encountersFor} from '../game/encounters.js';
import {YATASTO_NPCS} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const act=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const sync=(campaign,battle)=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null,pair.error);return pair;};
const npc=battle=>battle.npcs.find(n=>n.id==='sosa');
const record=campaign=>Object.values(campaign.civilianHarm.records).find(row=>row.npcId==='sosa');
const aid=battle=>act(battle,{type:'useItem',unitId:'112',targetId:'sosa',targetKind:'npc'});
const finish=(campaign,battle)=>order(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
function visit(){
 let campaign=initialCampaign(8);campaign.sectors.buenos_aires.owner='patriot'; // Local liberation checkpoint; no resources or skills changed.
 const cash=campaign.resources.treasury,stock=campaign.merchants.retiro.supplies.medkits;
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign=order(campaign,{type:'purchaseMedicalSupplies',operativeId:112,quantity:1});
 assert.equal(campaign.resources.treasury,cash-campaign.contracts[112].paid-30);assert.equal(campaign.merchants.retiro.supplies.medkits,stock-1);
 campaign=order(campaign,{type:'travel',sector:'buenos_aires'});campaign=order(campaign,{type:'visitSector'});
 const request=campaign.pendingBattle;
 // Keep all real residents and issued supplies in a compact, open aid area.
 let battle=createBattle(request.squad.map(u=>({...u,x:2,y:2})),{...request,width:12,height:10,props:[],enemies:[],tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),npcs:request.npcs.map((n,i)=>({...n,x:n.id==='sosa'?3:8,y:n.id==='sosa'?2:5+i}))});
 battle=act(battle,{type:'weapon',unitId:'112',slot:'medical'});
 return {campaign,battle};
}
function critical(battle){applyCivilianHarm(battle,npc(battle),{source:battle.units[0],damage:npc(battle).hp-1,intentional:true});}
function legacySave(campaign,battle){
 const raw=JSON.parse(encodeSave(campaign,battle));delete raw.campaign.civilianHealthVersion;raw.campaign.civilianHarm.version=1;
 for(const row of Object.values(raw.campaign.civilianHarm.records))delete row.hpRestored;
 const owners=[raw.battle,raw.campaign.pendingBattle,...Object.values(raw.campaign.sectorStates),...Object.values(raw.campaign.sceneStates)].filter(Boolean);
 for(const owner of owners)for(const n of owner.npcs??[]){const max=n.maxHp??100;if(n.hp>0)n.hp=100-(max-n.hp);delete n.maxHp;delete n.civilianHealthVersion;}
 return raw;
}

test('two paid strokes stabilize a named civilian on the service scale exactly once through save, reentry and hire',()=>{
 let {campaign,battle}=visit();assert.equal(npc(battle).hp,campaign.operativeState[100].maxHp);critical(battle);
 const receipts=structuredClone(civilianIncidents(npc(battle))),energy=npc(battle).energy,linen=battle.units[0].medkits;
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[100].hp,1);
 battle=aid(battle);assert.equal(npc(battle).hp,11);assert.equal(npc(battle).civilianFirstAid.hpRestored,10);assert.equal(npc(battle).unconscious,true);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[100].hp,11);assert.equal(record(campaign).hpRestored,10);
 ({campaign,battle}=decodeSave(encodeSave(campaign,battle)));
 const partial=structuredClone(campaign);({campaign,battle}=sync(campaign,battle));assert.deepEqual(campaign,partial);
 battle=aid(battle);assert.equal(npc(battle).hp,15);assert.equal(npc(battle).civilianFirstAid.hpRestored,14);assert.equal(npc(battle).unconscious,false);assert.equal(npc(battle).energy,energy);
 assert.equal(npc(battle).stance,'prone');assert.equal(battle.units[0].medkits,linen-2);assert.deepEqual(civilianIncidents(npc(battle)),receipts);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[100].hp,15);assert.equal(campaign.operativeState[100].bandaged,npc(battle).maxHp-15);assert.equal(record(campaign).hpRestored,14);
 const stable=structuredClone(campaign);({campaign,battle}=sync(campaign,battle));assert.deepEqual(campaign,stable);
 const redundant=actBattle(battle,{type:'useItem',unitId:'112',targetId:'sosa',targetKind:'npc'});assert.ok(redundant.lastError);assert.equal(redundant.units[0].medkits,linen-2);
 campaign=finish(campaign,battle);campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle).hp,15);assert.equal(npc(battle).civilianFirstAid.hpRestored,14);assert.equal(campaign.operativeState[100].hp,15);
 const refusal=dispatchCampaign(campaign,{type:'talkNPC',unitId:112,npcId:'sosa',approach:'friendly',sectorState:battle});assert.match(refusal.lastError,/Me heriste/);
 campaign=finish(campaign,battle);const cash=campaign.resources.treasury;campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.resources.treasury,cash-campaign.contracts[100].paid);assert.equal(campaign.operativeState[100].hp,15);assert.equal(record(campaign).transferredTo,100);
 assert.doesNotThrow(()=>decodeSave(encodeSave(campaign)));
});

test('an acknowledged stabilization cannot be removed, repeated, or used to hide a later injury',()=>{
 let {campaign,battle}=visit();critical(battle);({campaign,battle}=sync(campaign,battle));battle=aid(battle);({campaign,battle}=sync(campaign,battle));
 const raw=JSON.parse(encodeSave(campaign,battle));
 for(const change of [n=>delete n.civilianFirstAid,n=>n.civilianFirstAid.hpRestored=9,n=>n.civilianFirstAid.version=2,n=>n.civilianFirstAid.extra=true,n=>n.civilianFirstAid.hpRestored=-1,n=>n.civilianFirstAid.hpRestored=Infinity,n=>n.maxHp=100,n=>delete n.civilianHealthVersion,n=>{delete n.civilianHealthVersion;delete n.maxHp;},n=>n.hp=12,n=>{n.hp=40;n.civilianFirstAid.hpRestored=39;n.bleeding=0;n.bandaged=n.maxHp-40;n.unconscious=false;delete n.bleedSource;}]){
  const bad=structuredClone(raw);change(npc(bad.battle));assert.throws(()=>decodeSave(JSON.stringify(bad)));assert.ok(syncBattleTime(campaign,bad.battle).error);
 }
 for(const change of [c=>delete c.civilianHarm,c=>delete c.civilianHealthVersion,c=>c.civilianHealthVersion=2,c=>c.civilianHarm.version=1,c=>delete record(c).hpRestored]){const bad=structuredClone(raw);change(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 applyCivilianHarm(battle,npc(battle),{source:battle.units[0],damage:2,intentional:true});({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[100].hp,9);assert.equal(record(campaign).hpRestored,10);
 const replay=structuredClone(raw.battle);assert.ok(syncBattleTime(campaign,replay).error,'an old higher-HP snapshot has no new paid gain');
 battle=aid(battle);({campaign,battle}=sync(campaign,battle));assert.equal(npc(battle).hp,15);assert.equal(campaign.operativeState[100].hp,15);assert.equal(record(campaign).hpRestored,16);
});

test('legacy implicit health migrates once with unchanged harm receipts in a live save and a direct sector return',()=>{
 let {campaign,battle}=visit();applyCivilianHarm(battle,npc(battle),{source:battle.units[0],damage:20,intentional:true});({campaign,battle}=sync(campaign,battle));
 const raw=legacySave(campaign,battle),incident=npc(raw.battle).civilianHarm.incidents[0];
 // Old receipts used the old 100-point body, even though service had already
 // preserved its missing 20 HP. Those historical numbers must remain exact.
 incident.hpBefore=100;incident.hpAfter=80;record(raw.campaign).incidents[0]=structuredClone(incident);
 const oldReceipts=structuredClone(civilianIncidents(npc(raw.battle))),loaded=decodeSave(JSON.stringify(raw));
 assert.equal(npc(loaded.battle).maxHp,70);assert.equal(npc(loaded.battle).hp,50);assert.equal(loaded.campaign.operativeState[100].hp,50);assert.deepEqual(civilianIncidents(npc(loaded.battle)),oldReceipts);
 assert.deepEqual(decodeSave(encodeSave(loaded.campaign,loaded.battle)),loaded);
 const old=structuredClone(raw.battle),entered=enterSector(loaded.campaign.pendingBattle,old);
 assert.equal(npc(entered).hp,50);assert.equal(npc(entered).maxHp,70);assert.deepEqual(civilianIncidents(npc(entered)),oldReceipts);
 campaign=finish(loaded.campaign,loaded.battle);const saved=restoreCampaign(JSON.stringify(campaign));assert.equal(saved.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa').hp,50);
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

test('legacy archived civilian bodies do not acquire a later soldier death during migration',()=>{
 let {campaign,battle}=visit();applyCivilianHarm(battle,npc(battle),{source:battle.units[0],damage:20,intentional:true});battle=aid(battle);({campaign,battle}=sync(campaign,battle));campaign=finish(campaign,battle);
 const civilianHp=campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa').hp;
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});campaign=order(campaign,{type:'travel',sector:'retiro'});campaign=order(campaign,{type:'visitSector'});
 const request=campaign.pendingBattle;
 // The later soldier death is the casualty fixture input. Normal reporting
 // retains the older, already transferred Buenos Aires civilian snapshot.
 battle=createBattle(request.squad.map((u,i)=>({...u,x:2,y:2+i,...(Number(u.id)===100?{hp:0,bleeding:0}:{})})),{...request});
 campaign=finish(campaign,battle);assert.equal(campaign.operativeState[100].alive,false);assert.equal(record(campaign).transferredTo,100);
 const archived=campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa');assert.equal(archived.hp,civilianHp);assert.ok(!civilianIncidents(archived).some(event=>event.kind==='death'));
 const raw=legacySave(campaign,null),loaded=decodeSave(JSON.stringify(raw)).campaign;
 assert.equal(loaded.operativeState[100].hp,0);assert.equal(loaded.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa').hp,civilianHp);assert.deepEqual(civilianIncidents(loaded.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa')),civilianIncidents(archived));
 assert.deepEqual(decodeSave(encodeSave(loaded)).campaign,loaded);
});

test('older stable named wounds migrate without fictional bleeding or retrospective blame',()=>{
 let {campaign,battle}=visit();({campaign,battle}=sync(campaign,battle));const old=legacySave(campaign,battle);npc(old.battle).hp=80;
 const loaded=decodeSave(JSON.stringify(old));assert.equal(npc(loaded.battle).hp,50);assert.equal(npc(loaded.battle).bleeding,undefined);assert.deepEqual(civilianIncidents(npc(loaded.battle)),[]);
 const pair=sync(loaded.campaign,loaded.battle);assert.equal(pair.campaign.operativeState[100].hp,50);assert.equal(pair.campaign.operativeState[100].bleeding,0);assert.equal(pair.campaign.cityLoyaltyEvents.length,0);assert.doesNotThrow(()=>decodeSave(encodeSave(pair.campaign,pair.battle)));
});

test('later soldier health training preserves the retired civilian body and allows a repeated save',()=>{
 let {campaign,battle}=visit();applyCivilianHarm(battle,npc(battle),{source:battle.units[0],damage:20,intentional:true});battle=aid(battle);
 ({campaign,battle}=sync(campaign,battle));campaign=finish(campaign,battle);campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});
 const archived=structuredClone(campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa')),maximum=campaign.operativeState[100].maxHp;
 campaign=order(campaign,{type:'assignWork',operativeId:100,assignment:'practice',skill:'maxHp'});
 // Prior accumulated practice; the last point requires one actual study hour.
 Object.assign(campaign.operativeState[100],{skillPractice:{maxHp:39},trainingCredit:999});campaign=restoreCampaign(JSON.stringify(campaign));
 campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.operativeState[100].maxHp,maximum+1);
 assert.deepEqual(campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa'),archived);
 const loaded=decodeSave(encodeSave(campaign));assert.equal(loaded.campaign.operativeState[100].maxHp,maximum+1);
 assert.deepEqual(loaded.campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa'),archived);
 assert.deepEqual(decodeSave(encodeSave(loaded.campaign)),loaded);
});

test('a pristine contact can train in service, leave it and return on the current health scale',()=>{
 let {campaign,battle}=visit();({campaign,battle}=sync(campaign,battle));campaign=finish(campaign,battle);
 const archived=structuredClone(campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa'));
 assert.equal(archived.civilianWoundVersion,undefined);assert.equal(record(campaign),undefined);
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});
 campaign=order(campaign,{type:'assignWork',operativeId:100,assignment:'practice',skill:'maxHp'});
 // Prior practice is fixture input; the final point uses an ordinary study hour.
 Object.assign(campaign.operativeState[100],{skillPractice:{maxHp:39},trainingCredit:999});campaign=restoreCampaign(JSON.stringify(campaign));
 campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.operativeState[100].maxHp,archived.maxHp+1);
 campaign=order(campaign,{type:'dismiss',id:100});assert.equal(record(campaign),undefined);
 assert.deepEqual(campaign.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa'),archived);
 campaign=decodeSave(encodeSave(campaign)).campaign;
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle).maxHp,campaign.operativeState[100].maxHp);assert.equal(npc(battle).hp,campaign.operativeState[100].hp);
 assert.equal(npc(battle).civilianWoundVersion,undefined);assert.deepEqual(civilianIncidents(npc(battle)),[]);
 ({campaign,battle}=sync(campaign,battle));assert.doesNotThrow(()=>decodeSave(encodeSave(campaign,battle)));
});
