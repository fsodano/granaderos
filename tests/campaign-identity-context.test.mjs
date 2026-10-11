import test from 'node:test';
import assert from 'node:assert/strict';
import {characterPresentationDefaults} from '../game/content-character-presentation.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encounterRequirements} from '../game/encounters.js';
import {questResolutionReward,questResolutionText,questBeneficiaryResolutionText,questDeliveryText} from '../game/quests.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {hasCharacterAbility} from '../game/character-abilities.js';
import {characterProfile,CHARACTER_PROFILES} from '../game/characters.js';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sleepNeed,sleepRecovery} from '../game/sleep-needs.js';

const world={sectors:[{id:'retiro',name:'La posta'},{id:'buenos_aires',name:'Puerto del Este'},{id:'outpost',name:'El fortín'}],cities:[{id:'post-town',name:'Villa de la Posta',sectors:['retiro']},{id:'eastern-port',name:'Villa del Este',sectors:['buenos_aires']},{id:'outer-town',name:'Villa del Fortín',sectors:['outpost']}]};
const generic={scenario:'generic-v1',world};

test('generic presentation defaults do not use a stock character ID as personality or voice',()=>{
 const person=defaultContentPackage().characters.find(c=>c.id==='person-0');
 for(const field of ['personality','speech','spriteAppearance'])delete person[field];
 person.biography='Una guardia de la posta.';person.traits=[];person.recruitmentSource='contract';
 const stock=characterPresentationDefaults(person),custom=characterPresentationDefaults(person,generic);
 assert.notEqual(stock.personality,person.biography);assert.equal(custom.personality,person.biography);
 assert.equal(custom.speech.hired,'Acepto el contrato. Estoy listo.');assert.equal(custom.spriteAppearance,'worker');
});

test('generic contract profiles use a neutral registry while historical profiles retain their authored registry',()=>{
 const actor={id:110,contentId:'person-110',recruitmentSource:'contract',genericCharacter:true,traits:[]};
 assert.equal(characterProfile(actor).registry,'Contratación de la campaña');
 assert.equal(characterProfile({...actor,recruitmentSource:'encounter'}).registry,'Habitantes de la campaña');
 assert.equal(characterProfile({...actor,genericCharacter:false}).registry,CHARACTER_PROFILES[110].registry);
 assert.equal(characterProfile(rosterFor(initialCampaign()).find(o=>o.id===110)).registry,CHARACTER_PROFILES[110].registry);
});

test('generic recruitment requirements use their campaign localities without historical grouping',()=>{
 const state={contentCampaign:{package:generic},sectors:{retiro:{owner:'patriot'},buenos_aires:{owner:'patriot'},outpost:{owner:'royalist'}}},actor={leadership:80};
 assert.equal(encounterRequirements(state,{requiredLeadership:10,requiredLiberated:2,requiredSector:null},actor),null);
 assert.equal(encounterRequirements(state,{requiredLeadership:10,requiredLiberated:2,requiredSector:'outpost'},actor),'Primero liberá El fortín.');
 assert.equal(encounterRequirements({...state,contentCampaign:{package:{scenario:'granaderos-historical-v1',world}}},{requiredLeadership:10,requiredLiberated:2,requiredSector:null},actor),'Primero asegurá al menos 2 localidades patriotas.');
});

test('delivery and reward choices resolve custom cities from the pinned campaign world',()=>{
 const quest={id:'post-delivery',sector:'outpost',carried:{count:2,label:'Vendas'},delivery:'El correo está listo.',rewardChoice:{reimbursement:30}},state={contentCampaign:{package:generic}};
 assert.throws(()=>questResolutionReward(quest,'cash'),/resolución/);
 assert.deepEqual(questResolutionReward(quest,'cash',state),{treasury:30,loyalty:false});
 assert.match(questResolutionText(quest,'civic',state),/apoyo de la localidad/);
 const branch={id:'post',sector:'outpost',delivery:'Llegó a la posta.',reward:{treasury:0,loyalty:true}},delivered={carried:{count:2},status:'completed',beneficiary:branch,beneficiaries:[branch]};
 assert.match(questBeneficiaryResolutionText(delivered,state),/Villa del Fortín/);
 assert.match(questDeliveryText(delivered,2,state),/Villa del Fortín/);
});

test('legacy authored story identities retain their slots without inheriting stock powers, voices or bodies',()=>{
 const d=defaultContentPackage();delete d.scenario;Object.assign(d,{campaignStory:defaultCampaignStory(),includeOriginalResidents:false,errands:[],roadsideDiscoveries:[],quests:[],placements:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});d.characters=d.characters.filter(c=>c.id==='person-1');
 const person=d.characters[0];Object.assign(person,{name:'Alma de la posta',biography:'Custodia la correspondencia.',recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],arrivalHours:0,monthlyPay:30});for(const field of ['abilities','personality','speech','spriteAppearance','skinTone'])delete person[field];
 assert.equal(operativeIdForCharacter(d,person.id),1);let s=dispatchCampaign(initialCampaign(8,d),{type:'recruitCivic',id:1,term:'week'});assert.equal(s.lastError,null);const op=rosterFor(s).find(o=>o.id===1);assert.deepEqual(op.abilities,[]);assert.equal(hasCharacterAbility(op,'militia_command'),false);assert.equal(characterProfile(op).personality,person.biography);assert.equal(characterProfile(op).speech.hired,'Acepto el contrato. Estoy listo.');assert.equal(spriteAppearance(op),'worker');
 s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);const p=prepareCampaignBattle(s);assert.equal(p.error,null,p.error);const wire=encodeSave(p.campaign,p.battle),legacy=JSON.parse(wire);for(const actor of [...legacy.campaign.pendingBattle.squad,...legacy.battle.units.filter(u=>u.contentId)]){delete actor.genericCharacter;delete actor.abilities;}
 const restored=decodeSave(JSON.stringify(legacy)),actor=restored.battle.units.find(u=>u.id==='1');assert.equal(actor.genericCharacter,true);assert.deepEqual(actor.abilities,[]);assert.equal(hasCharacterAbility(actor,'militia_command'),false);assert.equal(spriteAppearance(actor),'worker');assert.equal(spriteAppearance({...actor,side:'enemy',captured:true}),'worker');
 const forged=JSON.parse(wire);forged.battle.units.find(u=>u.id==='1').genericCharacter=false;assert.throws(()=>decodeSave(JSON.stringify(forged)),/habilidades/);
});

test('legacy authored stories retain numeric slots without stock sleep profiles and keep explicit night training',()=>{
 const d=defaultContentPackage();delete d.scenario;Object.assign(d,{campaignStory:defaultCampaignStory(),includeOriginalResidents:false,errands:[],roadsideDiscoveries:[],quests:[],placements:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 d.characters=d.characters.filter(c=>c.id==='person-103');Object.assign(d.characters[0],{name:'La guardia nocturna',recruitmentSource:'contract',service:'contract',progression:'experience',traits:['night_vision'],abilities:[],arrivalHours:0,monthlyPay:30});
 assert.equal(operativeIdForCharacter(d,'person-103'),103);assert.equal(sleepNeed({id:103,hp:100,maxHp:100}).base,6);
 let s=dispatchCampaign(initialCampaign(8,d),{type:'recruitCivic',id:103,term:'week'});assert.equal(s.lastError,null);
 const op=rosterFor(s).find(o=>o.id===103);assert.equal(op.genericCharacter,true);assert.deepEqual(sleepRecovery(op),{base:8,wounds:0,nightTraining:1,hours:7,fatigue:9,energy:13});
 assert.equal(characterProfile(op).registry,'Contratación de la campaña');
 Object.assign(s.operativeState[103],{energy:40,fatigue:40});s=dispatchCampaign(s,{type:'setSleep',operativeId:103,asleep:true});assert.equal(s.lastError,null);
 const restored=decodeSave(encodeSave(s)).campaign;assert.equal(sleepNeed(rosterFor(restored).find(o=>o.id===103)).base,8);
 const next=dispatchCampaign(restored,{type:'wait',hours:1});assert.equal(next.lastError,null);assert.equal(next.operativeState[103].energy,53);assert.equal(next.operativeState[103].fatigue,31);
});
