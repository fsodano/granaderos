import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {resolveFoundryConvoyTucumanEncounter} from './fresh-cuyo-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};
const ammunition=(c,ids)=>ids.reduce((sum,id)=>sum+Object.values(unitAmmunitionByType(carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]))).reduce((a,b)=>a+b,0),0);

// The map, twelve-person force, earlier fatal wound, stock and finite raid are
// declared before compilation and the fresh factory. Only ordinary paid hires,
// squad orders and Native waits produce the casualty and pending encounter.
function setup({sector='tucuman'}={}){
 const d=scaffoldDocuments('foundry-convoy-tactical-defense');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=12;
 d.content.startingTerritory[sector]={...d.content.startingTerritory[sector],owner:'patriot'};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.world.exitLinks=[['camp','E',19,8,sector,'W',0,8]];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:6,axis:[sector]}}};
 d.content.weapons.push({id:'convoy-musket',template:1800,name:'Mosquete del convoy',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 const names=['fallen','remote',...Array.from({length:12},(_,i)=>'convoy-'+i)];
 d.content.characters=names.map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,serviceGuarantee:0,arrivalHours:0,weapon:i>=2?'convoy-musket':null,
  attributes:{...base.attributes,maxHp:80,marksmanship:95,medical:i===2?90:0},
  startingSupplies:{rations:8,torches:0,medkits:i===2?3:0,boleadoras:0},
  startingCondition:{hp:i===0?1:80,bleeding:i===0?1:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const id=key=>rosterFor(c).find(op=>op.contentId===key).id,fallen=id('fallen'),remote=id('remote'),field=names.slice(2).map(id),payments=[];
 const hire=(operativeId,destination)=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===operativeId),'month'),cash=c.resources.treasury;assert.equal(quote.available,true);assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id:operativeId,term:'month',destination});assert.equal(c.resources.treasury,cash-quote.total);payments.push(quote.total);};
 hire(fallen,'camp');const began=clock(c);c=order(c,{type:'wait',hours:1});assert.equal(clock(c)-began,3600);assert.equal(c.operativeState[fallen].alive,false);
 for(const operativeId of field)hire(operativeId,sector);hire(remote,'camp');
 const homes=[];for(let offset=0;offset<12;offset+=6){c=order(c,{type:'createSquad',name:'Convoy '+offset,ids:field.slice(offset,offset+6),sector});homes.push(c.activeSquadId);}
 c=order(c,{type:'createSquad',name:'Reserva distante',ids:[remote],sector:'camp'});const selected=c.activeSquadId;
 for(const operativeId of field)c=order(c,{type:'assignCare',operativeId,assignment:'rest'});
 for(let attempt=0;!c.pendingEncounter&&attempt<24;attempt++)c=order(c,{type:'wait',hours:1});
 assert.equal(c.pendingEncounter?.sector,sector);assert.equal(c.pendingBattle,null);assert.equal(c.resources.treasury,20000-payments.reduce((sum,cost)=>sum+cost,0));
 assert.equal(field.length,12);assert.ok(field.every(operativeId=>c.recruited.includes(operativeId)&&c.operativeState[operativeId].alive));assert.deepEqual(d,declaration);
 return {campaign:saved(c),field,fallen,remote,selected,homes};
}

test('a fresh paid twelve defend the real Tucuman raid through finite tactical orders and restore their selected home after settlement',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),events=[],result=resolveFoundryConvoyTucumanEncounter(start,{report:event=>events.push(event)}),c=result.campaign;
 assert.equal(s.homes.length,2);assert.ok(s.homes.every(id=>start.squads.find(home=>home.id===id).members.length===6));
 assert.equal(result.summary.sector,'tucuman');assert.equal(result.summary.status,'victory');assert.ok(result.summary.actions>0);assert.ok(result.summary.turns<=80);assert.ok(result.summary.elapsedSeconds>0);
 assert.equal(clock(c)-clock(start),result.summary.elapsedSeconds);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.lastError,null);assert.equal(c.defeated,false);
 const responses=events.filter(event=>event.event==='freshRouteOrder'&&event.action.type==='respondToEncounter');assert.equal(responses.length,1);assert.equal(responses[0].action.choice,'tactical');
 const completed=events.findIndex(event=>event.event==='freshRouteCheckpoint'&&event.stage==='foundry-convoy-tucuman-defense'),restored=events.findIndex(event=>event.event==='freshRouteOrder'&&event.action.type==='selectSquad');assert.ok(completed>=0&&restored>completed);assert.equal(events[completed].campaign.pendingBattle,null);assert.equal(events[completed].campaign.pendingEncounter,null);
 assert.equal(c.activeSquadId,s.selected);assert.deepEqual(c.squad,[s.remote]);assert.deepEqual(c.squads,start.squads);
 assert.ok(s.field.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&contractExpiresSeconds(c.contracts[id])>clock(c)));
 assert.ok(ammunition(c,s.field)<ammunition(start,s.field),'The earned defense spends actual carried rounds.');
 assert.ok(s.field.reduce((sum,id)=>sum+c.operativeState[id].medkits,0)<=s.field.reduce((sum,id)=>sum+start.operativeState[id].medkits,0));assert.equal(c.resources.treasury,start.resources.treasury);
 assert.deepEqual(c.operativeState[s.fallen],start.operativeState[s.fallen]);for(const key of ['hp','bleeding','medkits','assignment','location'])assert.deepEqual(c.operativeState[s.remote][key],start.operativeState[s.remote][key]);
 assert.equal(c.encounterHistory[0].outcome,'victory');assert.deepEqual(c.encounterHistory[0].casualties,[]);assert.deepEqual(start,before);saved(c);
 assert.deepEqual(resolveFoundryConvoyTucumanEncounter(saved(before)),result,'The successful fresh input repeats the paid tactical result and clock exactly.');
});

test('a fresh real raid outside Tucuman cannot enter the convoy defense or issue an order',()=>{
 const {campaign:start}=setup({sector:'cordoba'}),before=structuredClone(start),events=[];
 assert.throws(()=>resolveFoundryConvoyTucumanEncounter(start,{report:event=>events.push(event)}));assert.deepEqual(events,[]);assert.deepEqual(start,before);
 // The refused invocation is terminal; only plain input immutability is read.
});
