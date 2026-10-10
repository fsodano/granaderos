import {encounterDefinitions} from '../game/encounters.js';
import {supplyRouteDressings} from './route-dressings.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {artilleryTransportPath,artilleryTransportQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition,ammunitionOrderQuote,AMMUNITION_ORDER_LIMIT} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoStock,ammoCount,AMMO_KEYS} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {addAmmoCounts,unitAmmunitionByType,fieldAmmunitionByType} from '../game/physical-ammunition.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {operativeLocation} from '../game/squads.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {firstAidPlan} from '../game/first-aid.js';
import {careAssignmentReason} from '../game/medical-care.js';
import {strategicBleedingPercent} from '../game/campaign-care-rules.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {recoverRouteFirearm} from './finite-route-equipment.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {recordRouteCareFailure} from './route-care-failure-evidence.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {actBattle,presentedActBattle,itemUsePreview,exitPreview,getReachable} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';

// Treat only actual local survivors with finite carried or recovered
// dressings. Renew each real contract before an hourly care step.
function recoverCreatedCuyoHospital(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
 const order=a=>{
  if(a.type==='wait')for(const id of assembled){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(c.lastError,null,c.lastError);}}
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
 };
// Budget care from actual wounds and carried dressings. A healthy party must
// not spend 450 pesos on a fixed bulk purchase before signing its defender.
const donate=id=>{
 const sourceId=assembled.find(other=>other!==id&&c.operativeState[other].medkits>0&&!sectorInventoryModel(c,'cordoba',rosterFor(c),other).reason);
 if(sourceId){order({type:'sectorInventory',sector:'cordoba',operativeId:sourceId,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(c,'cordoba',rosterFor(c),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});return true;}
 c=supplyRouteDressings(c,id,1,{report});return true;
};
for(let h=0;h<144&&assembled.some(id=>c.operativeState[id].alive&&c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});c=fightNorthernSector(c,'cordoba',{controller:cautiousCombatOrder,report}).campaign;}
 const injured=assembled.filter(id=>c.operativeState[id].alive&&c.operativeState[id].hp<c.operativeState[id].maxHp);
 const docs=rosterFor(c).filter(op=>assembled.includes(op.id)&&c.operativeState[op.id].alive&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&op.medical>=20).sort((a,b)=>Number(injured.includes(a.id))-Number(injured.includes(b.id))||b.medical-a.medical).slice(0,Math.min(4,injured.length)).map(op=>op.id);
 for(const id of docs)if(!c.operativeState[id].medkits)donate(id);
 const supplied=new Set(docs.filter(id=>c.operativeState[id].medkits>0));
 for(const id of assembled)if(c.operativeState[id].alive){const assignment=supplied.has(id)?'doctor':injured.includes(id)?'patient':'rest';if(c.operativeState[id].assignment!==assignment)order({type:'assignCare',operativeId:id,assignment});}
 if(h%12===0)report({event:'createdCuyoCare',hour:c.hour,cash:c.resources.treasury,injured:injured.map(id=>[id,c.operativeState[id].hp]),doctors:[...supplied]});
 order({type:'wait',hours:1});
}
for(const id of assembled)if(c.operativeState[id].alive)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
return c;
}

// Preserve a real rear gun before the provincial force leaves its city.
// The foundry needs three owned pieces, including exhausted ones; its work
// does not replace a cannon later left behind in occupied territory.
function secureCreatedCuyoRearBattery(start,{report=()=>{}}={}){
 let c=start;
 if(c.location!=='salta'||c.sectors.salta.owner!=='patriot')return c;
 const local=(c.sectorStates.salta?.artillery??[]).filter(gun=>gun.side==='player');
 let secured=ownedArtilleryCount(c)-local.length;
 for(const gun of local.filter(gun=>gun.type==='bronze4'&&gun.id.startsWith('arsenal:')).sort((a,b)=>a.id.localeCompare(b.id))){
  if(secured>=3)break;
  const quote=artilleryTransportQuote(c,'salta',gun.id,'cordoba','carts','field');
  if(!quote.available){report({event:'cuyoRearGunUnavailable',id:gun.id,reason:quote.reason,hour:c.hour});continue;}
  const record=storedArtilleryRecord(gun),cash=c.resources.treasury,clock=c.hour*3600+(c.secondOfHour??0);
  c=dispatchCampaign(c,{type:'transportArtillery',sector:'salta',artilleryId:gun.id,to:'cordoba',mode:'carts',source:'field'});
  assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash-quote.cost);
  assert.equal(c.hour*3600+(c.secondOfHour??0),clock);
  const transfer=c.artilleryTransfers.find(transfer=>transfer.id===gun.id);
  assert.deepEqual(transfer.gun,record);assert.deepEqual(transfer.path,quote.path);assert.equal(transfer.dueAt,c.hour+quote.hours);
  assert.ok(!c.sectorStates.salta.artillery.some(piece=>piece.id===gun.id));secured++;
  report({event:'cuyoRearGunShipment',id:gun.id,from:'salta',to:'cordoba',crew:quote.crew,cost:quote.cost,dueAt:transfer.dueAt,record:structuredClone(record),transfer:structuredClone(transfer),campaign:structuredClone(c)});
 }
 return c;
}

// Actual transport, finite carried care and defense after fresh Yatasto.
export function assembleCreatedCuyo(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const withdrawRear=()=>{
  if(c.pendingEncounter?.sector==='salta'){
   const selected=c.activeSquadId,groupId=c.pendingEncounter.groupId;
   c=dispatchCampaign(c,{type:'respondToEncounter',groupId,choice:'retreat',destination:'tucuman'});assert.equal(c.lastError,null,c.lastError);
   c=dispatchCampaign(c,{type:'selectSquad',id:selected});assert.equal(c.lastError,null,c.lastError);
   report({event:'cuyoRearWithdrawal',groupId,hour:c.hour,destination:'tucuman'});
  }
 };
 const order=a=>{
  if(a.type!=='respondToEncounter')withdrawRear();
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<=c.hour+elapsed){const contract=c.contracts[id],next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
  // A blocking travel order can encounter the rear raid during its own
  // elapsed hours. Resolve that actual interruption before route assertions.
  if(a.type!=='respondToEncounter')withdrawRear();
 };
const pastSurvivors=new Set((c.sectorStates.salta?.units??[]).filter(unit=>unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure).map(unit=>Number(unit.id)));
const requiredLeadership=Math.max(...encounterDefinitions(c).filter(npc=>['guemes','macacha'].includes(npc.id)).map(npc=>npc.requiredLeadership));
const clock=c.hour*3600+(c.secondOfHour??0),speaker=rosterFor(c).filter(op=>pastSurvivors.has(op.id)&&op.leadership>=requiredLeadership&&c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&(contractExpiresSeconds(c.contracts[op.id])===null||contractExpiresSeconds(c.contracts[op.id])>clock)).sort((a,b)=>Number(c.operativeState[b.id].location==='salta')-Number(c.operativeState[a.id].location==='salta')||b.leadership-a.leadership||a.id-b.id)[0];
assert.ok(speaker,'the provincial meeting needs an actual fit serving survivor of Salta');
const origin=c.operativeState[speaker.id].location,initialCash=c.resources.treasury,initialSeconds=clock;
order({type:'createSquad',sector:origin,ids:[speaker.id],name:'Enlace de Salta'});
if(origin!=='salta'){
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 if(!c.routes.posta)order({type:'transport',mode:'posta'});
 const journeySquad=c.activeSquadId;order({type:'travel',sector:'salta',queue:true,mode:'posta'});
 for(let h=0;h<48&&c.squads.find(squad=>squad.id===journeySquad)?.journey;h++){assert.equal(c.pendingEncounter,null,'resolve the real encounter before the provincial meeting');order({type:'wait',hours:1});}
 assert.equal(c.location,'salta');assert.equal(c.squads.find(squad=>squad.id===journeySquad)?.journey,undefined);
}
report({event:'actualCuyoSpeakerArrival',id:speaker.id,origin,sector:c.location,hour:c.hour,second:c.secondOfHour,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-initialSeconds,cashDelta:c.resources.treasury-initialCash,contract:structuredClone(c.contracts[speaker.id]),record:structuredClone(c.operativeState[speaker.id]),campaign:structuredClone(c)});
c=meetRecruits(c,['guemes','macacha'],speaker.id);
report({event:'actualCuyoMeetingComplete',speaker:speaker.id,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,squad:c.squad,campaign:structuredClone(c)});
c=secureCreatedCuyoRearBattery(c,{report});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
// Bring the surviving northern reserve to the assembly point before paying
// for the elite's short contract. Every reinforcement travels normally.
const assemblySquad=c.activeSquadId,reinforcementSquads=[];
const elsewhere=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location!=='cordoba';});
for(const sector of new Set(elsewhere.map(id=>c.operativeState[id].location))){
 const ids=elsewhere.filter(id=>c.operativeState[id].location===sector);
 for(let offset=0;offset<ids.length;offset+=6){
  const members=ids.slice(offset,offset+6);order({type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector});
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  for(const id of members){
   const model=()=>sectorInventoryModel(c,sector,rosterFor(c),id);
   for(const row of model().entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
    let count=Math.min(row.count,20-c.operativeState[id].medkits);if(count<=0)break;
    while(count>0&&dispatchCampaign(c,{type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count}).lastError)count--;
    if(count)order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   }
  }
  const posta=previewStrategicRoute(c,c.activeSquadId,'cordoba','posta');
  const route=posta.valid?posta:previewStrategicRoute(c,c.activeSquadId,'cordoba','march');
  assert.equal(route.valid,true,route.reason);
  reinforcementSquads.push(c.activeSquadId);order(route.action);
  report({event:'cuyoReinforcementRoute',origin:sector,members,mode:route.action.mode,path:route.path,hours:route.hours});
 }
}
for(let h=0;h<48&&reinforcementSquads.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(reinforcementSquads.every(id=>c.squads.find(q=>q.id===id)?.location==='cordoba'));
order({type:'selectSquad',id:assemblySquad});
const assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
const candidates=rosterFor(c).filter(op=>assembled.includes(op.id)).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.marksmanship-a.marksmanship);
const field=[...new Set([1,0,8,...candidates.map(op=>op.id)])].filter(id=>assembled.includes(id)).slice(0,5);
assert.equal(field.length,5,'keep five actual soldiers and a slot for the paid marksman');
order({type:'squad',ids:field});const main=c.activeSquadId;
const reserve=assembled.filter(id=>!field.includes(id));
for(let offset=0;offset<reserve.length;offset+=6)order({type:'createSquad',name:'Reserva de Cuyo',ids:reserve.slice(offset,offset+6),sector:'cordoba'});
order({type:'selectSquad',id:main});

// Finish the actual chambers and leave the arriving force on reachable roofs.
// Hospital work may be interrupted before the wounded infantry can recover.
for(const squad of c.squads.filter(q=>q.location==='cordoba'&&q.members.length)){
 order({type:'selectSquad',id:squad.id});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c,{report});
 const p=visit(c);let battle=p.battle;
 const cells=battle.upperSurfaces.filter(t=>!t.blocked).sort((a,b)=>Math.hypot(a.x-battle.width*.5,a.y-battle.height*.5)-Math.hypot(b.x-battle.width*.5,b.y-battle.height*.5)||a.y-b.y||a.x-b.x);
 const positions=[];
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+battle.lastError);};
 for(const id of c.squad){
  let unit=battle.units.find(u=>u.id===String(id));assert.ok(unit&&unit.hp>=15&&!unit.unconscious);
  const before=structuredClone(unit);
  act({type:'movement',unitId:unit.id,movement:'walk'});unit=battle.units.find(u=>u.id===String(id));
  const destination=cells.find(cell=>!battle.units.some(other=>other.id!==unit.id&&other.hp>0&&sameCell(other,cell))&&getReachable(battle,unit,{stopAt:point=>sameCell(point,cell)}).some(point=>sameCell(point,cell)));
  assert.ok(destination,'each actual defender has an open route to a roof');
  act({type:'move',unitId:unit.id,...spacePoint(destination)});
  act({type:'stance',unitId:unit.id,stance:'crouched'});unit=battle.units.find(u=>u.id===String(id));
  for(const key of ['hp','bleeding','weapon','condition','weaponInstanceId','weaponFittings','blade','bladeInstanceId','loaded','ammo','ammunition','medkits','inventory','headwear','outfit','legwear'])assert.deepEqual(unit[key],before[key],`defensive movement preserves ${id}'s ${key}`);
  const point=spacePoint(unit);positions.push({id:unit.id,point});
  report({event:'createdCuyoDefensePosition',id,before:spacePoint(before),after:point,hp:unit.hp,energy:unit.energy,fatigue:unit.fatigue,loaded:unit.loaded});
 }
 c=leave(sync({campaign:p.campaign,battle}));
 for(const {id,point}of positions)assert.deepEqual(spacePoint(c.sectorStates.cordoba.units.find(u=>u.id===id)),point,'the accepted return keeps the paid defensive position');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
}
order({type:'selectSquad',id:main});

c=recoverCreatedCuyoHospital(c,{report});
for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
report({event:'createdCuyoAssembled',assembled:c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba'),campaign:structuredClone(c)});
return c;
}

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
const carried=(c,id)=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);

// Protect the whole actual serving force, including soldiers outside the
// courier's squad. A real interruption is reported before further preparation.
function stockPreparation(start,report){
 let c=decodeSave(encodeSave(start)).campaign;
 const serving=new Set(living(c));
 const safe=()=>{
  assert.equal(c.pendingBattle,null,'finish the actual tactical report before stock preparation');
  assert.equal(c.pendingEncounter,null,'resolve the actual encounter before stock preparation');
  for(const id of living(c))serving.add(id);
  for(const id of serving){
   const r=c.operativeState[id],contract=c.contracts[id],expiry=contractExpiresSeconds(contract);
   assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured&&contract&&(expiry===null||expiry>clock(c)),`actual serving soldier ${id} must not expire or disappear during preparation`);
   assert.ok(r.hp>=15&&!r.bleeding,`actual acute wounds on ${id} need finite care before preparation advances`);
  }
 };
 const raw=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;};
 const renew=(hours=2)=>{
  safe();
  for(const id of serving){
   let expiry=contractExpiresSeconds(c.contracts[id]);
   while(expiry!==null&&expiry<=clock(c)+hours*3600){
    const q=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],before=c.resources.treasury;
    assert.ok(q.available&&before>=q.price,`actual renewal of ${id} must remain available and affordable`);
    raw({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
    assert.equal(c.resources.treasury,before-q.price);assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);
    report({event:'stockCuyoRenewal',id,price:q.price,expiresAt:c.contracts[id].expiresAt,expiresSecond:c.contracts[id].expiresSecond??0,hour:c.hour,secondOfHour:c.secondOfHour??0});
    expiry=contractExpiresSeconds(c.contracts[id]);
   }
  }
 };
 const order=action=>{renew(action.type==='wait'?Math.max(2,action.hours):2);raw(action);safe();};
 return {get campaign(){return c;},replace(next){c=next;safe();},safe,renew,order};
}

// Stabilize the actual stock battle's survivors. This is a care route, not a
// full-health reset: hourly doctors stop local bleeding before a long
// approach, then a supplied doctor treats each actual local/nearby patient.
// Only discovered reachable supplies and the map's existing exits are used.
export function stabilizeStockMendozaSurvivors(start,{report=()=>{},returnSector}={}){
 const original=structuredClone(start),serving=living(start),dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 let pair={campaign:decodeSave(encodeSave(start)).campaign,battle:null},orders=0,hourlyDressings=0,tacticalDressings=0,clinicalPA=0,renewalCost=0;
 const captureCareEvidence=Boolean(process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR);
 let latestTacticalBoundary=null,lastCareInvocation=null;
 const c=()=>pair.campaign,record=id=>c().operativeState[id],acute=r=>r.hp>0&&(r.hp<15||r.bleeding>0);
 const patients=sector=>serving.filter(id=>acute(record(id))&&(sector===undefined||operativeLocation(c(),id)===sector)).sort((a,b)=>record(a).hp-record(b).hp||record(b).bleeding-record(a).bleeding||a-b);
 const canonical=campaign=>{
  const result=structuredClone(campaign);
  for(const key of ['sectorStates','sceneStates'])if(result[key])result[key]=Object.fromEntries(Object.entries(result[key]).map(([id,scene])=>[id,expandCellScene(scene)]));
  return result;
 };
 const safe=()=>{
  assert.equal(c().pendingEncounter,null,'an actual strategic encounter interrupts finite survivor care');
  for(const id of dead)assert.equal(record(id).alive,false,`previous death ${id} stays final`);
  for(const id of serving){
   const r=record(id),contract=c().contracts[id],expiry=contractExpiresSeconds(contract);
   assert.ok(c().recruited.includes(id)&&r.alive&&r.hp>0&&!r.captured,`actual survivor ${id} must remain alive, free and serving`);
   const deployed=pair.battle?.units.find(u=>u.side==='player'&&u.id===String(id));if(deployed)assert.ok(deployed.hp>0,`actual local patient ${id} died before care could finish`);
   assert.ok(contract&&(expiry===null||expiry>clock(c())),`actual service of ${id} must not expire during care`);
  }
 };
 const checkpoint=stage=>{
  lastCareInvocation='checkpoint';
  safe();const restored=decodeSave(encodeSave(c(),pair.battle));
  assert.deepEqual(canonical(restored.campaign),canonical(c()),'official care save preserves every field after lossless terrain expansion');
  assert.deepEqual(restored.battle,pair.battle);pair=restored;
  report({event:'stockMendozaCareCheckpoint',stage,campaign:structuredClone(c()),battle:structuredClone(pair.battle),orders,
   patients:patients().map(id=>({id,hp:record(id).hp,bleeding:record(id).bleeding,location:operativeLocation(c(),id)})),hourlyDressings,tacticalDressings,clinicalPA,renewalCost});
 };
 const emit=(kind,action,before)=>report({event:'stockMendozaCareOrder',kind,action:structuredClone(action),order:++orders,
  before,hour:c().hour,secondOfHour:c().secondOfHour??0,treasury:c().resources.treasury});
 const raw=(action,afterAccepted=()=>{})=>{
  lastCareInvocation='campaign';
  const before={hour:c().hour,secondOfHour:c().secondOfHour??0,treasury:c().resources.treasury};
  const next=dispatchCampaign(c(),action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  pair={campaign:next,battle:action.type==='visitSector'?enterSector(next.pendingBattle,next.sectorStates[next.location]):pair.battle};
  emit('campaign',action,before);afterAccepted();safe();
 };
 const renew=(seconds=3600)=>{
  safe();const until=clock(c())+seconds;
  for(const id of serving){
   let expiry=contractExpiresSeconds(c().contracts[id]);
   while(expiry!==null&&expiry<=until){
    const contract=c().contracts[id],quote=contractQuote(c(),rosterFor(c()).find(op=>op.id===id),'day'),cash=c().resources.treasury;
    assert.ok(quote.available&&cash>=quote.price,`actual paid renewal of ${id} is unavailable or unaffordable`);
    raw({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
    assert.equal(c().resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c().contracts[id]),expiry+86400);
    renewalCost+=quote.price;expiry=contractExpiresSeconds(c().contracts[id]);
   }
  }
 };
 const order=(action,afterAccepted)=>{assert.equal(pair.battle,null,'strategic care orders require the actual tactical return');renew(action.type==='wait'?action.hours*3600:3600);raw(action,afterAccepted);};
 const unit=id=>pair.battle?.units.find(u=>u.side==='player'&&u.id===String(id));
 const tactical=(action,afterAccepted=()=>{})=>{
  lastCareInvocation='tactical-admission';
  // Renew the whole force while quiet, before entering. A tactical action
  // cannot sneak past that horizon or renew a soldier mid-deployment.
  for(const id of serving){const expiry=contractExpiresSeconds(c().contracts[id]);assert.ok(expiry===null||expiry>clock(c())+600,`care action needs a new quiet renewal of ${id}`);}
  const prior=structuredClone(pair.battle),before={hour:c().hour,secondOfHour:c().secondOfHour??0,treasury:c().resources.treasury};
  // Keep one independently observed action boundary only when diagnostics
  // are enabled. Reuse the battle clone already required by the mutation check.
  if(captureCareEvidence)latestTacticalBoundary={order:orders+1,action:structuredClone(action),before:{campaign:structuredClone(c()),battle:prior}};
  lastCareInvocation='tactical';
  const next=actBattle(pair.battle,action);
  if(captureCareEvidence)latestTacticalBoundary.nativeAfter=structuredClone(next);
  assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,next,'ordinary and presented finite care agree');assert.deepEqual(pair.battle,prior,'ordinary care does not mutate its source');
  const synced=syncBattleTime(c(),next);
  if(captureCareEvidence)latestTacticalBoundary.synchronization=structuredClone(synced);
  assert.equal(synced.error,null,synced.error);pair={campaign:synced.campaign,battle:synced.battle};
  emit('tactical',action,before);afterAccepted();safe();
 };
 const leaveCare=()=>{
  lastCareInvocation='leave';
  assert.ok(pair.battle);const before={hour:c().hour,secondOfHour:c().secondOfHour??0,treasury:c().resources.treasury};
  const action={type:'leaveSector',battleId:c().pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')};
  const next=dispatchCampaign(c(),action);assert.equal(next.lastError,null,next.lastError);pair={campaign:next,battle:null};
  // Replays rebuild the actual report from their actual current pair.
  emit('leave',{},before);safe();
 };
 const stable=id=>{const r=record(id);return r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&!r.unconscious&&!r.routed&&!r.surrendered;};
 const doctors=(sector,requireDressings=true)=>rosterFor(c()).filter(op=>serving.includes(op.id)&&operativeLocation(c(),op.id)===sector&&stable(op.id)&&op.medical>0&&(!requireDressings||(record(op.id).medkits??0)>0))
  .sort((a,b)=>b.medical-a.medical||(record(b.id).medkits??0)-(record(a.id).medkits??0)||record(b.id).energy-record(a.id).energy||a.id-b.id);
 const supplyDoctor=(sector,doctor)=>{
  if(record(doctor.id).medkits>0)return;
  renew();
  const model=sectorInventoryModel(c(),sector,rosterFor(c()),doctor.id),row=model.entries.find(entry=>entry.reachable&&JSON.parse(entry.expected).item==='medkits');
  assert.equal(model.reason,null);assert.ok(row,'a real stable local doctor must recover a known finite dressing before care admission');
  const before={count:row.count,carried:record(doctor.id).medkits,seconds:clock(c()),cash:c().resources.treasury,pool:model.entries.filter(entry=>JSON.parse(entry.expected).item==='medkits').reduce((sum,entry)=>sum+entry.count,0)};
  order({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const after=sectorInventoryModel(c(),sector,rosterFor(c()),doctor.id).entries.filter(entry=>JSON.parse(entry.expected).item==='medkits').reduce((sum,entry)=>sum+entry.count,0);
  assert.equal(after,before.pool-1);assert.equal(record(doctor.id).medkits,before.carried+1);assert.equal(clock(c()),before.seconds);assert.equal(c().resources.treasury,before.cash);
  report({event:'stockMendozaCareAdmissionSupply',doctorId:doctor.id,sector,sourceKey:row.key,sourceBefore:before.count,sourceAfter:before.count-1,carriedBefore:before.carried,carriedAfter:record(doctor.id).medkits,poolBefore:before.pool,poolAfter:after});
 };
 const form=(sector,ids)=>{
  assert.ok(ids.length<=6);order({type:'createSquad',name:'Auxilio de supervivientes',sector,ids,returnToService:true});order({type:'visitSector'});
  assert.equal(pair.battle.mode,'exploration','local survivor care must remain actual peaceful reconnaissance');
 };
 const prepareMedic=(sector,ids)=>{
  const doctor=doctors(sector,false).find(op=>!sectorInventoryModel(c(),sector,rosterFor(c()),op.id).reason);
  assert.ok(doctor,`no actual stable doctor can reach known supplies at ${sector}`);
  supplyDoctor(sector,doctor);
  // Issue the real actor once so capacity uses the same XP/dexterity/skill as
  // first aid. This admission forecasts work; it gives no treatment or supply.
  form(sector,[doctor.id,...ids.slice(0,5)]);const actual=structuredClone(unit(doctor.id));leaveCare();
  let needed=0;
  for(const id of patients()){
   let patient=structuredClone(record(id)),strokes=0;
   while(acute(patient)){
    // The unmodified supplied doctor determines each stroke's work. The
    // patient copy is only a plan for the finite quantity to be collected.
    const plan=firstAidPlan(actual,patient);assert.ok(plan.valid,plan.reason);
    assert.ok(plan.hpAfter>patient.hp||plan.bleedingAfter<patient.bleeding,'a planned stroke must make clinical progress');
    patient={...patient,hp:plan.hpAfter,bleeding:plan.bleedingAfter,bandaged:plan.bandagedAfter};needed++;assert.ok(++strokes<=Math.ceil(record(id).maxHp)+21,'finite stabilization work must converge');
   }
  }
  let missing=Math.max(0,needed-record(doctor.id).medkits);
  const model=()=>sectorInventoryModel(c(),sector,rosterFor(c()),doctor.id);
  const sources=()=>model().entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>0)
   .sort((a,b)=>Math.hypot(a.x-actual.x,a.y-actual.y)-Math.hypot(b.x-actual.x,b.y-actual.y)||b.count-a.count||a.key.localeCompare(b.key));
  assert.ok(sources().reduce((n,row)=>n+row.count,0)>=missing,'known finite local dressings cannot cover actual planned stabilization');
  while(missing){
   const row=sources()[0],n=Math.min(missing,row.count),before=record(doctor.id).medkits,sourceCount=sources().reduce((sum,s)=>sum+s.count,0),cash=c().resources.treasury;
   assert.ok(row,'known local dressing source exhausted');applyItemQuantity(model().personal,{...JSON.parse(row.expected),count:n});
   order({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:n});
   assert.equal(record(doctor.id).medkits,before+n);assert.equal(c().resources.treasury,cash);assert.equal(sources().reduce((sum,s)=>sum+s.count,0),sourceCount-n);
   report({event:'stockMendozaCareSupply',doctorId:doctor.id,sector,sourceKey:row.key,taken:n,sourceBefore:row.count,sourceAfter:row.count-n,carriedBefore:before,carriedAfter:record(doctor.id).medkits});missing-=n;
  }
  report({event:'stockMendozaCarePlan',doctorId:doctor.id,sector,strokes:needed,carried:record(doctor.id).medkits,patients:patients()});return doctor.id;
 };
 const treat=(doctorId,patientId)=>{
  assert.notEqual(doctorId,patientId);if(unit(doctorId).activeSlot!=='medical')tactical({type:'weapon',unitId:String(doctorId),slot:'medical'});
  const supplied=unit(doctorId).medkits;let attempts=0;
  while(acute(unit(patientId))){
   const doctor=unit(doctorId),patient=unit(patientId),preview=itemUsePreview(pair.battle,doctor,patient);
   assert.ok(preview?.valid,`actual first-aid route ${doctorId} -> ${patientId}: ${preview?.reason}`);
   const before={hp:patient.hp,bleeding:patient.bleeding,medkits:doctor.medkits,elapsed:pair.battle.elapsedSeconds};
   tactical({type:'useItem',unitId:String(doctorId),targetId:String(patientId)},()=>{
   const used=before.medkits-unit(doctorId).medkits;
   assert.ok(used===0||used===1,'each actual stroke consumes at most one whole dressing');
   assert.ok(used===1||pair.battle.elapsedSeconds>before.elapsed,'an incomplete approach must make paid progress');
   if(used){tacticalDressings++;clinicalPA+=preview.actionPa;assert.ok(unit(patientId).hp>before.hp||unit(patientId).bleeding<before.bleeding,'paid first aid must make real clinical progress');}
   report({event:'stockMendozaCareTreatment',doctorId,patientId,before,after:{hp:unit(patientId).hp,bleeding:unit(patientId).bleeding,medkits:unit(doctorId).medkits},dressingUsed:used,clinicalPA:used?preview.actionPa:0,routePA:preview.movePa,seconds:pair.battle.elapsedSeconds-before.elapsed});
   });
   assert.ok(++attempts<=supplied+2,'a stalled approach or finite dressing shortage needs a new care plan');
  }
 };
 try{
 assert.equal(c().pendingBattle,null);assert.equal(c().location,'mendoza');safe();checkpoint('before');
 // Stop all local bleeding before an approach can consume a patient's HP.
 // Enough actual doctors must work in the same authorized hour. Unattended
 // remote patients must survive that hour's exact admitted wound loss.
 const localBleeders=patients('mendoza').filter(id=>record(id).bleeding>0);
 if(localBleeders.length){
  const selected=[];
  for(const op of doctors('mendoza',false)){
   if(selected.length===localBleeders.length)break;
   supplyDoctor('mendoza',op);if(!careAssignmentReason(c(),op,'doctor'))selected.push(op);
  }
  assert.equal(selected.length,localBleeders.length,'bleeding local patients require enough actual supplied hourly doctors');
  for(const id of serving.filter(id=>!localBleeders.includes(id)&&record(id).bleeding>0))assert.ok(record(id).hp>Math.ceil(record(id).bleeding*strategicBleedingPercent(c())/100),`untreated ${id} cannot safely wait for a care hour`);
  for(const id of serving.filter(id=>operativeLocation(c(),id)==='mendoza'&&['doctor','patient'].includes(record(id).assignment)))order({type:'assignCare',operativeId:id,assignment:'active'});
  for(const op of selected)order({type:'assignCare',operativeId:op.id,assignment:'doctor'});
  for(const id of localBleeders)order({type:'assignCare',operativeId:id,assignment:'patient'});
  const before=structuredClone(c()),hour=c().hour;order({type:'wait',hours:1},()=>{
  hourlyDressings=selected.reduce((n,op)=>n+before.operativeState[op.id].medkits-record(op.id).medkits,0);
  report({event:'stockMendozaCareHour',doctors:selected.map(op=>op.id),patients:localBleeders,dressings:hourlyDressings,
   woundLoss:serving.filter(id=>record(id).hp<before.operativeState[id].hp).map(id=>({id,before:before.operativeState[id].hp,after:record(id).hp}))});
  });
  assert.equal(c().hour,hour+1,'the finite medical hour must actually run');assert.equal(hourlyDressings,localBleeders.length);
  for(const id of localBleeders)assert.equal(record(id).bleeding,0,'actual hourly work stops local bleeding');
  for(const id of [...selected.map(op=>op.id),...localBleeders])order({type:'assignCare',operativeId:id,assignment:'active'});
  checkpoint('hourly-stabilization');
 }
 if(patients().length){
  const medic=prepareMedic('mendoza',patients('mendoza'));checkpoint('supplied');
  while(patients('mendoza').length){const group=patients('mendoza').slice(0,5);form('mendoza',[medic,...group]);for(const id of group)treat(medic,id);leaveCare();}
  checkpoint('local-stabilized');
  while(patients().length){
   const location=operativeLocation(c(),patients()[0]);assert.notEqual(location,'mendoza');
   // A recorded neighbor exit is safer than hours of strategic travel while
   // untreated remote bleeding remains. No unobserved source is searched.
   form(operativeLocation(c(),medic),[medic]);const exit=pair.battle.exits.find(e=>e.destination===location);
   assert.ok(exit,`remote patient sector ${location} needs an explicit nearby public care route`);
   const actor=unit(medic),spot=getReachable(pair.battle,actor).filter(cell=>sameSurface(cell,actor)&&boundaryMatches(pair.battle,cell,exit.edge)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
   assert.ok(spot,'the actual supplied doctor must reach a public departure edge');
   if(!boundaryMatches(pair.battle,actor,exit.edge))tactical({type:'move',unitId:actor.id,...spacePoint(spot)});
   const preview=exitPreview(pair.battle,{unitIds:[String(medic)],exitId:exit.id});assert.ok(preview.available,preview.reason);
   tactical({type:'exit',unitIds:[String(medic)],exitId:exit.id});leaveCare();assert.equal(operativeLocation(c(),medic),location);checkpoint('medic-arrival');
   while(patients(location).length){const group=patients(location).slice(0,5);form(location,[medic,...group]);for(const id of group)treat(medic,id);leaveCare();}
   checkpoint('remote-stabilized');
  }
 }
 for(const id of serving){assert.ok(record(id).hp>=15&&!record(id).bleeding,`actual survivor ${id} remains clinically unstable`);}
 // A caller can return the actual doctor and adjacent evacuated patients
 // after stabilization. The normal journey retains every wound and item.
 if(returnSector&&c().location!==returnSector){
  assert.equal(pair.battle,null);const squadId=c().activeSquadId,party=[...c().squad],before=structuredClone(c());
  order({type:'travel',sector:returnSector,queue:true,mode:'march'});
  for(let hour=0;hour<48&&c().squads.find(squad=>squad.id===squadId).journey;hour++){
   const journey=c().squads.find(squad=>squad.id===squadId).journey;assert.equal(journey.status,'moving','the real stabilized party must resolve a stopped journey before returning');order({type:'wait',hours:1});
  }
  assert.equal(c().location,returnSector);assert.equal(c().squads.find(squad=>squad.id===squadId).journey,undefined);
  for(const id of party){assert.equal(operativeLocation(c(),id),returnSector);for(const key of ['hp','bleeding','weaponInstanceId','condition','medkits','inventory'])assert.deepEqual(record(id)[key],before.operativeState[id][key],`actual care return preserves ${id} ${key}`);}
  report({event:'mendozaCarePartyReturned',sector:returnSector,party,elapsedSeconds:clock(c())-clock(before),cashDelta:c().resources.treasury-before.resources.treasury});checkpoint('care-party-returned');
 }
 assert.deepEqual(start,original,'finite care does not modify its original checkpoint');checkpoint('accepted');
 report({event:'stockMendozaCareAccepted',orders,hourlyDressings,tacticalDressings,clinicalPA,renewalCost,priorDeaths:dead,campaign:structuredClone(c())});return c();
 }catch(error){
  // Preserve the actual accepted state for diagnosis, including any new
  // encounter or clinical loss. A failure never substitutes a later trial.
  recordRouteCareFailure({boundary:latestTacticalBoundary,pair,counters:{orders,hourlyDressings,tacticalDressings,clinicalPA,renewalCost},lastInvocation:lastCareInvocation,error});
  report({event:'stockMendozaCareStopped',reason:error.message,orders,hourlyDressings,tacticalDressings,clinicalPA,renewalCost,campaign:structuredClone(c()),battle:structuredClone(pair.battle)});
  throw error;
 }
}

// This ledger compares the same physical owners before/after transfers. Living
// scene copies are historical receipts; their current operative record owns
// the carried rounds. Dead bodies, loose field stacks and depots remain owners.
function stockAmmunitionLedger(c){
 const total={},ids=new Set(living(c).map(String));
 for(const id of living(c))addAmmoCounts(total,unitAmmunitionByType(carried(c,id)));
 for(const scene of [...Object.values(c.sectorStates??{}),...Object.values(c.sceneStates??{})]){
  addAmmoCounts(total,fieldAmmunitionByType(scene));
  for(const unit of scene.units??[])if(!ids.has(unit.id))addAmmoCounts(total,unitAmmunitionByType(unit));
 }
 for(const depot of Object.values(c.ammunitionStores??{}))for(const [family,count]of Object.entries(depot))addAmmoCounts(total,{[AMMUNITION_FAMILIES[family].type]:count});
 return Object.fromEntries(Object.values(AMMUNITION_FAMILIES).map(f=>[f.type,total[f.type]??0]));
}

// The stock force keeps its serviceable selected loads. Real off-family loose
// rounds enter the depot before allocation; a healthy courier fetches only the
// measured remaining deficit from already known Tucuman bodies/containers.
export function prepareStockMendozaAmmunition(start,fieldIds,{report=()=>{}}={}){
 const p=stockPreparation(start,report),field=[...fieldIds],target=12;
 p.safe();assert.equal(p.campaign.location,'cordoba');assert.equal(new Set(field).size,field.length);
 for(const id of field){assert.ok(living(p.campaign).includes(id));assert.equal(operativeLocation(p.campaign,id),'cordoba');}
 const before=structuredClone(p.campaign),ledger=stockAmmunitionLedger(before),main=before.activeSquadId;
 for(const id of field)if(p.campaign.operativeState[id].weaponDropped){p.renew();p.replace(recoverRouteFirearm(p.campaign,id));report({event:'stockCuyoRecoveredGun',id,hour:p.campaign.hour});}
 const guns=new Map(field.map(id=>{const u=carried(p.campaign,id);assert.ok(!u.weaponDropped&&weaponSpecification(u)?.capacity>0&&u.condition>0,`actual serviceable firearm required for ${id}`);return [id,Object.fromEntries(['weapon','weaponMetadata','weaponInstanceId','weaponFittings','weaponFittingPattern','condition','ammunitionChoice'].filter(key=>u[key]!==undefined).map(key=>[key,structuredClone(u[key])]))];}));
 const nonAmmo=new Map(field.map(id=>[id,Object.fromEntries(Object.entries(p.campaign.operativeState[id].inventory??{}).filter(([,item])=>item.kind!=='ammunition'))]));
 const transfer=(id,family,quantity,direction)=>{
  while(quantity){
   p.renew();
   const n=Math.min(quantity,AMMUNITION_ORDER_LIMIT),u=carried(p.campaign,id),old=ammoCount(u,family),depot=p.campaign.ammunitionStores.cordoba?.[family]??0,cash=p.campaign.resources.treasury;
   const quote=ammunitionOrderQuote(p.campaign,rosterFor(p.campaign).find(op=>op.id===id),family,n,direction,true);assert.ok(quote.available,quote.reason);
   p.order({type:'ammunition',operativeId:id,family,quantity:n,direction});
   assert.equal(ammoCount(carried(p.campaign,id),family),old+(direction==='store'?-n:n));
   assert.equal(p.campaign.ammunitionStores.cordoba[family],depot+(direction==='store'?n:-n));assert.equal(p.campaign.resources.treasury,cash);
   report({event:'stockCuyoAmmoTransfer',id,family,quantity:n,direction,hour:p.campaign.hour,secondOfHour:p.campaign.secondOfHour??0});quantity-=n;
  }
 };
 for(const id of field){const u=carried(p.campaign,id),selected=ammoTypeFor(u);for(const [family,n]of Object.entries(ammoStock(u)))if(family!==selected)transfer(id,family,n,'store');}
 const model=(sector,id)=>sectorInventoryModel(p.campaign,sector,rosterFor(p.campaign),id);
 const rows=(sector,id,family)=>model(sector,id).entries.filter(row=>{const stack=JSON.parse(row.expected);return row.reachable&&stack.kind==='ammunition'&&stack.ammoType===AMMUNITION_FAMILIES[family].type&&row.count>0;});
 const local=field.find(id=>!model('cordoba',id).reason);assert.notEqual(local,undefined,'an actual local carrier must access the known Cordoba stock');
 const needed=Object.fromEntries(AMMO_KEYS.map(family=>[family,field.reduce((n,id)=>{const u=carried(p.campaign,id);return n+(ammoTypeFor(u)===family?Math.max(0,target-u.loaded-ammoCount(u,family)):0);},0)]));
 const deficit=Object.fromEntries(AMMO_KEYS.map(family=>[family,Math.max(0,needed[family]-(p.campaign.ammunitionStores.cordoba?.[family]??0)-rows('cordoba',local,family).reduce((n,row)=>n+row.count,0))]));
 report({event:'stockCuyoAmmoPlan',target,field,needed,deficit,selected:field.map(id=>({id,...guns.get(id),loaded:carried(p.campaign,id).loaded,stock:ammoStock(carried(p.campaign,id))})),campaign:structuredClone(p.campaign)});
 const pick=(sector,id,family,quantity)=>{
  while(quantity){
   p.renew();
   const m=model(sector,id),row=rows(sector,id,family)[0];assert.equal(m.operativeId,id);assert.ok(row,`actual reachable ${family} source exhausted at ${sector}`);
   let n=Math.min(quantity,row.count);const stack=JSON.parse(row.expected);while(n>0){try{applyItemQuantity(m.personal,{...stack,count:n});break;}catch{n--;}}
   assert.ok(n>0,`actual pocket capacity exhausted for courier ${id}`);
   const sourceTotal=m.entries.reduce((sum,item)=>{const value=JSON.parse(item.expected);return sum+(value.kind==='ammunition'&&value.ammoType===stack.ammoType?item.count:0);},0);
   const old=ammoCount(carried(p.campaign,id),family),cash=p.campaign.resources.treasury;
   p.order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:n});
   assert.equal(ammoCount(carried(p.campaign,id),family),old+n);assert.equal(p.campaign.resources.treasury,cash);
   // Removing a complete container stack shifts the remaining array indexes.
   // The expected-source action binds the original stack; compare the actual
   // family debit rather than treating the next stack at that index as it.
   const sourceAfter=model(sector,id).entries.reduce((sum,item)=>{const value=JSON.parse(item.expected);return sum+(value.kind==='ammunition'&&value.ammoType===stack.ammoType?item.count:0);},0);assert.equal(sourceAfter,sourceTotal-n);
   report({event:'stockCuyoAmmoPickup',sector,id,family,quantity:n,sourceKey:row.key,before:row.count,after:row.count-n,sourceFamilyBefore:sourceTotal,sourceFamilyAfter:sourceAfter,hour:p.campaign.hour,secondOfHour:p.campaign.secondOfHour??0});quantity-=n;
  }
 };
 if(Object.values(deficit).some(n=>n>0)){
  const courier=field.filter(id=>{const r=p.campaign.operativeState[id];return r.hp===r.maxHp&&!r.asleep&&!r.unconscious&&!r.routed&&r.energy>10;}).sort((a,b)=>Number(contractExpiresSeconds(p.campaign.contracts[a])!==null)-Number(contractExpiresSeconds(p.campaign.contracts[b])!==null)||p.campaign.operativeState[b].morale-p.campaign.operativeState[a].morale||p.campaign.operativeState[b].energy-p.campaign.operativeState[a].energy||a-b)[0];assert.notEqual(courier,undefined,'a real healthy serving courier is required');
  const courierBefore=structuredClone(p.campaign.operativeState[courier]);
  p.order({type:'createSquad',name:'Correo de cartuchos de Cuyo',ids:[courier],sector:'cordoba'});
  const travel=destination=>{
   for(let h=0;h<72;h++){
    const journey=p.campaign.squads.find(q=>q.id===p.campaign.activeSquadId).journey;
    if(!journey&&p.campaign.location===destination)return;
    assert.ok(!journey||journey.status==='moving','a real paused or hostile courier journey requires a new plan');
    if(!journey){
     const r=p.campaign.operativeState[courier];
     if(r.asleep||r.energy<75||r.fatigue>40){if(r.assignment!=='rest')p.order({type:'assignCare',operativeId:courier,assignment:'rest'});if(r.asleep&&r.energy>=100)p.order({type:'setSleep',operativeId:courier,asleep:false});else p.order({type:'wait',hours:1});continue;}
     p.order({type:'assignCare',operativeId:courier,assignment:'active'});p.renew();const cash=p.campaign.resources.treasury;
     p.order({type:'travel',sector:destination,mode:'posta',queue:true});report({event:'stockCuyoCourierTravel',id:courier,destination,cost:cash-p.campaign.resources.treasury,hour:p.campaign.hour,secondOfHour:p.campaign.secondOfHour??0});
    }else p.order({type:'wait',hours:1});
   }
   throw Error(`actual ammunition courier cannot reach ${destination} within 72 hourly steps`);
  };
  travel('tucuman');
  for(const [family,n]of Object.entries(deficit))if(n)pick('tucuman',courier,family,n);
  travel('cordoba');for(const [family,n]of Object.entries(deficit))if(n)transfer(courier,family,n,'store');
  for(const key of ['hp','bleeding','weaponInstanceId','condition','medkits','headwear','outfit','legwear'])assert.deepEqual(p.campaign.operativeState[courier][key],courierBefore[key],`real courier keeps ${key}`);
  p.order({type:'selectSquad',id:main});
 }
 for(let offset=0;offset<field.length;offset+=6){
  p.order({type:'createSquad',name:'Columna de Cuyo',ids:field.slice(offset,offset+6),sector:'cordoba'});
  for(const id of p.campaign.squad){
   if(p.campaign.operativeState[id].asleep)p.order({type:'setSleep',operativeId:id,asleep:false});p.order({type:'assignCare',operativeId:id,assignment:'active'});
   const family=ammoTypeFor(carried(p.campaign,id));let remaining=Math.max(0,target-carried(p.campaign,id).loaded-ammoCount(carried(p.campaign,id),family));
   const depot=Math.min(remaining,p.campaign.ammunitionStores.cordoba?.[family]??0);if(depot){transfer(id,family,depot,'take');remaining-=depot;}
   if(remaining)pick('cordoba',id,family,remaining);
   assert.ok(carried(p.campaign,id).loaded+ammoCount(carried(p.campaign,id),family)>=target,'each selected soldier receives twelve actual compatible rounds');
  }
  p.renew();p.replace(finishReloadsBeforeMarch(p.campaign,{report}));
 }
 for(const id of field){
  const u=carried(p.campaign,id);for(const [key,value]of Object.entries(guns.get(id)))assert.deepEqual(u[key],value,`native ${id} keeps ${key}`);
  assert.deepEqual(Object.fromEntries(Object.entries(p.campaign.operativeState[id].inventory??{}).filter(([,item])=>item.kind!=='ammunition')),nonAmmo.get(id),'allocation keeps every existing non-ammunition pocket item');
  assert.ok(u.loaded+ammoCount(u,ammoTypeFor(u))>=target);
 }
 assert.deepEqual(stockAmmunitionLedger(p.campaign),ledger,'all transferred firearm ammunition families remain conserved');
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(p.campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(p.campaign)).campaign,p.campaign);
 report({event:'stockCuyoAmmoPrepared',target,field,hour:p.campaign.hour,secondOfHour:p.campaign.secondOfHour??0,treasury:p.campaign.resources.treasury,ammunition:ledger,campaign:structuredClone(p.campaign)});
 return p.campaign;
}

// Continue from the actual pre-ammunition checkpoint without hiring or
// reissuing property. All formation, rest and attack hours use normal orders.
export function finishStockMendozaAssault(start,fieldIds,selections,{report=()=>{}}={}){
 const p=stockPreparation(prepareStockMendozaAmmunition(start,fieldIds,{report}),report),field=[...fieldIds];
 for(const operativeId of field)p.order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<72&&(p.campaign.hour%24!==6||field.some(id=>{const r=p.campaign.operativeState[id];return r.fatigue||r.energy<100||r.asleep;}));h++)p.order({type:'wait',hours:1});
 assert.equal(p.campaign.hour%24,6);for(const id of field){const r=p.campaign.operativeState[id];assert.equal(r.fatigue,0);assert.equal(r.energy,100);assert.equal(r.asleep,false);p.order({type:'assignCare',operativeId:id,assignment:'active'});}
 p.order({type:'configureArtillery',types:selections});const groups=[];
 for(let offset=0;offset<field.length;offset+=6){p.order({type:'createSquad',name:'Columna final de Cuyo',ids:field.slice(offset,offset+6),sector:'cordoba'});groups.push(p.campaign.activeSquadId);p.order({type:'attack',sector:'mendoza',queue:true,mode:'posta'});}
 for(let h=0;h<24&&!groups.every(id=>p.campaign.squads.find(q=>q.id===id).journey?.status==='ready');h++)p.order({type:'wait',hours:1});
 assert.ok(groups.every(id=>p.campaign.squads.find(q=>q.id===id).journey?.status==='ready'));
 for(let h=0;h<24&&(p.campaign.hour%24<6||p.campaign.hour%24>10);h++)p.order({type:'wait',hours:1});
 p.renew();const c=dispatchCampaign(p.campaign,{type:'beginAssault',sector:'mendoza'});assert.equal(c.lastError,null,c.lastError);assert.equal(c.pendingBattle.sector,'mendoza');
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),[...field].sort((a,b)=>a-b));
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'stockMendozaAssaultPrepared',field,selections,hour:c.hour,secondOfHour:c.secondOfHour??0,treasury:c.resources.treasury,campaign:structuredClone(c)});return c;
}

// Prefer the two existing reachable guns with the most remaining shots.
// Extra exhausted rear property must not displace a supplied distant gun.
function createdMendozaBatteryExclusions(c){
 const rows=[...Object.entries(c.artilleryDepots??{}).flatMap(([sector,guns])=>guns.map(gun=>({sector,gun}))),...Object.entries(c.sectorStates??{}).flatMap(([sector,scene])=>(scene.artillery??[]).map(gun=>({sector,gun})))];
 const available=rows.filter(({sector,gun})=>gun.side==='player'&&gun.type==='bronze4'&&c.sectors[sector]?.owner==='patriot'&&(sector==='cordoba'||artilleryTransportPath(c,sector,'cordoba','carts'))).sort((a,b)=>b.gun.ammo+Number(b.gun.loaded)-a.gun.ammo-Number(a.gun.loaded)||Number(b.sector==='cordoba')-Number(a.sector==='cordoba')||a.gun.id.localeCompare(b.gun.id)).slice(0,2);
 if(available.length<2)return [];
 const selected=new Set(available.map(row=>row.gun.id));
 return [...rows.map(row=>row.gun),...(c.artilleryTransfers??[]).map(transfer=>transfer.gun)].filter(gun=>gun.type==='bronze4'&&!selected.has(gun.id)).map(gun=>gun.id);
}

// Reuse the living hospital survivors and pay available reinforcements. All
// guns and cartridges come from finite recovered equipment and conquered arsenals.
export function prepareCreatedMendozaAssault(start,{report=()=>{},routeKind='created'}={}){
let c=decodeSave(encodeSave(start)).campaign;
const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
const stock=routeKind==='stock'?stockPreparation(c,report):null;
const order=a=>{
 if(stock){stock.replace(c);stock.order(a);c=stock.campaign;return;}
 if(c.pendingEncounter&&a.type!=='respondToEncounter'){
  assert.equal(c.pendingEncounter.sector,'cordoba');
  report({event:'createdMendozaRaid',campaign:c});
  c=dispatchCampaign(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});assert.equal(c.lastError,null,c.lastError);
  c=fightNorthernSector(c,'cordoba',{controller:cautiousCombatOrder,report}).campaign;
  c=recoverCreatedCuyoHospital(c,{report});
  for(let i=field.length-1;i>=0;i--)if(!c.operativeState[field[i]].alive||!c.recruited.includes(field[i]))field.splice(i,1);
 }
 if(a.type==='wait')for(const id of field){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(c.lastError,null);}}
 if(a.operativeId!=null&&!field.includes(a.operativeId)){assert.ok(!c.operativeState[a.operativeId].alive||!c.recruited.includes(a.operativeId),'only an actual casualty or ended contract can leave preparation');return;}
 c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
};
const recruits=rosterFor(c).filter(o=>{const r=c.operativeState[o.id],q=contractQuote(c,o,'day');return o.id>=100&&o.id<1000&&!field.includes(o.id)&&r.alive&&r.hp===r.maxHp&&r.morale>=50&&q.available&&q.price<=routeHiringCeiling(c,30);}).map(o=>o.id);
for(const id of recruits){order({type:'recruitCivic',id,term:'week',destination:'cordoba'});field.push(id);}
if(stock){stock.replace(c);stock.renew();c=stock.campaign;}
const battery=prepareRouteBattery(c,['bronze4','bronze4'],{destination:'cordoba',excludeIds:createdMendozaBatteryExclusions(c),report,...(stock?{keepServing:living(c)}:{})});c=battery.campaign;
// Elite service competes with the finite army budget. Prefer an affordable
// marksman when available; the existing paid force must otherwise fight with
// its recovered rifles and the two actual arsenal guns.
const specialist=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],q=contractQuote(c,op,'day');return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&!field.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&r.morale>=50&&op.marksmanship>=65&&q.available&&q.price<=Math.max(0,c.resources.treasury-2000);}).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price)[0];
if(specialist){const quote=contractQuote(c,specialist,'day'),cash=c.resources.treasury;order({type:'recruitCivic',id:specialist.id,term:'day',destination:'cordoba'});assert.equal(cash-c.resources.treasury,quote.price);field.push(specialist.id);}
report({event:'createdMendozaSupport',ids:specialist?[specialist.id]:[],hour:c.hour,treasury:c.resources.treasury});
for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
order({type:'configureArtillery',types:[]});
report({event:'createdMendozaAmmunition',field:[...field],selections:[...battery.selections],campaign:structuredClone(c)});
if(stock)return finishStockMendozaAssault(c,field,battery.selections,{report});
// Keep the serving force's serviceable guns and share actual off-family
// rounds before a real controlled-source courier covers the measured deficit.
// The common finite allocator still requires twelve compatible rounds each.
c=prepareStockMendozaAmmunition(c,field,{report});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue||c.operativeState[id].energy<100||c.operativeState[id].asleep));h++)order({type:'wait',hours:1});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'configureArtillery',types:battery.selections});

return prepareFinalAssault(c,{staging:'cordoba',target:'mendoza',fieldIds:field,daylight:true});
}
