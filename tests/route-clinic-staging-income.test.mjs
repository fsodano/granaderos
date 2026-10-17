import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {applyMapCommands} from '../game/map-commands.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {dailyTownIncome,townIncomeSources} from '../game/town-income.js';
import {order,saved} from './local-contract-fixture.mjs';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareRescueClinicGuards} from './rescue-clinic-readiness.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// All people, rates, finite equipment, the roof and the owned locality are
// declared before compilation. Only a real conversation earns an agreement.
// Native recruitment, travel and rest reach the staging boundary; the clock,
// health, treasury, ledger and force are never assigned after the factory.
function beforeMidnight({kind,agreement}){
 const amount=kind==='roof'?137:911;
 const d=JSON.parse(JSON.stringify(scaffoldDocuments(`staging-income-${kind}-${agreement?'earned':'silent'}`)).replaceAll('watch-post','tucuman'));
 const base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=20;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory.tucuman={owner:'patriot',loyalty:65};
 d.world.arrivalFacilities.tucuman=['barracks'];d.content.arrivalSites.push({sector:'tucuman',facilities:['barracks']});
 d.content.weapons.push({id:'guard-musket',template:1801,name:'Mosquete de la guardia',damage:32,fireAP:11,aimAP:2,reloadAP:22,range:12,readyAP:0,capacity:1,weight:4,price:0,art:base.portrait});
 d.content.characters=['carrier','guard-west','guard-east'].map(id=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:'guard-musket',
  attributes:{...base.attributes,strength:100,leadership:90,marksmanship:95,medical:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:0}}));
 const resident=structuredClone(base);delete resident.arrivalHours;
 d.content.characters.push({...resident,id:'representative',name:'Representante de la clínica',nickname:'Representante',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,
  encounter:{recruitable:false,greeting:'El acuerdo de esta localidad.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
 d.content.placements=[{id:'clinic-representative',character:'representative',mode:'fixed',sectors:['tucuman'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 d.world.incomeSources=[{id:'clinic-income',name:'Clínica',source:'Acuerdo local',sectorId:'tucuman',requiredSectors:['tucuman'],dailyAmount:amount,
  representative:{npcId:'authored-representative',name:'Representante de la clínica',sectorId:'tucuman'}}];
 d.world.expansion.buildingTargets.tucuman=0;
 const roof=applyMapCommands(d.maps.tucuman,[{type:'addBuilding',building:{id:'clinic-roof',x:7,y:2,width:6,height:5,kind:'house',architecture:'house',roof:'terrace'}}]);
 assert.deepEqual(roof.errors,[]);d.maps.tucuman=roof.document;
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);assert.equal(c.resources.treasury,20000);assert.equal(dailyTownIncome(c),0);
 const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id,carrier=id('carrier'),guards=[id('guard-west'),id('guard-east')],ids=[carrier,...guards];
 let paid=0;
 for(const person of ids){
  const quote=contractQuote(c,people.find(row=>row.id===person),'month'),cash=c.resources.treasury;assert.equal(quote.available,true);
  c=order(c,{type:'recruitCivic',id:person,term:'month'});assert.equal(c.resources.treasury,cash-quote.total);paid+=quote.total;
 }
 assert.equal(c.resources.treasury,20000-paid);
 c=order(c,{type:'squad',ids});c=order(c,{type:'travel',sector:'tucuman'});assert.equal(c.location,'tucuman');assert.equal(c.pendingEncounter,null);
 if(agreement){
  const cash=c.resources.treasury;c=meetLocalIncomeRepresentative(c,{sourceId:'clinic-income',operativeId:carrier});
  assert.equal(c.resources.treasury,cash,'The physical agreement has no advance payment.');assert.equal(c.lastConversation.outcome,'incomeActivated');
  assert.deepEqual(c.conversations['authored-representative'].incomeActivation,c.townIncome.activations['clinic-income']);
 }else assert.deepEqual(c.townIncome.activations,{});
 c=order(c,{type:'createSquad',name:'Guardia de la clínica',ids:guards,sector:'tucuman'});
 c=order(c,{type:'createSquad',name:'Correo de la clínica',ids:[carrier],sector:'tucuman'});
 for(const person of ids)c=order(c,{type:'assignCare',operativeId:person,assignment:'rest'});
 const boundary=(Math.floor(clock(c)/86400)+1)*86400,target=boundary-2;
 for(let request=0;clock(c)<target&&request<40;request++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});
 assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 for(const person of ids)if(c.operativeState[person].asleep)c=order(c,{type:'setSleep',operativeId:person,asleep:false});
 assert.equal(clock(c),target);assert.equal(c.resources.treasury,20000-paid);assert.equal(c.townIncome.lastPaidDay,Math.floor(target/86400));
 assert.equal(dailyTownIncome(c),agreement?amount:0);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,carrier,guards,amount,boundary};
}

function prepare(kind,start,carrier,guards){
 if(kind==='clinic')return prepareRescueClinicGuards(start,{courier:carrier});
 const events=[],campaign=stageRouteRoofDefenders(start,guards,{report:event=>events.push(event)});
 return {campaign,evidence:events.find(event=>event.event==='routeRoofDefenders')};
}

for(const kind of ['roof','clinic'])for(const agreement of [true,false])test(`${kind} guard staging crosses one midnight with ${agreement?'an earned':'no'} income agreement and no preparation fee`,()=>{
 const {campaign:start,carrier,guards,amount,boundary}=beforeMidnight({kind,agreement}),before=structuredClone(start),sources=structuredClone(townIncomeSources(start));
 const result=prepare(kind,start,carrier,guards),c=result.campaign,evidence=result.evidence,expected=agreement?amount:0;
 assert.deepEqual(start,before);assert.ok(evidence.elapsedSeconds>2);assert.equal(clock(c),clock(start)+evidence.elapsedSeconds);
 assert.ok(clock(c)>=boundary&&clock(c)<boundary+86400);assert.equal(evidence.incomeDays,1);assert.equal(evidence.incomeReceived,expected);
 assert.equal(evidence.cost,0);assert.equal(evidence.netCashChange,expected);assert.equal(c.resources.treasury,start.resources.treasury+expected);
 assert.deepEqual(townIncomeSources(c),sources);assert.equal(dailyTownIncome(c),expected);assert.deepEqual(c.townIncome.activations,start.townIncome.activations);
 assert.equal(c.townIncome.lastPaidDay,start.townIncome.lastPaidDay+1);assert.equal(c.townIncome.lastPaidDay,Math.floor(clock(c)/86400));
 assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);
 for(const id of [carrier,...guards]){
  const old=start.operativeState[id],next=c.operativeState[id];assert.equal(next.alive,old.alive);assert.equal(next.captured,old.captured);assert.equal(next.hp,old.hp);assert.equal(next.medkits,old.medkits);
  assert.equal(next.carriedAmmo+next.carriedLoaded,old.carriedAmmo+old.carriedLoaded);assert.equal(next.assignment,old.assignment);
 }
 const roof=kind==='roof'?evidence:evidence.roofEvidence;assert.equal(roof.positions.length,guards.length);assert.ok(roof.positions.every(point=>point.tacticalLevel>0));
 assert.equal(new Set(roof.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,guards.length);
 if(kind==='clinic'){assert.equal(roof.incomeDays,1);assert.equal(roof.incomeReceived,expected);assert.equal(roof.cost,0);assert.equal(roof.netCashChange,expected);}
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.deepEqual(saved({campaign:c}).campaign,c);
 assert.deepEqual(prepare(kind,saved({campaign:before}).campaign,carrier,guards),result,'The accepted fresh pre-staging save repeats the exact native staging and one payment.');
 const after=order(saved({campaign:c}).campaign,{type:'advanceStrategicTime',seconds:1});assert.equal(after.resources.treasury,c.resources.treasury);assert.equal(after.townIncome.lastPaidDay,c.townIncome.lastPaidDay);
});
