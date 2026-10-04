import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encountersFor} from '../game/encounters.js';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {civilianIncidents,applyCivilianHarm} from '../game/civilian-harm.js';
import {restForMarch} from './campaign-test-helpers.mjs';
import {approachNPC} from './approach-npc.mjs';
import {missionContacts,sanLorenzoAlly} from '../game/missions.js';
const A='cell-27-27',B='cell-26-27';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=({campaign,battle=null})=>decodeSave(encodeSave(campaign,battle));
function ready(daily=true,medical){
 const d=defaultContentPackage();Object.assign(d.placements.find(p=>p.character==='person-3'),{mode:daily?'daily':'fixed',sectors:daily?[A,B]:[A],selection:daily?'alternate':'random'});
 Object.assign(d.characters.find(c=>c.id==='person-110'),{arrivalHours:0});if(medical!==undefined)d.characters.find(c=>c.id==='person-110').attributes.medical=medical;d.characters.find(c=>c.id==='person-110').attributes.leadership=100;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
 // Start after the first daily move so the planned rural trip does not
 // arrive at the same 04:00 boundary that changes the resident's sector.
 if(daily)s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});
 return order(s,{type:'travel',sector:s.contentPresence.people['person-3'].sector});
}
const visit=s=>{const campaign=order(s,{type:'visitSector'});return{campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour},campaign.sectorStates[campaign.location])};};
const npc=pair=>pair.battle.npcs.find(n=>n.id==='cabral');
const synced=pair=>{const result=syncBattleTime(pair.campaign,pair.battle);assert.equal(result.error,null);return result;};
function act(pair,action){if(action.type==='heal'){pair.battle=actBattle(pair.battle,{type:'weapon',unitId:'110',slot:'medical'});assert.equal(pair.battle.lastError,null);}pair.battle=actBattle(pair.battle,{unitId:'110',...action});assert.equal(pair.battle.lastError,null);return synced(pair);}
function approach(pair,id='cabral'){return synced({campaign:pair.campaign,battle:approachNPC(pair.battle,'110',id)});}
// Explicit environmental injury for transfer tests. Player attacks are kept in
// separate cases and must not permit later recruitment of the victim.
function woundResident(pair){applyCivilianHarm(pair.battle,npc(pair),{damage:24});return synced(pair);}
function leave(pair){pair=synced(pair);return order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});}
const clinical=(npcOverrides={},sector={},unit={})=>createBattle([{id:'doctor',name:'Médico',x:1,y:1,weapon:1809,medical:80,medkits:2,...unit}],{width:8,height:8,enemies:[],exploration:true,npcs:[{id:'patient',name:'Vecino',x:2,y:1,...npcOverrides}],...sector});

test('NPC wounds persist through save, daily relocation, recruitment and a second deployment',()=>{
 let pair=approach(visit(ready()));const max=npc(pair).maxHp;
 pair=woundResident(pair);assert.ok(npc(pair).hp>0&&npc(pair).hp<max);assert.ok(npc(pair).bleeding>0);
 pair=act(pair,{type:'heal',targetId:'cabral'});const hp=npc(pair).hp;assert.equal(npc(pair).bleeding,0);assert.equal(pair.battle.units[0].medkits,1);
 pair=saved(pair);assert.equal(npc(pair).hp,hp);
 let s=leave(pair),old=s.location;assert.equal(s.operativeState[3].hp,hp);
 s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});
 const next=s.contentPresence.people['person-3'].sector;assert.notEqual(next,old);assert.equal(s.sectorStates[old].npcs.length,0);
 s=order(saved({campaign:s}).campaign,{type:'travel',sector:next});pair=approach(visit(s));assert.equal(npc(pair).hp,hp);assert.equal(pair.battle.units[0].medkits,1);
 const at={x:npc(pair).x,y:npc(pair).y};s=order(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:110,approach:'recruit',sectorState:pair.battle});
 const recruit=s.pendingBattle.squad.find(u=>u.id===3);assert.equal(recruit.hp,hp);assert.equal(recruit.bleeding,0);assert.ok(!s.pendingBattle.npcs.some(n=>n.id==='cabral'));
 pair.battle.npcs=pair.battle.npcs.filter(n=>n.id!=='cabral');pair.battle.units.push({...createBattle([recruit],{width:8,height:8,exploration:true,enemies:[]}).units[0],...at});
 pair=saved({campaign:s,battle:pair.battle});s=leave(pair);pair=visit(s);assert.equal(pair.battle.units.find(u=>u.id==='3').hp,hp);assert.ok(!npc(pair));
});

test('death is global, leaves one body in its real cell and cannot be recruited, moved or resurrected',()=>{
 let pair=approach(visit(ready()));pair=act(pair,{type:'weapon',slot:'blade'});for(let i=0;i<8&&npc(pair).hp>0;i++)pair=act(pair,{type:'melee',targetId:'cabral'});
 assert.equal(npc(pair).hp,0);assert.equal(pair.campaign.operativeState[3].alive,false);assert.equal(pair.campaign.contentPresence.people['person-3'].alive,false);
 assert.equal(civilianIncidents(npc(pair)).at(-1).kind,'death');assert.ok(dispatchCampaign(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:110,approach:'recruit',sectorState:pair.battle}).lastError);
 const body={x:npc(pair).x,y:npc(pair).y};pair=saved(pair);let s=leave(pair);pair=visit(saved({campaign:s}).campaign);assert.equal(npc(pair).hp,0);assert.equal(npc(pair).stance,'prone');assert.deepEqual({x:npc(pair).x,y:npc(pair).y},body);
 s=leave(pair);s=order(s,{type:'wait',hours:24});assert.equal(encountersFor(s,s.location===A?B:A).some(n=>n.id==='cabral'),false);
 const wire=JSON.parse(encodeSave(s));wire.campaign.sectorStates[s.location].npcs[0].hp=100;assert.throws(()=>decodeSave(JSON.stringify(wire)));
});

test('civilian bleeding follows tactical time, stops at death and survives deterministic save data',()=>{
 let s=clinical();s=actBattle(s,{type:'melee',unitId:'doctor',targetId:'patient'});assert.ok(s.npcs[0].bleeding>0);
 const before=s.npcs[0].hp,copy=validateBattleSnapshot(s);s=actBattle(s,{type:'ambient'});assert.equal(s.npcs[0].hp,before-copy.npcs[0].bleeding);assert.deepEqual(s,actBattle(copy,{type:'ambient'}));
 for(let i=0;i<40&&s.npcs[0].hp>0;i++)s=actBattle(s,{type:'ambient'});
 assert.equal(s.npcs[0].hp,0);assert.equal(s.npcs[0].bleeding,0);assert.equal(s.npcs[0].stance,'prone');assert.equal(civilianIncidents(s.npcs[0]).filter(e=>e.kind==='death').length,1);
 assert.equal(s.status,'active');assert.equal(s.units.length,1);assert.ok(validateBattleSnapshot(s));
});

test('a finite medical charge stabilizes a critical resident without full healing or resurrection',()=>{
 let s=clinical({hp:18});s=actBattle(s,{type:'ambient'});
 // Start with a prior environmental wound, then use real medical action.
 s.npcs[0].hp=8;s.npcs[0].unconscious=true;
 s=actBattle(s,{type:'weapon',unitId:'doctor',slot:'medical'});assert.equal(s.lastError,null);s=actBattle(s,{type:'heal',unitId:'doctor',targetId:'patient'});assert.equal(s.lastError,null);assert.equal(s.npcs[0].hp,15);assert.equal(s.npcs[0].unconscious,false);assert.equal(s.units[0].medkits,1);assert.equal(s.npcs[0].civilianFirstAid.hpRestored,7);
 const retry=actBattle(s,{type:'heal',unitId:'doctor',targetId:'patient'});assert.ok(retry.lastError);assert.equal(retry.units[0].medkits,1);assert.ok(validateBattleSnapshot(s));
 const dead=clinical({hp:0});assert.ok(actBattle(dead,{type:'heal',unitId:'doctor',targetId:'patient'}).lastError);
});

test('civilian snapshots reject altered HP, wound histories, missing residents and unrelated deployment reports',()=>{
 let pair=approach(visit(ready(false)));pair=act(pair,{type:'melee',targetId:'cabral'});pair=act(pair,{type:'heal',targetId:'cabral'});
 const wire=encodeSave(pair.campaign,pair.battle);
 for(const mutate of [v=>v.battle.npcs[0].hp++,v=>delete v.battle.npcs[0].civilianHarm,v=>v.battle.npcs=[],v=>v.campaign.civilianState.people['person-3'].health.hp++,v=>v.battle.npcs[0].bleeding=-1,v=>v.battle.npcs[0].civilianHarm.incidents[0].side='enemy']){
  const bad=JSON.parse(wire);mutate(bad);assert.throws(()=>decodeSave(JSON.stringify(bad)));
 }
 const foreign=structuredClone(pair.battle);foreign.battleId='other';assert.ok(syncBattleTime(pair.campaign,foreign).error);
 const healed=structuredClone(pair.battle);healed.npcs[0].hp++;assert.ok(syncBattleTime(pair.campaign,healed).error);
});

test('the first death applies city consequences once and closes an unfinished local errand',()=>{
 let s=order(initialCampaign(4),{type:'recruitCivic',id:110,term:'week'});let pair=approach(visit(s),'local-retiro');
 pair.campaign=order(pair.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:110,approach:'quest',sectorState:pair.battle});
 pair=act(pair,{type:'weapon',slot:'blade'});const loyalty=pair.campaign.sectors.retiro.loyalty;
 for(let i=0;i<8&&pair.battle.npcs.find(n=>n.id==='local-retiro').hp>0;i++)pair=act(pair,{type:'melee',targetId:'local-retiro'});
 assert.equal(pair.campaign.sectors.retiro.loyalty,loyalty-10);assert.equal(pair.campaign.quests['retiro-uniformes'].status,'failed');
 pair=saved(pair);pair=synced(pair);assert.equal(pair.campaign.sectors.retiro.loyalty,loyalty-10);assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.eventId==='civilian:npc-local-retiro').length,1);
});

test('an earlier uninjured save without a civilian ledger migrates without changing health or position',()=>{
 let pair=visit(ready(false));const before={x:npc(pair).x,y:npc(pair).y,hp:npc(pair).hp};const old=JSON.parse(encodeSave(pair.campaign,pair.battle));delete old.campaign.civilianState;
 for(const n of [...old.campaign.pendingBattle.npcs,...old.battle.npcs])for(const k of ['hp','maxHp','energy','unconscious','civilianHealthVersion'])delete n[k];
 pair=decodeSave(JSON.stringify(old));assert.deepEqual({x:npc(pair).x,y:npc(pair).y,hp:npc(pair).hp},before);assert.ok(pair.campaign.civilianState.people['person-3']);
});

test('firearms and artillery can hit civilians with finite ammunition and valid wounds',()=>{
 for(const weapon of [1802,1807]){
  let s=clinical({}, {seed:42},{weapon,loaded:1,marksmanship:100,condition:100});
  s=actBattle(s,{type:'fire',unitId:'doctor',targetId:'patient',aim:4});assert.equal(s.lastError,null);assert.equal(s.units[0].loaded,0);assert.ok(s.npcs[0].hp<100);assert.ok(validateBattleSnapshot(s));
 }
 for(const mode of ['solid','canister']){
  let s=clinical({x:4,y:1},{artillery:[{id:'gun',type:'swivel',x:2,y:1,loaded:true,ammo:1}]});
  s=actBattle(s,{type:'artillery',unitId:'doctor',artilleryId:'gun',x:4,y:1,mode});assert.equal(s.lastError,null);assert.equal(s.artillery[0].loaded,false);assert.ok(s.npcs[0].hp<100);assert.ok(validateBattleSnapshot(s));
 }
});


test('legacy active injuries migrate to one physical scale without resetting the campaign record',()=>{
 const pair=visit(ready(false)),wire=JSON.parse(encodeSave(pair.campaign,pair.battle));delete wire.campaign.civilianState;
 for(const n of [...wire.campaign.pendingBattle.npcs,...wire.battle.npcs])for(const k of ['hp','maxHp','energy','unconscious','civilianHealthVersion'])delete n[k];
 wire.battle.npcs[0].hp=80;const restored=decodeSave(JSON.stringify(wire));
 assert.equal(npc(restored).hp,npc(pair).maxHp-20);assert.equal(restored.campaign.operativeState[3].hp,npc(restored).hp);assert.equal(restored.campaign.contentPresence.people['person-3'].hp,npc(restored).hp);assert.ok(saved(restored));
});

test('an incidental firearm hit records the resident’s real cause and can pass onward with reduced force',()=>{
 let s=clinical({x:3,y:1},{seed:42,enemies:[{id:'enemy',x:5,y:1,weapon:1800}],exploration:false});Object.assign(s.units[0],{weapon:1802,loaded:1,marksmanship:100,condition:100});
 const initial=structuredClone(s),action={type:'fire',unitId:'doctor',targetId:'enemy',aim:4};
 s=actBattle(s,action);assert.equal(s.lastError,null);const residentDamage=100-s.npcs[0].hp,downstreamDamage=100-s.units.find(u=>u.id==='enemy').hp;
 assert.ok(residentDamage>0&&downstreamDamage>0&&downstreamDamage<residentDamage);assert.equal(s.units[0].loaded,0);assert.equal(civilianIncidents(s.npcs[0])[0].intentional,false);assert.ok(validateBattleSnapshot(s));
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(initial))),action),s);
});

test('a former recruit returns with the service record, rather than the old civilian health cache',()=>{
 let pair=approach(visit(ready(false,80)));pair=woundResident(pair);pair=act(pair,{type:'heal',targetId:'cabral'});
 let s=order(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:110,approach:'recruit',sectorState:pair.battle});
 const local=npc(pair),record=s.pendingBattle.squad.find(u=>u.id===3);pair.battle.npcs=[];pair.battle.units.push({...createBattle([record],{width:8,height:8,enemies:[],exploration:true}).units[0],x:local.x,y:local.y});
 // Field aid has already bandaged this wound. Actual strategic treatment must
 // provide any further recovery before the resident returns to the world.
 pair=saved({campaign:s,battle:pair.battle});const repeated=actBattle(pair.battle,{type:'heal',unitId:'110',targetId:'3'});assert.ok(repeated.lastError);assert.equal(repeated.units[0].medkits,pair.battle.units[0].medkits);
 s=order(leave(pair),{type:'travel',sector:'retiro'});s=order(s,{type:'assignCare',id:110,assignment:'doctor'});s=order(s,{type:'assignCare',id:3,assignment:'patient'});s=order(s,{type:'wait',hours:1});const hp=s.operativeState[3].hp;s=order(s,{type:'dismiss',id:3});s=order(s,{type:'assignCare',id:110,assignment:'active'});s=order(saved({campaign:s}).campaign,{type:'travel',sector:A});
 pair=visit(s);assert.equal(npc(pair).hp,hp);assert.ok(npc(pair).hp>local.hp);assert.ok(saved(pair));
});

test('mission contacts share San Martín health and a dead essential speaker causes a saved explicit defeat',()=>{
 let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;
 // Established northern-chapter fixture includes the retained earlier ally.
 s.missionAllies.san_lorenzo=createBattle([sanLorenzoAlly(s)],{width:8,height:8,enemies:[],exploration:true}).units[0];
 for(const id of ['buenos_aires','cordoba','mendoza','tucuman','salta'])s.sectors[id].owner='patriot';
 s=order(s,{type:'travel',sector:'mendoza'});s=leave(visit(s));assert.ok(s.sectorStates.mendoza.npcs.some(n=>n.id==='san-martin'));s=restForMarch(s);
 s=order(s,{type:'travel',sector:'tucuman'});for(let i=0;s.squads.find(q=>q.id===s.activeSquadId).journey&&i<12;i++){s=restForMarch(s);s=order(s,{type:'resumeTravel'});s=order(s,{type:'wait',hours:24});}s=restForMarch(s);s=order(s,{type:'visitMission',mission:'yatasto'});let pair={campaign:s,battle:enterSector(s.pendingBattle)};
 pair=approach(pair,'yatasto-san-martin');pair=act(pair,{type:'melee',targetId:'yatasto-san-martin'});assert.equal(pair.campaign.operativeState[57].hp,pair.battle.npcs.find(n=>n.id==='yatasto-san-martin').hp);
 const hp=pair.campaign.operativeState[57].hp;assert.equal(sanLorenzoAlly(pair.campaign).hp,hp);assert.equal(encountersFor(pair.campaign,'mendoza').find(n=>n.id==='san-martin').hp,hp);
 while(pair.battle.npcs.find(n=>n.id==='yatasto-san-martin').hp>0)pair=act(pair,{type:'melee',targetId:'yatasto-san-martin'});
 assert.equal(pair.campaign.defeated,true);assert.equal(sanLorenzoAlly(pair.campaign).hp,0);assert.equal(pair.campaign.missions.yatasto.stage,'failed');assert.ok(!pair.campaign.sectorStates.mendoza.npcs.some(n=>n.id==='san-martin'));pair=saved(pair);s=leave(pair);assert.equal(s.defeated,true);assert.ok(saved({campaign:s}));assert.equal(encountersFor(s,'mendoza').some(n=>n.id==='san-martin'),false);
});


test('used medical charges stay spent after closed shop orders, save and reentry',()=>{
 let pair=approach(visit(ready(false)));pair=act(pair,{type:'melee',targetId:'cabral'});pair=act(pair,{type:'heal',targetId:'cabral'});
 let s=leave(pair);s=order(s,{type:'travel',sector:'retiro'});assert.equal(s.operativeState[110].medkits,1);
 const poor=structuredClone(s);poor.resources.treasury=0;const rejected=dispatchCampaign(poor,{type:'resupply',operativeId:110});assert.ok(rejected.lastError);assert.equal(rejected.operativeState[110].medkits,1);assert.equal(rejected.resources.treasury,0);
 const cash=s.resources.treasury,closed=dispatchCampaign(s,{type:'resupply',operativeId:110});assert.ok(closed.lastError);assert.equal(closed.resources.treasury,cash);assert.equal(closed.operativeState[110].medkits,1);
 pair=visit(saved({campaign:s}).campaign);assert.equal(pair.battle.units[0].medkits,1);
});
