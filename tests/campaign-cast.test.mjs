import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,availableActions} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {isHistoricalCharacter,operativeIdForCharacter,legacyOperativeId} from '../game/content-character-ids.js';
import {encountersFor,encounterDefinitions,encounterContacts} from '../game/encounters.js';
import {defaultProfile} from '../game/character-profile.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {questPackage} from './content-quest-fixture.mjs';
import {order,saved,visit,talk,approachLocal,leave,A} from './local-contract-fixture.mjs';
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});
function cast(){
 const d=questPackage(),courier={...structuredClone(d.characters.find(c=>c.id==='person-110')),id:'courier',name:'Lucía del Correo',nickname:'Lucía',arrivalHours:2};d.characters=[courier,d.characters.at(-1)];d.placements=d.placements.filter(p=>p.character==='alma-contract');d.includeOriginalResidents=false;d.campaignStory={...defaultCampaignStory(),victory:'La posta recibió el informe.',chapters:[{id:'post',name:'El informe',objective:'Conversá con Alma y entregá el informe.',conditions:[{type:'quest',quest:'river-post',status:'completed'}]}]};return d;
}
function ready(d=cast()){
 let s=initialCampaign(42,d),id=operativeIdForCharacter(d,'courier');s=order(s,{type:'recruitCivic',id,term:'week'});assert.equal(s.recruited.length,0);s=order(s,{type:'wait',hours:2});s=order(s,{type:'travel',sector:A});return approachLocal(visit(s));
}

test('a wholly authored cast hires, encounters, completes a real dialogue quest and wins without historical records or returning contacts',()=>{
 let p=ready();assert.equal(rosterFor(p.campaign).length,2);assert.ok(rosterFor(p.campaign).every(c=>c.id>=2000));assert.deepEqual(Object.keys(p.campaign.operativeState).sort(),['2000','2001']);assert.deepEqual(p.battle.npcs.map(n=>n.contentId),['alma-contract']);
 assert.deepEqual(availableActions(p.campaign).recruits.map(c=>c.contentId),['alma-contract']);assert.deepEqual(encounterContacts(p.campaign).map(n=>n.contentId),['alma-contract']);for(const sector of Object.keys(p.campaign.sectors))assert.deepEqual(encountersFor(p.campaign,sector),[]);
 p=saved(choose(choose(p,'start','accept'),'active','complete'));let s=saved({campaign:leave(p)}).campaign;assert.equal(s.completed,true);assert.equal(s.flags.sanLorenzo,false);assert.equal(s.flags.foundry,false);assert.equal(s.phase,0);assert.ok(s.log.some(e=>e.text==='La posta recibió el informe.'));assert.equal(s.operativeState[57],undefined);assert.equal(s.operativeState[110],undefined);assert.deepEqual(encounterDefinitions(s).map(n=>n.contentId),['alma-contract']);assert.equal(saved({campaign:s}).campaign.operativeState[3],undefined);
});

test('historical progression still requires its cast, and original ambient residents are independently optional with legacy defaults',()=>{
 const d=defaultContentPackage();d.characters=d.characters.filter(c=>c.id!=='person-57');d.placements=d.placements.filter(p=>p.character!=='person-57');assert.throws(()=>initialCampaign(42,d),/avance histórico/);d.campaignStory=defaultCampaignStory();let s=initialCampaign(42,d);assert.ok(!encounterDefinitions(s).some(n=>n.operativeId===57));assert.ok(encountersFor(s,'retiro').some(n=>n.id==='local-retiro'));
 d.includeOriginalResidents=false;s=initialCampaign(42,d);assert.ok(!encountersFor(s,'retiro').some(n=>n.id==='local-retiro'));assert.ok(encountersFor(s,'retiro').some(n=>n.operativeId===3));assert.ok(saved({campaign:s}));
 const stock=initialCampaign(),old=initialCampaign(42,defaultContentPackage());assert.deepEqual(encountersFor(old,'retiro').map(n=>n.id),encountersFor(stock,'retiro').map(n=>n.id));
 for(const value of [null,0,'false',{},[]]){const bad=cast();bad.includeOriginalResidents=value;assert.throws(()=>initialCampaign(42,bad),/Habitantes originales/);}
});

test('an empty authored cast can launch a free player officer and save a real peaceful visit',()=>{
 const d=defaultContentPackage();d.characters=[];d.placements=[];d.includeOriginalResidents=false;d.campaignStory=defaultCampaignStory();let s=initialCampaign(42,d);assert.deepEqual(rosterFor(s),[]);assert.deepEqual(availableActions(s).recruits,[]);assert.deepEqual(encounterDefinitions(s),[]);assert.ok(saved({campaign:s}));
 s=order(s,{type:'createOfficer',name:'Isabel',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});assert.equal(s.resources.treasury,3200);assert.deepEqual(s.recruited,[1000]);const p=saved(visit(s));assert.equal(p.battle.npcs.length,0);assert.equal(p.battle.units.filter(u=>u.side==='player').length,1);assert.ok(saved({campaign:leave(p)}));
});

test('removed cast and resident options stay pinned, and injected absent historical actors are rejected on save admission',()=>{
 const d=cast(),p=ready(d);d.includeOriginalResidents=true;d.characters.push(defaultContentPackage().characters[0]);assert.equal(saved(p).campaign.contentCampaign.package.includeOriginalResidents,false);assert.equal(rosterFor(saved(p).campaign).length,2);
 const bad=JSON.parse(encodeSave(p.campaign,p.battle));bad.campaign.contentCampaign.package.includeOriginalResidents=true;assert.throws(()=>decodeSave(JSON.stringify(bad)),/identidad/);
 const injected=JSON.parse(encodeSave(p.campaign,p.battle));const actor=structuredClone(injected.battle.npcs[0]);actor.id='san-martin';actor.operativeId=57;actor.contentId='person-57';injected.battle.npcs.push(actor);assert.throws(()=>decodeSave(JSON.stringify(injected)));
});
