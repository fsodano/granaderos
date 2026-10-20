import test from 'node:test';
import assert from 'node:assert/strict';
import stockContent from '../campaigns/granaderos/content.json' with {type:'json'};
import {DEFAULT_CATALOGUE,DEFAULT_WORLD,DEFAULT_MAPS,DEFAULT_PRESENTATION} from '../campaigns/default.js';
import stockManifest from '../campaigns/granaderos/manifest.json' with {type:'json'};
import stockAssets from '../campaigns/granaderos/assets.json' with {type:'json'};
import stockStartupBaseline from './stock-startup-baseline.json' with {type:'json'};
import {captureStockStartup} from './stock-startup-capture.mjs';
import * as campaignEngine from '../game/campaign.js';
import * as abilityEngine from '../game/character-abilities.js';
import * as weaponEngine from '../game/weapon-definition.js';
import * as ammunitionEngine from '../game/ammo-types.js';
import * as contractEngine from '../game/contracts.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {OPERATIVES,WEAPONS,PHASES} from '../game/data.js';
import {CIVIC_RECRUITS} from '../game/civic-recruits.js';
import {CHARACTER_PROFILES,SPEECH_EVENTS,characterProfile} from '../game/characters.js';
import {CHARACTER_PORTRAITS} from '../game/character-portraits.js';
import {NPC_QUESTS,questsFor} from '../game/quests.js';
import {encounterDefinitions} from '../game/encounters.js';
import {errandContacts} from '../game/quest-definitions.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter,isContractCharacter,isWorldCharacter,isHistoricalCharacter} from '../game/content-character-ids.js';
import {hasCharacterAbility} from '../game/character-abilities.js';
import {spriteSkinTone} from '../game/sprite-skin.js';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';
import {syncBattleTime} from '../game/time.js';
import {createBattle,actBattle,actionCosts,weaponFor,bladeFor} from '../game/tactical.js';
import {ammunitionLoadsFor} from '../game/ammo-types.js';
import {weaponMetadata} from '../game/weapon-definition.js';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
function genericPackage(){
 const d=defaultContentPackage();d.id='campaign-catalogue-test';d.name='La guardia del camino';d.scenario='generic-v1';d.includeOriginalResidents=false;d.errands=[];
 const merc=structuredClone(d.characters.find(c=>c.id==='person-0'));
 Object.assign(merc,{name:'Inés Caminos',nickname:'Inés',biography:'Una guardia del camino.',monthlyPay:30,arrivalHours:0,recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],skinTone:'light',portrait:'/campaigns/campaign-catalogue-test/assets/portraits/ines.webp'});
 // Omitted capabilities and voice must not derive from the old person-0 slot.
 for(const field of ['abilities','personality','speech','spriteAppearance'])delete merc[field];
 const npc=structuredClone(d.characters.find(c=>c.id==='person-103'));
 Object.assign(npc,{name:'Alma de la posta',nickname:'Alma',biography:'Custodia la correspondencia.',monthlyPay:0,recruitmentSource:'encounter',service:'permanent',progression:'fixed',traits:[],abilities:[],weapon:null,skinTone:'dark',spriteAppearance:'woman-shawl',personality:'Atenta al camino.',speech:Object.fromEntries(SPEECH_EVENTS.map(event=>[event,`Alma: ${event}.`])),portrait:'/campaigns/campaign-catalogue-test/assets/portraits/alma.webp'});
 delete npc.arrivalHours;delete npc.blade;
 npc.encounter={recruitable:false,greeting:'La posta sigue abierta.',requiredLeadership:0,requiredLiberated:0,requiredSector:null,dialogue:{entry:'offer',nodes:[
  {id:'offer',title:'El correo',text:'Necesito que revises el camino.',choices:[{id:'accept',label:'Acepto.',next:'active',effects:[{type:'quest',quest:'post-report',status:'active'}]}]},
  {id:'active',title:'El parte',text:'Espero tus noticias.',choices:[{id:'complete',label:'El camino está abierto.',next:'done',effects:[{type:'quest',quest:'post-report',status:'completed'}]}]},
  {id:'done',title:'Gracias',text:'El correo puede salir.',choices:[]},
 ]}};
 d.characters=[npc,merc];d.quests=[{id:'post-report',title:'El camino de la posta',description:'Revisá el camino y entregá el parte.'}];
 d.placements=[{id:'post-contact',character:npc.id,mode:'fixed',sectors:['retiro'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 return d;
}

test('stock authored JSON preserves its pinned factory identity and detached compatibility catalogues',()=>{
 const d=defaultContentPackage();assert.deepEqual(d,stockContent);
 // The shipped campaign retains immediate ordinary recruitment. Older saves
 // still pin the former authoring package's six-hour arrivals independently.
 assert.equal(contentIdentity(d).hash,'sha256:933438f768443daaa203d5d83d831d97c2f86e49fe7366c8f0fd0136d278dafa');
 assert.ok(d.characters.filter(isContractCharacter).every(c=>c.arrivalHours===0));
 assert.deepEqual(validateContentPackage(d),[]);
 for(const [actual,key]of [[OPERATIVES,'operatives'],[WEAPONS,'weapons'],[PHASES,'phases'],[CIVIC_RECRUITS,'civicRecruits'],[CHARACTER_PROFILES,'characterProfiles'],[CHARACTER_PORTRAITS,'characterPortraits'],[NPC_QUESTS,'npcQuests']]){
  assert.deepEqual(actual,DEFAULT_CATALOGUE[key]);assert.notEqual(actual,DEFAULT_CATALOGUE[key]);
 }
 d.characters[0].name='Changed draft';d.errands.length=0;d.weapons[0].damage=1;
 assert.deepEqual(defaultContentPackage(),stockContent);
});

test('generic omissions cannot enable stock residents or historical errands',()=>{
 const d=genericPackage();delete d.includeOriginalResidents;delete d.errands;
 const s=initialCampaign(42,d);assert.deepEqual(questsFor(s),[]);
 assert.deepEqual(encounterDefinitions(s).map(n=>n.id),['authored-person-103']);
 assert.deepEqual(errandContacts(d).map(n=>n.id),['authored-person-103']);
 const restored=decodeSave(encodeSave(s)).campaign;assert.deepEqual(questsFor(restored),[]);assert.deepEqual(encounterDefinitions(restored).map(n=>n.id),['authored-person-103']);
});

test('saved campaign source identity remains pinned to its package revision',()=>{
 // An installed identity is admitted with its complete world, maps, art and
 // presentation. A bare editor draft cannot claim an installed revision.
 const d=installedStock({...stockManifest,revision:'test-revision-1'});
 const s=initialCampaign(42,d),wire=encodeSave(s);assert.deepEqual(decodeSave(wire).campaign.campaignOrigin,d.campaignOrigin);
 const edited=JSON.parse(wire);edited.campaign.campaignOrigin.revision='test-revision-2';assert.throws(()=>decodeSave(JSON.stringify(edited)),/identidad/i);
 const foreign=genericPackage();foreign.campaignOrigin={version:1,id:'foreign-campaign',revision:'r1'};assert.ok(validateContentPackage(foreign).some(e=>e.includes('identidad')));
});

test('explicit generic profiles replace stock numeric identities without inherited capabilities or historical descriptions',()=>{
 const d=genericPackage();assert.deepEqual(validateContentPackage(d),[]);
 const ids=d.characters.map(c=>operativeIdForCharacter(d,c.id));assert.ok(ids.every(id=>id>=2000));assert.equal(new Set(ids).size,2);
 const reordered={...d,characters:[...d.characters].reverse()};
 for(const c of d.characters)assert.equal(operativeIdForCharacter(reordered,c.id),operativeIdForCharacter(d,c.id));
 assert.equal(isContractCharacter(d.characters[1]),true);assert.equal(isWorldCharacter(d.characters[0]),true);assert.equal(isHistoricalCharacter(d.characters[1],d),false);
 let s=initialCampaign(42,d);const id=operativeIdForCharacter(d,'person-0');s=order(s,{type:'recruitCivic',id,term:'week'});
 const op=rosterFor(s).find(o=>o.id===id);assert.equal(op.name,'Inés Caminos');assert.equal(op.service,'contract');assert.equal(op.progression,'experience');assert.equal(hasCharacterAbility(op,'mud_rider'),false);
 assert.equal(spriteSkinTone(op),'light');assert.doesNotMatch(characterProfile(op).personality,/autonomía del norte/);
 const restored=decodeSave(encodeSave(s)).campaign;assert.equal(rosterFor(restored).find(o=>o.id===id).portrait,d.characters[1].portrait);
 const omitted=defaultContentPackage();assert.equal(operativeIdForCharacter(omitted,'person-0'),0);omitted.scenario='generic-v1';assert.ok(operativeIdForCharacter(omitted,'person-0')>=2000);delete omitted.scenario;assert.equal(operativeIdForCharacter(omitted,'person-0'),0);
});

test('configured NPC portrait, skin, voice and quest dialogue survive deployment and saved conversation receipts',()=>{
 const d=genericPackage(),id=operativeIdForCharacter(d,'person-0');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});
 s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);
 const npc=b.npcs.find(n=>n.contentId==='person-103');assert.ok(npc);assert.equal(npc.name,'Alma de la posta');assert.equal(npc.portraitId,d.characters[0].portrait);assert.equal(spriteSkinTone(npc),'dark');assert.equal(spriteAppearance(npc,'civilian'),'woman-shawl');assert.equal(npc.storyProfile.speech.contact,'Alma: contact.');
 b=approachNPC(b,String(id),npc.id);const synced=syncBattleTime(s,b);assert.equal(synced.error,null,synced.error);s=synced.campaign;b=synced.battle;
 const talk={type:'talkNPC',npcId:npc.id,unitId:String(id),approach:'dialogue',sectorState:b};
 s=order(s,talk);s=order(s,{...talk,dialogueNode:'offer',dialogueChoice:'accept'});assert.equal(contentQuestStatus(s,'post-report'),'active');
 s=order(s,{...talk,dialogueNode:'active',dialogueChoice:'complete'});assert.equal(contentQuestStatus(s,'post-report'),'completed');
 const pair=decodeSave(encodeSave(s,b));assert.equal(contentQuestStatus(pair.campaign,'post-report'),'completed');assert.equal(pair.battle.npcs.find(n=>n.id===npc.id).skinTone,'dark');
 const tampered=JSON.parse(encodeSave(s,b));tampered.battle.npcs.find(n=>n.id===npc.id).skinTone='brown';assert.throws(()=>decodeSave(JSON.stringify(tampered)),/apariencia/);
});

test('generic profile admission rejects omissions, unsupported scenarios, skin palettes and unsafe asset references',()=>{
 for(const field of ['recruitmentSource','service','progression','traits']){const d=genericPackage();delete d.characters[1][field];assert.ok(validateContentPackage(d).some(e=>e.includes('explícitos')),field);}
 for(const skinTone of ['white','black','unknown',null]){const d=genericPackage();d.characters[0].skinTone=skinTone;assert.ok(validateContentPackage(d).some(e=>e.includes('paleta')));}
 for(const portrait of ['/campaigns/test/assets/../other.png','/campaigns/test/assets/face.png?x=1','https://example.com/face.png']){const d=genericPackage();d.characters[0].portrait=portrait;assert.ok(validateContentPackage(d).some(e=>e.includes('portrait')));}
 const d=genericPackage();d.scenario='unsupported';assert.ok(validateContentPackage(d).some(e=>e.includes('escenario')));
});

const installedStock=(manifest=stockManifest)=>compileCampaignPackage(manifest,{content:defaultContentPackage(),world:DEFAULT_WORLD,maps:DEFAULT_MAPS,presentation:DEFAULT_PRESENTATION,assets:stockAssets});
test('ordinary and installed stock retain the original startup apart from the authored morning clock, every weapon profile and all service pay terms',()=>{
 const {source,...expected}=stockStartupBaseline;
 assert.equal(source.commit,'12ac2d9b0576a56f8499b70782d581b78f5fd373');
 assert.equal(expected.characters.length,61);
 assert.deepEqual(Object.keys(expected.terms),['day','week','month','fortnight']);
 const engine={campaign:campaignEngine,abilities:abilityEngine,weapons:weaponEngine,ammunition:ammunitionEngine,contracts:contractEngine,tactical:{bladeFor}};
 for(const [name,content]of [['ordinary',null],['installed',installedStock()]]){
  const actual=captureStockStartup(engine,content);
  assert.deepEqual(actual.startup,content?{...expected.startup,hour:9}:expected.startup,`${name}: startup`);
  assert.deepEqual(actual.terms,expected.terms,`${name}: contract terms`);
  for(let i=0;i<expected.characters.length;i++){
   const character=structuredClone(expected.characters[i]);
   // Initial hire quotes move with the opening hour. The separately declared
   // later renewal checkpoint and every price, duration and profile stay exact.
   if(content)for(const quote of Object.values(character.quotes))if(quote.expiresAt!==null)quote.expiresAt+=9;
   assert.deepEqual(actual.characters[i],character,`${name}: operative ${character.stats.id}`);
  }
 }
});

test('installed historical pay preserves original records while edited pay and loose editor packages retain their calculation',()=>{
 const installed=installedStock(),base=rosterFor(initialCampaign(1812)),stock=rosterFor(initialCampaign(1812,installed));
 for(const id of [3,6,11,101,103,104])assert.equal(stock.find(o=>o.id===id).weeklyPay,base.find(o=>o.id===id).weeklyPay);
 const editor=defaultContentPackage(),edited=structuredClone(installed);
 editor.characters.find(c=>c.id==='person-101').monthlyPay=221;
 edited.characters.find(c=>c.id==='person-101').monthlyPay=221;
 for(const content of [editor,edited])assert.equal(rosterFor(initialCampaign(1812,content)).find(o=>o.id===101).weeklyPay,52);
 const loose=rosterFor(initialCampaign(1812,defaultContentPackage()));assert.equal(loose.find(o=>o.id===3).weeklyPay,151);
});
const mechanicalFields=['damage','fireAP','aimAP','reloadAP','range','readyAP','capacity','weight','loadPattern','materialRangeSlope','projectileEnergy','projectileAirDrag'];
const selected=(value,fields)=>Object.fromEntries(fields.map(key=>[key,value[key]??null]));
const controlledBattle=unit=>createBattle([{...unit,x:1,y:1,marksmanship:100,agility:90,loaded:2,ammo:20}],{sector:'retiro',width:12,height:8,seed:117,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'target',x:3,y:1,hp:100,maxHp:100,weapon:1800,overwatch:false},{id:'reserve',x:11,y:7,hp:100,maxHp:100,weapon:1800,overwatch:false}]});

test('installed stock keeps ordinary capabilities, combat speech and both historical primary blades',()=>{
 const ordinary=rosterFor(initialCampaign(42)),installed=rosterFor(initialCampaign(42,installedStock()));
 for(const base of ordinary){const actual=installed.find(o=>o.id===base.id);assert.ok(actual);assert.equal(actual.weapon,base.weapon,base.name);
  for(const ability of ['mud_rider','counterattack','civilian_conscience','enclosed_room_fear','care_composure','nervous_isolation','low_morale_refusal'])assert.equal(hasCharacterAbility(actual,ability),hasCharacterAbility(base,ability),`${base.name}: ${ability}`);
  assert.deepEqual(characterProfile(actual).speech,characterProfile(base).speech,base.name);
 }
 for(const id of [3,9]){const base=ordinary.find(o=>o.id===id),actual=installed.find(o=>o.id===id);assert.deepEqual(selected(bladeFor(actual),['damage','ap','reach']),selected(bladeFor(base),['damage','ap','reach']));
  const before=controlledBattle(base),after=controlledBattle(actual);before.units.find(u=>u.id==='target').x=2;after.units.find(u=>u.id==='target').x=2;
  const command={type:'melee',unitId:String(id),targetId:'target'},a=actBattle(before,command),b=actBattle(after,command);assert.equal(a.lastError,null);assert.equal(b.lastError,null);assert.deepEqual(b.units.map(u=>({id:u.id,hp:u.hp,ap:u.ap})),a.units.map(u=>({id:u.id,hp:u.hp,ap:u.ap})));
 }
});

test('installed stock firearms retain ordinary AP, loads, actual damage and partial reload progress',()=>{
 const ordinary=rosterFor(initialCampaign(42)),installed=rosterFor(initialCampaign(42,installedStock()));
 for(const weapon of defaultContentPackage().weapons.filter(w=>w.template<1809)){
  const baseline=ordinary.find(o=>o.weapon===weapon.template)??{...ordinary.find(o=>o.id===110),weapon:weapon.template};
  const authored={...installed.find(o=>o.id===baseline.id),weapon:weapon.template};
  // Use the installed definition through its ordinary runtime compiler, even
  // for a supported firearm not currently carried by a starting recruit.
  authored.weaponMetadata=weaponMetadata(weapon);
  for(const ammunitionChoice of [undefined,...ammunitionLoadsFor(baseline).slice(1).map(load=>load.family)]){
   const base={...baseline,...(ammunitionChoice?{ammunitionChoice}:{})},actual={...authored,...(ammunitionChoice?{ammunitionChoice}:{})};
   assert.deepEqual(ammunitionLoadsFor(actual),ammunitionLoadsFor(base));
   assert.deepEqual(selected(weaponFor(actual),mechanicalFields),selected(weaponFor(base),mechanicalFields));
   const a=controlledBattle(base),b=controlledBattle(actual),unitId=String(base.id);assert.deepEqual(actionCosts(b,b.units.find(u=>u.id===unitId)),actionCosts(a,a.units.find(u=>u.id===unitId)));
   const command={type:'fire',unitId,targetId:'target'},shotA=actBattle(a,command),shotB=actBattle(b,command);assert.equal(shotA.lastError,null);assert.equal(shotB.lastError,null);assert.ok(shotA.units.find(u=>u.id==='target').hp<100);
   const compare=state=>state.units.map(u=>selected(u,['id','hp','ap','loaded','ammo','reloadProgress','weaponReady']));assert.deepEqual(compare(shotB),compare(shotA));
   assert.deepEqual(actionCosts(shotB,shotB.units.find(u=>u.id===unitId)),actionCosts(shotA,shotA.units.find(u=>u.id===unitId)));
   for(const state of [shotA,shotB])state.units.find(u=>u.id===unitId).loaded=0;
   const reload={type:'reload',unitId},reloadA=actBattle(shotA,reload),reloadB=actBattle(shotB,reload);assert.equal(reloadA.lastError,null);assert.equal(reloadB.lastError,null);assert.deepEqual(compare(reloadB),compare(reloadA));
  }
 }
});
