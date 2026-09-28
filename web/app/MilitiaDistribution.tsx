'use client';
import {useState} from 'react';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {MILITIA_NAMES} from '../../game/militia.js';
import {militiaDistributionStatus,militiaTransferPreview,militiaDistributionPreview} from '../../game/militia-distribution.js';
import './militia-distribution.css';
const label=(id:string)=>CAMPAIGN_SECTORS.find(x=>x.id===id)?.name??id;
export default function MilitiaDistribution({state,sector,dispatch}:{state:any;sector:string;dispatch:(action:any)=>void}){
 const status=militiaDistributionStatus(state,sector),destinations=status.sectors.filter((id:string)=>id!==sector);
 const [destination,setDestination]=useState(''),[rank,setRank]=useState(0),[quantity,setQuantity]=useState('1');
 const to=destinations.includes(destination)?destination:destinations[0]??'';
 const action={type:'transferMilitia',from:sector,to,rank,count:Number(quantity)},preview=militiaTransferPreview(state,action),automatic=militiaDistributionPreview(state,sector);
 return <details className="militia-distribution">
  <summary>Distribuir milicias</summary>
  <div className="militia-distribution-content">{status.reason?<p role="status">{status.reason}</p>:<>
   <p>Mové defensores entre los sectores propios conectados de {status.city?.name}.</p>
   <ul aria-label="Guarniciones de la ciudad">{status.sectors.map((id:string)=><li key={id}><strong>{label(id)}</strong><span>{state.sectors[id].militia.map((count:number,r:number)=>`${MILITIA_NAMES[r]}: ${count}`).join(' · ')}</span></li>)}</ul>
   <label>Destino<select aria-label="Destino de las milicias" value={to} onChange={e=>setDestination(e.target.value)}>{destinations.map((id:string)=><option key={id} value={id}>{label(id)}</option>)}</select></label>
   <label>Grado<select aria-label="Grado de las milicias" value={rank} onChange={e=>setRank(Number(e.target.value))}>{MILITIA_NAMES.map((name:string,r:number)=><option key={r} value={r}>{name}</option>)}</select></label>
   <label>Cantidad<input aria-label="Cantidad de milicias" type="number" min="1" max="60" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <p role="status">{preview.valid?`${preview.available} disponibles en este grado · ${preview.room} plazas en el destino.`:preview.reason}</p>
   <button className="line-button" disabled={!preview.valid} onClick={()=>dispatch(action)}>Trasladar defensores</button>
   <button className="line-button" disabled={!automatic.valid} onClick={()=>dispatch({type:'distributeMilitia',sector})}>Distribuir de forma pareja</button>
   {automatic.valid&&'targets' in automatic?<ul aria-label="Distribución prevista">{automatic.sectors.map((id:string)=><li key={id}>{label(id)}: {automatic.targets[id].reduce((a:number,b:number)=>a+b,0)} defensores</li>)}</ul>:<p>{automatic.reason}</p>}
   <small>La redistribución local es inmediata. Conserva armas, munición, heridas y experiencia. Los heridos inestables y los alumnos permanecen en su sector. Cada sector admite 60 plazas, incluida la instrucción.</small>
  </>}</div>
 </details>;
}
