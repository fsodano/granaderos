// A07 assignment attention only. These helpers never advance time or perform work.
import {SLEEP_ISSUE_TEXT} from './sleep.js';
import {CAMPAIGN_SECTORS,WEAPONS} from './data.js';
import {operativeLocation} from './squads.js';
import {TRAINABLE_SKILLS} from './skill-training.js';
import {CARE_ASSIGNMENTS,CARE_ISSUE_TEXT,careAssignmentProgress} from './medical-care.js';
import {WORK_ASSIGNMENTS,WORK_ISSUE_TEXT,workAssignmentProgress,militiaAssignmentIssue} from './assignments.js';

const assignments={...CARE_ASSIGNMENTS,...WORK_ASSIGNMENTS,militia:'Instrucción de milicias',sleep:'Sueño'};
const completeCodes=new Set(['healing_complete','repair_complete','training_complete','rest_complete','militia_complete','sleep_complete']);
const codes=new Set([...Object.keys(CARE_ISSUE_TEXT),...Object.keys(WORK_ISSUE_TEXT),...Object.keys(SLEEP_ISSUE_TEXT)]);
const sectors=new Set(CAMPAIGN_SECTORS.map(sector=>sector.id));
const training=new Set(['practice','instructor','student']);
const terminal=event=>event.state==='complete'||event.state==='blocked';
const eventKeys=['subject','assignment','operativeId','sector','state','code','targetId','skill','binding'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const need=(condition,message='Los avisos de asignaciones guardados son inválidos.')=>{if(!condition)throw Error(message);};
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const order=(a,b)=>a.subject.localeCompare(b.subject)||a.binding.localeCompare(b.binding)||String(a.code).localeCompare(String(b.code));

function operativeState(s,op,roster,context){
  const r=s.operativeState[op.id],assignment=r.assignment,sector=operativeLocation(s,op.id);
  const targetId=assignment==='repair'?r.repairTargetId:assignment==='student'?r.instructorId:null;
  const skill=training.has(assignment)?r.trainingSkill:null;
  const binding=JSON.stringify([assignment,op.id,sector,targetId??null,skill??null,assignment==='student'?r.instructorId:null,assignment==='repair'?(r.repairScope??r.repairWeaponId):null]);
  const progress=Object.hasOwn(WORK_ASSIGNMENTS,assignment)?workAssignmentProgress(s,op,roster,context):careAssignmentProgress(s,op,roster,context);
  return {subject:`operative:${op.id}`,assignment,operativeId:op.id,sector,...progress,targetId:targetId??null,skill:skill??null,binding};
}
function militiaState(course,state,code){
  return {subject:`militia:${course.sector}`,assignment:'militia',operativeId:course.trainerId??null,sector:course.sector,state,code,targetId:null,skill:null,binding:JSON.stringify(['militia',course.trainerId??null,course.sector,course.rank,course.started,course.duration,course.count])};
}
export const sleepAttention=(s,event)=>({subject:`sleep:${event.id}`,assignment:'sleep',operativeId:event.id,sector:operativeLocation(s,event.id),state:event.code==='sleep_complete'?'complete':'blocked',code:event.code,targetId:null,skill:null,binding:JSON.stringify(['sleep',event.id,operativeLocation(s,event.id),null,null,null,null])});
export const militiaCompletionAttention=course=>militiaState(course,'complete','militia_complete');
export const militiaCancellationAttention=course=>militiaState(course,'blocked','militia_cancelled');

export function assignmentStates(s,roster,context={}){
  const states=roster.filter(op=>s.recruited.includes(op.id)&&s.operativeState[op.id]?.alive&&s.operativeState[op.id].assignment!=='active'&&Object.hasOwn(assignments,s.operativeState[op.id].assignment)).map(op=>operativeState(s,op,roster,context));
  for(const course of s.militiaTraining??[]){
    const issue=militiaAssignmentIssue(s,course,context);
    states.push(militiaState(course,issue?.code==='sleeping'?'waiting':issue?'blocked':'working',issue?.code??null));
  }
  return states.sort(order);
}

export function migrateAssignmentAttention(s){
  if(s.assignmentAttention===undefined)s.assignmentAttention={version:1,reported:{},notice:null};
  return s;
}
export function reconcileAssignmentAttention(s,states){
  migrateAssignmentAttention(s);
  const current=new Map(states.map(event=>[event.subject,event]));
  for(const [subject,marker]of Object.entries(s.assignmentAttention.reported)){
    const state=current.get(subject);
    if(!state||!terminal(state)||state.binding!==marker.binding||state.code!==marker.code)delete s.assignmentAttention.reported[subject];
  }
  return s;
}
export function collectAssignmentAttention(s,states,extraEvents=[]){
  const current=[...states,...extraEvents],bySubject=new Map();
  // Exact course-removal events supersede any pre-removal course observation.
  for(const event of current)bySubject.set(event.subject,event);
  reconcileAssignmentAttention(s,[...bySubject.values()]);
  const events=[];
  for(const event of [...bySubject.values()].sort(order)){
    if(!terminal(event))continue;
    const previous=s.assignmentAttention.reported[event.subject];
    if(previous?.binding===event.binding&&previous.code===event.code)continue;
    s.assignmentAttention.reported[event.subject]={binding:event.binding,code:event.code};
    events.push(Object.fromEntries(eventKeys.map(key=>[key,event[key]])));
  }
  return events;
}

function bindingData(binding,ids){
  need(typeof binding==='string'&&binding.length<=300);
  let values;try{values=JSON.parse(binding);}catch{need(false);}
  need(Array.isArray(values)&&values.length===7&&JSON.stringify(values)===binding);
  const [assignment,id,sector,target,skill,instructor,weapon]=values;
  need(typeof assignment==='string'&&Object.hasOwn(assignments,assignment)&&assignment!=='active'&&(ids.has(id)||assignment==='militia'&&id===null)&&sectors.has(sector));
  if(assignment==='militia'){
    need(integer(target,0,2)&&integer(skill,0,24*365*100)&&integer(instructor,1,96)&&weapon===3);
  }else{
    need(target===null||ids.has(target));
    need(training.has(assignment)?TRAINABLE_SKILLS.includes(skill):skill===null);
    need(assignment==='student'?ids.has(instructor)&&instructor!==id&&target===instructor:instructor===null);
    need(assignment==='repair'?target!==null&&(weapon==='equipment'||integer(weapon,0,65535)&&(WEAPONS[weapon]?.capacity??0)>0):weapon===null);
    if(!['repair','student'].includes(assignment))need(target===null);
  }
  return values;
}
const common=new Set(['unavailable','deployed','militia_busy','unsafe','unstable','sleeping','invalid_assignment']);
function compatibleCode(assignment,code){
  if(assignment==='sleep')return Object.hasOwn(SLEEP_ISSUE_TEXT,code);
  if(assignment==='militia')return ['sleeping','unstable'].includes(code)||code.startsWith('militia_')&&code!=='militia_busy';
  if(common.has(code))return true;
  if(Object.hasOwn(CARE_ASSIGNMENTS,assignment))return ({doctor:['no_medical_skill','no_medkits','no_patients'],patient:['healing_complete','no_doctor'],rest:['rest_complete','bleeding','critical']})[assignment]?.includes(code);
  if(assignment==='repair')return ['invalid_repair_scope','repair_pack_full','repair_complete','no_mechanical_skill','no_tools','target_unavailable','target_not_firearm','target_changed'].includes(code);
  return ['invalid_skill','zero_skill','training_complete',...(assignment==='instructor'?['no_students']:[]),...(assignment==='student'?['missing_instructor','instructor_unavailable','instructor_assignment','instructor_skill','instructor_busy']:[])].includes(code)&&!(assignment==='instructor'&&code==='training_complete');
}
function validateBindingCode(subject,binding,code,ids,hour){
  const values=bindingData(binding,ids),[assignment,id,sector]=values;
  need(subject===(assignment==='militia'?`militia:${sector}`:assignment==='sleep'?`sleep:${id}`:`operative:${id}`)&&codes.has(code)&&compatibleCode(assignment,code));
  if(assignment==='militia')need(values[4]<=hour);
  return values;
}
export function validateAssignmentAttention(s,roster){
  migrateAssignmentAttention(s);
  const attention=s.assignmentAttention,ids=new Set(roster.map(op=>op.id)),limit=ids.size*2+sectors.size;
  need(exact(attention,['version','reported','notice'])&&attention.version===1&&object(attention.reported)&&Object.keys(attention.reported).length<=limit);
  for(const [subject,marker]of Object.entries(attention.reported)){
    need(exact(marker,['binding','code']));validateBindingCode(subject,marker.binding,marker.code,ids,s.hour);
  }
  const notice=attention.notice;
  if(notice!==null){
    need(exact(notice,['hour','requestedHours','advancedHours','events'])&&integer(notice.hour,0,s.hour)&&integer(notice.requestedHours,1,240)&&integer(notice.advancedHours,0,notice.requestedHours)&&notice.advancedHours<=notice.hour&&Array.isArray(notice.events)&&notice.events.length>0&&notice.events.length<=limit);
    const subjects=new Set();
    for(const event of notice.events){
      need(exact(event,eventKeys)&&!subjects.has(event.subject));subjects.add(event.subject);
      const [assignment,id,sector,target,skill]=validateBindingCode(event.subject,event.binding,event.code,ids,notice.hour);
      need(event.assignment===assignment&&event.operativeId===id&&event.sector===sector&&event.state===(completeCodes.has(event.code)?'complete':'blocked'));
      need(assignment==='militia'?event.targetId===null&&event.skill===null:event.targetId===target&&event.skill===skill);
    }
  }
  return s;
}

export function assignmentAttentionText(s,event,roster){
  const op=roster.find(op=>op.id===event.operativeId),name=op?.nickname??op?.name??'El personal';
  const place=CAMPAIGN_SECTORS.find(sector=>sector.id===event.sector)?.name??event.sector;
  const reasons=event.assignment==='sleep'?SLEEP_ISSUE_TEXT:Object.hasOwn(CARE_ASSIGNMENTS,event.assignment)?CARE_ISSUE_TEXT:WORK_ISSUE_TEXT;
  const reason=reasons[event.code]??'La asignación necesita atención.';
  return `${name} · ${assignments[event.assignment]??'Asignación'} en ${place}: ${reason}`;
}
export function publicAssignmentNotice(s){
  const notice=s.assignmentAttention?.notice;
  return notice?{hour:notice.hour,requestedHours:notice.requestedHours,advancedHours:notice.advancedHours,events:notice.events.map(event=>Object.fromEntries(eventKeys.filter(key=>key!=='binding').map(key=>[key,event[key]])))}:null;
}
