import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,campaignObjectives,availableActions} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory,campaignChapterIndex} from '../game/campaign-story.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {questPackage} from './content-quest-fixture.mjs';
import {order,saved,readyLocal,talk,leave,tactical} from './local-contract-fixture.mjs';
const chapter=(id,conditions)=>({id,name:`Objetivo ${id}`,objective:`Cumplir ${id}.`,conditions});
const day=min=>({type:'day',min,max:null});
const story=()=>({...defaultCampaignStory(),introduction:'Cuidá el puesto de la ribera.',victory:'El parte llegó a destino.',defeat:'Se perdió el parte.'});
const content=()=>({...defaultContentPackage(),campaignStory:story()});
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});
const fixture=()=>{const d=questPackage();d.campaignStory=story();d.campaignStory.chapters=[chapter('service',[{type:'character',character:'person-110',state:'serving'}]),chapter('report',[{type:'quest',quest:'river-post',status:'completed'}])];return d;};

test('authored chapters validate bounded definitions, references and campaign-only conditions while legacy packages retain their phases',()=>{
 for(const mutate of [d=>d.campaignStory={},d=>d.campaignStory.chapters=[],d=>d.campaignStory.chapters=Array(13).fill(d.campaignStory.chapters[0]),d=>d.campaignStory.chapters.push(structuredClone(d.campaignStory.chapters[0])),d=>d.campaignStory.victory='',d=>d.campaignStory.defeat='x'.repeat(1001),d=>d.campaignStory.chapters[0].conditions=[],d=>d.campaignStory.chapters[0].conditions=[{type:'meeting',character:'person-3'}],d=>d.campaignStory.chapters[0].conditions=[{type:'character',character:'missing',state:'alive'}],d=>d.campaignStory.failureConditions=[{type:'quest',quest:'missing',status:'failed'}],d=>d.campaignStory.chapters[0].reward=100,d=>d.campaignStory.chapters[0].id='constructor',d=>d.campaignStory.failureConditions=null]){const d=content();mutate(d);assert.throws(()=>initialCampaign(42,d));}
 const d=content();d.campaignStory.chapters=Array.from({length:12},(_,i)=>chapter(`step-${i}`,[day(i+2)]));assert.equal(campaignObjectives(initialCampaign(42,d)).length,12);
 for(const original of [null,defaultContentPackage(),{...defaultContentPackage(),campaignStory:null}]){const s=initialCampaign(42,original);assert.equal(campaignObjectives(s).length,5);assert.equal(s.campaignProgress,undefined);assert.equal(saved({campaign:s}).campaign.phase,0);}
});

test('paid arrival advances an authored service objective once without unlocking original history, then a real dialogue resolves the campaign after leaving',()=>{
 let p=readyLocal(undefined,fixture());assert.equal(p.campaign.phase,0);assert.equal(p.campaign.campaignProgress.completed.length,1);assert.equal(p.campaign.campaignProgress.completed[0].chapter,'service');assert.equal(p.campaign.flags.academy,false);assert.equal(p.campaign.completed,false);assert.equal(availableActions(p.campaign).phase.id,'report');assert.equal(campaignChapterIndex(p.campaign),1);
 assert.equal(campaignObjectives(p.campaign)[0].complete,true);assert.equal(campaignObjectives(p.campaign)[1].active,true);
 p=saved(choose(choose(p,'start','accept'),'active','complete'));assert.equal(p.campaign.completed,false);assert.equal(p.campaign.campaignProgress.completed.length,1);const cash=p.campaign.resources.treasury;
 let s=saved({campaign:leave(p)}).campaign;assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.flags.sanLorenzo,false);assert.equal(s.phase,0);assert.equal(s.campaignProgress.completed.length,2);assert.equal(s.campaignProgress.outcome.type,'victory');assert.ok(s.resources.treasury>=cash);assert.ok(campaignObjectives(s).every(c=>c.complete&&!c.active));
 const receipts=structuredClone(s.campaignProgress);s=saved({campaign:order(s,{type:'wait',hours:2})}).campaign;assert.deepEqual(s.campaignProgress,receipts);assert.equal(s.log.filter(e=>e.text===story().victory).length,1);assert.equal(s.log.filter(e=>e.text==='Objetivo cumplido: Objetivo service.').length,1);
 assert.match(dispatchCampaign(s,{type:'attack',sector:'san_lorenzo'}).lastError,/ganada/);
});

test('chapters run in order, keep achieved objectives and do not confuse their index with historical mission gates',()=>{
 const d=content();d.campaignStory.chapters=[chapter('wait',[day(2)]),chapter('already-owned',[{type:'sector',sector:'retiro',owner:'patriot'}]),chapter('later',[day(3)])];let s=initialCampaign(42,d);
 s=order(s,{type:'wait',hours:1});assert.equal(s.campaignProgress.completed.length,0);
 s=saved({campaign:order(s,{type:'wait',hours:23})}).campaign;assert.deepEqual(s.campaignProgress.completed.map(e=>e.chapter),['wait','already-owned']);assert.equal(s.phase,0);assert.equal(campaignChapterIndex(s),2);assert.equal(s.completed,false);assert.match(dispatchCampaign(s,{type:'visitMission',mission:'yatasto'}).lastError,/propios objetivos/);
 s=saved({campaign:order(s,{type:'wait',hours:24})}).campaign;assert.equal(s.completed,true);assert.equal(s.campaignProgress.completed.length,3);
});

test('quest failure defeats the campaign inside a scene, preserves the actual failure and permits safe return without later victory',()=>{
 const d=fixture();d.campaignStory.failureConditions=[{type:'quest',quest:'river-post',status:'failed'}];let p=choose(readyLocal(undefined,d),'start','accept');p=saved(choose(p,'active','fail'));assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.equal(p.campaign.campaignProgress.outcome.type,'defeat');assert.equal(p.campaign.contentQuestEvents.at(-1).to,'failed');
 const history=structuredClone(p.campaign.campaignProgress);const s=saved({campaign:leave(p)}).campaign;assert.deepEqual(s.campaignProgress,history);assert.equal(s.pendingBattle,null);assert.equal(s.log.filter(e=>e.text===story().defeat).length,1);assert.match(dispatchCampaign(s,{type:'wait',hours:1}).lastError,/terminado/);
});

test('an actual quest deadline and headquarters loss take priority over a simultaneous chapter victory',()=>{
 const d=fixture();d.quests[0].deadlineHours=22;d.campaignStory.failureConditions=[{type:'quest',quest:'river-post',status:'failed'}];d.campaignStory.chapters=[chapter('survive',[day(2)])];let p=choose(readyLocal(undefined,d),'start','accept');
 let s=order(leave(p),{type:'wait',hours:24});assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.equal(s.hour,24);assert.equal(s.contentQuestEvents.at(-1).to,'failed');assert.ok(saved({campaign:s}));
 const h=content();h.campaignStory.chapters=[chapter('owned',[day(1)])];s=initialCampaign(42,h);s.sectors.retiro.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.completed,false);assert.equal(s.defeated,true);assert.deepEqual(s.campaignProgress.completed,[]);assert.ok(saved({campaign:s}));
});

test('authored outcome precedence rejects victory when all failure conditions also become true',()=>{
 const d=content();d.campaignStory.failureConditions=[day(2),{type:'treasury',min:0,max:null}];let s=initialCampaign(42,d);s=order(s,{type:'wait',hours:24});assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.equal(s.campaignProgress.completed.length,0);assert.ok(saved({campaign:s}));
});

test('chapter history admission rejects missing, reordered, future, extra and inconsistent records and modified pinned definitions',()=>{
 const d=content();d.campaignStory.chapters=[chapter('one',[day(1)]),chapter('two',[day(2)])];const s=order(initialCampaign(42,d),{type:'wait',hours:24}),wire=encodeSave(s);
 for(const mutate of [s=>delete s.campaignProgress,s=>s.campaignProgress.completed.reverse(),s=>s.campaignProgress.completed.pop(),s=>s.campaignProgress.completed[0].hour=25,s=>s.campaignProgress.completed[0].secondOfHour=3600,s=>s.campaignProgress.completed[0].extra=1,s=>s.campaignProgress.outcome=null,s=>s.campaignProgress.outcome.type='defeat',s=>s.completed=false,s=>s.defeated=true,s=>s.phase=1,s=>s.contentCampaign.package.campaignStory.victory='Otra victoria']){const v=JSON.parse(wire);mutate(v.campaign);assert.throws(()=>decodeSave(JSON.stringify(v)),/avance|identidad/);}
 d.campaignStory.chapters[0].name='Changed draft';assert.equal(saved({campaign:s}).campaign.contentCampaign.package.campaignStory.chapters[0].name,'Objetivo one');
 const old=initialCampaign();old.campaignProgress={version:1,completed:[],outcome:null};assert.throws(()=>saved({campaign:old}),/capítulos propios/);
});

test('a completed service chapter survives the actual contract expiry without repeating or losing its saved result',()=>{
 const d=content();d.campaignStory.chapters=[chapter('serve',[{type:'character',character:'person-100',state:'serving'}]),chapter('third-day',[day(3)])];let s=order(initialCampaign(42,d),{type:'recruitCivic',id:100,term:'day'});assert.equal(s.campaignProgress.completed.length,0);s=order(s,{type:'wait',hours:6});assert.equal(s.campaignProgress.completed.length,1);const event=structuredClone(s.campaignProgress.completed[0]);s=saved({campaign:order(s,{type:'wait',hours:42})}).campaign;assert.equal(s.recruited.includes(100),false);assert.equal(s.completed,true);assert.deepEqual(s.campaignProgress.completed[0],event);
});

test('an authored death condition uses an actual tactical death and historical names do not impose an implicit custom-story defeat',async()=>{
 const {getReachable}=await import('../game/tactical.js');
 for(const critical of [false,true]){
  const d=fixture();const c=d.characters.find(c=>c.id==='person-57');c.attributes.maxHp=30;c.abilities=[];d.placements.find(p=>p.character===c.id).sectors=[d.placements.at(-1).sectors[0]];d.campaignStory.chapters=[chapter('later',[day(50)])];d.campaignStory.failureConditions=critical?[{type:'character',character:c.id,state:'dead'}]:[];
  let p=readyLocal(undefined,d);const target=()=>p.battle.npcs.find(n=>n.operativeId===57),unit=p.battle.units.find(u=>u.side==='player'),tile=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-target().x)+Math.abs(t.y-target().y)===1);assert.ok(tile);if(tile.cost)p=tactical(p,{type:'move',x:tile.x,y:tile.y});
  for(let i=0;i<6&&target().hp>0;i++)p=tactical(p,{type:'melee',targetId:target().id});assert.equal(target().hp,0);p=saved(p);assert.equal(p.campaign.operativeState[57].alive,false);assert.equal(p.campaign.defeated,critical);assert.equal(p.campaign.campaignProgress.outcome?.type??null,critical?'defeat':null);assert.ok(saved({campaign:leave(p)}));
 }
});

test('a campaign ending during the approach prevents a new battle, and a defeat during travel keeps the last reached locality',()=>{
 for(const mode of ['victory-attack','defeat-attack','defeat-travel']){
  const d=content();d.characters.find(c=>c.id==='person-110').arrivalHours=0;if(mode==='defeat-travel')d.startingTerritory.buenos_aires.owner='patriot';if(mode.startsWith('defeat'))d.campaignStory.failureConditions=[day(2)];
  let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'wait',hours:20});s=order(s,{type:mode.endsWith('travel')?'travel':'attack',sector:'buenos_aires'});assert.equal(s.pendingBattle,null,mode);assert.equal(s.location,'retiro',mode);assert.equal(s.completed,mode.startsWith('victory'));assert.equal(s.defeated,mode.startsWith('defeat'));assert.ok(saved({campaign:s}));
 }
});
