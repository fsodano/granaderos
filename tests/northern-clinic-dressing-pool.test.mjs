import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {shareNorthernClinicDressing} from './northern-clinic-dressing-pool.mjs';
import {recoverNorthernLocalPatients} from './fresh-northern-fixture.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
// Assignment notices can pause an ordinary wait before spending time.
function careHour(c){const end=clock(c)+3600;for(let n=0;clock(c)<end&&n<8;n++)c=order(c,{type:'wait',hours:1});assert.equal(clock(c),end,'Resume actual notices until exactly one paid clinical hour elapses.');return c;}

// Wounds, stock, prices, pack and raid schedule are declared before compiler
// and factory. Every hire, visit, duty and possible raid is an ordinary order.
function setup({kits=13,donorHP=54,donorBleeding=0,patientHP=56,extraPatientHP=null,fullDoctor=false,raid=false}={}){
 const d=scaffoldDocuments('northern-clinic-dressing-pool');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 d.content.headquarters='watch-post';d.world.defaultHeadquarters='watch-post';d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=0;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={[sector]:0,'watch-post':0};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:[sector]}}};
 const base=d.content.characters[0];
 d.content.characters=Array.from({length:extraPatientHP===null?4:5},(_,i)=>({...structuredClone(base),id:'clinic-'+i,name:'Clínica '+i,nickname:'Clínica '+i,weapon:null,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:70,strength:fullDoctor&&i===0?1:70,medical:i===0?80:i===1?90:i===3?20:0},
  startingSupplies:{medkits:i===1?kits:0,rations:fullDoctor&&i===0?24:0,torches:0,boleadoras:0},
  startingCondition:{hp:i===1?donorHP:i===2?patientHP:i===4?extraPatientHP:70,bleeding:i===1?donorBleeding:0,bandaged:i===1?(donorBleeding?0:70-donorHP):i===2?70-patientHP:i===4?70-extraPatientHP:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const ids=rosterFor(c).map(op=>op.id),[doctor,donor,patient,backup]=ids;
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);}
 c=order(c,{type:'createSquad',ids,sector,name:'Clínica real'});c=leave(visit(c));
 for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:c.operativeState[id].hp<c.operativeState[id].maxHp?'patient':'rest'});
 if(raid){for(let n=0;!c.pendingEncounter&&n<4;n++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,sector,'The negative case earns an actual local raid before the clinic handover.');}
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,doctor,donor,patient,backup};
}
const plan=(s,c=s.campaign)=>{
 const patients=s.ids.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const doctors=rosterFor(c).filter(op=>s.ids.includes(op.id)&&op.medical>=20&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp).sort((a,b)=>b.medical-a.medical).slice(0,Math.min(3,patients.length)).map(op=>op.id);
 return {sector,planIds:s.ids,patients,doctors,deadlineSeconds:clock(s.campaign)+96*3600};
};

test('the actual clinic shares one owned patient dressing, preserves its own-care floor and spends it through real paid care',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),r=shareNorthernClinicDressing(start,s.doctor,plan(s)),c=r.campaign;
 assert.equal(r.supplied,true);assert.equal(r.receipt.donations[0].reserve,6);assert.equal(r.receipt.donations[0].internal,true);assert.equal(r.receipt.donations[0].count,1);
 assert.equal(c.operativeState[s.donor].medkits,12);assert.equal(c.operativeState[s.doctor].medkits,1);assert.equal(clock(c),clock(start));assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);
 for(const id of s.ids)for(const key of ['assignment','residentPosition','hp','bleeding'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
 const already=shareNorthernClinicDressing(c,s.doctor,plan(s,c));assert.equal(already.supplied,true);assert.equal(already.deferred,false);assert.equal(already.receipt.reason,'already-supplied');assert.deepEqual(already.receipt.takes,[]);assert.deepEqual(already.receipt.orders,[]);assert.strictEqual(already.campaign,c);
 let replay=start;for(const row of r.receipt.orders)replay=order(replay,row.action);assert.deepEqual(replay,c);saved(c);
 let treated=order(c,{type:'assignCare',operativeId:s.doctor,assignment:'doctor'});treated=careHour(treated);assert.ok(clock(treated)>clock(c));
 assert.equal(treated.operativeState[s.doctor].medkits,0);assert.ok([s.donor,s.patient].some(id=>treated.operativeState[id].hp>c.operativeState[id].hp));assert.deepEqual(start,before);saved(treated);
});

test('recomputed finite clinical handovers earn full recovery inside the original96hours without treating an internal kit as new stock',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start);let c=start,used=0,internalTakes=0,internalDonations=0,recoveredDoctorWorked=false;
 for(let n=0;n<16&&plan(s,c).patients.length;n++){
  const current=plan(s,c);
  for(const id of current.doctors)if(!c.operativeState[id].medkits){
   const r=shareNorthernClinicDressing(c,id,current);c=r.campaign;
   if(r.deferred){assert.equal(r.supplied,false);assert.deepEqual(r.receipt.orders,[]);continue;}
   assert.equal(r.supplied,true);internalTakes+=r.receipt.takes.reduce((sum,take)=>sum+take.count,0);internalDonations+=r.receipt.donations.filter(donation=>donation.internal).reduce((sum,donation)=>sum+donation.count,0);
  }
  for(const id of s.ids)c=order(c,{type:'assignCare',operativeId:id,assignment:current.patients.includes(id)?'patient':current.doctors.includes(id)&&c.operativeState[id].medkits>0?'doctor':'rest'});
  const kits=s.ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),donorKits=c.operativeState[s.donor].medkits,donorWorking=c.operativeState[s.donor].assignment==='doctor';c=order(c,{type:'wait',hours:1});used+=kits-s.ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0);
  if(donorWorking){assert.equal(c.operativeState[s.donor].medkits,donorKits-1);recoveredDoctorWorked=true;}
 }
 for(const id of [s.donor,s.patient])assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
 assert.equal(recoveredDoctorWorked,true);assert.ok(used>0);assert.equal(internalTakes,internalDonations);assert.equal(internalTakes-internalDonations,0,'Owned handovers add no external clinic stock.');assert.equal(s.ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),13-used);assert.ok(clock(c)<=plan(s).deadlineSeconds);assert.deepEqual(c.squads,start.squads);assert.deepEqual(start,before);saved(c);
});

test('an actual supplied recovered clinician defers an optional empty doctor without an inventory order and treats a remaining patient',()=>{
 const s=setup({donorHP:64,patientHP:66,extraPatientHP:67}),start=s.campaign,before=structuredClone(start),first=shareNorthernClinicDressing(start,s.doctor,plan(s));let c=first.campaign;
 assert.equal(first.supplied,true);assert.equal(first.receipt.takes.length,1);assert.equal(first.receipt.donations.length,1);
 c=order(c,{type:'assignCare',operativeId:s.doctor,assignment:'doctor'});c=careHour(c);assert.equal(c.operativeState[s.donor].hp,c.operativeState[s.donor].maxHp);assert.equal(c.operativeState[s.doctor].medkits,0);
 const current=plan(s,c);assert.deepEqual(current.doctors,[s.donor,s.doctor]);assert.equal(current.patients.length,2);assert.ok(!current.patients.includes(s.donor));
 const previous=c,donorKits=c.operativeState[s.donor].medkits,deferred=shareNorthernClinicDressing(c,s.doctor,current);
 assert.equal(deferred.supplied,false);assert.equal(deferred.deferred,true);assert.equal(deferred.receipt.reason,'other-supplied-doctor');assert.deepEqual(deferred.receipt.orders,[]);assert.deepEqual(deferred.receipt.takes,[]);assert.deepEqual(deferred.receipt.donations,[]);assert.strictEqual(deferred.campaign,previous);
 const available=shareNorthernClinicDressing(c,s.donor,current);assert.equal(available.supplied,true);assert.equal(available.deferred,false);assert.equal(available.receipt.reason,'already-supplied');assert.deepEqual(available.receipt.orders,[]);assert.deepEqual(available.receipt.takes,[]);assert.strictEqual(available.campaign,previous);
 for(const id of s.ids)c=order(c,{type:'assignCare',operativeId:id,assignment:current.patients.includes(id)?'patient':current.doctors.includes(id)&&c.operativeState[id].medkits>0?'doctor':'rest'});
 assert.equal(c.operativeState[s.donor].assignment,'doctor');assert.equal(c.operativeState[s.doctor].assignment,'rest');
 const patientHP=current.patients.reduce((sum,id)=>sum+c.operativeState[id].hp,0),paidFrom=clock(c);c=careHour(c);
 assert.equal(clock(c),paidFrom+3600);assert.equal(c.operativeState[s.donor].medkits,donorKits-1);assert.equal(c.operativeState[s.doctor].medkits,0);assert.ok(current.patients.reduce((sum,id)=>sum+c.operativeState[id].hp,0)>patientHP);
 assert.equal(s.ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),11);assert.equal(first.receipt.takes[0].count-first.receipt.donations[0].count,0);assert.ok(clock(c)<=current.deadlineSeconds);assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(start,before);saved(c);
});

test('the conservative own-care floor and a patient outside this explicit clinic plan keep every owned dressing',()=>{
 for(const outside of [false,true]){
  const s=setup({kits:outside?13:6}),before=structuredClone(s.campaign),p=plan(s);if(outside)p.patients=[s.patient];
  const r=shareNorthernClinicDressing(s.campaign,s.doctor,p);assert.equal(r.supplied,false);assert.equal(r.reason,undefined);assert.equal(r.receipt.reason,'no-clinic-surplus');assert.deepEqual(r.receipt.orders,[]);assert.strictEqual(r.campaign,s.campaign);assert.deepEqual(s.campaign,before);
 }
});

test('Native pack capacity refuses before a patient drop or a false stock credit',()=>{
 const s=setup({fullDoctor:true}),before=structuredClone(s.campaign),m=sectorInventoryModel(s.campaign,sector,rosterFor(s.campaign),s.doctor);
 assert.throws(()=>applyItemQuantity(m.personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight}));let caught;
 try{shareNorthernClinicDressing(s.campaign,s.doctor,plan(s));}catch(error){caught=error;}
 assert.ok(caught);assert.deepEqual(caught.northernClinicDressingPool.orders,[]);assert.strictEqual(caught.campaign,s.campaign);assert.deepEqual(s.campaign,before);
});

test('a refusal after the real patient drop retains only that accepted finite prefix and stops',()=>{
 const s=setup(),before=structuredClone(s.campaign),failure=Error('observed drop stops this caller');let caught;
 try{shareNorthernClinicDressing(s.campaign,s.doctor,{...plan(s),report:event=>{if(event.event==='northernClinicDressingDropped')throw failure;}});}catch(error){caught=error;}
 assert.strictEqual(caught,failure);assert.equal(caught.northernClinicDressingPool.orders.length,1);assert.equal(caught.northernClinicDressingPool.takes.length,0);
 assert.equal(caught.campaign.operativeState[s.donor].medkits,12);assert.equal(caught.campaign.operativeState[s.doctor].medkits,0);assert.equal(caught.campaign.pendingBattle,null);assert.deepEqual(s.campaign,before);
 // The caught campaign is plain evidence only: no query, save or replay.
});

test('an actual raid, acute patient or exhausted original deadline stops before any inventory order',()=>{
 for(const options of [{raid:true},{donorHP:14,donorBleeding:1},{}]){
  const s=setup(options),before=structuredClone(s.campaign),p=plan(s);if(!options.raid&&!options.donorBleeding)p.deadlineSeconds=clock(s.campaign)-1;let caught;
  try{shareNorthernClinicDressing(s.campaign,s.doctor,p);}catch(error){caught=error;}
  assert.ok(caught);assert.deepEqual(caught.northernClinicDressingPool.orders,[]);assert.strictEqual(caught.campaign,s.campaign);assert.deepEqual(s.campaign,before);
 }
});


test('a healthy paid clinician heals the wounded higher-skill medic and the other patient from exact finite stock',()=>{
 const d=scaffoldDocuments('northern-local-unbandaged-clinical-course');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 d.content.headquarters='watch-post';d.world.defaultHeadquarters='watch-post';d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=0;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={[sector]:0,'watch-post':0};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:240,axis:[sector]}}};
 const base=d.content.characters[0],health=[70,54,56,70],skills=[80,90,0,20];
 d.content.characters=health.map((hp,i)=>({...structuredClone(base),id:'unbandaged-clinic-'+i,name:'Clínica sin vendas previas '+i,nickname:'Clínica '+i,weapon:null,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:70,strength:70,medical:skills[i]},startingSupplies:{medkits:i===1?6:0,rations:0,torches:0,boleadoras:0},
  startingCondition:{hp,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const ids=rosterFor(c).map(op=>op.id);
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);}
 c=order(c,{type:'createSquad',ids,sector,name:'Clínica actual'});c=leave(visit(c));
 for(const operativeId of ids)c=order(c,{type:'assignCare',operativeId,assignment:c.operativeState[operativeId].hp<c.operativeState[operativeId].maxHp?'patient':'rest'});
 assert.deepEqual(d,declaration);const s={campaign:saved(c),ids,doctor:ids[0],donor:ids[1],patient:ids[2],backup:ids[3]},start=s.campaign,before=structuredClone(start),events=[];
 const roster=rosterFor(start),healthy=roster.find(op=>op.id===s.doctor),wounded=roster.find(op=>op.id===s.donor);
 assert.equal(healthy.medical,80);assert.equal(wounded.medical,90);
 assert.equal(start.operativeState[s.doctor].hp,start.operativeState[s.doctor].maxHp);
 assert.equal(start.operativeState[s.donor].hp,54);assert.equal(start.operativeState[s.donor].bandaged,0);
 assert.equal(start.operativeState[s.patient].hp,56);assert.equal(start.operativeState[s.patient].bandaged,0);
 assert.equal(start.operativeState[s.doctor].medkits,0);assert.equal(start.operativeState[s.donor].medkits,6);
 assert.ok(start.resources.treasury<10000,'All actual quoted weekly hires were paid before care.');
 const end=recoverNorthernLocalPatients(start,{report:event=>events.push(event)}),summary=events.find(event=>event.event==='northernLocalCare');
 assert.ok(summary);assert.equal(summary.doctor,s.doctor);assert.deepEqual(summary.initialPatients,[s.donor,s.patient]);
 assert.deepEqual(summary.defenses,[]);assert.equal(summary.elapsedSeconds,6*3600);assert.ok(summary.elapsedSeconds<=48*3600);
 assert.equal(summary.dressingsUsed,6);assert.equal(summary.transfers.reduce((sum,row)=>sum+row.count,0),6);
 assert.ok(summary.transfers.every(row=>row.donor===s.donor));
 for(const id of s.ids){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].hp,end.operativeState[id].maxHp);assert.equal(end.operativeState[id].bleeding,0);}
 assert.equal(s.ids.reduce((sum,id)=>sum+end.operativeState[id].medkits,0),0);
 assert.equal(end.operativeState[s.doctor].assignment,'rest');assert.equal(end.pendingEncounter,null);assert.equal(end.pendingBattle,null);
 assert.equal(end.resources.treasury,start.resources.treasury);assert.deepEqual(end.contracts,start.contracts);assert.deepEqual(end.squads,start.squads);
 assert.deepEqual(start,before);saved(end);
 assert.deepEqual(recoverNorthernLocalPatients(saved(start)),end,'The complete successful ordinary-care course repeats from the official saved input.');
});


// New independent declarations; the complete previous eight-case file above
// remains exact. All field stock, wounds and the future raid precede factories.
import {weaponSpecification} from '../game/weapon-definition.js';
import {careRules} from '../game/campaign-care-rules.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {refreshCordobaClinicReadiness} from './cordoba-clinic-combat-readiness.mjs';

test('an actual local raid during finite-stock passive recovery settles before care resumes inside the first course allowance',()=>{
 const d=scaffoldDocuments('northern-local-passive-raid-course');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 d.content.headquarters='watch-post';d.world.defaultHeadquarters='watch-post';d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=12;d.content.rules.enemyCartridges=6;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={[sector]:0,'watch-post':0};d.world.expansion.rural=[];
 const base=d.content.characters[0],stock=weaponSpecification({weapon:1801});
 d.content.weapons.push({id:'passive-raid-stock-musket',template:1801,name:stock.name,damage:stock.damage,fireAP:stock.fireAP,aimAP:stock.aimAP,reloadAP:stock.reloadAP,range:stock.range,readyAP:stock.readyAP,capacity:stock.capacity,weight:stock.weight,price:stock.price,art:base.portrait});
 d.content.oppositionEquipment={officer:'passive-raid-stock-musket',line:'passive-raid-stock-musket',veteran:'passive-raid-stock-musket'};
 const health=[70,45,50,70,70,70,70];
 d.content.characters=health.map((hp,i)=>({...structuredClone(base),id:'passive-raid-'+i,name:'Guardia de recuperación '+i,nickname:'Guardia '+i,weapon:'passive-raid-stock-musket',monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:70,strength:80,agility:80,dexterity:80,wisdom:80,leadership:80,marksmanship:[3,4].includes(i)?35:90,medical:i===0?80:0},
  startingSupplies:{medkits:i===0?1:0,rations:0,torches:0,boleadoras:0},startingCondition:{hp,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 d.maps[sector].props=[{id:'passive-raid-arsenal',type:'chest',x:12,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:'passive-raid-arsenal',contents:[{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos de mosquete',count:12,weight:.04}]};
 d.world.physical.arsenals[sector]={version:1,sector,chest:'passive-raid-arsenal',pieces:[{id:'arsenal:passive-raid:1',type:'bronze4',side:'player',loaded:true,ammo:6},{id:'arsenal:passive-raid:2',type:'bronze4',side:'player',loaded:true,ammo:6}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:12,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(8,content);const ids=rosterFor(c).map(op=>op.id),homes=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);}
 for(let i=0;i<ids.length;i+=6){c=order(c,{type:'createSquad',ids:ids.slice(i,i+6),sector,name:'Guardia de recuperación'});homes.push(c.activeSquadId);}
 for(const home of homes){c=order(c,{type:'selectSquad',id:home});c=leave(visit(c));}
 c=order(c,{type:'selectSquad',id:homes[0]});c=discoverRouteCache(c,ids[0]);
 const ready=refreshCordobaClinicReadiness(c,null,{deadlineSeconds:clock(c)+3600});c=ready.campaign;assert.equal(ready.receipt.supplied,true);assert.equal(ready.receipt.doctorId,ids[0]);assert.equal(ready.receipt.crewIds.length,2);
 assert.deepEqual(d,declaration);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.ok(clock(c)<12*3600,'Paid discovery and actual crew placement finish before the declared raid can launch.');
 const start=saved(c),before=structuredClone(start),events=[],initialGuns=structuredClone(start.sectorStates[sector].artillery),initialChest=structuredClone(start.sectorStates[sector].props.find(prop=>prop.id==='passive-raid-arsenal').contents);
 assert.equal(ids.length,7);assert.equal(start.sectors[sector].fort,0);assert.equal(initialGuns.length,2);assert.ok(initialGuns.every(gun=>gun.type==='bronze4'&&gun.loaded&&gun.ammo===6));
 assert.equal(ids.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),1);for(const id of [ids[1],ids[2]])assert.equal(start.operativeState[id].bandaged,0);
 const end=recoverNorthernLocalPatients(start,{report:event=>events.push(event)}),rests=events.filter(event=>event.event==='stableRouteRestFinished'),defenses=events.filter(event=>event.event==='northernLocalCareDefense'),summary=events.find(event=>event.event==='northernLocalCare');
 assert.ok(rests.length>=2,'The actual course pauses for the raid and resumes real passive recovery afterward.');const first=rests[0],last=rests.at(-1);assert.equal(first.completed,false);assert.equal(first.stoppedReason,'The actual encounter at cordoba interrupts stable rest.');assert.ok(first.hours>0);assert.equal(last.completed,true);
 assert.equal(defenses.length,1);const defense=defenses[0],group=end.enemyGroups.find(row=>row.id===defense.groupId);assert.equal(group.initialStrength,3);assert.equal(group.units.length,3);assert.equal(group.status,'defeated');assert.equal(first.finish[0],group.arrivalAt);assert.ok(first.start[0]*3600+first.start[1]<group.arrivalAt*3600);assert.ok(first.start[0]*3600+first.start[1]>clock(start),'The one actual dressing was spent before passive recovery began.');
 assert.equal(defense.summary.status,'victory');assert.equal(defense.summary.officialReplay,true);assert.equal(defense.summary.officialMidpoint,true);assert.ok(defense.summary.actions>0&&defense.summary.nativeActions<=600&&defense.summary.turns<=81&&defense.summary.elapsedSeconds>0);assert.equal(end.sectors[sector].owner,'patriot');assert.equal(end.pendingEncounter,null);assert.equal(end.pendingBattle,null);
 const originalHours=Math.max(0,...first.patients.map(row=>Math.ceil(row.maxHp-row.before)))*careRules(start).restHealingHours,passiveHours=rests.reduce((sum,receipt)=>sum+receipt.hours,0),firstStart=first.start[0]*3600+first.start[1];
 assert.equal(first.boundHours,originalHours);assert.ok(passiveHours<=originalHours,'All resumed passive rest spends only the FIRST wound-derived allowance.');assert.equal(last.start[0]*3600+last.start[1]-(first.finish[0]*3600+first.finish[1]),defense.summary.elapsedSeconds);assert.equal(clock(end)-firstStart,passiveHours*3600+defense.summary.elapsedSeconds);assert.ok(last.start[0]*3600+last.start[1]>first.finish[0]*3600+first.finish[1]);
 assert.ok(summary);assert.equal(summary.passiveBoundHours,originalHours);assert.equal(summary.passiveHours,passiveHours);assert.equal(summary.defenses.length,1);assert.equal(summary.dressingsUsed,1);assert.ok(rests.every(receipt=>receipt.dressingsUsed===0));for(const id of ids)assert.equal(end.operativeState[id].medkits,0,'No finite dressing is refilled after the actual raid.');
 const fallen=ids.filter(id=>!end.operativeState[id].alive).sort((a,b)=>a-b);assert.deepEqual([...defense.summary.deaths].sort((a,b)=>a-b),fallen);
 for(const id of ids){const r=end.operativeState[id];if(fallen.includes(id)){assert.equal(r.hp,0);assert.equal(r.alive,false);continue;}assert.equal(r.location,sector);assert.equal(r.captured,false);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(end.operativeState[id].alive,false);
 const charges=gun=>Number(gun.loaded)+gun.ammo;for(const gun of initialGuns){const current=end.sectorStates[sector].artillery.find(row=>row.id===gun.id);assert.ok(current&&charges(current)>=0&&charges(current)<=charges(gun));const record=({loaded,ammo,facing,reloadProgress,stationed,...rest})=>rest;assert.deepEqual(record(current),record(gun));}
 assert.deepEqual(end.sectorStates[sector].props.find(prop=>prop.id==='passive-raid-arsenal').contents,initialChest);assert.equal(end.sectors[sector].fort,0);
 const renewals=events.filter(event=>event.event==='stableRouteRestRenewal');for(const renewal of renewals)assert.equal(renewal.cost,renewal.quote.price);assert.equal(end.resources.treasury,start.resources.treasury-renewals.reduce((sum,row)=>sum+row.cost,0));
 assert.deepEqual(start,before);saved(end);assert.deepEqual(recoverNorthernLocalPatients(saved(start)),end,'The full successful course repeats from its fresh official input, including actual casualties.');
});
