'use client';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,rosterFor} from '../../game/campaign.js';
import {enemyGroupStatus,localDefenderIds,retreatDestinations} from '../../game/enemy-groups.js';
import './enemy-encounters.css';
const place=(id:string)=>CAMPAIGN_SECTORS.find(s=>s.id===id)?.name??id;
export default function EnemyEncounters({state:s,dispatch}:{state:any;dispatch:(a:any)=>void}){
 const [destination,setDestination]=useState('');
 const groups=(s.enemyGroups??[]).filter((g:any)=>['marching','waiting','engaged','stationed'].includes(g.status)).map((g:any)=>enemyGroupStatus(s,g));
 const encounter=s.pendingEncounter,group=groups.find((g:any)=>g.id===encounter?.groupId),exits=group?retreatDestinations(s,group.target):[],target=exits.includes(destination)?destination:exits[0]??'';
 const captives=rosterFor(s).filter(o=>s.operativeState[o.id]?.captured),report=s.encounterHistory?.[0];
 if(!groups.length&&!captives.length&&!report)return null;
 return <section className="enemy-encounters" aria-label="Movimientos y encuentros realistas"><h2>Partes del frente</h2>
 {group&&<div className="encounter-decision" role="region" aria-label="Respuesta al encuentro"><h3>Contacto en {group.destination}</h3><p>{group.strength} realistas · {localDefenderIds(s,group.target).length} granaderos y {s.sectors[group.target].militia.reduce((a:number,b:number)=>a+b,0)} milicianos presentes.</p><p>El reloj está detenido. La resolución automática usa sus armas, municiones y salud. Los milicianos permanecen para defender el sector si los granaderos se retiran.</p><div className="encounter-actions"><button className="gold-button" onClick={()=>dispatch({type:'respondToEncounter',groupId:group.id,choice:'tactical'})}>Defensa táctica</button><button className="line-button" onClick={()=>dispatch({type:'respondToEncounter',groupId:group.id,choice:'auto'})}>Resolver automáticamente</button></div>{exits.length>0&&localDefenderIds(s,group.target).length>0?<div className="encounter-retreat"><label>Destino de retirada<select value={target} onChange={e=>setDestination(e.target.value)}>{exits.map((id:string)=><option key={id} value={id}>{place(id)}</option>)}</select></label><button className="line-button" onClick={()=>dispatch({type:'respondToEncounter',groupId:group.id,choice:'retreat',destination:target})}>Retirar granaderos</button></div>:<p>Sin ruta de retirada para los granaderos. Si sobreviven a una derrota sin salida, quedarán prisioneros.</p>}</div>}
 {groups.length>0&&<ul className="enemy-movements">{groups.map((g:any)=><li key={g.id}><strong>{g.commander}</strong><span>{g.strength} soldados · {g.location} → {g.destination}</span><span>{g.status==='marching'?`Llegada prevista en ${g.remaining} h`:g.status==='stationed'?'Ocupación: necesita un contraataque':g.status==='engaged'?'Combate en curso':'Contacto pendiente'}</span></li>)}</ul>}
 {captives.length>0&&<div className="encounter-prisoners"><h3>Prisioneros</h3><p>Liberá el sector para recuperar a los combatientes. Sus contratos quedan suspendidos durante el cautiverio.</p><ul>{captives.map(o=><li key={o.id}>{o.name} · {place(s.operativeState[o.id].capturedSector)} · {s.operativeState[o.id].hp} salud</li>)}</ul></div>}
 {report&&<p className="encounter-report">Último parte · Día {Math.floor(report.hour/24)+1}: {report.text}</p>}
 </section>;
}
