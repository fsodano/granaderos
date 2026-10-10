import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {doctorRate} from '../game/medical-care.js';
import {careRules} from '../game/campaign-care-rules.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {northernCareRolePlan,assignNorthernCareRoles} from './northern-care-roles.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/northern-care-earned-staging.provenance.json',import.meta.url),'utf8'));
const fixtureGzip=readFileSync(new URL('./fixtures/northern-care-earned-staging.json.gz',import.meta.url)),fixtureRaw=gunzipSync(fixtureGzip);
const byteHash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(fixtureGzip.length,provenance.gzip.bytes);assert.equal(byteHash(fixtureGzip),provenance.gzip.sha256);
assert.equal(fixtureRaw.length,provenance.payload.bytes);assert.equal(byteHash(fixtureRaw),provenance.payload.sha256);assert.equal(provenance.payload.sha256,provenance.source.captureSha256);
const fixture=JSON.parse(fixtureRaw);
assert.equal(fixture.phase,provenance.source.phase);assert.deepEqual(fixture.context.doctors,provenance.nativeInput.doctors);assert.deepEqual(fixture.context.patients,provenance.nativeInput.patients);
const {doctors,patients}=fixture.context;
const initial=()=>structuredClone(fixture.campaign);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(canonical(value))).digest('hex');
const role=(plan,id)=>plan.roles.find(action=>action.operativeId===id)?.assignment;
const view=campaign=>({hour:campaign.hour,second:campaign.secondOfHour??0,treasury:campaign.resources.treasury,pendingEncounter:campaign.pendingEncounter,pendingBattle:campaign.pendingBattle,actors:Object.fromEntries([...new Set([...doctors,...patients])].map(id=>{const r=campaign.operativeState[id];return [id,{hp:r.hp,maxHp:r.maxHp,bleeding:r.bleeding,medkits:r.medkits,assignment:r.assignment,energy:r.energy,fatigue:r.fatigue,asleep:r.asleep,recoveryHours:r.recoveryHours,alive:r.alive,captured:r.captured,location:r.location}];}))});

test('earned original staging plans a patient role for wounded doctor 112 without mutation',()=>{
 const campaign=initial(),before=structuredClone(campaign),plan=northernCareRolePlan(campaign,doctors,patients);
 assert.equal(plan.target,112);assert.equal(plan.treating,122);assert.equal(role(plan,112),'patient');assert.equal(role(plan,122),'doctor');
 assert.equal(role(plan,113),'rest');assert.equal(role(plan,141),'rest');assert.equal(plan.transfer,null);
 assert.deepEqual(campaign,before);
});

test('declared pure healthy-pair input retains ordinary patient care',()=>{
 const campaign=initial();Object.assign(campaign.operativeState[112],{hp:64,bandaged:0});
 const before=structuredClone(campaign),plan=northernCareRolePlan(campaign,doctors,patients);
 assert.equal(plan.target,null);assert.equal(role(plan,112),'doctor');assert.equal(role(plan,122),'doctor');assert.equal(role(plan,113),'patient');assert.equal(role(plan,141),'patient');
 assert.deepEqual(campaign,before);
});

test('declared pure wounded-pair input rotates the doctors in the existing order',()=>{
 const campaign=initial();Object.assign(campaign.operativeState[122],{hp:40,bandaged:25});const declaredPatients=[...patients,122];
 let before=structuredClone(campaign),plan=northernCareRolePlan(campaign,doctors,declaredPatients);
 assert.equal(plan.target,112);assert.equal(plan.treating,122);assert.equal(role(plan,112),'patient');assert.equal(role(plan,122),'doctor');assert.deepEqual(campaign,before);
 // This is another declared selector input, not a native healing result.
 Object.assign(campaign.operativeState[112],{hp:64,bandaged:0});before=structuredClone(campaign);plan=northernCareRolePlan(campaign,doctors,declaredPatients);
 assert.equal(plan.target,122);assert.equal(plan.treating,112);assert.equal(role(plan,122),'patient');assert.equal(role(plan,112),'doctor');assert.deepEqual(campaign,before);
});

test('declared pure sleep and empty-kit inputs preserve native doctor gates and finite transfer needs',()=>{
 const sleeping=initial();sleeping.operativeState[122].asleep=true;let before=structuredClone(sleeping),plan=northernCareRolePlan(sleeping,doctors,patients);
 assert.equal(plan.target,null);assert.equal(role(plan,112),'patient');assert.equal(role(plan,122),'rest');assert.deepEqual(sleeping,before);
 const empty=initial();empty.operativeState[122].medkits=0;before=structuredClone(empty);plan=northernCareRolePlan(empty,doctors,patients);
 assert.deepEqual(plan.transfer,{from:112,to:122,sector:'san_nicolas'});assert.equal(role(plan,112),'patient');assert.equal(role(plan,122),'rest');assert.deepEqual(empty,before);
 empty.operativeState[112].medkits=0;before=structuredClone(empty);plan=northernCareRolePlan(empty,doctors,patients);
 assert.equal(plan.transfer,null);assert.equal(role(plan,122),'rest');assert.deepEqual(empty,before);
});

test('one earned native care sequence spends finite dressings, restores patients, preserves the fallen, and exactly replays official saves',()=>{
 const output=mkdtempSync(join(tmpdir(),'granaderos-northern-care-native-')),tape=[],saves=[];
 const raw=initial(),unchanged=structuredClone(raw),dead=Object.fromEntries(Object.entries(raw.operativeState).filter(([,record])=>!record.alive)),pool=state=>doctors.reduce((sum,id)=>sum+state.operativeState[id].medkits,0);
 const save=(label,state)=>{const encoded=encodeSave(state),decoded=decodeSave(encoded);assert.equal(decoded.battle,null);assert.deepEqual(decoded.campaign,state,'official save must preserve the complete native campaign');writeFileSync(join(output,label+'.save.json'),encoded,{flag:'wx'});saves.push({label,bytes:Buffer.byteLength(encoded),sha256:hash(encoded),campaignSha256:hash(decoded.campaign)});return decoded.campaign;};
 console.log('NATIVE_CARE_CONTROL_OUTPUT='+output);writeFileSync(join(output,'earned-initial-native.json'),JSON.stringify(raw)+'\n',{flag:'wx'});
 let campaign=raw,firstPaidHour=null,doctorRecovery=null;
 try{
 campaign=save('initial',raw);
 const beforeView=view(campaign),medicalStart=pool(campaign),rules=careRules(campaign);
 const order=action=>{const before=campaign,next=dispatchCampaign(before,action);
  tape.push({action:structuredClone(action),lastError:next.lastError,beforeSha256:hash(before),afterSha256:hash(next),before:view(before),after:view(next)});campaign=next;writeFileSync(join(output,'native-care-tape.json'),JSON.stringify(tape,null,2)+'\n');
  assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);assert.equal(next.pendingEncounter,null,'retain and resolve a real encounter before continuing this bounded care control');assert.equal(next.pendingBattle,null);for(const [id,record]of Object.entries(dead))assert.deepEqual(next.operativeState[id],record,'dead record '+id+' must remain unchanged');return campaign;};
 let waits=0;
 for(;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&waits<60;waits++){
  // The observed paid week contracts all remain valid for this 60-hour bound.
  for(const id of new Set([...doctors,...patients]))assert.ok(campaign.contracts[id].expiresAt>campaign.hour+1,'the existing paid contract must cover the next hour');
  campaign=assignNorthernCareRoles(campaign,doctors,patients,order);const prior=structuredClone(campaign),priorPlan=northernCareRolePlan(prior,doctors,patients);
  order({type:'wait',hours:1});const elapsed=(campaign.hour-prior.hour)*3600+(campaign.secondOfHour??0)-(prior.secondOfHour??0);assert.ok(elapsed===0||elapsed===3600,'a wait may pause for native attention or consume exactly one actual hour');
  if(!firstPaidHour&&elapsed===3600){
   const rate=doctorRate(rosterFor(prior).find(op=>op.id===122),prior);
   assert.equal(priorPlan.target,112);assert.equal(priorPlan.treating,122);assert.equal(campaign.operativeState[112].hp,Math.min(prior.operativeState[112].maxHp,prior.operativeState[112].hp+rate));
   assert.equal(campaign.operativeState[122].medkits,prior.operativeState[122].medkits-1);assert.equal(campaign.operativeState[122].energy,prior.operativeState[122].energy-rules.energyCost);assert.equal(campaign.operativeState[122].fatigue,prior.operativeState[122].fatigue+rules.fatigueCost);
   firstPaidHour={rate,elapsedSeconds:elapsed,before:view(prior),after:view(campaign)};save('first-paid-hour',campaign);
  }
  if(!doctorRecovery&&campaign.operativeState[112].hp===campaign.operativeState[112].maxHp){doctorRecovery={waits:waits+1,state:view(campaign)};save('doctor-recovered',campaign);}
 }
 assert.ok(firstPaidHour);assert.ok(doctorRecovery);
 for(const id of patients){assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp,'patient '+id+' must finish paid care');assert.equal(campaign.operativeState[id].bleeding,0);}
 assert.ok(pool(campaign)<medicalStart);assert.ok(pool(campaign)>=0);
 const final=save('final',campaign),midpoint=tape.findIndex(entry=>entry.after.hour===firstPaidHour.after.hour),acceptedActions=tape.map(entry=>entry.action);
 let replay=decodeSave(readFileSync(join(output,'initial.save.json'),'utf8')).campaign;
 for(let i=0;i<acceptedActions.length;i++){assert.equal(hash(replay),tape[i].beforeSha256,'exact replay input '+i);replay=dispatchCampaign(replay,acceptedActions[i]);assert.equal(replay.lastError,null);assert.equal(hash(replay),tape[i].afterSha256,'exact replay result '+i);if(i===midpoint){const paired=decodeSave(encodeSave(replay));assert.deepEqual(paired.campaign,replay);replay=paired.campaign;}}
 assert.deepEqual(replay,final,'the complete native campaign must replay exactly');assert.deepEqual(raw,unchanged,'the genuine retained input must remain unchanged');
 const receipt={runtime:process.execPath,nodeVersion:process.version,input:'earned unchanged recovery observation after original finite supply gathering',declaredPureVariants:'healthy pair, both wounded, sleep, empty carried kits; no orders in these variants',nativeSequenceCount:1,nativeRecordedOrderReplayCount:1,newCampaignPrefixCount:0,battleCount:0,alternatePlanCount:0,orders:tape.length,waits,actualElapsedSeconds:(final.hour-raw.hour)*3600+(final.secondOfHour??0)-(raw.secondOfHour??0),medicalStart,medicalRemaining:pool(final),medicalUsed:medicalStart-pool(final),deadIds:Object.keys(dead),deadRecordsUnchanged:true,initial:beforeView,firstPaidHour,doctorRecovery,final:view(final),fullFinalReplayEqual:true,fullOfficialSaveEquality:true,saves};
 writeFileSync(join(output,'native-control-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log('NATIVE_CARE_CONTROL_RECEIPT='+join(output,'native-control-receipt.json'));
 }catch(error){writeFileSync(join(output,'failed-current-native.json'),JSON.stringify(campaign)+'\n',{flag:'wx'});writeFileSync(join(output,'failed-control-receipt.json'),JSON.stringify({error:String(error),stack:error.stack,orders:tape.length,current:view(campaign),saves,nativeSequenceCount:1,retryCount:0},null,2)+'\n',{flag:'wx'});throw error;}
});
