'use client';
import {useState} from 'react';
import {missionAssaultSquads} from '../../game/mission-assault.js';
type MissionSquad={id:string;name:string;members:number[];reason:string|null};
export default function MissionAssault({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const [support,setSupport]=useState<string[]>([]);
 const choices:MissionSquad[]=missionAssaultSquads(state);
 const selected=choices.filter(q=>q.id===state.activeSquadId||support.includes(q.id));
 const local=state.location==='san_nicolas'&&choices.some(q=>q.id===state.activeSquadId);
 const blocked=!local||Boolean(state.pendingBattle||state.pendingEncounter)||selected.some(q=>q.reason)||selected.length===0;
 return <fieldset className="field-supplies"><legend>Fuerza para San Lorenzo</legend>
  <p>La escuadra activa participa. Podés sumar otras escuadras disponibles en San Nicolás. San Martín combate como aliado local.</p>
  {!local&&<p>Seleccioná una escuadra en San Nicolás para preparar la misión.</p>}
  {choices.map(q=><label key={q.id} style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={q.id===state.activeSquadId||support.includes(q.id)} disabled={q.id===state.activeSquadId||Boolean(q.reason)||!local} onChange={event=>setSupport(old=>event.target.checked?[...old,q.id]:old.filter(id=>id!==q.id))}/>{' '}{q.name} · {q.members.length} combatientes{q.reason?` · ${q.reason}`:q.id===state.activeSquadId?' · Escuadra activa':''}</label>)}
  <p>{selected.reduce((sum,q)=>sum+q.members.length,0)} combatientes seleccionados · {selected.length} escuadras</p>
  <button className="gold-button" disabled={blocked} onClick={()=>dispatch({type:'attack',sector:'san_lorenzo',squadIds:selected.map(q=>q.id)})}>Marchar a San Lorenzo</button>
 </fieldset>;
}
