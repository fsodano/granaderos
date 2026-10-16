import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {entryFromSector,sectorExits} from '../game/tactical-exits.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {discoverRouteCache,collectRouteItems} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {courierSaltaReserveDressings} from './salta-reserve-supply-courier.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=pair=>{const restored=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(restored,{campaign:pair.campaign,battle:pair.battle??null});return restored;};
const total=c=>c.recruited.reduce((n,id)=>n+(c.operativeState[id].medkits??0),0)+Object.values(c.sectorStates).reduce((n,b)=>n+(b.groundItems??[]).filter(g=>g.item==='medkits'||g.type==='medkits').reduce((sum,g)=>sum+g.count,0)+(b.props??[]).filter(p=>p.type==='chest').reduce((sum,p)=>sum+(p.contents??[]).filter(row=>row.item==='medkits').reduce((m,row)=>m+row.count,0),0),0);

// The two towns, wounds, roof access, finite cache and ordinary raid schedule
// are declared before the factory. All people, stock and posts below are
// earned through paid public orders; no failed campaign is used as input.
function setup({stock=14,treasury=10000,fullCarriers=false,raid=false,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-salta-reserve-courier');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"tucuman"').replaceAll('"watch-post"','"cordoba"'));
 d.content.rules.startingTreasury=treasury;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.content.startingTerritory.cordoba.owner='patriot';
 d.world.arrivalFacilities.cordoba=['barracks'];d.content.arrivalSites.push({sector:'cordoba',facilities:['barracks']});d.world.physical.caches={};
 d.world.exitLinks=[['cordoba','N',9,0,'tucuman','S',12,15]];
 for(const at of ['tucuman','cordoba']){
  d.world.expansion.buildingTargets[at]=0;d.maps[at].props=[];
  d.maps[at].upperSurfaces=Array.from({length:20},(_,i)=>({id:at+'-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
  d.maps[at].climbLinks=[{id:at+'-roof-access',kind:'climb',from:{x:8,y:3,tacticalLevel:0},to:{x:8,y:4,tacticalLevel:1}}];
 }
 d.maps.cordoba.props.push({id:'earned-depot-linen',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true});
 d.world.physical.caches.cordoba={chest:'earned-depot-linen',contents:[{item:'medkits',count:stock,weight:.2}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:['cordoba']}}};
 const base=d.content.characters[0],roles=[{id:'clinic-doctor',medical:85,kits:2},{id:'clinic-patient',medical:0,wound:12},...Array.from({length:10},(_,i)=>({id:'roof-guard-'+i,medical:0})),{id:'depot-holder',medical:0}];
 d.content.characters=roles.map(row=>({...structuredClone(base),id:row.id,name:row.id,nickname:row.id,monthlyPay:300,serviceGuarantee:0,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,medical:row.medical,strength:fullCarriers&&row.id.startsWith('roof-guard')?20:80},startingSupplies:{rations:fullCarriers&&row.id.startsWith('roof-guard')?24:0,torches:0,medkits:row.kits??0,boleadoras:0},
  startingCondition:{hp:base.attributes.maxHp-(row.wound??0),bleeding:0,bandaged:row.wound??0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 assert.deepEqual(entryFromSector('tucuman','cordoba',null,c),{entryEdge:'N',entryAnchor:{x:9,y:0}});assert.deepEqual(entryFromSector('cordoba','tucuman',null,c),{entryEdge:'S',entryAnchor:{x:12,y:15}});
 assert.deepEqual(sectorExits('tucuman',null,c).find(exit=>exit.destination==='cordoba'),{id:'tucuman:cordoba',edge:'S',destination:'cordoba',entryEdge:'N',entryAnchor:{x:9,y:0}});
 const roster=rosterFor(c),byName=Object.fromEntries(roster.map(op=>[op.name,op.id])),doctor=byName['clinic-doctor'],patient=byName['clinic-patient'],holderId=byName['depot-holder'],field=roles.slice(0,12).map(row=>byName[row.id]),guards=field.slice(2),hires=[];
 for(const id of [...field,holderId]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:id===holderId?'cordoba':'tucuman'});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',sector:'tucuman',name:'Cubierta clínica',ids:field.slice(0,6)});const home=c.activeSquadId;
 c=order(c,{type:'createSquad',sector:'tucuman',name:'Cubierta de relevo',ids:field.slice(6)});
 c=stageRouteRoofDefenders(c,field);
 c=order(c,{type:'createSquad',sector:'cordoba',name:'Guardia del depósito',ids:[holderId]});const holderGroup=c.activeSquadId;
 c=discoverRouteCache(c,holderId);c=collectRouteItems(c,holderId,{item:'medkits'},stock).campaign;c=stageRouteRoofDefenders(c,[holderId]);
 assert.equal(c.operativeState[holderId].medkits,stock);assert.equal(c.sectorStates.cordoba.props.find(p=>p.id==='earned-depot-linen').contents.filter(row=>row.item==='medkits').reduce((n,row)=>n+row.count,0),0);
 c=order(c,{type:'selectSquad',id:home});
 for(let i=0;c.squads.length<8;i++)c=order(c,{type:'createSquad',sector:'tucuman',name:'Grupo reutilizable '+i,ids:[guards[0]]});
 c=order(c,{type:'assignToSquad',operativeId:guards[0],squadId:home});c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'squad',ids:field.slice(0,6)});
 if(nearExpiry){for(let n=0;Math.min(...c.recruited.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c)>3600&&n<32;n++)c=order(c,{type:'wait',hours:1});const remaining=Math.min(...c.recruited.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c);assert.ok(remaining>0&&remaining<=3600);}
 for(const id of field)c=order(c,{type:'assignCare',operativeId:id,assignment:id===doctor?'doctor':id===patient?'patient':'rest'});
 c=order(c,{type:'selectSquad',id:holderGroup});assert.equal(c.squads.length,8);assert.equal(c.location,'cordoba');assert.deepEqual(c.squad,[holderId]);
 assert.ok(field.every(id=>c.operativeState[id].residentPosition.tacticalLevel>0));assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,holderId,doctor,patient,field,guards,home,holderGroup,hires};
}

function replay(start,result){
 let campaign=start,battle=null,shown=null,validated=null;
 for(const [i,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,battle);
   campaign=order(campaign,row.action);
   if(row.action.type==='visitSector'){battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}
   if(row.action.type==='leaveSector')battle=null;
  }else{
   battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);
   const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
  }
  if(i===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign,battle});campaign=pair.campaign;battle=pair.battle;if(battle){shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}}
 }
 assert.deepEqual(campaign,result.campaign);saved({campaign,battle});
}
const run=(state,options={})=>courierSaltaReserveDressings(state.campaign,{holderId:state.holderId,requestedCount:4,deadlineSeconds:clock(state.campaign)+72*3600,...options});

test('one real nonclinical roof carrier pays an eight-hour finite parcel roundtrip and returns to its exact group/post while clinic care continues',()=>{
 const state=setup({nearExpiry:true}),start=state.campaign,before=structuredClone(start),service=quoteMountainServiceBudget(start,{keepIds:start.recruited,horizonSeconds:clock(start)+72*3600}),reservedPesos=start.resources.treasury-service.renewalCost-170,result=run(state,{reservedPesos}),c=result.campaign,r=result.receipt;
 assert.ok(reservedPesos>0);assert.equal(r.funding.totalCost,start.resources.treasury);assert.equal(r.reservedPesos,reservedPesos);assert.ok(c.resources.treasury>=reservedPesos);
 assert.ok(state.guards.includes(r.carrierId));assert.notEqual(r.carrierId,state.doctor);assert.notEqual(r.carrierId,state.patient);assert.equal(r.journeys.length,2);assert.ok(r.journeys.every(row=>row.quote.hours===4&&row.to-row.from===4*3600));
 assert.equal(r.setupCost,150);assert.equal(c.resources.treasury,start.resources.treasury-170-r.renewals.reduce((n,row)=>n+row.quote.price,0));assert.ok(r.renewals.length>0);
 assert.equal(c.operativeState[state.holderId].medkits,10);assert.equal(c.operativeState[r.carrierId].medkits,4);assert.equal(c.operativeState[state.patient].hp,c.operativeState[state.patient].maxHp);assert.equal(c.operativeState[state.doctor].medkits,0);assert.equal(total(c),total(start)-2);
 assert.equal(c.operativeState[state.doctor].assignment,'doctor');assert.equal(c.operativeState[state.patient].assignment,'patient');assert.ok(r.care.reduce((n,row)=>n+row.usedDressings,0)>=2);
 assert.equal(r.visits.length,2);assert.ok(r.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));assert.ok(r.orders.filter(row=>row.kind==='battle').every(row=>row.action.unitId===String(r.carrierId)));
 const restoredBody=r.visits.at(-1).returned.units.find(unit=>unit.id===String(r.carrierId));for(const [key,value]of Object.entries(r.savedCarrierCondition))assert.deepEqual(restoredBody[key],value);
 const drop=r.orders.findIndex(row=>row.action.type==='sectorInventory'&&row.action.direction==='drop');assert.ok(drop>r.orders.findIndex(row=>row.action.type==='leaveSector'));assert.equal(r.orders[drop].action.operativeId,state.holderId);assert.equal(r.transfers.reduce((n,row)=>n+row.count,0),4);
 assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,state.holderGroup);assert.deepEqual(c.squad,[state.holderId]);assert.equal(c.location,'cordoba');assert.equal(c.operativeState[r.carrierId].assignment,'rest');
 for(const id of [...state.field,state.holderId]){assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run({...state,campaign:saved({campaign:start}).campaign},{reservedPesos}),result);
});

test('finite stock, full-pack capacity and current cash guards refuse before any order, travel or parcel drop',()=>{
 for(const options of [{stock:1},{fullCarriers:true},{treasury:850}]){
  const state=setup(options),before=structuredClone(state.campaign);let failure;try{run(state);}catch(error){failure=error;}
  if(options.treasury){assert.ok(state.hires.reduce((n,row)=>n+row.quote.total,0)<=options.treasury);const quoted=quoteMountainServiceBudget(state.campaign,{keepIds:state.campaign.recruited,horizonSeconds:clock(state.campaign)+72*3600,fixedCost:170});assert.equal(quoted.available,false);assert.ok(quoted.shortfall>0);}
  assert.ok(failure);assert.deepEqual(failure.campaign,state.campaign);assert.deepEqual(failure.saltaReserveSupplyCourier.orders,[]);assert.equal(failure.battle,null);assert.deepEqual(state.campaign,before);saved({campaign:failure.campaign});
 }
});

test('the same absolute clinical deadline refuses an unfunded visit allowance without resetting it',()=>{
 const state=setup(),before=structuredClone(state.campaign),deadlineSeconds=clock(state.campaign)+9*3600;let failure;try{run(state,{deadlineSeconds});}catch(error){failure=error;}
 assert.match(failure?.message??'',/roundtrip and two bounded visits/);assert.equal(failure.saltaReserveSupplyCourier.deadlineSeconds,deadlineSeconds);assert.deepEqual(failure.saltaReserveSupplyCourier.orders,[]);assert.deepEqual(failure.campaign,before);assert.deepEqual(state.campaign,before);
});

test('one peso of the caller\'s protected reserve cannot be spent on the courier',()=>{
 const state=setup(),start=state.campaign,before=structuredClone(start),service=quoteMountainServiceBudget(start,{keepIds:start.recruited,horizonSeconds:clock(start)+72*3600}),reservedPesos=start.resources.treasury-service.renewalCost-170+1;let failure;
 try{run(state,{reservedPesos});}catch(error){failure=error;}
 assert.match(failure?.message??'',/treasury does not cover/);assert.equal(failure.saltaReserveSupplyCourier.funding.shortfall,1);assert.deepEqual(failure.saltaReserveSupplyCourier.orders,[]);assert.equal(failure.saltaReserveSupplyCourier.reservedPesos,reservedPesos);assert.deepEqual(failure.campaign,start);assert.deepEqual(start,before);
});

test('an ordinary declared raid stops the actual paid journey before donation and preserves the partial current save',()=>{
 const state=setup({raid:true}),start=state.campaign,before=structuredClone(start);let failure;try{run(state);}catch(error){failure=error;}
 assert.ok(failure);assert.equal(failure.campaign.pendingEncounter?.sector,'cordoba');assert.equal(failure.battle,null);assert.ok(clock(failure.campaign)>clock(start));assert.equal(failure.campaign.operativeState[state.holderId].medkits,start.operativeState[state.holderId].medkits);assert.deepEqual(failure.campaign.operativeState[state.holderId].residentPosition,start.operativeState[state.holderId].residentPosition);
 assert.equal(failure.saltaReserveSupplyCourier.orders.at(-1).action.type,'wait');assert.equal(failure.saltaReserveSupplyCourier.orders.some(row=>row.action.type==='sectorInventory'),false);assert.equal(failure.saltaReserveSupplyCourier.restored,false);assert.ok(failure.campaign.resources.treasury<start.resources.treasury);assert.deepEqual(start,before);
 const tape=failure.saltaReserveSupplyCourier.orders;assert.equal(tape.filter(row=>row.action.type==='travel').length,1);assert.equal(tape.some(row=>row.action.type==='recruitCivic'||row.action.type==='sectorInventory'),false);replay(start,{campaign:failure.campaign,receipt:failure.saltaReserveSupplyCourier});
});

test('a resolver refusal retains its later actually admitted campaign and battle rather than the prior travel state',()=>{
 const state=setup({raid:true}),before=structuredClone(state.campaign),refusal=new Error('Declared resolver refusal after real tactical admission.');let accepted=null,failure;
 try{run(state,{resolveEncounter:c=>{const next=order(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'}),battle=enterSector(next.pendingBattle,next.sectorStates[next.pendingBattle.sector]),pair=syncBattleTime(next,battle);assert.equal(pair.error,null);accepted={campaign:pair.campaign,battle:pair.battle};refusal.campaign=accepted.campaign;refusal.battle=accepted.battle;throw refusal;}});}catch(error){failure=error;}
 assert.strictEqual(failure,refusal);assert.strictEqual(failure.campaign,accepted.campaign);assert.strictEqual(failure.battle,accepted.battle);saved(accepted);assert.equal(failure.saltaReserveSupplyCourier.restored,false);assert.equal(failure.saltaReserveSupplyCourier.externalTransitions.length,1);const transition=failure.saltaReserveSupplyCourier.externalTransitions[0];assert.equal(transition.completed,false);assert.equal(transition.orderTape,null);assert.equal(transition.beforeOrderIndex,failure.saltaReserveSupplyCourier.orders.length);assert.deepEqual(transition.after,accepted);assert.deepEqual(state.campaign,before);
});
