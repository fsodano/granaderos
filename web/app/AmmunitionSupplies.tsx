'use client';
import {useState} from 'react';
import {AMMUNITION_TYPES} from '../../game/ammunition-types.js';
import {ammoResourceKey} from '../../game/campaign-ammunition.js';
import {WEAPONS} from '../../game/data.js';
import {AMMUNITION_PRICE,merchantStatus} from '../../game/equipment.js';
import {isSupplied} from '../../game/campaign.js';

type Props={state:any;dispatch:(action:any)=>void};
export default function AmmunitionSupplies({state:s,dispatch}:Props){
 const [ammoType,setAmmoType]=useState('musket_75'),[quantity,setQuantity]=useState('20');
 const spec=(AMMUNITION_TYPES as any)[ammoType],market=merchantStatus(s,null,isSupplied);
 const stock=s.merchants?.[s.location]?.ammunition?.[ammoType]??0,amount=Number(quantity),price=amount*AMMUNITION_PRICE;
 const valid=market.available&&Number.isInteger(amount)&&amount>0&&amount<=stock&&s.resources.treasury>=price;
 return <form className="armory-resale" aria-labelledby="ammunition-supplies-title" onSubmit={event=>{event.preventDefault();if(valid)dispatch({type:'purchaseAmmunition',ammoType,quantity:amount});}}>
  <h3 id="ammunition-supplies-title">Munición por calibre</h3>
  <label htmlFor="ammunition-type">Tipo de carga<select id="ammunition-type" value={ammoType} onChange={event=>setAmmoType(event.target.value)}>{Object.values(AMMUNITION_TYPES).map((type:any)=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
  <p>Para: {spec.weaponIds.map((id:number)=>(WEAPONS as any)[id].name).join(', ')}.</p>
  <p>{s.resources[ammoResourceKey(ammoType)]??0} en reserva · {stock} disponibles en el comercio.</p>
  <label htmlFor="ammunition-quantity">Cantidad<input id="ammunition-quantity" type="number" min="1" max={stock||1} step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} required/></label>
  <button type="submit" className="line-button" disabled={!valid} title={market.reason??undefined}>Comprar · {Number.isFinite(price)&&price>0?price:0} pesos</button>
  {!market.available&&<p>{market.reason}</p>}
  <small>Al desplegar, cada combatiente toma munición compatible de la reserva disponible. Los cartuchos que ya lleva conservan su calibre.</small>
 </form>;
}
