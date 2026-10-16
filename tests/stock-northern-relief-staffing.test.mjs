import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hireArrivalDueSeconds,pendingHire} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {northernReliefFitLocal} from './northern-relief-service.mjs';
import {stockNorthernRearReserve,assertStockNorthernRear,attachStockNorthernSupport,bookStockNorthernReliefHires,assertStockNorthernHiresArrived,stockNorthernReliefRestPlan} from './stock-northern-relief-staffing.mjs';

const defender=100,medic=101,support=102,courier=110,low=116,replacement=140,field=[111,112,113,114,115],critical=Array.from({length:9},(_,i)=>120+i);
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const held=(c,id)=>Object.fromEntries(['hp','alive','bleeding','weapon','condition','weaponInstanceId','weaponFittings','blade','bladeInstanceId','carriedLoaded','ammo','inventory','medkits'].map(key=>[key,structuredClone(c.operativeState[id][key])]));

// All identities, roads, facilities, finite supplies, prices, arrival times and
// wounds precede compilation and the fresh factory. Actual paid wound deaths
// earn the low morale. Every home, post and journey below uses ordinary orders.
function setup({delay=6,expensive=false,fullHome=false,medicalSupport=false,patientSupport=false,treasury=20000,replacementPay=60,secondReplacement=false}={}){
 const d=scaffoldDocuments('stock-northern-relief-staffing');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:').replaceAll('watch-post','tucuman'));
 d.manifest.scenario='granaderos-historical-v1';d.content.includeOriginalResidents=false;
 d.content.rules.startingTreasury=treasury;d.content.rules.deploymentCartridges=0;
 d.content.startingTerritory.tucuman={...d.content.startingTerritory.tucuman,owner:'patriot'};
 d.world.arrivalFacilities.tucuman=['barracks'];d.content.arrivalSites.push({sector:'tucuman',facilities:['barracks']});
 d.world.exitLinks=[['cordoba','E',19,8,'tucuman','W',0,8]];d.world.expansion.buildingTargets={cordoba:0,tucuman:0};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const extras=fullHome?[141,142,143,144,145]:[],offers=secondReplacement?[replacement,146]:[replacement],base=d.content.characters[0],people=[defender,medic,support,courier,low,...field,...critical,...offers,...extras];
 d.content.characters=people.map(id=>({...structuredClone(base),id:`person-${id}`,name:`Personal ${id}`,nickname:`Personal ${id}`,monthlyPay:offers.includes(id)?(expensive?30000:replacementPay):30,arrivalHours:offers.includes(id)?delay:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,strength:100,medical:id===medic?80:id===support?30:0},
  startingSupplies:{medkits:id===medic?17:id===support?2:0,rations:8,torches:1,boleadoras:0},
  startingCondition:{hp:critical.includes(id)?1:id===support&&patientSupport?60:80,bleeding:critical.includes(id)?1:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const actions=[],payments=[];
 const act=action=>{c=order(c,action);actions.push(structuredClone(action));};
 const hire=id=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;assert.equal(quote.available,true);act({type:'recruitCivic',id,term:'month',destination:'cordoba'});assert.equal(c.resources.treasury,cash-quote.total);payments.push(quote.total);};
 hire(low);const lowHome=()=>c.squads.find(home=>home.members.includes(low)).id;
 for(let batch=0;batch<3;batch++){
  const ids=critical.slice(batch*3,batch*3+3);for(const id of ids)hire(id);
  act({type:'createSquad',name:'Heridas declaradas',sector:'cordoba',ids:[low,...ids]});act({type:'wait',hours:1});
  for(const id of ids){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 }
 assert.equal(c.operativeState[low].morale,26);act({type:'squad',ids:[low]});const woundedHome=lowHome();
 for(const id of [defender,medic,support,courier,...field,...extras])hire(id);
 act({type:'createSquad',name:'Defensa de Córdoba',sector:'cordoba',ids:[defender,medic]});const defence=c.activeSquadId;c=leave(visit(c));
 for(const operativeId of [defender,medic])act({type:'assignCare',operativeId,assignment:'rest'});
 act({type:'createSquad',name:'Apoyo de Tucumán',sector:'cordoba',ids:[support]});const supportHome=c.activeSquadId;c=leave(visit(c));act({type:'assignCare',operativeId:support,assignment:medicalSupport?'doctor':patientSupport?'patient':'rest'});
 act({type:'createSquad',name:'Columna del Norte',sector:'cordoba',ids:[courier,...field]});act({type:'transport',mode:'posta'});act({type:'travel',sector:'tucuman',mode:'posta'});
 act({type:'createSquad',name:'Enlace provincial',sector:'tucuman',ids:[courier]});const envoy=c.activeSquadId;
 act({type:'selectSquad',id:woundedHome});act({type:'travel',sector:'tucuman',mode:'posta'});
 const rear=stockNorthernRearReserve(c);act({type:'selectSquad',id:envoy});act({type:'travel',sector:'cordoba',mode:'posta'});
 act({type:'selectSquad',id:envoy});if(fullHome)act({type:'squad',ids:[courier,...extras]});
 assert.equal(c.location,'cordoba');assert.equal(c.operativeState[low].morale,26);assert.equal(c.operativeState[low].assignment,'active');
 for(const id of [defender,medic,support])assert.ok(c.operativeState[id].residentPosition,'The source party earns an actual saved ground post.');
 for(const id of critical)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(d,declaration);return {campaign:saved(c),defence,supportHome,envoy,rear,actions,payments,declaration};
}

test('one actual support reserve and a paid delayed arrival complete eight fit soldiers without borrowing the Córdoba defence',t=>{
 const fixture=setup(),start=fixture.campaign,before=structuredClone(start),rear=fixture.rear,tape=[];
 assert.deepEqual(rear.ids,[defender,medic]);assert.equal(rear.strongestMedic,medic);assert.equal(rear.medkits[medic],1);
 const stock=Object.fromEntries(start.recruited.map(id=>[id,held(start,id)])),cash=start.resources.treasury;
 let c=supplyRouteDressings(start,courier,17,{reserves:rear.medkits,discover:false,onOrder:({action})=>tape.push(structuredClone(action))});
 assert.equal(c.operativeState[medic].medkits,1);assert.equal(c.operativeState[courier].medkits,17);assert.equal(c.operativeState[support].medkits,1);
 assert.equal([medic,courier,support].reduce((n,id)=>n+c.operativeState[id].medkits,0),19);assert.equal(c.resources.treasury,cash);assertStockNorthernRear(c,rear);
 const attached=attachStockNorthernSupport(c,{rear});c=attached.campaign;tape.push(...attached.orders);assert.deepEqual(attached.ids,[support]);assert.equal(c.activeSquadId,fixture.envoy);assert.ok(c.squad.length<=5);
 const travel={type:'travel',sector:'tucuman',mode:'posta'},departed=clock(c),travelCash=c.resources.treasury;c=order(c,travel);tape.push(travel);
 assert.ok(clock(c)>departed);assert.ok(c.resources.treasury<travelCash);assert.equal(northernReliefFitLocal(c).length,7);assertStockNorthernRear(c,rear);
 const bookingStart=c,booking=bookStockNorthernReliefHires(c,{remainingCareHours:7});c=booking.campaign;assert.equal(booking.hires.length,1);assert.equal(booking.hires[0].id,replacement);assert.equal(booking.hires[0].deadlineSeconds,clock(bookingStart)+7*3600);
 t.diagnostic(JSON.stringify({stockNorthernBooking:booking.hires[0]}));
 const hire={type:'recruitCivic',id:replacement,term:'week',destination:'tucuman'};tape.push(hire);assert.equal(c.resources.treasury,bookingStart.resources.treasury-booking.hires[0].quote.total);assert.equal(clock(c),clock(bookingStart));assert.ok(pendingHire(c,replacement));
 const waits=[];for(let request=0;request<7&&!c.recruited.includes(replacement);request++){
  const action={type:'wait',hours:1},from=clock(c);c=order(c,action);tape.push(action);const to=clock(c);waits.push({action,from,to,elapsedSeconds:to-from});t.diagnostic(JSON.stringify({stockNorthernHireWait:waits.at(-1)}));assert.ok(to>=from&&to<=from+3600);
 }
 assert.ok(waits.length<=7);assert.equal(clock(c)-clock(bookingStart),waits.reduce((sum,row)=>sum+row.elapsedSeconds,0));assert.ok(clock(c)>=hireArrivalDueSeconds(booking.hires[0].arrival)&&clock(c)<=booking.hires[0].deadlineSeconds);
 assertStockNorthernHiresArrived(c,booking.hires);assert.equal(northernReliefFitLocal(c).length,8);assertStockNorthernRear(c,rear);
 assert.equal(c.operativeState[low].morale,26);for(const id of critical){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 for(const id of [defender,medic]){assert.equal(c.squads.find(home=>home.members.includes(id)).id,fixture.defence);for(const key of ['hp','weapon','condition','inventory','ammo'])assert.deepEqual(held(c,id)[key],stock[id][key]);}
 const actualStart=c.contracts[replacement].started*3600+(c.contracts[replacement].startedSecond??0);assert.ok(actualStart>=hireArrivalDueSeconds(booking.hires[0].arrival)&&actualStart<=booking.hires[0].deadlineSeconds);assert.equal(contractExpiresSeconds(c.contracts[replacement]),actualStart+booking.hires[0].quote.hours*3600);
 let replay=start;for(let i=0;i<tape.length;i++){replay=order(replay,tape[i]);if(i===Math.floor(tape.length/2))replay=saved(replay);}assert.deepEqual(saved(replay),saved(c));assert.deepEqual(start,before);
});

test('an actual immediate quote fills the last fit vacancy without another care hour',()=>{
 const {campaign:start,rear}=setup({delay:0});let c=attachStockNorthernSupport(start,{rear}).campaign;c=order(c,{type:'travel',sector:'tucuman',mode:'posta'});
 const before=structuredClone(c),result=bookStockNorthernReliefHires(c,{remainingCareHours:0});assert.equal(result.hires.length,1);assert.equal(clock(result.campaign),clock(c));assertStockNorthernHiresArrived(result.campaign,result.hires);assert.equal(northernReliefFitLocal(result.campaign).length,8);assert.deepEqual(c,before);saved(result.campaign);
});

test('the original field-rest window restores an actual low-morale survivor when no affordable living hire remains',()=>{
 const {campaign:start,rear}=setup({expensive:true}),before=structuredClone(start),tape=[];
 const attached=attachStockNorthernSupport(start,{rear});let c=attached.campaign;tape.push(...attached.orders);
 const act=action=>{c=order(c,action);tape.push(action);};
 act({type:'travel',sector:'tucuman',mode:'posta'});
 act({type:'assignToSquad',operativeId:low,squadId:c.activeSquadId});
 act({type:'assignCare',operativeId:low,assignment:'rest'});
 assert.equal(c.operativeState[low].morale,26);assert.equal(northernReliefFitLocal(c).length,7);
 const plan=stockNorthernReliefRestPlan(c);assert.equal(plan.needsRest,true);assert.deepEqual(plan.replacements,[]);
 const began=clock(c),cash=c.resources.treasury,waits=[];
 for(let requests=0;requests<36&&stockNorthernReliefRestPlan(c).needsRest;requests++){
  const from=clock(c);act({type:'wait',hours:1});waits.push(clock(c)-from);
 }
 assert.ok(waits.length<=36);assert.equal(clock(c)-began,waits.reduce((sum,elapsed)=>sum+elapsed,0));
 assert.ok(clock(c)-began>=24*3600&&clock(c)-began<=36*3600);
 assert.equal(c.operativeState[low].morale,30);assert.equal(northernReliefFitLocal(c).length,8);
 assert.equal(stockNorthernReliefRestPlan(c).needsRest,false);assert.equal(c.resources.treasury,cash);
 const booking=bookStockNorthernReliefHires(c,{remainingCareHours:0});assert.deepEqual(booking.hires,[]);assert.strictEqual(booking.campaign,c);
 assertStockNorthernRear(c,rear);for(const id of critical)assert.equal(c.operativeState[id].alive,false);
 let replay=start;for(let i=0;i<tape.length;i++){replay=order(replay,tape[i]);if(i===Math.floor(tape.length/2))replay=saved(replay);}
 assert.deepEqual(saved(replay),saved(c));assert.deepEqual(start,before);
});

test('jointly unaffordable offers retain real morale rest before one paid arrival completes eight fit soldiers',()=>{
 const {campaign:start,rear}=setup({treasury:4800,replacementPay:600,secondReplacement:true,medicalSupport:true}),before=structuredClone(start),tape=[];
 let c=start;const act=action=>{c=order(c,action);tape.push(action);};
 act({type:'travel',sector:'tucuman',mode:'posta'});act({type:'assignCare',operativeId:low,assignment:'rest'});
 assert.equal(northernReliefFitLocal(c).length,6);assert.equal(c.operativeState[low].morale,26);
 const quotes=[replacement,146].map(id=>contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'));
 assert.ok(quotes.every(quote=>quote.available&&quote.total<=c.resources.treasury));assert.ok(quotes.reduce((sum,quote)=>sum+quote.total,0)>c.resources.treasury,'The actual current purse covers either offer but not both.');
 const planningInput=structuredClone(c),plan=stockNorthernReliefRestPlan(c,{remainingCareHours:7});assert.equal(plan.needsRest,true);assert.equal(plan.replacements.length,1);assert.deepEqual(c,planningInput);
 const began=clock(c),cash=c.resources.treasury;
 for(let requests=0;requests<36&&stockNorthernReliefRestPlan(c,{remainingCareHours:7}).needsRest;requests++)act({type:'wait',hours:1});
 assert.ok(clock(c)-began>=24*3600&&clock(c)-began<=36*3600);assert.equal(c.operativeState[low].morale,30);assert.equal(northernReliefFitLocal(c).length,7);assert.equal(c.resources.treasury,cash);
 const booking=bookStockNorthernReliefHires(c,{remainingCareHours:7});c=booking.campaign;assert.equal(booking.hires.length,1);assert.equal(c.resources.treasury,cash-booking.hires[0].quote.total);assert.ok(c.resources.treasury>=0);
 for(const {id}of booking.hires)tape.push({type:'recruitCivic',id,term:'week',destination:'tucuman'});
 for(let requests=0;requests<7&&booking.hires.some(({id})=>!c.recruited.includes(id));requests++)act({type:'wait',hours:1});
 assertStockNorthernHiresArrived(c,booking.hires);assert.equal(northernReliefFitLocal(c).length,8);assertStockNorthernRear(c,rear);
 for(const id of start.recruited){assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits);if(critical.includes(id))assert.equal(c.operativeState[id].alive,false);}
 let replay=start;for(let i=0;i<tape.length;i++){replay=order(replay,tape[i]);if(i===Math.floor(tape.length/2))replay=saved(replay);}
 assert.deepEqual(saved(replay),saved(c));assert.deepEqual(start,before);
});

test('the remaining care window excludes a late offer and keeps actual morale rest inside the original field window',()=>{
 const {campaign:start,rear}=setup(),before=structuredClone(start),tape=[];
 const attached=attachStockNorthernSupport(start,{rear});let c=attached.campaign;tape.push(...attached.orders);
 const act=action=>{c=order(c,action);tape.push(action);};
 act({type:'travel',sector:'tucuman',mode:'posta'});act({type:'assignToSquad',operativeId:low,squadId:c.activeSquadId});act({type:'assignCare',operativeId:low,assignment:'rest'});
 assert.equal(northernReliefFitLocal(c).length,7);assert.equal(c.operativeState[low].morale,26);
 const planningInput=structuredClone(c),short=stockNorthernReliefRestPlan(c,{remainingCareHours:5}),boundary=stockNorthernReliefRestPlan(c,{remainingCareHours:6});
 assert.equal(short.needsRest,true);assert.deepEqual(short.replacements,[]);assert.equal(boundary.needsRest,false);assert.deepEqual(boundary.replacements,[replacement]);assert.deepEqual(c,planningInput);
 const began=clock(c),cash=c.resources.treasury;
 for(let requests=0;requests<36&&stockNorthernReliefRestPlan(c,{remainingCareHours:5}).needsRest;requests++)act({type:'wait',hours:1});
 assert.ok(clock(c)-began>=24*3600&&clock(c)-began<=36*3600);assert.equal(c.operativeState[low].morale,30);assert.equal(northernReliefFitLocal(c).length,8);assert.equal(c.resources.treasury,cash);
 const booking=bookStockNorthernReliefHires(c,{remainingCareHours:5});assert.strictEqual(booking.campaign,c);assert.deepEqual(booking.hires,[]);assertStockNorthernRear(c,rear);
 for(const id of critical)assert.equal(c.operativeState[id].alive,false);
 let replay=start;for(let i=0;i<tape.length;i++){replay=order(replay,tape[i]);if(i===Math.floor(tape.length/2))replay=saved(replay);}
 assert.deepEqual(saved(replay),saved(c));assert.deepEqual(start,before);
});

test('an arrival outside the remaining original care budget is a terminal refusal before payment',()=>{
 const {campaign:start,rear}=setup();let c=attachStockNorthernSupport(start,{rear}).campaign;c=order(c,{type:'travel',sector:'tucuman',mode:'posta'});const before=structuredClone(c);
 assert.throws(()=>bookStockNorthernReliefHires(c,{remainingCareHours:5}),/remaining48-hour care budget/);assert.deepEqual(c,before);
 // No refused or attached state is queried, saved, replayed or continued.
});

test('a quote above the existing hiring ceiling cannot replace real low-morale survivors or borrow defenders',()=>{
 const {campaign:start,rear}=setup({expensive:true});let c=attachStockNorthernSupport(start,{rear}).campaign;c=order(c,{type:'travel',sector:'tucuman',mode:'posta'});const before=structuredClone(c);
 assert.throws(()=>bookStockNorthernReliefHires(c,{remainingCareHours:48}),/actual affordable hires/);assert.deepEqual(c,before);assert.equal(c.operativeState[low].morale,26);
});

test('a full actual courier home cannot take support or displace either defence home member',()=>{
 const {campaign:start,rear}=setup({fullHome:true}),before=structuredClone(start),result=attachStockNorthernSupport(start,{rear});
 assert.equal(start.squad.length,6);assert.strictEqual(result.campaign,start);assert.deepEqual(result.ids,[]);assert.deepEqual(result.orders,[]);assertStockNorthernRear(result.campaign,rear);assert.deepEqual(start,before);
});

test('retained clinical support keeps its finite care dressing through donations and an insufficient legal hire pool refuses',()=>{
 for(const options of [{medicalSupport:true},{patientSupport:true}]){
  const {campaign:start,rear}=setup(options),before=structuredClone(start),donations=[];
  assert.ok(rear.ids.includes(support));assert.equal(rear.medkits[medic],1);assert.equal(rear.medkits[support],1);
  if(options.patientSupport){assert.equal(start.operativeState[support].hp,60);assert.equal(start.operativeState[support].bandaged,0);}
  const supplied=supplyRouteDressings(start,courier,17,{reserves:rear.medkits,discover:false,onOrder:({action})=>donations.push(action)});
  assert.equal(supplied.operativeState[medic].medkits,1);assert.equal(supplied.operativeState[support].medkits,1);assert.equal(supplied.operativeState[courier].medkits,17);assert.equal([medic,support,courier].reduce((sum,id)=>sum+supplied.operativeState[id].medkits,0),19);
  assert.ok(donations.some(action=>action.direction==='drop'&&action.operativeId===support&&action.count===1));assert.equal(supplied.resources.treasury,start.resources.treasury);assert.equal(clock(supplied),clock(start));assertStockNorthernRear(supplied,rear);
  const attached=attachStockNorthernSupport(supplied,{rear});assert.strictEqual(attached.campaign,supplied);assert.deepEqual(attached.orders,[]);assert.equal(supplied.operativeState[support].assignment,options.medicalSupport?'doctor':'patient');assert.deepEqual(start,before);
  const c=order(supplied,{type:'travel',sector:'tucuman',mode:'posta'}),input=structuredClone(c);assert.equal(northernReliefFitLocal(c).length,6);
  assert.throws(()=>bookStockNorthernReliefHires(c,{remainingCareHours:48}),/actual affordable hires/);assert.deepEqual(c,input);
 }
});
