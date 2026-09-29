'use client';
import {useState} from 'react';
import {AMMO_KEYS,AMMO_TYPES,ammoTypeFor} from '../../game/ammo-types.js';
import {ammunitionOrderQuote,AMMUNITION_ORDER_LIMIT,hasAmmunitionMarket} from '../../game/campaign-ammunition.js';
import {isSupplied} from '../../game/campaign.js';
import {campaignPlace} from '../../game/world-cells.js';

export default function CampaignAmmunition({state:s,operative,dispatch}:{state:any;operative:any;dispatch:(action:any)=>void}){
 const [family,setFamily]=useState(ammoTypeFor(operative)??'ammoMusket'),[quantity,setQuantity]=useState('10');
 const value=Number(quantity),supplied=isSupplied(s,s.location),quotes=Object.fromEntries(['buy','store','take'].map(direction=>[direction,ammunitionOrderQuote(s,operative,family,value,direction,supplied)]));
 const selected=AMMO_TYPES[family],location=campaignPlace(s.location)?.name??s.location;
 const act=(direction:string)=>dispatch({type:'ammunition',operativeId:operative?.id,family,quantity:value,direction});
 return <section className="campaign-ammunition" aria-label="Munición y depósito">
  <h3>Munición y depósito</h3>
  <label htmlFor="campaign-ammunition-family">Familia de munición<select id="campaign-ammunition-family" value={family} onChange={event=>setFamily(event.target.value)}>{AMMO_KEYS.map(key=><option key={key} value={key}>{AMMO_TYPES[key].name}</option>)}</select></label>
  <div className="campaign-ammunition-summary"><img src={selected.art} alt={selected.name}/><div><p>{quotes.buy.carried} cartuchos sueltos con {operative?.name??'el combatiente'}</p><p>{quotes.buy.stored} guardados en {location}</p>{ammoTypeFor(operative)===family&&<p>{quotes.buy.loaded} en el arma</p>}</div></div>
  <label htmlFor="campaign-ammunition-quantity">Cantidad de cartuchos<input id="campaign-ammunition-quantity" type="number" min="1" max={AMMUNITION_ORDER_LIMIT} step="1" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
  <div className="campaign-ammunition-actions"><button className="line-button" disabled={!quotes.buy.available} title={quotes.buy.reason??undefined} onClick={()=>act('buy')}>Comprar · {Number.isSafeInteger(quotes.buy.cost)?quotes.buy.cost:0} pesos</button><button className="line-button" disabled={!quotes.store.available} title={quotes.store.reason??undefined} onClick={()=>act('store')}>Guardar en este sector</button><button className="line-button" disabled={!quotes.take.available} title={quotes.take.reason??undefined} onClick={()=>act('take')}>Retirar del depósito</button></div>
  {hasAmmunitionMarket(s,s.location)&&<p>{quotes.buy.stock} disponibles con el proveedor · {quotes.buy.unitPrice} {quotes.buy.unitPrice===1?'peso':'pesos'} por cartucho.</p>}
  {quotes.buy.reason&&<p role="status">{quotes.buy.reason}</p>}
  <small>Los cartuchos conservan su familia. El depósito queda en este sector. Al entrar o partir de una localidad propia y comunicada se compra solo lo que falta para la carga configurada; fuera de esas localidades llevás tu munición actual.</small>
 </section>;
}
