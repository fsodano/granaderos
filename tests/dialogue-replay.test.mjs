import {withCarriedPonchos} from './custody-gear-fixture.mjs';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,recruitmentStatus,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';import {encodeSave,decodeSave} from '../game/save.js';
import {initialCampaign as legacyCampaign} from './legacy-campaign-fixture.mjs';
import {syncBattleTime} from '../game/time.js';
import {createBattle} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
import {defaultErrands} from '../game/quest-definitions.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const officer=(oldChoice=false)=>{
 const initial=initialCampaign(8);
 if(oldChoice)initial.errandDefinitions=defaultErrands().map(q=>q.id==='retiro-uniformes'?{...q,reward:{treasury:0,loyalty:false},rewardChoice:{reimbursement:40}}:q);
 return order(initial,{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
};
function meet(npcId='local-retiro',sector='retiro',campaign=officer()){
 let s=campaign;if(sector!=='retiro')secureArea(s);if(s.location!==sector)s=order(s,{type:'travel',sector});s=order(s,{type:'visitSector'});const b=approachNPC(enterSector(s.pendingBattle),'1000',npcId),pair=syncBattleTime(s,b);assert.equal(pair.error,null);return {s:pair.campaign,b:pair.battle};
}
const talk=(s,b,npcId,approach)=>order(s,{type:'talkNPC',unitId:1000,npcId,approach,sectorState:b});
const save=s=>{assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);return s;};
function fullSave(s,b){const pair=syncBattleTime(s,b);assert.equal(pair.error,null);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).campaign,pair.campaign);return pair;}
function repeatUnchanged(s,b,npcId,text){const pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;const n=talk(s,b,npcId,'repeat');assert.equal(n.lastConversation.text,text);assert.equal(n.lastConversation.outcome,'repeated');const omit=c=>{const{conversations,lastConversation,...rest}=c;return rest;};assert.deepEqual(omit(n),omit(s));save(n);return n;}

test('replay uses the last reply from that NPC and never reoffers or repays a quest',()=>{
 let supplied=withCarriedPonchos(officer(true),1000,2);let {s,b}=meet('local-retiro','retiro',supplied);const npc=b.npcs.find(n=>n.id==='local-retiro');s=repeatUnchanged(s,b,npc.id,npc.greeting);assert.equal(s.quests['retiro-uniformes'],undefined);
 s=talk(s,b,npc.id,'quest');const offer=s.lastConversation.text;s=repeatUnchanged(s,b,npc.id,offer);assert.equal(s.quests['retiro-uniformes'].status,'offered');
 b=deliverPonchos(b);const synced=syncBattleTime(s,b);assert.equal(synced.error,null);s=synced.campaign;b=synced.battle;const pending=s.lastConversation.text,cash=s.resources.treasury,gifts=structuredClone(b.npcs.find(n=>n.id===npc.id).questGifts);assert.equal(gifts.length,2);assert.equal(s.quests['retiro-uniformes'].status,'offered');s=repeatUnchanged(s,b,npc.id,pending);
 s=order(s,{type:'talkNPC',unitId:1000,npcId:npc.id,approach:'quest',questResolution:'civic',sectorState:b});const delivered=s.lastConversation.text;assert.equal(s.quests['retiro-uniformes'].status,'completed');assert.equal(s.quests['retiro-uniformes'].questResolution,'civic');s=repeatUnchanged(s,b,npc.id,delivered);assert.ok(!s.lastConversation.options.includes('quest'));
 b=approachNPC(b,'1000','cabral');s=talk(s,b,'cabral','direct');assert.notEqual(s.lastConversation.text,delivered);save(s);({campaign:s,battle:b}=fullSave(s,b));
 b=approachNPC(b,'1000',npc.id);s=repeatUnchanged(s,b,npc.id,delivered);assert.equal(s.resources.treasury,cash);assert.deepEqual(b.npcs.find(n=>n.id===npc.id).questGifts,gifts);
});

test('fresh campaign dialogue can recruit Cabral, Dorrego and Paroissien after their local gates pass',()=>{
 for(const [npcId,id,sector] of [['cabral',3,'retiro'],['dorrego',4,'buenos_aires'],['paroissien',10,'buenos_aires']]){
  let {s,b}=meet(npcId,sector);assert.equal(recruitmentStatus(s,id).available,false,'remote recruitment still requires a meeting');
  s=talk(s,b,npcId,'direct');assert.match(s.lastConversation.text,/Estoy dispuesto/);assert.ok(!s.recruited.includes(id));const reply=s.lastConversation.text;s=repeatUnchanged(s,b,npcId,reply);
  s=talk(s,b,npcId,'recruit');assert.ok(s.recruited.includes(id));assert.ok(s.pendingBattle.squad.some(u=>u.id===id));assert.equal(s.lastConversation.outcome,'recruited');assert.ok(!s.lastConversation.options.includes('recruit'));
  const record=s.pendingBattle.squad.find(u=>u.id===id),npc=b.npcs.find(n=>n.id===npcId);const unit=createBattle([record],{width:b.width,height:b.height,enemies:[],exploration:true}).units.find(u=>u.side==='player');b.units.push({...unit,x:npc.x,y:npc.y});b.npcs=b.npcs.filter(n=>n.id!==npcId);({campaign:s,battle:b}=fullSave(s,b));const rejected=dispatchCampaign(s,{type:'talkNPC',unitId:1000,npcId,approach:'repeat',sectorState:b});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},s);assert.equal(s.recruited.filter(value=>value===id).length,1);
 }
});

test('direct questions report the current leadership, territorial or regional requirement without recruiting',()=>{
 let s=legacyCampaign(8);s.sectors.san_nicolas.owner='patriot';s=order(s,{type:'travel',sector:'ensenada'});s=order(s,{type:'visitSector'});let b=approachNPC(enterSector(s.pendingBattle),'3','brown');
 const direct=id=>{s=order(s,{type:'talkNPC',unitId:id,npcId:'brown',approach:'direct',sectorState:b});};
 direct(3);assert.match(s.lastConversation.text,/65.*liderazgo/);assert.ok(!s.recruited.includes(5));
 b=approachNPC(b,'4','brown');s.sectors.san_nicolas.owner='royalist';direct(4);assert.match(s.lastConversation.text,/3 localidades/);
 s.sectors.san_nicolas.owner='patriot';s.reputation.foreign=0;direct(4);assert.match(s.lastConversation.text,/comercio.*30.*extranjeros/);
 s.reputation.foreign=30;direct(4);assert.match(s.lastConversation.text,/Estoy dispuesto/);assert.ok(!s.recruited.includes(5));
});

test('replaying a mission report cannot advance the conference a second time',()=>{
 let s=secureArea(officer());s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;for(const id of ['cordoba','tucuman','salta'])s.sectors[id].owner='patriot';s=completeTestTravel(s,{sector:'tucuman'});s=order(s,{type:'visitMission',mission:'yatasto'});let b=approachNPC(enterSector(s.pendingBattle),'1000','yatasto-belgrano');
 s=talk(s,b,'yatasto-belgrano','mission');s=repeatUnchanged(s,b,'yatasto-belgrano',s.lastConversation.text);
 b=approachNPC(b,'1000','yatasto-san-martin');s=talk(s,b,'yatasto-san-martin','mission');const mission=structuredClone(s.missions);s=repeatUnchanged(s,b,'yatasto-san-martin',s.lastConversation.text);assert.deepEqual(s.missions,mission);assert.notEqual(s.missions.yatasto.stage,'completed');
});

test('replay requires a local available speaker and rejects malformed saved per-character replies',()=>{
 let {s,b}=meet();s=talk(s,b,'local-retiro','friendly');
 for(const change of [unit=>unit.x=0,unit=>unit.unconscious=true,unit=>unit.energy=0]){const bad=structuredClone(b);change(bad.units[0]);const n=dispatchCampaign(s,{type:'talkNPC',unitId:1000,npcId:'local-retiro',approach:'repeat',sectorState:bad});assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},{...s,lastError:null});}
 for(const value of [null,42,'','x'.repeat(2000)]){const bad=structuredClone(s);bad.conversations['local-retiro'].text=value;assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 const future=structuredClone(s);future.conversations['local-retiro'].hour=s.hour+1;assert.throws(()=>restoreCampaign(serializeCampaign(future)));
});
