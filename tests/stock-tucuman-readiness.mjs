import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus,contractQuote,contractRenewalQuote} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {enterSector} from '../game/world.js';
import {actBattle,reloadCost} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {captureRouteStrategicInput,recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const compatible=(s,op)=>civicStatus(s,op.id).available&&contractQuote(s,op,'week').available&&contractQuote(s,op,'week').total<=1400;

// Prepare the first stock assault prospectively. The five existing survivors
// remain in real rear service. Public hires, local finite property and paid
// clock orders create the two columns; failure remains an actual route failure.
export function prepareStockTucumanReadiness(start,{report=()=>{},onCheckpoint}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareStockTucumanReadiness',stage:'preparation-input',campaign:start});
 let c=start,b=null,diagnosticContext=null;
 try{
 const original=structuredClone(start),dead=Object.keys(start.operativeState).filter(id=>!start.operativeState[id].alive);
 c=decodeSave(encodeSave(start)).campaign;
 const rear=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),paid=[],orders=[],events=[];
 if(inputCapture)diagnosticContext={rear,paid,orders,events};
 const event=e=>{events.push(e);report(e);};
 const validate=()=>{
  assert.deepEqual(start,original,'Readiness must not mutate its earned input.');
  for(const id of dead)assert.equal(c.operativeState[id].alive,false,'Earlier casualties remain permanent.');
  for(const id of rear)assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured,'Existing rear survivors must retain actual service.');
  assert.equal(c.pendingEncounter,null,'Resolve the actual encounter before continuing stock readiness.');
 };
 const order=action=>{
  const before=c,quote=action.type==='recruitCivic'?contractQuote(c,rosterFor(c).find(op=>op.id===action.id),action.term):action.type==='renewContract'?contractRenewalQuote(c,rosterFor(c).find(op=>op.id===action.id),action.term):null;
  const diagnosticBefore=captureRouteStrategicInput(c);
  c=dispatchCampaign(c,action);
  if(c.lastError)recordRouteStrategicEvidence({helper:'prepareStockTucumanReadiness',stage:'campaign-action-refusal',campaign:diagnosticBefore??before,action,returnedCampaign:c,inputCapture,error:c.lastError,preDispatchInputIndependentlyCloned:diagnosticBefore!==null});
  assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);
  orders.push({kind:'campaign',action:structuredClone(action),quote:quote&&structuredClone(quote),from:clock(before),to:clock(c),treasuryBefore:before.resources.treasury,treasuryAfter:c.resources.treasury});
  if(quote){assert.ok(quote.available,quote.reason);assert.equal(c.resources.treasury,before.resources.treasury-(action.type==='recruitCivic'?quote.total:quote.price));}
  validate();
 };
 const checkpoint=stage=>{validate();const scene=b??(c.pendingBattle?enterSector(c.pendingBattle,c.sectorStates[c.pendingBattle.sector]):null);const pair=decodeSave(encodeSave(c,scene));assert.deepEqual(pair.campaign,c);if(scene)assert.deepEqual(pair.battle,scene);onCheckpoint?.(stage,structuredClone(c),scene&&structuredClone(scene));};
 const wait=()=>{
  for(const id of [...rear,...paid]){
   if(!c.recruited.includes(id))continue;
   const expires=contractExpiresSeconds(c.contracts[id]);assert.ok(expires===null||expires>clock(c),'An expired rear or field contract cannot be restored.');
   if(expires!==null&&expires<=clock(c)+3601)order({type:'renewContract',id,term:'week',expectedExpiresAt:c.contracts[id].expiresAt,expectedExpiresSecond:c.contracts[id].expiresSecond??0});
  }
  order({type:'wait',hours:1});
 };
 const inventory=id=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const take=(id,row,count)=>{
  const source=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  event({event:'stockReadinessFiniteTake',id,sourceKey:row.key,count,source,hour:c.hour,secondOfHour:c.secondOfHour??0});
 };
 const equipTaken=(id,source)=>{
  const weapon=inventory(id).carried.find(item=>item.inventoryKey&&item.expected&&Object.entries(source).filter(([key])=>key!=='item').every(([key,value])=>JSON.stringify(JSON.parse(item.expected)[key])===JSON.stringify(value)));
  assert.ok(weapon,'The actual recovered weapon must remain packed before equipping.');
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:weapon.inventoryKey,expected:weapon.expected,slot:'primary'});
 };
 const dropPrimary=id=>{
  const model=inventory(id),held=model.carried.find(item=>item.item==='primary');assert.ok(held?.store?.expected);
  const source=JSON.parse(held.store.expected),known=new Set(model.entries.map(row=>row.key));
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'drop',item:'primary',count:1});
  const row=inventory(id).entries.find(row=>!known.has(row.key)&&row.reachable&&row.expected===JSON.stringify(source));
  assert.ok(row,'The dropped service weapon must remain a reachable finite item.');return row;
 };
 const exchangeRearRifle=id=>{
  const outgoing=dropPrimary(id),pistol=JSON.parse(outgoing.expected);
  const donor=rear.map(id=>({id,model:inventory(id)})).filter(row=>row.model.personal?.weapon===1800&&!row.model.personal.weaponDropped&&row.model.personal.condition>=10)
   .sort((a,b)=>b.model.personal.condition-a.model.personal.condition||a.model.personal.marksmanship-b.model.personal.marksmanship||a.id-b.id)[0];
  assert.ok(donor,'The resting rear must hold an actual service rifle for the field exchange.');
  const rifle=dropPrimary(donor.id),held=inventory(donor.id).entries.find(row=>row.key===outgoing.key);assert.ok(held?.reachable);
  take(donor.id,held,1);equipTaken(donor.id,pistol);
  event({event:'stockReadinessRearWeaponExchange',rearId:donor.id,fieldId:id,rifle:JSON.parse(rifle.expected),rearWeapon:pistol});
  return inventory(id).entries.find(row=>row.key===rifle.key&&row.reachable);
 };
 const tactical=action=>{
  b=actBattle(b,action);assert.equal(b.lastError,null,JSON.stringify(action)+': '+b.lastError);
  const pair=syncBattleTime(c,b);assert.equal(pair.error,null,pair.error);c=pair.campaign;b=pair.battle;
  orders.push({kind:'tactical',action:structuredClone(action)});validate();
 };
 const reload=()=>{
  const ids=c.squad.filter(id=>c.operativeState[id].jammed||c.operativeState[id].carriedLoaded===0);
  if(!ids.length)return;
  order({type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.cordoba);orders.push({kind:'enterSector'});
  for(const id of ids){
   let u=b.units.find(unit=>unit.id===String(id));if(u.activeSlot!=='primary')tactical({type:'weapon',unitId:u.id,slot:'primary'});
   u=b.units.find(unit=>unit.id===String(id));if(u.jammed)tactical({type:'reprime',unitId:u.id});
   u=b.units.find(unit=>unit.id===String(id));if(reloadCost(u,b))tactical({type:'reload',unitId:u.id});
   u=b.units.find(unit=>unit.id===String(id));assert.ok(u.loaded>0&&!u.jammed,'The actual selected long gun must finish loading.');
  }
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});b=null;
 };
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.location,'cordoba');assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.sectors.tucuman.owner,'royalist');
 assert.ok(rear.length,'The actual existing rear party must remain available.');
 for(const id of rear){const r=c.operativeState[id];assert.equal(r.location,'cordoba');assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);order({type:'assignCare',operativeId:id,assignment:'rest'});}
 const candidates=rosterFor(c).filter(op=>compatible(c,op)),physician=candidates.filter(op=>op.medical>=70).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 if(diagnosticContext)diagnosticContext.physician=physician?.id??null;
 assert.ok(physician,'A real publicly available physician with at least70medical is required.');
 const sorted=[physician,...candidates.filter(op=>op.id!==physician.id).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id)];
 for(const op of sorted){
  if(paid.length===12)break;
  if(!compatible(c,op)){event({event:'stockReadinessNativeRefusal',id:op.id,reason:civicStatus(c,op.id).reason??contractQuote(c,op,'week').reason});continue;}
  order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});paid.push(op.id);
  event({event:'stockReadinessPaidArrivalBooked',id:op.id,medical:op.medical,marksmanship:op.marksmanship,arrival:structuredClone(c.hiringArrivals.find(arrival=>arrival.operativeId===op.id))});
 }
 assert.equal(paid.length,12,'The actual compatible public quote pool must supply the twelve-person force.');checkpoint('stock-readiness-booked');
 for(let h=0;h<24&&paid.some(id=>!c.recruited.includes(id));h++)wait();
 for(const id of paid){assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive);assert.equal(c.operativeState[id].location,'cordoba');}
 const ranked=rosterFor(c).filter(op=>paid.includes(op.id)).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id),columns=[ranked.slice(0,6).map(op=>op.id),ranked.slice(6).map(op=>op.id)],groups=[];
 for(const ids of columns){order({type:'createSquad',ids,sector:'cordoba',name:'Relevo pagado del Norte'});groups.push(c.activeSquadId);for(const id of ids)order({type:'assignCare',operativeId:id,assignment:'active'});}checkpoint('stock-readiness-arrived');
 for(const id of paid){
  const row=inventory(id).entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).weapon===1800&&JSON.parse(row.expected).condition>=10)??exchangeRearRifle(id);
  assert.ok(row,'A real known reachable Córdoba long gun must equip '+id);take(id,row,1);
  const packed=inventory(id).carried.find(item=>item.expected&&JSON.parse(item.expected).weapon===1800);assert.ok(packed);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:packed.inventoryKey,expected:packed.expected,slot:'primary'});
 }
 for(const id of paid){
  const load=()=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
  const previous=ammoTypeFor({...load(),activeSlot:'primary'});
  if(previous!=='ammoMusket'){
   const before=ammoCount(load(),previous)+load().loaded;
   if(load().loaded)order({type:'unloadAmmunition',operativeId:id});
   order({type:'selectAmmunitionLoad',operativeId:id,family:'ammoMusket'});
   assert.equal(ammoCount(load(),previous),before,'Changing the recovered load preserves every actual old cartridge.');
   event({event:'stockReadinessLoadChanged',id,from:previous,to:'ammoMusket',retainedCartridges:before});
  }
  const family=ammoTypeFor({...load(),activeSlot:'primary'});assert.equal(family,'ammoMusket');
  while(load().loaded+ammoCount(load(),family)<12){
   const missing=12-load().loaded-ammoCount(load(),family),row=inventory(id).entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).kind==='ammunition'&&JSON.parse(row.expected).ammoType===AMMUNITION_FAMILIES[family].type);
   assert.ok(row,'Actual reachable matching finite cartridges are required for '+id);take(id,row,Math.min(missing,row.count));
  }
 }
 const backup=ranked.filter(op=>op.id!==physician.id&&op.medical>=70).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(backup);
 if(diagnosticContext)diagnosticContext.backupPhysician=backup.id;
 for(const [id,target]of [[physician.id,12],[backup.id,8]])while(c.operativeState[id].medkits<target){const row=inventory(id).entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'Actual finite local physician dressings are required.');take(id,row,Math.min(target-c.operativeState[id].medkits,row.count));}
 order({type:'selectSquad',id:groups[0]});
 const gun=c.sectorStates.cordoba.artillery.filter(gun=>gun.side==='player'&&gun.type==='bronze4'&&(gun.loaded||gun.ammo>0)).sort((a,b)=>a.id.localeCompare(b.id))[0];assert.ok(gun,'A real owned supplied Córdoba bronze cannon is required.');assert.equal(artilleryProfile(c,gun).crew,2);
 const record=storedArtilleryRecord(gun);order({type:'storeArtillery',sector:'cordoba',artilleryId:gun.id});assert.deepEqual(c.artilleryDepots.cordoba.find(piece=>piece.id===gun.id),record);assert.ok(!c.sectorStates.cordoba.artillery.some(piece=>piece.id===gun.id));order({type:'configureArtillery',types:['depot:'+gun.id]});
 for(const id of groups){order({type:'selectSquad',id});reload();}
 for(const id of paid)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<48&&paid.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep);h++){
  for(const id of paid)if(c.operativeState[id].asleep&&c.operativeState[id].energy>=100)order({type:'setSleep',operativeId:id,asleep:false});
  if(paid.every(id=>c.operativeState[id].energy>=100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep))break;wait();
 }
 for(const id of paid){const r=c.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=30,'The public low-morale warning must be resolved before deployment.');order({type:'assignCare',operativeId:id,assignment:'active'});}checkpoint('stock-readiness-local-ready');
 for(const id of groups){order({type:'selectSquad',id});order({type:'attack',sector:'tucuman',queue:true,mode:c.routes.posta?'posta':'march'});}
 for(let h=0;h<48&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)wait();
 assert.ok(groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'),'Both actual approach journeys must finish.');
 for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++)wait();assert.ok(c.hour%24>=8&&c.hour%24<=16);
 order({type:'beginAssault',sector:'tucuman'});assert.equal(c.pendingBattle.squad.length,12);assert.deepEqual(new Set(c.pendingBattle.squad.map(op=>op.id)),new Set(paid));
 const deployed=c.pendingBattle.artillery.filter(gun=>gun.side==='player');assert.equal(deployed.length,1);for(const key of ['id','type','side','loaded','ammo'])assert.deepEqual(deployed[0][key],record[key]);
 for(const id of rear){assert.equal(c.operativeState[id].location,'cordoba');assert.equal(c.operativeState[id].assignment,'rest');assert.ok(!c.pendingBattle.squad.some(op=>op.id===id));}
 checkpoint('stock-readiness-assault');
 const receipt={rear,paid,physician:physician.id,backupPhysician:backup.id,columns,gun:record,orders,events,startingClock:clock(start),readyClock:clock(c),startingTreasury:start.resources.treasury,readyTreasury:c.resources.treasury,paidHireCost:orders.filter(row=>row.action?.type==='recruitCivic').reduce((sum,row)=>sum+row.quote.total,0),renewalCost:orders.filter(row=>row.action?.type==='renewContract').reduce((sum,row)=>sum+row.quote.price,0)};
 return {campaign:c,receipt};
 }catch(error){
  recordRouteStrategicEvidence({helper:'prepareStockTucumanReadiness',stage:'preparation-failure',campaign:c,inputCapture,context:diagnosticContext,error});throw error;
 }
}
