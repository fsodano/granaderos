import test from 'node:test';
import assert from 'node:assert/strict';
import {SPEECH_EVENTS,OPTIONAL_SPEECH_EVENTS,speechFor} from '../game/characters.js';
import {defaultContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {characterPresentationDefaults} from '../game/content-character-presentation.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';

const events=['near','interrupt'];
const paidIds=[107,110];
const person=(d,id)=>d.characters.find(c=>c.id===`person-${id}`);
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const olderPackage=()=>{const d=defaultContentPackage();for(const c of d.characters)for(const event of events)delete c.speech[event];return d;};
function paidVisit(d){
 let campaign=initialCampaign(42,d);for(const id of paidIds)campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});campaign=order(campaign,{type:'visitSector'});
 return decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));
}

test('fresh fictional reactions are explicit distinct optional lines; older packages and legacy profiles stay silent',()=>{
 assert.deepEqual(SPEECH_EVENTS,['hired','contact','cleared','wounded','exhausted','death','ending']);
 assert.ok(events.every(event=>OPTIONAL_SPEECH_EVENTS.includes(event)));
 const fresh=defaultContentPackage(),speakers=fresh.characters.filter(c=>events.some(event=>Object.hasOwn(c.speech,event)));
 assert.deepEqual(speakers.map(c=>c.id).sort(),['person-104','person-105','person-107','person-110','person-126','person-130']);
 for(const event of events){assert.equal(new Set(speakers.map(c=>c.speech[event])).size,speakers.length);assert.ok(speakers.every(c=>c.speech[event].trim()&&c.speech[event]!==c.speech.contact));}
 const older=olderPackage(),identity=contentIdentity(older),restored=parseContentPackage(encodeContentPackage(older));
 assert.deepEqual(restored,older);assert.deepEqual(contentIdentity(restored),identity);
 const campaign=decodeSave(encodeSave(initialCampaign(42,restored))).campaign;
 assert.deepEqual(campaign.contentCampaign.package,older);assert.deepEqual(campaign.contentCampaign.identity,initialCampaign(42,older).contentCampaign.identity);
 for(const id of [105,107,126,130]){
  const op=rosterFor(campaign).find(o=>o.id===id);for(const event of events){assert.equal(speechFor(op,event),null);assert.equal(characterPresentationDefaults(person(older,id)).speech[event],undefined);assert.equal(speechFor({id},event),null);}
 }
 const withoutSpeech=structuredClone(older);delete person(withoutSpeech,107).speech;
 const omitted=decodeSave(encodeSave(initialCampaign(42,withoutSpeech))).campaign;
 assert.equal(omitted.contentCampaign.package.characters.find(c=>c.id==='person-107').speech,undefined);for(const event of events)assert.equal(speechFor(rosterFor(omitted).find(o=>o.id===107),event),null);
});

test('optional combat lines use existing strict text admission without weakening required legacy speech',()=>{
 const older=olderPackage();
 for(const event of events){
  for(const value of ['Todavía puedo actuar.','','  ','á'.repeat(800)]){const d=structuredClone(older);person(d,112).speech[event]=value;const loaded=parseContentPackage(encodeContentPackage(d));assert.equal(person(loaded,112).speech[event],value);assert.ok(initialCampaign(42,loaded));}
  for(const value of [null,42,{},'x'.repeat(801)]){const d=structuredClone(older);person(d,112).speech[event]=value;assert.throws(()=>initialCampaign(42,d));}
 }
 for(const change of [c=>delete c.speech.death,c=>c.speech.unknown='No',c=>c.speech={near:'Cerca.',interrupt:'Ahora.'}]){const d=structuredClone(older);change(person(d,112));assert.throws(()=>initialCampaign(42,d));}
});

test('actual paid arrivals and official deployment saves pin each optional line without changing physical issue or old omissions',()=>{
 const fresh=defaultContentPackage(),older=olderPackage(),pair=paidVisit(fresh),oldPair=paidVisit(older);
 assert.equal(pair.campaign.hour,6);assert.deepEqual(pair.campaign.contracts,oldPair.campaign.contracts);assert.equal(pair.campaign.resources.treasury,oldPair.campaign.resources.treasury);assert.deepEqual(pair.campaign.operativeState,oldPair.campaign.operativeState);
 assert.equal(pair.campaign.contracts[107].paid,588);assert.equal(pair.campaign.contracts[110].paid,420);assert.equal(pair.campaign.resources.treasury,3200-588-420);
 for(const id of paidIds){
  const actual=pair.battle.units.find(u=>u.id===String(id)),old=oldPair.battle.units.find(u=>u.id===String(id));
  for(const event of events){assert.equal(speechFor(actual,event),person(fresh,id).speech[event]);assert.equal(speechFor(old,event),null);assert.equal(old.storyProfile.speech[event],undefined);}
  const raw=JSON.parse(encodeSave(pair.campaign,pair.battle));raw.battle.units.find(u=>u.id===String(id)).storyProfile.speech.near='Changed after issue.';assert.throws(()=>decodeSave(JSON.stringify(raw)),/voz o apariencia/);
  const request=JSON.parse(encodeSave(pair.campaign,pair.battle));request.campaign.pendingBattle.squad.find(u=>u.id===id).storyProfile.speech.interrupt='Changed after issue.';assert.throws(()=>decodeSave(JSON.stringify(request)),/voz o apariencia/);
 }
 const native=pair.battle.units.filter(u=>u.side==='player'),returned=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:native});
 const oldReturned=order(oldPair.campaign,{type:'leaveSector',battleId:oldPair.campaign.pendingBattle.id,sectorState:oldPair.battle,survivors:oldPair.battle.units.filter(u=>u.side==='player')}),saved=decodeSave(encodeSave(returned)).campaign;
 assert.deepEqual(saved.operativeState,decodeSave(encodeSave(oldReturned)).campaign.operativeState,'optional lines do not alter actual return normalization or custody');
 assert.deepEqual(saved.contracts,pair.campaign.contracts);assert.equal(saved.resources.treasury,pair.campaign.resources.treasury);
 for(const id of paidIds){const actual=saved.operativeState[id],before=pair.campaign.operativeState[id];assert.ok(before.weaponMetadata.contentWeapon);assert.ok(before.inventory);for(const key of ['hp','maxHp','alive','energy','fatigue','bleeding','bandaged','morale','condition','bladeCondition','medkits','rations','torches','boleadoras','toolkitPoints','ammo','carriedLoaded','carriedAmmo','inventory','weaponMetadata','bladeMetadata','weaponFittings','outfit','headwear','legwear'])assert.deepEqual(actual[key],before[key],`actual return preserves ${id} ${key}`);}
 const revisited=order(saved,{type:'visitSector'}),again=decodeSave(encodeSave(revisited,enterSector(revisited.pendingBattle)));
 for(const id of paidIds)for(const event of events)assert.equal(speechFor(again.battle.units.find(u=>u.id===String(id)),event),person(fresh,id).speech[event]);
});
