import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';

const event=(id,atHour,effects=[],conditions=[])=>({id,atHour,conditions,text:`Evento ${id}.`,effects});
const money=(amount,operation='receive')=>({type:'treasury',operation,amount});
const quest=status=>({type:'quest',quest:'orders',status});
const questCondition=status=>({type:'quest',quest:'orders',status});
function documents(events){
 const d=scaffoldDocuments('event-fixture');
 d.content.quests=[{id:'orders',title:'El parte',description:'Transmitir un parte.'}];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 if(events!==undefined)d.content.campaignEvents=events;
 return d;
}
const start=events=>{const d=documents(events);return initialCampaign(42,compileCampaignPackage(d.manifest,d));};
const reload=s=>restoreCampaign(serializeCampaign(s));
const wait=(s,hours)=>order(s,{type:'wait',hours});
const receipt=(s,id)=>s.campaignEventState.receipts.find(r=>r.event===id);

test('events run at initialization and exact scheduled hours, then remain consumed through save and continue',()=>{
 const events=[event('initial-grant',0,[money(50)]),event('start-orders',1,[quest('active')]),event('complete-orders',2,[quest('completed'),money(150)],[questCondition('active')]),event('pay-courier',3,[money(100,'pay')]),event('wealth-test',4,[money(10)],[{type:'treasury',min:5000,max:null}]),event('cannot-reopen',5,[quest('active'),money(999)]),event('unaffordable',6,[money(1000000,'pay')])];
 let s=start(events);assert.equal(s.resources.treasury,1050);assert.equal(receipt(s,'initial-grant').outcome,'applied');
 s=reload(wait(s,1));assert.equal(contentQuestStatus(s,'orders'),'active');s=reload(wait(s,2));assert.equal(s.resources.treasury,1100);assert.equal(contentQuestStatus(s,'orders'),'completed');
 s=reload(wait(s,3));assert.equal(s.hour,6);assert.equal(s.resources.treasury,1100);assert.deepEqual(s.campaignEventState.receipts.map(r=>r.outcome),['applied','applied','applied','applied','skipped','skipped','skipped']);
 const state=structuredClone(s.campaignEventState),transitions=structuredClone(s.contentQuestEvents);
 s=wait(reload(s),1);assert.deepEqual(s.campaignEventState,state);assert.deepEqual(s.contentQuestEvents,transitions);assert.equal(s.log.filter(l=>l.text==='Evento complete-orders.').length,1);assert.equal(s.completed,false);
 let short=start(events);for(let i=0;i<6;i++)short=reload(wait(short,1));assert.deepEqual(short.campaignEventState,state);assert.deepEqual(short.contentQuestEvents,transitions);assert.equal(short.resources.treasury,1100);
});

test('a fractional wait crosses the real event hour instead of its fractional endpoint',()=>{
 let s=order(start([event('start-orders',1,[quest('active'),money(50)]),event('complete-orders',2,[quest('completed')])]),{type:'advanceStrategicTime',seconds:1800});
 assert.equal(s.hour,0);assert.equal(s.secondOfHour,1800);s=reload(wait(s,1));assert.equal(s.hour,1);assert.equal(s.secondOfHour,1800);assert.deepEqual(receipt(s,'start-orders'),{event:'start-orders',hour:1,outcome:'applied',amount:50});assert.equal(s.contentQuestEvents[0].secondOfHour,0);
 s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(s.hour,2);assert.equal(s.secondOfHour,0);assert.equal(contentQuestStatus(s,'orders'),'completed');assert.deepEqual(reload(s).campaignEventState,s.campaignEventState);
});

test('events at the same hour use stable id order and shared quest conditions',()=>{
 const s=wait(start([event('b-complete',1,[quest('completed'),money(25)],[questCondition('active')]),event('a-start',1,[quest('active')])]),1);
 assert.deepEqual(s.campaignEventState.receipts.map(r=>r.event),['a-start','b-complete']);assert.equal(contentQuestStatus(s,'orders'),'completed');assert.equal(s.resources.treasury,1025);assert.deepEqual(reload(s).contentQuestEvents,s.contentQuestEvents);
});

test('a skipped event cannot grant a late reward after its condition changes',()=>{
 let s=start([event('early-wealth',1,[money(80)],[{type:'treasury',min:1100,max:null}]),event('later-grant',2,[money(1000)])]);s=reload(wait(s,2));assert.equal(s.resources.treasury,2000);assert.equal(receipt(s,'early-wealth').outcome,'skipped');s=wait(reload(s),3);assert.equal(s.resources.treasury,2000);assert.equal(s.log.some(l=>l.text==='Evento early-wealth.'),false);
});

test('the quest deadline has precedence over a completion event at the same instant',()=>{
 const d=documents([event('start-orders',1,[quest('active')]),event('late-completion',3,[quest('completed'),money(200)]),event('expired-condition',3,[money(50)],[questCondition('active')])]);d.content.quests[0].deadlineHours=2;
 const s=wait(initialCampaign(42,compileCampaignPackage(d.manifest,d)),3);assert.equal(contentQuestStatus(s,'orders'),'failed');assert.equal(s.resources.treasury,1000);assert.equal(receipt(s,'late-completion').outcome,'skipped');assert.equal(s.contentQuestEvents.at(-1).deadline,3*3600);assert.deepEqual(reload(s).contentQuestEvents,s.contentQuestEvents);
 assert.equal(receipt(s,'expired-condition').outcome,'skipped');
});

test('an hour-zero quest event updates the authored chapter before play begins',()=>{
 const d=documents([event('initial-orders',0,[quest('active')])]);d.content.campaignStory.chapters[0].conditions=[questCondition('active')];const s=initialCampaign(42,compileCampaignPackage(d.manifest,d));assert.equal(contentQuestStatus(s,'orders'),'active');assert.equal(s.completed,true);assert.deepEqual(reload(s).campaignProgress,s.campaignProgress);
});

test('tactical time, save, leave and re-entry use the same one-time event receipt',()=>{
 let s=start([event('field-grant',1,[money(75)])]);const id=operativeIdForCharacter(s.contentCampaign.package,'guide');s=order(s,{type:'recruitCivic',id,term:'day',destination:'camp'});let p=visit(s),before=p.campaign.resources.treasury;
 p.battle.elapsedSeconds=3599;p=sync(p);assert.equal(p.campaign.campaignEventState.receipts.length,0);p.battle.elapsedSeconds=3600;p=saved(sync(p));assert.equal(p.campaign.resources.treasury,before+75);assert.equal(receipt(p.campaign,'field-grant').hour,1);
 s=leave(p);p=visit(s);p.battle.elapsedSeconds=3600;p=saved(sync(p));assert.equal(p.campaign.resources.treasury,before+75);assert.equal(p.campaign.campaignEventState.receipts.length,1);assert.equal(p.campaign.log.filter(l=>l.text==='Evento field-grant.').length,1);
});

test('save admission rejects forged event receipts and missing or altered quest sources',()=>{
 const s=wait(start([event('a-start',1,[quest('active'),money(25)]),event('b-complete',2,[quest('completed'),money(50)])]),2),wire=serializeCampaign(s);
 const mutations=[s=>delete s.campaignEventState,s=>s.campaignEventState.receipts.pop(),s=>s.campaignEventState.receipts.push(structuredClone(s.campaignEventState.receipts[0])),s=>s.campaignEventState.receipts.reverse(),s=>s.campaignEventState.receipts[0].event='missing',s=>s.campaignEventState.receipts[0].hour=3,s=>s.campaignEventState.receipts[0].amount++,s=>s.campaignEventState.receipts[0].outcome='unknown',s=>s.campaignEventState.receipts[0].extra=true,s=>delete s.contentQuestEvents,s=>s.contentQuestEvents[0].campaignEvent='b-complete',s=>s.contentQuestEvents[0].from='active',s=>s.contentQuestEvents[0].to='failed',s=>s.contentQuestEvents[0].quest='missing',s=>s.contentQuestEvents[0].secondOfHour=1,s=>{s.campaignEventState.receipts[0].outcome='skipped';s.campaignEventState.receipts[0].amount=0;}];
 for(const mutate of mutations){const forged=JSON.parse(wire);mutate(forged);assert.throws(()=>restoreCampaign(JSON.stringify(forged)),/evento|encargo|registro|secuencia/);}
});

test('event admission rejects code, meetings, repeated operations and malformed or unbounded definitions',()=>{
 const mutations=[d=>d.content.campaignEvents=null,d=>d.content.campaignEvents=Array.from({length:101},(_,i)=>event(`event-${i}`,i)),d=>d.content.campaignEvents[0].id='constructor',d=>d.content.campaignEvents.push(structuredClone(d.content.campaignEvents[0])),d=>d.content.campaignEvents[0].atHour=-1,d=>d.content.campaignEvents[0].atHour=0.5,d=>d.content.campaignEvents[0].atHour=876001,d=>d.content.campaignEvents[0].conditions=[{type:'meeting',character:'guide'}],d=>d.content.campaignEvents[0].conditions=Array.from({length:7},()=>({type:'day',min:1,max:null})),d=>d.content.campaignEvents[0].conditions=[{type:'sector',sector:'missing',owner:'patriot'}],d=>d.content.campaignEvents[0].text='',d=>d.content.campaignEvents[0].text='x'.repeat(1001),d=>d.content.campaignEvents[0].effects=[{type:'movement',character:'guide',destination:'routine'}],d=>d.content.campaignEvents[0].effects=[money(1),money(2)],d=>d.content.campaignEvents[0].effects=[money(1000001)],d=>d.content.campaignEvents[0].effects=[money(1,'invent')],d=>d.content.campaignEvents[0].effects=[{type:'quest',quest:'missing',status:'active'}],d=>d.content.campaignEvents[0].effects=[quest('not-started')],d=>d.content.campaignEvents[0].script='eval()',d=>d.content.campaignEvents[0].effects=null];
 for(const mutate of mutations){const d=documents([event('grant',1,[money(1)])]);mutate(d);assert.throws(()=>compileCampaignPackage(d.manifest,d),/evento|condici|operaci|importe|encargo/);}
});

test('campaigns without authored events preserve the absent receipt state and reject an injected ledger',()=>{
 for(const s of [initialCampaign(42),start(undefined),start([])]){assert.equal(Object.hasOwn(s,'campaignEventState'),false);assert.deepEqual(reload(s),s);const forged=JSON.parse(serializeCampaign(s));forged.campaignEventState={version:1,receipts:[]};assert.throws(()=>restoreCampaign(JSON.stringify(forged)),/eventos/);}
});
