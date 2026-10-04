import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rosterFor,isSupplied} from '../game/campaign.js';
import {baseMorale,advanceMorale} from '../game/morale.js';
import {assignMedicalCare,advanceMedicalCare,careAssignmentIssue,careAssignmentReason} from '../game/medical-care.js';
import {assignWork,advanceAssignments,workAssignmentIssue,workAssignmentReason,militiaAssignmentIssue} from '../game/assignments.js';
import {assignmentStates,migrateAssignmentAttention,validateAssignmentAttention,collectAssignmentAttention,reconcileAssignmentAttention,militiaCompletionAttention,militiaCancellationAttention,assignmentAttentionText,publicAssignmentNotice} from '../game/assignment-attention.js';

const roster=s=>rosterFor(s);
const op=(s,id)=>roster(s).find(o=>o.id===id);
const states=(s,context={})=>assignmentStates(s,roster(s),{isSupplied,...context});
const stateFor=(s,id,context={})=>states(s,context).find(state=>state.subject===`operative:${id}`);
const care=(s,id,assignment)=>{assignMedicalCare(s,op(s,id),assignment);return s;};
const work=(s,id,assignment,options={})=>{assignWork(s,op(s,id),{assignment,...options},roster(s));return s;};
const wound=(s,id,hp)=>{Object.assign(s.operativeState[id],{hp,bandaged:s.operativeState[id].maxHp-hp});return s;};
const medical=()=>care(care(wound(initialCampaign(),3,30),10,'doctor'),3,'patient');
const repair=()=>{const s=initialCampaign();s.operativeState[4].condition=99;s.operativeState[10].toolkitPoints=1;return work(s,10,'repair',{targetId:4});};
const course=()=>({sector:'retiro',trainerId:10,rank:0,started:0,duration:24,remaining:1,count:3});
function notice(s,events,extra={}){s.assignmentAttention.notice={hour:s.hour,requestedHours:24,advancedHours:0,events,...extra};return s;}
const emit=s=>collectAssignmentAttention(s,states(s));

test('typed eligibility retains the existing exact admission reasons and successful empty strings',()=>{
  let s=initialCampaign();
  assert.equal(careAssignmentIssue(s,op(s,10),'doctor'),null);
  assert.equal(careAssignmentReason(s,op(s,10),'doctor'),'');
  s.operativeState[10].medkits=0;
  assert.deepEqual(careAssignmentIssue(s,op(s,10),'doctor'),{code:'no_medkits',reason:'El médico no tiene vendas.'});
  assert.equal(careAssignmentReason(s,op(s,10),'doctor'),'El médico no tiene vendas.');
  s=repair();s.operativeState[10].toolkitPoints=0;
  assert.deepEqual(workAssignmentIssue(s,op(s,10),'repair',{targetId:4},roster(s)),{code:'no_tools',reason:'No quedan puntos de herramientas.'});
  assert.equal(workAssignmentReason(s,op(s,10),'repair',{targetId:4},roster(s)),'No quedan puntos de herramientas.');
  s=initialCampaign();assert.equal(workAssignmentReason(s,op(s,3),'practice',{skill:'mechanical'},roster(s)),'');
  assert.equal(workAssignmentIssue(s,op(s,3),'practice',{skill:'stealth'},roster(s)).code,'zero_skill');
});

test('status reads are deterministic, omit active/dead/unhired staff and do not perform work',()=>{
  const s=care(work(initialCampaign(),3,'practice',{skill:'mechanical'}),10,'rest');
  s.operativeState[4].assignment='rest';s.operativeState[4].alive=false;s.operativeState[4].hp=0;
  const before=structuredClone(s),a=states(s),b=assignmentStates(s,[...roster(s)].reverse(),{isSupplied});
  assert.deepEqual(a,b);assert.deepEqual(s,before);
  assert.deepEqual(a.map(v=>v.subject),['operative:10','operative:3']);
  assert.equal(stateFor(s,3).state,'working');assert.equal(stateFor(s,10).code,'rest_complete');
  assert.equal(stateFor(s,3,{traveling:[3]}).state,'waiting');
  assert.equal(stateFor(s,3,{traveling:[3],unsafe:[3]}).code,'unsafe');
});

test('patient queues remain nonterminal and the last successful kit reports completed care before shortage',()=>{
  const s=medical();wound(s,4,20);care(s,4,'patient');
  assert.equal(stateFor(s,3).state,'waiting');assert.equal(stateFor(s,4).state,'waiting');assert.deepEqual(emit(s),[]);
  const r=s.operativeState[3];r.hp=r.maxHp-1;r.bandaged=1;care(s,4,'active');s.operativeState[10].medkits=1;
  const hp=r.hp;advanceMedicalCare(s,roster(s));
  assert.equal(r.hp,hp+1);assert.equal(s.operativeState[10].medkits,0);
  const events=emit(s);
  assert.equal(events.find(e=>e.operativeId===3).code,'healing_complete');
  assert.equal(events.find(e=>e.operativeId===10).code,'no_patients');
  assert.ok(!events.some(e=>e.code==='no_medkits'));assert.deepEqual(emit(s),[]);
});

test('medical shortages, no doctor, idle staff and critical rest use distinct stable codes',()=>{
  const s=medical();s.operativeState[10].medkits=0;
  assert.equal(stateFor(s,10).code,'no_medkits');assert.equal(stateFor(s,3).code,'no_doctor');
  s.operativeState[10].medkits=2;s.operativeState[10].energy=10;assert.equal(stateFor(s,10).code,'unstable');
  care(s,3,'rest');s.operativeState[3].hp=8;s.operativeState[3].bandaged=s.operativeState[3].maxHp-8;
  assert.equal(stateFor(s,3).code,'critical');s.operativeState[3].bleeding=2;assert.equal(stateFor(s,3).code,'bleeding');
  s.operativeState[10].energy=100;assert.equal(stateFor(s,10).code,'no_patients');
});

test('repair completing on the final tool point wins over empty tools and exhausted staff without changing work costs',()=>{
  const s=repair();s.operativeState[10].energy=11;
  assert.equal(stateFor(s,10).state,'working');advanceAssignments(s,roster(s));
  assert.equal(s.operativeState[4].condition,100);assert.equal(s.operativeState[10].toolkitPoints,0);assert.equal(s.operativeState[10].energy,8);
  assert.equal(workAssignmentIssue(s,op(s,10),'repair',{targetId:4},roster(s)).code,'unstable','legacy admission keeps its original check order');
  assert.equal(stateFor(s,10).state,'complete');assert.equal(stateFor(s,10).code,'repair_complete');
  const before=structuredClone(s.operativeState);advanceAssignments(s,roster(s));assert.deepEqual(s.operativeState,before);
});

test('indefinite study is productive after an ordinary gain and completes only at the cap',()=>{
  const s=work(initialCampaign(),3,'practice',{skill:'mechanical'}),r=s.operativeState[3];
  r.skillPractice={mechanical:39};r.trainingCredit=999;
  advanceAssignments(s,roster(s));assert.equal(r.trainedStats.mechanical,1);assert.equal(stateFor(s,3).state,'working');assert.deepEqual(emit(s),[]);
  r.trainedStats.mechanical=9;r.skillPractice.mechanical=39;r.trainingCredit=999;
  advanceAssignments(s,roster(s));assert.equal(r.trainedStats.mechanical,10);assert.equal(stateFor(s,3).code,'training_complete');
  assert.equal(emit(s).length,1);
});

test('teacher and student status reuses pairing checks and reports idle or separated instruction',()=>{
  const s=work(initialCampaign(),10,'instructor',{skill:'mechanical'});
  assert.equal(stateFor(s,10).code,'no_students');
  work(s,3,'student',{skill:'mechanical',instructorId:10});assert.equal(stateFor(s,10).state,'working');assert.equal(stateFor(s,3).state,'working');
  assert.equal(stateFor(s,3,{traveling:[10]}).state,'waiting');
  assert.equal(stateFor(s,3,{unsafe:[10]}).code,'instructor_unavailable');
  care(s,10,'rest');assert.equal(stateFor(s,3).code,'instructor_assignment');
});

test('rest completes only when its health, energy and fatigue work is finished',()=>{
  const s=care(initialCampaign(),3,'rest'),r=s.operativeState[3];
  assert.equal(stateFor(s,3).code,'rest_complete');r.energy=88;assert.equal(stateFor(s,3).state,'working');
  advanceMedicalCare(s,roster(s));assert.equal(stateFor(s,3).code,'rest_complete');
  r.hp--;r.bandaged=1;assert.equal(stateFor(s,3).state,'working','rest still provides slow health recovery');
});

test('full health and energy do not finish rest while its existing morale recovery remains productive',()=>{
  const s=care(initialCampaign(),3,'rest'),r=s.operativeState[3],normal=baseMorale(op(s,3));
  r.morale=20;assert.equal(stateFor(s,3).state,'working');assert.deepEqual(emit(s),[]);
  r.morale=normal-1;r.moraleRestHours=5;
  const before={hp:r.hp,energy:r.energy,fatigue:r.fatigue,medkits:r.medkits};
  advanceMorale(s,roster(s));assert.equal(r.morale,normal);assert.equal(r.moraleRestHours,0);
  assert.equal(stateFor(s,3).code,'rest_complete');assert.equal(emit(s)[0].code,'rest_complete');
  assert.deepEqual({hp:r.hp,energy:r.energy,fatigue:r.fatigue,medkits:r.medkits},before);
});

test('notice collection touches only reported markers and permits deliberate repeated waits until a condition rearms',()=>{
  const s=medical();s.operativeState[10].medkits=0;
  const before=structuredClone(s),first=emit(s);assert.equal(first.length,2);
  const after=structuredClone(s);delete before.assignmentAttention;delete after.assignmentAttention;assert.deepEqual(after,before);
  notice(s,first);const shown=structuredClone(s.assignmentAttention.notice);
  assert.deepEqual(emit(s),[]);assert.deepEqual(s.assignmentAttention.notice,shown,'only root replaces the notice');
  s.operativeState[10].medkits=2;reconcileAssignmentAttention(s,states(s));assert.deepEqual(s.assignmentAttention.reported,{});assert.deepEqual(s.assignmentAttention.notice,shown);
  s.operativeState[10].medkits=0;assert.deepEqual(emit(s),first);
  care(s,3,'active');care(s,10,'active');reconcileAssignmentAttention(s,states(s));assert.deepEqual(s.assignmentAttention.reported,{});
});

test('changed task binding or terminal code rearms once without requiring a productive hour',()=>{
  const s=repair();s.operativeState[10].toolkitPoints=0;
  let first=emit(s);assert.equal(first[0].code,'no_tools');
  s.operativeState[10].energy=10;reconcileAssignmentAttention(s,states(s));assert.deepEqual(s.assignmentAttention.reported,{});
  assert.equal(emit(s)[0].code,'unstable');assert.deepEqual(emit(s),[]);
  s.operativeState[10].repairTargetId=3;s.operativeState[10].repairWeaponId=op(s,3).weapon;
  assert.notEqual(stateFor(s,10).binding,first[0].binding);assert.equal(emit(s).length,1);assert.deepEqual(emit(s),[]);
});

test('militia status shares the hourly checks and exact removed-course events are deterministic',()=>{
  const s=initialCampaign(),c=course();s.militiaTraining=[c];
  assert.equal(militiaAssignmentIssue(s,c,{isSupplied}),null);
  assert.equal(states(s).find(v=>v.assignment==='militia').state,'working');
  assert.equal(assignmentStates(s,roster(s),{isSupplied:()=>false})[0].state,'working');
  assert.equal(militiaAssignmentIssue(s,c),null);
  s.sectors.retiro.loyalty=0;assert.equal(militiaAssignmentIssue(s,c,{isSupplied}).code,'militia_loyalty');
  s.sectors.retiro.owner='royalist';assert.equal(militiaAssignmentIssue(s,c,{isSupplied}).code,'militia_cancelled');
  s.militiaTraining=[];const cancelled=militiaCancellationAttention(c),complete=militiaCompletionAttention(c);
  assert.equal(collectAssignmentAttention(s,[],[complete])[0].code,'militia_complete');assert.deepEqual(collectAssignmentAttention(s,[],[complete]),[]);
  assert.equal(collectAssignmentAttention(s,[],[cancelled])[0].code,'militia_cancelled');
  assert.equal(complete.state,'complete');assert.equal(cancelled.state,'blocked');assert.equal(complete.binding,cancelled.binding);
});

test('migration and validation preserve historical notices and JSON replay without reconciling markers',()=>{
  const s=medical();delete s.assignmentAttention;const original=structuredClone(s);
  migrateAssignmentAttention(s);assert.deepEqual(s.assignmentAttention,{version:1,reported:{},notice:null});
  const migrated=structuredClone(s);migrateAssignmentAttention(s);assert.deepEqual(s,migrated);delete migrated.assignmentAttention;assert.deepEqual(migrated,original);
  s.operativeState[10].medkits=0;const events=emit(s);notice(s,events);care(s,3,'active');care(s,10,'active');
  const before=structuredClone(s);assert.doesNotThrow(()=>validateAssignmentAttention(s,roster(s)));assert.deepEqual(s,before,'historical state is not reconciled during save validation');
  const resumed=JSON.parse(JSON.stringify(s));validateAssignmentAttention(resumed,roster(resumed));
  assert.deepEqual(collectAssignmentAttention(resumed,states(resumed)),collectAssignmentAttention(s,states(s)));assert.deepEqual(resumed,s);
});

test('old militia supply notices remain valid while the ongoing course resumes without a supply rule',()=>{
  const s=initialCampaign(),c=course();s.militiaTraining=[c];
  const event={...assignmentStates(s,roster(s))[0],state:'blocked',code:'militia_supply'};
  const events=collectAssignmentAttention(s,[],[event]);notice(s,events);
  const restored=JSON.parse(JSON.stringify(s));validateAssignmentAttention(restored,roster(restored));
  assert.deepEqual(restored.assignmentAttention,s.assignmentAttention);
  assert.match(assignmentAttentionText(restored,events[0],roster(restored)),/abastecimiento/);
  assert.equal(assignmentStates(restored,roster(restored))[0].state,'working');
  assert.deepEqual(collectAssignmentAttention(restored,assignmentStates(restored,roster(restored))),[]);
  assert.deepEqual(restored.assignmentAttention.reported,{});
});

test('strict notice validation rejects malformed, mismatched and unbounded data without normalizing it',()=>{
  const good=medical();good.operativeState[10].medkits=0;notice(good,emit(good));
  const corruptions=[
    s=>s.assignmentAttention=null,s=>s.assignmentAttention.version=2,s=>s.assignmentAttention.extra=true,s=>s.assignmentAttention.reported=[],
    s=>s.assignmentAttention.reported['operative:10'].extra=true,s=>s.assignmentAttention.reported['operative:10'].code='invented',
    s=>s.assignmentAttention.reported['operative:10'].binding='oops',s=>s.assignmentAttention.reported['operative:10'].binding='x'.repeat(301),
    s=>s.assignmentAttention.reported['operative:10'].binding=JSON.stringify([['doctor'],10,'retiro',null,null,null,null]),
    s=>s.assignmentAttention.reported['constructor']={binding:good.assignmentAttention.reported['operative:10'].binding,code:'no_medkits'},
    s=>s.assignmentAttention.notice.hour=s.hour+1,s=>s.assignmentAttention.notice.requestedHours=0,s=>s.assignmentAttention.notice.requestedHours=241,
    s=>s.assignmentAttention.notice.advancedHours=1,s=>s.assignmentAttention.notice.events=[],s=>s.assignmentAttention.notice.events.push(s.assignmentAttention.notice.events[0]),
    s=>s.assignmentAttention.notice.events[0].state='working',s=>s.assignmentAttention.notice.events[0].operativeId=999999,s=>s.assignmentAttention.notice.events[0].sector='unknown',
    s=>s.assignmentAttention.notice.events[0].targetId=3,s=>s.assignmentAttention.notice.events[0].code='repair_complete',s=>s.assignmentAttention.notice.events[0].extra='hidden',
  ];
  for(const corrupt of corruptions){const bad=structuredClone(good);corrupt(bad);const before=structuredClone(bad);assert.throws(()=>validateAssignmentAttention(bad,roster(bad)));assert.deepEqual(bad,before);}
});

test('public notices omit internal bindings and marker state while Spanish prose identifies person, work and sector',()=>{
  const s=repair();advanceAssignments(s,roster(s));notice(s,emit(s));
  const publicNotice=publicAssignmentNotice(s),event=publicNotice.events[0];
  assert.equal(event.code,'repair_complete');assert.equal(event.state,'complete');assert.equal(Object.hasOwn(event,'binding'),false);assert.equal(Object.hasOwn(publicNotice,'reported'),false);
  const sentence=assignmentAttentionText(s,event,roster(s));assert.match(sentence,/Reparación/);assert.match(sentence,/Retiro/);assert.ok(sentence.includes(op(s,10).nickname));assert.match(sentence,/perfecto estado/);
  publicNotice.events[0].code='changed';assert.equal(s.assignmentAttention.notice.events[0].code,'repair_complete');assert.equal(publicAssignmentNotice(initialCampaign()),null);
});
