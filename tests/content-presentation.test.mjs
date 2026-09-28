import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {characterProfile,speechFor,SPEECH_EVENTS} from '../game/characters.js';
import {characterEventLines,withCharacterSpeech} from '../game/character-events.js';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {sanLorenzoAlly,missionContacts} from '../game/missions.js';
import {createContentTestRange} from '../game/content-test-range.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const saved=(s,b=null)=>decodeSave(encodeSave(s,b));
function definition(){
 const d=defaultContentPackage();const c={...structuredClone(d.characters.find(c=>c.id==='person-100')),id:'clara',name:'Clara del Río',nickname:'Clara',personality:'Paciente y resuelta.',spriteAppearance:'woman-scout',portrait:'/art/avatar-woman-civilian.webp',traits:[],arrivalHours:2};
 c.speech=Object.fromEntries(SPEECH_EVENTS.map(event=>[event,`Frase propia: ${event}.`]));c.attributes.marksmanship=100;
 d.characters.push(c);return d;
}
function hired(d=definition()){
 const id=operativeIdForCharacter(d,'clara');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});
 s=order(saved(s).campaign,{type:'wait',hours:2});return {d,id,s};
}
const tiles=()=>Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
const field=(unit,enemies,extra={})=>createBattle([{...unit,x:1,y:1}],{sector:'retiro',width:20,height:8,seed:45,tiles:tiles(),enemies,...extra});

test('authored arrival speaks once, uses the chosen profile and keeps voice and appearance on saved deployment and reentry',()=>{
 let {d,id,s}=hired();const c=d.characters.at(-1),op=rosterFor(s).find(o=>o.id===id);
 assert.equal(s.log.filter(l=>l.text.includes(c.speech.hired)).length,1);s=order(saved(s).campaign,{type:'wait',hours:1});assert.equal(s.log.filter(l=>l.text.includes(c.speech.hired)).length,1);
 assert.equal(characterProfile(op).personality,c.personality);assert.equal(spriteAppearance(op),'woman-scout');
 s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle),pair=saved(s,b);const u=pair.battle.units.find(u=>u.id===String(id));
 assert.equal(speechFor(u,'wounded'),c.speech.wounded);assert.equal(u.portraitId,c.portrait);assert.equal(spriteAppearance(u),'woman-scout');assert.equal(u.morale,80,'Narrative personality does not silently change morale');
 s=order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=order(saved(s).campaign,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(characterProfile(b.units[0]).personality,c.personality);assert.equal(spriteAppearance(b.units[0]),'woman-scout');assert.ok(saved(s,b));
 const range=createContentTestRange(d,'clara');assert.equal(speechFor(range.units[0],'contact'),c.speech.contact);assert.equal(spriteAppearance(range.units[0]),'woman-scout');
});

test('actual tactical contact, wounds, exhaustion, clearance and death emit authored phrases; blank phrases stay silent',()=>{
 const {s,id,d}=hired(),op=rosterFor(s).find(o=>o.id===id),lines=d.characters.at(-1).speech;
 let before=field(op,[{id:'guard',x:19,y:1,weapon:1800,overwatch:false}]);
 let after=actBattle(before,{type:'move',unitId:String(id),x:4,y:1});assert.equal(after.lastError,null);assert.ok(characterEventLines(before,after).some(l=>l.includes(lines.contact)));
 before=field(op,[{id:'guard',x:10,y:1,weapon:1806,blade:1811,ammo:0,fatigue:100,marksmanship:100}]);
 after=withCharacterSpeech(before,endTurn(before));assert.ok(after.units[0].hp<before.units[0].hp);assert.ok(after.log.some(l=>l.includes(lines.wounded)));
 for(let i=0;i<10&&after.units[0].hp>0;i++){before=after;after=withCharacterSpeech(before,endTurn(before));}
 assert.equal(after.units[0].hp,0);assert.equal(after.log.filter(l=>l.includes(lines.death)).length,1);
 before=field({...op,energy:1},[],{exploration:true});after=actBattle(before,{type:'move',unitId:String(id),x:2,y:1});assert.equal(after.lastError,null);assert.ok(after.units[0].unconscious);assert.ok(characterEventLines(before,after).some(l=>l.includes(lines.exhausted)));
 before=field(op,[{id:'guard',x:4,y:1,hp:1,weapon:1800,overwatch:false}]);after=actBattle(before,{type:'fire',unitId:String(id),targetId:'guard'});assert.equal(after.lastError,null);assert.equal(after.sectorCleared,true);assert.ok(characterEventLines(before,after).some(l=>l.includes(lines.cleared)));
 const silent={...op,storyProfile:{...op.storyProfile,speech:Object.fromEntries(SPEECH_EVENTS.map(event=>[event,'  ']))}};
 before=field(silent,[{id:'guard',x:4,y:1,hp:1,overwatch:false}]);after=actBattle(before,{type:'fire',unitId:String(id),targetId:'guard'});assert.equal(after.sectorCleared,true);assert.deepEqual(characterEventLines(before,after),[]);assert.deepEqual(withCharacterSpeech(before,after).log,after.log);
});

test('authored endings and silent arrival lines respect real campaign transitions without repetition',()=>{
 const d=definition();d.characters.at(-1).speech.hired='';let {s,id}=hired(d);
 assert.ok(!s.log.some(l=>l.text.includes('Clara del Río:')));
 // Final campaign fixture: the next ordinary order crosses the actual ending gate.
 s.phase=4;s.recruited.push(57);s.flags.commission=true;for(const sector of Object.values(s.sectors))sector.owner='patriot';
 s=order(s,{type:'wait',hours:1});assert.equal(s.completed,true);assert.equal(s.log.filter(l=>l.text.includes(d.characters.at(-1).speech.ending)).length,1);
 s=order(s,{type:'wait',hours:1});assert.equal(s.log.filter(l=>l.text.includes(d.characters.at(-1).speech.ending)).length,1);assert.ok(s.recruited.includes(id));
});

test('local contacts and the mission commander use authored presentation and keep it when hired or retained',()=>{
 const d=definition(),c=d.characters.find(c=>c.id==='person-3'),commander=d.characters.find(c=>c.id==='person-57');
 Object.assign(c,{name:'Lucía del cuartel',spriteAppearance:'woman-shawl',personality:'Atenta a sus compañeros.',speech:{...c.speech,hired:'Vamos juntos.'}});
 Object.assign(commander,{spriteAppearance:'gaucho',personality:'Un mando de campaña.',speech:{...commander.speech,contact:'A sus puestos.'}});
 let {s,id}=hired(d);s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle),npc=b.npcs.find(n=>n.operativeId===3);
 assert.equal(npc.name,c.name);assert.equal(spriteAppearance(npc,'civilian'),'woman-shawl');assert.equal(npc.storyProfile.personality,c.personality);
 b=actBattle(b,{type:'move',unitId:String(id),x:npc.x-1,y:npc.y});assert.equal(b.lastError,null);
 let pair=syncBattleTime(s,b);assert.equal(pair.error,null);
 s=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:id,approach:'recruit',sectorState:pair.battle});assert.ok(s.lastConversation.text.includes('Vamos juntos.'));assert.equal(s.lastConversation.speaker,c.name);
 assert.equal(s.pendingBattle.squad.find(o=>o.id===3).spriteAppearance,'woman-shawl');
 const ally=sanLorenzoAlly(s);assert.equal(spriteAppearance(ally),'gaucho');assert.equal(speechFor(ally,'contact'),'A sus puestos.');
 s.missionAllies.san_lorenzo={...ally,hp:42};const retained=sanLorenzoAlly(s);assert.equal(retained.hp,42);assert.equal(retained.storyProfile.personality,commander.personality);
 const atConference=missionContacts(s).find(n=>n.id==='yatasto-san-martin');assert.equal(atConference.spriteAppearance,'gaucho');assert.equal(atConference.storyProfile.personality,commander.personality);
});

test('saved presentation cannot diverge in a deployment, active actor, saved resident or mission ally',()=>{
 let {s,id}=hired();s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);
 for(const mutate of [v=>v.campaign.pendingBattle.squad[0].storyProfile.speech.wounded='Changed',v=>v.battle.units[0].spriteAppearance='friar',v=>delete v.battle.units[0].storyProfile,v=>v.battle.npcs.find(n=>n.operativeId===3).storyProfile.personality='Changed']){
  const value=JSON.parse(encodeSave(s,b));mutate(value);assert.throws(()=>decodeSave(JSON.stringify(value)),/voz o apariencia/);
 }
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 let value=structuredClone(s);value.sectorStates.retiro.npcs.find(n=>n.operativeId===3).spriteAppearance='worker';assert.throws(()=>saved(value),/voz o apariencia/);
 value=structuredClone(s);value.missionAllies.san_lorenzo=sanLorenzoAlly(value);value.missionAllies.san_lorenzo.storyProfile.speech.death='Changed';assert.throws(()=>saved(value),/voz o apariencia/);
 assert.equal(rosterFor(saved(s).campaign).find(o=>o.id===id).spriteAppearance,'woman-scout');
});

test('an authored mission contact keeps its presentation through conversation, save and scene reentry',()=>{
 const d=definition(),c=d.characters.find(c=>c.id==='person-57');Object.assign(c,{name:'Comandante del Río',spriteAppearance:'gaucho',personality:'Un mando paciente.',abilities:['rapid_first_aid']});
 let {s,id}=hired(d);
 // Open the existing mission gate; this fixture does not claim a full campaign run.
 s.phase=2;s.flags.sanLorenzo=true;for(const sector of ['buenos_aires','cordoba','tucuman','salta'])s.sectors[sector].owner='patriot';
 s=order(s,{type:'travel',sector:'tucuman'});s=order(s,{type:'visitMission',mission:'yatasto'});
 let b=enterSector(s.pendingBattle),pair=saved(s,b),npc=pair.battle.npcs.find(n=>n.id==='yatasto-san-martin');
 assert.deepEqual(npc.abilities,['rapid_first_aid']);assert.equal(npc.name,c.name);assert.equal(npc.spriteAppearance,c.spriteAppearance);assert.equal(npc.storyProfile.personality,c.personality);assert.equal(npc.operativeId,undefined);
 s=pair.campaign;b=pair.battle;const spot=getReachable(b,String(id)).find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(spot);
 b=actBattle(b,{type:'move',unitId:String(id),x:spot.x,y:spot.y});assert.equal(b.lastError,null);pair=syncBattleTime(s,b);assert.equal(pair.error,null);
 s=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:id,approach:'friendly',sectorState:pair.battle});assert.equal(s.lastConversation.speaker,c.name);
 assert.ok(!s.lastConversation.options.includes('recruit'));assert.ok(saved(s,pair.battle));
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=order(saved(s).campaign,{type:'visitMission',mission:'yatasto'});pair=saved(s,enterSector(s.pendingBattle,s.sceneStates.yatasto));
 npc=pair.battle.npcs.find(n=>n.id==='yatasto-san-martin');assert.deepEqual(npc.abilities,['rapid_first_aid']);assert.equal(npc.spriteAppearance,c.spriteAppearance);assert.equal(npc.storyProfile.personality,c.personality);
 const invalid=JSON.parse(encodeSave(pair.campaign,pair.battle));invalid.battle.npcs.find(n=>n.id===npc.id).storyProfile.personality='Changed';assert.throws(()=>decodeSave(JSON.stringify(invalid)),/voz o apariencia/);
});

test('malformed voice and missing art choices fail before launch; older packages preserve existing profiles',()=>{
 for(const mutate of [c=>c.personality=null,c=>c.personality='x'.repeat(2001),c=>c.speech.hired='x'.repeat(801),c=>delete c.speech.death,c=>c.speech.extra='Unknown',c=>c.speech=[],c=>c.spriteAppearance='missing',c=>c.spriteAppearance=['granadero']]){const d=definition();mutate(d.characters.at(-1));assert.ok(validateContentPackage(d).length);assert.throws(()=>initialCampaign(42,d));}
 const d=defaultContentPackage();for(const c of d.characters)for(const key of ['personality','speech','spriteAppearance'])delete c[key];
 let s=initialCampaign(42,d),op=rosterFor(s).find(o=>o.id===100);assert.equal(op.storyProfile,undefined);assert.equal(speechFor(op,'wounded'),speechFor(rosterFor(initialCampaign()).find(o=>o.id===100),'wounded'));
 s=order(s,{type:'recruitCivic',id:100,term:'week'});s=order(s,{type:'wait',hours:6});s=order(saved(s).campaign,{type:'visitSector'});assert.ok(saved(s,enterSector(s.pendingBattle)));
});


test('local recruits require a meeting in explicitly controlled territory',()=>{
 for(const [target,sector] of [[3,'retiro'],[4,'buenos_aires'],[10,'buenos_aires']]){
  const d=definition();d.characters.at(-1).attributes.leadership=100;d.characters.find(c=>c.id===`person-${target}`).abilities=['rapid_first_aid'];
  if(target===3){const c=d.characters.find(c=>c.id==='person-3');c.name='A'.repeat(100);c.speech.hired='B'.repeat(800);}
  let {s,id}=hired(d);secureArea(s,'buenos_aires');
  assert.ok(dispatchCampaign(s,{type:'recruit',id:target}).lastError);
  if(s.location!==sector)s=order(s,{type:'travel',sector});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);
  const npc=b.npcs.find(n=>n.operativeId===target),spot=getReachable(b,String(id)).find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(spot);
  b=actBattle(b,{type:'move',unitId:String(id),x:spot.x,y:spot.y});assert.equal(b.lastError,null);const pair=syncBattleTime(s,b);assert.equal(pair.error,null);
  s=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:id,approach:'recruit',sectorState:pair.battle});assert.ok(s.recruited.includes(target));
  // Same physical NPC-to-soldier transition as the actual game screen.
  b=pair.battle;b.npcs=b.npcs.filter(n=>n.id!==npc.id);const record=s.pendingBattle.squad.find(o=>o.id===target);
  const joined=createBattle([record],{width:b.width,height:b.height,enemies:[],exploration:true}).units[0];b.units.push({...joined,x:npc.x,y:npc.y});
  const restored=saved(s,b);assert.deepEqual(restored.battle.units.find(u=>u.id===String(target)).abilities,['rapid_first_aid']);assert.equal(speechFor(restored.battle.units.find(u=>u.id===String(target)),'hired'),d.characters.find(c=>c.id===`person-${target}`).speech.hired);
 }
});


test('ordinary saves cannot inject an unbound authored voice',()=>{
 let s=order(initialCampaign(42),{type:'recruitCivic',id:100,term:'week'});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);
 b.units[0].storyProfile={speech:null};assert.throws(()=>saved(s,b),/voz o apariencia/);
});
