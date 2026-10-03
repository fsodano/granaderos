'use client';
import {sitePath} from '../lib/site-path.js';
import {useState} from 'react';
import {AMMUNITION_TYPES} from '../../game/ammunition-types.js';
import {ammunitionOrderQuote,AMMUNITION_ORDER_LIMIT} from '../../game/campaign-ammunition.js';
import {AMMUNITION_FAMILIES} from '../../game/ammunition-families.js';
import {WEAPONS} from '../../game/data.js';
import {isSupplied,rosterFor} from '../../game/campaign.js';
import {operativeLocation} from '../../game/squads.js';

type Props={state:any;dispatch:(action:any)=>void};
export default function AmmunitionSupplies({state:s,dispatch}:Props){
 const [ammoType,setAmmoType]=useState('musket_75'),[quantity,setQuantity]=useState('20');
 const candidates=rosterFor(s).filter((op:any)=>s.recruited.includes(op.id)&&s.operativeState[op.id]?.alive&&!s.operativeState[op.id].captured&&operativeLocation(s,op.id)===s.location);
 const [recipient,setRecipient]=useState('');
 const operative=candidates.find((op:any)=>String(op.id)===recipient)??candidates[0];
 const spec=(AMMUNITION_TYPES as any)[ammoType],family=Object.values(AMMUNITION_FAMILIES).find(f=>f.type===ammoType)!.id,amount=Number(quantity);
 const quote=ammunitionOrderQuote(s,operative,family,amount,'buy',isSupplied(s,s.location));
 const maximum=Math.min(quote.stock,AMMUNITION_ORDER_LIMIT);
 return <form className="armory-resale" aria-labelledby="ammunition-supplies-title" onSubmit={event=>{event.preventDefault();if(quote.available)dispatch({type:'ammunition',operativeId:operative.id,family,quantity:amount,direction:'buy'});}}>
  <h3 id="ammunition-supplies-title">Munición compatible</h3>
  <label htmlFor="ammunition-recipient">Combatiente<select id="ammunition-recipient" value={operative?.id??''} disabled={!candidates.length} onChange={event=>setRecipient(event.target.value)}>{!candidates.length&&<option value="">Sin combatientes disponibles</option>}{candidates.map((op:any)=><option key={op.id} value={op.id}>{op.name}</option>)}</select></label>
  <label htmlFor="ammunition-type">Tipo de carga<select id="ammunition-type" value={ammoType} onChange={event=>setAmmoType(event.target.value)}>{Object.values(AMMUNITION_TYPES).map((type:any)=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
  <img src={sitePath(spec.art)} alt={spec.name} width={96} height={64} style={{objectFit:"contain"}}/>
  <p>Para: {spec.weaponIds.map((id:number)=>(WEAPONS as any)[id].name).join(', ')}.</p>
  <p>{quote.carried} en los bolsillos · {quote.stored} guardados en este sector · {quote.stock} disponibles en el comercio.</p>
  <label htmlFor="ammunition-quantity">Cantidad<input id="ammunition-quantity" type="number" min="1" max={maximum||1} step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} required/></label>
  <button type="submit" className="line-button" disabled={!quote.available} title={quote.reason??undefined}>Comprar · {Number.isFinite(quote.cost)&&quote.cost>0?quote.cost:0} pesos</button>
  {quote.reason&&<p>{quote.reason}</p>}
  <small>La compra va a los bolsillos del combatiente seleccionado. Los cartuchos conservan su familia y los depósitos quedan en su sector.</small>
 </form>;
}
