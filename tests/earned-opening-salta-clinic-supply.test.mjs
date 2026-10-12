import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareSaltaClinicSupply,supplySaltaClinicDoctors,stabilizeSaltaClinicSurvivors} from './salta-clinic-supply.mjs';
import {fightNorthernSector,northernClinicDefenseOrder} from './northern-route.mjs';
import provenance from './fixtures/earned-opening-salta-clinic-start.provenance.json' with {type:'json'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clock=c=>c.hour*3600+(c.secondOfHour??0);

test('earned default opening pays the actual clinic courier and fresh cover before its native408 raid',t=>{
 const bytes=readFileSync(new URL('./fixtures/'+provenance.fixture,import.meta.url)),raw=gunzipSync(bytes);assert.equal(sha(bytes),provenance.gzipSha256);assert.equal(sha(raw),provenance.rawSha256);
 const input=decodeSave(raw.toString()).campaign,before=structuredClone(input);let campaign=decodeSave(encodeSave(input)).campaign;
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);};
 // These are the unchanged post-delivery orders before the default clinic call.
 const rear=campaign.squads.find(q=>q.members.length===1&&q.members.includes(100)),north=campaign.squads.find(q=>q.members.includes(116));assert.ok(rear&&north);
 order({type:'selectSquad',id:rear.id});order({type:'assignCare',operativeId:100,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign);order({type:'assignCare',operativeId:100,assignment:'rest'});order({type:'selectSquad',id:north.id});
 const admitted=decodeSave(encodeSave(campaign)).campaign,events=[],prepared=prepareSaltaClinicSupply(admitted,{report:event=>events.push(event)});campaign=prepared.campaign;
 assert.equal(prepared.receipt.needed,true);assert.equal(prepared.receipt.doctor,107);assert.equal(prepared.receipt.calmDoctor,116);assert.deepEqual(prepared.receipt.hires.map(h=>h.id),[107,138,132]);
 assert.deepEqual(prepared.receipt.hires.map(h=>h.kits),[0,2,2]);assert.deepEqual(prepared.receipt.hires.map(h=>h.quote.total),[93,6600,7740]);assert.equal(prepared.receipt.collectedDressings,10);assert.equal(prepared.receipt.debits.reduce((n,r)=>n+r.count,0),10);
 assert.equal(prepared.receipt.carried,3);assert.equal(prepared.receipt.carriedAfter,17);assert.equal(prepared.receipt.minimumTreatmentDressings,16);assert.equal(prepared.receipt.journey.hours,4);
 assert.ok(clock(campaign)>clock(admitted)+4*3600);assert.equal(campaign.activeSquadId,north.id);assert.equal(campaign.operativeState[107].location,'tucuman');assert.equal(campaign.operativeState[107].medkits,10);assert.equal(campaign.operativeState[107].morale,admitted.operativeState[107].morale);
 for(const id of prepared.receipt.patients)assert.equal(campaign.operativeState[id].hp,admitted.operativeState[id].hp,'Preparation preserves each actual wound.');
 assert.ok(prepared.receipt.positions.every(p=>p.tacticalLevel===1));assert.equal(new Set(prepared.receipt.positions.map(p=>p.x+':'+p.y)).size,prepared.receipt.positions.length);
 for(const [id,r]of Object.entries(admitted.operativeState))if(r.residentPosition&&!prepared.receipt.positions.some(p=>String(p.id)===id))assert.deepEqual(campaign.operativeState[id].residentPosition,r.residentPosition,'Other earned positions stay in place.');
 assert.ok(prepared.receipt.events.some(event=>event.event==='finitePrimaryRecovered'&&event.operativeId===107&&event.weapon===1801));
 assert.deepEqual(campaign.sectorStates.cordoba.droppedWeapons,admitted.sectorStates.cordoba.droppedWeapons);assert.deepEqual(campaign.artilleryDepots.tucuman.map(storedArtilleryRecord),admitted.artilleryDepots.tucuman.map(storedArtilleryRecord));
 assert.deepEqual(prepareSaltaClinicSupply(campaign).campaign,campaign,'A supplied clinic does not buy the same guards or courier twice.');
 const local=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='tucuman';});
 for(let h=0;!campaign.pendingEncounter&&h<4;h++){
  const wounded=local.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),doctors=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return local.includes(op.id)&&op.medical>=20&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2).map(op=>op.id);
  if(wounded.every(id=>doctors.includes(id)))doctors.splice(doctors.indexOf(wounded.at(-1)),1);campaign=supplySaltaClinicDoctors(campaign,doctors).campaign;
  for(const operativeId of local)order({type:'assignCare',operativeId,assignment:doctors.includes(operativeId)?'doctor':wounded.includes(operativeId)?'patient':'rest'});
  for(const id of campaign.recruited){const r=campaign.operativeState[id],contract=campaign.contracts[id],expiry=contractExpiresSeconds(contract);if(r.alive&&!r.captured&&expiry!==null&&expiry<=clock(campaign)+3601){const quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);}}
  order({type:'wait',hours:1});
 }
 assert.equal(campaign.pendingEncounter.groupId,'enemy-group-5');assert.equal(campaign.pendingEncounter.sector,'tucuman');assert.equal(campaign.hour,408);
 const battleInput=decodeSave(encodeSave(campaign)).campaign;campaign=battleInput;order({type:'respondToEncounter',groupId:campaign.pendingEncounter.groupId,choice:'tactical'});
 const fought=fightNorthernSector(campaign,'tucuman',{controller:northernClinicDefenseOrder});campaign=fought.campaign;assert.equal(fought.summary.status,'victory');assert.equal(campaign.sectors.tucuman.owner,'patriot');assert.equal(campaign.enemyGroups.find(g=>g.id==='enemy-group-5').status,'defeated');
 const newDeaths=local.filter(id=>!campaign.operativeState[id].alive);for(const id of [121,122])assert.equal(campaign.operativeState[id].alive,true,'Both actual original patients survive the earned defense.');
 if(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR)writeFileSync(join(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR,'clinic-defense-after.save.json'),encodeSave(campaign)+'\n');
 t.diagnostic(JSON.stringify({scope:'Actual native clinic raid before urgent care',clock:[campaign.hour,campaign.secondOfHour],turns:fought.summary.turns,orders:fought.summary.actions,newDeaths,service121:campaign.contracts[121]}));
 const careBefore=decodeSave(encodeSave(campaign)).campaign,care=stabilizeSaltaClinicSurvivors(careBefore,'tucuman');campaign=care.campaign;assert.ok(care.receipt.usedDressings>0);
 assert.ok(care.receipt.renewals.some(row=>row.id===121),'The actual short service term is paid before the urgent care clock advances.');
 for(const row of care.receipt.renewals){assert.equal(row.expiryBefore,contractExpiresSeconds(careBefore.contracts[row.id]));assert.equal(row.expiryAfter,row.expiryBefore+86400);assert.equal(row.price,contractRenewalQuote(careBefore,rosterFor(careBefore).find(op=>op.id===row.id),'day').price);assert.ok(campaign.recruited.includes(row.id));}
 assert.equal(careBefore.resources.treasury-campaign.resources.treasury,care.receipt.renewals.reduce((sum,row)=>sum+row.price,0));
 const survivors=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='tucuman';});assert.ok(survivors.every(id=>campaign.operativeState[id].hp>=15&&!campaign.operativeState[id].bleeding));
 for(const id of newDeaths)assert.equal(campaign.operativeState[id].alive,false);for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(input,before);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(campaign.artilleryDepots.tucuman.map(storedArtilleryRecord),before.artilleryDepots.tucuman.map(storedArtilleryRecord));
 if(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR)writeFileSync(join(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR,'clinic-urgent-care-after.save.json'),encodeSave(campaign)+'\n');
 const suppliedDoctor=rosterFor(campaign).find(op=>op.id===107);assert.equal(suppliedDoctor.medical>=80,true);const reachable=sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),107).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
 t.diagnostic(JSON.stringify({scope:'Default earned finite courier, paid arrivals, selective cover, native408 victory and finite urgent care only; complete clinic, Salta and Yatasto remain unproved.',start:[input.hour,input.secondOfHour],supplied:prepared.receipt.finish,hiring:prepared.receipt.hires.map(h=>({id:h.id,price:h.quote.total,kits:h.kits})),debits:prepared.receipt.debits,turns:fought.summary.turns,orders:fought.summary.actions,newDeaths,urgentCare:care.receipt,remainingKnownDressings:reachable,clock:[campaign.hour,campaign.secondOfHour],cash:campaign.resources.treasury}));
});
