import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernHospitalSixPersonReserve} from './northern-hospital-six-person-reserve.mjs';
import {northernHospitalReturnFunding,northernReunionDutyKeepers} from './fresh-northern-recovery.mjs';
import {careAssignmentIssue} from '../game/medical-care.js';

const sector='watch-post',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=(campaign,battle=null)=>{const pair=decodeSave(encodeSave(campaign,battle));assert.deepEqual(pair,{campaign,battle});return pair;};
const cartridges=(c,id)=>{const op=rosterFor(c).find(row=>row.id===id),unit=carriedAmmunition(op,c.operativeState[id]);return (unit.loaded??0)+ammoCount(unit,ammoTypeFor(unit));};
const allKits=c=>Object.values(c.operativeState).reduce((n,body)=>n+(body.medkits??0),0);

// The roof, body count, actual long guns, finite initial cartridges, arrival
// delay, prices, service guarantees and ordinary raid are all pre-factory data.
// The four-person return party and all eight groups are made by paid orders.
function setup({six=false,fullGroups=false,delay=0,price=600,rounds=12,raid=false,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-six-person-hospital-reserve'),base=d.content.characters[0],oldCount=six?6:5,fieldCount=4,extraCount=fullGroups?6:0,total=oldCount+fieldCount+extraCount+2;
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=rounds;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory[sector].owner='patriot';d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});d.world.expansion.buildingTargets[sector]=0;
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:[sector]}}};
 d.maps[sector].upperSurfaces=Array.from({length:24},(_,i)=>({id:'reserve-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'reserve-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.content.weapons.push({id:'reserve-rifle',template:1800,name:'Fusil de la guardia',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 d.content.characters=Array.from({length:total},(_,i)=>({...structuredClone(base),id:'person-'+String(i).padStart(2,'0'),name:'Guardia '+i,nickname:'Guardia '+i,weapon:'reserve-rifle',monthlyPay:i>=total-2?price:300,serviceGuarantee:17,arrivalHours:i>=total-2?delay:0,
  attributes:{...base.attributes,medical:i===0?90:i===1?38:0,marksmanship:i===total-2?90:i===total-1?80:60},
  startingCondition:{hp:70,bleeding:0,bandaged:0,energy:100,fatigue:0},startingSupplies:{rations:0,torches:0,medkits:i===0?4:i===1?3:0,boleadoras:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const all=d.content.characters.map(person=>operativeIdForCharacter(content,person.id)),ids=all.slice(0,oldCount),field=all.slice(oldCount,oldCount+fieldCount),extras=all.slice(oldCount+fieldCount,-2),candidates=all.slice(-2),hires=[];
 for(const id of [...ids,...field,...extras]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:ids.includes(id)?sector:'camp'});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',ids,sector,name:'Guardia del hospital'});const home=c.activeSquadId;c=stageRouteRoofDefenders(c,ids);
 for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 c=order(c,{type:'createSquad',ids:field,sector:'camp',name:'Columna de regreso'});const selected=c.activeSquadId;
 for(const id of field)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 for(const id of extras){c=order(c,{type:'createSquad',ids:[id],sector:'camp',name:'Servicio retenido '+id});c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});}
 c=order(c,{type:'selectSquad',id:selected});
 if(nearExpiry){const until=Math.min(...[...ids,...field,...extras].map(id=>contractExpiresSeconds(c.contracts[id])))-1800;for(let n=0;clock(c)<until&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,until-clock(c))});assert.equal(clock(c),until);}
 assert.deepEqual(d,declaration);return {campaign:saved(c).campaign,ids,field,extras,candidates,home,selected,hires};
}

const run=(c,ids,options={})=>prepareNorthernHospitalSixPersonReserve(c,{sector,ids,deadlineSeconds:clock(c)+72*3600,horizonSeconds:clock(c)+96*3600,...options});
function replay(start,result){
 let c=start,battle=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,battle);
   c=order(c,row.action);
   if(row.action.type==='visitSector'){battle=enterSector(c.pendingBattle,c.sectorStates[result.receipt.sector]);const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}
   if(row.action.type==='leaveSector')battle=null;
  }else{
   battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);
   const pair=syncBattleTime(c,battle),second=syncBattleTime(c,shown),third=syncBattleTime(c,validated);assert.equal(pair.error,null);assert.deepEqual(second,pair);assert.deepEqual(third,pair);c=pair.campaign;battle=pair.battle;shown=second.battle;validated=third.battle;
  }
  if(index===Math.floor(result.receipt.orders.length/2)){const pair=saved(c,battle);c=pair.campaign;battle=pair.battle;if(battle){shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}}
 }
 assert.deepEqual({campaign:c,battle},{campaign:result.campaign,battle:result.battle});saved(c,battle);
}

test('one real paid rifleman fills the vacant hospital slot with eight occupied groups and preserves the five roof posts and four-person return party',()=>{
 const {campaign:start,ids,field,candidates,home,selected}=setup({fullGroups:true,raid:true}),before=structuredClone(start),result=run(start,ids),c=result.campaign,receipt=result.receipt,id=result.reliefId;
 assert.equal(result.ready,true);assert.equal(result.reason,null);assert.equal(result.battle,null);assert.equal(id,candidates[0]);assert.equal(start.squads.filter(group=>group.members.length).length,8);assert.equal(c.squads.filter(group=>group.members.length).length,8);
 assert.deepEqual(c.squads.find(group=>group.id===home).members,[...ids,id]);assert.deepEqual(c.squads.find(group=>group.id===selected).members,field);assert.equal(c.activeSquadId,selected);assert.deepEqual(c.squad,field);assert.equal(receipt.orders.some(row=>row.action.type==='createSquad'),false);
 assert.equal(receipt.orders.filter(row=>row.action.type==='recruitCivic').length,1);assert.equal(receipt.orders.filter(row=>row.action.type==='visitSector').length,1);assert.deepEqual(receipt.visit.initial.units.filter(unit=>unit.side==='player').map(unit=>unit.id),[String(id)]);assert.ok(receipt.visit.steps.some(action=>action.type==='climb'));assert.ok(receipt.visit.steps.some(action=>action.type==='move'));
 assert.equal(c.resources.treasury,start.resources.treasury-receipt.hire.quote.total-receipt.renewals.reduce((n,row)=>n+row.quote.price,0));assert.equal(c.contracts[id].paid,receipt.hire.quote.price);assert.equal(c.serviceGuarantees.entries[c.contracts[id].guaranteeId].state,'held');assert.ok(contractExpiresSeconds(c.contracts[id])>receipt.horizonSeconds);
 for(const old of start.recruited){assert.ok(c.recruited.includes(old));assert.equal(c.operativeState[old].alive,true);assert.equal(c.operativeState[old].hp,start.operativeState[old].hp);assert.equal(c.operativeState[old].assignment,start.operativeState[old].assignment);assert.deepEqual(c.operativeState[old].residentPosition,start.operativeState[old].residentPosition);assert.equal(cartridges(c,old),cartridges(start,old));assert.ok(contractExpiresSeconds(c.contracts[old])>receipt.horizonSeconds);}
 assert.equal(cartridges(c,id),receipt.quotes.find(row=>row.id===id).cartridges);assert.equal(allKits(c),allKits(start));assert.deepEqual(c.ammunitionStores,start.ammunitionStores);assert.ok(c.operativeState[id].residentPosition.tacticalLevel>0);assert.equal(c.operativeState[id].assignment,'rest');assert.ok(clock(c)>clock(start)&&clock(c)<=receipt.deadlineSeconds);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run(saved(start).campaign,ids),result);
 // Continue only this successful fresh preparation. The ordinary authored
 // raid proves six-person admission and paired save, not a combat outcome.
 let current=c;for(let n=0;!current.pendingEncounter&&n<6;n++)current=order(current,{type:'wait',hours:1});assert.ok(current.pendingEncounter);assert.equal(current.pendingEncounter.sector,sector);assert.ok(clock(current)<receipt.horizonSeconds);
 for(const old of [...start.recruited,id])assert.ok(contractExpiresSeconds(current.contracts[old])>clock(current));
 current=order(current,{type:'respondToEncounter',groupId:current.pendingEncounter.groupId,choice:'tactical'});const request=structuredClone(current.pendingBattle),previous=structuredClone(current.sectorStates[sector]),battle=enterSector(current.pendingBattle,current.sectorStates[sector]);
 assert.deepEqual(current.pendingBattle,request);assert.deepEqual(current.sectorStates[sector],previous);assert.deepEqual(new Set(request.squad.map(unit=>unit.id)),new Set([...ids,id]));assert.deepEqual(new Set(battle.units.filter(unit=>unit.side==='player').map(unit=>Number(unit.id))),new Set([...ids,id]));assert.equal(battle.units.filter(unit=>unit.side==='player').length,6);
 const pair=syncBattleTime(current,battle);assert.equal(pair.error,null);saved(pair.campaign,pair.battle);assert.deepEqual(start,before);
});

test('a complete six-person reserve remains the exact original with no quote, hire, order or new service floor',()=>{
 const {campaign:start,ids}=setup({six:true}),before=structuredClone(start),result=run(start,ids);assert.equal(result.ready,true);assert.equal(result.reliefId,null);assert.deepEqual(result.receipt.quotes,[]);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('actual joint service cost or missing finite rifle ammunition refuses before any payment or booking',()=>{
 for(const options of [{price:1_000_000},{rounds:0}]){
  const {campaign:start,ids}=setup(options),before=structuredClone(start),result=run(start,ids);assert.equal(result.ready,false);assert.match(result.reason,/insufficient-joint-service-budget|no-current-supplied-rifleman/);assert.deepEqual(result.receipt.orders,[]);assert.equal(result.receipt.hire,null);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 }
 const {campaign:start,ids}=setup({price:13000}),before=structuredClone(start),result=run(start,ids);assert.equal(result.reason,'insufficient-joint-service-budget');assert.ok(result.receipt.quotes.every(row=>row.quote.total<=start.resources.treasury&&row.budget.totalCost>start.resources.treasury),'The hire alone is affordable; retaining every original duty through the actual explicit horizon is not.');assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('a delayed real paid arrival retains all near-expiry service through the explicit later horizon before its roof visit',()=>{
 const {campaign:start,ids,field}=setup({delay:2,nearExpiry:true}),before=structuredClone(start),result=run(start,ids),c=result.campaign,id=result.reliefId;
 assert.equal(result.ready,true);assert.ok(result.receipt.renewals.length);assert.equal(c.hiringArrivals.length,0);assert.ok(clock(c)>=clock(start)+7200);assert.equal(c.contracts[id].started,result.receipt.hire.arrival.dueAt);assert.equal(c.contracts[id].startedSecond??0,result.receipt.hire.arrival.dueSecond);assert.deepEqual(c.squad,field);
 assert.equal(c.resources.treasury,start.resources.treasury-result.receipt.hire.quote.total-result.receipt.renewals.reduce((n,row)=>n+row.quote.price,0));for(const old of start.recruited)assert.ok(contractExpiresSeconds(c.contracts[old])>result.receipt.horizonSeconds);assert.equal(allKits(c),allKits(start));assert.deepEqual(start,before);replay(start,result);
});

test('the original absolute care deadline refuses an arrival that cannot leave its real staging hour',()=>{
 const {campaign:start,ids}=setup({delay:2}),before=structuredClone(start),result=run(start,ids,{deadlineSeconds:clock(start)+3600,horizonSeconds:clock(start)+24*3600});assert.equal(result.ready,false);assert.equal(result.reason,'no-current-supplied-rifleman-within-deadline');assert.deepEqual(result.receipt.orders,[]);assert.equal(result.receipt.hire,null);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('a real ordinary raid interrupts a delayed paid arrival and hands back its exact campaign without more orders or a claimed roof',()=>{
 const {campaign:initial,ids}=setup({delay:4,raid:true});let start=initial;
 for(let n=0;!start.pendingEncounter&&!start.enemyGroups.some(row=>row.target===sector&&row.status==='marching')&&n<6;n++)start=order(start,{type:'wait',hours:1});
 const group=start.enemyGroups.find(row=>row.target===sector&&row.status==='marching');assert.ok(group);assert.equal(start.pendingEncounter,null);
 const before=structuredClone(start),result=run(start,ids);assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(result.receipt.restored,false);assert.equal(result.receipt.visit,null);assert.equal(result.battle,null);assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(result.receipt.orders.at(-1).action.type,'wait');assert.equal(result.receipt.orders.filter(row=>row.action.type==='recruitCivic').length,1);assert.ok(result.campaign.hiringArrivals.some(row=>row.operativeId===result.reliefId));assert.deepEqual(start,before);replay(start,result);
});

test('a smaller cohort is an explicit unsupported single-vacancy case rather than an arbitrary new force builder',()=>{
 const {campaign:initial,ids}=setup();let start=order(initial,{type:'selectSquad',id:initial.squads.find(group=>group.members.includes(ids[0])).id});start=order(start,{type:'squad',ids:ids.slice(0,4)});const before=structuredClone(start),result=run(start,ids.slice(0,4));assert.equal(result.ready,false);assert.equal(result.reason,'single-vacancy-required');assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('the current authored Tucuman roof admits one actually paid rifleman beside five unchanged current-map posts',t=>{
 const content=defaultContentPackage();content.headquarters='tucuman';content.startingTerritory.tucuman.owner='patriot';content.startingTerritory.cordoba.owner='patriot';content.rules.startingTreasury=500000;for(const person of content.characters)if(person.service==='contract')person.arrivalHours=0;
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content),ids=[116,127,100,102,133],field=[114,124,137,104];let c=initialCampaign(42,content);
 for(const id of [...ids,...field]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:ids.includes(id)?'tucuman':'cordoba'});assert.equal(cash-c.resources.treasury,quote.total);}
 c=order(c,{type:'createSquad',ids,sector:'tucuman',name:'Reserva actual'});const selected=c.activeSquadId;c=stageRouteRoofDefenders(c,ids);for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});c=order(c,{type:'createSquad',ids:field,sector:'cordoba',name:'Regreso actual'});const fieldSquad=c.activeSquadId;
 // Native regrouping leaves the old Tucuman home genuinely empty. Selecting
 // it also exercises immediate hire auto-join and exact empty-selection return.
 c=order(c,{type:'createSquad',ids,sector:'tucuman',name:'Guardia actual del hospital'});const home=c.activeSquadId;c=order(c,{type:'selectSquad',id:selected});assert.deepEqual(c.squad,[]);
 assert.deepEqual(content,declaration);const start=saved(c).campaign,before=structuredClone(start),funding=northernHospitalReturnFunding(start),horizonSeconds=funding.untilSeconds,deadlineSeconds=Math.min(clock(start)+72*3600,horizonSeconds),result=prepareNorthernHospitalSixPersonReserve(start,{sector:'tucuman',ids,deadlineSeconds,horizonSeconds}),end=result.campaign;
 assert.equal(horizonSeconds,clock(start)+48*3600);assert.equal(result.receipt.horizonSeconds,horizonSeconds);assert.equal(result.receipt.deadlineSeconds,deadlineSeconds);
 assert.equal(result.ready,true);assert.equal(result.receipt.visit.initial.width,64);assert.equal(result.receipt.visit.initial.height,48);assert.deepEqual(end.squads.find(group=>group.id===home).members,[...ids,result.reliefId]);assert.deepEqual(end.squads.find(group=>group.id===fieldSquad).members,field);assert.deepEqual(end.squad,[]);assert.equal(end.activeSquadId,selected);assert.ok(result.receipt.visit.steps.some(action=>action.type==='climb'));assert.ok(end.operativeState[result.reliefId].residentPosition.tacticalLevel>0);
 const approach=result.receipt.visit.approach,posts=ids.map(id=>start.operativeState[id].residentPosition);assert.ok(approach?.completed,'The fresh current map must earn its alternative paid public access.');assert.deepEqual(result.receipt.visit.initial.climbLinks.find(link=>link.id===approach.link.id),approach.link);assert.deepEqual(approach.arrivedAt,spacePoint(approach.link.from));assert.equal(approach.climbQuote.valid,true);assert.ok(sameCell(approach.climbQuote.destination,approach.link.to));assert.ok(!posts.some(post=>sameCell(post,approach.link.to)));assert.ok(approach.groundQuote.path.length>0&&approach.groundQuote.path.every(step=>(step.tacticalLevel??0)===0&&!posts.some(post=>sameCell(post,step))));
 const climbIndex=result.receipt.visit.steps.findIndex(action=>action.type==='climb'&&action.linkId===approach.link.id);assert.ok(climbIndex>0&&result.receipt.visit.steps.slice(0,climbIndex).some(action=>action.type==='move'));assert.ok(result.receipt.visit.steps.filter(action=>action.type==='move').every(action=>!posts.some(post=>sameCell(post,action))));
 for(const id of ids){assert.deepEqual(end.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(end.operativeState[id].assignment,start.operativeState[id].assignment);assert.equal(end.operativeState[id].hp,start.operativeState[id].hp);assert.equal(cartridges(end,id),cartridges(start,id));}assert.equal(allKits(end),allKits(start));assert.deepEqual(start,before);replay(start,result);
 const keepers=northernReunionDutyKeepers(end,field);assert.deepEqual(new Set(keepers),new Set([...field,...ids,result.reliefId]));assert.ok(keepers.includes(result.reliefId),'The real sixth roof guard remains an ongoing duty after the field party leaves.');assert.deepEqual(northernReunionDutyKeepers(saved(end).campaign,field),keepers);
 const physician=rosterFor(end).find(op=>ids.includes(op.id)&&!careAssignmentIssue(end,op,'doctor'));assert.ok(physician,'The fresh local cohort includes an actually admitted supplied physician.');const clinical=order(end,{type:'assignCare',operativeId:physician.id,assignment:'doctor'}),clinicalBefore=structuredClone(clinical),clinicalKeepers=northernReunionDutyKeepers(clinical,field);
 assert.ok(!clinicalKeepers.includes(physician.id),'Clinical assignment alone is not an added free roof guard duty.');assert.ok(clinicalKeepers.includes(result.reliefId));assert.deepEqual(clinical,clinicalBefore);assert.equal(clock(clinical),clock(end));assert.deepEqual(clinical.resources,end.resources);assert.deepEqual(clinical.squads,end.squads);assert.deepEqual(saved(clinical).campaign,clinical);
 t.diagnostic(JSON.stringify({reliefId:result.reliefId,paid:result.receipt.hire.quote.total,renewals:result.receipt.renewals.reduce((n,row)=>n+row.quote.price,0),publicAccess:approach.link,climbQuote:approach.climbQuote,post:result.receipt.visit.post,elapsedSeconds:clock(end)-clock(start),scope:'Fresh current-map paid admission and replay; no whole-route victory claim.'}));
});
