import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,canSee} from '../game/tactical.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {civilianIncidents,applyCivilianHarm,advanceCivilianWoundTime} from '../game/civilian-harm.js';
import {isInteriorVisible} from '../game/tactical-visibility.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {contractQuote} from '../game/contracts.js';
import {CIVILIAN_CONSCIENCE,conductObserverDefinition,conductNoncombatantDefinition,isConductNoncombatant,issueConductObservers,validateConductObservers,validateServiceObjection,captureServiceObjection,applyServiceObjection,validateServiceObjectionContext,validateCampaignServiceObjections,serviceObjectionReason} from '../game/service-objections.js';
import {preparedConductArena,performConductEvent,conductStep,saveConductPair,conductWitness} from './conduct-objections-fixture.mjs';

const flat=()=>Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
const field=(witness={},npc={},options={})=>createBattle([
 {id:107,name:'Inés',x:1,y:3,facing:2,abilities:[CIVILIAN_CONSCIENCE],...witness},
 {id:100,name:'Actor',x:2,y:3,facing:2,weapon:0,blade:1813,activeSlot:'blade'},
],{width:16,height:10,tiles:flat(),hour:12,seed:42,enemies:[],exploration:true,npcs:[{id:'civil',name:'Vecina',x:3,y:3,hp:1,noncombatant:true,...npc}],...options});
const strike={type:'melee',unitId:'100',targetId:'civil',targetKind:'npc'};
const witness=b=>b.units.find(actor=>actor.id==='107');
const observe=(s,actor,body)=>(actor===body||canSee(s,actor,body))&&isInteriorVisible(s,body,new Set(s.revealedRooms));
const rejectsAtomically=(pair,action)=>{const before=structuredClone(pair.campaign),next=dispatchCampaign(pair.campaign,action);assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},before);};

test('only explicit paid candidate capability and fixed unarmed noncombatant authoring are admitted',()=>{
 const d=defaultContentPackage(),native=d.characters.find(c=>c.id==='person-107');assert.deepEqual(native.abilities,[CIVILIAN_CONSCIENCE]);assert.equal(conductObserverDefinition(native),true);
 assert.deepEqual(validateContentPackage(d),[]);assert.equal(createBattle([{id:107}]).conductObserverIds,undefined,'numeric legacy slot is neutral');
 for(const change of [c=>delete c.service,c=>c.service='permanent',c=>c.id='person-3']){const bad=structuredClone(d),c=bad.characters.find(c=>c.id==='person-107');change(c);assert.ok(validateContentPackage(bad).length);}
 const resident={...structuredClone(native),id:'civil-resident',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,abilities:[],encounter:{recruitable:false,greeting:'Un vecino de este escenario.',requiredLeadership:0,requiredLiberated:0,requiredSector:null,noncombatant:true}};
 delete resident.arrivalHours;delete resident.blade;delete resident.serviceRefusals;delete resident.preferredCompanions;
 const placement={id:'civil-resident-placement',character:resident.id,mode:'fixed',sectors:['cell-28-29'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0};d.characters.push(resident);d.placements.push(placement);
 assert.equal(conductNoncombatantDefinition(resident,placement),true);assert.deepEqual(validateContentPackage(d),[]);
 for(const change of [c=>c.encounter.recruitable=true,c=>c.weapon='firearm-1800',c=>c.blade='blade-1813',c=>c.service='contract',c=>c.encounter.noncombatant=false]){const bad=structuredClone(d);change(bad.characters.at(-1));assert.ok(validateContentPackage(bad).length);}
 const moving=structuredClone(d);moving.placements.at(-1).mode='daily';assert.ok(validateContentPackage(moving).length);
});

test('a real intentional lethal contact records one complaint without another health morale AP seed or gear effect',()=>{
 const before=field(),older=field({abilities:[]}),original=structuredClone(before),next=actBattle(before,strike),control=actBattle(older,strike);
 assert.equal(next.lastError,null);assert.equal(next.npcs[0].hp,0);assert.deepEqual(civilianIncidents(next.npcs[0]),civilianIncidents(control.npcs[0]));
 assert.deepEqual(witness(next).serviceObjection,{kind:'civilian-killing',civilianKey:'npc-civil',attackerId:'100'});
 const normalized=structuredClone(next);delete normalized.units[0].serviceObjection;normalized.units[0].abilities=[];delete normalized.conductObserverIds;normalized.log=normalized.log.filter(line=>!line.includes('no aceptaré otro contrato'));
 assert.deepEqual(normalized,control);assert.deepEqual(before,original);assert.deepEqual(presentedActBattle(before,strike).state,next);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(before))),strike),next);
 const repeated=actBattle(next,strike);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null,log:next.log},next);assert.equal(repeated.log.at(-1),repeated.lastError);
});

test('witness capability, facing, smoke, walls and undiscovered NPC interiors are required before death',()=>{
 const cases=[()=>field({x:0,facing:6}),()=>field({hp:14}),()=>field({energy:0}),()=>field({asleep:true}),()=>field({captured:true}),()=>field({surrendered:true}),()=>field({routed:true}),()=>field({fled:true}),()=>field({}, {roomId:'unrevealed'}),
  ()=>{const b=field({x:1,y:5});b.tiles.filter(tile=>tile.y===4).forEach(tile=>Object.assign(tile,{type:'wall',blocked:true,blocksSight:true}));return b;},
  ()=>{const b=field({x:1,y:8});b.smoke=[{x:1,y:5,radius:10,turns:4}];return b;}];
 for(const [i,build]of cases.entries()){const b=build(),next=actBattle(b,strike);assert.equal(next.lastError,null,`case ${i}`);assert.equal(next.npcs[0].hp,0);assert.equal(witness(next).serviceObjection,undefined,`case ${i}`);assert.equal(next.log.some(line=>line.includes('no aceptaré otro contrato')),false);}
 const sourceHidden=field({x:1,y:5});sourceHidden.tiles.find(tile=>tile.x===1&&tile.y===4).blocksSight=true;
 assert.equal(canSee(sourceHidden,witness(sourceHidden),sourceHidden.units[1]),false);assert.equal(canSee(sourceHidden,witness(sourceHidden),sourceHidden.npcs[0]),true);
 assert.equal(witness(actBattle(sourceHidden,strike)).serviceObjection,undefined,'seeing the victim alone is insufficient');
});

test('armed military prisoner accidental enemy and militia victims or sources do not produce objections',()=>{
 for(const npc of [{noncombatant:undefined},{weapon:1800},{blade:1813},{operativeId:3},{hostile:true},{detention:{}},{prisoner:true}]){const b=field({},npc);assert.equal(isConductNoncombatant(b.npcs[0]),false);assert.equal(witness(actBattle(b,strike)).serviceObjection,undefined);}
 for(const sourcePatch of [{side:'enemy'},{militia:true}]){const b=field();Object.assign(b.units[1],sourcePatch);assert.equal(captureServiceObjection(b,b.npcs[0],b.units[1],{intentional:true,canObserve:(actor,body)=>observe(b,actor,body)}),null);}
 const b=field();assert.equal(captureServiceObjection(b,b.npcs[0],b.units[1],{intentional:false,canObserve:()=>true}),null);assert.equal(captureServiceObjection(b,b.npcs[0],{id:'absent',side:'player'},{intentional:true,canObserve:()=>true}),null);
});

test('direct transition is once per soldier; delayed bleeding, old corpses and later discovery remain neutral',()=>{
 const b=field(),captured=captureServiceObjection(b,b.npcs[0],b.units[1],{intentional:true,canObserve:()=>true});
 applyCivilianHarm(b,b.npcs[0],{source:b.units[1],damage:1,intentional:true});assert.equal(applyServiceObjection(b,captured).length,1);assert.deepEqual(applyServiceObjection(b,captured),[]);
 assert.equal(captureServiceObjection(b,b.npcs[0],b.units[1],{intentional:true,canObserve:()=>true}),null);
 const other={id:'second',name:'Otra vecina',x:3,y:4,hp:1,noncombatant:true};b.npcs.push(other);const later=captureServiceObjection(b,other,b.units[1],{intentional:true,canObserve:()=>true});applyCivilianHarm(b,other,{source:b.units[1],damage:1,intentional:true});assert.deepEqual(applyServiceObjection(b,later),[]);
 const bleed=field({}, {hp:10});applyCivilianHarm(bleed,bleed.npcs[0],{source:bleed.units[1],damage:9,intentional:true});advanceCivilianWoundTime(bleed,bleed.npcs[0],6);assert.equal(bleed.npcs[0].hp,0);assert.equal(witness(bleed).serviceObjection,undefined);
 const own=field({x:2,y:4,weapon:0,blade:1813,activeSlot:'blade'});const action={...strike,unitId:'107'};const result=actBattle(own,action);assert.equal(result.lastError,null);assert.equal(result.npcs[0].hp,0);assert.equal(witness(result).serviceObjection.attackerId,'107','one may object to one’s own intentional order');
});

test('strict saved receipt and observer identity reject null extra prototype sparse and wrong-side data',()=>{
 const valid={serviceObjection:{kind:'civilian-killing',civilianKey:'npc-civil',attackerId:'100'}};assert.doesNotThrow(()=>validateServiceObjection(valid));
 for(const receipt of [null,[],{...valid.serviceObjection,extra:1},{...valid.serviceObjection,kind:'other'},{...valid.serviceObjection,attackerId:null},{...valid.serviceObjection,civilianKey:'npc-'},Object.assign(Object.create({x:1}),valid.serviceObjection)])assert.throws(()=>validateServiceObjection({serviceObjection:receipt}));
 const b=field();assert.deepEqual(issueConductObservers(b.units),{conductObserverIds:[107]});assert.doesNotThrow(()=>validateConductObservers(b));
 for(const ids of [[],[107,107],['107'],[100],null,Object.assign(new Array(1),{extra:107})])assert.throws(()=>validateConductObservers({...b,conductObserverIds:ids}));
 const enemy=structuredClone(b);enemy.units[0].side='enemy';assert.throws(()=>validateConductObservers(enemy));
});

test('actual acknowledged death and objection survive repeated full sync and save; personal service is not credited before return',()=>{
 const {start}=preparedConductArena(),earned=performConductEvent(start);let pair=earned.pair;
 assert.equal(pair.campaign.pendingBattle.npcs.find(npc=>npc.id==='local-buenos_aires').hp,0);assert.equal(pair.campaign.operativeState[107].serviceObjection,undefined);
 const receipt=structuredClone(conductWitness(pair.battle).serviceObjection);pair=conductStep(pair,{type:'look',unitId:'100',x:3,y:2});assert.deepEqual(conductWitness(pair.battle).serviceObjection,receipt);assert.deepEqual(saveConductPair(pair),pair);
 const quote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(op=>op.id===107));assert.equal(quote.available,false);assert.equal(quote.serviceRefusal,undefined,'there is no rival dismissal remedy');assert.equal(serviceObjectionReason(pair.campaign,rosterFor(pair.campaign).find(op=>op.id===107)),quote.reason);
 for(const mutate of [b=>delete conductWitness(b).serviceObjection,b=>conductWitness(b).serviceObjection.attackerId='107',b=>delete b.conductObserverIds]){const invalid=structuredClone(pair);mutate(invalid.battle);assert.throws(()=>saveConductPair(invalid));rejectsAtomically(invalid,{type:'syncTacticalTime',battleId:invalid.campaign.pendingBattle.id,elapsedSeconds:invalid.battle.elapsedSeconds,sectorState:invalid.battle});}
 assert.doesNotThrow(()=>validateCampaignServiceObjections(pair.campaign,rosterFor(pair.campaign)));
});

test('stored resume cannot authorize itself or a clone without actual physical death; valid unreturned authority cannot be discarded',()=>{
 const {start}=preparedConductArena(),roster=rosterFor(start.campaign),forged=structuredClone(start);
 conductWitness(forged.battle).serviceObjection={kind:'civilian-killing',civilianKey:'npc-local-buenos_aires',attackerId:'100'};forged.campaign.pendingBattle.resumeSnapshot=forged.battle;
 for(const candidate of [forged.battle,structuredClone(forged.battle),start.battle])assert.throws(()=>validateServiceObjectionContext(forged.campaign,candidate,roster));
 assert.throws(()=>saveConductPair(forged));rejectsAtomically(forged,{type:'syncTacticalTime',battleId:forged.campaign.pendingBattle.id,elapsedSeconds:0});
 const earned=performConductEvent(start).pair;earned.campaign.pendingBattle.resumeSnapshot=structuredClone(earned.battle);assert.doesNotThrow(()=>saveConductPair(earned));
 rejectsAtomically(earned,{type:'syncTacticalTime',battleId:earned.campaign.pendingBattle.id,elapsedSeconds:earned.battle.elapsedSeconds});
 const removed=structuredClone(earned);delete conductWitness(removed.battle).serviceObjection;assert.throws(()=>saveConductPair(removed));rejectsAtomically(removed,{type:'syncTacticalTime',battleId:removed.campaign.pendingBattle.id,elapsedSeconds:removed.battle.elapsedSeconds,sectorState:removed.battle});
});

test('authoritative victim classification excludes forged military noncombatants and old omitted content stays neutral',()=>{
 const {start}=preparedConductArena(),bad=structuredClone(start),npc=bad.battle.npcs.find(n=>n.id==='dorrego');assert.ok(npc);
 const suppressed=structuredClone(start);delete suppressed.battle.npcs.find(n=>n.id==='local-buenos_aires').noncombatant;
 assert.throws(()=>saveConductPair(suppressed));rejectsAtomically(suppressed,{type:'syncTacticalTime',battleId:suppressed.campaign.pendingBattle.id,elapsedSeconds:0,sectorState:suppressed.battle});
 npc.noncombatant=true;npc.hp=0;npc.civilianHarm={version:1,incidents:[{sequence:1,kind:'death',attackerId:'100',side:'player',militia:false,intentional:true,hpBefore:100,hpAfter:0}]};
 conductWitness(bad.battle).serviceObjection={kind:'civilian-killing',civilianKey:'person-4',attackerId:'100'};assert.throws(()=>validateServiceObjectionContext(bad.campaign,bad.battle,rosterFor(bad.campaign)));
 const old=performConductEvent(preparedConductArena({oldPinned:true}).start).pair;assert.equal(old.battle.conductObserverIds,undefined);assert.equal(conductWitness(old.battle).serviceObjection,undefined);assert.deepEqual(saveConductPair(old),old);
 const fresh=initialCampaign(42,defaultContentPackage());assert.equal(fresh.operativeState[107].serviceObjection,undefined);assert.equal(contractQuote(fresh,rosterFor(fresh).find(op=>op.id===107)).available,true);
});
