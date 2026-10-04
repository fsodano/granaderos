'use client';
import {useEffect,useRef,useState} from 'react';
import {contractQuote,contractStatus} from '../../game/contracts.js';
import {CARE_ASSIGNMENTS,careAssignmentReason} from '../../game/medical-care.js';
import {WORK_ASSIGNMENTS,STUDY_SKILLS,workAssignmentReason} from '../../game/assignments.js';
import {operativeLocation} from '../../game/squads.js';
import {mountForOperative,MATURITY_HOURS} from '../../game/horses.js';
import {strategicSquadAssignments} from '../../game/strategic-squad-assignments.js';
import {squadTravelStatus} from '../../game/squad-travel.js';
import {campaignPlace} from '../../game/world-cells.js';
import {travelTime} from '../lib/travel-time';
import ServiceRefusalNotice from './ServiceRefusalNotice';
import PreferredCompanionsSummary from './PreferredCompanionsSummary';
import {serviceObjectionReason} from '../../game/service-objections.js';
import ServiceObjectionNotice from './ServiceObjectionNotice';

function visibleControl(control:HTMLElement){
 if(!control.isConnected||control.closest('[hidden],[inert]'))return false;
 for(let parent:HTMLElement|null=control;parent;parent=parent.parentElement){
  const style=window.getComputedStyle(parent);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
  if(parent.tagName==='DETAILS'&&!parent.hasAttribute('open')&&!parent.querySelector(':scope > summary')?.contains(control))return false;
 }
 return true;
}

export default function StrategicPersonnelMenu({state:s,roster,id,kind,onClose,dispatch}:{state:any;roster:any[];id:number;kind:'assignment'|'contract'|'destination';onClose:()=>void;dispatch:(a:any)=>void}){
 const op=roster.find(o=>o.id===id),record=s.operativeState[id];
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLElement>('button')?.focus();
  return ()=>{
   if(previous&&previous.tabIndex>=0&&visibleControl(previous)&&!previous.matches(':disabled')){previous.focus();return;}
   const label=kind==='contract'?'Fin contrato:':kind==='destination'?'Destino:':'Asignación:';
   const person=Array.from(document.querySelectorAll<HTMLElement>(`[data-operative-id="${id}"] button`)).find(control=>control.getAttribute('aria-label')?.startsWith(label)&&visibleControl(control)&&!control.matches(':disabled'));
   const roster=Array.from(document.querySelectorAll<HTMLElement>('.strategy-roster-open')).find(visibleControl);
   (person??roster)?.focus();
  };
 },[id,kind]);
 const [skill,setSkill]=useState('marksmanship'),[target,setTarget]=useState(String(id)),[teacher,setTeacher]=useState('');
 const [squadMenu,setSquadMenu]=useState(false);
 const blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated),contract=contractStatus(s,id);
 const contractRefusal=kind==='contract'?contractQuote(s,op,'day').serviceRefusal:null;
 const local=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&operativeLocation(s,o.id)===operativeLocation(s,id));
 const order=(action:any)=>{dispatch(action);onClose();};
 const options={skill,targetId:Number(target),instructorId:teacher?Number(teacher):undefined,repairScope:'equipment'};
 const mount=mountForOperative(s.horseState,id)?.mount;
 const squad=s.squads.find((q:any)=>q.members.includes(id)),journey=squad?squadTravelStatus(squad):null,title=kind==='contract'?'Contrato':kind==='destination'?'Destino':'Asignación';
 const place=(sector:string)=>campaignPlace(sector)?.name??sector;
 return <div className="strategic-menu-backdrop" onClick={onClose}><section ref={dialog} tabIndex={-1} className="strategic-person-menu" role="dialog" aria-modal="true" aria-label={`${title} de ${op.nickname}`} onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),[tabindex="0"],a[href],summary')??[]).filter(visibleControl).sort((left,right)=>left.compareDocumentPosition(right)&window.Node.DOCUMENT_POSITION_FOLLOWING?-1:1),first=controls[0],last=controls.at(-1);
   if(!first){e.preventDefault();dialog.current?.focus();}
   else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 }}>
  <header><h2>{op.nickname} · {title}</h2><button className="line-button" aria-label="Cerrar" onClick={onClose}>×</button></header>
  {kind==='destination'?journey&&squad?<>
   <p>{squad.name} · {journey.status==='ready'?'En el límite del sector':journey.status==='paused'?'Detenida':journey.returning?'De regreso':'En camino'}</p>
   <p>Destino: <strong>{place(journey.destination)}</strong> · {travelTime(journey.remaining)}</p>
   {journey.reason&&<p>{journey.reason}</p>}
   <div className="strategic-menu-actions">
    {journey.status==='paused'&&<button className="gold-button" disabled={blocked} onClick={()=>order({type:'resumeTravel',squadId:squad.id})}>Retomar marcha</button>}
    {journey.intent!=='attack'&&<button className="line-button" disabled={blocked||journey.returning} onClick={()=>order({type:'cancelTravel',squadId:squad.id,choice:'stop'})}>{journey.elapsed===0?'Cancelar ruta':'Detenerse en el próximo sector'}</button>}
    {journey.intent==='attack'&&journey.elapsed===0&&<button className="line-button" disabled={blocked} onClick={()=>order({type:'cancelTravel',squadId:squad.id})}>Cancelar ataque</button>}
    {journey.elapsed>0&&!journey.returning&&<button className="line-button" disabled={blocked} onClick={()=>order({type:'cancelTravel',squadId:squad.id,choice:'return'})}>Regresar · {travelTime(journey.elapsed)}</button>}
   </div>
  </>:<p>Sin ruta pendiente.</p>:kind==='contract'?<>
   <PreferredCompanionsSummary state={s} operative={op}/>
   <ServiceObjectionNotice reason={serviceObjectionReason(s,op)}/>
   <p>{contract?.remaining===null?'Servicio permanente':`${Math.ceil((contract?.remaining??0)/24)} días hasta la salida`}</p>
   <ServiceRefusalNotice state={s} refusal={contractRefusal} disabled={blocked} dispatch={dispatch}/>
   {contract?.remaining!==null&&['day','week','fortnight'].map(term=>{const q=contractQuote(s,op,term);return <button key={term} className="line-button" disabled={blocked||!q.available||q.price>s.resources.treasury} onClick={()=>order({type:'renewContract',id,term,expectedExpiresAt:s.contracts[id]?.expiresAt,expectedExpiresSecond:s.contracts[id]?.expiresSecond??0})}>{term==='day'?'Un día':term==='week'?'Una semana':'Dos semanas'} · {q.price.toLocaleString('es-AR')} pesos</button>;})}
   {id!==1000&&<button className="line-button" disabled={blocked} onClick={()=>order({type:'dismiss',id})}>Despedir</button>}
  </>:<>
   <PreferredCompanionsSummary state={s} operative={op}/>
   <button type="button" className="line-button" aria-expanded={squadMenu} aria-controls={`personnel-squads-${id}`} disabled={blocked||!record.alive||record.captured} onClick={()=>setSquadMenu(open=>!open)}>Escuadra ›</button>
   {squadMenu&&<div id={`personnel-squads-${id}`} className="strategic-menu-actions strategic-squad-options" aria-label={`Escuadra de ${op.nickname}`}>{strategicSquadAssignments(s,id,op).map(choice=><button type="button" key={choice.number??choice.squad!.id} className="line-button" aria-pressed={Boolean(choice.squad?.members.includes(id))} title={choice.reason??choice.squad?.name} disabled={Boolean(choice.reason)} onClick={()=>order(choice.action)}>{choice.label}</button>)}</div>}
   <div className="strategic-menu-actions">{Object.entries(CARE_ASSIGNMENTS).map(([assignment,label])=>{const why=careAssignmentReason(s,op,assignment);return <button key={assignment} className="line-button" title={why||undefined} disabled={blocked||Boolean(why)} onClick={()=>order({type:'assignCare',operativeId:id,assignment})}>{String(label)}</button>;})}</div>
   <label>Materia de práctica<select aria-label={`Materia de ${op.nickname}`} value={skill} onChange={e=>setSkill(e.target.value)}>{Object.entries(STUDY_SKILLS).map(([value,label])=><option value={value} key={value}>{String(label)} · {op[value]??0}</option>)}</select></label>
   {(op[skill]??0)<35&&<small>Esta habilidad necesita un valor de 35 para mejorar con la práctica.</small>}
   <label>Instructor<select value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">Sin instructor</option>{local.filter(o=>o.id!==id).map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select></label>
   <label>Equipo para reparar<select value={target} onChange={e=>setTarget(e.target.value)}>{local.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select></label>
   <div className="strategic-menu-actions">{Object.entries(WORK_ASSIGNMENTS).map(([assignment,label])=>{const why=workAssignmentReason(s,op,assignment,options,roster);return <button className="line-button" key={assignment} title={why||undefined} disabled={blocked||Boolean(why)} onClick={()=>order({type:'assignWork',operativeId:id,assignment,...options})}>{String(label)}</button>;})}</div>
   <label>Montura disponible<select aria-label={`Montura de ${op.nickname}`} value={mount?.id??''} disabled={blocked||Boolean(mount)||operativeLocation(s,id)!==s.location} onChange={e=>order({type:'horseAction',order:{type:'assign',horseId:e.target.value,operativeId:id}})}><option value="" disabled>Elegir caballo</option>{s.horseState.horses.filter((h:any)=>!h.returned&&!h.custody&&h.location===operativeLocation(s,id)&&(h.assignedTo===null||h.assignedTo===id)).map((h:any)=><option key={h.id} value={h.id} disabled={s.horseState.hour-h.bornAt<MATURITY_HOURS||h.condition<30||h.stamina<20}>{h.name}</option>)}</select></label>
   {mount&&<button className="line-button" disabled={blocked||operativeLocation(s,id)!==s.location} onClick={()=>order({type:'horseAction',order:{type:'unassign',horseId:mount.id}})}>Liberar montura</button>}
  </>}
  <button className="line-button" onClick={onClose}>{kind==='destination'?'Cerrar':'Cancelar'}</button>
 </section></div>;
}
