import {completeQueuedAssault,stageAssaultDeparture} from './assault-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {enterSector} from '../packages/game/world.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {depotSelection} from '../packages/game/artillery-depots.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';
import {canReassignOperative,operativeLocation} from '../packages/game/squads.js';
import {prepareRouteSupportBattery} from './route-support-battery.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {artilleryProfile} from '../packages/game/artillery-definitions.js';
import {artilleryTransportQuote,storedArtilleryRecord} from '../packages/game/artillery-transport.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {continueNorthernHandoverTravel,resolveNorthernHandoverEncounter} from './northern-handover-route.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {prepareNorthernRoadMedicalReserve} from './northern-road-reserve-preparation.mjs';

const localMembers=(c,preferred,limit=6,allowed=null)=>[...new Set([...preferred,...c.squad,...c.recruited])].filter(id=>(!allowed||allowed.has(id))&&canReassignOperative(c,id)&&operativeLocation(c,id)===c.location).slice(0,limit);

// A local hospital reserve with only spent pieces keeps its paid roof posts.
// Select once from the actual entry; a charged battery keeps its existing
// coastal crew policy even after it spends its final round during this fight.
export function northernRoadReserveController(initial){
 const guns=initial.artillery.filter(g=>g.side==='player');
 return guns.length&&guns.every(g=>!g.loaded&&!(g.ammo>0))
  ?coordinatedHospitalBattery(initial,{coordinateEmptyGround:true}).controller
  :coastalBatteryController(initial,{sharedArtillerySight:true});
}

// An immediate travel order may return with a live encounter or unfinished
// journey. Resolve it through the existing native reserve/save/finite-aid path,
// then follow that same selected party; an order return is not an arrival.
export function completeNorthernRoadArrival(start,{target='tucuman',mode='posta',keepServing,report=()=>{}}={}){
 const before=structuredClone(start),squadId=start.activeSquadId,party=start.squads.find(q=>q.id===squadId);assert.ok(party);
 assert.equal(start.pendingBattle,null);
 assert.ok(keepServing===undefined||party.members.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured).every(id=>keepServing.includes(id)),'The actual travelling party must retain road duty.');
 let defendedTarget=false;
 const campaign=continueNorthernHandoverTravel(start,{squadId,target,mode:party.journey?.mode??mode,keepServing,controllerFor:northernRoadReserveController,report:event=>{
  if(event.event==='northernHandoverDefenseReplay'&&event.sector===target){assert.equal(event.status,'victory');assert.equal(event.exactSavedReplay,true);defendedTarget=true;}
  report(event);
 }});
 assert.deepEqual(start,before);assert.equal(campaign.location,target);assert.equal(campaign.activeSquadId,squadId);
 assert.equal(campaign.squads.find(q=>q.id===squadId).journey,undefined);assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 return {campaign,defendedTarget};
}

// Defend with a real relief column, withdraw the threatened rear guard, then
// recapture the occupied road with both forces. Losses persist through local care.
export function restoreNorthernRoad(start,{report=()=>{},keepServing}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.ok(keepServing===undefined||Array.isArray(keepServing)&&new Set(keepServing).size===keepServing.length&&keepServing.every(id=>Number.isSafeInteger(id)&&c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured));
 const keepers=keepServing===undefined?null:new Set(keepServing);
 const retained=()=>c.recruited.filter(id=>c.operativeState[id].alive&&(!keepers||keepers.has(id)));
 const renew=hours=>{
  const until=(c.hour+hours)*3600+(c.secondOfHour??0);
  const due=contract=>keepers?contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=until:contract?.expiresAt!=null&&contract.expiresAt<=c.hour+hours;
  for(const id of retained())while(due(c.contracts[id])){
   const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
   assert.equal(quote.available,true,quote.reason);const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,...(keepers?{expectedExpiresSecond:contract.expiresSecond??0}:{})};
   c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),quote.expiresAt*3600+(quote.expiresSecond??0));
   report({event:'northernRoadRenewal',id,action,quote:structuredClone(quote),cost:quote.price,hour:c.hour,second:c.secondOfHour??0});
  }
 };
 const order=a=>{
  if(a.type==='wait')renew(a.hours);
  if(keepers&&a.type==='travel'&&a.queue!==true){const quote=previewStrategicRoute(c,c.activeSquadId,a.sector,a.mode??'march');assert.equal(quote.valid,true,quote.reason);renew(quote.hours);}
  const before=c,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  report({event:'northernRoadOrder',action:structuredClone(a),cost:before.resources.treasury-c.resources.treasury,elapsedSeconds:(c.hour-before.hour)*3600+(c.secondOfHour??0)-(before.secondOfHour??0),hour:c.hour,second:c.secondOfHour??0});
  const expired=before.recruited.filter(id=>before.operativeState[id].alive&&!c.recruited.includes(id)&&c.operativeState[id].alive);
  if(expired.length)report({event:'northernRoadServiceExpired',ids:expired,campaign:structuredClone(c)});
 };
 let medicalProgress=null,medicalReady=false;
 for(let attempt=0;attempt<4;attempt++){
  const prepared=prepareNorthernRoadMedicalReserve(c,{progress:medicalProgress,...(keepers?{keepServing:[...keepers]}:{}),report});
  c=prepared.campaign;medicalProgress=prepared.progress;
  if(keepers&&prepared.reliefId!==null&&c.recruited.includes(prepared.reliefId))keepers.add(prepared.reliefId);
  if(c.pendingEncounter){c=resolveNorthernHandoverEncounter(c,{controllerFor:northernRoadReserveController,report});continue;}
  assert.equal(prepared.ready,true,prepared.reason);medicalReady=true;break;
 }
 assert.equal(medicalReady,true,'Reserve preparation must finish within its actual encounter retry bound.');
 assert.equal(c.pendingEncounter,null,'Reserve preparation must resolve its real encounter before field work.');
 assert.ok(!medicalProgress||medicalProgress.staging&&c.operativeState[medicalProgress.id].assignment==='rest','The paid medical reserve must finish actual staging before the field leaves.');
 {
 // Use surviving local members; a named relief physician may be dead, unpaid
 // or still treating another town and cannot be teleported into this column.
 const field=localMembers(c,[9,11,1000,10,4],6,keepers);assert.ok(field.length);order({type:'squad',ids:field});
 let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,field).battle}));
 c=supplyRouteAmmunition(c,field,{target:12}).campaign;
 const battery=prepareRouteSupportBattery(c,{report,...(keepers?{keepServing:[...keepers]}:{})});c=battery.campaign;if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<24&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:battery.selections});order({type:'travel',sector:'tucuman',mode:'posta'});
 let defendedOnArrival=false;
 if(c.pendingEncounter||c.squads.find(q=>q.id===c.activeSquadId).journey){
  recordRouteStrategicEvidence({helper:'restoreNorthernRoad',stage:'travel-interruption-input',campaign:c,context:{target:'tucuman',squadId:c.activeSquadId,scope:'Actual returned immediate travel and its mandatory encounter/current journey; no additional orders or synchronization.'}});
  const arrival=completeNorthernRoadArrival(c,{report,...(keepers?{keepServing:[...keepers]}:{})});c=arrival.campaign;defendedOnArrival=arrival.defendedTarget;
 }
 assert.equal(c.location,'tucuman');assert.equal(c.squads.find(q=>q.id===c.activeSquadId).journey,undefined);assert.equal(c.pendingEncounter,null);
 if(!defendedOnArrival){
 for(const operativeId of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='tucuman'))order({type:'assignCare',operativeId,assignment:'rest'});
 const began=c.hour*3600+(c.secondOfHour??0),maxWaitHours=keepers?168:48;let zeroTime=0;
 for(let attempt=0;attempt<maxWaitHours*3&&!c.pendingEncounter&&c.hour*3600+(c.secondOfHour??0)-began<maxWaitHours*3600;attempt++){
  const before=c.hour*3600+(c.secondOfHour??0);order({type:'wait',hours:1});
  zeroTime=c.hour*3600+(c.secondOfHour??0)===before?zeroTime+1:0;assert.ok(zeroTime<3,'The actual road watch must advance or stop for a public encounter.');
 }
 report({event:'northernRoadWatchComplete',maxWaitHours,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-began,campaign:structuredClone(c)});
 assert.equal(c.pendingEncounter?.sector,'tucuman','The paid northern column must meet its actual Tucumán defense within the bounded watch.');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 c=fightNorthernSector(c,'tucuman',{controller:coastalBatteryController(enterSector(c.pendingBattle,c.sectorStates.tucuman),{sharedArtillerySight:true}),report}).campaign;
 report({event:'northernRoadDefended',campaign:decodeSave(encodeSave(c)).campaign});
 }else report({event:'northernRoadDefended',duringArrival:true,campaign:decodeSave(encodeSave(c)).campaign});
 }
 {
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='tucuman');
 for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<48&&!c.pendingEncounter&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  const injured=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
  const doctors=rosterFor(c).filter(o=>field.includes(o.id)&&!injured.includes(o.id)&&o.medical>=20&&c.operativeState[o.id].energy>10&&!c.operativeState[o.id].asleep).sort((a,b)=>b.medical-a.medical).slice(0,injured.length);
  for(const doctor of doctors){
   if(!c.operativeState[doctor.id].medkits){const donor=field.find(id=>id!==doctor.id&&c.operativeState[id].medkits>0);if(donor!==undefined){order({type:'sectorInventory',sector:'tucuman',operativeId:donor,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(c,'tucuman',rosterFor(c),doctor.id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');order({type:'sectorInventory',sector:'tucuman',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});}else c=collectRouteItems(c,doctor.id,{item:'medkits'},1).campaign;}
   order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  }
  for(const id of injured)order({type:'assignCare',operativeId:id,assignment:'patient'});order({type:'wait',hours:1});
 }
 }
 report({event:'northernRoadCareCompleted',campaign:decodeSave(encodeSave(c)).campaign});
 if(keepers&&!c.pendingEncounter&&c.sectors.cordoba.owner==='patriot'){
  // An actual controlled Córdoba needs no invented retreat or reconquest.
  // Its local ward can bring the already-owned charged depot gun north.
  assert.equal(c.pendingBattle,null);
  const pieces=[...(c.sectorStates.cordoba?.artillery??[]).map(gun=>({source:'field',gun})),...(c.artilleryDepots?.cordoba??[]).map(gun=>({source:'depot',gun}))];
  const piece=pieces.find(row=>row.gun.side==='player'&&(row.gun.loaded||row.gun.ammo>0));assert.ok(piece,'The actual Córdoba return needs its existing remaining gun.');
  const ward=c.recruited.filter(id=>canReassignOperative(c,id)&&operativeLocation(c,id)==='cordoba');assert.ok(ward.length>=artilleryProfile(c,piece.gun).crew,'The actual Córdoba ward must provide its free local crew.');
  assert.equal(sectorInventoryModel(c,'cordoba',rosterFor(c),ward[0]).carriedReason,null);
  report({event:'northernRoadControlledReturn',ward,gun:storedArtilleryRecord(piece.gun),source:piece.source,campaign:decodeSave(encodeSave(c)).campaign});
  const returned=returnNorthernOfficers(c,{artilleryId:piece.gun.id,source:piece.source,report});report({event:'northernReturnReunited',campaign:decodeSave(encodeSave(returned)).campaign});return returned;
 }
 assert.equal(c.pendingEncounter?.sector,'cordoba');
 {
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'retreat',destination:'san_nicolas'});assert.equal(c.sectors.cordoba.owner,'royalist');
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),groups=[];
 for(const at of ['tucuman','san_nicolas']){const ids=field.filter(id=>c.operativeState[id].location===at);for(let i=0;i<ids.length;i+=6){order({type:'createSquad',ids:ids.slice(i,i+6),sector:at,name:'Recuperación del camino'});groups.push(c.activeSquadId);for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});c=finishReloadsBeforeMarch(c);}}
 order({type:'configureArtillery',types:['swivel']});
 for(const id of groups){order({type:'selectSquad',id});order({type:'attack',sector:'cordoba',queue:true,mode:'posta'});}
 c=completeQueuedAssault(c,groups,'cordoba',{execute:request=>{order(request);return c;}});
 c=fightNorthernSector(c,'cordoba',{controller:coastalBatteryController(enterSector(c.pendingBattle,c.sectorStates.cordoba),{sharedArtillerySight:true}),report}).campaign;
 }
 report({event:'roadRecaptured',campaign:decodeSave(encodeSave(c)).campaign});
 const recovered=recoverRecapturedRoad(c);c=recovered.campaign;
 report({event:'northernRoadRecovered',hour:c.hour,treasury:c.resources.treasury,careEvents:recovered.events});
 return returnNorthernOfficers(c);
}

export function returnNorthernOfficers(start,{artilleryId,source='field',report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.ok(['field','depot'].includes(source));
 const order=a=>{
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?24:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+elapsed){
    const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt};
    const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];
    report({event:'northernOfficerRenewal',id,action,quote:structuredClone(quote),cost:cash-c.resources.treasury,hour:c.hour,second:c.secondOfHour??0,afterExpiry:contractExpiresSeconds(q)});
   }
  }
  const before=c,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  report({event:'northernOfficerOrder',action:structuredClone(a),cost:before.resources.treasury-c.resources.treasury,elapsedSeconds:(c.hour-before.hour)*3600+(c.secondOfHour??0)-(before.secondOfHour??0),hour:c.hour,second:c.secondOfHour??0,...(a.type==='travel'?{campaign:decodeSave(encodeSave(c)).campaign}:{})});
 };
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='cordoba'),groups=[];
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),sector:'cordoba',name:'Regreso del norte'});groups.push(c.activeSquadId);for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});}
 if(!c.routes.carts)order({type:'transport',mode:'carts'});
 const gun=(source==='depot'?c.artilleryDepots?.cordoba??[]:c.sectorStates.cordoba.artillery).find(g=>g.side==='player'&&(artilleryId===undefined||g.id===artilleryId));assert.ok(gun);assert.ok(gun.loaded||gun.ammo>0,'the transported battery needs actual remaining shots');
 // A final support column can have one member after real casualties. Load
 // the piece with an existing local column admitted by the ordinary quote.
 const crew=groups.find(id=>{
  const selected=dispatchCampaign(c,{type:'selectSquad',id});
  return !selected.lastError&&selected.squad.length>=artilleryProfile(selected,gun).crew&&artilleryTransportQuote(selected,'cordoba',gun.id,'tucuman','carts',source).available;
 });
 assert.ok(crew,'The actual return needs a capable local crew for the remaining finite gun.');order({type:'selectSquad',id:crew});
 const quote=artilleryTransportQuote(c,'cordoba',gun.id,'tucuman','carts',source),treasury=c.resources.treasury,record=storedArtilleryRecord(gun),beforeCampaign=decodeSave(encodeSave(c)).campaign;
 const action={type:'transportArtillery',sector:'cordoba',artilleryId:gun.id,to:'tucuman',mode:'carts',...(source==='depot'?{source}:{})};order(action);
 assert.equal(c.resources.treasury,treasury-quote.cost);assert.deepEqual(c.artilleryTransfers.find(transfer=>transfer.id===gun.id).gun,record,'The return transports the same remaining rounds and loading state.');
 report({event:'northernOfficerGunDispatched',source,crew:[...c.squad],quote:structuredClone(quote),gun:record,action,beforeCampaign,treasuryBefore:treasury,treasuryAfter:c.resources.treasury,campaign:decodeSave(encodeSave(c)).campaign});
 for(const id of groups){order({type:'selectSquad',id});order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});}
 for(let h=0;h<36&&groups.some(id=>c.squads.find(q=>q.id===id).journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 report({event:'northernOfficerColumnsArrived',field:[...field],groups:[...groups],campaign:decodeSave(encodeSave(c)).campaign});
 order({type:'squad',ids:localMembers(c,[9,11,10,4],5)});for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<72&&((c.artilleryTransfers??[]).length||c.resources.treasury<300);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});
 order({type:'diplomacy',kind:'partisanSupply'});
 const envoy=rosterFor(c).filter(op=>c.squad.includes(op.id)&&canReassignOperative(c,op.id)).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0];assert.ok(envoy);
 c=meetRecruits(c,['azurduy'],envoy.id);field.push(1);

 assert.equal(c.location,'tucuman');assert.ok(c.squad.includes(1));
 report({event:'northernOfficerReturnComplete',field,gun:record,campaign:decodeSave(encodeSave(c)).campaign});
 return c;
}

export function prepareRestoredSalta(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){
    const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];
   }
  }
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='tucuman');
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),sector:'tucuman',name:'Columna de Salta'});for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
 const piece=c.artilleryDepots.tucuman.filter(g=>g.side==='player'&&(g.loaded||g.ammo>0)&&artilleryProfile(c,g).crew<=field.length).sort((a,b)=>Number(b.type==='swivel')-Number(a.type==='swivel')||b.ammo+Number(b.loaded)-a.ammo-Number(a.loaded)||a.id.localeCompare(b.id))[0];
 assert.ok(piece,'the final column needs an actual local loaded or supplied gun with enough living crew');order({type:'configureArtillery',types:[depotSelection(piece)]});
 c=prepareFinalAssault(c,{staging:'tucuman',target:'salta',fieldIds:field});
 return c;
}
