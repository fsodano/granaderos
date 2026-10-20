import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,campaignDate} from '../game/campaign.js';
import {contractStatus} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';

const read=path=>JSON.parse(readFileSync(new URL(`../campaigns/granaderos/${path}`,import.meta.url),'utf8'));
const manifest=read('manifest.json');
const installed=()=>compileCampaignPackage(manifest,{content:read(manifest.content),world:read(manifest.world),maps:Object.fromEntries(read(manifest.maps).maps.map(row=>[row.id,read(`maps/${row.path}`)])),presentation:read(manifest.presentation),assets:read(manifest.assets)});
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));

test('installed Granaderos starts at 09:00 on day one and opens Retiro in daylight',()=>{
 let state=initialCampaign(1812,installed());
 assert.deepEqual(campaignDate(state),{year:1812,month:3,day:1,hour:9});
 assert.equal(state.secondOfHour??0,0);assert.ok(state.log.every(entry=>entry.hour===9));
 assert.equal(state.contentPresence.minute,9*60);assert.equal(state.horseState.hour,9);
 state=order(state,{type:'createOfficer',name:'Ana Prueba',answers:{origin:'estancia',doctrine:'line_marksman',crisis:'rescue'}});
 state=order(state,{type:'visitSector'});const battle=enterSector(state.pendingBattle);
 assert.equal(state.pendingBattle.hour,9);assert.equal(state.pendingBattle.night,false);assert.equal(battle.night,false);
 const restored=saved(state,battle);assert.deepEqual(restored.campaign,state);assert.deepEqual(restored.battle,battle);
});

test('the first midnight advances the date after fifteen hours and saved time does not reset',()=>{
 let state=order(initialCampaign(1812,installed()),{type:'wait',hours:14});
 assert.deepEqual(campaignDate(state),{year:1812,month:3,day:1,hour:23});
 state=saved(state).campaign;
 state=order(state,{type:'advanceStrategicTime',seconds:3599});
 assert.equal(state.hour,23);assert.equal(state.secondOfHour,3599);assert.deepEqual(saved(state).campaign,state);
 state=order(state,{type:'advanceStrategicTime',seconds:1});
 assert.deepEqual(campaignDate(state),{year:1812,month:3,day:2,hour:0});assert.equal(state.secondOfHour,0);
 assert.deepEqual(saved(state).campaign,state);
});

test('a day contract hired at 09:00 warns and expires at its full duration',()=>{
 let state=order(initialCampaign(1812,installed()),{type:'recruitCivic',id:110,term:'day'});
 assert.equal(state.hiringArrivals.length,0);assert.equal(state.contracts[110].started,9);assert.equal(state.contracts[110].expiresAt,33);
 assert.equal(contractStatus(state,110).remaining,24);
 state=order(state,{type:'wait',hours:24});
 assert.equal(state.hour,31);assert.equal(state.contractAttention.notice.events[0].code,'expiring');assert.equal(contractStatus(state,110).remaining,2);
 state=order(saved(state).campaign,{type:'wait',hours:1});
 assert.equal(state.hour,32);assert.equal(contractStatus(state,110).remaining,1);assert.ok(state.recruited.includes(110));
 state=order(state,{type:'wait',hours:1});
 assert.equal(state.hour,33);assert.equal(state.contractAttention.notice.events[0].code,'expired');assert.ok(!state.recruited.includes(110));
 assert.deepEqual(saved(state).campaign,state);
});

test('omitted start hours preserve midnight and old saves retain their clock',()=>{
 assert.equal(initialCampaign().hour,0);
 const content=structuredClone(installed());delete content.rules.startingHour;
 let old=initialCampaign(1812,content);assert.equal(old.hour,0);
 old=order(old,{type:'advanceStrategicTime',seconds:123});
 assert.equal(old.hour,0);assert.equal(old.secondOfHour,123);assert.deepEqual(saved(old).campaign,old);
 const d=scaffoldDocuments('start-hour-default');assert.equal(initialCampaign(42,compileCampaignPackage(d.manifest,d)).hour,0);
});

test('authored start hours validate their bounds and use the same clock for initial events',()=>{
 for(const hour of [-1,24,9.5,'9',null]){
  const content=defaultContentPackage();content.rules.startingHour=hour;
  assert.ok(validateContentPackage(content).some(error=>error.includes('startingHour')));
 }
 for(const hour of [0,9,23]){
  const d=scaffoldDocuments('start-hour-authored');d.content.rules.startingHour=hour;
  d.content.campaignEvents=[{id:'initial-grant',atHour:hour,conditions:[],text:'Llega la asignación inicial.',effects:[{type:'treasury',operation:'receive',amount:50}]}];
  const state=initialCampaign(42,compileCampaignPackage(d.manifest,d));
  assert.equal(state.hour,hour);assert.equal(state.resources.treasury,d.content.rules.startingTreasury+50);
  assert.equal(state.log.find(entry=>entry.text===d.content.campaignStory.introduction)?.hour,hour);
  assert.deepEqual(state.campaignEventState.receipts,[{event:'initial-grant',hour,outcome:'applied',amount:50}]);
  assert.deepEqual(saved(state).campaign,state);
  if(hour>0){d.content.campaignEvents[0].atHour=hour-1;assert.throws(()=>compileCampaignPackage(d.manifest,d),/antes de la hora inicial/);}
 }
});
