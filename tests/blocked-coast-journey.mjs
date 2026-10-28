import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {carriedAmmunition} from '../packages/game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../packages/game/ammo-types.js';
import {WEAPONS} from '../packages/game/data.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {occupyingGroups} from '../packages/game/enemy-groups.js';
import {enterSector} from '../packages/game/world.js';
import {autoBandageBattle} from '../packages/game/auto-bandage.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {blockedCoastDressingPlan,distributeBlockedCoastDressings} from './blocked-coast-medical-reserve.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {withdrawCommandToRear,rejoinCommandAfterExit} from './command-reserve-driver.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;
const ready=(c,id,at)=>{
 const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);
 return c.recruited.includes(id)&&r?.alive&&!r.captured&&!r.surrendered&&!r.captive&&(!r.detention||r.detention.freed)&&!operativeInTransit(c,id)&&operativeLocation(c,id)===at&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10&&(expiry===null||expiry>clock(c));
};

// A friendly city flag does not remove its real stationed naval occupation.
// Reuse serving veterans and their finite property before the port meeting.
export function resolveBlockedCoastJourney(start,{report=()=>{}}={}){
 const before=structuredClone(start),inputCapture=recordRouteStrategicEvidence({helper:'resolveBlockedCoastJourney',stage:'preparation-input',campaign:start});
 let c=saved(start);const events=[],orders=[],renewals=[];
 try{
 assert.equal(c.location,'cordoba');assert.ok(occupyingGroups(c,'buenos_aires').length);assert.equal(c.blockade,true);
 const route=c.squads.find(q=>q.id===c.activeSquadId)?.journey;assert.equal(route?.status,'paused');assert.equal(route.reason,'blocked');assert.equal(route.path.at(-1),'buenos_aires');
 const emit=event=>{const{campaign,battle,...receipt}=event;events.push(receipt);report(event);};
 const simple=action=>{const cash=c.resources.treasury,at=clock(c);c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);orders.push(structuredClone(action));emit({event:'blockedCoastOrder',action,from:at,to:clock(c),treasuryBefore:cash,treasuryAfter:c.resources.treasury});};
 simple({type:'cancelTravel',choice:'stop'});const base=[...c.squad];
 for(const op of rosterFor(c).filter(op=>!base.includes(op.id)&&ready(c,op.id,'cordoba')&&c.contracts[op.id]?.expiresAt===null).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id))if(base.length<6)base.push(op.id);
 assert.ok(base.includes(57)&&base.length<=6&&base.every(id=>ready(c,id,'cordoba')));
 const candidates=rosterFor(c).filter(op=>!base.includes(op.id)&&c.contracts[op.id]?.kind==='paid'&&ready(c,op.id,'mendoza'));
 const physician=[...candidates].filter(op=>op.medical>=60).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(physician,'The actual recalled column needs a ready serving physician.');
 const count=12-base.length,paid=[...candidates.filter(op=>op.id!==physician.id).sort((a,b)=>b.marksmanship-a.marksmanship||b.id-a.id).slice(0,count-1).map(op=>op.id),physician.id];
 assert.equal(paid.length,count,'The blockade response needs twelve actual serving people, not invented reinforcements.');const field=[...base,...paid],keep=new Set(field);
 const retain=hours=>{for(const id of keep){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=clock(c)+hours*3600+1){const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);simple({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);renewals.push({id,quote});const extended=contractExpiresSeconds(c.contracts[id]);assert.ok(extended>expiry);expiry=extended;}}};
 const order=action=>{if(action.type==='wait')retain(action.hours);if(action.type==='travel')retain(24);simple(action);};
 retain(24);order({type:'squad',ids:base});
 // Use real pocket rifles first. Unsupplied actors then choose a real held
 // sidearm or a known local rifle that matches existing finite ammunition.
 const pocketRifles=new Set();
 for(const id of base.filter(id=>id!==57)){
  const model=sectorInventoryModel(c,'cordoba',rosterFor(c),id),rifle=model.carried.find(row=>row.inventoryKey&&JSON.parse(row.expected).weapon===1802&&row.equip?.some(option=>option.slot==='primary'&&option.valid));
  if(rifle){c=recoverRoutePrimary(c,id,{preferredWeapon:1802,replace:true,report:emit});pocketRifles.add(id);}
 }
 for(const id of base.filter(id=>id!==57&&!pocketRifles.has(id)).sort((a,b)=>rosterFor(c).find(op=>op.id===b).marksmanship-rosterFor(c).find(op=>op.id===a).marksmanship)){
  const op=rosterFor(c).find(op=>op.id===id),held=carriedAmmunition(op,c.operativeState[id]),family=ammoTypeFor(held);if(held.loaded+ammoCount(held,family)>=10)continue;
  const model=sectorInventoryModel(c,'cordoba',rosterFor(c),id),own=model.carried.filter(row=>row.inventoryKey&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0&&row.equip?.some(option=>option.slot==='primary'&&option.valid));
  const candidate=own.sort((a,b)=>WEAPONS[JSON.parse(b.expected).weapon].range-WEAPONS[JSON.parse(a.expected).weapon].range)[0];
  c=recoverRoutePrimary(c,id,{preferredWeapon:candidate?JSON.parse(candidate.expected).weapon:1802,replace:true,report:emit});
 }
 c=supplyRouteAmmunition(c,base.filter(id=>id!==57),{target:10,report:emit}).campaign;
 const localDoctor=base.filter(id=>id!==57).sort((a,b)=>rosterFor(c).find(op=>op.id===b).medical-rosterFor(c).find(op=>op.id===a).medical)[0],medical=blockedCoastDressingPlan(c,{localDoctorId:localDoctor,physicianId:physician.id});emit({event:'blockedCoastMedicalPlan',...medical});
 const battery=prepareRouteBattery(c,['bronze4','bronze4'],{destination:'cordoba',keepServing:paid,report:emit});c=battery.campaign;
 retain(48);const supports=[];
 // Move the actual physician's group through the conquered pass to recover
 // reachable finite linen. Partial collection keeps its exact observed count.
 const parties=paid.length<=6?[...paid]:[physician.id,...paid.filter(id=>id!==physician.id)];
 for(let offset=0;offset<parties.length;offset+=6){const ids=parties.slice(offset,offset+6);order({type:'createSquad',ids,sector:'mendoza',name:'Veteranos del bloqueo'});supports.push(c.activeSquadId);for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
  if(ids.includes(physician.id)){order({type:'travel',sector:'los_patos',mode:'posta'});assert.equal(c.location,'los_patos');const linen=collectRouteItems(c,physician.id,{item:'medkits'},medical.requested);c=linen.campaign;emit({event:'blockedCoastFiniteLinen',operativeId:physician.id,count:linen.collected,requested:medical.requested});}
  order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.location,'cordoba');
 }
 const distributed=distributeBlockedCoastDressings(c,medical,{report:emit});c=distributed.campaign;orders.push(...distributed.receipt.orders.map(row=>row.action));
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&(c.hour%24<6||c.hour%24>10||field.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue||r.asleep;}));h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of [c.squads.find(q=>q.members.includes(57)).id,...supports]){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c);}
 order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(57)).id});order({type:'configureArtillery',types:battery.selections});retain(48);
 c=prepareFinalAssault(c,{staging:'cordoba',target:'buenos_aires',fieldIds:field,daylight:true});
 const initial=enterSector(c.pendingBattle,c.sectorStates.buenos_aires),result=fightNorthernSector(c,'buenos_aires',{report:emit,deploy:withdrawCommandToRear(initial,57,'cordoba'),controller:coastalBatteryController(initial,{sharedArtillerySight:true}),beforeSettlement:(pair,{execute})=>{
  const aid=autoBandageBattle(pair.battle);for(const action of aid.steps)pair=execute(pair,action);
  const physical=({savedHour,savedSecond,syncedSeconds,...state})=>state;assert.deepEqual(physical(pair.battle),physical(aid.battle));
  // A real failed aid approach can lose a critical survivor. Preserve it and
  // report the loss; never turn that death into a successful treatment receipt.
  for(const actor of pair.battle.units.filter(u=>field.includes(Number(u.id))&&u.hp>0&&!u.departure&&!u.surrendered)){
   assert.ok(actor.hp>=15,'Actual field survivors need finite critical aid.');assert.equal(actor.bleeding,0,'Actual field survivors need finite bandaging.');
  }
  emit({event:'blockedCoastFieldAid',steps:aid.steps,treatedIds:aid.treatedIds,stoppedReason:aid.stoppedReason,losses:field.filter(id=>pair.battle.units.find(u=>u.id===String(id))?.hp===0)});return pair;
 }});c=result.campaign;
 assert.equal(c.blockade,false);assert.equal(occupyingGroups(c,'buenos_aires').length,0);c=rejoinCommandAfterExit(c,57,'buenos_aires');
 const losses=Object.keys(before.operativeState).filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive).map(Number);
 for(const[id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(start,before);c=saved(c);const receipt={field,paid,physician:physician.id,orders,renewals,events,summary:result.summary,losses,startSeconds:clock(start),endSeconds:clock(c),treasuryBefore:start.resources.treasury,treasuryAfter:c.resources.treasury};
 recordRouteStrategicEvidence({helper:'resolveBlockedCoastJourney',stage:'route-checkpoint',campaign:c,inputCapture,context:{summary:result.summary,losses}});
 emit({event:'blockedCoastJourneyResolved',summary:result.summary,losses,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:c});return {campaign:c,receipt};
 }catch(error){if(error.campaign)c=error.campaign;recordRouteStrategicEvidence({helper:'resolveBlockedCoastJourney',stage:'preparation-failure',campaign:c,inputCapture,error,context:{events,medicalReserve:error.blockedCoastMedicalReserve??null}});throw error;}
}
