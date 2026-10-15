import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {actBattle} from '../game/tactical.js';
import {queueSquadTravel,squadTravelStatus} from '../game/squad-travel.js';
import {worldCell} from '../game/world-cells.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {completeMountainPaidDuties,mountainLosPatosDeparturePlan} from './fresh-mountain-route.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';

const ids=[100,130,101,139],fieldIds=[130,101,139],clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};

// A current paid-service declaration, not an earned mountain checkpoint.
// The expensive surplus doctor and the needed cheaper doctor share the same
// Native service, finite kit and physical equipment rules as the route.
function setup({guarantee=false,named=false,wounded=false,sector='retiro',treasury=3200,friendlyUspallata=false}={}){
 const content=defaultContentPackage();content.headquarters=sector;delete content.startingTerritory;content.rules.startingTreasury=treasury;
 if(friendlyUspallata){content.startingTerritory=defaultStartingTerritory(sector);content.startingTerritory.uspallata={owner:'patriot',loyalty:65};}
 if(named)content.campaignRoles={foundryEngineer:'person-100',marchCommander:'person-57'};
 for(const id of ids){
  const person=content.characters.find(p=>p.id===`person-${id}`);person.arrivalHours=0;
  if(id===100){person.monthlyPay=6000;person.attributes={...person.attributes,medical:93};if(guarantee)person.serviceGuarantee=31;}
  if(wounded&&id===139)person.startingCondition={hp:50,bleeding:0,bandaged:0,energy:100,fatigue:0};
 }
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content);
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.total);}
 c=order(c,{type:'createSquad',ids:fieldIds,name:'Columna que continúa',sector});
 const p=visit(c),battle=actBattle(p.battle,{type:'explore'});assert.equal(battle.lastError,null);c=leave(sync({campaign:p.campaign,battle}));
 assert.deepEqual(content,declaration);return saved(c);
}
const finish=(start,options={})=>completeMountainPaidDuties(start,{fieldIds,doctorIds:[130],horizonSeconds:clock(start)+72*3600,...options});
function replay(start,result){let c=saved(start);for(const [index,action]of result.orders.entries()){c=order(c,action);if(index===Math.floor(result.orders.length/2))c=saved(c);}assert.deepEqual(saved(c),result.campaign);}

test('a completed healthy off-field doctor ends only unneeded duty and leaves every exact finite stack for the actual field',()=>{
 const start=setup(),before=structuredClone(start),events=[],result=finish(start,{report:event=>events.push(event)}),c=result.campaign;
 assert.deepEqual(result.completed.map(row=>row.id),[100]);assert.deepEqual(result.orders,[{type:'dismiss',id:100}]);assert.equal(result.budget.available,true);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(clock(c),clock(start));assert.equal(c.operativeState[100].alive,true);assert.equal(c.operativeState[100].hp,c.operativeState[100].maxHp);assert.ok(!c.recruited.includes(100));assert.equal(c.contracts[100],undefined);
 for(const id of fieldIds){assert.ok(c.recruited.includes(id));assert.deepEqual(c.operativeState[id],start.operativeState[id]);assert.deepEqual(c.contracts[id],start.contracts[id]);}
 assert.equal(result.completed[0].kit.find(row=>row.item==='medkits').count,2);assert.ok(result.completed[0].kit.some(row=>row.weapon));
 const model=sectorInventoryModel(c,c.location,rosterFor(c),130),row=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count===2);assert.ok(row,'The exact service return must be publicly reachable.');
 const after=order(c,{type:'sectorInventory',sector:c.location,operativeId:130,direction:'take',sourceKey:row.key,expected:row.expected,count:2});
 assert.equal(after.operativeState[130].medkits,c.operativeState[130].medkits+2);assert.equal(sectorInventoryModel(after,after.location,rosterFor(after),130).entries.find(r=>r.key===row.key)?.count??0,0);assert.equal(after.operativeState[100].medkits,0);
 assert.deepEqual(saved(after),after);assert.equal(events.filter(event=>event.event==='mountainPaidDutyCompleted').length,1);replay(start,result);assert.deepEqual(start,before);
 const repeated=finish(c);assert.deepEqual(repeated.orders,[]);assert.deepEqual(repeated.campaign,c);
});

test('a sufficient current treasury preserves surplus service without dismissal or another payment',()=>{
 const start=setup({treasury:10000}),before=structuredClone(start),result=finish(start);
 assert.equal(result.budget.available,true);assert.deepEqual(result.completed,[]);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('all sixteen actual continuing soldiers and three qualified doctors retain their exact terms and bodies',()=>{
 const field=[101,102,103,104,105,106,107,108,109,110,111,115,113,130,139,146],doctors=[130,139,146],content=defaultContentPackage();content.rules.startingTreasury=6000;
 for(const id of [100,...field]){const p=content.characters.find(p=>p.id===`person-${id}`);p.arrivalHours=0;p.monthlyPay=id===100?6000:300;}
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let start=initialCampaign(42,content);
 for(const id of [100,...field])start=order(start,{type:'recruitCivic',id,term:'day'});
 for(let i=0;i<field.length;i+=6)start=order(start,{type:'createSquad',ids:field.slice(i,i+6),sector:'retiro',name:'Columna real '+i});
 const pair=visit(start),battle=actBattle(pair.battle,{type:'explore'});assert.equal(battle.lastError,null);start=leave(sync({campaign:pair.campaign,battle}));start=saved(start);
 const before=structuredClone(start),result=completeMountainPaidDuties(start,{fieldIds:field,doctorIds:doctors,horizonSeconds:clock(start)+72*3600});
 assert.deepEqual(result.completed.map(r=>r.id),[100],JSON.stringify(result.budget));assert.equal(result.budget.available,true,JSON.stringify(result.budget));assert.equal(field.filter(id=>result.campaign.recruited.includes(id)).length,16);
 for(const id of field){assert.deepEqual(result.campaign.operativeState[id],start.operativeState[id]);assert.deepEqual(result.campaign.contracts[id],start.contracts[id]);}
 assert.ok(doctors.every(id=>rosterFor(result.campaign).find(op=>op.id===id).medical>=60));assert.equal(result.campaign.resources.treasury,start.resources.treasury);assert.equal(clock(result.campaign),clock(start));
 replay(start,result);assert.deepEqual(start,before);assert.deepEqual(content,declaration);
});

test('selected field and physician roles cannot be discarded to satisfy a service budget',()=>{
 const start=setup(),before=structuredClone(start),result=finish(start,{fieldIds:ids,doctorIds:[100,130]});
 assert.equal(result.budget.available,false);assert.ok(result.budget.shortfall>0);assert.deepEqual(result.completed,[]);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('named service, held guarantees and actual work remain protected despite an unfunded departure',()=>{
 for(const variant of ['named','guarantee','work']){
  let start=setup({named:variant==='named',guarantee:variant==='guarantee'});
  if(variant==='work')start=order(start,{type:'assignWork',operativeId:100,assignment:'practice',skill:'marksmanship'});
  const before=structuredClone(start),result=finish(start);
  assert.equal(result.budget.available,false);assert.deepEqual(result.completed,[]);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 }
});

test('an explicitly retained prior work duty cannot become disposable through a later ordinary rest assignment',()=>{
 let start=setup();start=order(start,{type:'assignWork',operativeId:100,assignment:'practice',skill:'marksmanship'});const protectedIds=[100];
 start=order(start,{type:'assignCare',operativeId:100,assignment:'rest'});const before=structuredClone(start),result=finish(start,{protectedIds});
 assert.equal(result.budget.available,false);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('a real wounded patient and the current clinic physician keep service until care is actually complete',()=>{
 let start=setup({wounded:true});start=order(start,{type:'assignCare',operativeId:139,assignment:'patient'});start=order(start,{type:'assignCare',operativeId:100,assignment:'doctor'});
 const before=structuredClone(start),result=finish(start);
 assert.equal(start.operativeState[139].hp,50);assert.equal(result.budget.available,false);assert.deepEqual(result.completed,[]);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('a real marching enemy group keeps the local defense intact before its encounter arrives',()=>{
 const d=scaffoldDocuments('completed-duty-threat'),base=d.content.characters[0];d.content.rules.startingTreasury=3200;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:4,reserve:3,raidEveryHours:1,axis:['watch-post']}}};
 d.content.characters=Array.from({length:3},(_,i)=>({...structuredClone(base),id:'duty-'+i,name:'Guardia '+i,monthlyPay:i?300:6000,arrivalHours:0}));
 const content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let start=initialCampaign(42,content);const local=rosterFor(start).map(op=>op.id);
 for(const id of local)start=order(start,{type:'recruitCivic',id,term:'day',destination:'watch-post'});start=order(start,{type:'createSquad',ids:local,sector:'watch-post',name:'Guardia actual'});start=order(start,{type:'wait',hours:1});
 assert.ok(start.enemyGroups.some(group=>group.target==='watch-post'&&group.status==='marching'));assert.equal(start.pendingEncounter,null);
 const before=structuredClone(start),result=completeMountainPaidDuties(start,{fieldIds:local.slice(1),horizonSeconds:clock(start)+72*3600});
 assert.equal(result.budget.available,false);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('the remaining parallel mountain horizon uses current public leg durations, fees and exact daylight alignment',()=>{
 let start=setup({sector:'mendoza',treasury:20000,friendlyUspallata:true});start=order(start,{type:'transport',mode:'posta'});
 const first=start.activeSquadId;start=order(start,{type:'travel',sector:'uspallata',mode:'posta',queue:true});
 const second=start.squads.find(q=>q.members.includes(100)).id;start=order(start,{type:'selectSquad',id:second});start=order(start,{type:'travel',sector:'uspallata',mode:'posta',queue:true});
 const columns=[first,second];for(let h=0;h<24&&columns.some(id=>start.squads.find(q=>q.id===id).journey);h++)start=order(start,{type:'wait',hours:1});assert.ok(columns.every(id=>start.squads.find(q=>q.id===id).location==='uspallata'&&!start.squads.find(q=>q.id===id).journey));
 const before=structuredClone(start),plan=mountainLosPatosDeparturePlan(start,{columns,stage:'uspallata'}),destination=worldCell('los_patos',start);assert.ok(destination);
 // Independently repeat only the Native public geometric quotations. These
 // drafts are not campaign arrivals, orders or an earned assault.
 const origins=['uspallata',`cell-${destination.col}-${destination.row-1}`],quotes=[];let fees=0;
 for(const [index,id]of columns.entries()){
  const q=start.squads.find(q=>q.id===id),routes=[];
  if(index){const draft={...q,members:[...q.members]};queueSquadTravel(start,draft,{sector:origins[index],mode:'march'});routes.push(squadTravelStatus(draft,start).remaining);}else routes.push(0);
  const attack={...q,location:origins[index],members:[...q.members]};queueSquadTravel(start,attack,{sector:'los_patos',mode:index?'march':'posta',intent:'attack'});const quote=squadTravelStatus(attack,start);routes.push(quote.remaining);if(!index)fees+=10*(quote.path.length-1);quotes.push(routes);
 }
 const hours=Math.max(...quotes.map(q=>q[0]))+Math.max(...quotes.map(q=>q[1]));let until=clock(start)+hours*3600,daylight=0;while(Math.floor(until/3600)%24<6||Math.floor(until/3600)%24>10){until+=3600;daylight++;}
 assert.equal(plan.hours,hours);assert.equal(plan.fixedCost,fees);assert.equal(plan.assaultSeconds,until);assert.equal(plan.retentionBufferSeconds,3600);assert.equal(plan.horizonSeconds,until+3600);assert.equal(plan.daylightHours,daylight);assert.ok(plan.hours>0);assert.deepEqual(start,before);
 const price=contractRenewalQuote(start,rosterFor(start).find(op=>op.id===100),'day').price;assert.ok(price>0);
});

test('the final zero-time route order pays a term that expires inside its real one-hour retention buffer',()=>{
 let c=setup({treasury:10000});const expiry=contractExpiresSeconds(c.contracts[100]),assaultSeconds=expiry-1800;
 for(let n=0;clock(c)<assaultSeconds&&n<64;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,assaultSeconds-clock(c))});assert.equal(clock(c),assaultSeconds);
 const start=saved(c),before=structuredClone(start),old=quoteMountainServiceBudget(c,{keepIds:ids,horizonSeconds:assaultSeconds}),full=quoteMountainServiceBudget(c,{keepIds:ids,horizonSeconds:assaultSeconds+3600});
 assert.equal(old.renewalCost,0);assert.ok(full.renewalCost>0);assert.equal(full.available,true);
 const orders=[],route=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>{if(event.action)orders.push(event.action);}});route.order({type:'selectSquad',id:c.activeSquadId});
 assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury-full.renewalCost);assert.equal(orders.filter(a=>a.type==='renewContract').length,4);
 for(const id of ids)assert.ok(contractExpiresSeconds(c.contracts[id])>assaultSeconds+3600);
 let replayed=start;for(const action of orders)replayed=order(replayed,action);assert.deepEqual(saved(replayed),saved(c));assert.deepEqual(start,before);
});
