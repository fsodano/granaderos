import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {worldCell,worldOwner} from '../game/world-cells.js';
import {sleepRecovery} from '../game/sleep-needs.js';
import {mountainApproachSleepHours,mountainLosPatosDeparturePlan,prepareMountainApproachSleep} from './fresh-mountain-route.mjs';

const ids=[101,130,103,107],clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};
function setup({march=true,treasury=20000,pay=300,tired=false,wounded=false,term='week'}={}){
 const content=defaultContentPackage();content.headquarters='mendoza';content.startingTerritory=defaultStartingTerritory('mendoza');content.startingTerritory.uspallata={owner:'patriot',loyalty:65};content.rules.startingTreasury=treasury;
 for(const id of ids){
  const p=content.characters.find(p=>p.id===`person-${id}`);p.arrivalHours=0;p.monthlyPay=pay;
  if(tired)p.startingCondition={hp:p.attributes.maxHp,bleeding:0,bandaged:0,energy:30,fatigue:70};
  if(wounded&&id===ids[0])p.startingCondition={hp:40,bleeding:0,bandaged:0,energy:100,fatigue:0};
 }
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content),paid=0;
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(p=>p.id===id),term),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term});assert.equal(cash-c.resources.treasury,quote.total);paid+=quote.total;}
 const columns=[];
 for(let i=0;i<ids.length;i+=2){c=order(c,{type:'createSquad',ids:ids.slice(i,i+2),sector:'mendoza',name:'Flanco '+i});columns.push(c.activeSquadId);}
 c=order(c,{type:'transport',mode:'posta'});
 if(march){
  for(const id of columns){c=order(c,{type:'selectSquad',id});c=order(c,{type:'travel',sector:'uspallata',mode:'posta',queue:true});}
  for(let n=0;n<48&&columns.some(id=>c.squads.find(q=>q.id===id).journey);n++)c=order(c,{type:'wait',hours:1});
  assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='uspallata'&&!c.squads.find(q=>q.id===id).journey));
  const destination=worldCell('los_patos',c),origins=[`cell-${destination.col}-${destination.row-1}`,`cell-${destination.col}-${destination.row+1}`];
  for(const [i,id]of columns.entries()){c=order(c,{type:'selectSquad',id});c=order(c,{type:'travel',sector:origins[i],mode:'march',queue:true});}
  for(let n=0;n<72&&columns.some(id=>c.squads.find(q=>q.id===id).journey);n++)c=order(c,{type:'wait',hours:1});
  for(const [i,id]of columns.entries()){assert.equal(c.squads.find(q=>q.id===id).location,origins[i]);assert.equal(c.squads.find(q=>q.id===id).journey,undefined);assert.equal(worldOwner(c,origins[i]),'neutral');}
 }
 assert.deepEqual(content,declaration);return {campaign:saved(c),columns,paid};
}
function perform(start,columns){const events=[],c=prepareMountainApproachSleep(start,{columns,report:e=>events.push(e)});return {campaign:c,events,orders:events.filter(e=>e.event==='freshRouteOrder'||e.event==='freshRouteRenewal').map(e=>e.action)};}
function replay(start,result){let c=saved(start);for(const [i,a]of result.orders.entries()){c=order(c,a);if(i===Math.floor(result.orders.length/2))c=saved(c);}assert.deepEqual(saved(c),result.campaign);}
function setupRaid(){
 const d=scaffoldDocuments('approach-sleep-raid'),base=d.content.characters[0];d.content.rules.startingTreasury=3200;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.world.enemyStrategy={version:1,theaters:{frontier:{reserve:3,raidEveryHours:1,legHours:1,axis:['watch-post']}}};
 d.content.characters=Array.from({length:2},(_,i)=>({...structuredClone(base),id:'guard-'+i,name:'Guardia '+i,monthlyPay:300,arrivalHours:0}));
 const content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(d);let c=initialCampaign(42,content);
 const local=rosterFor(c).map(p=>p.id);for(const id of local)c=order(c,{type:'recruitCivic',id,term:'week',destination:'watch-post'});c=order(c,{type:'createSquad',ids:local,sector:'watch-post',name:'Guardia'});const columns=[c.activeSquadId];
 for(let n=0;!c.pendingEncounter&&n<8;n++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'watch-post');assert.deepEqual(d,declaration);return {campaign:c,columns};
}

test('actual paid flank marches stop for Native sleep at neutral origins, conserve finite kit and replay every order',()=>{
 const {campaign:start,columns}=setup(),before=structuredClone(start);assert.ok(ids.every(id=>start.operativeState[id].fatigue>0&&start.operativeState[id].energy<100));
 const result=perform(start,columns),c=result.campaign;assert.ok(result.orders.some(a=>a.type==='setSleep'));assert.ok(result.orders.some(a=>a.type==='wait'));
 const began=result.events.find(e=>e.event==='mountainApproachSleepStarted'),end=result.events.find(e=>e.event==='mountainApproachSleepComplete');assert.ok(end.elapsedSeconds>0&&end.elapsedSeconds<=began.hours*3600);
 assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squads,start.squads);
 for(const id of ids){const r=c.operativeState[id];assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);for(const key of ['hp','maxHp','bleeding','medkits','weapon','blade','inventory','location'])assert.deepEqual(r[key],start.operativeState[id][key]);}
 replay(start,result);assert.deepEqual(start,before);
});

test('the optional departure forecast pays the complete Native sleep window before daylight alignment and leaves the default route unchanged',()=>{
 const {campaign:start,columns}=setup({march:false}),before=structuredClone(start),ordinary=mountainLosPatosDeparturePlan(start,{columns,stage:'uspallata'}),sleep=mountainLosPatosDeparturePlan(start,{columns,stage:'uspallata',sleepApproaches:true});
 const rates=ids.map(id=>sleepRecovery({...rosterFor(start).find(p=>p.id===id),...start.operativeState[id]})),hours=Math.max(...rates.map(r=>Math.max(Math.ceil(100/r.fatigue),Math.ceil(100/r.energy))+1));
 assert.equal(mountainApproachSleepHours(start,columns),hours);assert.equal(sleep.sleepHours,hours);assert.equal(ordinary.sleepHours,0);assert.equal(sleep.hours,ordinary.hours+hours);assert.equal(sleep.fixedCost,ordinary.fixedCost);
 let until=clock(start)+sleep.hours*3600;while(Math.floor(until/3600)%24<6||Math.floor(until/3600)%24>10)until+=3600;
 assert.equal(sleep.assaultSeconds,until);assert.equal(sleep.horizonSeconds,until+3600);assert.deepEqual(start,before);
});

test('fully ready stopped field members need no sleep, clock advance or renewed service',()=>{
 const {campaign:start,columns}=setup({march:false}),before=structuredClone(start),result=perform(start,columns);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('a current care duty, actual travel and a wounded body cannot become a sleep-ready assault role',()=>{
 for(const variant of ['duty','travel','wound']){
  let {campaign:start,columns}=setup({march:false,wounded:variant==='wound'});
  if(variant==='duty')start=order(start,{type:'assignCare',operativeId:ids[0],assignment:'rest'});
  if(variant==='travel'){const destination=worldCell('los_patos',start);start=order(start,{type:'selectSquad',id:columns[0]});start=order(start,{type:'travel',sector:`cell-${destination.col}-${destination.row-1}`,mode:'march',queue:true});}
  const before=structuredClone(start);assert.throws(()=>prepareMountainApproachSleep(start,{columns}),/actual flank must arrive|fit active field roles/);assert.deepEqual(start,before);
 }
});

test('sleep crossing a real paid term executes the exact renewal and official saved repetition',()=>{
 let {campaign:start,columns}=setup({march:false,tired:true,term:'day'});
 const until=Math.min(...ids.map(id=>contractExpiresSeconds(start.contracts[id])))-3*3600;
 for(let n=0;clock(start)<until&&n<32;n++)start=order(start,{type:'wait',hours:1});assert.equal(clock(start),until);
 const before=structuredClone(start),result=perform(start,columns),renewals=result.events.filter(e=>e.event==='freshRouteRenewal');assert.ok(renewals.length>0);
 assert.equal(start.resources.treasury-result.campaign.resources.treasury,renewals.reduce((n,e)=>n+e.price,0));
 for(const id of ids){assert.equal(result.campaign.operativeState[id].energy,100);assert.equal(result.campaign.operativeState[id].fatigue,0);}
 replay(start,result);assert.deepEqual(start,before);
});

test('an unfunded full sleep window refuses before any Native clock or sleep order',()=>{
 let {campaign:start,columns}=setup({march:false,tired:true,term:'day',treasury:500});
 const until=Math.min(...ids.map(id=>contractExpiresSeconds(start.contracts[id])))-3*3600;
 for(let n=0;clock(start)<until&&n<32;n++)start=order(start,{type:'wait',hours:1});assert.equal(clock(start),until);
 const before=structuredClone(start),events=[];
 assert.throws(()=>prepareMountainApproachSleep(start,{columns,report:e=>events.push(e)}),/actual treasury|funded/);assert.deepEqual(events,[]);assert.deepEqual(start,before);
});

test('a real open visit or declared raid must settle before sleep preparation',()=>{
 for(const raid of [false,true]){
  let {campaign:start,columns}=raid?setupRaid():setup({march:false});
  if(!raid){start=order(start,{type:'visitSector'});assert.ok(start.pendingBattle);}
  const before=structuredClone(start),events=[];assert.throws(()=>prepareMountainApproachSleep(start,{columns,report:e=>events.push(e)}),/actual battle or encounter/);assert.deepEqual(start,before);assert.deepEqual(events,[]);
 }
});
