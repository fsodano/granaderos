import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,CIVIC_RECRUITS} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {collectRouteItems,discoverRouteCache} from './finite-route-equipment.mjs';
import {prepareRescueClinicGuards,restRescuePatients} from './rescue-clinic-readiness.mjs';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {previewStrategicRoute} from '../game/strategic-route.js';

export function recoverRescueForce(start,{patients,report=()=>{},onCheckpoint=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[],orders=[],rearPhysicians=[],courierLegs=[],startHour=campaign.hour;
 assert.ok(patients?.length,'recover the actual released prisoners');
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});orders.push({scope:'campaign',action});};
 const seconds=()=>campaign.hour*3600+(campaign.secondOfHour??0);
 const renew=(buffer,ids=campaign.recruited)=>{for(const id of [...ids]){const r=campaign.operativeState[id];let contract=campaign.contracts[id];while(r.alive&&!r.captured&&contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=seconds()+buffer*3600){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.ok(campaign.resources.treasury<cash);contract=campaign.contracts[id];}}};
 const routeTo=destination=>{const quote=previewStrategicRoute(campaign,campaign.activeSquadId,destination,'march');assert.equal(quote.valid,true,quote.reason);return quote;};
 // A routed surgeon remains at the actual rear province. Recover that serving
 // physician before paying for another hire or advancing a long courier march.
 const qualifiedHere=()=>rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&!patients.includes(op.id)&&r.location==='tucuman'&&r.hp>=15&&op.medical>=70;});
 const rear=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&!patients.includes(op.id)&&r.location==='cordoba'&&r.hp>=15&&!r.asleep&&r.energy>10&&op.medical>=70;}).sort((a,b)=>b.medical-a.medical||a.id-b.id);
 for(const physician of rear){
  if(qualifiedHere().length>=2)break;
  const operativeId=physician.id,previous=campaign.activeSquadId,firstOrder=orders.length,departureSeconds=campaign.hour*3600+(campaign.secondOfHour??0),sourceSector=campaign.operativeState[operativeId].location;
  assert.equal(campaign.sectors[sourceSector].owner,'patriot');assert.equal(campaign.pendingEncounter,null);
  order({type:'createSquad',ids:[operativeId],name:'Enlace sanitario',sector:sourceSector});order({type:'assignCare',operativeId,assignment:'active'});
  let sourceTake=null,aidSteps=[],aidElapsedSeconds=0;
  if(campaign.operativeState[operativeId].bleeding){
   if(!campaign.operativeState[operativeId].medkits){
    const model=sectorInventoryModel(campaign,sourceSector,rosterFor(campaign),operativeId),row=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'the serving rear physician needs one real reachable dressing');
    const carried=campaign.operativeState[operativeId].medkits,pool=model.entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0),cash=campaign.resources.treasury,seconds=campaign.hour*3600+(campaign.secondOfHour??0);
    order({type:'sectorInventory',sector:sourceSector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    const after=sectorInventoryModel(campaign,sourceSector,rosterFor(campaign),operativeId),poolAfter=after.entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
    assert.equal(poolAfter,pool-1);assert.equal(campaign.operativeState[operativeId].medkits,carried+1);assert.equal(campaign.resources.treasury,cash);assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),seconds);
    sourceTake={action:orders.at(-1).action,medicalPoolBefore:pool,medicalPoolAfter:poolAfter,carriedBefore:carried,carriedAfter:carried+1};
   }
   order({type:'visitSector'});let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0},campaign.sectorStates[sourceSector]);
   const aid=autoBandageBattle(battle);assert.ok(aid.steps.length,'the actual rear physician must perform ordinary self aid');
   for(let i=0;i<aid.steps.length;i++){
    battle=actBattle(battle,aid.steps[i]);assert.equal(battle.lastError,null);const paid=syncBattleTime(campaign,battle);assert.equal(paid.error,null);campaign=paid.campaign;battle=paid.battle;orders.push({scope:'tactical',action:aid.steps[i]});aidSteps.push(aid.steps[i]);
    if(i===Math.floor((aid.steps.length-1)/2))({campaign,battle}=decodeSave(encodeSave(campaign,battle)));
    const unit=battle.units.find(unit=>unit.id===String(operativeId));if(unit.hp>=15&&!unit.bleeding)break;
   }
   const unit=battle.units.find(unit=>unit.id===String(operativeId));assert.ok(unit.hp>=15);assert.equal(unit.bleeding,0);aidElapsedSeconds=battle.elapsedSeconds??0;
   order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
  }
  const marchQuote=routeTo('tucuman');renew(marchQuote.hours+1,[operativeId]);const marchStartSeconds=seconds();order(marchQuote.action);
  for(let requests=0;requests<48&&(campaign.location!=='tucuman'||campaign.squads.find(q=>q.id===campaign.activeSquadId).journey);requests++){assert.equal(campaign.pendingEncounter,null,'physician travel cannot bypass an actual encounter');order({type:'wait',hours:1});}
  assert.equal(campaign.location,'tucuman');assert.ok(!campaign.squads.find(q=>q.id===campaign.activeSquadId).journey);assert.equal(seconds()-marchStartSeconds,marchQuote.hours*3600);assert.ok(campaign.recruited.includes(operativeId));assert.equal(campaign.operativeState[operativeId].location,'tucuman');assert.equal(campaign.operativeState[operativeId].bleeding,0);
  order({type:'selectSquad',id:previous});
  const receipt={id:operativeId,sourceSector,arrivalSector:'tucuman',sourceTake,aidSteps,aidElapsedSeconds,marchQuote, marchElapsedSeconds:seconds()-marchStartSeconds,elapsedSeconds:seconds()-departureSeconds,orders:orders.slice(firstOrder)};rearPhysicians.push(receipt);report({event:'rearPhysicianArrived',...receipt});onCheckpoint('rear-physician-arrived',campaign,receipt);
 }
 const courierStartHour=campaign.hour;
 // A rescue may cost the force its surgeons. Replace them through ordinary
 // paid contracts before asking lightly trained survivors to treat every wound.
 const eligible=op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&!patients.includes(op.id);};
 const qualified=rosterFor(campaign).filter(op=>eligible(op)&&op.medical>=70),hiredDoctors=[],hiringCash=campaign.resources.treasury;
 const candidates=CIVIC_RECRUITS.filter(op=>op.medical>=70&&!campaign.recruited.includes(op.id)&&contractQuote(campaign,op,'week').available&&contractQuote(campaign,op,'week').price<=campaign.resources.treasury).sort((a,b)=>contractQuote(campaign,a,'week').price-contractQuote(campaign,b,'week').price||b.medical-a.medical||a.id-b.id);
 for(const doctor of candidates){if(qualified.length+hiredDoctors.length>=2)break;order({type:'recruitCivic',id:doctor.id,term:'week'});hiredDoctors.push(doctor.id);}
 assert.ok(qualified.length+hiredDoctors.length>=2,'two living qualified physicians are available on paid contracts');
 const hiringCost=hiringCash-campaign.resources.treasury;assert.equal(hiringCost,hiredDoctors.reduce((sum,id)=>sum+campaign.contracts[id].paid,0));
 const dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive),roster=rosterFor(campaign);
 const local=roster.filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&!patients.includes(op.id);});
 const doctors=local.filter(op=>op.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,2).map(op=>op.id);assert.equal(doctors.length,2,'two actual doctors provide recovery');
 const courier=local.filter(op=>!doctors.includes(op.id)&&campaign.operativeState[op.id].energy>10).sort((a,b)=>a.medical-b.medical)[0]?.id;assert.ok(courier,'a living local reserve carries the supplies');
 const [firstDoctor,secondDoctor]=doctors,firstPatient=patients[0];
 const courierTravel=destination=>{const quote=routeTo(destination);renew(quote.hours+1);const departureSeconds=seconds();onCheckpoint('courier-departure-'+destination,campaign,{quote,doctors,courier});order({...quote.action,queue:false});assert.equal(campaign.location,destination);assert.equal(campaign.pendingEncounter,null);assert.equal(seconds()-departureSeconds,quote.hours*3600);assert.ok([courier,...doctors].every(id=>campaign.recruited.includes(id)),'the courier and both physicians retain actual paid service through the quoted march');courierLegs.push({destination,quote,departureSeconds,arrivalSeconds:seconds()});};
 const restCourier=()=>{if(!campaign.operativeState[courier].asleep&&campaign.operativeState[courier].energy>10)return;order({type:'assignCare',operativeId:courier,assignment:'rest'});for(let requests=0;requests<48&&(campaign.operativeState[courier].asleep||campaign.operativeState[courier].energy<=10);requests++){assert.equal(campaign.pendingEncounter,null,'courier rest cannot bypass an actual encounter');renew(2);order({type:'wait',hours:1});}assert.equal(campaign.operativeState[courier].asleep,false);assert.ok(campaign.operativeState[courier].energy>10);order({type:'assignCare',operativeId:courier,assignment:'active'});};
 const model=id=>sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),id);
 let recovered=0,donated=0,guardPreparation=null,restRecovery=null;
 const gather=(id,limit=1000000)=>{
  let taken=0;
  while(taken<limit){
   const before=model(id),row=before.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');if(!row)break;
   let count=Math.min(row.count,limit-taken);if(!count)break;
   const stack=JSON.parse(row.expected),actor=before.personal,pool=before.entries.filter(r=>JSON.parse(r.expected).item==='medkits').reduce((sum,r)=>sum+r.count,0),carried=campaign.operativeState[id].medkits;
   while(count){try{applyItemQuantity(actor,{...stack,count});break;}catch(error){assert.match(error.message,/espacio en el inventario/);count--;}}
   if(!count)break;
   order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});taken+=count;
   const after=model(id);assert.equal(after.entries.filter(r=>JSON.parse(r.expected).item==='medkits').reduce((sum,r)=>sum+r.count,0),pool-count);assert.equal(campaign.operativeState[id].medkits,carried+count);
   if(count<row.count)assert.equal(after.entries.find(entry=>entry.key===row.key&&JSON.parse(entry.expected).item==='medkits')?.count,row.count-count);
  }
  return taken;
 };
 assert.equal(campaign.location,'tucuman');assert.equal(campaign.pendingBattle,null);
 for(const operativeId of [...local.map(op=>op.id),...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 recovered+=gather(firstDoctor);
 if(!campaign.operativeState[firstDoctor].medkits){const found=collectRouteItems(campaign,firstDoctor,{item:'medkits'},6);campaign=found.campaign;recovered+=found.collected;}
 const firstPatientHp=campaign.operativeState[firstPatient].hp,initialDressings=campaign.operativeState[firstDoctor].medkits;
 assert.ok(initialDressings>0,'the doctor needs actual carried or recovered supplies');
 order({type:'assignCare',operativeId:firstPatient,assignment:'patient'});order({type:'assignCare',operativeId:firstDoctor,assignment:'doctor'});
 order({type:'createSquad',name:'Correo sanitario',ids:[courier]});order({type:'assignCare',operativeId:courier,assignment:'active'});
 courierTravel('cordoba');
 restCourier();
 assert.ok(campaign.operativeState[firstPatient].hp>firstPatientHp,'the available supplies improve the first patient while the courier travels');assert.ok(campaign.operativeState[firstDoctor].medkits<initialDressings,'the initial treatment consumes actual carried or recovered dressings');
 order({type:'assignCare',operativeId:firstDoctor,assignment:'rest'});
 for(const item of ['torches','boleadoras']){const count=campaign.operativeState[courier][item];if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:courier,direction:'drop',item,count});}
 const cash=campaign.resources.treasury,carried=campaign.operativeState[courier].medkits,found=collectRouteItems(campaign,courier,{item:'medkits'},13);campaign=found.campaign;
 const foundDressings=found.collected,boughtDressings=0,cost=0,unitPrice=0;
 assert.equal(campaign.operativeState[courier].medkits,carried+foundDressings);assert.equal(campaign.resources.treasury,cash);
 courierTravel('tucuman');
 restCourier();
 order({type:'sectorInventory',sector:'tucuman',operativeId:courier,direction:'drop',item:'medkits',count:foundDressings});
 const firstShare=Math.ceil(foundDressings/2),secondShare=foundDressings-firstShare;assert.equal(gather(firstDoctor,firstShare),firstShare);assert.equal(secondShare?gather(secondDoctor,secondShare):0,secondShare);
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 report({event:'medicalCourierReturned',hour:campaign.hour,boughtDressings,foundDressings,cost,unitPrice,recoveredDressings:recovered});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<80;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve an actual encounter before continuing treatment');renew(2);
  for(const id of doctors)if(campaign.operativeState[id].medkits===0){
   let count=gather(id);
   if(!count){const donor=rosterFor(campaign).find(op=>!doctors.includes(op.id)&&model(op.id).operativeId===op.id&&!model(op.id).reason&&campaign.operativeState[op.id].medkits>0);
    if(donor){const quantity=campaign.operativeState[donor.id].medkits;order({type:'sectorInventory',sector:'tucuman',operativeId:donor.id,direction:'drop',item:'medkits',count:quantity});donated+=quantity;count=gather(id);}
    else {
     const before=campaign.operativeState[id].medkits,cash=campaign.resources.treasury,departure=seconds();
     // Keep the genuine discovery clock even when the known cache is empty.
     campaign=discoverRouteCache(campaign,id);count=gather(id,6);recovered+=count;
     assert.equal(campaign.operativeState[id].medkits,before+count);assert.equal(campaign.resources.treasury,cash);
     report({event:'localMedicalCacheRecovered',operativeId:id,count,elapsedSeconds:seconds()-departure,hour:campaign.hour});onCheckpoint('local-medical-cache-'+id,campaign,{count,elapsedSeconds:seconds()-departure});
     if(!count){
      assert.ok(foundDressings<13,'a partial actual C collection discovered its finite cache before reporting exhaustion');
      const prepared=prepareRescueClinicGuards(campaign,{courier,report});campaign=prepared.campaign;guardPreparation=prepared.evidence;onCheckpoint('rescue-clinic-prepared',campaign,guardPreparation);
      const rested=restRescuePatients(campaign,{patients,doctors,courier,exhaustedSources:['cordoba'],report,onCheckpoint});campaign=rested.campaign;restRecovery=rested.evidence;
      break;
     }
    }
   }
   assert.ok(count);
  }
  if(restRecovery)break;
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 for(const operativeId of [...patients,...doctors])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;for(let i=0;campaign.hour<restUntil&&i<20;i++){renew(2);order({type:'wait',hours:1});}assert.equal(campaign.hour,restUntil);
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of patients){assert.equal(campaign.operativeState[id].bleeding,0);assert.equal(campaign.operativeState[id].captured,false);assert.ok(campaign.recruited.includes(id));}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour,endHour:campaign.hour,courierStartHour,courierLegs,rearPhysicians,patients,doctors,hiredDoctors,hiringCost,courier,boughtDressings,foundDressings,cost,unitPrice,recoveredDressings:recovered,donatedDressings:donated,guardPreparation,restRecovery};report({event:'rescueRecoveryComplete',...recovery});return {campaign,events,recovery};
}
