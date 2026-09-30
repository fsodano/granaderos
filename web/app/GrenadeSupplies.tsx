'use client';
import {grenadeOffer} from '../../game/equipment.js';
import {isSupplied} from '../../game/campaign.js';
type Props={state:any;operative:any;dispatch:(action:any)=>void};
export default function GrenadeSupplies({state,operative,dispatch}:Props){
 const offer=grenadeOffer(state,operative,isSupplied);
 return <section className="armory-resale" aria-labelledby="grenade-supplies-title">
  <h3 id="grenade-supplies-title">Granadas de arsenal</h3>
  <p>{offer.stock} disponibles · {offer.note}</p>
  <p>{operative?`Se entrega a ${operative.name}.`:'Elegí un combatiente presente en la hoja de equipo.'}</p>
  <button type="button" className="line-button" disabled={!offer.available} title={offer.reason??undefined} onClick={()=>{if(offer.available)dispatch(offer.action);}}>Comprar {offer.name} · {offer.price} pesos</button>
  {!offer.available&&<p>{offer.reason}</p>}
  <small>Colocá una granada en la mano principal. Botón derecho o F prepara el lanzamiento; clic en una casilla la arroja.</small>
 </section>;
}
