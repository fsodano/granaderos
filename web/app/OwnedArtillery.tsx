'use client';
import {useState} from 'react';
import {stationedArtillery} from '../../game/campaign-artillery.js';
import {artilleryDeploymentChoices,artillerySelectionReason} from '../../game/equipment.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {localArtilleryDepot,depotSelection} from '../../game/artillery-depots.js';
import {ArtilleryStorage,SendArtillery} from './ArtilleryTransport';
import {finiteArsenalHint} from '../../game/finite-artillery-arsenals.js';
import {artilleryStorageQuote} from '../../game/artillery-transport.js';
import './owned-artillery.css';

export function hasOwnedArtillery(state:any){
 return Boolean(finiteArsenalHint(state))||['bronze4','field8','swivel'].some(type=>(state.armory?.[type]??0)>0)||localArtilleryDepot(state).length>0||stationedArtillery(state).some(({gun}:any)=>gun.side==='player')||(state.artilleryTransfers?.length??0)>0;
}

export default function OwnedArtillery({state:s,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const [selection,setSelection]=useState<string[]|null>(null);
 const stored=localArtilleryDepot(s),field=stationedArtillery(s).filter(({gun}:any)=>gun.side==='player');
 const stock=['bronze4','field8','swivel'].filter(type=>(s.armory?.[type]??0)>0);
 const available=new Set([...stock,...stored.map(depotSelection)]);
 const choices=(selection??artilleryDeploymentChoices(s)).map((choice:string)=>available.has(choice)?choice:'');
 const reason=artillerySelectionReason(s,choices.filter(Boolean));
 const blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated)||s.sectors[s.location]?.owner!=='patriot';
 const load=(gun:any)=>`${gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · ${gun.ammo} en reserva`;
 return <section className="owned-artillery" aria-label="Artillería propia"><h3>Batería de campaña</h3><p>Elegí hasta tres piezas propias para el próximo ataque. Cada pieza del depósito conserva su carga y munición.</p>
  {finiteArsenalHint(s)&&<p role="status">{finiteArsenalHint(s)}</p>}
  <div className="owned-artillery-selection">{[0,1,2].map(index=><label key={index}>Pieza {index+1}<select aria-label={`Pieza propia ${index+1}`} value={choices[index]??''} disabled={blocked} onChange={event=>{const next=[...choices];next[index]=event.target.value;setSelection(next);}}><option value="">Sin pieza</option>{stock.map(type=><option key={type} value={type}>{artilleryProfile(s,type).name} · {s.armory[type]} disponibles</option>)}{stored.map((gun:any)=><option key={gun.id} value={depotSelection(gun)}>{artilleryProfile(s,gun).name} · {load(gun)} · {gun.id}</option>)}</select></label>)}</div>
  <button className="line-button" disabled={blocked||Boolean(reason)} title={reason||undefined} onClick={()=>{dispatch({type:'configureArtillery',types:choices.filter(Boolean)});setSelection(null);}}>Preparar batería</button>{reason&&<p role="status">{reason}</p>}
  {field.length>0&&<section aria-label="Artillería emplazada"><h3>Piezas emplazadas</h3><p>Permanecen en este sector al salir. Guardalas en el depósito local para elegirlas en la batería. Cada pieza conserva su carga, munición y trabajo de recarga.</p>{field.map(({sector,gun}:any)=>{const quote=artilleryStorageQuote(s,sector,gun.id);return <div key={`${sector}:${gun.id}`} data-artillery-id={gun.id}><p>{artilleryProfile(s,gun).name} · {load(gun)}</p><button className="line-button" disabled={!quote.available} title={quote.reason||undefined} onClick={()=>dispatch({type:'storeArtillery',sector,artilleryId:gun.id})}>Guardar pieza</button><SendArtillery state={s} sector={sector} gun={gun} dispatch={dispatch}/></div>;})}</section>}
  <ArtilleryStorage state={s} dispatch={dispatch}/>
 </section>;
}
