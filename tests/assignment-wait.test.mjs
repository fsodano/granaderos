import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {doctorRate} from '../game/medical-care.js';
import {repairRate} from '../game/assignments.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {stageFiniteDressings,collectFiniteDressings} from './care-supply-source.mjs';

const order=(s,action)=>{const n=dispatchCampaign(s,action);assert.equal(n.lastError,null,`${action.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const care=(s,id,assignment)=>order(s,{type:'assignCare',operativeId:id,assignment});
const work=(s,id,assignment,options={})=>order(s,{type:'assignWork',operativeId:id,assignment,...options});
const record=(s,id)=>s.operativeState[id];
const wound=(s,id,deficit,extra={})=>Object.assign(record(s,id),{hp:record(s,id).maxHp-deficit,bandaged:deficit,bleeding:0,...extra});
const events=s=>s.assignmentAttention.notice?.events??[];
const event=(s,id,code)=>events(s).find(e=>e.operativeId===id&&e.code===code);
function stopped(s,requested,advanced,start=0){
 const notice=s.assignmentAttention.notice;
 assert.ok(notice,'the explicit wait must show why it stopped');
 assert.equal(s.hour,start+advanced);assert.equal(notice.hour,s.hour);
 assert.equal(notice.requestedHours,requested);assert.equal(notice.advancedHours,advanced);
 assert.ok(notice.events.length>0);assert.equal(new Set(notice.events.map(e=>e.subject)).size,notice.events.length);
 return notice;
}
function medicalTeam(deficit=6,{kits=2,reserve=0}={}){
 let s=initialCampaign();wound(s,3,deficit);record(s,10).medkits=kits+reserve;if(reserve)s=stageFiniteDressings(s,10,reserve);
 s=care(s,10,'doctor');return care(s,3,'patient');
}
function repairTeam({condition=95,tools=100}={}){
 let s=initialCampaign();record(s,4).condition=condition;record(s,10).toolkitPoints=tools;
 return work(s,10,'repair',{targetId:4});
}
function studentTeam(){
 let s=work(initialCampaign(),10,'instructor',{skill:'mechanical'});
 return work(s,3,'student',{skill:'mechanical',instructorId:10});
}

test('healing stops after the full treatment hour, keeps assignments, and consumes only its finite kit',()=>{
 const before=medicalTeam(),resources=structuredClone(before.resources),rate=doctorRate(rosterFor(before).find(o=>o.id===10));
 const s=wait(before,8);stopped(s,8,1);
 assert.equal(record(s,3).hp,record(before,3).hp+rate);assert.equal(record(s,3).bandaged,0);
 assert.equal(record(s,3).assignment,'patient');assert.equal(record(s,10).assignment,'doctor');
 assert.equal(record(s,10).medkits,1);assert.equal(record(s,10).energy,97);assert.equal(record(s,10).fatigue,2);
 assert.equal(event(s,3,'healing_complete')?.state,'complete');assert.ok(event(s,10,'no_patients'));
 assert.deepEqual(s.resources,resources);assert.equal(before.hour,0);assert.equal(record(before,10).medkits,2);
});

test('repair stops on the hour that restores the equipped gun and does not refill tools or ammunition',()=>{
 const before=repairTeam(),resources=structuredClone(before.resources),rate=repairRate(rosterFor(before).find(o=>o.id===10));
 const s=wait(before,12);stopped(s,12,1);
 assert.equal(record(s,4).condition,100);assert.equal(record(s,10).toolkitPoints,100-rate);
 assert.equal(record(s,10).assignment,'repair');assert.equal(record(s,10).repairTargetId,4);
 assert.equal(event(s,10,'repair_complete')?.targetId,4);assert.equal(record(s,10).energy,97);
 assert.deepEqual(s.resources,resources);
 const continued=wait(s,3);assert.equal(continued.hour,4);assert.equal(continued.assignmentAttention.notice,null);
 assert.equal(record(continued,10).toolkitPoints,95);assert.equal(record(continued,4).condition,100);
});

test('an already complete assigned patient stops before a new hour and rejects invalid waits atomically',()=>{
 let s=medicalTeam(0),before=structuredClone(s);s=wait(s,8);stopped(s,8,0);
 assert.ok(event(s,3,'healing_complete'));assert.deepEqual(s.operativeState,before.operativeState);assert.deepEqual(s.resources,before.resources);
 for(const hours of [0,-1,1.5,241]){const saved=serializeCampaign(s),rejected=dispatchCampaign(s,{type:'wait',hours});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},JSON.parse(saved));assert.equal(serializeCampaign(s),saved);}
});

test('kit exhaustion pauses further treatment at the exact depleted hour and collecting a finite reserve rearms the warning',()=>{
 let s=medicalTeam(40,{reserve:1}),stock=s.merchants.retiro.supplies.medkits;
 s=wait(s,10);stopped(s,10,2);assert.equal(record(s,3).hp,68);assert.equal(record(s,10).medkits,0);
 assert.ok(event(s,10,'no_medkits'));assert.ok(event(s,3,'no_doctor'));
 const stable=wait(s,2);assert.equal(stable.hour,4);assert.equal(stable.assignmentAttention.notice,null);assert.equal(record(stable,3).hp,68);
 const money=stable.resources.treasury;s=collectFiniteDressings(stable,10,1);
 assert.equal(s.resources.treasury,money);assert.equal(s.merchants.retiro.supplies.medkits,stock);
 s=wait(s,6);stopped(s,6,1,4);assert.equal(record(s,3).hp,74);assert.equal(record(s,10).medkits,0);
 assert.ok(event(s,10,'no_medkits'));assert.equal(record(s,10).assignment,'doctor');
});

test('repair supply exhaustion preserves an unfinished gun and never grants work on the stopping notice',()=>{
 let s=repairTeam({condition:40,tools:2});s=wait(s,7);stopped(s,7,1);
 assert.equal(record(s,4).condition,42);assert.equal(record(s,10).toolkitPoints,0);assert.ok(event(s,10,'no_tools'));
 const state=structuredClone(s.operativeState),resources=structuredClone(s.resources);
 s=wait(s,2);assert.equal(s.hour,3);assert.equal(s.assignmentAttention.notice,null);
 assert.deepEqual(s.operativeState,state);assert.deepEqual(s.resources,resources);
});

test('training stops on the earned growth cap or the absolute skill ceiling without another practice point',()=>{
 for(const [id,skill,earned] of [[3,'mechanical',9],[10,'medical',1]]){
  // Resume the same studied skill with credit already earned before this fixture.
  let s=initialCampaign();record(s,id).trainedStats={[skill]:earned};record(s,id).skillPractice={[skill]:39};record(s,id).trainingSkill=skill;record(s,id).trainingCredit=999;
  s=work(s,id,'practice',{skill});s=wait(s,8);stopped(s,8,1);
  assert.equal(record(s,id).trainedStats[skill],earned+1);assert.equal(event(s,id,'training_complete')?.skill,skill);
  assert.equal(record(s,id).assignment,'practice');assert.equal(record(s,id).energy,97);
  const unit=structuredClone(record(s,id));s=wait(s,3);assert.equal(s.hour,4);assert.equal(s.assignmentAttention.notice,null);assert.deepEqual(record(s,id),unit);
 }
});

test('an already blocked student stops before time or stock changes, then a productive pairing rearms later interruption',()=>{
 let s=care(studentTeam(),10,'active'),before=serializeCampaign(s);
 s=wait(s,5);stopped(s,5,0);assert.ok(event(s,3,'instructor_assignment'));
 const untouched=JSON.parse(before);assert.deepEqual(s.operativeState,untouched.operativeState);assert.deepEqual(s.resources,untouched.resources);
 assert.equal(record(s,3).assignment,'student');assert.equal(record(s,3).instructorId,10);
 s=wait(s,2);assert.equal(s.hour,2);assert.equal(s.assignmentAttention.notice,null);assert.equal(record(s,3).skillPractice?.mechanical??0,0);
 s=work(s,10,'instructor',{skill:'mechanical'});s=wait(s,1);assert.equal(s.hour,3);assert.equal(s.assignmentAttention.notice,null);assert.ok(record(s,3).skillPractice.mechanical>0);
 s=care(s,10,'active');s=wait(s,5);stopped(s,5,0,3);assert.ok(event(s,3,'instructor_assignment'));
});

test('an idle instructor emits once until reassigned, with no free energy, skill or stock',()=>{
 let s=work(initialCampaign(),10,'instructor',{skill:'mechanical'}),before=structuredClone(s);
 s=wait(s,6);stopped(s,6,0);assert.ok(event(s,10,'no_students'));assert.deepEqual(s.operativeState,before.operativeState);assert.deepEqual(s.resources,before.resources);
 const reported=structuredClone(s.assignmentAttention.reported);s=wait(s,2);assert.equal(s.hour,2);assert.equal(s.assignmentAttention.notice,null);assert.deepEqual(s.assignmentAttention.reported,reported);
 s=care(s,10,'active');s=work(s,10,'instructor',{skill:'mechanical'});s=wait(s,6);stopped(s,6,0,2);assert.ok(event(s,10,'no_students'));
});

test('unattended patients and critical rest stop before recovery, while a deliberate repeat can still recover energy',()=>{
 for(const [assignment,code] of [['patient','no_doctor'],['rest','critical']]){
  let s=initialCampaign();wound(s,3,assignment==='rest'?88:20,{energy:20,fatigue:60});s=care(s,3,assignment);
  const before=structuredClone(record(s,3));s=wait(s,4);stopped(s,4,0);assert.ok(event(s,3,code));assert.deepEqual(record(s,3),before);
  s=wait(s,2);assert.equal(s.hour,2);assert.equal(s.assignmentAttention.notice,null);assert.equal(record(s,3).hp,before.hp);assert.equal(record(s,3).energy,assignment==='rest'?36:44);assert.equal(record(s,3).assignment,assignment);
 }
});

test('rest stops when the last hour restores energy and fatigue without granting health or AP',()=>{
 let s=initialCampaign();Object.assign(record(s,3),{energy:76,fatigue:16});s=care(s,3,'rest');const hp=record(s,3).hp;
 s=wait(s,8);stopped(s,8,2);assert.ok(event(s,3,'rest_complete'));assert.equal(record(s,3).hp,hp);assert.equal(record(s,3).energy,100);assert.equal(record(s,3).fatigue,0);assert.equal(record(s,3).assignment,'rest');
 s=wait(s,2);assert.equal(s.hour,4);assert.equal(s.assignmentAttention.notice,null);assert.equal(record(s,3).energy,100);assert.equal(record(s,3).hp,hp);
});

test('patients waiting their turn behind a treatable wound do not generate a false missing-doctor stop',()=>{
 let s=medicalTeam(6,{kits:3});wound(s,4,12);s=care(s,4,'patient');
 s=wait(s,1);assert.equal(s.hour,1);assert.equal(s.assignmentAttention.notice,null);assert.equal(record(s,4).hp,78);assert.equal(record(s,3).hp,90);
 s=wait(s,5);stopped(s,5,1,1);assert.ok(event(s,4,'healing_complete'));assert.ok(!events(s).some(e=>e.code==='no_doctor'||e.code==='no_patients'));assert.equal(record(s,3).hp,90);
 s=wait(s,5);stopped(s,5,1,2);assert.ok(event(s,3,'healing_complete'));assert.equal(record(s,10).medkits,0);assert.equal(record(s,3).hp,96);assert.equal(record(s,4).hp,84);
});

test('same-hour completion takes precedence over the final kit or tool being exhausted',()=>{
 let s=wait(medicalTeam(6,{kits:1}),4);stopped(s,4,1);assert.ok(event(s,3,'healing_complete'));assert.ok(event(s,10,'no_patients'));assert.ok(!events(s).some(e=>e.code==='no_medkits'));
 s=wait(repairTeam({condition:98,tools:2}),4);stopped(s,4,1);assert.ok(event(s,10,'repair_complete'));assert.ok(!event(s,10,'no_tools'));assert.equal(record(s,10).toolkitPoints,0);
});

test('the complete stopping hour groups independent completions and charges every worker once',()=>{
 let s=medicalTeam();record(s,4).condition=97;record(s,4).toolkitPoints=10;s=work(s,4,'repair',{targetId:4});
 s=wait(s,10);stopped(s,10,1);assert.deepEqual(events(s).map(e=>e.operativeId).sort((a,b)=>a-b),[3,4,10]);
 assert.ok(event(s,3,'healing_complete'));assert.ok(event(s,4,'repair_complete'));assert.ok(event(s,10,'no_patients'));
 assert.equal(record(s,4).condition,100);assert.equal(record(s,4).toolkitPoints,7);assert.equal(record(s,4).energy,97);assert.equal(record(s,10).energy,97);assert.equal(record(s,10).medkits,1);
});

test('a paid militia course stops on its actual completion and never recruits the cohort twice',()=>{
 let s=order(initialCampaign(),{type:'militia',rank:0,trainerId:4}),duration=s.militiaTraining[0].duration,muskets=s.resources.muskets;
 s=wait(s,duration+6);stopped(s,duration+6,duration);assert.equal(s.militiaTraining.length,0);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);assert.equal(s.resources.muskets,muskets);
 const done=event(s,4,'militia_complete');assert.equal(done?.subject,'militia:retiro');assert.equal(done?.sector,'retiro');assert.equal(done?.state,'complete');
 s=wait(s,3);assert.equal(s.hour,duration+3);assert.equal(s.assignmentAttention.notice,null);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);
 s=order(s,{type:'setSleep',operativeId:4,asleep:true});s=wait(s,24);assert.ok(event(s,4,'sleep_complete'));s=order(s,{type:'militia',rank:0,trainerId:4});const start=s.hour;s=wait(s,duration+4);stopped(s,duration+4,duration,start);assert.deepEqual(s.sectors.retiro.militia,[6,0,0]);assert.ok(event(s,4,'militia_complete'));
});

test('attention notices and reported markers replay exactly across saves before and after a stop',()=>{
 const before=medicalTeam(),decoded=decodeSave(encodeSave(before)).campaign;
 assert.deepEqual(decoded,before);const first=wait(before,10);assert.deepEqual(wait(decoded,10),first);
 const saved=serializeCampaign(first),loaded=restoreCampaign(saved);assert.deepEqual(loaded,first);assert.deepEqual(decodeSave(encodeSave(first)).campaign,first);
 const next=wait(first,3);assert.equal(next.assignmentAttention.notice,null);assert.deepEqual(wait(loaded,3),next);assert.equal(serializeCampaign(first),saved);
 const reassigned=care(care(first,3,'active'),10,'active');assert.deepEqual(reassigned.assignmentAttention.notice,first.assignmentAttention.notice);assert.deepEqual(restoreCampaign(serializeCampaign(reassigned)),reassigned);
});

test('the public campaign projection exposes a detached notice without internal bindings or reported markers',()=>{
 assert.equal(playerKnownCampaign(initialCampaign()).assignmentNotice,null);
 const s=wait(medicalTeam(),8),before=serializeCampaign(s),known=playerKnownCampaign(s),notice=known.assignmentNotice;
 assert.ok(notice);assert.equal(notice.hour,1);assert.equal(notice.requestedHours,8);assert.equal(notice.advancedHours,1);
 assert.ok(notice.events.some(e=>e.operativeId===3&&e.code==='healing_complete'));
 assert.ok(!Object.hasOwn(known,'assignmentAttention'));assert.ok(!Object.hasOwn(notice,'reported'));
 assert.ok(notice.events.every(e=>!Object.hasOwn(e,'binding')));
 notice.events[0].code='changed-by-view';notice.events.push({code:'view-only'});notice.hour=99;
 assert.equal(serializeCampaign(s),before);
});

test('old saves migrate attention without acknowledging assignments, and malformed metadata is rejected',()=>{
 const old=care(initialCampaign(),10,'doctor');delete old.assignmentAttention;
 const loaded=restoreCampaign(serializeCampaign(old));assert.deepEqual(loaded.assignmentAttention,{version:1,reported:{},notice:null});assert.ok(event(wait(loaded,4),10,'no_patients'));
 const stoppedState=wait(medicalTeam(),6);
 const corruptions=[
  s=>s.assignmentAttention.version=2,
  s=>s.assignmentAttention.reported=[],
  s=>s.assignmentAttention.notice=[],
  s=>s.assignmentAttention.notice.hour=s.hour+1,
  s=>s.assignmentAttention.notice.requestedHours=0,
  s=>s.assignmentAttention.notice.requestedHours=241,
  s=>s.assignmentAttention.notice.advancedHours=7,
  s=>s.assignmentAttention.notice.events=[],
  s=>s.assignmentAttention.notice.events.push({...s.assignmentAttention.notice.events[0]}),
  s=>s.assignmentAttention.notice.events[0].code='free_supplies',
  s=>s.assignmentAttention.notice.events[0].state='productive',
  s=>s.assignmentAttention.notice.events[0].operativeId=999999,
  s=>s.assignmentAttention.notice.events[0].sector='unknown',
  s=>s.assignmentAttention.notice.events[0].binding={},
  s=>s.assignmentAttention.reported['operative:999999']={binding:'[]',code:'no_patients'},
 ];
 for(const corrupt of corruptions){const candidate=structuredClone(stoppedState);corrupt(candidate);assert.throws(()=>restoreCampaign(serializeCampaign(candidate)),corrupt.toString());}
});

test('travel completes the full route when a remote assignment completes and emits no assignment notice',()=>{
 let s=medicalTeam();s=order(s,{type:'createSquad',ids:[4],name:'Marcha'});
 const ordinary=order(order(initialCampaign(),{type:'createSquad',ids:[4],name:'Marcha'}),{type:'travel',sector:'ensenada'});
 s=order(s,{type:'travel',sector:'ensenada'});assert.equal(s.hour,ordinary.hour);assert.equal(s.location,'ensenada');
 assert.equal(record(s,3).hp,96);assert.equal(record(s,10).medkits,1);assert.equal(s.assignmentAttention.notice,null);
 s=wait(s,5);stopped(s,5,0,ordinary.hour);assert.ok(event(s,3,'healing_complete'));
});

test('tactical synchronization advances all remote working hours without an assignment stop or a free duplicate tick',()=>{
 let s=order(initialCampaign(),{type:'createSquad',ids:[4],name:'Exploradores'});s=order(s,{type:'travel',sector:'ensenada'});
 wound(s,3,12);s=care(s,10,'doctor');s=care(s,3,'patient');s=order(s,{type:'visitSector'});const start=s.hour,id=s.pendingBattle.id;
 s=order(s,{type:'syncTacticalTime',battleId:id,elapsedSeconds:6*3600+17});assert.equal(s.hour,start+6);assert.equal(s.secondOfHour,17);assert.equal(s.pendingBattle.syncedSeconds,6*3600+17);
 assert.equal(record(s,3).hp,96);assert.equal(record(s,10).medkits,0);assert.equal(s.assignmentAttention.notice,null);
 const before=serializeCampaign(s);s=order(s,{type:'syncTacticalTime',battleId:id,elapsedSeconds:6*3600+17});assert.equal(serializeCampaign(s),before);
});

test('an enemy encounter keeps priority over assignment attention and rejects another wait atomically',()=>{
 let s=initialCampaign();launchEnemyGroup(s,'coast','retiro');s=wait(s,7);assert.equal(s.pendingEncounter,null);
 wound(s,3,6);s=care(s,10,'doctor');s=care(s,3,'patient');s=wait(s,6);assert.equal(s.hour,8);assert.equal(s.pendingEncounter?.sector,'retiro');assert.equal(record(s,3).hp,96);
 const before=serializeCampaign(s),rejected=dispatchCampaign(s,{type:'wait',hours:1});assert.match(rejected.lastError,/encuentro/);assert.deepEqual({...rejected,lastError:null},JSON.parse(before));
});
