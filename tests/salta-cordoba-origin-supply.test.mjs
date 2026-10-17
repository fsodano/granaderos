import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {entryFromSector} from '../game/tactical-exits.js';
import {actBattle,presentedActBattle,hasLineOfSight} from '../game/tactical.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {atHand} from '../game/tactical-planning-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {discoverRouteCache,collectRouteItems} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {courierSaltaCordobaOriginDressings} from './salta-cordoba-origin-supply.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=pair=>{const restored=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(restored,{campaign:pair.campaign,battle:pair.battle??null});return restored;};
const total=c=>Object.values(c.operativeState).reduce((n,r)=>n+(r.medkits??0),0)+Object.values(c.sectorStates).reduce((n,b)=>n+(b.groundItems??[]).filter(g=>g.item==='medkits'||g.type==='medkits').reduce((m,g)=>m+g.count,0)+(b.props??[]).filter(p=>p.type==='chest').reduce((m,p)=>m+(p.contents??[]).filter(g=>g.item==='medkits').reduce((a,g)=>a+g.count,0),0),0);

// Every town, road, offer, wound, roof and finite cache precedes the campaign
// factory. Real paid hires, visits and stock collection establish the start.
function setup({treasury=10000,stock=10,raid=false,nearExpiry=false,delayed=false,carrierKits=1,fullCarrier=false,fullDoctor=false}={}){
 const d=scaffoldDocuments('declared-cordoba-origin-clinic-supply');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"tucuman"').replaceAll('"watch-post"','"cordoba"'));
 d.content.rules.startingTreasury=treasury;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.content.startingTerritory.cordoba.owner='patriot';
 d.world.arrivalFacilities.cordoba=['barracks'];d.content.arrivalSites.push({sector:'cordoba',facilities:['barracks']});d.world.exitLinks=[['cordoba','N',9,0,'tucuman','S',12,15]];d.world.physical.caches={};
 for(const at of ['tucuman','cordoba']){d.world.expansion.buildingTargets[at]=0;d.maps[at].props=[];d.maps[at].upperSurfaces=Array.from({length:20},(_,i)=>({id:at+'-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));d.maps[at].climbLinks=[{id:at+'-roof-access',kind:'climb',from:{x:8,y:3,tacticalLevel:0},to:{x:8,y:4,tacticalLevel:1}}];}
 d.maps.cordoba.props.push({id:'real-owned-linen',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true});d.world.physical.caches.cordoba={chest:'real-owned-linen',contents:[{item:'medkits',count:stock,weight:.2}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:['cordoba']}}};
 const base=d.content.characters[0],roles=[{id:'working-doctor',medical:85,kits:2},{id:'clinic-patient',medical:0,wound:30},...Array.from({length:10},(_,i)=>({id:'old-roof-'+i,medical:0})),{id:'sole-depot-holder',medical:0},{id:'planned-rear-hire',medical:0,kits:fullCarrier?2:carrierKits,arrivalHours:delayed?2:0},{id:'later-field-specialist',medical:0,kits:1}];
 d.content.characters=roles.map(row=>({...structuredClone(base),id:row.id,name:row.id,nickname:row.id,monthlyPay:300,serviceGuarantee:0,arrivalHours:row.arrivalHours??0,weapon:null,attributes:{...base.attributes,medical:row.medical,strength:80},startingSupplies:{rations:fullCarrier&&row.id==='planned-rear-hire'||fullDoctor&&row.id==='working-doctor'?22:0,torches:0,medkits:row.kits??0,boleadoras:0},startingCondition:{hp:base.attributes.maxHp-(row.wound??0),bleeding:0,bandaged:row.wound??0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 assert.deepEqual(entryFromSector('tucuman','cordoba',null,c),{entryEdge:'N',entryAnchor:{x:9,y:0}});assert.deepEqual(entryFromSector('cordoba','tucuman',null,c),{entryEdge:'S',entryAnchor:{x:12,y:15}});
 const byName=Object.fromEntries(rosterFor(c).map(op=>[op.name,op.id])),field=roles.slice(0,12).map(row=>byName[row.id]),doctor=byName['working-doctor'],patient=byName['clinic-patient'],holderId=byName['sole-depot-holder'],carrierId=byName['planned-rear-hire'],specialist=byName['later-field-specialist'],hires=[];
 for(const id of [...field,holderId]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:id===holderId?'cordoba':'tucuman'});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',sector:'tucuman',name:'Clínica primera cubierta',ids:field.slice(0,6)});const firstHome=c.activeSquadId;c=order(c,{type:'createSquad',sector:'tucuman',name:'Clínica segunda cubierta',ids:field.slice(6)});c=stageRouteRoofDefenders(c,field);
 c=order(c,{type:'createSquad',sector:'cordoba',name:'Reserva original de Córdoba',ids:[holderId]});const sourceHome=c.activeSquadId;c=discoverRouteCache(c,holderId);c=collectRouteItems(c,holderId,{item:'medkits'},stock).campaign;c=stageRouteRoofDefenders(c,[holderId]);
 assert.equal(c.operativeState[holderId].medkits,stock);assert.equal(c.sectorStates.cordoba.props.find(p=>p.id==='real-owned-linen').contents.filter(row=>row.item==='medkits').reduce((n,row)=>n+row.count,0),0);
 c=order(c,{type:'selectSquad',id:firstHome});for(let i=0;c.squads.length<8;i++)c=order(c,{type:'createSquad',sector:'tucuman',name:'Registro reutilizable '+i,ids:[field[2]]});c=order(c,{type:'assignToSquad',operativeId:field[2],squadId:firstHome});c=order(c,{type:'selectSquad',id:firstHome});c=order(c,{type:'squad',ids:field.slice(0,6)});
 if(nearExpiry){for(let n=0;Math.min(...c.recruited.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c)>3600&&n<32;n++)c=order(c,{type:'wait',hours:1});const remaining=Math.min(...c.recruited.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c);assert.ok(remaining>0&&remaining<=3600);}
 for(const id of field)c=order(c,{type:'assignCare',operativeId:id,assignment:id===doctor?'doctor':id===patient?'patient':'rest'});c=order(c,{type:'selectSquad',id:sourceHome});assert.equal(c.operativeState[holderId].assignment,'active');assert.equal(c.squads.length,8);
 const paidOffers=[carrierId].map(id=>({op:rosterFor(c).find(op=>op.id===id),quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'week')})),fieldOffers=[specialist].map(id=>({id,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day')}));assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,field,doctor,patient,holderId,carrierId,specialist,sourceHome,hires,paidOffers,fieldOffers};
}
const run=(s,options={})=>courierSaltaCordobaOriginDressings(s.campaign,{holderId:s.holderId,carrierId:s.carrierId,requestedCount:4,paidOffers:s.paidOffers,fieldOffers:s.fieldOffers,deadlineSeconds:clock(s.campaign)+72*3600,...options});

function replay(start,result){
 let campaign=start,battle=null,shown=null,validated=null;
 for(const [i,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,battle);campaign=order(campaign,row.action);
   if(row.action.type==='visitSector'){battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}
   if(row.action.type==='leaveSector')battle=null;
  }else{
   battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
  }
  if(i===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign,battle});campaign=pair.campaign;battle=pair.battle;if(battle){shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}}
 }assert.deepEqual(campaign,result.campaign);saved({campaign,battle});
}

test('one actual planned Córdoba hire relays finite linen through the unchanged crowded roof on the first four-hour leg, then returns to its paid rear role',()=>{
 const s=setup({nearExpiry:true}),start=s.campaign,before=structuredClone(start),result=run(s),c=result.campaign,r=result.receipt;
 assert.equal(r.hire.id,s.carrierId);assert.deepEqual(r.hire.quote,s.paidOffers[0].quote);assert.equal(r.hire.debit,s.paidOffers[0].quote.total);assert.equal(r.funding.rearCost,r.hire.debit);assert.equal(r.remainingReserve,r.funding.fieldCost+250);assert.equal(r.funding.fieldReserve,250);
 assert.equal(r.journeys.length,2);assert.ok(r.journeys.every(row=>row.quote.hours===4&&row.to-row.from===4*3600));assert.ok(r.delivery.atSeconds-r.startSeconds>=4*3600);assert.ok(r.delivery.atSeconds-r.startSeconds<6*3600,'The actual first parcel reaches the clinic before an eight-hour roundtrip could deliver.');assert.equal(r.visits.length,3);
 const board=start.sectorStates.tucuman,post=start.operativeState[s.doctor].residentPosition,adjacent=board.upperSurfaces.filter(point=>!point.blocked&&sameSurface(point,post)&&atHand(point,post)&&hasLineOfSight(board,point,post));assert.ok(adjacent.length);assert.ok(adjacent.every(point=>s.field.some(id=>sameCell(start.operativeState[id].residentPosition,point))),'All actual same-roof doctor contact cells are occupied before the helper; no fixture post is relocated.');
 assert.ok(r.relayPlan.ids.length>2);assert.equal(r.relayTransfers.length,r.relayPlan.ids.length-1);assert.equal(r.delivery.fromId,r.relayPlan.ids.at(-2));assert.equal(r.delivery.toId,s.doctor);assert.equal(r.deliveredCount,4);assert.equal(r.delivery.clinicStockAfterDelivery-r.delivery.clinicStockBeforeDelivery,4);assert.equal(c.operativeState[s.holderId].medkits,6);assert.equal(r.remainingCarrierDressings,1);assert.equal(c.operativeState[s.patient].hp,c.operativeState[s.patient].maxHp);
 for(const id of r.relayPlan.ids.slice(1,-1))assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits,'Each real relay guard forwards only the received parcel and retains its own stock.');assert.ok(r.orders.filter(row=>row.kind==='campaign').every(row=>row.accepted&&row.lastError===null));
 const used=r.care.reduce((n,row)=>n+row.usedDressings,0);assert.ok(used>2);assert.equal(total(c),total(start)-used);assert.ok(r.renewals.length);assert.equal(c.resources.treasury,start.resources.treasury-r.hire.debit-r.funding.setupCost-r.funding.travelFees-r.renewals.reduce((n,row)=>n+row.quote.price,0));
 assert.ok(r.orders.filter(row=>row.kind==='battle').every(row=>row.action.unitId===String(s.carrierId)));assert.equal(r.orders.filter(row=>row.action.type==='recruitCivic').length,1);assert.equal(r.orders.some(row=>row.action.type==='createSquad'),false);assert.equal(c.squads.length,8);assert.equal(operativeLocation(c,s.carrierId),'cordoba');
 assert.deepEqual(c.squads,s.campaign.squads.map(q=>q.id===s.sourceHome?{...q,members:[...q.members,s.carrierId]}:q));assert.equal(c.activeSquadId,s.sourceHome);assert.deepEqual(c.squad,[s.holderId,s.carrierId]);
 for(const id of [...s.field,s.holderId]){assert.equal(operativeLocation(c,id),operativeLocation(start,id));assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.ok(r.orders.some(row=>row.action.type==='sectorInventory'&&row.action.sector==='tucuman'&&row.action.operativeId===s.doctor&&row.action.direction==='take'));assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run({...s,campaign:saved({campaign:start}).campaign}),result);
});

test('the actual joint budget includes the chosen hire only once and refuses an unfunded plan before any paid order',()=>{
 const s=setup({treasury:800}),start=s.campaign,before=structuredClone(start);let error;try{run(s);}catch(e){error=e;}
 assert.ok(error);assert.equal(error.saltaCordobaOriginSupply.funding.available,false);assert.ok(error.saltaCordobaOriginSupply.funding.shortfall>0);assert.deepEqual(error.saltaCordobaOriginSupply.orders,[]);assert.deepEqual(error.campaign,start);assert.deepEqual(start,before);
 const q=error.saltaCordobaOriginSupply.funding;assert.equal(q.fixedCost,q.rearCost+q.fieldCost+250+q.setupCost+q.travelFees);const service=quoteMountainServiceBudget(start,{keepIds:start.recruited,horizonSeconds:clock(start)+72*3600,fixedCost:q.fixedCost});assert.deepEqual(q.entries,service.entries);assert.equal(q.totalCost,service.totalCost);
});

test('source reserve, current immediate planned identity and absolute deadline refuse before booking or parcel debit',()=>{
 for(const [s,options]of [[setup({stock:4}),{}],[setup({delayed:true}),{}],[setup(),{carrierId:-1}],[setup(),{deadlineSeconds:null}]]){
  const start=s.campaign,before=structuredClone(start),selectedOptions=options.deadlineSeconds===null?{deadlineSeconds:clock(start)+10*3600}:options;let error;try{run(s,selectedOptions);}catch(e){error=e;}
  assert.ok(error);assert.deepEqual(error.saltaCordobaOriginSupply.orders,[]);assert.deepEqual(error.campaign,start);assert.equal(error.saltaCordobaOriginSupply.deliveredCount,0);assert.deepEqual(start,before);
 }
});

test('known zero-kit and full current carrier or doctor packs refuse before any payment, visit or travel',()=>{
 for(const options of [{carrierKits:0},{fullCarrier:true},{fullDoctor:true}]){
  const s=setup(options),start=s.campaign,before=structuredClone(start);let error;try{run(s);}catch(e){error=e;}
  assert.ok(error);assert.deepEqual(error.saltaCordobaOriginSupply.orders,[]);assert.equal(error.saltaCordobaOriginSupply.hire,null);assert.equal(error.saltaCordobaOriginSupply.deliveredCount,0);assert.deepEqual(error.campaign,start);assert.deepEqual(start,before);
  if(options.carrierKits===0)assert.match(error.message,/known offered carrier/);else{assert.ok(error.saltaCordobaOriginSupply.capacityChecks.some(row=>!row.available));assert.match(error.message,/espacio|sobrecargado|bolsillo/);}
 }
});

test('an ordinary declared raid retains the real paid partial journey and parcel rather than crediting the clinic or restoring a fictitious home',()=>{
 const s=setup({raid:true}),start=s.campaign,before=structuredClone(start);let error;try{run(s);}catch(e){error=e;}
 assert.ok(error);assert.ok(error.campaign.pendingEncounter);assert.ok(clock(error.campaign)>clock(start));assert.equal(error.saltaCordobaOriginSupply.restored,false);assert.equal(error.saltaCordobaOriginSupply.deliveredCount,0);assert.equal(error.saltaCordobaOriginSupply.delivery,null);assert.ok(error.saltaCordobaOriginSupply.hire);assert.equal(error.saltaCordobaOriginSupply.orders.filter(row=>row.action.type==='recruitCivic').length,1);
 assert.equal(error.campaign.operativeState[s.holderId].medkits,6);assert.equal(error.campaign.operativeState[s.carrierId].medkits,5);assert.equal(operativeLocation(error.campaign,s.holderId),'cordoba');for(const id of s.field)assert.equal(operativeLocation(error.campaign,id),'tucuman');assert.deepEqual(start,before);replay(start,{campaign:error.campaign,receipt:error.saltaCordobaOriginSupply});
});

test('a resolver refusal preserves its actually admitted later campaign and battle pair with the exact error identity',()=>{
 const s=setup({raid:true}),start=s.campaign,before=structuredClone(start),refusal=new Error('Actual tactical admission stops this fresh courier.');let accepted,error;
 try{run(s,{resolveEncounter:c=>{const next=order(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'}),initial=enterSector(next.pendingBattle,next.sectorStates[next.pendingBattle.sector]),pair=syncBattleTime(next,initial);assert.equal(pair.error,null);accepted={campaign:pair.campaign,battle:pair.battle};refusal.campaign=accepted.campaign;refusal.battle=accepted.battle;throw refusal;}});}catch(e){error=e;}
 assert.strictEqual(error,refusal);assert.strictEqual(error.campaign,accepted.campaign);assert.strictEqual(error.battle,accepted.battle);assert.equal(error.saltaCordobaOriginSupply.externalTransitions.length,1);const transition=error.saltaCordobaOriginSupply.externalTransitions[0];assert.equal(transition.completed,false);assert.equal(transition.orderTape,null);assert.deepEqual(transition.after,accepted);saved(accepted);assert.deepEqual(start,before);
});

test('the current authored Tucumán map pays an alternative public climb before relaying through twelve unchanged roof posts',()=>{
 const field=[131,112,122,127,103,144,101,108,121,126,129,130],doctor=122,patient=112,holderId=102,carrierId=135,specialist=140,stock=10;
 const content=defaultContentPackage();content.headquarters='tucuman';content.startingTerritory.tucuman.owner='patriot';content.startingTerritory.cordoba.owner='patriot';content.rules.startingTreasury=500000;
 for(const id of [...field,holderId,carrierId,specialist])content.characters.find(person=>person.id===`person-${id}`).arrivalHours=0;
 const wounded=content.characters.find(person=>person.id===`person-${patient}`);wounded.startingCondition={hp:wounded.attributes.maxHp-30,bleeding:0,bandaged:30,energy:100,fatigue:0};
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content);
 for(const id of [...field,holderId]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:id===holderId?'cordoba':'tucuman'});assert.equal(cash-c.resources.treasury,quote.total);}
 c=order(c,{type:'createSquad',sector:'tucuman',name:'Current first clinical roof',ids:field.slice(0,6)});const firstHome=c.activeSquadId;c=order(c,{type:'createSquad',sector:'tucuman',name:'Current second clinical roof',ids:field.slice(6)});c=stageRouteRoofDefenders(c,field);
 c=order(c,{type:'createSquad',sector:'cordoba',name:'Current original depot holder',ids:[holderId]});const sourceHome=c.activeSquadId,sourceOwn=c.operativeState[holderId].medkits;c=discoverRouteCache(c,holderId);const collected=collectRouteItems(c,holderId,{item:'medkits'},stock);c=collected.campaign;assert.equal(collected.collected,stock);assert.equal(c.operativeState[holderId].medkits,sourceOwn+stock);c=stageRouteRoofDefenders(c,[holderId]);
 c=order(c,{type:'selectSquad',id:firstHome});for(let i=0;c.squads.length<8;i++)c=order(c,{type:'createSquad',sector:'tucuman',name:'Current empty record '+i,ids:[field[2]]});c=order(c,{type:'assignToSquad',operativeId:field[2],squadId:firstHome});c=order(c,{type:'selectSquad',id:firstHome});c=order(c,{type:'squad',ids:field.slice(0,6)});
 for(const id of field)c=order(c,{type:'assignCare',operativeId:id,assignment:id===doctor?'doctor':id===patient?'patient':'rest'});c=order(c,{type:'selectSquad',id:sourceHome});
 assert.deepEqual(content,declaration);const start=saved({campaign:c}).campaign,before=structuredClone(start),paidOffers=[{op:rosterFor(start).find(op=>op.id===carrierId),quote:contractQuote(start,rosterFor(start).find(op=>op.id===carrierId),'week')}],fieldOffers=[{id:specialist,quote:contractQuote(start,rosterFor(start).find(op=>op.id===specialist),'day')}];
 assert.equal(start.sectorStates.tucuman.width,64);assert.equal(start.sectorStates.tucuman.height,48);assert.equal(start.squads.length,8);assert.ok(field.every(id=>start.operativeState[id].residentPosition?.tacticalLevel>0));assert.equal(new Set(field.map(id=>JSON.stringify(start.operativeState[id].residentPosition))).size,12);
 const options={holderId,carrierId,requestedCount:4,paidOffers,fieldOffers,deadlineSeconds:clock(start)+72*3600},result=courierSaltaCordobaOriginDressings(start,options),end=result.campaign,r=result.receipt,visit=r.visits.find(row=>row.sector==='tucuman'),contact=visit.relayContact,approach=contact.approach,posts=field.map(id=>start.operativeState[id].residentPosition);
 assert.equal(contact.initialContactCount,0,'The real original shortest-path choice has no admitted fixed-post contact.');assert.ok(contact.initialReachable.some(point=>point.crossesOldPost));assert.ok(approach?.completed&&contact.finalContactCount>0,'A paid actual alternative access must precede the new contact quotation.');
 assert.deepEqual(visit.initial.climbLinks.find(link=>link.id===approach.link.id),approach.link);assert.deepEqual(approach.arrivedAt,approach.link.from);assert.equal(approach.climbQuote.valid,true);assert.ok(sameCell(approach.climbQuote.destination,approach.link.to));assert.ok(!posts.some(post=>sameCell(post,approach.link.to)));assert.ok(approach.groundQuote.path.length>0&&approach.groundQuote.path.every(point=>(point.tacticalLevel??0)===0&&!posts.some(post=>sameCell(post,point))));
 const climbIndex=visit.actions.findIndex(action=>action.type==='climb'&&action.linkId===approach.link.id);assert.ok(climbIndex>0&&visit.actions.slice(0,climbIndex).some(action=>action.type==='move'));assert.ok(visit.actions.filter(action=>action.type==='move').every(action=>!posts.some(post=>sameCell(post,action))));assert.equal(visit.movementSteps,visit.actions.filter(action=>['move','climb'].includes(action.type)).length);assert.ok(visit.movementSteps<=128);
 for(const current of r.visits){const last=r.orders.find(row=>row.kind==='campaign'&&row.action.type==='leaveSector'&&row.action.battleId===current.initial.battleId);assert.ok(last&&last.to-current.initial.startSeconds<=3600);}
 assert.equal(r.deliveredCount,4);assert.ok(r.relayPlan.ids.length>2);assert.equal(r.relayTransfers.length,r.relayPlan.ids.length-1);assert.equal(r.delivery.toId,doctor);assert.equal(r.delivery.clinicStockAfterDelivery-r.delivery.clinicStockBeforeDelivery,4);assert.equal(end.operativeState[holderId].medkits,start.operativeState[holderId].medkits-4);assert.equal(r.remainingCarrierDressings,before.operativeState[carrierId].medkits);assert.equal(end.operativeState[patient].hp,end.operativeState[patient].maxHp);
 for(const id of r.relayPlan.ids.slice(1,-1))assert.equal(end.operativeState[id].medkits,start.operativeState[id].medkits);for(const id of [...field,holderId]){assert.deepEqual(end.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(end.operativeState[id].assignment,start.operativeState[id].assignment);assert.equal(operativeLocation(end,id),operativeLocation(start,id));assert.ok(end.recruited.includes(id)&&end.operativeState[id].alive&&contractExpiresSeconds(end.contracts[id])>clock(end));}
 assert.equal(total(end),total(start)-r.care.reduce((sum,row)=>sum+row.usedDressings,0));assert.equal(end.resources.treasury,start.resources.treasury-r.hire.debit-r.funding.setupCost-r.funding.travelFees-r.renewals.reduce((sum,row)=>sum+row.quote.price,0));assert.ok(clock(end)<=options.deadlineSeconds);assert.equal(r.restored,true);assert.deepEqual(end.squads,start.squads.map(group=>group.id===sourceHome?{...group,members:[...group.members,carrierId]}:group));assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(courierSaltaCordobaOriginDressings(saved({campaign:start}).campaign,options),result);
});
